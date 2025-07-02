// Analyse de fichiers vidéo pour Film Finder
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { app } = require('electron');
const { log, logError } = require('./debug-utils');

// Formats de fichiers vidéo supportés
const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];

// Configurer ffmpeg avec les chemins appropriés
function configureFfmpeg() {
  try {
    // Tenter d'utiliser les chemins du module ffmpeg-static s'il est disponible
    const ffmpegPath = require('ffmpeg-static');
    const ffprobePath = require('ffprobe-static').path;
    
    log('Configuration de FFmpeg', {
      ffmpegPath: ffmpegPath,
      ffprobePath: ffprobePath
    });
    
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    
    return true;
  } catch (error) {
    logError('Configuration de FFmpeg', error);
    
    // Tenter de trouver ffmpeg dans le PATH du système
    try {
      // Sur Windows, tenter de trouver ffmpeg.exe dans le PATH
      const { execSync } = require('child_process');
      const output = execSync('where ffmpeg', { encoding: 'utf8' });
      
      if (output) {
        const systemFfmpegPath = output.split('\n')[0].trim();
        log('Utilisation de FFmpeg système', { path: systemFfmpegPath });
        
        ffmpeg.setFfmpegPath(systemFfmpegPath);
        
        // Tenter également de trouver ffprobe
        try {
          const probeOutput = execSync('where ffprobe', { encoding: 'utf8' });
          if (probeOutput) {
            const systemFfprobePath = probeOutput.split('\n')[0].trim();
            ffmpeg.setFfprobePath(systemFfprobePath);
          }
        } catch (e) {
          log('Ffprobe système non trouvé');
        }
        
        return true;
      }
    } catch (e) {
      logError('Recherche de FFmpeg système', e);
    }
    
    log('Impossible de configurer FFmpeg, les miniatures ne seront pas générées');
    return false;
  }
}

// Rechercher tous les fichiers vidéo dans un répertoire (récursivement)
async function findVideoFiles(directory) {
  log(`Recherche de fichiers vidéo dans: ${directory}`);
  
  try {
    const { glob } = require('glob');
    let allFiles = [];
    
    // Ajout d'une option pour ignorer les fichiers système et les dossiers cachés
    const globOptions = { 
      nocase: true,
      ignore: [
        '**/node_modules/**',
        '**/AppData/**',
        '**/Program Files/**',
        '**/Windows/**',
        '**/ProgramData/**',
        '**/.*/**' // Dossiers cachés commençant par .
      ]
    };
    
    // Rechercher tous les fichiers avec les extensions supportées
    for (const ext of SUPPORTED_FORMATS) {
      try {
        const pattern = `${directory}/**/*${ext}`;
        log(`Recherche avec pattern: ${pattern}`);
        
        const files = await glob(pattern, globOptions);
        log(`Nombre de fichiers trouvés pour ${ext}: ${files.length}`);
        
        allFiles = [...allFiles, ...files];
      } catch (error) {
        logError(`Recherche avec extension ${ext}`, error);
      }
    }
    
    log(`Nombre total de fichiers trouvés: ${allFiles.length}`);
    return allFiles;
  } catch (error) {
    logError('Recherche de fichiers', error);
    throw error;
  }
}

