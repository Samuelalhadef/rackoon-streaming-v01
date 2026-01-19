// Version avec système de stockage JSON
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Activer le support H.265/HEVC natif via Windows Media Foundation
// Permet de lire les fichiers H.265 sans transcodage
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,VaapiVideoDecodeLinuxGL,VaapiVideoEncoder');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
const { glob } = require('glob');
const { execSync, exec, spawn } = require('child_process');
const os = require('os');
const JSONDatabase = require('./js/db-manager');
const https = require('https');
const http = require('http');
const { Server } = require('socket.io');
const WatchPartyManager = require('./js/watch-party-manager');
const ngrok = require('@ngrok/ngrok');

// Gestionnaires d'erreurs globaux pour détecter les crashs silencieux
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non capturée:', error);
  dialog.showErrorBox('Erreur critique', `Une erreur est survenue:\n${error.message}\n\nL'application va se fermer.`);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  dialog.showErrorBox('Erreur', `Une erreur asynchrone est survenue:\n${reason}`);
});

// Chemins pour FFmpeg
let FFMPEG_PATH;
let FFPROBE_PATH;

// Trouver FFmpeg dans différents emplacements
function findFfmpegPaths() {
  // Chemins possibles de FFmpeg
  const possiblePaths = [
    // Chemin manuel installé
    path.join(os.homedir(), 'Documents', 'ffmpeg', 'ffmpeg-master-latest-win64-gpl-shared', 'bin', 'ffmpeg.exe'),
    // Chemin standard d'installation
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    // Chemin Chocolateya
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    // Chemin dans le PATH (juste le nom du fichier)
    'ffmpeg.exe'
  ];
  
  // Trouver le premier chemin existant pour FFmpeg
  FFMPEG_PATH = possiblePaths.find(p => {
    try {
      return fs.existsSync(p);
    } catch (e) {
      return false;
    }
  }) || 'ffmpeg';
  
  // Même chose pour FFprobe
  const possibleProbes = [
    path.join(os.homedir(), 'Documents', 'ffmpeg', 'ffmpeg-master-latest-win64-gpl-shared', 'bin', 'ffprobe.exe'),
    'C:\\ffmpeg\\bin\\ffprobe.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffprobe.exe',
    'ffprobe.exe'
  ];
  
  FFPROBE_PATH = possibleProbes.find(p => {
    try {
      return fs.existsSync(p);
    } catch (e) {
      return false;
    }
  }) || 'ffprobe';
}

// Utiliser FFmpeg statique préinstallé
function setupStaticFfmpeg() {
  try {
    // Utiliser les binaires statiques du module ffmpeg-static et ffprobe-static
    let ffmpegPath = require('ffmpeg-static');
    let ffprobePath = require('ffprobe-static').path;

    // Dans l'app packagée, remplacer app.asar par app.asar.unpacked si nécessaire
    if (ffmpegPath && ffmpegPath.includes('app.asar') && !ffmpegPath.includes('app.asar.unpacked')) {
      ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    }
    if (ffprobePath && ffprobePath.includes('app.asar') && !ffprobePath.includes('app.asar.unpacked')) {
      ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
    }

    if (ffmpegPath && ffprobePath) {
      FFMPEG_PATH = ffmpegPath;
      FFPROBE_PATH = ffprobePath;
      console.log('✅ FFmpeg configuré');
      return true;
    }
  } catch (error) {
    // FFmpeg non disponible
  }

  return false;
}

// Formats de fichiers vidéo supportés
const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];

// Variables globales
let mainWindow;
let db;
let httpServer;
let io;
let watchPartyManager;
let ngrokUrl = null; // URL publique ngrok pour le partage
let DATA_DIR; // Dossier data dans userData
let localVideoServer; // Serveur HTTP local pour les vidéos locales
const LOCAL_VIDEO_PORT = 3002; // Port pour le serveur local
const remuxCache = new Map(); // Cache des fichiers remuxés (path+track -> tempFilePath)

// Système de pré-transcodage en arrière-plan
const preparedMediaCache = new Map(); // Cache: chemin original -> chemin MP4 préparé
const transcodeQueue = []; // File d'attente des fichiers à transcoder
let isTranscoding = false; // Flag pour éviter les transcodages simultanés

// Codecs audio non supportés par les navigateurs
const UNSUPPORTED_AUDIO = ['ac3', 'eac3', 'dts', 'dca', 'truehd', 'mlp'];

// Vérifie si un fichier a besoin d'être pré-transcodé
async function checkNeedsTranscode(filePath) {
  if (!FFPROBE_PATH) return { needs: false };

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mkv') return { needs: false };

  return new Promise((resolve) => {
    const command = `"${FFPROBE_PATH}" -v quiet -print_format json -show_streams -select_streams a:0 "${filePath}"`;
    exec(command, { encoding: 'utf8' }, (error, stdout) => {
      if (error) return resolve({ needs: false });
      try {
        const data = JSON.parse(stdout);
        const audioStream = data.streams?.[0];
        if (audioStream) {
          const codec = (audioStream.codec_name || '').toLowerCase();
          const needs = UNSUPPORTED_AUDIO.some(c => codec.includes(c));
          resolve({ needs, codec });
        } else {
          resolve({ needs: false });
        }
      } catch (e) {
        resolve({ needs: false });
      }
    });
  });
}

// Ajoute un fichier à la file d'attente de pré-transcodage
function queueForTranscode(filePath) {
  // Vérifier si déjà en cache ou en file d'attente
  if (preparedMediaCache.has(filePath)) return;
  if (transcodeQueue.includes(filePath)) return;

  transcodeQueue.push(filePath);
  console.log(`📋 Ajouté à la file de transcodage: ${path.basename(filePath)} (${transcodeQueue.length} en attente)`);

  // Démarrer le traitement si pas déjà en cours
  processTranscodeQueue();
}

// Traite la file d'attente de transcodage
async function processTranscodeQueue() {
  if (isTranscoding || transcodeQueue.length === 0) return;

  isTranscoding = true;
  const filePath = transcodeQueue.shift();

  try {
    // Vérifier si vraiment besoin de transcoder
    const check = await checkNeedsTranscode(filePath);
    if (!check.needs) {
      console.log(`⏭️ Pas besoin de transcoder: ${path.basename(filePath)}`);
      isTranscoding = false;
      processTranscodeQueue();
      return;
    }

    console.log(`🔄 Pré-transcodage en cours: ${path.basename(filePath)} (audio: ${check.codec})`);

    // Notifier le front-end
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcode:progress', {
        file: path.basename(filePath),
        status: 'processing',
        remaining: transcodeQueue.length
      });
    }

    // Créer le fichier MP4
    const tempDir = path.join(app.getPath('temp'), 'rackoon-prepared');
    fs.ensureDirSync(tempDir);
    const mp4Path = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}_prepared.mp4`);

    // Si le fichier existe déjà, l'utiliser
    if (fs.existsSync(mp4Path)) {
      console.log(`✅ Fichier préparé existant trouvé: ${path.basename(mp4Path)}`);
      preparedMediaCache.set(filePath, mp4Path);
      isTranscoding = false;
      processTranscodeQueue();
      return;
    }

    // Lancer FFmpeg pour remux + transcode audio
    const ffmpegArgs = [
      '-y',
      '-i', filePath,
      '-map', '0:v:0',
      '-map', '0:a:0',
      '-c:v', 'copy',         // Copier vidéo (pas de réencodage)
      '-c:a', 'aac',          // Transcoder audio en AAC
      '-b:a', '192k',
      '-ac', '2',
      '-movflags', '+faststart',
      mp4Path
    ];

    const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
      const line = data.toString();
      // Extraire la progression
      const timeMatch = line.match(/time=(\d+:\d+:\d+)/);
      if (timeMatch && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcode:progress', {
          file: path.basename(filePath),
          status: 'processing',
          time: timeMatch[1],
          remaining: transcodeQueue.length
        });
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(mp4Path)) {
        const size = Math.round(fs.statSync(mp4Path).size / 1024 / 1024);
        console.log(`✅ Pré-transcodage terminé: ${path.basename(mp4Path)} (${size}MB)`);
        preparedMediaCache.set(filePath, mp4Path);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transcode:progress', {
            file: path.basename(filePath),
            status: 'done',
            remaining: transcodeQueue.length
          });
        }
      } else {
        console.error(`❌ Erreur pré-transcodage: ${path.basename(filePath)}`);
      }

      isTranscoding = false;
      processTranscodeQueue(); // Traiter le suivant
    });

    ffmpeg.on('error', (err) => {
      console.error('❌ Erreur FFmpeg:', err);
      isTranscoding = false;
      processTranscodeQueue();
    });

  } catch (err) {
    console.error('Erreur processTranscodeQueue:', err);
    isTranscoding = false;
    processTranscodeQueue();
  }
}

// Créer la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public', 'img', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'views', 'dashboard.html'));

  // Ouvrir les outils de développement en mode développement
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// Vérifier si ffmpeg est disponible
function checkFfmpegInstalled() {
  try {
    execSync(`"${FFMPEG_PATH}" -version`, { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.log('⚠️ FFmpeg non accessible - Les miniatures ne seront pas générées');
    return false;
  }
}

// Extraire les métadonnées d'une vidéo (durée, résolution, etc.)
function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    try {
      // Commande ffprobe pour obtenir les métadonnées en JSON
      const command = `"${FFPROBE_PATH}" -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Erreur ffprobe:', error.message);
          resolve({ duration: 0, width: 0, height: 0 }); // Valeurs par défaut en cas d'erreur
          return;
        }
        
        try {
          const metadata = JSON.parse(stdout);
          let duration = 0;
          let width = 0;
          let height = 0;
          
          // Extraire la durée depuis format
          if (metadata.format && metadata.format.duration) {
            duration = parseFloat(metadata.format.duration);
          }
          
          // Extraire les dimensions depuis le premier stream vidéo
          if (metadata.streams) {
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (videoStream) {
              width = videoStream.width || 0;
              height = videoStream.height || 0;
              
              // Si pas de durée dans format, essayer dans le stream
              if (duration === 0 && videoStream.duration) {
                duration = parseFloat(videoStream.duration);
              }
            }
          }
          
          resolve({ duration, width, height });
        } catch (parseError) {
          console.error('Erreur parsing métadonnées:', parseError);
          resolve({ duration: 0, width: 0, height: 0 });
        }
      });
    } catch (error) {
      console.error('Erreur extraction métadonnées:', error);
      resolve({ duration: 0, width: 0, height: 0 });
    }
  });
}

