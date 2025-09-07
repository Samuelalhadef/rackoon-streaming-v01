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
              series_id INTEGER,
              season_number INTEGER,
              episode_number INTEGER,
              release_date TEXT,
              description TEXT,
              last_scan DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (series_id) REFERENCES series (id)
            )
          `);

          // Table categories pour les catégories personnalisées
          db.run(`
            CREATE TABLE IF NOT EXISTS categories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT UNIQUE NOT NULL,
              icon TEXT DEFAULT '📁',
              type TEXT DEFAULT 'unique',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Table series pour gérer les séries
          db.run(`
            CREATE TABLE IF NOT EXISTS series (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT UNIQUE NOT NULL,
              description TEXT,
              poster TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // Migration de la base de données existante
          migrateDatabaseSchema();
          
          console.log('Tables créées avec succès');
        });
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
  }
}

// Fonction de migration pour mettre à jour la structure de la base de données existante
function migrateDatabaseSchema() {
  console.log('🔄 Début de la migration de la base de données...');

  // Vérifier et ajouter les colonnes manquantes dans la table movies
  const columnsToAdd = [
    { name: 'category', type: 'TEXT DEFAULT \'unsorted\'' },
    { name: 'description', type: 'TEXT' },
    { name: 'release_date', type: 'TEXT' },
    { name: 'series_id', type: 'INTEGER' },
    { name: 'season_number', type: 'INTEGER' },
    { name: 'episode_number', type: 'INTEGER' },
    { name: 'posterUrl', type: 'TEXT' },
    { name: 'genres', type: 'TEXT' },
    { name: 'year', type: 'INTEGER' }
  ];

  // Vérifier et ajouter les colonnes manquantes dans la table categories
  const categoriesToAdd = [
    { name: 'type', type: 'TEXT DEFAULT \'unique\'' }
  ];

  // Vérifier la structure actuelle de la table
  db.all("PRAGMA table_info(movies)", (err, columns) => {
    if (err) {
      console.error('Erreur lors de la vérification de la structure de la table:', err);
      return;
    }

    const existingColumns = columns.map(col => col.name);
    console.log('📋 Colonnes existantes:', existingColumns);

    // Ajouter les colonnes manquantes
    columnsToAdd.forEach(column => {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Ajout de la colonne: ${column.name}`);
        db.run(`ALTER TABLE movies ADD COLUMN ${column.name} ${column.type}`, (alterErr) => {
          if (alterErr) {
            console.error(`❌ Erreur lors de l'ajout de la colonne ${column.name}:`, alterErr);
          } else {
            console.log(`✅ Colonne ${column.name} ajoutée avec succès`);
          }
        });
      } else {
        console.log(`✅ Colonne ${column.name} déjà présente`);
      }
    });

    console.log('✅ Migration terminée');
  });

  // Vérifier la structure actuelle de la table categories
  db.all("PRAGMA table_info(categories)", (err, columns) => {
    if (err) {
      console.error('Erreur lors de la vérification de la structure de la table categories:', err);
      return;
    }

    const existingColumns = columns.map(col => col.name);
    console.log('📋 Colonnes existantes dans categories:', existingColumns);

    // Ajouter les colonnes manquantes dans categories
    categoriesToAdd.forEach(column => {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Ajout de la colonne dans categories: ${column.name}`);
        db.run(`ALTER TABLE categories ADD COLUMN ${column.name} ${column.type}`, (alterErr) => {
          if (alterErr) {
            console.error(`❌ Erreur lors de l'ajout de la colonne ${column.name}:`, alterErr);
          } else {
            console.log(`✅ Colonne ${column.name} ajoutée avec succès dans categories`);
          }
        });
      } else {
        console.log(`✅ Colonne ${column.name} déjà présente dans categories`);
      }
    });
  });
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
      let videoFiles = [];
      
      // Vérifier si on veut importer un fichier unique ou un dossier
      if (options && options.mode === 'file') {
        // Mode fichier unique
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          title: 'Sélectionnez un fichier vidéo à ajouter',
          filters: [
            {
              name: 'Fichiers vidéo',
              extensions: SUPPORTED_FORMATS.map(ext => ext.substring(1)) // Enlever le point
            }
          ]
        });
        
        if (result.canceled || result.filePaths.length === 0) {
          console.log('Sélection de fichier annulée');
          return { success: false, message: 'Aucun fichier sélectionné' };
        }
        
        videoFiles = result.filePaths;
        console.log(`Fichier sélectionné: ${videoFiles[0]}`);
        
        mainWindow.webContents.send('scan:status', {
          message: `Ajout du fichier ${path.basename(videoFiles[0])}...`,
          progress: 10
        });
      } else {
        // Mode dossier (comportement original)
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
      // D'abord, vérifier et ajouter la colonne local_poster si nécessaire
      await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(movies)", (err, columns) => {
          if (err) {
            console.error('Erreur vérification structure table:', err);
            resolve(); // Continue même en cas d'erreur
            return;
          }
          
          const hasLocalPosterColumn = columns.some(col => col.name === 'local_poster');
          
          if (!hasLocalPosterColumn) {
            console.log('Ajout de la colonne local_poster à la table movies');
            db.run(`ALTER TABLE movies ADD COLUMN local_poster TEXT`, (err) => {
              if (err) {
                console.error('Erreur ajout colonne local_poster:', err);
              } else {
                console.log('Colonne local_poster ajoutée avec succès');
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      });

      // Récupérer tous les films (avec gestion d'erreur pour la colonne local_poster)
      const movies = await new Promise((resolve) => {
        db.all('SELECT * FROM movies ORDER BY title', (err, rows) => {
          if (err) {
            console.error('Erreur SQL:', err);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        });
      });
      
      console.log(`${movies.length} vidéos récupérées de la base de données`);
      
      // Formater les données
      const formattedMovies = movies.map(movie => {
        // Parser les genres depuis JSON si ils existent
        let parsedGenres = [];
        if (movie.genres) {
          try {
            parsedGenres = JSON.parse(movie.genres);
          } catch (e) {
            console.log('Erreur lors du parsing des genres pour le film', movie.title);
            parsedGenres = [];
          }
        }

        return {
          ...movie,
          genres: parsedGenres, // Remplacer la chaîne JSON par l'array
          // Le formatage sera fait côté client avec window.formatTime et window.formatFileSize
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
      // Récupérer le film depuis la base de données (avec gestion d'erreur pour la colonne local_poster)
      const movie = await new Promise((resolve) => {
        db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, row) => {
          if (err) {
            console.error('Erreur SQL getDetails:', err);
            resolve(null);
          } else {
            resolve(row);
          }
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
        // Le formatage sera fait côté client avec window.formatTime et window.formatFileSize
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

  // Supprimer un film de la base de données
  ipcMain.handle('movies:delete', async (event, movieId) => {
    try {
      const result = await new Promise((resolve) => {
        db.run('DELETE FROM movies WHERE id = ?', [movieId], function(err) {
          resolve(err ? { success: false, error: err } : { success: true, changes: this.changes });
        });
      });

      if (!result.success) {
        return { success: false, message: 'Erreur lors de la suppression' };
      }

      if (result.changes === 0) {
        return { success: false, message: 'Film non trouvé' };
      }

      console.log(`Film ID ${movieId} supprimé de la base de données`);
      return { success: true, message: 'Film supprimé avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression du film:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Obtenir les statistiques des fichiers
  ipcMain.handle('movies:getStats', async () => {
    try {
      const stats = await new Promise((resolve) => {
        db.get(`
          SELECT 
            COUNT(*) as totalFiles,
            SUM(size_bytes) as totalSize,
            SUM(duration) as totalDuration,
            AVG(size_bytes) as avgSize,
            AVG(duration) as avgDuration,
            COUNT(CASE WHEN thumbnail IS NOT NULL AND thumbnail != '' THEN 1 END) as filesWithThumbnails,
            COUNT(DISTINCT format) as uniqueFormats
          FROM movies
        `, (err, row) => {
          resolve(err ? null : row);
        });
      });

      if (!stats) {
        return { success: false, message: 'Erreur lors de la récupération des statistiques' };
      }

      // Ajouter des statistiques par format
      const formats = await new Promise((resolve) => {
        db.all(`
          SELECT 
            format,
            COUNT(*) as count,
            SUM(size_bytes) as totalSize
          FROM movies 
          GROUP BY format 
          ORDER BY count DESC
        `, (err, rows) => {
          resolve(err ? [] : rows);
        });
      });

      return {
        success: true,
        stats: {
          ...stats,
          formats: formats
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
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

  // Obtenir toutes les catégories (prédéfinies + personnalisées)
  ipcMain.handle('categories:getAll', async () => {
    try {
      // Catégories prédéfinies avec leurs types
      const predefinedCategories = [
        { id: 'films', name: 'Films', icon: '🎬', type: 'unique', predefined: true },
        { id: 'series', name: 'Séries', icon: '📺', type: 'series', predefined: true },
        { id: 'shorts', name: 'Court métrage', icon: '🎞️', type: 'unique', predefined: true },
        { id: 'others', name: 'Autres', icon: '📁', type: 'hybrid', predefined: true }
      ];

      // Catégories personnalisées depuis la base
      const customCategories = await new Promise((resolve) => {
        db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
          resolve(err ? [] : rows.map(row => ({ ...row, predefined: false })));
        });
      });

      return {
        success: true,
        categories: [...predefinedCategories, ...customCategories]
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des catégories:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Créer une nouvelle catégorie personnalisée
  ipcMain.handle('categories:create', async (event, categoryData) => {
    try {
      const { name, icon, type } = categoryData;
      
      const result = await new Promise((resolve) => {
        db.run('INSERT INTO categories (name, icon, type) VALUES (?, ?, ?)', [name, icon || '📁', type || 'unique'], function(err) {
          resolve(err ? { success: false, error: err } : { success: true, id: this.lastID });
        });
      });

      if (!result.success) {
        return { success: false, message: 'Erreur lors de la création de la catégorie' };
      }

      console.log(`Nouvelle catégorie créée: ${name} (type: ${type || 'unique'})`);
      return { success: true, id: result.id, name, icon, type: type || 'unique' };
    } catch (error) {
      console.error('Erreur lors de la création de la catégorie:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Obtenir toutes les séries
  ipcMain.handle('series:getAll', async () => {
    try {
      const series = await new Promise((resolve) => {
        db.all('SELECT * FROM series ORDER BY name', (err, rows) => {
          resolve(err ? [] : rows);
        });
      });

      return { success: true, series: series };
    } catch (error) {
      console.error('Erreur lors de la récupération des séries:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Obtenir tous les médias organisés par série (pour les catégories de type "series")
  ipcMain.handle('movies:getSeriesData', async (event, category) => {
    try {
      console.log(`🎬 ===== DEBUT getSeriesData =====`);
      console.log(`📋 Paramètre category reçu: "${category}" (type: ${typeof category})`);
      
      // D'abord, vérifier combien de séries existent dans la base
      const seriesCount = await new Promise((resolve) => {
        db.get('SELECT COUNT(*) as count FROM series', (err, row) => {
          resolve(err ? 0 : (row ? row.count : 0));
        });
      });
      console.log(`📊 Nombre total de séries dans la base: ${seriesCount}`);

      let query;
      let params;

      if (category && category !== 'series') {
        // Filtrer par catégorie spécifique
        query = `
          SELECT 
            s.id as series_id, s.name as series_name, s.description as series_description, 
            s.poster as series_poster,
            m.id, m.title, m.path, m.thumbnail, m.duration, m.season_number, 
            m.episode_number, m.release_date, m.description
          FROM series s
          LEFT JOIN movies m ON s.id = m.series_id AND m.category = ?
          ORDER BY s.name, m.season_number, m.episode_number
        `;
        params = [category];
      } else {
        // Pour la catégorie 'series' et toutes les séries - récupérer tous les épisodes de série
        query = `
          SELECT 
            s.id as series_id, s.name as series_name, s.description as series_description, 
            s.poster as series_poster,
            m.id, m.title, m.path, m.thumbnail, m.duration, m.season_number, 
            m.episode_number, m.release_date, m.description
          FROM series s
          LEFT JOIN movies m ON s.id = m.series_id
          ORDER BY s.name, m.season_number, m.episode_number
        `;
        params = [];
      }

      console.log(`🔍 Requête getSeriesData pour catégorie "${category}":`, query);
      console.log(`📋 Paramètres:`, params);

      const rows = await new Promise((resolve) => {
        db.all(query, params, (err, rows) => {
          if (err) {
            console.error('❌ Erreur SQL dans getSeriesData:', err);
            resolve([]);
          } else {
            console.log(`📊 ${rows.length} lignes trouvées dans la base`);
            console.log('📋 Première ligne:', rows.length > 0 ? rows[0] : 'Aucune donnée');
            resolve(rows || []);
          }
        });
      });

      // Organiser par série > saison > épisode
      const seriesData = {};
      
      rows.forEach(row => {
        if (!seriesData[row.series_id]) {
          seriesData[row.series_id] = {
            id: row.series_id,
            name: row.series_name,
            description: row.series_description,
            poster: row.series_poster,
            seasons: {}
          };
        }

        // Si il y a des épisodes
        if (row.id) {
          // Gérer les épisodes sans saison définie (non triés)
          const seasonNum = row.season_number || 'unsorted';
          
          if (!seriesData[row.series_id].seasons[seasonNum]) {
            seriesData[row.series_id].seasons[seasonNum] = {
              number: seasonNum,
              name: seasonNum === 'unsorted' ? 'Non triés' : `Saison ${seasonNum}`,
              episodes: []
            };
          }

          seriesData[row.series_id].seasons[seasonNum].episodes.push({
            id: row.id,
            title: row.title,
            path: row.path,
            thumbnail: row.thumbnail,
            duration: row.duration,
            episode_number: row.episode_number || null,
            release_date: row.release_date,
            description: row.description
          });
        }
      });

      // Convertir en tableau et trier les épisodes
      const series = Object.values(seriesData).map(serie => ({
        ...serie,
        seasons: Object.values(serie.seasons).map(season => ({
          ...season,
          episodes: season.number === 'unsorted' 
            ? season.episodes.sort((a, b) => (a.title || '').localeCompare(b.title || ''))  // Tri par titre pour non triés
            : season.episodes.sort((a, b) => (a.episode_number || 1) - (b.episode_number || 1))  // Tri par numéro d'épisode
        })).sort((a, b) => {
          // Mettre "unsorted" à la fin
          if (a.number === 'unsorted') return 1;
          if (b.number === 'unsorted') return -1;
          return a.number - b.number;
        })
      }));

      console.log(`✅ getSeriesData retourne ${series.length} série(s) organisée(s)`);
      console.log('📋 Séries détaillées:', series.map(s => ({ name: s.name, seasons: Object.keys(s.seasons).length })));

      return { success: true, series: series };
    } catch (error) {
      console.error('Erreur lors de la récupération des données de série:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Créer une nouvelle série
  ipcMain.handle('series:create', async (event, seriesData) => {
    try {
      const { name, description, poster } = seriesData;
      
      const result = await new Promise((resolve) => {
        db.run('INSERT INTO series (name, description, poster) VALUES (?, ?, ?)', [name, description, poster], function(err) {
          resolve(err ? { success: false, error: err } : { success: true, id: this.lastID });
        });
      });

      if (!result.success) {
        return { success: false, message: 'Erreur lors de la création de la série' };
      }

      console.log(`Nouvelle série créée: ${name}`);
      return { success: true, id: result.id, name, description, poster };
    } catch (error) {
      console.error('Erreur lors de la création de la série:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Obtenir les films par catégorie
  ipcMain.handle('movies:getByCategory', async (event, category) => {
    try {
      let query = 'SELECT * FROM movies';
      let params = [];

      if (category && category !== 'all') {
        if (category === 'unsorted') {
          query += ' WHERE category = ? OR category IS NULL';
          params = ['unsorted'];
        } else {
          query += ' WHERE category = ?';
          params = [category];
        }
      }

      query += ' ORDER BY title';

      const movies = await new Promise((resolve) => {
        db.all(query, params, (err, rows) => {
          resolve(err ? [] : rows);
        });
      });

      return { success: true, movies: movies };
    } catch (error) {
      console.error('Erreur lors de la récupération des films par catégorie:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Scan de fichiers pour classification (sans enregistrer en base)
  ipcMain.handle('movies:scanForClassification', async (event, options) => {
    try {
      let videoFiles = [];
      let scanType = 'folder'; // Par défaut
      
      // Vérifier si on veut importer un fichier unique ou un dossier
      if (options && options.type === 'file') {
        scanType = 'file';
        // Mode fichier unique
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          title: 'Sélectionnez un fichier vidéo à ajouter',
          filters: [
            {
              name: 'Fichiers vidéo',
              extensions: SUPPORTED_FORMATS.map(ext => ext.substring(1))
            }
          ]
        });
        
        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, message: 'Aucun fichier sélectionné' };
        }
        
        videoFiles = result.filePaths;
      } else {
        scanType = 'folder';
        // Mode dossier
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
          title: 'Sélectionnez un dossier à scanner'
        });
        
        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, message: 'Aucun dossier sélectionné' };
        }
        
        const folderToScan = result.filePaths[0];
        
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
      }
      
      if (videoFiles.length === 0) {
        return { success: false, message: 'Aucun fichier vidéo trouvé' };
      }
      
      // Préparer les informations des fichiers pour la classification
      const filesInfo = await Promise.all(videoFiles.map(async (filePath, index) => {
        try {
          const stats = await fs.stat(filePath);
          const fileInfo = {
            id: `temp_${index}`,
            name: path.basename(filePath),
            title: path.basename(filePath, path.extname(filePath)),
            path: filePath,
            size: stats.size,
            format: path.extname(filePath),
            thumbnail: null,
            duration: 0,
            scanType: scanType
          };

          // Essayer d'extraire la durée avec ffprobe si disponible
          if (FFPROBE_PATH) {
            try {
              const probeCommand = `"${FFPROBE_PATH}" -v quiet -print_format json -show_format "${filePath}"`;
              const probeOutput = execSync(probeCommand, { encoding: 'utf8', timeout: 10000 });
              const probeData = JSON.parse(probeOutput);
              
              if (probeData.format && probeData.format.duration) {
                fileInfo.duration = parseFloat(probeData.format.duration);
              }
            } catch (probeError) {
              console.log('Impossible d\'obtenir la durée pour:', path.basename(filePath));
            }
          }
          
          return fileInfo;
        } catch (error) {
          console.error('Erreur lors de l\'analyse du fichier:', filePath, error);
          return null;
        }
      }));
      
      // Filtrer les fichiers valides
      const validFiles = filesInfo.filter(file => file !== null);
      
      return {
        success: true,
        files: validFiles,
        scanType: scanType,
        count: validFiles.length
      };
      
    } catch (error) {
      console.error('Erreur lors du scan pour classification:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Enregistrer un fichier classifié en base
  ipcMain.handle('movies:saveClassified', async (event, fileData) => {
    try {
      const { filePath, category, title, description, releaseDate, year, series_id, season_number, episode_number, seriesName, seriesId } = fileData;
      
      console.log('🎬 Données reçues pour saveClassified:', {
        title: title,
        category: category,
        seriesId: seriesId,
        seriesName: seriesName,
        season_number: season_number,
        episode_number: episode_number,
        series_id: series_id
      });
      
      // Vérifier si le fichier existe déjà
      const existingFile = await new Promise((resolve) => {
        db.get('SELECT id FROM movies WHERE path = ?', [filePath], (err, row) => {
          if (err) {
            console.error('Erreur lors de la vérification du fichier existant:', err);
            resolve(null);
          } else {
            resolve(row);
          }
        });
      });
      
      if (existingFile) {
        console.log('Fichier déjà existant:', filePath, 'ID:', existingFile.id);
        return { success: false, message: 'Ce fichier est déjà dans la base de données' };
      }
      
      // Gérer la série si c'est un épisode
      let finalSeriesId = series_id;
      
      // Priorité à seriesId si fourni, sinon utiliser la logique du seriesName (rétrocompatibilité)
      if (seriesId) {
        finalSeriesId = seriesId;
        console.log(`✅ Utilisation de l'ID série fourni: ${finalSeriesId}`);
      } else if (seriesName && season_number && episode_number) {
        // Ancien système : rechercher par nom (rétrocompatibilité)
        const existingSeries = await new Promise((resolve) => {
          db.get('SELECT id FROM series WHERE name = ?', [seriesName], (err, row) => {
            resolve(err ? null : row);
          });
        });
        
        if (existingSeries) {
          finalSeriesId = existingSeries.id;
          console.log(`Série "${seriesName}" trouvée avec l'ID ${finalSeriesId}`);
        } else {
          // Créer la nouvelle série
          const seriesResult = await new Promise((resolve) => {
            db.run('INSERT INTO series (name, description) VALUES (?, ?)', [seriesName, `Série: ${seriesName}`], function(err) {
              resolve(err ? { success: false, error: err } : { success: true, id: this.lastID });
            });
          });
          
          if (seriesResult.success) {
            finalSeriesId = seriesResult.id;
            console.log(`Nouvelle série "${seriesName}" créée avec l'ID ${finalSeriesId}`);
          } else {
            console.error('Erreur lors de la création de la série:', seriesResult.error);
            return { success: false, message: 'Erreur lors de la création de la série' };
          }
        }
      }

      // Préparer les données
      const movieData = {
        title: title || path.basename(filePath, path.extname(filePath)),
        path: filePath,
        format: path.extname(filePath),
        category: category || 'unsorted',
        description: description || null,
        release_date: releaseDate || (year ? `${year}-01-01` : null),
        series_id: finalSeriesId || null,
        season_number: season_number || null,
        episode_number: episode_number || null,
        last_scan: new Date().toISOString()
      };
      
      console.log('Données préparées pour insertion:', movieData);
      
      // Obtenir les infos du fichier
      try {
        const stats = await fs.stat(filePath);
        movieData.size_bytes = stats.size;
      } catch (error) {
        console.error('Impossible d\'obtenir la taille du fichier:', error);
      }
      
      // Obtenir la durée si possible
      if (FFPROBE_PATH) {
        try {
          const probeCommand = `"${FFPROBE_PATH}" -v quiet -print_format json -show_format "${filePath}"`;
          const probeOutput = execSync(probeCommand, { encoding: 'utf8', timeout: 10000 });
          const probeData = JSON.parse(probeOutput);
          
          if (probeData.format && probeData.format.duration) {
            movieData.duration = Math.round(parseFloat(probeData.format.duration));
          }
        } catch (probeError) {
          console.log('Impossible d\'obtenir la durée:', probeError.message);
        }
      }
      
      // Insérer en base
      const result = await new Promise((resolve) => {
        const query = `
          INSERT INTO movies (title, path, format, duration, size_bytes, category, description, release_date, series_id, season_number, episode_number, posterUrl, genres, year, last_scan)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
          movieData.title, movieData.path, movieData.format, movieData.duration || 0,
          movieData.size_bytes || 0, movieData.category, movieData.description,
          movieData.release_date, movieData.series_id, movieData.season_number,
          movieData.episode_number, movieData.posterUrl || null, 
          movieData.genres ? JSON.stringify(movieData.genres) : null,
          movieData.year || null, movieData.last_scan
        ];
        
        db.run(query, values, function(err) {
          if (err) {
            console.error('Erreur lors de l\'insertion:', err);
            resolve({ success: false, error: err });
          } else {
            resolve({ success: true, id: this.lastID });
          }
        });
      });
      
      if (!result.success) {
        console.error('Erreur SQLite détaillée:', result.error);
        return { success: false, message: 'Erreur SQLite: ' + (result.error?.message || result.error) };
      }
      
      if (finalSeriesId) {
        console.log(`📺 Épisode enregistré: ${movieData.title} dans la série ID ${finalSeriesId} (S${movieData.season_number}E${movieData.episode_number})`);
      } else {
        console.log(`🎬 Fichier enregistré: ${movieData.title} dans la catégorie ${movieData.category}`);
      }
      return { success: true, id: result.id };
      
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du fichier classifié:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });

  // Handler pour mettre à jour les détails d'un film
  ipcMain.handle('movies:updateDetails', async (event, movieId, updates) => {
    try {
      console.log(`🎬 Mise à jour du film ${movieId}:`, updates);
      
      // Construire la requête de mise à jour dynamiquement
      const fields = [];
      const values = [];
      
      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.category !== undefined) {
        fields.push('category = ?');
        values.push(updates.category);
      }
      if (updates.release_date !== undefined) {
        fields.push('release_date = ?');
        values.push(updates.release_date);
      }
      if (updates.year !== undefined) {
        fields.push('year = ?');
        values.push(updates.year);
      }
      if (updates.genres !== undefined) {
        fields.push('genres = ?');
        values.push(JSON.stringify(updates.genres));
      }
      if (updates.series_id !== undefined) {
        fields.push('series_id = ?');
        values.push(updates.series_id);
      }
      if (updates.season_number !== undefined) {
        fields.push('season_number = ?');
        values.push(updates.season_number);
      }
      if (updates.episode_number !== undefined) {
        fields.push('episode_number = ?');
        values.push(updates.episode_number);
      }
      if (updates.posterUrl !== undefined) {
        fields.push('posterUrl = ?');
        values.push(updates.posterUrl);
      }
      if (updates.local_poster !== undefined) {
        fields.push('local_poster = ?');
        values.push(updates.local_poster);
      }
      
      if (fields.length === 0) {
        return { success: false, message: 'Aucune mise à jour à effectuer' };
      }
      
      // Ajouter l'ID du film à la fin
      values.push(movieId);
      
      const query = `UPDATE movies SET ${fields.join(', ')} WHERE id = ?`;
      
      return new Promise((resolve) => {
        db.run(query, values, function(err) {
          if (err) {
            console.error('❌ Erreur lors de la mise à jour:', err);
            resolve({ success: false, message: 'Erreur lors de la mise à jour: ' + err.message });
          } else {
            console.log(`✅ Film ${movieId} mis à jour avec succès`);
            resolve({ success: true, message: 'Film mis à jour avec succès' });
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du film:', error);
      return { success: false, message: 'Erreur: ' + error.message };
    }
  });
}

// Les fonctions de formatage ont été supprimées car elles sont dupliquées.
// Le formatage se fait maintenant côté client avec window.formatTime() et window.formatFileSize()
// définies dans js/utils.js

// Handler pour télécharger une affiche
ipcMain.handle('movies:downloadPoster', async (event, { movieId, posterUrl }) => {
  try {
    const https = require('https');
    const http = require('http');
    const crypto = require('crypto');
    
    // Vérifier si le mode hors ligne est activé
    if (isOfflineModeEnabled()) {
      console.log('🚫 Mode hors ligne: téléchargement d\'affiches désactivé');
      return { 
        success: false, 
        message: 'Téléchargement d\'affiches désactivé en mode hors ligne',
        offline: true 
      };
    }

    console.log(`🖼️ Début téléchargement affiche pour le film ${movieId}`);
    console.log(`📥 URL: ${posterUrl}`);

    // D'abord, vérifier et ajouter la colonne local_poster si nécessaire
    await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(movies)", (err, columns) => {
        if (err) {
          console.error('❌ Erreur vérification structure table:', err);
          reject(err);
          return;
        }
        
        const hasLocalPosterColumn = columns.some(col => col.name === 'local_poster');
        console.log(`📋 Colonne local_poster existe: ${hasLocalPosterColumn}`);
        
        if (!hasLocalPosterColumn) {
          console.log(`➕ Ajout de la colonne local_poster...`);
          db.run(`ALTER TABLE movies ADD COLUMN local_poster TEXT`, (err) => {
            if (err) {
              console.error('❌ Erreur ajout colonne:', err);
              reject(err);
            } else {
              console.log('✅ Colonne local_poster ajoutée');
              resolve();
            }
          });
        } else {
          console.log('✅ Colonne local_poster déjà présente');
          resolve();
        }
      });
    });

    // Créer le dossier des affiches s'il n'existe pas - dans le dossier uploads du projet
    const postersDir = path.join(__dirname, 'uploads', 'posters');
    console.log(`📁 Dossier affiches: ${postersDir}`);
    await fs.ensureDir(postersDir);

    // Générer un nom de fichier unique
    const urlHash = crypto.createHash('md5').update(posterUrl).digest('hex').substring(0, 8);
    const extension = path.extname(posterUrl.split('?')[0]) || '.jpg';
    const filename = `poster_${movieId}_${urlHash}${extension}`;
    const localPath = path.join(postersDir, filename);
    
    console.log(`📄 Nom de fichier: ${filename}`);
    console.log(`🗂️ Chemin complet: ${localPath}`);

    // Vérifier si le fichier existe déjà
    if (await fs.pathExists(localPath)) {
      console.log(`✅ Affiche déjà téléchargée: ${localPath}`);
      
      // Mettre à jour la base de données avec le chemin local
      await new Promise((resolve, reject) => {
        db.run('UPDATE movies SET local_poster = ? WHERE id = ?', [localPath, movieId], (err) => {
          if (err) {
            console.log(`❌ Erreur BDD: ${err.message}`);
            reject(err);
          } else {
            console.log(`✅ BDD mise à jour pour le film ${movieId}`);
            resolve();
          }
        });
      });

      return { success: true, message: 'Affiche déjà téléchargée', localPath };
    }

    // Télécharger l'affiche
    console.log(`⬇️ Début du téléchargement...`);
    const downloadPromise = new Promise((resolve, reject) => {
      const requestModule = posterUrl.startsWith('https:') ? https : http;
      const file = fs.createWriteStream(localPath);
      
      console.log(`🌐 Module utilisé: ${posterUrl.startsWith('https:') ? 'HTTPS' : 'HTTP'}`);
      
      const request = requestModule.get(posterUrl, (response) => {
        console.log(`📡 Réponse HTTP: ${response.statusCode}`);
        
        if (response.statusCode !== 200) {
          console.error(`❌ Erreur HTTP: ${response.statusCode} pour ${posterUrl}`);
          fs.unlink(localPath, () => {});
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        console.log(`✅ Début écriture fichier...`);
        response.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            console.log(`🎉 Affiche téléchargée avec succès: ${localPath}`);
            resolve(localPath);
          });
        });

        file.on('error', (err) => {
          console.error(`💥 Erreur lors de l'écriture du fichier:`, err);
          fs.unlink(localPath, () => {});
          reject(err);
        });
      });

      request.on('error', (err) => {
        console.error(`🚫 Erreur lors du téléchargement:`, err);
        fs.unlink(localPath, () => {});
        reject(err);
      });

      request.setTimeout(30000, () => {
        console.error(`⏰ Timeout lors du téléchargement de l'affiche`);
        request.destroy();
        fs.unlink(localPath, () => {});
        reject(new Error('Timeout'));
      });
    });

    await downloadPromise;
    console.log(`💾 Téléchargement terminé, mise à jour BDD...`);

    // Mettre à jour la base de données avec le chemin local
    await new Promise((resolve, reject) => {
      db.run('UPDATE movies SET local_poster = ? WHERE id = ?', [localPath, movieId], (err) => {
        if (err) {
          console.log(`❌ Erreur mise à jour BDD: ${err.message}`);
          reject(err);
        } else {
          console.log(`✅ BDD mise à jour avec succès pour le film ${movieId}`);
          resolve();
        }
      });
    });

    console.log(`🎯 Succès complet ! Affiche sauvée: ${localPath}`);
    return { success: true, message: 'Affiche téléchargée avec succès', localPath };

  } catch (error) {
    console.error(`💥 ERREUR GLOBALE:`, error);
    console.error(`📍 Stack:`, error.stack);
    return { success: false, message: `Erreur lors du téléchargement de l'affiche: ${error.message}` };
  }
});