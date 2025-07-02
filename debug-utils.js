// Utilitaires de débogage pour Film Finder
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

// Activer le mode débogage
const DEBUG = true;

// Chemin pour les fichiers de log
const logDir = path.join(app.getPath('userData'), 'logs');
const logFilePath = path.join(logDir, `filmfinder-${new Date().toISOString().replace(/:/g, '-')}.log`);

// Initialiser le dossier de logs
function initLogs() {
  if (DEBUG) {
    try {
      fs.ensureDirSync(logDir);
      
      // Supprimer les anciens fichiers de log (garder seulement les 5 derniers)
      const files = fs.readdirSync(logDir);
      if (files.length > 5) {
        files
          .map(file => ({ file, time: fs.statSync(path.join(logDir, file)).mtime.getTime() }))
          .sort((a, b) => a.time - b.time)
          .slice(0, files.length - 5)
          .forEach(file => fs.unlinkSync(path.join(logDir, file.file)));
      }
      
      // Créer un nouveau fichier de log
      fs.writeFileSync(logFilePath, `=== Film Finder Logs - ${new Date().toISOString()} ===\n\n`);
      
      console.log(`Mode débogage activé. Logs écrits dans: ${logFilePath}`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des logs:', error);
    }
  }
}

// Écrire un message dans le fichier de log
function log(message, data = null) {
  if (!DEBUG) return;
  
  try {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        try {
          logMessage += '\n' + JSON.stringify(data, null, 2);
        } catch (e) {
          logMessage += '\n[Objet non sérialisable]';
        }
      } else {
        logMessage += '\n' + data;
      }
    }
    
    logMessage += '\n\n';
    
    fs.appendFileSync(logFilePath, logMessage);
  } catch (error) {
    console.error('Erreur lors de l\'écriture des logs:', error);
  }
}

// Enregistrer une erreur
function logError(context, error) {
  if (!DEBUG) return;
  
  try {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ERROR - ${context}\n`;
    
    logMessage += `Message: ${error.message}\n`;
    logMessage += `Stack: ${error.stack || 'No stack trace'}\n\n`;
    
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    console.error('Erreur lors de l\'écriture des logs d\'erreur:', err);
  }
}

module.exports = {
  initLogs,
  log,
  logError,
  DEBUG
};