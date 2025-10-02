// Version avec système de stockage JSON
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { glob } = require('glob');
const { execSync, exec } = require('child_process');
const os = require('os');
const JSONDatabase = require('./js/db-manager');
const https = require('https');

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
  
  console.log('FFmpeg trouvé à:', FFMPEG_PATH);
  console.log('FFprobe trouvé à:', FFPROBE_PATH);
}

// Utiliser FFmpeg statique préinstallé
function setupStaticFfmpeg() {
  try {
    // Utiliser les binaires statiques du module ffmpeg-static et ffprobe-static
    const ffmpegPath = require('ffmpeg-static');
    const ffprobePath = require('ffprobe-static').path;
    
    if (ffmpegPath && ffprobePath) {
      FFMPEG_PATH = ffmpegPath;
      FFPROBE_PATH = ffprobePath;
      console.log('✅ FFmpeg statique configuré');
      console.log('FFmpeg statique à:', FFMPEG_PATH);
      console.log('FFprobe statique à:', FFPROBE_PATH);
      return true;
    }
  } catch (error) {
    console.log('⚠️ Modules FFmpeg statiques non disponibles:', error.message);
  }
  
  return false;
}

// Formats de fichiers vidéo supportés
const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];

// Variables globales
let mainWindow;
let db;

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
  
  console.log('Fenêtre principale créée');
}

// Vérifier si ffmpeg est disponible
function checkFfmpegInstalled() {
  try {
    // Essayer d'exécuter FFmpeg avec le chemin trouvé
    const output = execSync(`"${FFMPEG_PATH}" -version`, { encoding: 'utf8' });
    console.log('FFmpeg est installé:', output.split('\n')[0]);
    return true;
  } catch (error) {
    console.log('FFmpeg n\'est pas installé ou n\'est pas accessible');
    console.log('Les miniatures ne seront pas générées automatiquement');
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
      
      // Commande ffmpeg pour extraire une frame à 20 secondes
      const command = `"${FFMPEG_PATH}" -ss 00:00:20 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}" -y`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Si échec à 20s, essayer à 5s
          const fallbackCommand = `"${FFMPEG_PATH}" -ss 00:00:05 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}" -y`;
          
          exec(fallbackCommand, (err, stdout, stderr) => {
            if (err) {
              console.error('Erreur extraction miniature:', err.message);
              reject(err);
              return;
            }
            
            if (fs.existsSync(outputPath)) {
              resolve(outputPath);
            } else {
              reject(new Error('Miniature non créée'));
            }
          });
          return;
        }
        
        if (fs.existsSync(outputPath)) {
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
              const thumbnailPath = path.join(__dirname, 'data', 'thumbnails', `thumb_${Date.now()}_${i}.jpg`);
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

  // Mettre à jour un film
  ipcMain.handle('medias:update', async (event, mediaId, updates) => {
    try {
      const result = await db.updateMedia(mediaId, updates);
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
          const thumbnailPath = path.join(__dirname, 'data', 'thumbnails', `thumb_${Date.now()}.jpg`);
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
      const imagesDir = path.join(__dirname, 'data', 'tmdb-images');
      fs.ensureDirSync(imagesDir);

      // Générer un nom de fichier unique
      const filename = generateTMDBImageName(mediaTitle, imageUrl);
      const outputPath = path.join(imagesDir, filename);

      // Télécharger l'image
      await downloadTMDBImage(imageUrl, outputPath);

      // Retourner le chemin relatif depuis le dossier data
      const relativePath = path.relative(path.join(__dirname, 'data'), outputPath);
      
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

            // Créer un dossier temporaire pour les sous-titres
            const tempDir = path.join(__dirname, 'temp', 'subtitles');
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
  // D'abord essayer les modules statiques, puis les chemins classiques
  let ffmpegConfigured = setupStaticFfmpeg();
  if (!ffmpegConfigured) {
    console.log('🔍 Recherche de FFmpeg installé manuellement...');
    findFfmpegPaths();
  }
  
  // Initialiser la base de données JSON
  const dbPath = path.join(__dirname, 'data', 'medias.json');
  db = new JSONDatabase(dbPath);
  await db.load();
  console.log('📊 Base de données JSON initialisée');
  
  // Créer la fenêtre
  createWindow();
  
  // Vérifier si ffmpeg est installé
  const ffmpegInstalled = checkFfmpegInstalled();
  
  setupIPCHandlers();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});