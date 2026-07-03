/**
 * Gestionnaire de base de données JSON
 * Version 2.0 - Structure multi-fichiers avec écriture atomique
 */
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class JSONDatabase {
  constructor(dbPath) {
    // Chemin du dossier principal
    this.dataDir = path.dirname(dbPath);
    this.dbDir = path.join(this.dataDir, 'database');

    // Chemins des fichiers JSON
    this.paths = {
      uniqueMedias: path.join(this.dbDir, 'medias_uniques.json'),
      seriesEpisodes: path.join(this.dbDir, 'series_episodes.json'),
      seriesMetadata: path.join(this.dbDir, 'series_metadata.json'),
      seriesSeasons: path.join(this.dbDir, 'series_seasons.json'),
      appConfig: path.join(this.dbDir, 'app_config.json'),
      userPrefs: path.join(this.dbDir, 'user_prefs.json'),
      persons: path.join(this.dbDir, 'persons.json')
    };

    // Ancien fichier pour migration
    this.oldDbPath = dbPath;

    // Dossiers pour assets
    this.thumbnailsPath = path.join(this.dataDir, 'thumbnails');
    this.personPhotosPath = path.join(this.dataDir, 'person-photos');

    // Données en mémoire
    this.data = {
      uniqueMedias: [],
      seriesEpisodes: [],
      seriesMetadata: [],
      seriesSeasons: {},
      config: null,
      userPrefs: null,
      persons: []
    };

    // Throttling des sauvegardes
    this.saveTimers = {};
    this.saveDelay = 500; // ms

    this.ensureDirectories();
  }

  // Créer les dossiers nécessaires
  ensureDirectories() {
    fs.ensureDirSync(this.dbDir);
    fs.ensureDirSync(this.thumbnailsPath);
    fs.ensureDirSync(this.personPhotosPath);
  }

  // ============================================
  // ÉCRITURE ATOMIQUE ET BACKUP
  // ============================================

  /**
   * Sauvegarder un fichier JSON de manière atomique
   * 1. Créer un backup de l'ancien fichier
   * 2. Écrire dans un fichier temporaire
   * 3. Renommer le fichier temporaire (opération atomique)
   */
  async saveFileAtomic(filePath, data) {
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.backup`;

    try {
      // 1. Backup de l'ancien fichier s'il existe
      if (await fs.pathExists(filePath)) {
        await fs.copy(filePath, backupPath, { overwrite: true });
      }

      // 2. Écrire dans un fichier temporaire
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');

      // 3. Renommer le fichier temporaire (atomique)
      await fs.rename(tmpPath, filePath);

      return { success: true };
    } catch (error) {
      console.error(`Erreur lors de la sauvegarde atomique de ${filePath}:`, error);

      // Nettoyage du fichier temporaire si erreur
      if (await fs.pathExists(tmpPath)) {
        await fs.unlink(tmpPath).catch(() => {});
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Charger un fichier JSON avec fallback sur le backup
   */
  async loadFileWithBackup(filePath, defaultData = null) {
    const backupPath = `${filePath}.backup`;

    try {
      // Essayer de charger le fichier principal
      if (await fs.pathExists(filePath)) {
        const rawData = await fs.readFile(filePath, 'utf8');
        return JSON.parse(rawData);
      }
    } catch (error) {
      console.warn(`Erreur lecture ${path.basename(filePath)}, tentative backup...`);

      // Essayer le backup
      try {
        if (await fs.pathExists(backupPath)) {
          console.log(`📦 Restauration depuis backup: ${path.basename(backupPath)}`);
          const rawData = await fs.readFile(backupPath, 'utf8');
          return JSON.parse(rawData);
        }
      } catch (backupError) {
        console.error(`Erreur lecture backup ${path.basename(backupPath)}:`, backupError);
      }
    }

    // Si aucun fichier n'est disponible, retourner les données par défaut
    return defaultData;
  }

  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================

  async load() {
    console.log('📊 Chargement de la base de données...');

    // Charger les médias uniques
    this.data.uniqueMedias = await this.loadFileWithBackup(
      this.paths.uniqueMedias,
      []
    );

    // Charger les épisodes de séries
    this.data.seriesEpisodes = await this.loadFileWithBackup(
      this.paths.seriesEpisodes,
      []
    );

    // Charger les métadonnées des séries
    this.data.seriesMetadata = await this.loadFileWithBackup(
      this.paths.seriesMetadata,
      []
    );

    // Charger les saisons des séries
    this.data.seriesSeasons = await this.loadFileWithBackup(
      this.paths.seriesSeasons,
      {}
    );

    // Charger la configuration
    this.data.config = await this.loadFileWithBackup(
      this.paths.appConfig,
      this.getDefaultConfig()
    );

    // Charger les préférences utilisateur
    this.data.userPrefs = await this.loadFileWithBackup(
      this.paths.userPrefs,
      this.getDefaultUserPrefs()
    );

    // Charger les personnes
    this.data.persons = await this.loadFileWithBackup(
      this.paths.persons,
      []
    );

    console.log(`✅ Base chargée: ${this.data.uniqueMedias.length} médias uniques, ${this.data.seriesEpisodes.length} épisodes, ${this.data.seriesMetadata.length} séries, ${this.data.persons.length} personnes`);
  }

  /**
   * Configuration par défaut
   */
  getDefaultConfig() {
    return {
      settings: {
        version: "2.0.0",
        lastScan: null,
        totalMedias: 0
      },
      categories: [
        { id: "films", name: "Films", icon: "🎬", count: 0 },
        { id: "series", name: "Séries", icon: "📺", count: 0 },
        { id: "documentaires", name: "Documentaires", icon: "📚", count: 0 },
        { id: "concerts", name: "Concerts", icon: "🎵", count: 0 },
        { id: "unsorted", name: "Non triés", icon: "📁", count: 0 }
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
  }

  /**
   * Préférences utilisateur par défaut
   */
  getDefaultUserPrefs() {
    return {
      ratings: {},
      watchedMovies: {},
      watchCount: {},
      lastWatched: {},
      playProgress: {}
    };
  }

  // ============================================
  // SAUVEGARDE DES DONNÉES
  // ============================================

  /**
   * Sauvegarder tous les fichiers
   */
  async saveAll() {
    await Promise.all([
      this.saveFileAtomic(this.paths.uniqueMedias, this.data.uniqueMedias),
      this.saveFileAtomic(this.paths.seriesEpisodes, this.data.seriesEpisodes),
      this.saveFileAtomic(this.paths.seriesMetadata, this.data.seriesMetadata),
      this.saveFileAtomic(this.paths.appConfig, this.data.config),
      this.saveFileAtomic(this.paths.persons, this.data.persons)
    ]);
  }

  /**
   * Sauvegarder uniquement les médias uniques (throttled)
   */
  async saveUniqueMedias() {
    return this.saveThrottled('uniqueMedias', () =>
      this.saveFileAtomic(this.paths.uniqueMedias, this.data.uniqueMedias)
    );
  }

  /**
   * Sauvegarder uniquement les médias uniques (SANS throttling, pour import en masse)
   */
  async saveUniqueMediasImmediate() {
    return this.saveFileAtomic(this.paths.uniqueMedias, this.data.uniqueMedias);
  }

  /**
   * Sauvegarder uniquement les épisodes (throttled)
   */
  async saveSeriesEpisodes() {
    return this.saveThrottled('seriesEpisodes', () =>
      this.saveFileAtomic(this.paths.seriesEpisodes, this.data.seriesEpisodes)
    );
  }

  /**
   * Sauvegarder uniquement les épisodes (SANS throttling, pour import en masse)
   */
  async saveSeriesEpisodesImmediate() {
    return this.saveFileAtomic(this.paths.seriesEpisodes, this.data.seriesEpisodes);
  }

  /**
   * Sauvegarder uniquement les métadonnées des séries (throttled)
   */
  async saveSeriesMetadata() {
    return this.saveThrottled('seriesMetadata', () =>
      this.saveFileAtomic(this.paths.seriesMetadata, this.data.seriesMetadata)
    );
  }

  /**
   * Sauvegarder uniquement les saisons des séries (throttled)
   */
  async saveSeriesSeasonsData() {
    return this.saveThrottled('seriesSeasons', () =>
      this.saveFileAtomic(this.paths.seriesSeasons, this.data.seriesSeasons)
    );
  }

  /**
   * Sauvegarder uniquement la config (throttled)
   */
  async saveConfig() {
    return this.saveThrottled('config', () =>
      this.saveFileAtomic(this.paths.appConfig, this.data.config)
    );
  }

  /**
   * Sauvegarder uniquement les préférences utilisateur (throttled)
   */
  async saveUserPrefs() {
    return this.saveThrottled('userPrefs', () =>
      this.saveFileAtomic(this.paths.userPrefs, this.data.userPrefs)
    );
  }

  /**
   * Sauvegarder les préférences utilisateur immédiatement (SANS throttling)
   */
  async saveUserPrefsImmediate() {
    return this.saveFileAtomic(this.paths.userPrefs, this.data.userPrefs);
  }

  /**
   * Récupérer les préférences utilisateur
   */
  async getUserPrefs() {
    if (!this.data.userPrefs) await this.load();
    return this.data.userPrefs;
  }

  /**
   * Mettre à jour une note utilisateur
   */
  async updateRating(mediaId, rating) {
    if (!this.data.userPrefs) await this.load();
    this.data.userPrefs.ratings[mediaId] = rating;
    await this.saveUserPrefsImmediate();
    return { success: true };
  }

  /**
   * Mettre à jour le statut "vu/à voir"
   */
  async updateWatchStatus(mediaId, isWatched) {
    if (!this.data.userPrefs) await this.load();
    if (isWatched) {
      this.data.userPrefs.watchedMovies[mediaId] = true;
    } else {
      delete this.data.userPrefs.watchedMovies[mediaId];
    }
    await this.saveUserPrefsImmediate();
    return { success: true };
  }

  /**
   * Throttling des sauvegardes
   * Évite d'écrire trop fréquemment le même fichier
   */
  async saveThrottled(key, saveFn) {
    return new Promise((resolve) => {
      // Annuler le timer précédent si existant
      if (this.saveTimers[key]) {
        clearTimeout(this.saveTimers[key]);
      }

      // Créer un nouveau timer
      this.saveTimers[key] = setTimeout(async () => {
        await saveFn();
        delete this.saveTimers[key];
        resolve();
      }, this.saveDelay);
    });
  }

  // ============================================
  // GESTION DES MÉDIAS
  // ============================================

  // Générer un ID unique
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  // Obtenir tous les médias (uniques + épisodes)
  async getAllMedias() {
    if (!this.data.config) await this.load();
    return [...this.data.uniqueMedias, ...this.data.seriesEpisodes];
  }

  // Obtenir un média par ID
  async getMediaById(id) {
    if (!this.data.config) await this.load();

    // Chercher dans les médias uniques
    let media = this.data.uniqueMedias.find(m => m.id === id);
    if (media) return media;

    // Chercher dans les épisodes
    return this.data.seriesEpisodes.find(m => m.id === id);
  }

  // Ajouter un média
  async addMedia(mediaData) {
    if (!this.data.config) await this.load();

    // Si c'est un épisode de série, le rediriger vers addEpisodeToSeries
    if (mediaData.category === 'series' && mediaData.seriesId) {
      console.log('📺 Redirection vers addEpisodeToSeries pour:', mediaData.title);
      return await this.addEpisodeToSeries(mediaData);
    }

    // Vérifier si le média existe déjà
    const existingMedia = this.data.uniqueMedias.find(m => m.path === mediaData.path);
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

    this.data.uniqueMedias.push(media);
    this.data.config.settings.totalMedias = this.data.uniqueMedias.length + this.data.seriesEpisodes.length;
    this.data.config.settings.lastScan = new Date().toISOString();

    // Utiliser la sauvegarde immédiate pour éviter les problèmes de throttling lors d'imports en masse
    await this.saveUniqueMediasImmediate();
    await this.saveConfig();

    return { success: true, media };
  }

  // Mettre à jour un média existant (par path)
  async updateMedia(mediaData) {
    if (!this.data.config) await this.load();

    // Chercher dans les médias uniques
    let existingIndex = this.data.uniqueMedias.findIndex(m => m.path === mediaData.path);
    let isEpisode = false;

    if (existingIndex === -1) {
      // Chercher dans les épisodes
      existingIndex = this.data.seriesEpisodes.findIndex(m => m.path === mediaData.path);
      isEpisode = true;

      if (existingIndex === -1) {
        return { success: false, message: 'Média non trouvé pour mise à jour' };
      }
    }

    // Déterminer le tableau cible
    const targetArray = isEpisode ? this.data.seriesEpisodes : this.data.uniqueMedias;
    const existingMedia = targetArray[existingIndex];

    // Mettre à jour le média en conservant l'ID et la date d'ajout
    targetArray[existingIndex] = {
      ...existingMedia,
      ...mediaData,
      id: existingMedia.id,
      dateAdded: existingMedia.dateAdded
    };

    // Sauvegarder le fichier approprié (utiliser les méthodes immédiates pour éviter le throttling)
    if (isEpisode) {
      await this.saveSeriesEpisodesImmediate();

      // Si l'épisode a un seriesId, mettre à jour la saison par défaut
      if (mediaData.seriesId) {
        await this.addEpisodeToDefaultSeason(mediaData.seriesId);
      }
    } else {
      await this.saveUniqueMediasImmediate();
    }

    return { success: true, media: targetArray[existingIndex] };
  }

  // Mettre à jour un média par son ID
  async updateMediaById(mediaId, updates) {
    if (!this.data.config) await this.load();

    // Chercher dans les médias uniques
    let existingIndex = this.data.uniqueMedias.findIndex(m => m.id === mediaId);
    let isEpisode = false;

    if (existingIndex === -1) {
      // Chercher dans les épisodes
      existingIndex = this.data.seriesEpisodes.findIndex(m => m.id === mediaId);
      isEpisode = true;

      if (existingIndex === -1) {
        return { success: false, message: 'Média non trouvé pour mise à jour' };
      }
    }

    // Déterminer le tableau cible
    const targetArray = isEpisode ? this.data.seriesEpisodes : this.data.uniqueMedias;
    const existingMedia = targetArray[existingIndex];

    // Mettre à jour le média en conservant l'ID, le path et la date d'ajout
    targetArray[existingIndex] = {
      ...existingMedia,
      ...updates,
      id: existingMedia.id,
      path: existingMedia.path,
      dateAdded: existingMedia.dateAdded
    };

    // Sauvegarder le fichier approprié immédiatement
    if (isEpisode) {
      await this.saveSeriesEpisodesImmediate();

      // Si l'épisode a un seriesId, mettre à jour la saison par défaut
      if (updates.seriesId) {
        await this.addEpisodeToDefaultSeason(updates.seriesId);
      }
    } else {
      await this.saveUniqueMediasImmediate();
    }

    console.log(`✅ Média mis à jour par ID: ${targetArray[existingIndex].title}`);
    return { success: true, media: targetArray[existingIndex] };
  }

  // Supprimer un média
  async deleteMedia(id) {
    console.log('🔍 deleteMedia appelée avec ID:', id);
    if (!this.data.config) await this.load();

    // Chercher dans les médias uniques
    let mediaIndex = this.data.uniqueMedias.findIndex(m => m.id === id);
    let isEpisode = false;

    if (mediaIndex === -1) {
      // Chercher dans les épisodes
      mediaIndex = this.data.seriesEpisodes.findIndex(m => m.id === id);
      isEpisode = true;

      if (mediaIndex === -1) {
        return { success: false, message: 'Média non trouvé' };
      }
    }

    // Déterminer le tableau cible
    const targetArray = isEpisode ? this.data.seriesEpisodes : this.data.uniqueMedias;
    const media = targetArray[mediaIndex];

    // Supprimer la miniature si elle existe
    if (media.thumbnail) {
      try {
        await fs.unlink(this.getThumbnailPath(media.thumbnail));
      } catch (error) {
        console.log('Miniature non trouvée ou déjà supprimée');
      }
    }

    targetArray.splice(mediaIndex, 1);
    this.data.config.settings.totalMedias = this.data.uniqueMedias.length + this.data.seriesEpisodes.length;

    // Sauvegarder le fichier approprié
    if (isEpisode) {
      await this.saveSeriesEpisodes();
    } else {
      await this.saveUniqueMedias();
    }

    await this.saveConfig();

    return { success: true };
  }

  // Supprimer tous les médias
  async clearAllMedias() {
    if (!this.data.config) await this.load();

    try {
      const totalMedias = this.data.uniqueMedias.length + this.data.seriesEpisodes.length;
      const totalSeries = this.data.seriesMetadata.length;

      // Supprimer toutes les miniatures
      const thumbnailsDeleted = await this.deleteAllThumbnails();

      // Vider les données
      this.data.uniqueMedias = [];
      this.data.seriesEpisodes = [];
      this.data.seriesMetadata = [];
      this.data.config.settings.totalMedias = 0;
      this.data.config.categories = [
        { id: "films", name: "Films", icon: "🎬", count: 0 },
        { id: "series", name: "Séries", icon: "📺", count: 0 },
        { id: "documentaires", name: "Documentaires", icon: "📚", count: 0 },
        { id: "concerts", name: "Concerts", icon: "🎵", count: 0 },
        { id: "unsorted", name: "Non triés", icon: "📁", count: 0 }
      ];

      await this.saveAll();

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

  // Obtenir les statistiques
  async getStats() {
    if (!this.data.config) await this.load();

    const allMedias = [...this.data.uniqueMedias, ...this.data.seriesEpisodes];

    const totalSize = allMedias.reduce((sum, media) => sum + (media.size_bytes || 0), 0);
    const totalDuration = allMedias.reduce((sum, media) => sum + (media.duration || 0), 0);

    const formatCounts = {};
    allMedias.forEach(media => {
      const format = media.format || 'unknown';
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    });

    return {
      totalMedias: allMedias.length,
      totalSize,
      totalDuration,
      formatCounts,
      withThumbnails: allMedias.filter(m => m.thumbnail).length
    };
  }

  // ============================================
  // GESTION DES SÉRIES
  // ============================================

  // Ajouter une série
  async addSeries(seriesData) {
    if (!this.data.config) await this.load();

    // Vérifier si la série existe déjà
    const existingSeries = this.data.seriesMetadata.find(s => s.name.toLowerCase() === seriesData.name.toLowerCase());
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

    this.data.seriesMetadata.push(series);
    await this.saveSeriesMetadata();

    return { success: true, series };
  }

  // Récupérer toutes les séries
  async getAllSeries() {
    if (!this.data.config) await this.load();
    return { success: true, series: this.data.seriesMetadata };
  }

  // Récupérer une série par ID avec ses épisodes
  async getSeriesById(seriesId) {
    if (!this.data.config) await this.load();

    // Trouver la série dans les métadonnées
    const seriesMetadata = this.data.seriesMetadata.find(s => s.id === seriesId);
    if (!seriesMetadata) {
      return { success: false, message: 'Série non trouvée dans les métadonnées' };
    }

    // Trouver tous les épisodes de cette série
    const episodes = this.data.seriesEpisodes.filter(media => media.seriesId === seriesId);

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

  // Ajouter un épisode à une série
  async addEpisodeToSeries(episodeData) {
    if (!this.data.config) await this.load();

    // Trouver la série dans les métadonnées
    const series = this.data.seriesMetadata.find(s => s.id === episodeData.seriesId);
    if (!series) {
      return { success: false, message: 'Série non trouvée dans les métadonnées' };
    }

    // Vérifier si l'épisode existe déjà
    const existingEpisode = this.data.seriesEpisodes.find(m => m.path === episodeData.path);
    if (existingEpisode) {
      return { success: false, message: 'Épisode déjà existant' };
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

    this.data.seriesEpisodes.push(episode);

    // Mettre à jour le compteur d'épisodes
    const totalEpisodes = this.data.seriesEpisodes.filter(m => m.seriesId === episodeData.seriesId).length;
    series.episodeCount = totalEpisodes;

    // Mettre à jour les statistiques
    this.data.config.settings.totalMedias = this.data.uniqueMedias.length + this.data.seriesEpisodes.length;
    this.data.config.settings.lastScan = new Date().toISOString();

    // Utiliser la sauvegarde immédiate pour éviter les problèmes de throttling lors d'imports en masse
    await this.saveSeriesEpisodesImmediate();
    await this.saveSeriesMetadata();
    await this.saveConfig();

    // Ajouter automatiquement l'épisode à la saison "Non assignés"
    await this.addEpisodeToDefaultSeason(episodeData.seriesId);

    console.log(`📺 Épisode ajouté à la série "${series.name}": ${episode.title}`);
    return { success: true, episode, series };
  }

  // Mettre à jour une série
  async updateSeries(seriesId, updates) {
    if (!this.data.config) await this.load();

    const seriesIndex = this.data.seriesMetadata.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) {
      return { success: false, message: 'Série non trouvée' };
    }

    this.data.seriesMetadata[seriesIndex] = { ...this.data.seriesMetadata[seriesIndex], ...updates };
    await this.saveSeriesMetadata();

    return { success: true, series: this.data.seriesMetadata[seriesIndex] };
  }

  // Supprimer une série
  async deleteSeries(seriesId) {
    if (!this.data.config) await this.load();

    const seriesIndex = this.data.seriesMetadata.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) {
      return { success: false, message: 'Série non trouvée' };
    }

    // Vérifier si des épisodes sont associés
    const relatedEpisodes = this.data.seriesEpisodes.filter(m => m.seriesId === seriesId);
    if (relatedEpisodes.length > 0) {
      return { success: false, message: `Impossible de supprimer la série: ${relatedEpisodes.length} épisode(s) associé(s)` };
    }

    this.data.seriesMetadata.splice(seriesIndex, 1);
    await this.saveSeriesMetadata();

    return { success: true };
  }

  // Nettoyer les séries corrompues
  async cleanupCorruptedSeries() {
    if (!this.data.config) await this.load();

    const initialCount = this.data.seriesMetadata.length;
    this.data.seriesMetadata = this.data.seriesMetadata.filter(serie => {
      if (!serie.id) {
        console.warn(`🧹 Suppression de la série corrompue sans ID: "${serie.name}"`);
        return false;
      }
      return true;
    });

    const cleanedCount = initialCount - this.data.seriesMetadata.length;
    if (cleanedCount > 0) {
      await this.saveSeriesMetadata();
      console.log(`🧹 ${cleanedCount} série(s) corrompue(s) supprimée(s)`);
    }

    return { success: true, cleaned: cleanedCount };
  }

  // ============================================
  // GESTION DES SAISONS
  // ============================================

  /**
   * Récupérer les saisons d'une série
   */
  async getSeriesSeasons(seriesId) {
    if (!this.data.config) await this.load();

    // Retourner les saisons de cette série ou un tableau vide
    const seasons = this.data.seriesSeasons[seriesId] || [];
    return { success: true, seasons };
  }

  /**
   * Sauvegarder les saisons d'une série
   */
  async saveSeriesSeasons(seriesId, seasons) {
    if (!this.data.config) await this.load();

    // Vérifier que la série existe
    const series = this.data.seriesMetadata.find(s => s.id === seriesId);
    if (!series) {
      return { success: false, message: 'Série non trouvée' };
    }

    // Sauvegarder les saisons pour cette série
    this.data.seriesSeasons[seriesId] = seasons;
    await this.saveSeriesSeasonsData();

    console.log(`✅ Saisons sauvegardées pour la série "${series.name}": ${seasons.length} saison(s)`);
    return { success: true };
  }

  /**
   * Ajouter automatiquement les épisodes non assignés à la saison par défaut
   */
  async addEpisodeToDefaultSeason(seriesId) {
    if (!this.data.config) await this.load();

    // Récupérer ou initialiser les saisons de cette série
    if (!this.data.seriesSeasons[seriesId]) {
      this.data.seriesSeasons[seriesId] = [];
    }

    const seasons = this.data.seriesSeasons[seriesId];

    // Chercher la saison par défaut (order = 0)
    let defaultSeason = seasons.find(s => s.order === 0);

    // Si elle n'existe pas, la créer
    if (!defaultSeason) {
      defaultSeason = {
        id: 'season-0',
        order: 0,
        type: 'default',
        name: 'Non assignés',
        isEditable: false,
        episodes: []
      };
      seasons.unshift(defaultSeason);
      console.log(`📦 Création de la saison "Non assignés" pour la série ${seriesId}`);
    }

    // Récupérer tous les épisodes de cette série
    const seriesEpisodes = this.data.seriesEpisodes.filter(ep => ep.seriesId === seriesId);

    // Récupérer tous les épisodes déjà assignés à d'autres saisons
    const assignedEpisodes = new Set();
    seasons.forEach(season => {
      if (season.order !== 0 && season.episodes) {
        season.episodes.forEach(ep => {
          if (ep !== null) {
            assignedEpisodes.add(ep);
          }
        });
      }
    });

    // Calculer les indices des épisodes non assignés
    const unassignedIndices = seriesEpisodes
      .map((_, index) => index)
      .filter(index => !assignedEpisodes.has(index));

    // Mettre à jour la saison par défaut
    defaultSeason.episodes = unassignedIndices;

    // Sauvegarder les saisons
    await this.saveSeriesSeasonsData();

    console.log(`📦 Saison "Non assignés" mise à jour: ${unassignedIndices.length} épisode(s)`);
  }

  // ============================================
  // GESTION DES MINIATURES
  // ============================================

  getThumbnailPath(thumbnailName) {
    return path.join(this.thumbnailsPath, thumbnailName);
  }

  generateThumbnailName(mediaPath) {
    return `thumb_${Date.now()}.jpg`;
  }

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

  // ============================================
  // SYSTÈME DE TAGS
  // ============================================

  enrichMediaData(mediaData) {
    const enriched = { ...mediaData };

    if (enriched.year) {
      enriched.decade = this.calculateDecade(enriched.year);
    }

    if (enriched.duration) {
      enriched.durationFormatted = this.formatDuration(enriched.duration);
      enriched.durationCategory = this.categorizeDuration(enriched.duration);
    }

    enriched.genres = enriched.genres || [];
    enriched.actors = enriched.actors || [];
    enriched.director = enriched.director || '';
    enriched.mood = enriched.mood || [];
    enriched.technical = enriched.technical || [];
    enriched.personalTags = enriched.personalTags || [];
    enriched.franchise = enriched.franchise || '';

    return enriched;
  }

  enrichSeriesData(seriesData) {
    const enriched = { ...seriesData };

    if (enriched.startYear || enriched.year) {
      const year = enriched.startYear || enriched.year;
      enriched.decade = this.calculateDecade(year);
      if (!enriched.startYear && enriched.year) {
        enriched.startYear = enriched.year;
      }
    }

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

  calculateDecade(year) {
    if (!year) return null;
    const decade = Math.floor(year / 10) * 10;
    return `${decade}s`;
  }

  formatDuration(minutes) {
    if (!minutes) return '0min';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`;
    }
    return `${mins}min`;
  }

  categorizeDuration(minutes) {
    if (!minutes) return 'unknown';
    if (minutes < 90) return 'court';
    if (minutes <= 150) return 'moyen';
    return 'long';
  }

  // ============================================
  // GESTION DES PERSONNES
  // ============================================

  async savePersons() {
    return this.saveThrottled('persons', () =>
      this.saveFileAtomic(this.paths.persons, this.data.persons)
    );
  }

  async savePersonsImmediate() {
    return this.saveFileAtomic(this.paths.persons, this.data.persons);
  }

  async getAllPersons() {
    if (!this.data.config) await this.load();
    return { success: true, persons: this.data.persons };
  }

  async getPersonById(personId) {
    if (!this.data.config) await this.load();
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) {
      return { success: false, message: 'Personne non trouvée' };
    }
    return { success: true, person };
  }

  async getPersonByTmdbId(tmdbId) {
    if (!this.data.config) await this.load();
    const person = this.data.persons.find(p => p.tmdbId === tmdbId);
    if (!person) {
      return { success: false, message: 'Personne non trouvée' };
    }
    return { success: true, person };
  }

  async addPerson(personData) {
    if (!this.data.config) await this.load();

    // Vérifier si la personne existe déjà par tmdbId
    if (personData.tmdbId) {
      const existing = this.data.persons.find(p => p.tmdbId === personData.tmdbId);
      if (existing) {
        return { success: true, person: existing, alreadyExists: true };
      }
    }

    const person = {
      id: crypto.randomBytes(8).toString('hex'),
      tmdbId: personData.tmdbId || null,
      name: personData.name || '',
      photo: personData.photo || null,
      biography: personData.biography || null,
      birthday: personData.birthday || null,
      deathday: personData.deathday || null,
      placeOfBirth: personData.placeOfBirth || null,
      knownForDepartment: personData.knownForDepartment || null,
      roles: personData.roles || [],
      dateAdded: new Date().toISOString()
    };

    this.data.persons.push(person);
    await this.savePersonsImmediate();

    console.log(`👤 Personne ajoutée: ${person.name}`);
    return { success: true, person };
  }

  async updatePerson(personId, updates) {
    if (!this.data.config) await this.load();

    const personIndex = this.data.persons.findIndex(p => p.id === personId);
    if (personIndex === -1) {
      return { success: false, message: 'Personne non trouvée' };
    }

    // Ne pas écraser id et dateAdded
    const { id, dateAdded, ...safeUpdates } = updates;
    Object.assign(this.data.persons[personIndex], safeUpdates);

    await this.savePersonsImmediate();

    console.log(`👤 Personne mise à jour: ${this.data.persons[personIndex].name}`);
    return { success: true, person: this.data.persons[personIndex] };
  }

  async deletePerson(personId) {
    if (!this.data.config) await this.load();

    const personIndex = this.data.persons.findIndex(p => p.id === personId);
    if (personIndex === -1) {
      return { success: false, message: 'Personne non trouvée' };
    }

    const person = this.data.persons[personIndex];

    // Supprimer la photo si elle existe
    if (person.photo) {
      const photoPath = path.join(this.personPhotosPath, person.photo);
      try {
        await fs.remove(photoPath);
      } catch (err) {
        console.warn(`⚠️ Impossible de supprimer la photo: ${photoPath}`);
      }
    }

    this.data.persons.splice(personIndex, 1);
    await this.savePersonsImmediate();

    console.log(`👤 Personne supprimée: ${person.name}`);
    return { success: true };
  }

  async linkPersonToMedia(personId, mediaId, mediaType, role, character = null) {
    if (!this.data.config) await this.load();

    const person = this.data.persons.find(p => p.id === personId);
    if (!person) {
      return { success: false, message: 'Personne non trouvée' };
    }

    // Vérifier si le lien existe déjà
    const existingRole = person.roles.find(
      r => r.mediaId === mediaId && r.role === role
    );
    if (existingRole) {
      // Mettre à jour le character si différent
      if (character && existingRole.character !== character) {
        existingRole.character = character;
        await this.savePersonsImmediate();
      }
      return { success: true, person, alreadyLinked: true };
    }

    person.roles.push({
      mediaId,
      mediaType: mediaType || 'unique',
      role,
      character: character || null
    });

    await this.savePersonsImmediate();

    console.log(`🔗 ${person.name} lié au média ${mediaId} en tant que ${role}`);
    return { success: true, person };
  }

  async unlinkPersonFromMedia(personId, mediaId, role = null) {
    if (!this.data.config) await this.load();

    const person = this.data.persons.find(p => p.id === personId);
    if (!person) {
      return { success: false, message: 'Personne non trouvée' };
    }

    if (role) {
      person.roles = person.roles.filter(
        r => !(r.mediaId === mediaId && r.role === role)
      );
    } else {
      person.roles = person.roles.filter(r => r.mediaId !== mediaId);
    }

    await this.savePersonsImmediate();

    console.log(`🔗 ${person.name} délié du média ${mediaId}`);
    return { success: true, person };
  }

  async getPersonsForMedia(mediaId) {
    if (!this.data.config) await this.load();

    const persons = this.data.persons.filter(
      p => p.roles.some(r => r.mediaId === mediaId)
    ).map(p => ({
      ...p,
      roles: p.roles.filter(r => r.mediaId === mediaId)
    }));

    return { success: true, persons };
  }

  async searchPersons(query) {
    if (!this.data.config) await this.load();

    const normalizedQuery = query.toLowerCase().trim();
    const results = this.data.persons.filter(
      p => p.name.toLowerCase().includes(normalizedQuery)
    );

    return { success: true, persons: results };
  }

}

module.exports = JSONDatabase;
