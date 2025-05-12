// Modèle pour gérer les utilisateurs dans la base de données
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const config = require('../config');

// Connexion à la base de données
const db = new sqlite3.Database(config.database.path, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données:', err.message);
  } else {
    console.log('Connexion à la base de données SQLite établie');
    // Création de la table utilisateurs si elle n'existe pas
    createUsersTable();
  }
});

// Création de la table des utilisateurs
function createUsersTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table users:', err.message);
    } else {
      console.log('Table users créée ou déjà existante');
    }
  });
}

// Méthodes du modèle User
const User = {
  // Créer un nouvel utilisateur
  create: (userData, callback) => {
    // Hachage du mot de passe
    bcrypt.hash(userData.password, config.auth.saltRounds, (err, hash) => {
      if (err) {
        return callback(err);
      }
      
      // Insertion de l'utilisateur dans la base de données
      const query = `
        INSERT INTO users (username, email, password)
        VALUES (?, ?, ?)
      `;
      
      db.run(query, [userData.username, userData.email, hash], function(err) {
        if (err) {
          return callback(err);
        }
        callback(null, { id: this.lastID, username: userData.username, email: userData.email });
      });
    });
  },
  
  // Trouver un utilisateur par son nom d'utilisateur
  findByUsername: (username, callback) => {
    const query = 'SELECT * FROM users WHERE username = ?';
    
    db.get(query, [username], (err, user) => {
      if (err) {
        return callback(err);
      }
      callback(null, user);
    });
  },
  
  // Vérifier les identifiants d'un utilisateur
  authenticate: (username, password, callback) => {
    User.findByUsername(username, (err, user) => {
      if (err) {
        return callback(err);
      }
      
      if (!user) {
        return callback(null, false, { message: 'Utilisateur introuvable' });
      }
      
      // Comparaison du mot de passe
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          return callback(err);
        }
        
        if (!isMatch) {
          return callback(null, false, { message: 'Mot de passe incorrect' });
        }
        
        // Suppression du mot de passe avant de renvoyer l'utilisateur
        const userWithoutPassword = {
          id: user.id,
          username: user.username,
          email: user.email,
          created_at: user.created_at
        };
        
        callback(null, userWithoutPassword);
      });
    });
  }
};

module.exports = User;