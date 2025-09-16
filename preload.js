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
  deleteMovie: (movieId) => ipcRenderer.invoke('movies:delete', movieId),
  playMovie: (movieId) => ipcRenderer.invoke('movies:play', movieId),
  getMovieStats: () => ipcRenderer.invoke('movies:getStats'),
  saveClassifiedFile: (fileData) => ipcRenderer.invoke('movies:saveClassified', fileData),
  isFileAlreadyImported: (filePath) => ipcRenderer.invoke('movies:isFileAlreadyImported', filePath),
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

  // APIs pour la gestion des séries
  createSeries: (seriesData) => ipcRenderer.invoke('series:create', seriesData),
  getAllSeries: () => ipcRenderer.invoke('series:getAll'),
  getSeriesById: (seriesId) => ipcRenderer.invoke('series:getById', seriesId),
  updateSeries: (seriesId, updates) => ipcRenderer.invoke('series:update', seriesId, updates),
  deleteSeries: (seriesId) => ipcRenderer.invoke('series:delete', seriesId),
  
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