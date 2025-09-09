/**
 * Script de préchargement pour Electron - version simplifiée
 * Fait le pont entre le processus principal et le processus de rendu
 */
const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions protégées à la fenêtre du navigateur
contextBridge.exposeInMainWorld('electronAPI', {
  // Films - APIs simplifiées
  scanMovies: (options) => ipcRenderer.invoke('movies:scan', options),
  getAllMovies: () => ipcRenderer.invoke('movies:getAll'),
  getMoviePath: (moviePath) => ipcRenderer.invoke('movies:getPath', moviePath),
  openMovieFolder: (moviePath) => ipcRenderer.invoke('movies:openFolder', moviePath),
  checkFileExists: (filePath) => ipcRenderer.invoke('files:exists', filePath),
  
  // Événements
  onScanStatus: (callback) => {
    // Création d'un canal sécurisé pour recevoir l'état du scan
    const scanStatusHandler = (event, status) => callback(status);
    ipcRenderer.on('scan:status', scanStatusHandler);
    
    // Retourner une fonction de nettoyage
    return () => {
      ipcRenderer.removeListener('scan:status', scanStatusHandler);
    };
  }
});

console.log('Preload script chargé - version simplifiée');