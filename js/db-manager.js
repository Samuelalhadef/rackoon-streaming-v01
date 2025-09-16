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
          series: [],
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

    // Si c'est un épisode de série, le rediriger vers addEpisodeToSeries
    if (movieData.category === 'series' && movieData.seriesId) {
      console.log('📺 Redirection vers addEpisodeToSeries pour:', movieData.title);
      return await this.addEpisodeToSeries(movieData);
    }

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

  // Mettre à jour un film existant
  async updateMovie(movieData) {
    if (!this.data) await this.load();

    const existingIndex = this.data.movies.findIndex(m => m.path === movieData.path);
    if (existingIndex === -1) {
      return { success: false, message: 'Film non trouvé pour mise à jour' };
    }

    // Mettre à jour le film en conservant l'ID et la date d'ajout
    const existingMovie = this.data.movies[existingIndex];
    this.data.movies[existingIndex] = {
      ...existingMovie,
      ...movieData,
      id: existingMovie.id, // Conserver l'ID original
      dateAdded: existingMovie.dateAdded // Conserver la date d'ajout originale
    };

    await this.save();
    return { success: true, movie: this.data.movies[existingIndex] };
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

  // Gestion des séries

  // Ajouter une série
  async addSeries(seriesData) {
    if (!this.data) await this.load();

    // S'assurer que la section series existe
    if (!this.data.series) {
      this.data.series = [];
    }

    // Vérifier si la série existe déjà
    const existingSeries = this.data.series.find(s => s.name.toLowerCase() === seriesData.name.toLowerCase());
    if (existingSeries) {
      return { success: false, message: 'Série déjà existante' };
    }

    // Créer la série avec un ID unique
    const series = {
      id: this.generateId(),
      name: seriesData.name,
      description: seriesData.description || '',
      dateAdded: new Date().toISOString(),
      episodeCount: 0
    };

    this.data.series.push(series);
    await this.save();

    return { success: true, series };
  }

  // Récupérer toutes les séries
  async getAllSeries() {
    if (!this.data) await this.load();

    // S'assurer que la section series existe
    if (!this.data.series) {
      this.data.series = [];
      await this.save();
    }

    return { success: true, series: this.data.series };
  }

  // Récupérer une série par ID
  async getSeriesById(seriesId) {
    if (!this.data) await this.load();
    const series = this.data.series.find(s => s.id === seriesId);
    if (!series) {
      return { success: false, message: 'Série non trouvée' };
    }
    return { success: true, series };
  }

  // Ajouter un épisode à une série
  async addEpisodeToSeries(episodeData) {
    if (!this.data) await this.load();

    // S'assurer que la section series existe
    if (!this.data.series) {
      this.data.series = [];
    }

    // Trouver la série
    const series = this.data.series.find(s => s.id === episodeData.seriesId);
    if (!series) {
      return { success: false, message: 'Série non trouvée' };
    }

    // Créer l'épisode
    const episode = {
      id: this.generateId(),
      title: episodeData.title,
      path: episodeData.path,
      format: episodeData.format,
      duration: episodeData.duration,
      size_bytes: episodeData.size_bytes,
      thumbnail: episodeData.thumbnail,
      width: episodeData.width,
      height: episodeData.height,
      season_number: episodeData.season_number || 1,
      episode_number: episodeData.episode_number || null,
      description: episodeData.description || '',
      dateAdded: new Date().toISOString(),
      lastWatched: null,
      rating: 0
    };

    // Initialiser la structure des saisons si nécessaire
    if (!series.seasons) {
      series.seasons = [];
    }

    // Trouver ou créer la saison
    let season = series.seasons.find(s => s.number === episode.season_number);
    if (!season) {
      season = {
        number: episode.season_number,
        episodes: []
      };
      series.seasons.push(season);
      // Trier les saisons par numéro
      series.seasons.sort((a, b) => a.number - b.number);
    }

    // Vérifier si l'épisode existe déjà
    const existingEpisode = season.episodes.find(e => e.path === episode.path);
    if (existingEpisode) {
      return { success: false, message: 'Épisode déjà existant dans cette série' };
    }

    // Ajouter l'épisode
    season.episodes.push(episode);

    // Trier les épisodes par numéro (les épisodes sans numéro à la fin)
    season.episodes.sort((a, b) => {
      if (a.episode_number && b.episode_number) {
        return a.episode_number - b.episode_number;
      }
      if (a.episode_number && !b.episode_number) return -1;
      if (!a.episode_number && b.episode_number) return 1;
      return 0;
    });

    // Mettre à jour le compteur d'épisodes de la série
    const totalEpisodes = series.seasons.reduce((total, season) => total + season.episodes.length, 0);
    series.episodeCount = totalEpisodes;

    await this.save();

    console.log(`📺 Épisode ajouté à la série "${series.name}": ${episode.title}`);
    return { success: true, episode, series };
  }

  // Mettre à jour une série
  async updateSeries(seriesId, updates) {
    if (!this.data) await this.load();

    const seriesIndex = this.data.series.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) {
      return { success: false, message: 'Série non trouvée' };
    }

    this.data.series[seriesIndex] = { ...this.data.series[seriesIndex], ...updates };
    await this.save();

    return { success: true, series: this.data.series[seriesIndex] };
  }

  // Supprimer une série
  async deleteSeries(seriesId) {
    if (!this.data) await this.load();

    const seriesIndex = this.data.series.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) {
      return { success: false, message: 'Série non trouvée' };
    }

    // Vérifier si des épisodes sont associés à cette série
    const relatedEpisodes = this.data.movies.filter(m => m.seriesId === seriesId);
    if (relatedEpisodes.length > 0) {
      return { success: false, message: `Impossible de supprimer la série: ${relatedEpisodes.length} épisode(s) associé(s)` };
    }

    this.data.series.splice(seriesIndex, 1);
    await this.save();

    return { success: true };
  }
}

module.exports = JSONDatabase;