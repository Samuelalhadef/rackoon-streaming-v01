// Version améliorée avec génération automatique de miniatures
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
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

// Chemin de la base de données
const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

// Formats de fichiers vidéo supportés
const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];

// Variables pour stocker la fenêtre principale et la base de données
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

  mainWindow.loadFile(path.join(__dirname, 'views', 'login.html'));

  // Ouvrir les outils de développement en mode développement
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  
  console.log('Fenêtre principale créée');
}

// Initialiser la base de données
function initDatabase() {
  try {
    // Créer le dossier qui contient la base de données
    fs.ensureDirSync(path.dirname(dbPath));
    
    console.log(`Initialisation de la base de données: ${dbPath}`);
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Erreur lors de la connexion à la base de données:', err.message);
      } else {
        console.log('Connexion à la base de données SQLite établie');
      
        // Créer les tables
        db.serialize(() => {
          // Table users
          db.run(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
// Table movies
db.run(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    path TEXT UNIQUE NOT NULL,
    format TEXT,
    duration INTEGER DEFAULT 0,
    size_bytes INTEGER,
    thumbnail TEXT,
    category TEXT DEFAULT 'unsorted',
    last_scan DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
          
          console.log('Tables créées avec succès');
        });
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
  }
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

// Extraire une frame d'une vidéo (à 20 secondes par défaut)
function extractFirstFrame(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Créer le dossier de sortie s'il n'existe pas
      fs.ensureDirSync(path.dirname(outputPath));
      
      // Commande ffmpeg pour extraire une frame
      const command = `"${FFMPEG_PATH}" -ss 00:00:20 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}" -y`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Erreur lors de l\'extraction de la frame:', error);
          reject(error);
          return;
        }
        
        // Vérifier si le fichier a été créé
        if (fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          // Si la capture à 20 secondes échoue, essayer à 5 secondes
          const fallbackCommand = `"${FFMPEG_PATH}" -ss 00:00:05 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}" -y`;
          
          exec(fallbackCommand, (err, stdout, stderr) => {
            if (err) {
              console.error('Erreur lors de l\'extraction de la frame (fallback):', err);
              reject(err);
              return;
            }
            
            if (fs.existsSync(outputPath)) {
              resolve(outputPath);
            } else {
              reject(new Error('Le fichier de sortie n\'a pas été créé'));
            }
          });
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'extraction de la frame:', error);
      reject(error);
    }
  });
}

// Génération automatique de miniatures pour les films récents
async function generateThumbnailsForNewMovies() {
  // Récupérer les films sans miniature - CORRIGÉ pour sqlite3
  db.all("SELECT * FROM movies WHERE thumbnail IS NULL OR thumbnail = ''", async (err, movies) => {
    if (err || !movies || movies.length === 0) {
      console.log('Aucun film sans miniature trouvé');
      return;
    }
    
    console.log(`Génération automatique de miniatures pour ${movies.length} films...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Traiter chaque film
    for (const movie of movies) {
      try {
        // Vérifier si le fichier existe toujours
        if (!fs.existsSync(movie.path)) {
          console.log(`Le fichier ${movie.path} n'existe plus`);
          errorCount++;
          continue;
        }
        
        // Créer un nom unique pour la miniature
        const thumbnailName = `${Date.now()}_${path.basename(movie.path)}.jpg`;
        const thumbnailPath = path.join(app.getPath('userData'), 'thumbnails', thumbnailName);
        
        // Extraire une frame
        await await extractFirstFrame(movie.path, thumbnailPath);
        
        // Mettre à jour la base de données - CORRIGÉ pour sqlite3
        db.run('UPDATE movies SET thumbnail = ? WHERE id = ?', [thumbnailPath, movie.id], (err) => {
          if (err) console.error('Erreur update:', err);
        });
        
        console.log(`Miniature générée pour ${movie.title}`);
        successCount++;
      } catch (error) {
        console.error(`Erreur pour le film ID ${movie.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Génération automatique terminée: ${successCount} réussies, ${errorCount} échecs`);
  });
}