// Extraire une frame d'une vidéo pour créer une miniature
function extractThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Créer le dossier de sortie s'il n'existe pas
      fs.ensureDirSync(path.dirname(outputPath));

      // Commande ffmpeg pour extraire une frame à 15 secondes
      // -update 1 : nécessaire pour écrire un seul fichier image (sinon FFmpeg attend un pattern de séquence)
      const command = `"${FFMPEG_PATH}" -ss 00:00:15 -i "${videoPath}" -vframes 1 -update 1 -q:v 2 "${outputPath}" -y`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Si échec à 15s, essayer à 5s
          const fallbackCommand = `"${FFMPEG_PATH}" -ss 00:00:05 -i "${videoPath}" -vframes 1 -update 1 -q:v 2 "${outputPath}" -y`;

          exec(fallbackCommand, (err, stdout, stderr) => {
            if (err) {
              console.error('Erreur extraction miniature:', err.message);
              console.error('Stderr FFmpeg:', stderr);
              reject(err);
              return;
            }

            if (fs.existsSync(outputPath)) {
              console.log(`✅ Thumbnail créé (fallback 5s): ${outputPath}`);
              resolve(outputPath);
            } else {
              reject(new Error('Miniature non créée'));
            }
          });
          return;
        }

        if (fs.existsSync(outputPath)) {
          console.log(`✅ Thumbnail créé: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error('Miniature non créée'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Télécharger une image TMDB et la stocker localement
function downloadTMDBImage(imageUrl, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Créer le dossier de sortie s'il n'existe pas
      fs.ensureDirSync(path.dirname(outputPath));
      
      // Vérifier si le fichier existe déjà
      if (fs.existsSync(outputPath)) {
        console.log(`Image déjà téléchargée: ${path.basename(outputPath)}`);
        resolve(outputPath);
        return;
      }
      
      // Créer le fichier de destination
      const file = fs.createWriteStream(outputPath);
      
      console.log(`📥 Téléchargement de l'image: ${imageUrl}`);
      
      https.get(imageUrl, (response) => {
        // Vérifier le code de réponse
        if (response.statusCode !== 200) {
          reject(new Error(`Erreur HTTP: ${response.statusCode}`));
          return;
        }
        
        // Pipe la réponse vers le fichier
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`✅ Image téléchargée: ${path.basename(outputPath)}`);
          resolve(outputPath);
        });
        
        file.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Supprimer le fichier incomplet
          reject(err);
        });
        
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Supprimer le fichier incomplet
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Générer un nom de fichier unique pour une image TMDB
function generateTMDBImageName(mediaTitle, tmdbImageUrl) {
  const timestamp = Date.now();
  const extension = path.extname(tmdbImageUrl) || '.jpg';
  // Nettoyer le titre pour le nom de fichier
  const cleanTitle = mediaTitle
    .replace(/[<>:"/\\|?*]/g, '') // Supprimer les caractères non valides
    .replace(/\s+/g, '_') // Remplacer les espaces par des underscores
    .substring(0, 50); // Limiter la longueur
  
  return `tmdb_${cleanTitle}_${timestamp}${extension}`;
}

// Fonction helper pour formater la taille des fichiers
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// SERVEUR HTTP & WATCH PARTY
// ========================================

// Fonction utilitaire pour obtenir l'IP locale
function getLocalIPAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // IPv4, pas localhost, pas interne
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Fonction pour démarrer le serveur HTTP (appelée au démarrage de l'app)
function startHTTPServer() {
  return new Promise((resolve, reject) => {
    // Si le serveur est déjà démarré
    if (httpServer) {
      resolve(true);
      return;
    }

    // Créer le serveur HTTP avec support streaming vidéo et thumbnails
    httpServer = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);

      // Route pour streamer la vidéo (Watch Party) avec transcodage pour compatibilité mobile
      if (url.pathname.startsWith('/video/')) {
        const sessionCode = url.pathname.split('/')[2];

        if (!watchPartyManager) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('Watch Party non actif');
          return;
        }

        const session = watchPartyManager.activeSessions.get(sessionCode);
        if (!session || !session.video || !session.video.path) {
          res.writeHead(404);
          res.end('Vidéo introuvable');
          return;
        }

        const videoPath = session.video.path;

        // Vérifier que le fichier existe
        if (!fs.existsSync(videoPath)) {
          res.writeHead(404);
          res.end('Fichier vidéo introuvable');
          return;
        }

        console.log('📺 Streaming Watch Party avec transcodage:', path.basename(videoPath));

        // Transcodage en temps réel avec FFmpeg pour compatibilité navigateur/mobile
        // H.264 (video) + AAC (audio) = compatible partout
        const ffmpegArgs = [
          '-i', videoPath,
          '-c:v', 'libx264',        // Codec vidéo H.264 (universel)
          '-preset', 'ultrafast',   // Encodage rapide pour streaming temps réel
          '-tune', 'zerolatency',   // Latence minimale
          '-crf', '23',             // Qualité (18-28, plus bas = meilleure qualité)
          '-c:a', 'aac',            // Codec audio AAC (universel)
          '-b:a', '192k',           // Bitrate audio
          '-ac', '2',               // Stéréo (compatible mobile)
          '-movflags', 'frag_keyframe+empty_moov+faststart', // Streaming progressif
          '-f', 'mp4',              // Format MP4
          '-'                       // Sortie vers stdout
        ];

        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        ffmpeg.stdout.pipe(res);

        ffmpeg.stderr.on('data', (data) => {
          // Log FFmpeg progress (optionnel, peut être commenté)
          // console.log('FFmpeg:', data.toString());
        });

        ffmpeg.on('error', (err) => {
          console.error('❌ Erreur FFmpeg streaming:', err.message);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end('Erreur de transcodage');
          }
        });

        ffmpeg.on('close', (code) => {
          if (code !== 0 && code !== 255) {
            console.log(`⚠️ FFmpeg terminé avec code: ${code}`);
          }
        });

        // Arrêter FFmpeg si le client se déconnecte
        req.on('close', () => {
          ffmpeg.kill('SIGKILL');
        });

        return;
      }
      // Route pour servir les thumbnails
      else if (url.pathname.startsWith('/thumbnails/')) {
        const thumbnailName = url.pathname.split('/thumbnails/')[1];
        const thumbnailPath = path.join(DATA_DIR, 'thumbnails', thumbnailName);

        // Vérifier que le fichier existe
        if (!fs.existsSync(thumbnailPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Thumbnail not found');
          return;
        }

        // Servir l'image
        const stat = fs.statSync(thumbnailPath);
        const img = fs.readFileSync(thumbnailPath);

        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400', // Cache 24h
          'Access-Control-Allow-Origin': '*'
        });
        res.end(img);
      }
      // Route pour servir les images TMDB
      else if (url.pathname.startsWith('/tmdb-images/')) {
        const imageName = url.pathname.split('/tmdb-images/')[1];
        const imagePath = path.join(DATA_DIR, 'tmdb-images', imageName);

        // Vérifier que le fichier existe
        if (!fs.existsSync(imagePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('TMDB image not found');
          return;
        }

        // Servir l'image
        const stat = fs.statSync(imagePath);
        const img = fs.readFileSync(imagePath);

        // Déterminer le type MIME
        const ext = path.extname(imagePath).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp'
        };
        const contentType = mimeTypes[ext] || 'image/jpeg';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400', // Cache 24h
          'Access-Control-Allow-Origin': '*'
        });
        res.end(img);
      }
      // Route pour la page Watch Party (lecteur web)
      else if (url.pathname.startsWith('/watch/')) {
        const sessionCode = url.pathname.split('/')[2];

        // Lire et servir la page HTML
        const watchHtmlPath = path.join(__dirname, 'views', 'watch.html');

        if (!fs.existsSync(watchHtmlPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Page Watch Party non trouvée');
          return;
        }

        const html = fs.readFileSync(watchHtmlPath, 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(html);
      }
      else {
        // Route par défaut
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Rackoon Streaming Server - HTTP OK');
      }
    });

    // Démarrer le serveur sur le port 3001
    const PORT = 3001;
    httpServer.listen(PORT, '0.0.0.0', (err) => {
      if (err) {
        console.error('❌ Erreur démarrage serveur HTTP:', err.message);
        httpServer = null;
        reject(err);
        return;
      }

      console.log('✅ Serveur HTTP démarré (port 3001)');
      resolve(true);
    });
  });
}

// Fonction pour démarrer Watch Party (Socket.io) - le serveur HTTP doit déjà être actif
function startWatchPartyServer() {
  return new Promise((resolve, reject) => {
    // Si Watch Party est déjà actif
    if (watchPartyManager) {
      resolve(true);
      return;
    }

    // Vérifier que le serveur HTTP est actif
    if (!httpServer) {
      console.error('❌ Le serveur HTTP doit être démarré avant Watch Party');
      reject(new Error('Serveur HTTP non disponible'));
      return;
    }

    // Initialiser Socket.io sur le serveur HTTP existant
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Créer le gestionnaire de sessions
    watchPartyManager = new WatchPartyManager(io, db);
    watchPartyManager.initialize();

    console.log('✅ Watch Party initialisé');
    resolve(true);
  });
}

// Variable pour stocker le listener ngrok
let ngrokListener = null;

// Fonction pour démarrer ngrok et créer un tunnel public
async function startNgrokTunnel() {
  try {
    // Arrêter un tunnel existant
    if (ngrokListener) {
      try {
        await ngrokListener.close();
      } catch (e) {
        // Ignorer les erreurs de fermeture
      }
      ngrokListener = null;
      ngrokUrl = null;
    }

    console.log('🌐 Démarrage du tunnel ngrok sur le port 3001...');

    // Démarrer le tunnel ngrok avec le nouveau package @ngrok/ngrok
    ngrokListener = await ngrok.forward({
      addr: 3001,
      authtoken_from_env: false,
      authtoken: '34W5DZF9aEoPLb1T43dJkLEF0dK_3Ut4CCBA81YCc8dbnenDe'
    });

    ngrokUrl = ngrokListener.url();
    console.log('✅ Tunnel ngrok actif:', ngrokUrl);
    return { success: true, url: ngrokUrl };
  } catch (error) {
    console.error('❌ Erreur ngrok:', error.message);

    // Message d'erreur plus explicite
    let errorMessage = error.message;
    if (error.message.includes('authtoken')) {
      errorMessage = 'Ngrok nécessite une authentification. Veuillez configurer votre authtoken ngrok.';
    } else if (error.message.includes('connect')) {
      errorMessage = 'Impossible de se connecter à ngrok. Vérifiez votre connexion internet.';
    }

    return { success: false, error: errorMessage };
  }
}

