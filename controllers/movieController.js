// Contrôleur pour gérer les fonctionnalités de recherche et de gestion des films
const Movie = require('../models/movie');
const config = require('../config');
const path = require('path');
const fs = require('fs-extra');
const { promisify } = require('util');
const childProcess = require('child_process');
const exec = promisify(childProcess.exec);

const MovieController = {
  // Obtenir tous les films en base de données
  getAllMovies: (req, res) => {
    Movie.getAll((err, movies) => {
      if (err) {
        console.error('Erreur lors de la récupération des films:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des films'
        });
      }
      
      // Les données seront formatées côté client avec window.formatTime() et window.formatFileSize()
      // Le formatage se fait maintenant côté client avec window.formatTime() et window.formatFileSize()
      const formattedMovies = movies.map(movie => {
        return {
          ...movie
        };
      });
      
      res.status(200).json({
        success: true,
        count: movies.length,
        movies: formattedMovies
      });
    });
  },
  
  // Lancer une recherche de films sur un lecteur spécifique
  scanDrive: async (req, res) => {
    const { drivePath } = req.body;
    
    if (!drivePath || !fs.existsSync(drivePath)) {
      return res.status(400).json({
        success: false,
        message: 'Chemin de lecteur invalide ou inaccessible'
      });
    }
    
    try {
      // Informer le client que la recherche a commencé
      res.status(200).json({
        success: true,
        message: 'Recherche de films démarrée. Cela peut prendre du temps...'
      });
      
      // Lancer le processus de recherche de manière asynchrone
      // Note: La réponse a déjà été envoyée, donc ce processus s'exécute en arrière-plan
      await scanDirectoryForMovies(drivePath);
      
      console.log('Recherche de films terminée avec succès');
    } catch (error) {
      console.error('Erreur lors de la recherche de films:', error.message);
    }
  },
  
  // Récupérer un film pour le visionner
  streamMovie: (req, res) => {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID du film requis'
      });
    }
    
    // Récupérer le film depuis la base de données
    db.get('SELECT * FROM movies WHERE id = ?', [id], (err, movie) => {
      if (err) {
        console.error('Erreur lors de la récupération du film:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération du film'
        });
      }
      
      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Film non trouvé'
        });
      }
      
      // Vérifier que le fichier existe toujours
      if (!fs.existsSync(movie.path)) {
        return res.status(404).json({
          success: false,
          message: 'Fichier vidéo introuvable sur le disque'
        });
      }
      
      // Obtenir la taille du fichier
      const stat = fs.statSync(movie.path);
      const fileSize = stat.size;
      
      // Récupérer la plage de lecture (si requête de streaming partiell)
      const range = req.headers.range;
      
      if (range) {
        // Analyser la plage de lecture
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        // Créer un flux de lecture pour la plage spécifiée
        const fileStream = fs.createReadStream(movie.path, { start, end });
        
        // Définir les en-têtes pour la lecture en streaming
        const headers = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': `video/${movie.format}`
        };
        
        // Envoyer le contenu partiel
        res.writeHead(206, headers);
        fileStream.pipe(res);
      } else {
        // Définir les en-têtes pour la lecture complète
        const headers = {
          'Content-Length': fileSize,
          'Content-Type': `video/${movie.format}`
        };
        
        // Envoyer le fichier complet
        res.writeHead(200, headers);
        fs.createReadStream(movie.path).pipe(res);
      }
    });
  }
};

// Fonctions utilitaires

// Les fonctions formatDuration et formatFileSize ont été supprimées car elles sont dupliquées.
// Le formatage se fait maintenant côté client avec window.formatTime() et window.formatFileSize()
// définies dans js/utils.js

// Fonction récursive pour scanner un répertoire à la recherche de films
async function scanDirectoryForMovies(directoryPath) {
  try {
    // Obtenir tous les fichiers et dossiers dans le répertoire
    const items = await fs.readdir(directoryPath);
    
    // Parcourir chaque élément
    for (const item of items) {
      const itemPath = path.join(directoryPath, item);
      
      try {
        // Obtenir les statistiques de l'élément
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          // Si c'est un dossier, continuer la recherche de manière récursive
          await scanDirectoryForMovies(itemPath);
        } else if (stats.isFile()) {
          // Si c'est un fichier, vérifier si c'est potentiellement un film
          const extension = path.extname(itemPath).toLowerCase();
          
          if (config.video.supportedFormats.includes(extension)) {
            // Chercher si le film existe déjà dans la base de données
            Movie.findByPath(itemPath, async (err, existingMovie) => {
              if (err) {
                console.error(`Erreur lors de la recherche du film ${itemPath} dans la base de données:`, err.message);
                return;
              }
              
              if (existingMovie) {
                // Le film existe déjà, mettre à jour les informations si nécessaire
                console.log(`Film déjà en base: ${itemPath}`);
                return;
              }
              
              try {
                // Analyser le fichier vidéo pour extraire les métadonnées
                Movie.analyzeVideoFile(itemPath, (err, movieData) => {
                  if (err) {
                    console.error(`Erreur lors de l'analyse de ${itemPath}:`, err.message);
                    return;
                  }
                  
                  // Ajouter le film à la base de données
                  Movie.create(movieData, (err, movie) => {
                    if (err) {
                      console.error(`Erreur lors de l'ajout du film ${itemPath} à la base de données:`, err.message);
                      return;
                    }
                    
                    console.log(`Nouveau film ajouté: ${movie.title}`);
                  });
                });
              } catch (error) {
                console.error(`Erreur lors du traitement du fichier ${itemPath}:`, error.message);
              }
            });
          }
        }
      } catch (error) {
        console.error(`Erreur lors du traitement de ${itemPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la lecture du répertoire ${directoryPath}:`, error.message);
  }
}

module.exports = MovieController;