// Script de préchargement pour Electron
const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions API au processus de rendu
contextBridge.exposeInMainWorld('electronAPI', {
  // Gestion des utilisateurs
  register: (userData) => ipcRenderer.invoke('user:register', userData),
  login: (credentials) => ipcRenderer.invoke('user:login', credentials),
  
  // Gestion des films
  scanMovies: (options) => ipcRenderer.invoke('movies:scan', options),
  getAllMovies: () => ipcRenderer.invoke('movies:getAll'),
  getMoviePath: (movieId) => ipcRenderer.invoke('movies:getPath', movieId),
  
  // Écouteurs d'événements
  onScanStatus: (callback) => {
    ipcRenderer.on('scan:status', (event, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('scan:status');
  }
});