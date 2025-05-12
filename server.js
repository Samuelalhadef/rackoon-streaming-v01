// Fichier principal du serveur
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config');

// Création de l'application Express
const app = express();

// Middleware pour analyser les requêtes JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration de la session
app.use(session({
  secret: config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Mettre à true en production avec HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Création du dossier uploads s'il n'existe pas
fs.ensureDirSync(config.paths.uploads);

// Routes de l'API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/movies', require('./routes/movies'));

// Routes pour les pages HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  // Vérifier si l'utilisateur est connecté
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Route par défaut pour les erreurs 404
app.use((req, res) => {
  res.status(404).send('Page non trouvée');
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Erreur serveur');
});

// Démarrage du serveur
app.listen(config.server.port, config.server.host, () => {
  console.log(`Serveur démarré sur http://${config.server.host}:${config.server.port}`);
});