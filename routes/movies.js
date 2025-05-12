// Routes pour la gestion des films
const express = require('express');
const router = express.Router();
const MovieController = require('../controllers/movieController');
const AuthController = require('../controllers/authController');

// Middleware pour vérifier l'authentification avant d'accéder aux routes
router.use(AuthController.ensureAuthenticated);

// Route pour obtenir tous les films
router.get('/', MovieController.getAllMovies);

// Route pour lancer une recherche de films sur un lecteur spécifique
router.post('/scan', MovieController.scanDrive);

// Route pour diffuser un film
router.get('/stream/:id', MovieController.streamMovie);

module.exports = router;