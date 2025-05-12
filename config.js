// Configuration principale de l'application
const path = require('path');

module.exports = {
  // Configuration du serveur
  server: {
    port: 3000,
    host: 'localhost'
  },
  
  // Configuration de la base de données
  database: {
    path: path.join(__dirname, 'database.sqlite')
  },
  
  // Configuration de l'authentification
  auth: {
    sessionSecret: 'votre-clé-secrète-pour-les-sessions',
    saltRounds: 10 // Nombre de tours pour le hachage des mots de passe
  },
  
  // Configuration des fichiers vidéo
  video: {
    minDurationInMinutes: 15, // Durée minimale en minutes pour qu'un fichier soit considéré comme un film
    supportedFormats: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'] // Formats de fichiers vidéo supportés
  },
  
  // Configuration des chemins
  paths: {
    uploads: path.join(__dirname, 'uploads')
  }
};