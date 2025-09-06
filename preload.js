/**
 * Script de préchargement pour Electron
 * Fait le pont entre le processus principal et le processus de rendu
 */
const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions protégées à la fenêtre du navigateur
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentification
  login: (credentials) => ipcRenderer.invoke('user:login', credentials),
  register: (userData) => ipcRenderer.invoke('user:register', userData),
  
  // Films
  scanMovies: (options) => ipcRenderer.invoke('movies:scan', options),
  getAllMovies: () => ipcRenderer.invoke('movies:getAll'),
  getMoviePath: (movieId) => ipcRenderer.invoke('movies:getPath', movieId),
  getMovieDetails: (movieId) => ipcRenderer.invoke('movies:getDetails', movieId),
  openMovieFolder: (movieId) => ipcRenderer.invoke('movies:openFolder', movieId),
  generateThumbnail: (movieId) => ipcRenderer.invoke('movies:generateThumbnail', movieId),
  generateAllThumbnails: () => ipcRenderer.invoke('movies:generateAllThumbnails'),
  deleteMovie: (movieId) => ipcRenderer.invoke('movies:delete', movieId),
  getMovieStats: () => ipcRenderer.invoke('movies:getStats'),
  checkFileExists: (filePath) => ipcRenderer.invoke('files:exists', filePath),
  
  // Classification et import avancé
  scanForClassification: (options) => ipcRenderer.invoke('movies:scanForClassification', options),
  saveClassifiedFile: (fileData) => ipcRenderer.invoke('movies:saveClassified', fileData),
  
  // Catégories
  getAllCategories: () => ipcRenderer.invoke('categories:getAll'),
  createCategory: (categoryData) => ipcRenderer.invoke('categories:create', categoryData),
  getMoviesByCategory: (category) => ipcRenderer.invoke('movies:getByCategory', category),
  
  // Séries
  getAllSeries: () => ipcRenderer.invoke('series:getAll'),
  createSeries: (seriesData) => ipcRenderer.invoke('series:create', seriesData),
  getSeriesData: (category) => ipcRenderer.invoke('movies:getSeriesData', category),
  
  // Affiches
  downloadPoster: (data) => ipcRenderer.invoke('movies:downloadPoster', data),
  
  // Événements
  onScanStatus: (callback) => {
    // Création d'un canal sécurisé pour recevoir l'état du scan
    const scanStatusHandler = (event, status) => callback(status);
    ipcRenderer.on('scan:status', scanStatusHandler);
    
    // Retourner une fonction pour annuler l'abonnement
    return () => {
      ipcRenderer.removeListener('scan:status', scanStatusHandler);
    };
  }
});

console.log('Préchargement terminé');