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
          medias: [],
          series: [],
          settings: {
            version: "1.0.0",
            lastScan: null,
            totalMedias: 0
          },
          categories: [
            { id: "films", name: "Films", icon: "🎬", count: 0 },
            { id: "series", name: "Séries", icon: "📺", count: 0 },
            { id: "documentaires", name: "Documentaires", icon: "📚", count: 0 },
            { id: "unsorted", name: "Non classé", icon: "📁", count: 0 }
          ],
          tagManager: {
            predefinedTags: {
              genres: [
                "Action", "Aventure", "Comédie", "Drame", "Horreur", "Thriller",
                "Romance", "Science-fiction", "Fantasy", "Documentaire", "Animation",
                "Guerre", "Western", "Musical", "Crime", "Mystère", "Biographie"
              ],
              moods: [
                "Détente", "Soirée entre amis", "Famille", "Date night", "Nostalgie",
                "Frissons", "Réflexion", "Motivation", "Escapisme", "Tension", "Feel-good"
              ],
              technical: [
                "4K", "HD", "SD", "HDR", "Dolby", "IMAX", "Blu-ray", "DVD"
              ],
              personal: [
                "Coup de cœur", "À revoir", "Overrated", "Underrated", "Comfort food",
                "Guilty pleasure", "Chef-d'œuvre", "Déçu", "Surprise"
              ],
              collections: [
                "Marvel", "DC", "Star Wars", "Bond", "Fast & Furious", "Pixar",
                "Studio Ghibli", "Disney", "Christopher Nolan", "Tarantino"
              ]
            },
            customTags: [],
            tagStats: {}
          }
        };
        await this.save();
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la base JSON:', error);
      this.data = { medias: [], settings: {}, categories: [] };
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
  generateThumbnailName(mediaPath) {
    const hash = crypto.createHash('md5').update(mediaPath).digest('hex').substring(0, 8);
    const baseName = path.basename(mediaPath, path.extname(mediaPath));
    return `thumb_${hash}_${Date.now()}.jpg`;
  }

  // Obtenir le chemin complet d'une miniature
  getThumbnailPath(thumbnailName) {
    return path.join(this.thumbnailsPath, thumbnailName);
  }

  // Ajouter un média
  async addMedia(mediaData) {
    if (!this.data) await this.load();

    // Si c'est un épisode de série, le rediriger vers addEpisodeToSeries
    if (mediaData.category === 'series' && mediaData.seriesId) {
      console.log('📺 Redirection vers addEpisodeToSeries pour:', mediaData.title);
      return await this.addEpisodeToSeries(mediaData);
    }

    // Vérifier si le média existe déjà
    const existingMedia = this.data.medias.find(m => m.path === mediaData.path);
    if (existingMedia) {
      return { success: false, message: 'Média déjà existant' };
    }

    // Enrichir les données avec les calculs automatiques
    const enrichedData = this.enrichMediaData(mediaData);

    // Créer le média avec un ID unique
    const media = {
      id: this.generateId(),
      ...enrichedData,
      dateAdded: new Date().toISOString(),
      lastWatched: null,
      rating: 0
    };

    this.data.medias.push(media);
    this.data.settings.totalMedias = this.data.medias.length;
    this.data.settings.lastScan = new Date().toISOString();

    await this.save();
    return { success: true, media };
  }

  // Mettre à jour un média existant
  async updateMedia(mediaData) {
    if (!this.data) await this.load();

    const existingIndex = this.data.medias.findIndex(m => m.path === mediaData.path);
    if (existingIndex === -1) {
      return { success: false, message: 'Média non trouvé pour mise à jour' };
    }

    // Mettre à jour le média en conservant l'ID et la date d'ajout
    const existingMedia = this.data.medias[existingIndex];
    this.data.medias[existingIndex] = {
      ...existingMedia,
      ...mediaData,
      id: existingMedia.id, // Conserver l'ID original
      dateAdded: existingMedia.dateAdded // Conserver la date d'ajout originale
    };

    await this.save();
    return { success: true, media: this.data.medias[existingIndex] };
  }

  // Obtenir tous les médias
  async getAllMedias() {
    if (!this.data) await this.load();
    return this.data.medias;
  }

  // Obtenir un média par ID
  async getMediaById(id) {
    if (!this.data) await this.load();
    return this.data.medias.find(m => m.id === id);
  }

  // Obtenir les médias par catégorie
  async getMediasByCategory(category) {
    if (!this.data) await this.load();
    if (category === 'all') return this.data.medias;
    return this.data.medias.filter(m => m.category === category);
  }


  // Supprimer un média
  async deleteMedia(id) {
    console.log('🔍 deleteMedia appelée avec ID:', id);
    if (!this.data) await this.load();

    const mediaIndex = this.data.medias.findIndex(m => m.id === id);
    if (mediaIndex === -1) {
      return { success: false, message: 'Média non trouvé' };
    }

    // Supprimer la miniature si elle existe
    const media = this.data.medias[mediaIndex];
    if (media.thumbnail) {
      try {
        await fs.unlink(this.getThumbnailPath(media.thumbnail));
      } catch (error) {
        console.log('Miniature non trouvée ou déjà supprimée');
      }
    }

    this.data.medias.splice(mediaIndex, 1);
    this.data.settings.totalMedias = this.data.medias.length;
    await this.save();
    return { success: true };
  }

  // Supprimer tous les médias
  async clearAllMedias() {
    if (!this.data) await this.load();

    try {
      const totalMedias = this.data.medias.length;
      const totalSeries = this.data.series.length;

      // Supprimer toutes les miniatures
      const thumbnailsDeleted = await this.deleteAllThumbnails();

      // Vider les données
      this.data.medias = [];
      this.data.series = [];
      this.data.settings.totalMedias = 0;
      this.data.categories = [
        { id: "films", name: "Films", icon: "🎬", count: 0 },
        { id: "series", name: "Séries", icon: "📺", count: 0 },
        { id: "documentaires", name: "Documentaires", icon: "📚", count: 0 },
        { id: "concerts", name: "Concerts", icon: "🎵", count: 0 },
        { id: "unsorted", name: "Non triés", icon: "📁", count: 0 }
      ];

      await this.save();

      console.log(`🗑️ Suppression terminée: ${totalMedias} médias, ${totalSeries} séries, ${thumbnailsDeleted} miniatures`);

      return {
        success: true,
        deleted: {
          medias: totalMedias,
          series: totalSeries,
          thumbnails: thumbnailsDeleted
        }
      };

    } catch (error) {
      console.error('❌ Erreur lors de la suppression de tous les médias:', error);
      return { success: false, message: error.message };
    }
  }

  // Nettoyer les séries corrompues (sans ID)
  async cleanupCorruptedSeries() {
    if (!this.data) await this.load();

    const initialCount = this.data.series.length;
    this.data.series = this.data.series.filter(serie => {
      if (!serie.id) {
        console.warn(`🧹 Suppression de la série corrompue sans ID: "${serie.name}"`);
        return false;
      }
      return true;
    });

    const cleanedCount = initialCount - this.data.series.length;
    if (cleanedCount > 0) {
      await this.save();
      console.log(`🧹 ${cleanedCount} série(s) corrompue(s) supprimée(s)`);
    }

    return { success: true, cleaned: cleanedCount };
  }

  // Supprimer toutes les miniatures
  async deleteAllThumbnails() {
    let deletedCount = 0;

    try {
      if (await fs.pathExists(this.thumbnailsPath)) {
        const files = await fs.readdir(this.thumbnailsPath);

        for (const file of files) {
          if (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')) {
            try {
              await fs.unlink(path.join(this.thumbnailsPath, file));
              deletedCount++;
            } catch (error) {
              console.warn(`⚠️ Impossible de supprimer la miniature ${file}:`, error.message);
            }
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des miniatures:', error);
      return 0;
    }
  }

  // Rechercher des médias
  async searchMedias(query) {
    if (!this.data) await this.load();
    const lowerQuery = query.toLowerCase();
    return this.data.medias.filter(media =>
      media.title.toLowerCase().includes(lowerQuery) ||
      (media.description && media.description.toLowerCase().includes(lowerQuery))
    );
  }

  // Obtenir les statistiques
  async getStats() {
    if (!this.data) await this.load();
    
    const totalSize = this.data.medias.reduce((sum, media) => sum + (media.size_bytes || 0), 0);
    const totalDuration = this.data.medias.reduce((sum, media) => sum + (media.duration || 0), 0);
    
    const formatCounts = {};
    this.data.medias.forEach(media => {
      const format = media.format || 'unknown';
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    });

    return {
      totalMedias: this.data.medias.length,
      totalSize,
      totalDuration,
      formatCounts,
      withThumbnails: this.data.medias.filter(m => m.thumbnail).length
    };
  }

  // Nettoyer les miniatures orphelines
  async cleanupThumbnails() {
    if (!this.data) await this.load();
    
    try {
      const thumbnailFiles = await fs.readdir(this.thumbnailsPath);
      const usedThumbnails = this.data.medias
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
  async saveThumbnail(sourceImagePath, mediaPath) {
    try {
      const thumbnailName = this.generateThumbnailName(mediaPath);
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

    // Enrichir les données de la série
    const enrichedData = this.enrichSeriesData(seriesData);

    // Créer la série avec un ID unique
    const series = {
      id: this.generateId(),
      ...enrichedData,
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

  // Récupérer une série par ID avec ses épisodes
  async getSeriesById(seriesId) {
    if (!this.data) await this.load();

    // Trouver la série dans les métadonnées
    const seriesMetadata = this.data.series.find(s => s.id === seriesId);
    if (!seriesMetadata) {
      return { success: false, message: 'Série non trouvée dans les métadonnées' };
    }

    // Trouver tous les épisodes de cette série
    const episodes = this.data.medias.filter(media =>
      media.category === 'series' && media.seriesId === seriesId
    );

    // Organiser les épisodes par saisons
    const seasonsMap = new Map();

    episodes.forEach(episode => {
      const seasonNumber = episode.season_number || 1;
      if (!seasonsMap.has(seasonNumber)) {
        seasonsMap.set(seasonNumber, {
          number: seasonNumber,
          episodes: []
        });
      }

      seasonsMap.get(seasonNumber).episodes.push({
        id: episode.id,
        title: episode.title,
        path: episode.path,
        format: episode.format,
        duration: episode.duration,
        size_bytes: episode.size_bytes,
        thumbnail: episode.thumbnail,
        width: episode.width,
        height: episode.height,
        season_number: episode.season_number || 1,
        episode_number: episode.episode_number,
        description: episode.description || '',
        dateAdded: episode.dateAdded,
        lastWatched: episode.lastWatched,
        rating: episode.rating || 0
      });
    });

    // Convertir en tableau et trier
    const seasons = Array.from(seasonsMap.values())
      .sort((a, b) => a.number - b.number)
      .map(season => ({
        ...season,
        episodes: season.episodes.sort((a, b) => {
          if (a.episode_number && b.episode_number) {
            return a.episode_number - b.episode_number;
          }
          if (a.episode_number && !b.episode_number) return -1;
          if (!a.episode_number && b.episode_number) return 1;
          return 0;
        })
      }));

    // Reconstituer la série complète
    const series = {
      ...seriesMetadata,
      episodeCount: episodes.length,
      seasons: seasons
    };

    return { success: true, series };
  }

  // Ajouter un épisode à une série (ajouté dans medias avec référence à la série)
  async addEpisodeToSeries(episodeData) {
    if (!this.data) await this.load();

    // S'assurer que la section series existe
    if (!this.data.series) {
      this.data.series = [];
    }

    // Trouver la série dans les métadonnées
    const series = this.data.series.find(s => s.id === episodeData.seriesId);
    if (!series) {
      return { success: false, message: 'Série non trouvée dans les métadonnées' };
    }

    // Vérifier si l'épisode existe déjà dans les médias
    const existingEpisode = this.data.medias.find(m => m.path === episodeData.path);
    if (existingEpisode) {
      return { success: false, message: 'Épisode déjà existant' };
    }

    // Créer l'épisode comme média
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
      category: 'series',
      seriesId: episodeData.seriesId,
      seriesName: series.name,
      season_number: episodeData.season_number || 1,
      episode_number: episodeData.episode_number || null,
      description: episodeData.description || '',
      dateAdded: new Date().toISOString(),
      lastWatched: null,
      rating: 0,
      mediaType: 'series',
      releaseDate: null,
      year: null
    };

    // Ajouter l'épisode dans les médias
    this.data.medias.push(episode);

    // Mettre à jour le compteur d'épisodes dans les métadonnées de la série
    const totalEpisodes = this.data.medias.filter(m =>
      m.category === 'series' && m.seriesId === episodeData.seriesId
    ).length;

    series.episodeCount = totalEpisodes;

    // Mettre à jour les statistiques générales
    this.data.settings.totalMedias = this.data.medias.length;
    this.data.settings.lastScan = new Date().toISOString();

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
    const relatedEpisodes = this.data.medias.filter(m => m.seriesId === seriesId);
    if (relatedEpisodes.length > 0) {
      return { success: false, message: `Impossible de supprimer la série: ${relatedEpisodes.length} épisode(s) associé(s)` };
    }

    this.data.series.splice(seriesIndex, 1);
    await this.save();

    return { success: true };
  }

  // ============================================
  // SYSTÈME DE TAGS ET ENRICHISSEMENT DES DONNÉES
  // ============================================

  // Enrichir les données d'un média avec calculs automatiques
  enrichMediaData(mediaData) {
    const enriched = { ...mediaData };

    // Calculer la décennie depuis l'année
    if (enriched.year) {
      enriched.decade = this.calculateDecade(enriched.year);
    }

    // Formater la durée
    if (enriched.duration) {
      enriched.durationFormatted = this.formatDuration(enriched.duration);
      enriched.durationCategory = this.categorizeDuration(enriched.duration);
    }

    // Initialiser les tags s'ils n'existent pas
    enriched.genres = enriched.genres || [];
    enriched.actors = enriched.actors || [];
    enriched.director = enriched.director || '';
    enriched.mood = enriched.mood || [];
    enriched.technical = enriched.technical || [];
    enriched.personalTags = enriched.personalTags || [];
    enriched.franchise = enriched.franchise || '';

    return enriched;
  }

  // Enrichir les données d'une série
  enrichSeriesData(seriesData) {
    const enriched = { ...seriesData };

    // Calculer la décennie depuis startYear
    if (enriched.startYear || enriched.year) {
      const year = enriched.startYear || enriched.year;
      enriched.decade = this.calculateDecade(year);
      if (!enriched.startYear && enriched.year) {
        enriched.startYear = enriched.year;
      }
    }

    // Initialiser les tags s'ils n'existent pas
    enriched.genres = enriched.genres || [];
    enriched.mainActors = enriched.mainActors || [];
    enriched.creators = enriched.creators || [];
    enriched.mood = enriched.mood || [];
    enriched.personalTags = enriched.personalTags || [];
    enriched.franchise = enriched.franchise || '';
    enriched.networks = enriched.networks || [];
    enriched.country = enriched.country || '';
    enriched.status = enriched.status || 'unknown';

    return enriched;
  }

  // Calculer la décennie à partir d'une année
  calculateDecade(year) {
    if (!year) return null;
    const decade = Math.floor(year / 10) * 10;
    return `${decade}s`;
  }

  // Formater la durée en format lisible
  formatDuration(minutes) {
    if (!minutes) return '0min';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`;
    }
    return `${mins}min`;
  }

  // Catégoriser la durée
  categorizeDuration(minutes) {
    if (!minutes) return 'unknown';

    if (minutes < 90) return 'court';
    if (minutes <= 150) return 'moyen';
    return 'long';
  }

  // Catégoriser une série selon le nombre de saisons
  categorizeSeriesLength(totalSeasons) {
    if (!totalSeasons || totalSeasons === 0) return 'unknown';

    if (totalSeasons === 1) return 'mini-série';
    if (totalSeasons <= 3) return 'série-courte';
    if (totalSeasons <= 6) return 'série-moyenne';
    return 'série-longue';
  }

  // ============================================
  // GESTION DES TAGS
  // ============================================

  // Ajouter un tag personnalisé
  async addCustomTag(tagName) {
    if (!this.data) await this.load();

    if (!this.data.tagManager) {
      this.data.tagManager = { predefinedTags: {}, customTags: [], tagStats: {} };
    }

    const normalizedTag = tagName.toLowerCase().trim();

    if (!this.data.tagManager.customTags.includes(normalizedTag)) {
      this.data.tagManager.customTags.push(normalizedTag);
      this.data.tagManager.tagStats[normalizedTag] = 0;
      await this.save();
      return { success: true, tag: normalizedTag };
    }

    return { success: false, message: 'Tag déjà existant' };
  }

  // Supprimer un tag personnalisé
  async removeCustomTag(tagName) {
    if (!this.data) await this.load();

    const normalizedTag = tagName.toLowerCase().trim();
    const index = this.data.tagManager.customTags.indexOf(normalizedTag);

    if (index > -1) {
      this.data.tagManager.customTags.splice(index, 1);
      delete this.data.tagManager.tagStats[normalizedTag];

      // Supprimer le tag de tous les médias
      this.data.medias.forEach(media => {
        if (media.personalTags) {
          media.personalTags = media.personalTags.filter(tag => tag !== normalizedTag);
        }
      });

      // Supprimer le tag de toutes les séries
      this.data.series.forEach(series => {
        if (series.personalTags) {
          series.personalTags = series.personalTags.filter(tag => tag !== normalizedTag);
        }
      });

      await this.save();
      return { success: true };
    }

    return { success: false, message: 'Tag non trouvé' };
  }

  // Ajouter des tags à un média
  async addTagsToMedia(mediaId, tags, tagType = 'personalTags') {
    if (!this.data) await this.load();

    const media = this.data.medias.find(m => m.id === mediaId);
    if (!media) {
      return { success: false, message: 'Média non trouvé' };
    }

    if (!media[tagType]) {
      media[tagType] = [];
    }

    const addedTags = [];
    tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase().trim();
      if (!media[tagType].includes(normalizedTag)) {
        media[tagType].push(normalizedTag);
        addedTags.push(normalizedTag);

        // Mettre à jour les statistiques
        if (!this.data.tagManager.tagStats[normalizedTag]) {
          this.data.tagManager.tagStats[normalizedTag] = 0;
        }
        this.data.tagManager.tagStats[normalizedTag]++;
      }
    });

    await this.save();
    return { success: true, addedTags };
  }

  // Supprimer des tags d'un média
  async removeTagsFromMedia(mediaId, tags, tagType = 'personalTags') {
    if (!this.data) await this.load();

    const media = this.data.medias.find(m => m.id === mediaId);
    if (!media) {
      return { success: false, message: 'Média non trouvé' };
    }

    if (!media[tagType]) {
      return { success: true, removedTags: [] };
    }

    const removedTags = [];
    tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase().trim();
      const index = media[tagType].indexOf(normalizedTag);
      if (index > -1) {
        media[tagType].splice(index, 1);
        removedTags.push(normalizedTag);

        // Mettre à jour les statistiques
        if (this.data.tagManager.tagStats[normalizedTag]) {
          this.data.tagManager.tagStats[normalizedTag]--;
          if (this.data.tagManager.tagStats[normalizedTag] <= 0) {
            delete this.data.tagManager.tagStats[normalizedTag];
          }
        }
      }
    });

    await this.save();
    return { success: true, removedTags };
  }

  // Rechercher des médias par tags
  async searchByTags(searchTags, operator = 'AND') {
    if (!this.data) await this.load();

    const normalizedSearchTags = searchTags.map(tag => tag.toLowerCase().trim());

    return this.data.medias.filter(media => {
      // Collecter tous les tags du média
      const allMediaTags = [
        ...(media.genres || []),
        ...(media.mood || []),
        ...(media.technical || []),
        ...(media.personalTags || []),
        media.franchise,
        media.durationCategory,
        media.decade
      ].filter(Boolean).map(tag => tag.toLowerCase());

      if (operator === 'AND') {
        // Tous les tags recherchés doivent être présents
        return normalizedSearchTags.every(searchTag =>
          allMediaTags.some(mediaTag => mediaTag.includes(searchTag))
        );
      } else {
        // Au moins un tag recherché doit être présent
        return normalizedSearchTags.some(searchTag =>
          allMediaTags.some(mediaTag => mediaTag.includes(searchTag))
        );
      }
    });
  }

  // Obtenir tous les tags disponibles
  async getAllTags() {
    if (!this.data) await this.load();

    if (!this.data.tagManager) {
      return { success: true, tags: { predefined: {}, custom: [], stats: {} } };
    }

    return {
      success: true,
      tags: {
        predefined: this.data.tagManager.predefinedTags,
        custom: this.data.tagManager.customTags,
        stats: this.data.tagManager.tagStats
      }
    };
  }

  // Obtenir des suggestions de tags basées sur une requête
  async getTagSuggestions(query, limit = 10) {
    if (!this.data) await this.load();

    const normalizedQuery = query.toLowerCase().trim();
    const suggestions = [];

    // Rechercher dans les tags prédéfinis
    Object.values(this.data.tagManager.predefinedTags || {}).forEach(tagGroup => {
      tagGroup.forEach(tag => {
        if (tag.toLowerCase().includes(normalizedQuery)) {
          suggestions.push({ tag, type: 'predefined' });
        }
      });
    });

    // Rechercher dans les tags personnalisés
    (this.data.tagManager.customTags || []).forEach(tag => {
      if (tag.includes(normalizedQuery)) {
        suggestions.push({ tag, type: 'custom' });
      }
    });

    // Trier par pertinence et popularité
    suggestions.sort((a, b) => {
      const aStats = this.data.tagManager.tagStats[a.tag] || 0;
      const bStats = this.data.tagManager.tagStats[b.tag] || 0;
      return bStats - aStats;
    });

    return { success: true, suggestions: suggestions.slice(0, limit) };
  }

  // ============================================
  // MIGRATION DES DONNÉES EXISTANTES
  // ============================================

  // Migrer les données existantes vers le nouveau format avec tags
  async migrateToTagSystem() {
    if (!this.data) await this.load();

    console.log('🔄 Migration vers le système de tags...');

    let migrationCount = 0;

    // Migrer les médias
    this.data.medias.forEach(media => {
      const originalData = { ...media };
      const enrichedData = this.enrichMediaData(media);

      // Vérifier si des changements ont été effectués
      if (JSON.stringify(originalData) !== JSON.stringify(enrichedData)) {
        Object.assign(media, enrichedData);
        migrationCount++;
      }
    });

    // Migrer les séries
    this.data.series.forEach(series => {
      const originalData = { ...series };
      const enrichedData = this.enrichSeriesData(series);

      // Calculer la catégorie de longueur de série
      if (series.totalSeasons) {
        enrichedData.seriesLength = this.categorizeSeriesLength(series.totalSeasons);
      }

      if (JSON.stringify(originalData) !== JSON.stringify(enrichedData)) {
        Object.assign(series, enrichedData);
        migrationCount++;
      }
    });

    // Initialiser le tagManager s'il n'existe pas
    if (!this.data.tagManager) {
      this.data.tagManager = {
        predefinedTags: {
          genres: [
            "Action", "Aventure", "Comédie", "Drame", "Horreur", "Thriller",
            "Romance", "Science-fiction", "Fantasy", "Documentaire", "Animation",
            "Guerre", "Western", "Musical", "Crime", "Mystère", "Biographie"
          ],
          moods: [
            "Détente", "Soirée entre amis", "Famille", "Date night", "Nostalgie",
            "Frissons", "Réflexion", "Motivation", "Escapisme", "Tension", "Feel-good"
          ],
          technical: [
            "4K", "HD", "SD", "HDR", "Dolby", "IMAX", "Blu-ray", "DVD"
          ],
          personal: [
            "Coup de cœur", "À revoir", "Overrated", "Underrated", "Comfort food",
            "Guilty pleasure", "Chef-d'œuvre", "Déçu", "Surprise"
          ],
          collections: [
            "Marvel", "DC", "Star Wars", "Bond", "Fast & Furious", "Pixar",
            "Studio Ghibli", "Disney", "Christopher Nolan", "Tarantino"
          ]
        },
        customTags: [],
        tagStats: {}
      };
      migrationCount++;
    }

    if (migrationCount > 0) {
      await this.save();
      console.log(`✅ Migration terminée: ${migrationCount} éléments mis à jour`);
    } else {
      console.log('ℹ️ Aucune migration nécessaire');
    }

    return { success: true, migrationCount };
  }
}

module.exports = JSONDatabase;