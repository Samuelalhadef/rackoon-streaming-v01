/**
 * Script de préchargement pour Electron - version simplifiée
 * Fait le pont entre le processus principal et le processus de rendu
 */
const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions protégées à la fenêtre du navigateur
contextBridge.exposeInMainWorld('electronAPI', {
  // Contrôles fenêtre
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // Médias - APIs avec stockage JSON
  scanMediasLight: (folderPath) => ipcRenderer.invoke('medias:scan-light', folderPath),
  scanMediasFromPaths: (paths) => ipcRenderer.invoke('medias:scan-paths', paths),
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
  openMediaFolder: (mediaPath) => ipcRenderer.invoke('medias:openFolder', mediaPath),
  checkFileExists: (filePath) => ipcRenderer.invoke('files:exists', filePath),
  downloadTMDBImage: (imageUrl, mediaTitle) => ipcRenderer.invoke('medias:downloadTMDBImage', imageUrl, mediaTitle),
  savePosterLocal: (sourcePath, mediaTitle) => ipcRenderer.invoke('medias:savePosterLocal', sourcePath, mediaTitle),
  generateThumbnail: (mediaId) => ipcRenderer.invoke('medias:generateThumbnail', mediaId),

  // APIs pour informations vidéo
  getVideoInfo: (filePath) => ipcRenderer.invoke('video:getInfo', filePath),
  extractSubtitle: (videoPath, trackIndex) => ipcRenderer.invoke('video:extractSubtitle', videoPath, trackIndex),
  readSubtitleFile: (subtitlePath) => ipcRenderer.invoke('video:readSubtitleFile', subtitlePath),
  checkConvertedAudio: (videoPath, transcodeVideo) => ipcRenderer.invoke('video:checkConvertedAudio', videoPath, transcodeVideo),
  preConvertAudio: (videoPath, transcodeVideo, audioTracks) => ipcRenderer.invoke('video:preConvertAudio', videoPath, transcodeVideo, audioTracks),
  onConversionProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('video:conversionProgress', handler);
    return () => ipcRenderer.removeListener('video:conversionProgress', handler);
  },
  
  // APIs temporaires pour éviter les erreurs
  getAllCategories: () => Promise.resolve({ success: true, categories: [] }),

  // APIs pour la gestion des séries
  createSeries: (seriesData) => ipcRenderer.invoke('series:create', seriesData),
  getAllSeries: () => ipcRenderer.invoke('series:getAll'),
  getSeriesById: (seriesId) => ipcRenderer.invoke('series:getById', seriesId),
  updateSeries: (seriesId, updates) => ipcRenderer.invoke('series:update', seriesId, updates),
  deleteSeries: (seriesId) => ipcRenderer.invoke('series:delete', seriesId),
  cleanupCorruptedSeries: () => ipcRenderer.invoke('series:cleanupCorrupted'),

  // APIs pour la gestion des saisons
  getSeriesSeasons: (seriesId) => ipcRenderer.invoke('seasons:get', seriesId),
  saveSeriesSeasons: (seriesId, seasons) => ipcRenderer.invoke('seasons:save', seriesId, seasons),

  // APIs pour la gestion des personnes
  getAllPersons: () => ipcRenderer.invoke('persons:getAll'),
  getPersonById: (personId) => ipcRenderer.invoke('persons:getById', personId),
  getPersonByTmdbId: (tmdbId) => ipcRenderer.invoke('persons:getByTmdbId', tmdbId),
  addPerson: (personData) => ipcRenderer.invoke('persons:add', personData),
  updatePerson: (personId, updates) => ipcRenderer.invoke('persons:update', personId, updates),
  deletePerson: (personId) => ipcRenderer.invoke('persons:delete', personId),
  linkPersonToMedia: (personId, mediaId, mediaType, role, character) => ipcRenderer.invoke('persons:link', personId, mediaId, mediaType, role, character),
  unlinkPersonFromMedia: (personId, mediaId, role) => ipcRenderer.invoke('persons:unlink', personId, mediaId, role),
  getPersonsForMedia: (mediaId) => ipcRenderer.invoke('persons:forMedia', mediaId),
  searchPersons: (query) => ipcRenderer.invoke('persons:search', query),
  downloadPersonPhoto: (imageUrl, personName) => ipcRenderer.invoke('persons:downloadPhoto', imageUrl, personName),

  // APIs pour les préférences utilisateur
  getUserPrefs: () => ipcRenderer.invoke('userPrefs:get'),
  updateRating: (mediaId, rating) => ipcRenderer.invoke('userPrefs:updateRating', mediaId, rating),

  // APIs Watch Party
  createWatchParty: (videoInfo) => ipcRenderer.invoke('watchparty:create', videoInfo),
  joinWatchParty: (code) => ipcRenderer.invoke('watchparty:join', code),
  leaveWatchParty: (sessionId) => ipcRenderer.invoke('watchparty:leave', sessionId),

  // APIs Ngrok (partage en ligne)
  startNgrok: () => ipcRenderer.invoke('ngrok:start'),
  stopNgrok: () => ipcRenderer.invoke('ngrok:stop'),
  getShareLink: (sessionCode) => ipcRenderer.invoke('ngrok:getShareLink', sessionCode),

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