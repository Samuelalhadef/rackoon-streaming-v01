// Version simplifiée sans base de données
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { glob } = require('glob');
const { execSync, exec } = require('child_process');
const os = require('os');

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

// Variable pour stocker la fenêtre principale
let mainWindow;

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

// Configuration des gestionnaires de messages IPC - version simplifiée
function setupIPCHandlers() {
  
  // Recherche de films sur un ou plusieurs lecteurs
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
      console.log(`Début de la recherche dans: ${folderToScan}`);
      
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
      
      console.log(`Total: ${videoFiles.length} fichiers vidéo trouvés`);
      
      // Retourner la liste des fichiers trouvés
      const movies = videoFiles.map((filePath, index) => {
        const stats = fs.statSync(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, fileExtension);
        
        return {
          id: index + 1,
          title: fileName,
          path: filePath,
          format: fileExtension.substring(1),
          duration: 0,
          size_bytes: stats.size,
          thumbnail: null,
          category: 'unsorted'
        };
      });
      
      return {
        success: true,
        message: `${videoFiles.length} fichiers vidéo trouvés`,
        movies: movies
      };
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      return { success: false, message: 'Erreur lors de la recherche: ' + error.message };
    }
  });
  
  // Obtenir tous les films - retourne une liste vide par défaut
  ipcMain.handle('movies:getAll', async () => {
    return {
      success: true,
      count: 0,
      movies: []
    };
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
app.whenReady().then(() => {
  // Trouver les chemins de FFmpeg
  findFfmpegPaths();
  
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