// Analyser un fichier vidéo pour extraire les métadonnées
async function analyzeVideoFile(filePath) {
  log(`Analyse du fichier: ${filePath}`);
  
  return new Promise((resolve, reject) => {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      logError(`Le fichier n'existe pas: ${filePath}`, new Error('File not found'));
      return reject(new Error(`Le fichier ${filePath} n'existe pas`));
    }
    
    // Obtenir les statistiques du fichier
    try {
      const fileStats = fs.statSync(filePath);
      const fileSize = fileStats.size;
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath, fileExtension);
      
      // Vérifier si c'est un format vidéo supporté
      if (!SUPPORTED_FORMATS.includes(fileExtension)) {
        logError(`Format non supporté: ${fileExtension}`, new Error('Unsupported format'));
        return reject(new Error(`Format de fichier non supporté: ${fileExtension}`));
      }
      
      // Vérifier si le fichier n'est pas vide
      if (fileSize === 0) {
        logError(`Fichier vide: ${filePath}`, new Error('Empty file'));
        return reject(new Error(`Le fichier est vide: ${filePath}`));
      }
      
      // Utiliser ffprobe avec un timeout pour éviter de bloquer
      const ffprobeProcess = ffmpeg.ffprobe(filePath, { timeout: 30 }, (err, metadata) => {
        if (err) {
          logError(`Erreur ffprobe pour ${filePath}`, err);
          
          // Même en cas d'erreur, créer une entrée avec des métadonnées minimales
          const basicMovieData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1), // Enlever le point du début
            duration: 0,
            size_bytes: fileSize,
            thumbnail: null,
            width: null,
            height: null,
            bitrate: null,
            codec: null
          };
          
          log(`Création d'une entrée avec métadonnées minimales pour: ${filePath}`);
          resolve(basicMovieData);
          return;
        }
        
        // Extraire les métadonnées importantes
        log(`Métadonnées extraites pour: ${filePath}`, metadata);
        
        const durationInSeconds = metadata.format.duration || 0;
        let width = null;
        let height = null;
        let codec = null;
        let bitrate = metadata.format.bit_rate || null;
        
        // Essayer de récupérer la résolution et le codec
        if (metadata.streams && metadata.streams.length > 0) {
          // Trouver le stream vidéo
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          if (videoStream) {
            width = videoStream.width;
            height = videoStream.height;
            codec = videoStream.codec_name;
          }
        }
        
        // Générer un nom pour la miniature
        const thumbnailName = `${Date.now()}_${path.basename(filePath)}.jpg`;
        const thumbnailPath = path.join(app.getPath('userData'), 'thumbnails', thumbnailName);
        
        try {
          // Générer une miniature pour le film avec un timeout
          ffmpeg(filePath)
            .screenshots({
              count: 1,
              folder: path.join(app.getPath('userData'), 'thumbnails'),
              filename: thumbnailName,
              size: '320x240'
            })
            .timeout(20) // Timeout de 20 secondes pour la génération
            .on('error', (err) => {
              logError(`Erreur lors de la génération de la miniature pour ${filePath}`, err);
              
              // Créer les métadonnées du film sans miniature
              const movieData = {
                title: fileName,
                path: filePath,
                format: fileExtension.substring(1), // Enlever le point du début
                duration: Math.round(durationInSeconds),
                size_bytes: fileSize,
                thumbnail: null,
                width: width,
                height: height,
                bitrate: bitrate,
                codec: codec
              };
              
              log(`Métadonnées finales (sans miniature) pour: ${filePath}`, movieData);
              resolve(movieData);
            })
            .on('end', () => {
              // Créer les métadonnées du film avec miniature
              const movieData = {
                title: fileName,
                path: filePath,
                format: fileExtension.substring(1), // Enlever le point du début
                duration: Math.round(durationInSeconds),
                size_bytes: fileSize,
                thumbnail: thumbnailPath,
                width: width,
                height: height,
                bitrate: bitrate,
                codec: codec
              };
              
              log(`Métadonnées finales (avec miniature) pour: ${filePath}`, movieData);
              resolve(movieData);
            });
        } catch (error) {
          logError(`Erreur avec ffmpeg pour ${filePath}`, error);
          
          // En cas d'erreur, renvoyer les métadonnées sans miniature
          const movieData = {
            title: fileName,
            path: filePath,
            format: fileExtension.substring(1),
            duration: Math.round(durationInSeconds),
            size_bytes: fileSize,
            thumbnail: null,
            width: width,
            height: height,
            bitrate: bitrate,
            codec: codec
          };
          
          log(`Métadonnées finales (après erreur) pour: ${filePath}`, movieData);
          resolve(movieData);
        }
      });
    } catch (error) {
      logError(`Erreur générale lors de l'analyse de ${filePath}`, error);
      reject(error);
    }
  });
}

module.exports = {
  SUPPORTED_FORMATS,
  configureFfmpeg,
  findVideoFiles,
  analyzeVideoFile
};