// Quand Electron est prêt
app.whenReady().then(() => {
  // Trouver les chemins de FFmpeg
  findFfmpegPaths();
  
  // Initialiser la base de données
  initDatabase();
  
  // Créer la fenêtre
  createWindow();
  
  // Créer le dossier pour les miniatures
  const thumbnailsDir = path.join(app.getPath('userData'), 'thumbnails');
  fs.ensureDirSync(thumbnailsDir);
  
  // Vérifier si ffmpeg est installé
  const ffmpegInstalled = checkFfmpegInstalled();
  
  // Si FFmpeg est installé, générer des miniatures pour les nouveaux films
  if (ffmpegInstalled) {
    // Générer les miniatures après 3 secondes (pour laisser l'application se charger)
    setTimeout(() => {
      generateThumbnailsForNewMovies();
    }, 3000);
  }
  
  setupIPCHandlers();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Fermer la base de données à la fin
app.on('will-quit', () => {
  if (db) {
    try {
      db.close();
      console.log('Base de données fermée');
    } catch (error) {
      console.error('Erreur lors de la fermeture de la base de données:', error);
    }
  }
});

// Fonctions utilitaires pour extraire les informations des films
// Extraction de genres à partir du titre ou des métadonnées
function extractGenres(movie) {
  // Si les genres sont déjà disponibles, les retourner
  if (movie.genres && Array.isArray(movie.genres) && movie.genres.length > 0) {
    return movie.genres;
  }
  
  // Sinon, essayer d'extraire les genres à partir du titre
  const genreKeywords = {
    'Action': ['action', 'combat', 'explosion'],
    'Comédie': ['comédie', 'humour', 'rire', 'comedy'],
    'Drame': ['drame', 'dramatique', 'drama'],
    'Science-Fiction': ['sci-fi', 'science-fiction', 'futur', 'sf'],
    'Horreur': ['horreur', 'épouvante', 'peur', 'horror'],
    'Aventure': ['aventure', 'quête', 'adventure'],
    'Animation': ['animation', 'animé', 'cartoon', 'disney', 'pixar'],
    'Thriller': ['thriller', 'suspense'],
    'Fantastique': ['fantastique', 'fantasy', 'magic'],
    'Policier': ['policier', 'crime', 'detective'],
    'Documentaire': ['documentaire', 'docu', 'documentary']
  };
  
  const detectedGenres = [];
  const lowerTitle = movie.title.toLowerCase();
  
  Object.entries(genreKeywords).forEach(([genre, keywords]) => {
    if (keywords.some(keyword => lowerTitle.includes(keyword))) {
      detectedGenres.push(genre);
    }
  });
  
  return detectedGenres.length > 0 ? detectedGenres : ['Non classé'];
}

// Extraction de la date de sortie du film
function extractReleaseDate(movie) {
  // Si la date est déjà disponible, la retourner
  if (movie.releaseDate) {
    return movie.releaseDate;
  }
  
  // Essayer d'extraire l'année à partir du titre (format commun: "Titre (2021)")
  const yearMatch = movie.title.match(/\((\d{4})\)$/);
  if (yearMatch) {
    const year = yearMatch[1];
    return `01/01/${year}`; // Format par défaut
  }
  
  // Également chercher d'autres formats d'année dans le titre
  const yearMatch2 = movie.title.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch2) {
    const year = yearMatch2[1];
    return `01/01/${year}`;
  }
  
  return null;
}

// Extraction d'un synopsis (placeholder pour le moment)
function extractSynopsis(movie) {
  // Pour l'instant, retourner un synopsis générique basé sur le titre
  return `Synopsis pour "${movie.title}". Cliquez sur l'icône de crayon pour modifier les informations de ce film et ajouter un synopsis.`;
}

// Configuration des gestionnaires de messages IPC
function setupIPCHandlers() {
  // Inscription d'un utilisateur
  ipcMain.handle('user:register', async (event, userData) => {
    try {
      const { username, email, password } = userData;
      
      if (!username || !email || !password) {
        return { success: false, message: 'Tous les champs sont obligatoires' };
      }
      
      // Vérifier si l'utilisateur existe déjà - CORRIGÉ pour sqlite3
      const existingUser = await new Promise((resolve) => {
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
          resolve(err ? null : row);
        });
      });
      
      if (existingUser) {
        return { success: false, message: 'Cet utilisateur ou cet email existe déjà' };
      }
      
      // Hasher le mot de passe
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Insérer l'utilisateur - CORRIGÉ pour sqlite3
      const insertInfo = await new Promise((resolve) => {
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], function(err) {
          resolve(err ? null : { lastInsertRowid: this.lastID });
        });
      });
      
      if (!insertInfo) {
        return { success: false, message: 'Erreur lors de l\'insertion' };
      }
      
      console.log(`Nouvel utilisateur créé: ${username}`);
      
      return { 
        success: true, 
        message: 'Utilisateur créé avec succès',
        user: { 
          id: insertInfo.lastInsertRowid,
          username, 
          email 
        }
      };
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return { success: false, message: 'Erreur lors de l\'inscription: ' + error.message };
    }
  });
  
  // Connexion d'un utilisateur - CORRIGÉ pour sqlite3
  ipcMain.handle('user:login', async (event, credentials) => {
    try {
      const { username, password } = credentials;
      
      if (!username || !password) {
        return { success: false, message: 'Nom d\'utilisateur et mot de passe requis' };
      }
      
      // Rechercher l'utilisateur - CORRIGÉ pour sqlite3
      const user = await new Promise((resolve) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
          resolve(err ? null : row);
        });
      });
      
      if (!user) {
        return { success: false, message: 'Utilisateur introuvable' };
      }
      
      // Vérifier le mot de passe
      const match = await bcrypt.compare(password, user.password);
      
      if (!match) {
        return { success: false, message: 'Mot de passe incorrect' };
      }
      
      console.log(`Utilisateur connecté: ${username}`);
      
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
      
      // Dialogues pour sélectionner le dossier à scanner
      let folderToScan;
      
      if (!options || !options.path) {
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
        folderToScan = options.path;
      }
      
      console.log(`Début de la recherche dans: ${folderToScan}`);
      
      // Commencer le scan
      mainWindow.webContents.send('scan:status', {
        message: `Recherche des vidéos dans ${folderToScan}...`,
        progress: 0
      });
      
      // Rechercher tous les fichiers vidéo sans filtres complexes
      let videoFiles = [];
      
      for (const ext of SUPPORTED_FORMATS) {
        try {
          const pattern = `${folderToScan}/**/*${ext}`;
          console.log(`Recherche avec pattern: ${pattern}`);
          
          const files = await glob(pattern, { nocase: true });
          console.log(`${ext}: ${files.length} fichiers trouvés`);
          
          videoFiles = [...videoFiles, ...files];
        } catch (error) {
          console.error(`Erreur avec l'extension ${ext}: ${error.message}`);
        }
      }
      
      console.log(`Total: ${videoFiles.length} fichiers vidéo trouvés`);
      
      mainWindow.webContents.send('scan:status', {
        message: `${videoFiles.length} fichiers vidéo trouvés. Ajout à la base de données...`,
        progress: 10
      });
      
      // Traitement simplifié des fichiers
      let processedCount = 0;
      let addedCount = 0;
      let errorCount = 0;
      
      // Vérifier si ffmpeg est installé
      const ffmpegInstalled = checkFfmpegInstalled();
      
      // Traiter chaque fichier
      for (const filePath of videoFiles) {
        try {
          processedCount++;
          
          // Vérifier si le fichier existe et est accessible
          const stats = fs.statSync(filePath);
          
          if (!stats.isFile() || stats.size === 0) {
            errorCount++;
            continue;
          }
          
          // Vérifier si le fichier existe déjà dans la base - CORRIGÉ pour sqlite3
          const existingMovie = await new Promise((resolve) => {
            db.get('SELECT * FROM movies WHERE path = ?', [filePath], (err, row) => {
              resolve(err ? null : row);
            });
          });
          
          if (existingMovie) {
            console.log(`Fichier déjà dans la base: ${filePath}`);
            continue;
          }
          
          // Extraire les métadonnées de base
          const fileExtension = path.extname(filePath).toLowerCase();
          const fileName = path.basename(filePath, fileExtension);
          
          // Générer une miniature pour le film si ffmpeg est disponible
          let thumbnailPath = null;
          
          if (ffmpegInstalled) {
            try {
              // Créer un nom unique pour la miniature
              const thumbnailName = `${Date.now()}_${path.basename(filePath)}.jpg`;
              thumbnailPath = path.join(app.getPath('userData'), 'thumbnails', thumbnailName);
              
              // Extraire une frame aléatoire
              await extractFirstFrame(filePath, thumbnailPath);
              console.log(`Miniature créée pour ${filePath}: ${thumbnailPath}`);
            } catch (error) {
              console.error(`Erreur lors de la création de la miniature pour ${filePath}:`, error);
              thumbnailPath = null;
            }
          }
          
          // Créer une entrée simplifiée
          const movieData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1), // Enlever le point du début
            duration: 0,
            size_bytes: stats.size,
            thumbnail: thumbnailPath
          };
          
          // Requête d'insertion - CORRIGÉ pour sqlite3
          await new Promise((resolve) => {
  db.run(`
    INSERT INTO movies (title, path, format, duration, size_bytes, thumbnail, category, last_scan)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    movieData.title,
    movieData.path,
    movieData.format,
    movieData.duration,
    movieData.size_bytes,
    movieData.thumbnail,
    'unsorted'  // ← AJOUT DE LA CATÉGORIE "NON TRIÉ"
  ], function(err) {
    if (err) console.error('Erreur insertion film:', err);
    resolve();
  });
});
          
          console.log(`Fichier ajouté à la base: ${filePath}`);
          addedCount++;
          
          // Mettre à jour le statut tous les 5 fichiers ou à la fin
          if (processedCount % 5 === 0 || processedCount === videoFiles.length) {
            const progress = Math.round((processedCount / videoFiles.length) * 90) + 10;
            mainWindow.webContents.send('scan:status', {
              message: `Traitement des vidéos: ${processedCount}/${videoFiles.length} (${addedCount} nouveaux)`,
              progress
            });
          }
        } catch (error) {
          console.error(`Erreur pour le fichier ${filePath}: ${error.message}`);
          errorCount++;
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`Recherche terminée. Durée: ${duration}s, Ajoutés: ${addedCount}, Erreurs: ${errorCount}`);
      
      return {
        success: true,
        message: `Recherche terminée en ${duration}s: ${addedCount} nouvelles vidéos ajoutées, ${errorCount} erreurs`,
        stats: {
          totalFound: videoFiles.length,
          added: addedCount,
          errors: errorCount,
          duration
        }
      };
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      return { success: false, message: 'Erreur lors de la recherche: ' + error.message };
    }
  });
  
  // Obtenir tous les films - CORRIGÉ pour sqlite3
  ipcMain.handle('movies:getAll', async () => {
    try {
      // Récupérer tous les films - CORRIGÉ pour sqlite3
      const movies = await new Promise((resolve) => {
        db.all('SELECT * FROM movies ORDER BY title', (err, rows) => {
          resolve(err ? [] : rows);
        });
      });
      
      console.log(`${movies.length} vidéos récupérées de la base de données`);
      
      // Formater les données
      const formattedMovies = movies.map(movie => {
        return {
          ...movie,
          formattedDuration: formatDuration(movie.duration),
          formattedSize: formatFileSize(movie.size_bytes),
          resolution: 'Inconnue'
        };
      });
      
      return {
        success: true,
        count: movies.length,
        movies: formattedMovies
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des vidéos:', error);
      return { success: false, message: 'Erreur lors de la récupération des vidéos: ' + error.message };
    }
  });
  
  // Récupérer le chemin d'un film pour la lecture - CORRIGÉ pour sqlite3
  ipcMain.handle('movies:getPath', async (event, movieId) => {
    try {
      // Récupérer le film - CORRIGÉ pour sqlite3
      const movie = await new Promise((resolve) => {
        db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, row) => {
          resolve(err ? null : row);
        });
      });
      
      if (!movie) {
        return { success: false, message: 'Vidéo non trouvée' };
      }
      
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(movie.path)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      console.log(`Lecture de la vidéo ID ${movieId}: ${movie.path}`);
      
      // Utiliser le lecteur vidéo système par défaut
      try {
        // Sur Windows, utiliser la commande start pour ouvrir le fichier avec l'application associée
        if (process.platform === 'win32') {
          // Utiliser la syntaxe cmd.exe pour les chemins avec espaces
          execSync(`start "" "${movie.path}"`, { windowsHide: true });
        } else {
          // Sur macOS ou Linux, utiliser shell.openPath
          await shell.openPath(movie.path);
        }
        
        return {
          success: true,
          message: "Vidéo en cours de lecture"
        };
      } catch (err) {
        console.error(`Erreur lors de l'ouverture du fichier: ${err.message}`);
        return { 
          success: false, 
          message: `Erreur lors de l'ouverture du fichier: ${err.message}` 
        };
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du chemin:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });
  
  // NOUVEAU GESTIONNAIRE - Récupérer les détails d'un film pour la modal - CORRIGÉ pour sqlite3
  ipcMain.handle('movies:getDetails', async (event, movieId) => {
    try {
      // Récupérer le film depuis la base de données - CORRIGÉ pour sqlite3
      const movie = await new Promise((resolve) => {
        db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, row) => {
          resolve(err ? null : row);
        });
      });
      
      if (!movie) {
        return { success: false, message: 'Film non trouvé' };
      }
      
      // Extraire l'année du titre si présente (format commun: "Titre (2021)")
      let year = null;
      const yearMatch = movie.title.match(/\((\d{4})\)$/);
      if (yearMatch) {
        year = yearMatch[1];
      } else {
        // Autre format possible: "Titre 2021"
        const yearMatch2 = movie.title.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch2) {
          year = yearMatch2[1];
        }
      }
      
      // Enrichir les données du film pour l'affichage dans la modal
      const enrichedMovie = {
        ...movie,
        formattedDuration: formatDuration(movie.duration),
        formattedSize: formatFileSize(movie.size_bytes),
        year: year,
        releaseDate: extractReleaseDate(movie),
        genres: extractGenres(movie),
        synopsis: extractSynopsis(movie)
      };
      
      console.log(`Détails du film ID ${movieId} récupérés pour la modal`);
      
      return { 
        success: true, 
        movie: enrichedMovie 
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du film:', error);
      return { 
        success: false, 
        message: 'Erreur lors de la récupération des détails: ' + error.message 
      };
    }
  });
  
  // Ouvrir le dossier contenant le film - CORRIGÉ pour sqlite3
  ipcMain.handle('movies:openFolder', async (event, movieId) => {
    try {
      // Récupérer le film - CORRIGÉ pour sqlite3
      const movie = await new Promise((resolve) => {
        db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, row) => {
          resolve(err ? null : row);
        });
      });
      
      if (!movie) {
        return { success: false, message: 'Vidéo non trouvée' };
      }
      
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(movie.path)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      // Ouvrir le dossier contenant le fichier
      shell.showItemInFolder(movie.path);
      
      console.log(`Dossier ouvert pour la vidéo ID ${movieId}: ${movie.path}`);
      
      return {
        success: true,
        message: 'Dossier ouvert'
      };
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du dossier:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Générer une miniature pour un film existant - CORRIGÉ pour sqlite3
  ipcMain.handle('movies:generateThumbnail', async (event, movieId) => {
    try {
      // Vérifier si ffmpeg est installé
      if (!checkFfmpegInstalled()) {
        return { 
          success: false, 
          message: 'FFmpeg n\'est pas installé. Impossible de générer des miniatures.' 
        };
      }
      
      // Récupérer le film - CORRIGÉ pour sqlite3
      const movie = await new Promise((resolve) => {
        db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, row) => {
          resolve(err ? null : row);
        });
      });
      
      if (!movie) {
        return { success: false, message: 'Vidéo non trouvée' };
      }
      
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(movie.path)) {
        return { success: false, message: 'Fichier vidéo introuvable sur le disque' };
      }
      
      // Créer un nom unique pour la miniature
      const thumbnailName = `${Date.now()}_${path.basename(movie.path)}.jpg`;
      const thumbnailPath = path.join(app.getPath('userData'), 'thumbnails', thumbnailName);
      
      // Extraire une frame aléatoire
      await extractFirstFrame(movie.path, thumbnailPath);
      
      // Mettre à jour la base de données - CORRIGÉ pour sqlite3
      await new Promise((resolve) => {
        db.run('UPDATE movies SET thumbnail = ? WHERE id = ?', [thumbnailPath, movieId], (err) => {
          if (err) console.error('Erreur update thumbnail:', err);
          resolve();
        });
      });
      
      console.log(`Nouvelle miniature générée pour ID ${movieId}: ${thumbnailPath}`);
      
      return {
        success: true,
        message: 'Miniature générée avec succès',
        thumbnail: thumbnailPath
      };
    } catch (error) {
      console.error('Erreur lors de la génération de la miniature:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Générer des miniatures pour tous les films sans miniature - CORRIGÉ pour sqlite3
  ipcMain.handle('movies:generateAllThumbnails', async () => {
    try {
      // Vérifier si ffmpeg est installé
      if (!checkFfmpegInstalled()) {
        return { 
          success: false, 
          message: 'FFmpeg n\'est pas installé. Impossible de générer des miniatures.' 
        };
      }
      
      // Récupérer les films sans miniature - CORRIGÉ pour sqlite3
      const movies = await new Promise((resolve) => {
        db.all("SELECT * FROM movies WHERE thumbnail IS NULL OR thumbnail = ''", (err, rows) => {
          resolve(err ? [] : rows);
        });
      });
      
      if (movies.length === 0) {
        return { 
          success: true, 
          message: 'Tous les films ont déjà des miniatures',
          count: 0
        };
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      mainWindow.webContents.send('scan:status', {
        message: `Génération de miniatures pour ${movies.length} vidéos...`,
        progress: 0
      });
      
      // Traiter chaque film
      for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        
        try {
          // Vérifier si le fichier existe toujours
          if (!fs.existsSync(movie.path)) {
            errorCount++;
            continue;
          }
          
          // Créer un nom unique pour la miniature
          const thumbnailName = `${Date.now()}_${path.basename(movie.path)}.jpg`;
          const thumbnailPath = path.join(app.getPath('userData'), 'thumbnails', thumbnailName);
          
          // Extraire une frame aléatoire
          await extractFirstFrame(movie.path, thumbnailPath);
          
          // Mettre à jour la base de données - CORRIGÉ pour sqlite3
          await new Promise((resolve) => {
            db.run('UPDATE movies SET thumbnail = ? WHERE id = ?', [thumbnailPath, movie.id], (err) => {
              if (err) console.error('Erreur update thumbnail:', err);
              resolve();
            });
          });
          
          successCount++;
          
          // Mettre à jour le statut
          const progress = Math.round(((i + 1) / movies.length) * 100);
          mainWindow.webContents.send('scan:status', {
            message: `Génération de miniatures: ${i + 1}/${movies.length}`,
            progress
          });
        } catch (error) {
          console.error(`Erreur pour le film ID ${movie.id}:`, error);
          errorCount++;
        }
      }
      
      return {
        success: true,
        message: `Miniatures générées: ${successCount} réussies, ${errorCount} échecs`,
        count: successCount
      };
    } catch (error) {
      console.error('Erreur lors de la génération des miniatures:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });
}

// Formater la durée en HH:MM:SS
function formatDuration(seconds) {
  // Gérer les valeurs invalides
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '00:00:00';
  }
  
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
  if (!bytes || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }
  
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