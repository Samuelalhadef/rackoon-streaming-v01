// Fichier principal pour l'application Electron
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { glob } = require('glob');
const ffmpeg = require('fluent-ffmpeg');

// Vérifier si ffmpeg est disponible
try {
  ffmpeg.setFfmpegPath(require('ffmpeg-static').path);
  ffmpeg.setFfprobePath(require('ffprobe-static').path);
} catch (error) {
  console.log('FFMPEG static path non disponible, utilisation du chemin système');
}

// Chemin de la base de données
const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

// Constantes pour les vidéos
const MIN_DURATION_MINUTES = 15;
const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];

// Variable pour stocker la fenêtre principale
let mainWindow;

// Créer la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public', 'img', 'icon.png')
  });

  // Charger la page de login
  mainWindow.loadFile(path.join(__dirname, 'views', 'login.html'));

  // Ouvrir les outils de développement lors du développement
  // mainWindow.webContents.openDevTools();
}

// Initialiser la base de données
function initDatabase() {
  // Créer le dossier qui contient la base de données
  fs.ensureDirSync(path.dirname(dbPath));
  
  // Créer la connexion
  const db = new sqlite3.Database(dbPath);
  
  // Créer les tables
  db.serialize(() => {
    // Table des utilisateurs
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Table des films
    db.run(`
      CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        path TEXT UNIQUE NOT NULL,
        format TEXT,
        duration INTEGER,
        size_bytes INTEGER,
        thumbnail TEXT,
        last_scan DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
  
  // Fermer la connexion
  db.close();
  
  console.log('Base de données initialisée:', dbPath);
}

// Quand Electron est prêt
app.whenReady().then(() => {
  // Initialiser la base de données
  initDatabase();
  
  // Créer la fenêtre
  createWindow();
  
  // Créer le dossier pour les miniatures
  const thumbnailsDir = path.join(app.getPath('userData'), 'thumbnails');
  fs.ensureDirSync(thumbnailsDir);
  
  // Définir les gestionnaires de messages IPC
  setupIPCHandlers();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitter quand toutes les fenêtres sont fermées (sauf sur macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Configuration des gestionnaires de messages IPC
function setupIPCHandlers() {
  // Inscription d'un utilisateur
  ipcMain.handle('user:register', async (event, userData) => {
    try {
      const { username, email, password } = userData;
      
      if (!username || !email || !password) {
        return { success: false, message: 'Tous les champs sont obligatoires' };
      }
      
      const db = new sqlite3.Database(dbPath);
      
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      
      if (existingUser) {
        db.close();
        return { success: false, message: 'Cet utilisateur ou cet email existe déjà' };
      }
      
      // Hasher le mot de passe
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Insérer l'utilisateur
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
               [username, email, hashedPassword], 
               function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        });
      });
      
      db.close();
      
      return { 
        success: true, 
        message: 'Utilisateur créé avec succès',
        user: { username, email }
      };
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return { success: false, message: 'Erreur lors de l\'inscription: ' + error.message };
    }
  });
  
  // Connexion d'un utilisateur
  ipcMain.handle('user:login', async (event, credentials) => {
    try {
      const { username, password } = credentials;
      
      if (!username || !password) {
        return { success: false, message: 'Nom d\'utilisateur et mot de passe requis' };
      }
      
      const db = new sqlite3.Database(dbPath);
      
      // Rechercher l'utilisateur
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      
      if (!user) {
        db.close();
        return { success: false, message: 'Utilisateur introuvable' };
      }
      
      // Vérifier le mot de passe
      const match = await bcrypt.compare(password, user.password);
      
      if (!match) {
        db.close();
        return { success: false, message: 'Mot de passe incorrect' };
      }
      
      db.close();
      
      // Renvoyer les informations de l'utilisateur (sans le mot de passe)
      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email
      };
      
      return { 
        success: true, 
        message: 'Connexion réussie',
        user: userInfo
      };
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return { success: false, message: 'Erreur lors de la connexion: ' + error.message };
    }
  });
  
  // Recherche de films sur un ou plusieurs lecteurs
  ipcMain.handle('movies:scan', async (event, options) => {
    try {
      const startTime = Date.now();
      const db = new sqlite3.Database(dbPath);
      
      // Dialogues pour sélectionner le dossier à scanner
      let folderToScan;
      
      if (!options || !options.path) {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
          title: 'Sélectionnez un dossier à scanner'
        });
        
        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, message: 'Aucun dossier sélectionné' };
        }
        
        folderToScan = result.filePaths[0];
      } else {
        folderToScan = options.path;
      }
      
      // Commencer le scan
      mainWindow.webContents.send('scan:status', {
        message: `Recherche des films dans ${folderToScan}...`,
        progress: 0
      });
      
      // Obtenir la liste de tous les fichiers vidéo
      const videoFiles = await findVideoFiles(folderToScan);
      
      mainWindow.webContents.send('scan:status', {
        message: `${videoFiles.length} fichiers vidéo trouvés. Analyse en cours...`,
        progress: 10
      });
      
      let processedCount = 0;
      let addedCount = 0;
      let errorCount = 0;
      
      // Analyser chaque fichier vidéo
      for (const filePath of videoFiles) {
        try {
          // Vérifier si le fichier existe déjà dans la base
          const existingMovie = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM movies WHERE path = ?', [filePath], (err, row) => {
              if (err) reject(err);
              resolve(row);
            });
          });
          
          if (!existingMovie) {
            // Analyser le fichier
            const movieData = await analyzeVideoFile(filePath);
            
            // Ajouter à la base de données
            await new Promise((resolve, reject) => {
              db.run(`
                INSERT INTO movies (title, path, format, duration, size_bytes, thumbnail, last_scan)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `, [
                movieData.title,
                movieData.path,
                movieData.format,
                movieData.duration,
                movieData.size_bytes,
                movieData.thumbnail
              ], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
              });
            });
            
            addedCount++;
          }
          
          processedCount++;
          
          // Mettre à jour le statut toutes les 5 fichiers ou à la fin
          if (processedCount % 5 === 0 || processedCount === videoFiles.length) {
            const progress = Math.round((processedCount / videoFiles.length) * 90) + 10; // 10% à 100%
            mainWindow.webContents.send('scan:status', {
              message: `Analyse des films: ${processedCount}/${videoFiles.length} (${addedCount} nouveaux)`,
              progress
            });
          }
        } catch (error) {
          console.error(`Erreur lors de l'analyse de ${filePath}:`, error);
          errorCount++;
          processedCount++;
        }
      }
      
      db.close();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      return {
        success: true,
        message: `Recherche terminée en ${duration}s: ${addedCount} nouveaux films ajoutés, ${errorCount} erreurs`,
        stats: {
          totalFound: videoFiles.length,
          added: addedCount,
          errors: errorCount,
          duration
        }
      };
    } catch (error) {
      console.error('Erreur lors de la recherche de films:', error);
      return { success: false, message: 'Erreur lors de la recherche: ' + error.message };
    }
  });
  
  // Obtenir tous les films
  ipcMain.handle('movies:getAll', async () => {
    try {
      const db = new sqlite3.Database(dbPath);
      
      const movies = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM movies ORDER BY title', [], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
      
      db.close();
      
      // Formater les données
      const formattedMovies = movies.map(movie => ({
        ...movie,
        formattedDuration: formatDuration(movie.duration),
        formattedSize: formatFileSize(movie.size_bytes)
      }));
      
      return {
        success: true,
        count: movies.length,
        movies: formattedMovies
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des films:', error);
      return { success: false, message: 'Erreur lors de la récupération des films: ' + error.message };
    }
  });
  
  // Récupérer le chemin d'un film pour la lecture
  ipcMain.handle('movies:getPath', async (event, movieId) => {
    try {
      const db = new sqlite3.Database(dbPath);
      
      const movie = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      
      db.close();
      
      if (!movie) {
        return { success: false, message: 'Film non trouvé' };
      }
      
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(movie.path)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      return {
        success: true,
        path: movie.path,
        title: movie.title,
        format: movie.format
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du chemin:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });
}

// Rechercher tous les fichiers vidéo dans un répertoire (récursivement)
async function findVideoFiles(directory) {
  try {
    // Utiliser glob pour trouver tous les fichiers avec les extensions supportées
    const patterns = SUPPORTED_FORMATS.map(ext => `${directory}/**/*${ext}`);
    let allFiles = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { nocase: true });
      allFiles = [...allFiles, ...files];
    }
    
    return allFiles;
  } catch (error) {
    console.error('Erreur lors de la recherche de fichiers:', error);
    throw error;
  }
}

