// Version avec système de stockage JSON
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { glob } = require('glob');
const { execSync, exec } = require('child_process');
const os = require('os');
const JSONDatabase = require('./js/db-manager');

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

// Configuration des gestionnaires de messages IPC avec stockage JSON
function setupIPCHandlers() {
  
  // Recherche et ajout de films dans la base JSON
  ipcMain.handle('movies:scan', async (event, options) => {
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
          const existingMovies = await db.getAllMovies();
          const exists = existingMovies.find(m => m.path === filePath);
          if (exists) {
            skippedCount++;
            continue;
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
          const movieData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1),
            duration: 0,
            size_bytes: stats.size,
            thumbnail: thumbnailName,
            category: 'unsorted',
            description: '',
            dateAdded: new Date().toISOString()
          };
          
          // Ajouter à la base JSON
          const result = await db.addMovie(movieData);
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
      const allMovies = await db.getAllMovies();
      return {
        success: true,
        message: finalMessage,
        movies: allMovies,
        stats: { added: addedCount, skipped: skippedCount, total: videoFiles.length }
      };
      
    } catch (error) {
      console.error('❌ Erreur lors du scan:', error);
      return { success: false, message: 'Erreur lors du scan: ' + error.message };
    }
  });
  
  // Obtenir tous les films depuis la base JSON
  ipcMain.handle('movies:getAll', async () => {
    try {
      const movies = await db.getAllMovies();
      return {
        success: true,
        count: movies.length,
        movies: movies
      };
    } catch (error) {
      console.error('❌ Erreur récupération films:', error);
      return { success: false, message: error.message };
    }
  });
  
  // Récupérer le chemin d'un film pour la lecture
  ipcMain.handle('movies:getPath', async (event, moviePath) => {
    try {
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(moviePath)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      console.log(`Lecture de la vidéo: ${moviePath}`);
      
      // Retourner le chemin pour le lecteur intégré
      return {
        success: true,
        path: moviePath,
        message: "Vidéo prête à être lue"
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du chemin:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });
  
  // Ouvrir le dossier contenant le film
  ipcMain.handle('movies:openFolder', async (event, moviePath) => {
    try {
      // Vérifier si le fichier existe
      if (!fs.existsSync(moviePath)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      // Ouvrir le dossier contenant le fichier
      shell.showItemInFolder(moviePath);
      
      console.log(`Dossier ouvert pour la vidéo: ${moviePath}`);
      
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
}

// Quand Electron est prêt
app.whenReady().then(async () => {
  // Trouver les chemins de FFmpeg
  findFfmpegPaths();
  
  // Initialiser la base de données JSON
  const dbPath = path.join(__dirname, 'data', 'movies.json');
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