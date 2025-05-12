// Contrôleur pour gérer les fonctionnalités d'authentification
const User = require('../models/user');

const AuthController = {
  // Inscription d'un nouvel utilisateur
  register: (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    // Vérification des données reçues
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont obligatoires' 
      });
    }
    
    // Vérification que les mots de passe correspondent
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Les mots de passe ne correspondent pas' 
      });
    }
    
    // Création de l'utilisateur
    User.create({ username, email, password }, (err, user) => {
      if (err) {
        console.error('Erreur lors de la création de l\'utilisateur:', err.message);
        
        // Gestion des erreurs de duplications (email ou nom d'utilisateur déjà utilisé)
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ 
            success: false, 
            message: 'Cet utilisateur ou cet email existe déjà' 
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur lors de la création de l\'utilisateur' 
        });
      }
      
      // Utilisateur créé avec succès
      res.status(201).json({ 
        success: true, 
        message: 'Utilisateur créé avec succès', 
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  },
  
  // Connexion d'un utilisateur
  login: (req, res) => {
    const { username, password } = req.body;
    
    // Vérification des données reçues
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }
    
    // Authentification de l'utilisateur
    User.authenticate(username, password, (err, user, info) => {
      if (err) {
        console.error('Erreur lors de l\'authentification:', err.message);
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur lors de l\'authentification' 
        });
      }
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: info.message || 'Identifiants incorrects' 
        });
      }
      
      // Stocker l'utilisateur dans la session
      req.session.user = user;
      
      // Utilisateur connecté avec succès
      res.status(200).json({ 
        success: true, 
        message: 'Connexion réussie', 
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  },
  
  // Déconnexion d'un utilisateur
  logout: (req, res) => {
    // Supprimer la session
    req.session.destroy((err) => {
      if (err) {
        console.error('Erreur lors de la déconnexion:', err.message);
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur lors de la déconnexion' 
        });
      }
      
      // Utilisateur déconnecté avec succès
      res.status(200).json({ 
        success: true, 
        message: 'Déconnexion réussie' 
      });
    });
  },
  
  // Vérification de l'état d'authentification
  checkAuth: (req, res) => {
    if (req.session.user) {
      return res.status(200).json({ 
        authenticated: true, 
        user: req.session.user 
      });
    }
    
    res.status(200).json({ 
      authenticated: false 
    });
  },
  
  // Middleware pour protéger les routes nécessitant une authentification
  ensureAuthenticated: (req, res, next) => {
    if (req.session.user) {
      return next();
    }
    
    res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
};

module.exports = AuthController;