// Fonction pour arrêter ngrok
async function stopNgrokTunnel() {
  try {
    if (ngrokListener) {
      await ngrokListener.close();
      ngrokListener = null;
      ngrokUrl = null;
      console.log('🔌 Tunnel ngrok fermé');
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur arrêt ngrok:', error.message);
    return { success: false, error: error.message };
  }
}

// Configuration des gestionnaires de messages IPC avec stockage JSON
function setupIPCHandlers() {

  // Scan léger : juste trouver les fichiers sans les traiter
  ipcMain.handle('medias:scan-light', async (event, folderPath) => {
    try {
      let videoFiles = [];
      let folderToScan;

      // Si pas de dossier fourni, demander à l'utilisateur
      if (!folderPath) {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
          title: 'Sélectionnez un dossier à scanner'
        });

        if (result.canceled || result.filePaths.length === 0) {
          console.log('Sélection de dossier annulée');
          return { success: false, message: 'Aucun dossier sélectionné' };
        }

        folderToScan = result.filePaths[0];
      } else {
        folderToScan = folderPath;
      }

      console.log(`🔍 Scan léger dans: ${folderToScan}`);

      // Rechercher tous les fichiers vidéo (scan rapide uniquement)
      for (const ext of SUPPORTED_FORMATS) {
        try {
          const pattern = `${folderToScan}/**/*${ext}`;
          const files = await glob(pattern, { nocase: true });
          videoFiles = [...videoFiles, ...files];
        } catch (error) {
          console.error(`Erreur avec l'extension ${ext}: ${error.message}`);
        }
      }

      console.log(`📊 Scan léger terminé: ${videoFiles.length} fichiers trouvés`);

      // Créer des objets de base pour l'affichage
      const lightMedias = videoFiles.map(filePath => {
        const stats = fs.statSync(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, fileExtension);

        return {
          id: null, // Sera généré lors du traitement complet
          title: fileName,
          path: filePath,
          format: fileExtension.substring(1),
          size_bytes: stats.size,
          // Pas de métadonnées/miniatures pour le scan léger
          duration: 0,
          width: 0,
          height: 0,
          thumbnail: null
        };
      });

      return {
        success: true,
        medias: lightMedias,
        folderPath: folderToScan
      };

    } catch (error) {
      console.error('Erreur lors du scan léger:', error);
      return { success: false, message: error.message };
    }
  });

  // Recherche et ajout de médias dans la base JSON (fonction complète existante)
  ipcMain.handle('medias:scan', async (event, options) => {
    try {
      let videoFiles = [];
      
      // Sélection de dossier
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Sélectionnez un dossier à scanner'
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        console.log('Sélection de dossier annulée');
        return { success: false, message: 'Aucun dossier sélectionné' };
      }
      
      const folderToScan = result.filePaths[0];
      console.log(`🔍 Début du scan dans: ${folderToScan}`);
      
      mainWindow.webContents.send('scan:status', {
        message: `Recherche des vidéos dans ${path.basename(folderToScan)}...`,
        progress: 0
      });
      
      // Rechercher tous les fichiers vidéo
      for (const ext of SUPPORTED_FORMATS) {
        try {
          const pattern = `${folderToScan}/**/*${ext}`;
          const files = await glob(pattern, { nocase: true });
          videoFiles = [...videoFiles, ...files];
        } catch (error) {
          console.error(`Erreur avec l'extension ${ext}: ${error.message}`);
        }
      }
      
      console.log(`📊 Total: ${videoFiles.length} fichiers vidéo trouvés`);
      
      mainWindow.webContents.send('scan:status', {
        message: `${videoFiles.length} fichiers trouvés. Ajout à la bibliothèque...`,
        progress: 20
      });
      
      let addedCount = 0;
      let skippedCount = 0;
      const ffmpegInstalled = checkFfmpegInstalled();
      
      // Traiter chaque fichier trouvé
      for (let i = 0; i < videoFiles.length; i++) {
        const filePath = videoFiles[i];
        
        try {
          const stats = fs.statSync(filePath);
          const fileExtension = path.extname(filePath).toLowerCase();
          const fileName = path.basename(filePath, fileExtension);
          
          // Vérifier si le film existe déjà
          const existingMedias = await db.getAllMedias();
          const exists = existingMedias.find(m => m.path === filePath);
          if (exists) {
            skippedCount++;
            continue;
          }
          
          // Extraire les métadonnées si FFprobe disponible
          let duration = 0;
          let width = 0;
          let height = 0;
          
          if (ffmpegInstalled) {
            try {
              const metadata = await getVideoMetadata(filePath);
              duration = metadata.duration || 0;
              width = metadata.width || 0;
              height = metadata.height || 0;
              console.log(`📊 Métadonnées extraites: ${Math.floor(duration/60)}min ${Math.floor(duration%60)}s - ${width}x${height}`);
            } catch (error) {
              console.log(`⚠️ Pas de métadonnées pour: ${fileName}`);
            }
          }
          
          // Générer miniature si FFmpeg disponible
          let thumbnailName = null;
          if (ffmpegInstalled) {
            try {
              const thumbnailPath = path.join(DATA_DIR, 'thumbnails', `thumb_${Date.now()}_${i}.jpg`);
              await extractThumbnail(filePath, thumbnailPath);
              thumbnailName = path.basename(thumbnailPath);
              console.log(`🖼️ Miniature créée: ${thumbnailName}`);
            } catch (error) {
              console.log(`⚠️ Pas de miniature pour: ${fileName}`);
            }
          }
          
          // Créer l'objet film
          const mediaData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1),
            duration: Math.round(duration), // Stocker en secondes, arrondi
            size_bytes: stats.size,
            thumbnail: thumbnailName,
            category: null, // Ne pas pré-définir la catégorie - sera définie lors du tri
            description: '',
            dateAdded: new Date().toISOString(),
            width: width,
            height: height
          };
          
          // Ajouter à la base JSON
          const result = await db.addMedia(mediaData);
          if (result.success) {
            addedCount++;
            console.log(`✅ Ajouté: ${fileName}`);

            // Pré-transcoder si c'est un MKV
            if (fileExtension === '.mkv') {
              queueForTranscode(filePath);
            }
          }
          
          // Mettre à jour le statut
          const progress = Math.round(((i + 1) / videoFiles.length) * 70) + 20;
          mainWindow.webContents.send('scan:status', {
            message: `Traitement: ${i + 1}/${videoFiles.length} (${addedCount} nouveaux)`,
            progress
          });
          
        } catch (error) {
          console.error(`❌ Erreur pour ${filePath}:`, error.message);
        }
      }
      
      const finalMessage = `Scan terminé: ${addedCount} nouveaux films, ${skippedCount} ignorés`;
      console.log(`🎉 ${finalMessage}`);
      
      mainWindow.webContents.send('scan:status', {
        message: finalMessage,
        progress: 100
      });
      
      // Retourner tous les films de la base
      const allMedias = await db.getAllMedias();
      return {
        success: true,
        message: finalMessage,
        medias: allMedias,
        stats: { added: addedCount, skipped: skippedCount, total: videoFiles.length }
      };
      
    } catch (error) {
      console.error('❌ Erreur lors du scan:', error);
      return { success: false, message: 'Erreur lors du scan: ' + error.message };
    }
  });
  
  // Obtenir tous les films depuis la base JSON
  ipcMain.handle('medias:getAll', async () => {
    try {
      const medias = await db.getAllMedias();
      return {
        success: true,
        count: medias.length,
        medias: medias
      };
    } catch (error) {
      console.error('❌ Erreur récupération films:', error);
      return { success: false, message: error.message };
    }
  });

  // Obtenir les détails d'un film spécifique
  ipcMain.handle('medias:getDetails', async (event, mediaId) => {
    try {
      const medias = await db.getAllMedias();
      const media = medias.find(m => m.id === mediaId);
      
      if (!media) {
        return { success: false, message: 'Film introuvable' };
      }

      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(media.path)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }

      return {
        success: true,
        media: {
          ...media,
          description: media.description || '',
          genres: media.genres || [],
          releaseDate: media.releaseDate || '',
          year: media.year || (new Date()).getFullYear()
        }
      };
    } catch (error) {
      console.error('❌ Erreur récupération détails film:', error);
      return { success: false, message: error.message };
    }
  });

  // Mettre à jour un film par ID
  ipcMain.handle('medias:update', async (event, mediaId, updates) => {
    try {
      const result = await db.updateMediaById(mediaId, updates);
      if (result.success) {
        console.log(`✅ Film mis à jour: ${result.media.title}`);
        return result;
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour film:', error);
      return { success: false, message: error.message };
    }
  });

  // Handler pour supprimer un film
  ipcMain.handle('medias:delete', async (event, mediaId) => {
    try {
      const result = await db.deleteMedia(mediaId);
      if (result.success) {
        console.log(`🗑️ Film supprimé de la base de données: ID ${mediaId}`);
        return result;
      }
      
      return result;
    } catch (error) {
      console.error('Erreur lors de la suppression du film:', error);
      return { success: false, message: error.message };
    }
  });

  // Handler pour supprimer tous les médias
  ipcMain.handle('medias:clearAll', async (event) => {
    try {
      const result = await db.clearAllMedias();
      if (result.success) {
        console.log('🗑️ Tous les médias supprimés de la base de données');
        return result;
      }

      return result;
    } catch (error) {
      console.error('Erreur lors de la suppression de tous les médias:', error);
      return { success: false, message: error.message };
    }
  });

  // ============================================
  // HANDLERS POUR LES PRÉFÉRENCES UTILISATEUR
  // ============================================

  // Récupérer les préférences utilisateur
  ipcMain.handle('userPrefs:get', async () => {
    try {
      const prefs = await db.getUserPrefs();
      return { success: true, prefs };
    } catch (error) {
      console.error('Erreur lors de la récupération des préférences:', error);
      return { success: false, message: error.message };
    }
  });

  // Mettre à jour une note
  ipcMain.handle('userPrefs:updateRating', async (event, mediaId, rating) => {
    try {
      const result = await db.updateRating(mediaId, rating);
      console.log(`⭐ Note mise à jour pour ${mediaId}: ${rating}/5`);
      return result;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la note:', error);
      return { success: false, message: error.message };
    }
  });

  // Mettre à jour le statut vu/à voir
  ipcMain.handle('userPrefs:updateWatchStatus', async (event, mediaId, isWatched) => {
    try {
      const result = await db.updateWatchStatus(mediaId, isWatched);
      console.log(`👁️ Statut mis à jour pour ${mediaId}: ${isWatched ? 'vu' : 'à voir'}`);
      return result;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      return { success: false, message: error.message };
    }
  });

  // Sauvegarder toutes les préférences (pour synchronisation localStorage)
  ipcMain.handle('userPrefs:save', async (event, prefs) => {
    try {
      db.data.userPrefs = prefs;
      await db.saveUserPrefsImmediate();
      console.log('💾 Préférences utilisateur sauvegardées');
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences:', error);
      return { success: false, message: error.message };
    }
  });

  // Handler pour générer un thumbnail à la demande
  ipcMain.handle('medias:generateThumbnail', async (event, mediaId) => {
    try {
      // Récupérer le média depuis la DB
      const medias = await db.getAllMedias();
      const media = medias.find(m => m.id === mediaId);

      if (!media) {
        throw new Error(`Média non trouvé: ${mediaId}`);
      }

      // Vérifier si le fichier vidéo existe
      if (!fs.existsSync(media.path)) {
        throw new Error(`Fichier vidéo non trouvé: ${media.path}`);
      }

      // Vérifier si le thumbnail existe déjà
      if (media.thumbnail) {
        const thumbnailPath = path.join(DATA_DIR, 'thumbnails', media.thumbnail);
        if (fs.existsSync(thumbnailPath)) {
          return { success: true, thumbnail: media.thumbnail };
        }
      }

      // Générer un nouveau thumbnail
      if (!ffmpegInstalled) {
        throw new Error('FFmpeg n\'est pas installé');
      }

      const thumbnailName = media.thumbnail || `thumb_${Date.now()}.jpg`;
      const thumbnailPath = path.join(DATA_DIR, 'thumbnails', thumbnailName);

      await extractThumbnail(media.path, thumbnailPath);

      // Vérifier que le fichier a vraiment été créé
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error(`Thumbnail non créé malgré succès de la commande: ${thumbnailPath}`);
      }

      console.log(`✅ Thumbnail: ${thumbnailName}`);

      // Mettre à jour la DB avec le thumbnail
      await db.updateMedia(mediaId, { thumbnail: thumbnailName });

      return { success: true, thumbnail: thumbnailName };
    } catch (error) {
      console.error(`❌ Erreur thumbnail:`, error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler pour lire un film
  ipcMain.handle('medias:play', async (event, mediaId) => {
    try {
      const medias = await db.getAllMedias();
      const media = medias.find(m => m.id === mediaId);
      
      if (!media) {
        return { success: false, message: 'Film introuvable dans la base de données' };
      }

      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(media.path)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }

      // Ouvrir le fichier avec l'application par défaut
      await shell.openPath(media.path);
      
      return { 
        success: true, 
        message: 'Film ouvert avec l\'application par défaut',
        path: media.path 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du film:', error);
      return { success: false, message: error.message };
    }
  });

  // Handler pour obtenir les statistiques
  ipcMain.handle('medias:getStats', async (event) => {
    try {
      const medias = await db.getAllMedias();
      
      // Calculer les statistiques
      let totalSize = 0;
      let totalDuration = 0;
      let filesWithThumbnails = 0;
      const formats = new Map();

      medias.forEach(media => {
        // Taille totale
        if (media.size_bytes) {
          totalSize += media.size_bytes;
        }

        // Durée totale
        if (media.duration) {
          totalDuration += media.duration;
        }

        // Fichiers avec miniatures
        if (media.thumbnail) {
          filesWithThumbnails++;
        }

        // Comptage des formats
        const format = media.format || 'unknown';
        if (formats.has(format)) {
          formats.set(format, formats.get(format) + 1);
        } else {
          formats.set(format, 1);
        }
      });

      // Convertir les formats en array
      const formatsArray = Array.from(formats.entries()).map(([format, count]) => ({
        format,
        count
      }));

      const stats = {
        totalFiles: medias.length,
        totalSize,
        totalDuration,
        filesWithThumbnails,
        formats: formatsArray
      };

      return { success: true, stats };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return { success: false, message: error.message };
    }
  });

  // Handler pour sauvegarder un fichier classifié
  ipcMain.handle('medias:saveClassified', async (event, fileData) => {
    try {
      // D'abord, chercher le média existant par son chemin pour récupérer ses métadonnées
      const allMedias = await db.getAllMedias();
      let existingMedia = null;

      console.log('🔍 Recherche du média avec le chemin:', fileData.filePath);

      if (allMedias && Array.isArray(allMedias)) {
        console.log('🗂️ Médias disponibles:', allMedias.map(m => m.path).slice(0, 3));
        existingMedia = allMedias.find(m => m.path === fileData.filePath);
      }

      if (!existingMedia) {
        console.log('⚠️ Média non trouvé dans la base, création d\'un nouveau média');

        // Créer un nouveau média au lieu de retourner une erreur
        const stats = fs.statSync(fileData.filePath);

        const mediaData = {
          id: crypto.randomUUID(),
          path: fileData.filePath,
          title: fileData.title,
          category: fileData.category || 'unsorted',
          mediaType: fileData.mediaType || (fileData.category === 'series' ? 'series' : 'unique'),

          // Champs enrichis
          description: fileData.description || '',
          year: fileData.year || null,
          genres: fileData.genres || [],
          director: fileData.director || '',
          actors: fileData.actors || [],
          franchise: fileData.franchise || '',
          posterUrl: fileData.posterUrl || '',

          // Champs pour séries
          releaseDate: fileData.releaseDate || null,
          seriesId: fileData.seriesId || null,
          seriesName: fileData.seriesName || null,
          season_number: fileData.season_number || null,
          episode_number: fileData.episode_number || null,

          // Métadonnées de base
          name: path.basename(fileData.filePath),
          size_bytes: stats.size,
          formattedSize: formatFileSize(stats.size),
          format: path.extname(fileData.filePath).toLowerCase().replace('.', ''),
          dateAdded: new Date().toISOString()
        };

        const result = await db.addMedia(mediaData);

        if (result.success) {
          console.log(`💾 Nouveau média créé: ${mediaData.title} (catégorie: ${mediaData.category})`);

          // Pré-transcoder si c'est un MKV avec audio non compatible
          if (path.extname(fileData.filePath).toLowerCase() === '.mkv') {
            queueForTranscode(fileData.filePath);
          }

          return { ...result, movieId: mediaData.id };
        }

        return result;
      }

      console.log('✅ Média trouvé:', existingMedia.title);

      // Créer l'objet complet en combinant les nouvelles données avec les métadonnées existantes
      const mediaData = {
        ...existingMedia, // Reprendre toutes les métadonnées existantes
        title: fileData.title,
        category: fileData.category || 'unsorted',
        mediaType: fileData.mediaType || (fileData.category === 'series' ? 'series' : 'unique'),

        // Champs enrichis
        description: fileData.description || '',
        year: fileData.year || null,
        genres: fileData.genres || [],
        director: fileData.director || '',
        actors: fileData.actors || [],
        franchise: fileData.franchise || '',
        posterUrl: fileData.posterUrl || '',

        // Champs pour les séries
        releaseDate: fileData.releaseDate || null,
        seriesId: fileData.seriesId || null,
        seriesName: fileData.seriesName || null,
        season_number: fileData.season_number || null,
        episode_number: fileData.episode_number || null
      };

      // Toujours utiliser updateMedia - ne plus supprimer puis ajouter à une série
      const result = await db.updateMedia(mediaData);

      if (result.success) {
        console.log(`💾 Fichier classifié mis à jour: ${mediaData.title} (catégorie: ${mediaData.category})`);
        return { ...result, movieId: existingMedia.id };
      }

      return result;

    } catch (error) {
      console.error('Erreur lors de la sauvegarde du fichier classifié:', error);
      return { success: false, message: error.message };
    }
  });
  
  // Récupérer le chemin d'un film pour la lecture
  ipcMain.handle('medias:getPath', async (event, mediaPath) => {
    try {
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(mediaPath)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      console.log(`Lecture de la vidéo: ${mediaPath}`);
      
      // Retourner le chemin pour le lecteur intégré
      return {
        success: true,
        path: mediaPath,
        message: "Vidéo prête à être lue"
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du chemin:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });
  
  // Ouvrir le dossier contenant le film
  ipcMain.handle('medias:openFolder', async (event, mediaPath) => {
    try {
      // Vérifier si le fichier existe
      if (!fs.existsSync(mediaPath)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      // Ouvrir le dossier contenant le fichier
      shell.showItemInFolder(mediaPath);
      
      console.log(`Dossier ouvert pour la vidéo: ${mediaPath}`);
      
      return {
        success: true,
        message: 'Dossier ouvert'
      };
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du dossier:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Vérifier l'existence d'un fichier
  ipcMain.handle('files:exists', async (event, filePath) => {
    try {
      const exists = fs.existsSync(filePath);
      return { success: true, exists: exists };
    } catch (error) {
      console.error('Erreur lors de la vérification du fichier:', error);
      return { success: false, exists: false };
    }
  });

  // Ajouter un seul fichier vidéo
  ipcMain.handle('medias:scanSingle', async (event) => {
    try {
      // Sélection de fichier unique
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Sélectionnez un fichier vidéo',
        filters: [
          {
            name: 'Fichiers vidéo',
            extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts']
          }
        ]
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        console.log('Sélection de fichier annulée');
        return { success: false, message: 'Aucun fichier sélectionné' };
      }
      
      const filePath = result.filePaths[0];
      const fileExtension = path.extname(filePath).toLowerCase();
      
      // Vérifier si c'est un format supporté
      if (!SUPPORTED_FORMATS.includes(fileExtension)) {
        return { success: false, message: 'Format de fichier non supporté' };
      }
      
      console.log(`🎬 Ajout du fichier: ${filePath}`);
      
      // Vérifier si le film existe déjà
      const existingMedias = await db.getAllMedias();
      const exists = existingMedias.find(m => m.path === filePath);
      if (exists) {
        return { success: false, message: 'Ce fichier est déjà dans la bibliothèque' };
      }
      
      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath, fileExtension);
      const ffmpegInstalled = checkFfmpegInstalled();
      
      // Extraire les métadonnées si FFprobe disponible
      let duration = 0;
      let width = 0;
      let height = 0;
      
      if (ffmpegInstalled) {
        try {
          const metadata = await getVideoMetadata(filePath);
          duration = metadata.duration || 0;
          width = metadata.width || 0;
          height = metadata.height || 0;
          console.log(`📊 Métadonnées extraites: ${Math.floor(duration/60)}min ${Math.floor(duration%60)}s - ${width}x${height}`);
        } catch (error) {
          console.log(`⚠️ Pas de métadonnées pour: ${fileName}`);
        }
      }
      
      // Générer miniature si FFmpeg disponible
      let thumbnailName = null;
      if (ffmpegInstalled) {
        try {
          const thumbnailPath = path.join(DATA_DIR, 'thumbnails', `thumb_${Date.now()}.jpg`);
          await extractThumbnail(filePath, thumbnailPath);
          thumbnailName = path.basename(thumbnailPath);
          console.log(`🖼️ Miniature créée: ${thumbnailName}`);
        } catch (error) {
          console.log(`⚠️ Pas de miniature pour: ${fileName}`);
        }
      }
      
      // Créer l'objet film
      const mediaData = {
        title: fileName,
        path: filePath,
        format: fileExtension.substring(1),
        duration: Math.round(duration), // Stocker en secondes, arrondi
        size_bytes: stats.size,
        thumbnail: thumbnailName,
        category: null, // Ne pas pré-définir la catégorie - sera définie lors du tri
        description: '',
        dateAdded: new Date().toISOString(),
        width: width,
        height: height
      };
      
      // Ajouter à la base JSON
      const addResult = await db.addMedia(mediaData);
      if (addResult.success) {
        console.log(`✅ Fichier ajouté: ${fileName}`);
        return {
          success: true,
          message: `Fichier "${fileName}" ajouté avec succès`,
          media: addResult.media
        };
      } else {
        return { success: false, message: 'Erreur lors de l\'ajout du fichier' };
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du fichier:', error);
      return { success: false, message: 'Erreur lors de l\'ajout: ' + error.message };
    }
  });

  // Télécharger une image TMDB et la stocker localement
  ipcMain.handle('medias:downloadTMDBImage', async (event, imageUrl, mediaTitle) => {
    try {
      if (!imageUrl) {
        return { success: false, message: 'URL d\'image manquante' };
      }

      // Créer le dossier d'images TMDB s'il n'existe pas
      const imagesDir = path.join(DATA_DIR, 'tmdb-images');
      fs.ensureDirSync(imagesDir);

      // Générer un nom de fichier unique
      const filename = generateTMDBImageName(mediaTitle, imageUrl);
      const outputPath = path.join(imagesDir, filename);

      // Télécharger l'image
      await downloadTMDBImage(imageUrl, outputPath);

      // Retourner le chemin relatif depuis le dossier data
      const relativePath = path.relative(DATA_DIR, outputPath);
      
      return {
        success: true,
        localPath: outputPath,
        relativePath: relativePath,
        filename: filename
      };

    } catch (error) {
      console.error('❌ Erreur lors du téléchargement de l\'image TMDB:', error);
      return { success: false, message: 'Erreur lors du téléchargement: ' + error.message };
    }
  });

  // Mettre à jour les métadonnées de tous les films existants
  ipcMain.handle('medias:updateMetadata', async (event) => {
    try {
      const ffmpegInstalled = checkFfmpegInstalled();
      if (!ffmpegInstalled) {
        return { success: false, message: 'FFmpeg/FFprobe non disponible' };
      }

      const allMedias = await db.getAllMedias();
      let updatedCount = 0;
      let errorCount = 0;

      console.log(`🔄 Mise à jour des métadonnées pour ${allMedias.length} films...`);

      for (const media of allMedias) {
        try {
          // Vérifier si le fichier existe toujours
          if (!fs.existsSync(media.path)) {
            console.log(`⚠️ Fichier non trouvé, ignoré: ${media.title}`);
            continue;
          }

          // Extraire les nouvelles métadonnées
          const metadata = await getVideoMetadata(media.path);
          
          if (metadata.duration > 0) {
            // Mettre à jour uniquement si on a une durée valide
            const updates = {
              duration: Math.round(metadata.duration),
              width: metadata.width || media.width || 0,
              height: metadata.height || media.height || 0
            };

            const updateResult = await db.updateMedia(media.id, updates);
            if (updateResult.success) {
              updatedCount++;
              console.log(`✅ Métadonnées mises à jour: ${media.title} - ${Math.floor(metadata.duration/60)}min ${Math.floor(metadata.duration%60)}s`);
            }
          } else {
            console.log(`⚠️ Pas de métadonnées extraites pour: ${media.title}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Erreur pour ${media.title}:`, error.message);
        }
      }

      return {
        success: true,
        message: `Métadonnées mises à jour: ${updatedCount} films, ${errorCount} erreurs`,
        updated: updatedCount,
        errors: errorCount
      };

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour des métadonnées:', error);
      return { success: false, message: 'Erreur lors de la mise à jour: ' + error.message };
    }
  });

  // Obtenir les informations détaillées d'un fichier vidéo (pistes audio/sous-titres)
  ipcMain.handle('video:getInfo', async (event, filePath) => {
    try {
      if (!checkFfmpegInstalled()) {
        return { success: false, message: 'FFmpeg/FFprobe non disponible' };
      }

      if (!fs.existsSync(filePath)) {
        return { success: false, message: 'Fichier introuvable' };
      }

      console.log('🔍 Analyse détaillée du fichier:', filePath);

      // Utiliser FFprobe pour obtenir toutes les informations de pistes
      const command = `"${FFPROBE_PATH}" -v quiet -print_format json -show_streams -show_format "${filePath}"`;
      
      return new Promise((resolve) => {
        exec(command, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Erreur FFprobe:', error.message);
            resolve({ success: false, message: 'Erreur d\'analyse: ' + error.message });
            return;
          }

          try {
            const data = JSON.parse(stdout);
            const streams = data.streams || [];

            // Séparer les différents types de pistes
            const videoTracks = streams.filter(s => s.codec_type === 'video');
            const audioTracks = streams.filter(s => s.codec_type === 'audio');
            const subtitleTracks = streams.filter(s => s.codec_type === 'subtitle');

            console.log('📊 Pistes détectées:', {
              video: videoTracks.length,
              audio: audioTracks.length,
              subtitles: subtitleTracks.length
            });

            // Formatter les informations des pistes audio
            const formattedAudioTracks = audioTracks.map((track, index) => ({
              index: track.index,
              codec_name: track.codec_name,
              codec_long_name: track.codec_long_name,
              language: track.tags?.language || 'und',
              title: track.tags?.title || track.tags?.handler_name || null,
              channels: track.channels,
              channel_layout: track.channel_layout,
              sample_rate: track.sample_rate
            }));

            // Formatter les informations des pistes de sous-titres
            const formattedSubtitleTracks = subtitleTracks.map((track, index) => ({
              index: track.index,
              codec_name: track.codec_name,
              codec_long_name: track.codec_long_name,
              language: track.tags?.language || 'und',
              title: track.tags?.title || track.tags?.handler_name || null
            }));

            resolve({
              success: true,
              duration: parseFloat(data.format?.duration || 0),
              audioTracks: formattedAudioTracks,
              subtitleTracks: formattedSubtitleTracks,
              videoTracks: videoTracks.map(v => {
                let fps = 0;
                if (v.r_frame_rate) {
                  const parts = v.r_frame_rate.split('/');
                  if (parts.length === 2) {
                    fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                  }
                }
                return {
                  index: v.index,
                  codec_name: v.codec_name,
                  width: v.width,
                  height: v.height,
                  fps: fps
                };
              })
            });

          } catch (parseError) {
            console.error('❌ Erreur parsing JSON FFprobe:', parseError.message);
            resolve({ success: false, message: 'Erreur d\'analyse des données' });
          }
        });
      });

    } catch (error) {
      console.error('❌ Erreur getVideoInfo:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Extraire une piste de sous-titres
  ipcMain.handle('video:extractSubtitle', async (event, videoPath, trackIndex) => {
    try {
      if (!checkFfmpegInstalled()) {
        return { success: false, message: 'FFmpeg non disponible' };
      }

      if (!fs.existsSync(videoPath)) {
        return { success: false, message: 'Fichier vidéo introuvable' };
      }

      // D'abord, obtenir les informations de la piste de sous-titres
      const videoInfoCommand = `"${FFPROBE_PATH}" -v quiet -print_format json -show_streams -select_streams s:${trackIndex} "${videoPath}"`;
      
      return new Promise((resolve) => {
        exec(videoInfoCommand, { encoding: 'utf8' }, async (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Erreur info sous-titres:', error.message);
            resolve({ success: false, message: 'Erreur d\'analyse: ' + error.message });
            return;
          }

          try {
            const data = JSON.parse(stdout);
            const stream = data.streams?.[0];
            
            if (!stream) {
              resolve({ success: false, message: 'Piste de sous-titres non trouvée' });
              return;
            }

            const codecName = stream.codec_name;
            console.log('📝 Type de sous-titre détecté:', codecName);

            // Créer un dossier temporaire pour les sous-titres (utiliser le dossier temp système)
            const tempDir = path.join(app.getPath('temp'), 'rackoon-subtitles');
            await fs.ensureDir(tempDir);

            // Nom du fichier de sous-titres
            const videoName = path.basename(videoPath, path.extname(videoPath));
            let subtitlePath;
            let command;

            // Adapter la stratégie d'extraction selon le type de sous-titres
            switch (codecName) {
              case 'subrip':
              case 'srt':
                // Sous-titres SRT - extraction directe
                subtitlePath = path.join(tempDir, `${videoName}_track_${trackIndex}.srt`);
                command = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s srt "${subtitlePath}"`;
                break;

              case 'ass':
              case 'ssa':
                // Sous-titres ASS/SSA - extraction directe
                subtitlePath = path.join(tempDir, `${videoName}_track_${trackIndex}.ass`);
                command = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s ass "${subtitlePath}"`;
                break;

              case 'webvtt':
                // Sous-titres WebVTT - extraction directe
                subtitlePath = path.join(tempDir, `${videoName}_track_${trackIndex}.vtt`);
                command = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s webvtt "${subtitlePath}"`;
                break;

              case 'hdmv_pgs_subtitle':
              case 'pgssub':
                // Sous-titres PGS (bitmap) - tentative de conversion en SRT via OCR
                subtitlePath = path.join(tempDir, `${videoName}_track_${trackIndex}.srt`);
                // Essayer la conversion OCR avec Tesseract si disponible
                command = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s srt "${subtitlePath}"`;
                console.log('🔄 Tentative de conversion PGS vers SRT via OCR...');
                break;

              case 'dvd_subtitle':
              case 'dvdsub':
                // Sous-titres DVD (bitmap) - extraction en SUB/IDX
                subtitlePath = path.join(tempDir, `${videoName}_track_${trackIndex}.sub`);
                command = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s copy "${subtitlePath}"`;
                console.log('⚠️ Sous-titres DVD détectés - extraction en format SUB (image)');
                break;

              default:
                // Tentative d'extraction générique vers SRT
                subtitlePath = path.join(tempDir, `${videoName}_track_${trackIndex}.srt`);
                command = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s srt "${subtitlePath}"`;
                console.log('🔄 Tentative de conversion vers SRT pour codec:', codecName);
                break;
            }

            console.log('📝 Extraction sous-titre piste', trackIndex, 'vers:', subtitlePath);
            console.log('🎬 Commande:', command);
            console.log('📊 Type codec:', codecName);

            exec(command, { timeout: 30000 }, (extractError, extractStdout, extractStderr) => {
              if (extractError) {
                console.error('❌ Erreur extraction sous-titres:', extractError.message);
                console.error('❌ Stderr:', extractStderr);
                
                // Si c'est un sous-titre PGS/bitmap et que la conversion OCR échoue, essayer l'extraction brute
                if (codecName === 'hdmv_pgs_subtitle' || codecName === 'pgssub') {
                  console.log('🔄 Échec OCR, tentative d\'extraction PGS brute...');
                  
                  // Changer le chemin et la commande pour extraction SUP
                  const supPath = path.join(tempDir, `${videoName}_track_${trackIndex}.sup`);
                  const supCommand = `"${FFMPEG_PATH}" -y -i "${videoPath}" -map 0:s:${trackIndex} -c:s copy "${supPath}"`;
                  
                  exec(supCommand, { timeout: 30000 }, (supError, supStdout, supStderr) => {
                    if (supError) {
                      resolve({ 
                        success: false, 
                        message: `Impossible d'extraire les sous-titres PGS: ${supError.message}`,
                        codecType: codecName
                      });
                      return;
                    }
                    
                    if (fs.existsSync(supPath)) {
                      // Essayer de convertir le SUP en SRT avec un outil externe si possible
                      tryConvertSupToSrt(supPath, subtitlePath).then((converted) => {
                        if (converted) {
                          console.log('✅ Sous-titre PGS converti en SRT:', subtitlePath);
                          resolve({ 
                            success: true, 
                            subtitlePath: subtitlePath,
                            codecType: codecName,
                            format: 'srt',
                            converted: true
                          });
                        } else {
                          console.log('⚠️ Sous-titre PGS extrait mais non converti:', supPath);
                          resolve({ 
                            success: false, 
                            message: 'Les sous-titres PGS ont été extraits mais ne peuvent pas être convertis automatiquement en texte.\nUtilisez un lecteur externe comme VLC pour les afficher.',
                            codecType: codecName,
                            extractedPath: supPath
                          });
                        }
                      });
                    } else {
                      resolve({ success: false, message: 'Échec de l\'extraction des sous-titres PGS' });
                    }
                  });
                  return;
                }
                
                // Pour les autres types de sous-titres
                if (codecName === 'dvd_subtitle') {
                  resolve({ 
                    success: false, 
                    message: `Les sous-titres DVD sont des images et ne peuvent pas être convertis automatiquement.\nUtilisez un lecteur externe comme VLC.`,
                    codecType: codecName
                  });
                } else {
                  resolve({ success: false, message: 'Erreur d\'extraction: ' + extractError.message });
                }
                return;
              }

              // Vérifier que le fichier a été créé
              if (fs.existsSync(subtitlePath)) {
                console.log('✅ Sous-titre extrait:', subtitlePath);
                resolve({ 
                  success: true, 
                  subtitlePath: subtitlePath,
                  codecType: codecName,
                  format: path.extname(subtitlePath).slice(1)
                });
              } else {
                resolve({ success: false, message: 'Le fichier de sous-titres n\'a pas été créé' });
              }
            });

          } catch (parseError) {
            console.error('❌ Erreur parsing info sous-titres:', parseError.message);
            resolve({ success: false, message: 'Erreur d\'analyse des sous-titres' });
          }
        });
      });

    } catch (error) {
      console.error('❌ Erreur extractSubtitle:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Lire un fichier de sous-titres
  ipcMain.handle('video:readSubtitleFile', async (event, subtitlePath) => {
    try {
      if (!fs.existsSync(subtitlePath)) {
        return { success: false, message: 'Fichier de sous-titres introuvable' };
      }

      console.log('📖 Lecture fichier sous-titres:', subtitlePath);
      
      // Lire le contenu du fichier
      const content = fs.readFileSync(subtitlePath, 'utf8');
      
      // Déterminer le type MIME selon l'extension
      const ext = path.extname(subtitlePath).toLowerCase();
      let mimeType = 'text/plain';
      
      switch (ext) {
        case '.srt':
          mimeType = 'text/srt';
          break;
        case '.vtt':
          mimeType = 'text/vtt';
          break;
        case '.ass':
        case '.ssa':
          mimeType = 'text/ass';
          break;
      }

      return {
        success: true,
        content: content,
        mimeType: mimeType,
        fileName: path.basename(subtitlePath)
      };
      
    } catch (error) {
      console.error('❌ Erreur lecture sous-titres:', error);
      return { success: false, message: 'Erreur de lecture: ' + error.message };
    }
  });

  // Fonction pour vérifier si un fichier MP4 est valide avec FFprobe
  // Retourne { valid: boolean, videoCodec: string, audioCodec: string }
  async function isValidMP4(filePath) {
    if (!FFPROBE_PATH || !fs.existsSync(filePath)) return { valid: false };

    return new Promise((resolve) => {
      const command = `"${FFPROBE_PATH}" -v quiet -print_format json -show_streams "${filePath}"`;
      exec(command, { timeout: 10000 }, (error, stdout) => {
        if (error) {
          console.log('⚠️ FFprobe erreur pour:', path.basename(filePath));
          resolve({ valid: false });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams && data.streams.find(s => s.codec_type === 'video');
          const audioStream = data.streams && data.streams.find(s => s.codec_type === 'audio');

          const videoCodec = videoStream ? videoStream.codec_name : null;
          const audioCodec = audioStream ? audioStream.codec_name : null;

          console.log(`📊 Fichier converti - Vidéo: ${videoCodec || 'non détecté'}, Audio: ${audioCodec || 'non détecté'}`);

          // Codecs vidéo compatibles avec les navigateurs (H.264/AVC)
          const validVideoCodecs = ['h264', 'avc1', 'avc', 'mpeg4'];
          // Codecs vidéo qui nécessitent absolument un transcodage
          const unsupportedVideoCodecs = ['hevc', 'h265', 'vp9', 'av1'];
          // Codecs audio compatibles avec les navigateurs
          const validAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];
          // Codecs audio qui nécessitent un transcodage
          const unsupportedAudioCodecs = ['ac3', 'eac3', 'dts', 'dca', 'truehd', 'mlp'];

          // Vérifier le codec vidéo
          let isVideoValid = true; // Par défaut, on accepte si pas de vidéo détectée
          let needsVideoTranscode = false;
          if (videoCodec) {
            const vcLower = videoCodec.toLowerCase();
            // Vérifier si le codec vidéo est dans la liste des non supportés
            needsVideoTranscode = unsupportedVideoCodecs.some(c => vcLower.includes(c));
            // Le codec est valide s'il est dans la liste des supportés ou s'il n'est pas dans les non supportés
            isVideoValid = validVideoCodecs.some(c => vcLower.includes(c)) || !needsVideoTranscode;

            if (needsVideoTranscode) {
              console.log(`⚠️ Codec vidéo non compatible: ${videoCodec} (nécessite transcodage vers H.264)`);
            } else {
              console.log(`✅ Codec vidéo compatible: ${videoCodec}`);
            }
          }

          // Vérifier le codec audio - être plus permissif
          let isAudioValid = true; // Par défaut, on accepte si pas d'audio détecté
          let needsAudioTranscode = false;
          if (audioCodec) {
            const acLower = audioCodec.toLowerCase();
            // Vérifier si le codec audio nécessite un transcodage
            needsAudioTranscode = unsupportedAudioCodecs.some(c => acLower.includes(c));
            // L'audio est valide si c'est un codec supporté ou si ce n'est pas un codec non supporté connu
            isAudioValid = validAudioCodecs.some(c => acLower.includes(c)) || !needsAudioTranscode;

            if (needsAudioTranscode) {
              console.log(`⚠️ Codec audio non compatible: ${audioCodec} (nécessite transcodage vers AAC)`);
            } else {
              console.log(`✅ Codec audio compatible: ${audioCodec}`);
            }
          }

          // Le fichier est valide si le vidéo et l'audio sont compatibles
          // On est permissif: si on ne détecte pas de problème connu, on considère comme valide
          const isValid = isVideoValid && isAudioValid;

          resolve({
            valid: isValid,
            videoCodec,
            audioCodec,
            needsVideoTranscode,
            needsAudioTranscode
          });
        } catch (e) {
          console.error('Erreur parsing FFprobe:', e);
          // En cas d'erreur de parsing, on essaie quand même de lire le fichier
          resolve({ valid: true, parseError: true });
        }
      });
    });
  }

  // Vérifier si une conversion audio (ou vidéo+audio) existe déjà
  ipcMain.handle('video:checkConvertedAudio', async (event, videoPath, transcodeVideo = false) => {
    try {
      const convertedDir = path.join(DATA_DIR, 'converted-audio');
      let basename = path.basename(videoPath, path.extname(videoPath));
      basename = basename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

      console.log('🔍 Recherche conversion pour:', basename);

      // Vérifier d'abord la version demandée
      const requestedSuffix = transcodeVideo ? '_h264_aac' : '_aac';
      const requestedPath = path.join(convertedDir, `${basename}${requestedSuffix}.mp4`);

      if (fs.existsSync(requestedPath)) {
        const stat = fs.statSync(requestedPath);
        // Vérifier que le fichier a une taille raisonnable (au moins 1MB)
        if (stat.size < 1024 * 1024) {
          console.log('⚠️ Fichier converti trop petit, probablement corrompu:', requestedPath, `(${stat.size} bytes)`);
          try { fs.unlinkSync(requestedPath); } catch (e) {}
          return { exists: false, wasCorrupted: true };
        }

        // Vérifier que le fichier est valide avec FFprobe
        const validation = await isValidMP4(requestedPath);
        if (!validation.valid) {
          console.log('⚠️ Fichier converti invalide (FFprobe):', requestedPath);
          // Si le codec vidéo nécessite un transcodage (HEVC, etc.)
          if (validation.needsVideoTranscode) {
            console.log(`🔄 Le fichier a un codec vidéo non compatible: ${validation.videoCodec}`);
            try { fs.unlinkSync(requestedPath); } catch (e) {}
            return { exists: false, wasCorrupted: true, needsVideoTranscode: true, videoCodec: validation.videoCodec };
          }
          // Si le codec audio nécessite un transcodage
          if (validation.needsAudioTranscode) {
            console.log(`🔄 Le fichier a un codec audio non compatible: ${validation.audioCodec}`);
            try { fs.unlinkSync(requestedPath); } catch (e) {}
            return { exists: false, wasCorrupted: true, needsAudioTranscode: true, audioCodec: validation.audioCodec };
          }
          // Autre erreur - supprimer et refaire la conversion
          try { fs.unlinkSync(requestedPath); } catch (e) {}
          return { exists: false, wasCorrupted: true };
        }

        console.log('✅ Conversion valide trouvée:', requestedPath, `(${Math.round(stat.size / 1024 / 1024)}MB)`);
        return {
          exists: true,
          path: requestedPath,
          size: stat.size,
          transcodeVideo: transcodeVideo
        };
      }

      // Si on demande audio seulement mais qu'une version vidéo+audio existe, l'utiliser
      if (!transcodeVideo) {
        const videoTranscodePath = path.join(convertedDir, `${basename}_h264_aac.mp4`);
        if (fs.existsSync(videoTranscodePath)) {
          const stat = fs.statSync(videoTranscodePath);
          console.log('✅ Version vidéo+audio trouvée:', videoTranscodePath);
          return {
            exists: true,
            path: videoTranscodePath,
            size: stat.size,
            transcodeVideo: true
          };
        }
      }

      console.log('❌ Aucune conversion trouvée pour:', basename);
      return { exists: false };
    } catch (error) {
      console.error('❌ Erreur vérification conversion:', error);
      return { exists: false, error: error.message };
    }
  });

  // Pré-convertir l'audio d'une vidéo (conversion complète avant lecture)
  // Supporte aussi le transcodage vidéo si transcodeVideo est true
  // audioTracks est un tableau d'indices des pistes audio à inclure (ex: [0, 2])
  ipcMain.handle('video:preConvertAudio', async (event, videoPath, transcodeVideo = false, audioTracks = [0]) => {
    try {
      console.log('🎬 Demande de pré-conversion pour:', videoPath);
      console.log('🎵 Pistes audio à convertir:', audioTracks);

      if (!FFMPEG_PATH) {
        console.error('❌ FFMPEG_PATH non défini');
        return { success: false, message: 'FFmpeg non configuré' };
      }

      if (!checkFfmpegInstalled()) {
        console.error('❌ FFmpeg non accessible:', FFMPEG_PATH);
        return { success: false, message: 'FFmpeg non disponible' };
      }

      if (!fs.existsSync(videoPath)) {
        console.error('❌ Fichier introuvable:', videoPath);
        return { success: false, message: 'Fichier vidéo introuvable' };
      }

      // Créer le dossier de conversions permanentes
      const convertedDir = path.join(DATA_DIR, 'converted-audio');
      console.log('📁 Dossier de conversion:', convertedDir);
      fs.ensureDirSync(convertedDir);

      // Nettoyer le basename pour éviter les caractères spéciaux
      let basename = path.basename(videoPath, path.extname(videoPath));
      // Remplacer les caractères problématiques
      basename = basename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
      // Suffixe différent si on transcode aussi la vidéo ou si plusieurs pistes audio
      const trackSuffix = audioTracks.length > 1 ? `_${audioTracks.length}audio` : '';
      const suffix = transcodeVideo ? `_h264_aac${trackSuffix}` : `_aac${trackSuffix}`;
      const convertedPath = path.join(convertedDir, `${basename}${suffix}.mp4`);
      console.log('📁 Fichier de sortie:', convertedPath);

      // Vérifier si déjà converti
      if (fs.existsSync(convertedPath)) {
        console.log(`✅ Conversion existante trouvée: ${convertedPath}`);
        return {
          success: true,
          path: convertedPath,
          cached: true
        };
      }

      console.log(`🎵 Démarrage pré-conversion: ${path.basename(videoPath)} (${audioTracks.length} piste(s) audio)`);

      // Obtenir la durée totale pour calculer la progression
      const durationCommand = `"${FFPROBE_PATH}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;

      let totalDuration = 0;
      try {
        const durationResult = await new Promise((resolve, reject) => {
          exec(durationCommand, (error, stdout) => {
            if (error) reject(error);
            else resolve(parseFloat(stdout.trim()) || 0);
          });
        });
        totalDuration = durationResult;
      } catch (e) {
        console.warn('Impossible de déterminer la durée:', e.message);
      }

      return new Promise((resolve) => {
        // Construire les arguments de mapping audio pour chaque piste sélectionnée
        const audioMappings = [];
        audioTracks.forEach(trackIndex => {
          audioMappings.push('-map', `0:a:${trackIndex}`);
        });

        // Arguments FFmpeg selon le type de conversion nécessaire
        let ffmpegArgs;

        if (transcodeVideo) {
          // Transcodage complet: HEVC → H.264 + audio → AAC
          console.log('🎬 Mode transcodage vidéo + audio (HEVC → H.264)');
          ffmpegArgs = [
            '-y',
            '-i', videoPath,
            '-map', '0:v:0',
            ...audioMappings,         // Mapper toutes les pistes audio sélectionnées
            '-c:v', 'libx264',        // Transcoder vidéo en H.264
            '-preset', 'fast',        // Preset rapide pour équilibre vitesse/qualité
            '-crf', '23',             // Qualité visuelle (18-28, plus bas = meilleur)
            '-c:a', 'aac',            // Convertir toutes les pistes audio en AAC
            '-b:a', '192k',
            '-movflags', '+faststart',
            convertedPath
          ];
        } else {
          // Transcodage audio seulement: copie vidéo + audio → AAC
          console.log('🎵 Mode transcodage audio seulement');
          ffmpegArgs = [
            '-y',
            '-i', videoPath,
            '-map', '0:v:0',
            ...audioMappings,         // Mapper toutes les pistes audio sélectionnées
            '-c:v', 'copy',           // Copier vidéo sans transcodage
            '-c:a', 'aac',            // Convertir toutes les pistes audio en AAC
            '-b:a', '192k',
            '-movflags', '+faststart',
            convertedPath
          ];
        }

        console.log(`🔧 FFmpeg commande: "${FFMPEG_PATH}" ${ffmpegArgs.map(a => `"${a}"`).join(' ')}`);

        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
        let lastProgress = 0;
        let ffmpegStderr = ''; // Capturer toutes les erreurs

        ffmpeg.stderr.on('data', (data) => {
          const line = data.toString();
          ffmpegStderr += line; // Accumuler stderr

          // Logger les erreurs importantes
          if (line.includes('Error') || line.includes('error') || line.includes('Invalid')) {
            console.error('FFmpeg stderr:', line.trim());
          }

          // Extraire le temps actuel pour calculer la progression
          const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
          if (timeMatch && totalDuration > 0) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(99, Math.round((currentTime / totalDuration) * 100));

            if (progress > lastProgress) {
              lastProgress = progress;
              // Envoyer la progression au renderer
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('video:conversionProgress', {
                  path: videoPath,
                  progress: progress,
                  currentTime: currentTime,
                  totalDuration: totalDuration
                });
              }
            }
          }
        });

        ffmpeg.on('close', (code) => {
          console.log(`FFmpeg terminé avec code: ${code}`);

          if (code === 0 && fs.existsSync(convertedPath)) {
            const stat = fs.statSync(convertedPath);
            console.log(`✅ Pré-conversion terminée: ${convertedPath} (${Math.round(stat.size / 1024 / 1024)}MB)`);

            // Envoyer 100% de progression
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('video:conversionProgress', {
                path: videoPath,
                progress: 100,
                completed: true
              });
            }

            // Ajouter au cache pour le serveur de streaming
            const cacheKey = `${videoPath}|transcode`;
            remuxCache.set(cacheKey, convertedPath);

            resolve({
              success: true,
              path: convertedPath,
              size: stat.size
            });
          } else {
            console.error(`❌ Erreur pré-conversion (code: ${code})`);
            console.error('FFmpeg stderr complet:', ffmpegStderr.slice(-1000));
            // Supprimer le fichier incomplet
            if (fs.existsSync(convertedPath)) {
              try { fs.unlinkSync(convertedPath); } catch (e) {}
            }

            // Extraire le message d'erreur
            const errorMatch = ffmpegStderr.match(/Error[^\n]*/i) || ffmpegStderr.match(/Invalid[^\n]*/i);
            const errorDetail = errorMatch ? errorMatch[0] : `Code de sortie: ${code}`;

            resolve({
              success: false,
              message: `Erreur FFmpeg: ${errorDetail}`
            });
          }
        });

        ffmpeg.on('error', (err) => {
          console.error('❌ Erreur spawn FFmpeg:', err);
          console.error('Chemin FFmpeg:', FFMPEG_PATH);
          resolve({
            success: false,
            message: `Impossible de lancer FFmpeg: ${err.message}`
          });
        });
      });

    } catch (error) {
      console.error('❌ Erreur pré-conversion:', error);
      return { success: false, message: error.message };
    }
  });

  // Handlers pour la gestion des séries

  // Créer une nouvelle série
  ipcMain.handle('series:create', async (event, seriesData) => {
    try {
      console.log('📺 Création d\'une nouvelle série:', seriesData.name);
      const result = await db.addSeries(seriesData);
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la création de la série:', error);
      return { success: false, message: error.message };
    }
  });

  // Récupérer toutes les séries
  ipcMain.handle('series:getAll', async () => {
    try {
      const result = await db.getAllSeries();
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des séries:', error);
      return { success: false, message: error.message };
    }
  });

  // Récupérer une série par ID
  ipcMain.handle('series:getById', async (event, seriesId) => {
    try {
      const result = await db.getSeriesById(seriesId);
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la série:', error);
      return { success: false, message: error.message };
    }
  });

  // Mettre à jour une série
  ipcMain.handle('series:update', async (event, seriesId, updates) => {
    try {
      const result = await db.updateSeries(seriesId, updates);
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la série:', error);
      return { success: false, message: error.message };
    }
  });

  // Supprimer une série
  ipcMain.handle('series:delete', async (event, seriesId) => {
    try {
      const result = await db.deleteSeries(seriesId);
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la série:', error);
      return { success: false, message: error.message };
    }
  });

  // Handler pour nettoyer les séries corrompues
  ipcMain.handle('series:cleanupCorrupted', async (event) => {
    try {
      const result = await db.cleanupCorruptedSeries();
      return result;
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des séries corrompues:', error);
      return { success: false, message: error.message };
    }
  });

  // ============================================
  // API GESTION DES SAISONS
  // ============================================

  // Récupérer les saisons d'une série
  ipcMain.handle('seasons:get', async (event, seriesId) => {
    try {
      const result = await db.getSeriesSeasons(seriesId);
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des saisons:', error);
      return { success: false, message: error.message };
    }
  });

  // Sauvegarder les saisons d'une série
  ipcMain.handle('seasons:save', async (event, seriesId, seasons) => {
    try {
      const result = await db.saveSeriesSeasons(seriesId, seasons);
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des saisons:', error);
      return { success: false, message: error.message };
    }
  });

  // ============================================
  // API SYSTÈME DE TAGS
  // ============================================

  // Migrer vers le système de tags
  ipcMain.handle('tags:migrate', async (event) => {
    try {
      const result = await db.migrateToTagSystem();
      return result;
    } catch (error) {
      console.error('Erreur lors de la migration des tags:', error);
      return { success: false, message: error.message };
    }
  });

  // Obtenir tous les tags disponibles
  ipcMain.handle('tags:getAll', async (event) => {
    try {
      const result = await db.getAllTags();
      return result;
    } catch (error) {
      console.error('Erreur lors de la récupération des tags:', error);
      return { success: false, message: error.message };
    }
  });

  // Ajouter un tag personnalisé
  ipcMain.handle('tags:addCustom', async (event, tagName) => {
    try {
      const result = await db.addCustomTag(tagName);
      return result;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du tag:', error);
      return { success: false, message: error.message };
    }
  });

  // Supprimer un tag personnalisé
  ipcMain.handle('tags:removeCustom', async (event, tagName) => {
    try {
      const result = await db.removeCustomTag(tagName);
      return result;
    } catch (error) {
      console.error('Erreur lors de la suppression du tag:', error);
      return { success: false, message: error.message };
    }
  });

  // Ajouter des tags à un média
  ipcMain.handle('tags:addToMedia', async (event, mediaId, tags, tagType = 'personalTags') => {
    try {
      const result = await db.addTagsToMedia(mediaId, tags, tagType);
      return result;
    } catch (error) {
      console.error('Erreur lors de l\'ajout de tags au média:', error);
      return { success: false, message: error.message };
    }
  });

  // Supprimer des tags d'un média
  ipcMain.handle('tags:removeFromMedia', async (event, mediaId, tags, tagType = 'personalTags') => {
    try {
      const result = await db.removeTagsFromMedia(mediaId, tags, tagType);
      return result;
    } catch (error) {
      console.error('Erreur lors de la suppression de tags du média:', error);
      return { success: false, message: error.message };
    }
  });

  // Rechercher des médias par tags
  ipcMain.handle('tags:searchMedias', async (event, searchTags, operator = 'AND') => {
    try {
      const result = await db.searchByTags(searchTags, operator);
      return { success: true, medias: result };
    } catch (error) {
      console.error('Erreur lors de la recherche par tags:', error);
      return { success: false, message: error.message };
    }
  });

  // Obtenir des suggestions de tags
  ipcMain.handle('tags:getSuggestions', async (event, query, limit = 10) => {
    try {
      const result = await db.getTagSuggestions(query, limit);
      return result;
    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions:', error);
      return { success: false, message: error.message };
    }
  });

  // ========================================
  // WATCH PARTY IPC HANDLERS
  // ========================================

  // Créer une session Watch Party
  ipcMain.handle('watchparty:create', async (event, videoInfo) => {
    try {
      console.log(`🔍 IPC watchparty:create appelé`);

      // Démarrer le serveur si ce n'est pas déjà fait
      await startWatchPartyServer();

      console.log(`✅ Serveur actif - création de session`);
      const result = watchPartyManager.createSession(videoInfo);

      // Ajouter les informations réseau
      if (result.success) {
        result.localIP = getLocalIPAddress();
        result.port = 3001;
        console.log(`   Session créée: ${result.code} - IP: ${result.localIP}`);
      }
      return result;
    } catch (error) {
      console.error('❌ Erreur création Watch Party:', error);
      return {
        success: false,
        message: `Impossible de démarrer le serveur: ${error.message}`
      };
    }
  });

  // Rejoindre une session Watch Party
  ipcMain.handle('watchparty:join', async (event, code) => {
    try {
      console.log(`🔍 IPC watchparty:join appelé avec code: ${code}`);
      console.log(`   watchPartyManager est ${watchPartyManager ? 'DÉFINI (SERVEUR)' : 'NULL (CLIENT)'}`);

      // Cette instance n'a PAS démarré de serveur = elle est CLIENT
      // La validation se fera lors de la connexion Socket.io au serveur distant
      if (!watchPartyManager) {
        console.log(`✅ Instance CLIENT - validation déléguée au serveur distant via Socket.io`);
        return {
          success: true,
          session: {
            sessionId: `temp_${code}`,
            code: code,
            video: { id: '', title: '', path: '' }
          }
        };
      }

      // Cette instance A un serveur = validation locale possible
      console.log(`✅ Instance SERVEUR - validation locale`);
      console.log(`   Sessions actives:`, Array.from(watchPartyManager.activeSessions.keys()));
      const result = watchPartyManager.joinSession(code);
      console.log(`   Résultat validation:`, result);
      return result;
    } catch (error) {
      console.error('❌ Erreur pour rejoindre Watch Party:', error);
      return { success: false, message: error.message };
    }
  });

  // Quitter une session Watch Party
  ipcMain.handle('watchparty:leave', async (event, sessionId) => {
    try {
      const result = watchPartyManager.leaveSession(sessionId);
      return result;
    } catch (error) {
      console.error('Erreur pour quitter Watch Party:', error);
      return { success: false, message: error.message };
    }
  });

  // Obtenir les infos d'une session Watch Party
  ipcMain.handle('watchparty:getSessionInfo', async (event, sessionId) => {
    try {
      const result = watchPartyManager.getSessionInfo(sessionId);
      return result;
    } catch (error) {
      console.error('Erreur pour obtenir info Watch Party:', error);
      return { success: false, message: error.message };
    }
  });

  // ========================================
  // NGROK IPC HANDLERS
  // ========================================

  // Démarrer le tunnel ngrok
  ipcMain.handle('ngrok:start', async () => {
    try {
      // S'assurer que le serveur HTTP est démarré
      await startHTTPServer();
      await startWatchPartyServer();

      const result = await startNgrokTunnel();
      return result;
    } catch (error) {
      console.error('❌ Erreur démarrage ngrok:', error);
      return { success: false, error: error.message };
    }
  });

  // Arrêter le tunnel ngrok
  ipcMain.handle('ngrok:stop', async () => {
    return await stopNgrokTunnel();
  });

  // Obtenir l'URL ngrok actuelle
  ipcMain.handle('ngrok:getUrl', async () => {
    return { success: true, url: ngrokUrl };
  });

  // Générer le lien de partage complet
  ipcMain.handle('ngrok:getShareLink', async (event, sessionCode) => {
    if (!ngrokUrl) {
      return { success: false, error: 'Tunnel ngrok non actif' };
    }
    const shareLink = `${ngrokUrl}/watch/${sessionCode}`;
    return { success: true, url: shareLink };
  });
}

// Fonction pour obtenir le Content-Type correct selon l'extension du fichier
function getVideoContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.3gp': 'video/3gpp',
    '.ts': 'video/mp2t'
  };
  return mimeTypes[ext] || 'video/mp4';
}

// Fonction pour vérifier si un fichier vidéo a un codec audio non supporté
async function checkAudioCodec(videoPath) {
  return new Promise((resolve) => {
    const command = `"${FFPROBE_PATH}" -v quiet -print_format json -show_streams -select_streams a:0 "${videoPath}"`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        resolve({ needsTranscode: false, codec: 'unknown' });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const audioStream = data.streams?.[0];
        if (audioStream) {
          const codec = (audioStream.codec_name || '').toLowerCase();
          const needsTranscode = UNSUPPORTED_AUDIO.some(c => codec.includes(c));
          resolve({ needsTranscode, codec, channels: audioStream.channels });
        } else {
          resolve({ needsTranscode: false, codec: 'none' });
        }
      } catch (e) {
        resolve({ needsTranscode: false, codec: 'unknown' });
      }
    });
  });
}

// Fonction pour démarrer le serveur vidéo local (pour changement de piste audio)
function startLocalVideoServer() {
  if (localVideoServer) {
    console.log('✅ Serveur vidéo local déjà actif');
    return;
  }

  localVideoServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/local-video') {
      const videoPath = url.searchParams.get('path');
      const audioTrack = url.searchParams.get('audioTrack');
      const transcode = url.searchParams.get('transcode') === 'true';
      const transcodeVideo = url.searchParams.get('transcodeVideo') === 'true';

      console.log(`📥 Requête vidéo: ${path.basename(videoPath || 'undefined')}`);
      console.log(`   - Chemin complet: ${videoPath}`);
      console.log(`   - Transcode audio: ${transcode}, Transcode vidéo: ${transcodeVideo}, AudioTrack: ${audioTrack}`);

      if (!videoPath) {
        console.error('❌ Chemin vidéo manquant');
        res.writeHead(400);
        res.end('Chemin vidéo manquant');
        return;
      }

      if (!fs.existsSync(videoPath)) {
        console.error('❌ Fichier introuvable:', videoPath);
        res.writeHead(404);
        res.end('Vidéo introuvable: ' + videoPath);
        return;
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const ext = path.extname(videoPath).toLowerCase();

      // Si c'est un fichier MKV avec fichier pré-transcodé disponible
      if (ext === '.mkv' && preparedMediaCache.has(videoPath)) {
        const mp4Path = preparedMediaCache.get(videoPath);
        if (fs.existsSync(mp4Path)) {
          console.log(`✅ Utilisation du fichier pré-transcodé: ${path.basename(mp4Path)}`);

          const mp4Stat = fs.statSync(mp4Path);
          const mp4Size = mp4Stat.size;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : mp4Size - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(mp4Path, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${mp4Size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/mp4',
              'Access-Control-Allow-Origin': '*'
            });

            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': mp4Size,
              'Content-Type': 'video/mp4',
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            });

            fs.createReadStream(mp4Path).pipe(res);
          }
          return;
        }
      }

      // Si transcodage audio demandé (codec non supporté comme AC3, DTS)
      if (transcode && FFMPEG_PATH) {
        const cacheKey = `${videoPath}|transcode`;
        let basename = path.basename(videoPath, path.extname(videoPath));
        basename = basename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

        // D'abord vérifier si une conversion permanente existe
        const convertedDir = path.join(DATA_DIR, 'converted-audio');

        // Vérifier d'abord la version avec vidéo transcodée (HEVC → H.264), puis audio seulement
        const videoTranscodePath = path.join(convertedDir, `${basename}_h264_aac.mp4`);
        const audioTranscodePath = path.join(convertedDir, `${basename}_aac.mp4`);
        const permanentPath = fs.existsSync(videoTranscodePath) ? videoTranscodePath : audioTranscodePath;

        if (fs.existsSync(permanentPath)) {
          console.log(`🎵 Utilisation de la conversion permanente: ${path.basename(permanentPath)}`);
          remuxCache.set(cacheKey, permanentPath); // Mettre en cache mémoire aussi

          const permStat = fs.statSync(permanentPath);
          const permSize = permStat.size;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : permSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(permanentPath, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${permSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/mp4',
              'Access-Control-Allow-Origin': '*'
            });

            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': permSize,
              'Content-Type': 'video/mp4',
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            });

            fs.createReadStream(permanentPath).pipe(res);
          }
          return;
        }

        // Vérifier si le fichier transcodé existe déjà en cache mémoire
        if (remuxCache.has(cacheKey) && fs.existsSync(remuxCache.get(cacheKey))) {
          const tempPath = remuxCache.get(cacheKey);
          console.log(`🎵 Utilisation du cache transcodé: ${path.basename(videoPath)}`);

          // Servir le fichier transcodé avec support du seeking
          const tempStat = fs.statSync(tempPath);
          const tempSize = tempStat.size;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : tempSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(tempPath, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${tempSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/mp4',
              'Access-Control-Allow-Origin': '*'
            });

            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': tempSize,
              'Content-Type': 'video/mp4',
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            });

            fs.createReadStream(tempPath).pipe(res);
          }
          return;
        }

        // Créer le dossier de conversions permanentes
        fs.ensureDirSync(convertedDir);

        // Utiliser le dossier permanent pour sauvegarder la conversion
        const tempPath = transcodeVideo ? videoTranscodePath : audioTranscodePath;

        const conversionType = transcodeVideo ? 'HEVC → H.264 + AAC' : 'audio → AAC';
        console.log(`🎵 Transcodage ${conversionType} (streaming progressif): ${path.basename(videoPath)}`);
        console.log(`📁 Fichier source: ${videoPath}`);
        console.log(`📁 Fichier destination: ${tempPath}`);

        // Pour le streaming progressif, on utilise un fichier temporaire différent
        // car -movflags +faststart ne fonctionne qu'à la fin
        const streamTempPath = tempPath + '.streaming.mp4';

        // Construire les arguments FFmpeg selon le type de conversion
        let ffmpegArgs;
        if (transcodeVideo) {
          // Transcodage vidéo + audio (HEVC → H.264)
          ffmpegArgs = [
            '-y',
            '-i', videoPath,
            '-map', '0:v:0',
            '-map', '0:a:0',
            '-c:v', 'libx264',
            '-preset', 'fast',  // Preset rapide pour le streaming
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            streamTempPath
          ];
        } else {
          // Transcodage audio seulement
          ffmpegArgs = [
            '-y',
            '-i', videoPath,
            '-map', '0:v:0',
            '-map', '0:a:0',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            streamTempPath
          ];
        }

        console.log(`🔧 FFmpeg (streaming): ${ffmpegArgs.join(' ')}`);

        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
        let ffmpegError = '';
        let conversionStarted = false;
        let streamingStarted = false;
        let headerSent = false;

        ffmpeg.stderr.on('data', (data) => {
          ffmpegError += data.toString();
          const line = data.toString();
          if (line.includes('time=') || line.includes('Error')) {
            console.log('FFmpeg:', line.trim());
          }

          // Dès que FFmpeg commence à écrire, on peut commencer à streamer
          if (!streamingStarted && fs.existsSync(streamTempPath)) {
            const currentSize = fs.statSync(streamTempPath).size;
            // Seuil de données pour commencer le streaming
            // Plus grand pour le transcodage vidéo car plus lent
            const minBufferSize = transcodeVideo ? 5 * 1024 * 1024 : 1024 * 1024; // 5MB pour vidéo, 1MB pour audio
            if (currentSize > minBufferSize) {
              streamingStarted = true;
              console.log(`🎬 Début du streaming progressif (${Math.round(currentSize / 1024 / 1024)}MB disponibles)`);

              // Pour le streaming progressif, on stream le fichier au fur et à mesure
              if (!headerSent) {
                headerSent = true;
                res.writeHead(200, {
                  'Content-Type': 'video/mp4',
                  'Accept-Ranges': 'none', // Pas de seeking pendant le streaming
                  'Access-Control-Allow-Origin': '*',
                  'Transfer-Encoding': 'chunked'
                });

                // Stream le fichier au fur et à mesure qu'il est écrit
                let lastPosition = 0;
                const streamInterval = setInterval(() => {
                  if (!fs.existsSync(streamTempPath)) {
                    clearInterval(streamInterval);
                    return;
                  }

                  try {
                    const currentStat = fs.statSync(streamTempPath);
                    if (currentStat.size > lastPosition) {
                      const chunk = Buffer.alloc(currentStat.size - lastPosition);
                      const fd = fs.openSync(streamTempPath, 'r');
                      fs.readSync(fd, chunk, 0, chunk.length, lastPosition);
                      fs.closeSync(fd);
                      res.write(chunk);
                      lastPosition = currentStat.size;
                    }
                  } catch (e) {
                    // Fichier peut être en cours d'écriture
                  }
                }, 500);

                // Stocker l'interval pour le nettoyer plus tard
                ffmpeg.streamInterval = streamInterval;
              }
            }
          }
        });

        ffmpeg.on('close', (code) => {
          // Nettoyer l'interval de streaming
          if (ffmpeg.streamInterval) {
            clearInterval(ffmpeg.streamInterval);
          }

          if (code === 0 && fs.existsSync(streamTempPath)) {
            console.log(`✅ Transcodage streaming terminé`);

            // Envoyer les dernières données et terminer
            if (headerSent) {
              try {
                const finalStat = fs.statSync(streamTempPath);
                const lastChunk = fs.readFileSync(streamTempPath);
                // Les données ont déjà été envoyées progressivement
                res.end();
              } catch (e) {
                res.end();
              }

              // Créer une version optimisée pour les prochaines lectures
              const finalArgs = [
                '-y',
                '-i', streamTempPath,
                '-c', 'copy',
                '-movflags', '+faststart',
                tempPath
              ];

              const finalFFmpeg = spawn(FFMPEG_PATH, finalArgs);
              finalFFmpeg.on('close', (finalCode) => {
                if (finalCode === 0) {
                  console.log(`✅ Fichier optimisé créé: ${tempPath}`);
                  remuxCache.set(cacheKey, tempPath);
                  // Supprimer le fichier de streaming temporaire
                  try { fs.unlinkSync(streamTempPath); } catch (e) {}
                }
              });
            } else {
              // Si le streaming n'avait pas encore commencé, servir le fichier normalement
              const tempStat = fs.statSync(streamTempPath);
              const tempSize = tempStat.size;

              res.writeHead(200, {
                'Content-Length': tempSize,
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*'
              });

              fs.createReadStream(streamTempPath).pipe(res);
              remuxCache.set(cacheKey, streamTempPath);
            }
          } else {
            console.error(`❌ Erreur transcodage (code: ${code})`);
            console.error('FFmpeg stderr:', ffmpegError.slice(-500));

            const errorMatch = ffmpegError.match(/Error[^\n]*/i);
            const errorDetail = errorMatch ? errorMatch[0] : 'Erreur inconnue';

            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Erreur transcodage: ${errorDetail}`);
          }
        });

        ffmpeg.on('error', (err) => {
          console.error('❌ Erreur FFmpeg:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Erreur FFmpeg: ${err.message}`);
        });

        return;
      }

      // Si une piste audio spécifique est demandée et FFmpeg est disponible
      // audioTrack doit être une chaîne non vide et différente de "0" (piste par défaut)
      if (audioTrack && audioTrack !== '0' && FFMPEG_PATH) {
        const cacheKey = `${videoPath}|${audioTrack}`;

        // Vérifier si le fichier remuxé existe déjà en cache
        if (remuxCache.has(cacheKey) && fs.existsSync(remuxCache.get(cacheKey))) {
          const tempPath = remuxCache.get(cacheKey);
          console.log(`🎵 Utilisation du cache pour piste audio ${audioTrack}: ${path.basename(videoPath)}`);

          // Servir le fichier temp avec support du seeking
          const tempStat = fs.statSync(tempPath);
          const tempSize = tempStat.size;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : tempSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(tempPath, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${tempSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/x-matroska',
              'Access-Control-Allow-Origin': '*'
            });

            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': tempSize,
              'Content-Type': 'video/x-matroska',
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            });

            fs.createReadStream(tempPath).pipe(res);
          }
        } else {
          // Créer un fichier temporaire pour le remux
          const tempDir = path.join(app.getPath('temp'), 'rackoon-remux');
          fs.ensureDirSync(tempDir);
          const tempPath = path.join(tempDir, `${path.basename(videoPath, path.extname(videoPath))}_track${audioTrack}.mkv`);

          console.log(`🎵 Création du fichier remuxé pour piste audio ${audioTrack}: ${path.basename(videoPath)}`);

          // Utiliser FFmpeg pour créer le fichier remuxé
          const ffmpegArgs = [
            '-i', videoPath,
            '-map', '0:v',  // Toutes les pistes vidéo
            '-map', `0:a:${audioTrack}`,  // Piste audio sélectionnée
            '-map', '0:s?',  // Tous les sous-titres (optionnel)
            '-c', 'copy',  // Copier sans réencoder
            '-y',  // Overwrite
            tempPath
          ];

          const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

          ffmpeg.stderr.on('data', (data) => {
            // Log FFmpeg progress
          });

          ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempPath)) {
              console.log(`✅ Fichier remuxé créé: ${tempPath}`);
              remuxCache.set(cacheKey, tempPath);

              // Servir le fichier créé
              const tempStat = fs.statSync(tempPath);
              const tempSize = tempStat.size;

              if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : tempSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(tempPath, { start, end });

                res.writeHead(206, {
                  'Content-Range': `bytes ${start}-${end}/${tempSize}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': chunksize,
                  'Content-Type': 'video/x-matroska',
                  'Access-Control-Allow-Origin': '*'
                });

                file.pipe(res);
              } else {
                res.writeHead(200, {
                  'Content-Length': tempSize,
                  'Content-Type': 'video/x-matroska',
                  'Accept-Ranges': 'bytes',
                  'Access-Control-Allow-Origin': '*'
                });

                fs.createReadStream(tempPath).pipe(res);
              }
            } else {
              console.error(`❌ Erreur lors de la création du fichier remuxé (code: ${code})`);
              res.writeHead(500);
              res.end('Erreur lors du remuxage');
            }
          });

          ffmpeg.on('error', (err) => {
            console.error('❌ Erreur FFmpeg:', err);
            res.writeHead(500);
            res.end('Erreur FFmpeg');
          });
        }
      } else {
        // Streaming normal sans changement de piste
        const contentType = getVideoContentType(videoPath);

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(videoPath, { start, end });

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });

          file.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*'
          });

          fs.createReadStream(videoPath).pipe(res);
        }
      }
    } else {
      res.writeHead(404);
      res.end('Route inconnue');
    }
  });

  localVideoServer.listen(LOCAL_VIDEO_PORT, '127.0.0.1', () => {
    console.log(`🎬 Serveur vidéo local démarré sur http://localhost:${LOCAL_VIDEO_PORT}`);
  });
}

// Fonction pour essayer de convertir SUP en SRT
async function tryConvertSupToSrt(supPath, outputSrtPath) {
  return new Promise((resolve) => {
    console.log('🔄 Tentative de conversion SUP vers SRT...');
    
    // Méthode 1: Essayer avec FFmpeg et un filtre OCR (nécessite compilation spéciale)
    const ocrCommand = `"${FFMPEG_PATH}" -y -i "${supPath}" -c:s srt "${outputSrtPath}"`;
    
    exec(ocrCommand, { timeout: 15000 }, (error, stdout, stderr) => {
      if (!error && fs.existsSync(outputSrtPath)) {
        console.log('✅ Conversion SUP->SRT réussie avec FFmpeg');
        resolve(true);
        return;
      }
      
      console.log('⚠️ Conversion FFmpeg échouée, tentative alternative...');
      
      // Méthode 2: Créer un fichier SRT vide avec message d'information
      const infoSrt = `1
00:00:01,000 --> 00:00:10,000
[Sous-titres PGS disponibles mais non convertis]

2
00:00:10,000 --> 00:00:20,000
Utilisez un lecteur externe comme VLC pour les afficher

3
00:00:20,000 --> 00:00:30,000
Ou convertissez le fichier avec MKVToolNix + OCR
`;
      
      try {
        fs.writeFileSync(outputSrtPath, infoSrt, 'utf8');
        console.log('📝 Fichier SRT d\'information créé');
        resolve(true);
      } catch (writeError) {
        console.error('❌ Erreur création SRT d\'info:', writeError);
        resolve(false);
      }
    });
  });
}

// Quand Electron est prêt
app.whenReady().then(async () => {
  // Configurer FFmpeg
  let ffmpegConfigured = setupStaticFfmpeg();
  if (!ffmpegConfigured) {
    findFfmpegPaths();
  }

  // Initialiser la base de données
  // Utiliser le dossier du projet pour le développement
  DATA_DIR = path.join(__dirname, 'data');

  try {
    fs.ensureDirSync(DATA_DIR);
    fs.ensureDirSync(path.join(DATA_DIR, 'thumbnails'));
    fs.ensureDirSync(path.join(DATA_DIR, 'tmdb-images'));
  } catch (error) {
    console.error('❌ Erreur création dossiers data:', error);
  }

  const dbPath = path.join(DATA_DIR, 'medias.json');
  db = new JSONDatabase(dbPath);
  await db.load();
  console.log('✅ Base de données prête');

  // Créer la fenêtre
  createWindow();

  // Démarrer le serveur HTTP immédiatement (pour thumbnails et Watch Party)
  try {
    await startHTTPServer();
  } catch (error) {
    console.error('❌ Impossible de démarrer le serveur HTTP:', error);
  }

  // Vérifier FFmpeg
  const ffmpegInstalled = checkFfmpegInstalled();

  setupIPCHandlers();

  // Démarrer le serveur vidéo local pour le streaming avec sélection de piste audio
  startLocalVideoServer();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', function () {
  // Fermer le serveur HTTP Watch Party
  if (httpServer) {
    httpServer.close(() => {
      console.log('🎬 Serveur Watch Party fermé');
    });
  }

  // Fermer le serveur vidéo local
  if (localVideoServer) {
    localVideoServer.close(() => {
      console.log('🎬 Serveur vidéo local fermé');
    });
  }

  if (process.platform !== 'darwin') app.quit();
});