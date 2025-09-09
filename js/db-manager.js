/**
 * Gestionnaire de base de données JSON
 * Remplace SQLite par un système de fichiers JSON simple
 */
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class JSONDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.thumbnailsPath = path.join(path.dirname(dbPath), 'thumbnails');
    this.tmdbImagesPath = path.join(path.dirname(dbPath), 'tmdb-images');
    this.data = null;
    this.ensureDirectories();
  }

  // Créer les dossiers nécessaires
  ensureDirectories() {
    fs.ensureDirSync(path.dirname(this.dbPath));
    fs.ensureDirSync(this.thumbnailsPath);
    fs.ensureDirSync(this.tmdbImagesPath);
  }

  // Charger les données depuis le fichier JSON
  async load() {
    try {
      if (await fs.pathExists(this.dbPath)) {
        const rawData = await fs.readFile(this.dbPath, 'utf8');
        this.data = JSON.parse(rawData);
      } else {
        // Créer le fichier initial
        this.data = {
          movies: [],
          settings: {
            version: "1.0.0",
            lastScan: null,
            totalMovies: 0
          },
          categories: [
            { id: "films", name: "Films", icon: "🎬", count: 0 },
            { id: "series", name: "Séries", icon: "📺", count: 0 },
            { id: "documentaires", name: "Documentaires", icon: "📚", count: 0 },
            { id: "unsorted", name: "Non classé", icon: "📁", count: 0 }
          ]
        };
        await this.save();
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la base JSON:', error);
      this.data = { movies: [], settings: {}, categories: [] };
    }
  }

  // Sauvegarder les données vers le fichier JSON
  async save() {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la base JSON:', error);
    }
  }

  // Générer un ID unique
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  // Générer un nom de fichier pour les miniatures
  generateThumbnailName(moviePath) {
    const hash = crypto.createHash('md5').update(moviePath).digest('hex').substring(0, 8);
    const baseName = path.basename(moviePath, path.extname(moviePath));
    return `thumb_${hash}_${Date.now()}.jpg`;
  }

  // Obtenir le chemin complet d'une miniature
  getThumbnailPath(thumbnailName) {
    return path.join(this.thumbnailsPath, thumbnailName);
  }

  // Ajouter un film
  async addMovie(movieData) {
    if (!this.data) await this.load();
    
    // Vérifier si le film existe déjà
    const existingMovie = this.data.movies.find(m => m.path === movieData.path);
    if (existingMovie) {
      return { success: false, message: 'Film déjà existant' };
    }

    // Créer le film avec un ID unique
    const movie = {
      id: this.generateId(),
      ...movieData,
      dateAdded: new Date().toISOString(),
      lastWatched: null,
      rating: 0
    };

    this.data.movies.push(movie);
    this.data.settings.totalMovies = this.data.movies.length;
    this.data.settings.lastScan = new Date().toISOString();

    await this.save();
    return { success: true, movie };
  }

  // Obtenir tous les films
  async getAllMovies() {
    if (!this.data) await this.load();
    return this.data.movies;
  }

  // Obtenir un film par ID
  async getMovieById(id) {
    if (!this.data) await this.load();
    return this.data.movies.find(m => m.id === id);
  }

  // Obtenir les films par catégorie
  async getMoviesByCategory(category) {
    if (!this.data) await this.load();
    if (category === 'all') return this.data.movies;
    return this.data.movies.filter(m => m.category === category);
  }

  // Mettre à jour un film
  async updateMovie(id, updates) {
    if (!this.data) await this.load();
    
    const movieIndex = this.data.movies.findIndex(m => m.id === id);
    if (movieIndex === -1) {
      return { success: false, message: 'Film non trouvé' };
    }

    this.data.movies[movieIndex] = { ...this.data.movies[movieIndex], ...updates };
    await this.save();
    return { success: true, movie: this.data.movies[movieIndex] };
  }

  // Supprimer un film
  async deleteMovie(id) {
    if (!this.data) await this.load();
    
    const movieIndex = this.data.movies.findIndex(m => m.id === id);
    if (movieIndex === -1) {
      return { success: false, message: 'Film non trouvé' };
    }

    // Supprimer la miniature si elle existe
    const movie = this.data.movies[movieIndex];
    if (movie.thumbnail) {
      try {
        await fs.unlink(this.getThumbnailPath(movie.thumbnail));
      } catch (error) {
        console.log('Miniature non trouvée ou déjà supprimée');
      }
    }

    this.data.movies.splice(movieIndex, 1);
    this.data.settings.totalMovies = this.data.movies.length;
    await this.save();
    return { success: true };
  }

  // Rechercher des films
  async searchMovies(query) {
    if (!this.data) await this.load();
    const lowerQuery = query.toLowerCase();
    return this.data.movies.filter(movie => 
      movie.title.toLowerCase().includes(lowerQuery) ||
      (movie.description && movie.description.toLowerCase().includes(lowerQuery))
    );
  }

  // Obtenir les statistiques
  async getStats() {
    if (!this.data) await this.load();
    
    const totalSize = this.data.movies.reduce((sum, movie) => sum + (movie.size_bytes || 0), 0);
    const totalDuration = this.data.movies.reduce((sum, movie) => sum + (movie.duration || 0), 0);
    
    const formatCounts = {};
    this.data.movies.forEach(movie => {
      const format = movie.format || 'unknown';
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    });

    return {
      totalMovies: this.data.movies.length,
      totalSize,
      totalDuration,
      formatCounts,
      withThumbnails: this.data.movies.filter(m => m.thumbnail).length
    };
  }

  // Nettoyer les miniatures orphelines
  async cleanupThumbnails() {
    if (!this.data) await this.load();
    
    try {
      const thumbnailFiles = await fs.readdir(this.thumbnailsPath);
      const usedThumbnails = this.data.movies
        .map(m => m.thumbnail)
        .filter(t => t);

      let deletedCount = 0;
      for (const file of thumbnailFiles) {
        if (!usedThumbnails.includes(file)) {
          await fs.unlink(path.join(this.thumbnailsPath, file));
          deletedCount++;
        }
      }

      return { success: true, deletedCount };
    } catch (error) {
      console.error('Erreur lors du nettoyage des miniatures:', error);
      return { success: false, error: error.message };
    }
  }

  // Sauvegarder une miniature et retourner son nom
  async saveThumbnail(sourceImagePath, moviePath) {
    try {
      const thumbnailName = this.generateThumbnailName(moviePath);
      const destPath = this.getThumbnailPath(thumbnailName);
      
      await fs.copy(sourceImagePath, destPath);
      return thumbnailName;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la miniature:', error);
      return null;
    }
  }
}

module.exports = JSONDatabase;