// Fonction simplifiée pour trouver des fichiers vidéo
async function findVideoFilesSimple(directory) {
  console.log(`Recherche de fichiers vidéo dans: ${directory}`);
  
  try {
    const fs = require('fs-extra');
    const path = require('path');
    const { glob } = require('glob');
    
    // Formats supportés
    const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];
    
    // Option de recherche sans filtres
    const globOptions = { 
      nocase: true,
      // Pas de filtres pour trouver TOUS les fichiers
    };
    
    let allFiles = [];
    
    // Rechercher toutes les extensions vidéo
    for (const ext of SUPPORTED_FORMATS) {
      try {
        const pattern = `${directory}/**/*${ext}`;
        console.log(`Recherche avec pattern: ${pattern}`);
        
        const files = await glob(pattern, globOptions);
        console.log(`${ext}: ${files.length} fichiers trouvés`);
        
        // Vérifier chaque fichier
        const validFiles = [];
        for (const file of files) {
          try {
            // Vérifier si le fichier existe et est accessible
            const stats = await fs.stat(file);
            if (stats.isFile() && stats.size > 0) {
              validFiles.push(file);
            }
          } catch (err) {
            console.error(`Erreur avec le fichier ${file}: ${err.message}`);
          }
        }
        
        console.log(`${ext}: ${validFiles.length} fichiers valides`);
        allFiles = [...allFiles, ...validFiles];
      } catch (error) {
        console.error(`Erreur avec l'extension ${ext}: ${error.message}`);
      }
    }
    
    console.log(`Total: ${allFiles.length} fichiers vidéo trouvés`);
    return allFiles;
  } catch (error) {
    console.error('Erreur générale de recherche:', error);
    throw error;
  }
}

// Pour utiliser cette fonction, remplacez la ligne dans main.js:
// const videoFiles = await videoAnalyzer.findVideoFiles(folderToScan);
// par:
// const videoFiles = await findVideoFilesSimple(folderToScan);