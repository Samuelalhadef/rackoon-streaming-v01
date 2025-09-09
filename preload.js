/**
 * Script de préchargement pour Electron - version simplifiée
 * Fait le pont entre le processus principal et le processus de rendu
 */
const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions protégées à la fenêtre du navigateur
contextBridge.exposeInMainWorld('electronAPI', {
  // Films - APIs avec stockage JSON
  scanMovies: (options) => ipcRenderer.invoke('movies:scan', options),
  scanSingleMovie: () => ipcRenderer.invoke('movies:scanSingle'),
  getAllMovies: () => ipcRenderer.invoke('movies:getAll'),
  getMoviePath: (moviePath) => ipcRenderer.invoke('movies:getPath', moviePath),
  getMovieDetails: (movieId) => ipcRenderer.invoke('movies:getDetails', movieId),
  updateMovie: (movieId, updates) => ipcRenderer.invoke('movies:update', movieId, updates),
  openMovieFolder: (moviePath) => ipcRenderer.invoke('movies:openFolder', moviePath),
  checkFileExists: (filePath) => ipcRenderer.invoke('files:exists', filePath),
  downloadTMDBImage: (imageUrl, movieTitle) => ipcRenderer.invoke('movies:downloadTMDBImage', imageUrl, movieTitle),
  updateMoviesMetadata: () => ipcRenderer.invoke('movies:updateMetadata'),
  
  // APIs pour informations vidéo
  getVideoInfo: (filePath) => ipcRenderer.invoke('video:getInfo', filePath),
  extractSubtitle: (videoPath, trackIndex) => ipcRenderer.invoke('video:extractSubtitle', videoPath, trackIndex),
  readSubtitleFile: (subtitlePath) => ipcRenderer.invoke('video:readSubtitleFile', subtitlePath),
  
  // APIs temporaires pour éviter les erreurs
  getAllCategories: () => Promise.resolve({ success: true, categories: [] }),
  getAllSeries: () => Promise.resolve({ success: true, series: [] }),
  
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