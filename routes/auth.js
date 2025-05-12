// Routes pour l'authentification
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// Route d'inscription
router.post('/register', AuthController.register);

// Route de connexion
router.post('/login', AuthController.login);

// Route de déconnexion
router.post('/logout', AuthController.logout);

// Route pour vérifier l'état d'authentification
router.get('/check', AuthController.checkAuth);

module.exports = router;