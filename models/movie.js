// Modèle pour gérer les métadonnées des films dans la base de données
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Connexion à la base de données
const db = new sqlite3.Database(config.database.path, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données:', err.message);
  } else {
    console.log('Connexion à la base de données SQLite établie pour les films');
    // Création de la table movies si elle n'existe pas
    createMoviesTable();
  }
});

// Création de la table des films
function createMoviesTable() {
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
  `, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table movies:', err.message);
    } else {
      console.log('Table movies créée ou déjà existante');
    }
  });
}

// Méthodes du modèle Movie
const Movie = {
  // Ajouter un nouveau film
  create: (movieData, callback) => {
    const query = `
      INSERT INTO movies (title, path, format, duration, size_bytes, thumbnail, last_scan)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [
      movieData.title,
      movieData.path,
      movieData.format,
      movieData.duration,
      movieData.size_bytes,
      movieData.thumbnail
    ], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, { id: this.lastID, ...movieData });
    });
  },
  
  // Mettre à jour un film existant
  update: (id, movieData, callback) => {
    const query = `
      UPDATE movies
      SET title = ?, format = ?, duration = ?, size_bytes = ?, thumbnail = ?, last_scan = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [
      movieData.title,
      movieData.format,
      movieData.duration,
      movieData.size_bytes,
      movieData.thumbnail,
      id
    ], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, { id, ...movieData });
    });
  },
  
  // Trouver un film par son chemin
  findByPath: (filePath, callback) => {
    const query = 'SELECT * FROM movies WHERE path = ?';
    
    db.get(query, [filePath], (err, movie) => {
      if (err) {
        return callback(err);
      }
      callback(null, movie);
    });
  },
  
  // Récupérer tous les films
  getAll: (callback) => {
    const query = 'SELECT * FROM movies ORDER BY title';
    
    db.all(query, [], (err, movies) => {
      if (err) {
        return callback(err);
      }
      callback(null, movies);
    });
  },
  
  // Analyser un fichier vidéo pour extraire les métadonnées
  analyzeVideoFile: (filePath, callback) => {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return callback(new Error(`Le fichier ${filePath} n'existe pas`));
    }
    
    // Obtenir les statistiques du fichier
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, fileExtension);
    
    // Vérifier si c'est un format vidéo supporté
    if (!config.video.supportedFormats.includes(fileExtension)) {
      return callback(new Error(`Format de fichier non supporté: ${fileExtension}`));
    }
    
    // Utiliser ffmpeg pour obtenir la durée de la vidéo
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return callback(err);
      }
      
      // Extraire la durée en secondes
      const durationInSeconds = metadata.format.duration || 0;
      
      // Si la durée est inférieure à la durée minimale configurée, ignorer le fichier
      if (durationInSeconds < (config.video.minDurationInMinutes * 60)) {
        return callback(new Error(`Le fichier vidéo est trop court: ${durationInSeconds} secondes`));
      }
      
      // Générer un nom pour la miniature
      const thumbnailName = `${Date.now()}_${path.basename(filePath)}.jpg`;
      const thumbnailPath = path.join(config.paths.uploads, thumbnailName);
      
      // Générer une miniature pour le film
      ffmpeg(filePath)
        .screenshots({
          count: 1,
          folder: config.paths.uploads,
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
          
          callback(null, movieData);
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
          
          callback(null, movieData);
        });
    });
  }
};

module.exports = Movie;