// Analyser un fichier vidéo pour extraire les métadonnées
async function analyzeVideoFile(filePath) {
  return new Promise((resolve, reject) => {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Le fichier ${filePath} n'existe pas`));
    }
    
    // Obtenir les statistiques du fichier
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, fileExtension);
    
    // Vérifier si c'est un format vidéo supporté
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
      return reject(new Error(`Format de fichier non supporté: ${fileExtension}`));
    }
    
    // Utiliser ffmpeg pour obtenir la durée de la vidéo
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      
      // Extraire la durée en secondes
      const durationInSeconds = metadata.format.duration || 0;
      
      // Si la durée est inférieure à la durée minimale configurée, ignorer le fichier
      if (durationInSeconds < (MIN_DURATION_MINUTES * 60)) {
        return reject(new Error(`Le fichier vidéo est trop court: ${durationInSeconds} secondes`));
      }
      
      // Générer un nom pour la miniature
      const thumbnailName = `${Date.now()}_${path.basename(filePath)}.jpg`;
      const thumbnailPath = path.join(app.getPath('userData'), 'thumbnails', thumbnailName);
      
      // Générer une miniature pour le film
      ffmpeg(filePath)
        .screenshots({
          count: 1,
          folder: path.join(app.getPath('userData'), 'thumbnails'),
          filename: thumbnailName,
          size: '320x240'
        })
        .on('error', (err) => {
          // En cas d'erreur lors de la génération de la miniature, continuer sans miniature
          console.error(`Erreur lors de la génération de la miniature pour ${filePath}:`, err.message);
          
          // Créer les métadonnées du film sans miniature
          const movieData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1), // Enlever le point du début
            duration: Math.round(durationInSeconds),
            size_bytes: fileSize,
            thumbnail: null
          };
          
          resolve(movieData);
        })
        .on('end', () => {
          // Créer les métadonnées du film avec miniature
          const movieData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1), // Enlever le point du début
            duration: Math.round(durationInSeconds),
            size_bytes: fileSize,
            thumbnail: thumbnailPath
          };
          
          resolve(movieData);
        });
    });
  });
}

// Formater la durée en HH:MM:SS
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    remainingSeconds.toString().padStart(2, '0')
  ].join(':');
}

// Formater la taille du fichier
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}