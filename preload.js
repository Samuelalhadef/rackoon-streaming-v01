/**
 * Script de préchargement pour Electron - version simplifiée
 * Fait le pont entre le processus principal et le processus de rendu
 */
const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions protégées à la fenêtre du navigateur
contextBridge.exposeInMainWorld('electronAPI', {
  // Médias - APIs avec stockage JSON
  scanMedias: (options) => ipcRenderer.invoke('medias:scan', options),
  scanMediasLight: (folderPath) => ipcRenderer.invoke('medias:scan-light', folderPath),
  scanSingleMedia: () => ipcRenderer.invoke('medias:scanSingle'),
  getAllMedias: () => ipcRenderer.invoke('medias:getAll'),
  getMediaPath: (mediaPath) => ipcRenderer.invoke('medias:getPath', mediaPath),
  getMediaDetails: (mediaId) => ipcRenderer.invoke('medias:getDetails', mediaId),
  updateMedia: (mediaId, updates) => ipcRenderer.invoke('medias:update', mediaId, updates),
  deleteMedia: (mediaId) => ipcRenderer.invoke('medias:delete', mediaId),
  clearAllMedias: () => ipcRenderer.invoke('medias:clearAll'),
  playMedia: (mediaId) => ipcRenderer.invoke('medias:play', mediaId),
  getMediaStats: () => ipcRenderer.invoke('medias:getStats'),
  saveClassifiedFile: (fileData) => ipcRenderer.invoke('medias:saveClassified', fileData),
  isFileAlreadyImported: (filePath) => ipcRenderer.invoke('medias:isFileAlreadyImported', filePath),
  openMediaFolder: (mediaPath) => ipcRenderer.invoke('medias:openFolder', mediaPath),
  checkFileExists: (filePath) => ipcRenderer.invoke('files:exists', filePath),
  downloadTMDBImage: (imageUrl, mediaTitle) => ipcRenderer.invoke('medias:downloadTMDBImage', imageUrl, mediaTitle),
  updateMediasMetadata: () => ipcRenderer.invoke('medias:updateMetadata'),
  
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
  cleanupCorruptedSeries: () => ipcRenderer.invoke('series:cleanupCorrupted'),

  // APIs pour le système de tags
  migrateTags: () => ipcRenderer.invoke('tags:migrate'),
  getAllTags: () => ipcRenderer.invoke('tags:getAll'),
  addCustomTag: (tagName) => ipcRenderer.invoke('tags:addCustom', tagName),
  removeCustomTag: (tagName) => ipcRenderer.invoke('tags:removeCustom', tagName),
  addTagsToMedia: (mediaId, tags, tagType) => ipcRenderer.invoke('tags:addToMedia', mediaId, tags, tagType),
  removeTagsFromMedia: (mediaId, tags, tagType) => ipcRenderer.invoke('tags:removeFromMedia', mediaId, tags, tagType),
  searchMediasByTags: (searchTags, operator) => ipcRenderer.invoke('tags:searchMedias', searchTags, operator),
  getTagSuggestions: (query, limit) => ipcRenderer.invoke('tags:getSuggestions', query, limit),
  
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