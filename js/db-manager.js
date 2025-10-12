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
      appConfig: path.join(this.dbDir, 'app_config.json')
    };

    // Ancien fichier pour migration
    this.oldDbPath = dbPath;

    // Dossiers pour assets
    this.thumbnailsPath = path.join(this.dataDir, 'thumbnails');
    this.tmdbImagesPath = path.join(this.dataDir, 'tmdb-images');

    // Données en mémoire
    this.data = {
      uniqueMedias: [],
      seriesEpisodes: [],
      seriesMetadata: [],
      config: null
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
    fs.ensureDirSync(this.tmdbImagesPath);
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

    // Vérifier si migration nécessaire
    const needsMigration = await this.checkMigrationNeeded();
    if (needsMigration) {
      console.log('🔄 Migration détectée, lancement...');
      await this.migrateFromOldFormat();
      return;
    }

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

    // Charger la configuration
    this.data.config = await this.loadFileWithBackup(
      this.paths.appConfig,
      this.getDefaultConfig()
    );

    console.log(`✅ Base chargée: ${this.data.uniqueMedias.length} médias uniques, ${this.data.seriesEpisodes.length} épisodes, ${this.data.seriesMetadata.length} séries`);
  }

  /**
   * Vérifier si une migration est nécessaire
   */
  async checkMigrationNeeded() {
    // Si l'ancien fichier existe et que les nouveaux n'existent pas
    const oldExists = await fs.pathExists(this.oldDbPath);
    const newExists = await fs.pathExists(this.paths.uniqueMedias);

    return oldExists && !newExists;
  }

  /**
   * Migrer depuis l'ancien format medias.json
   */
  async migrateFromOldFormat() {
    console.log('🔄 Début de la migration depuis medias.json...');

    try {
      // Charger l'ancien fichier
      const rawData = await fs.readFile(this.oldDbPath, 'utf8');
      const oldData = JSON.parse(rawData);

      // Créer un backup de l'ancien fichier
      const backupOldPath = `${this.oldDbPath}.old`;
      await fs.copy(this.oldDbPath, backupOldPath);
      console.log(`📦 Backup créé: ${path.basename(backupOldPath)}`);

      // Séparer les médias par type
      const uniqueMedias = [];
      const seriesEpisodes = [];

      (oldData.medias || []).forEach(media => {
        if (media.category === 'series' && media.seriesId) {
          seriesEpisodes.push(media);
        } else {
          uniqueMedias.push(media);
        }
      });

      // Assigner les données
      this.data.uniqueMedias = uniqueMedias;
      this.data.seriesEpisodes = seriesEpisodes;
      this.data.seriesMetadata = oldData.series || [];
      this.data.config = {
        settings: oldData.settings || {},
        categories: oldData.categories || [],
        tagManager: oldData.tagManager || {}
      };

      // Ajouter les valeurs par défaut si manquantes
      this.data.config = { ...this.getDefaultConfig(), ...this.data.config };

      // Sauvegarder dans les nouveaux fichiers
      await this.saveAll();

      console.log(`✅ Migration terminée:`);
      console.log(`   - ${uniqueMedias.length} médias uniques`);
      console.log(`   - ${seriesEpisodes.length} épisodes`);
      console.log(`   - ${this.data.seriesMetadata.length} séries`);

    } catch (error) {
      console.error('❌ Erreur lors de la migration:', error);
      throw error;
    }
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
      this.saveFileAtomic(this.paths.appConfig, this.data.config)
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
   * Sauvegarder uniquement les épisodes (throttled)
   */
  async saveSeriesEpisodes() {
    return this.saveThrottled('seriesEpisodes', () =>
      this.saveFileAtomic(this.paths.seriesEpisodes, this.data.seriesEpisodes)
    );
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
   * Sauvegarder uniquement la config (throttled)
   */
  async saveConfig() {
    return this.saveThrottled('config', () =>
      this.saveFileAtomic(this.paths.appConfig, this.data.config)
    );
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

  // Obtenir les médias par catégorie
  async getMediasByCategory(category) {
    if (!this.data.config) await this.load();

    if (category === 'all') {
      return [...this.data.uniqueMedias, ...this.data.seriesEpisodes];
    }

    if (category === 'series') {
      return this.data.seriesEpisodes;
    }

    return this.data.uniqueMedias.filter(m => m.category === category);
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

    await this.saveUniqueMedias();
    await this.saveConfig();

    return { success: true, media };
  }

  // Mettre à jour un média existant
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

    // Sauvegarder le fichier approprié
    if (isEpisode) {
      await this.saveSeriesEpisodes();
    } else {
      await this.saveUniqueMedias();
    }

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

  // Rechercher des médias
  async searchMedias(query) {
    if (!this.data.config) await this.load();
    const lowerQuery = query.toLowerCase();

    const allMedias = [...this.data.uniqueMedias, ...this.data.seriesEpisodes];

    return allMedias.filter(media =>
      media.title.toLowerCase().includes(lowerQuery) ||
      (media.description && media.description.toLowerCase().includes(lowerQuery))
    );
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

    await this.saveSeriesEpisodes();
    await this.saveSeriesMetadata();
    await this.saveConfig();

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
  // GESTION DES MINIATURES
  // ============================================

  getThumbnailPath(thumbnailName) {
    return path.join(this.thumbnailsPath, thumbnailName);
  }

  generateThumbnailName(mediaPath) {
    const hash = crypto.createHash('md5').update(mediaPath).digest('hex').substring(0, 8);
    const baseName = path.basename(mediaPath, path.extname(mediaPath));
    return `thumb_${hash}_${Date.now()}.jpg`;
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

  async cleanupThumbnails() {
    if (!this.data.config) await this.load();

    try {
      const thumbnailFiles = await fs.readdir(this.thumbnailsPath);
      const allMedias = [...this.data.uniqueMedias, ...this.data.seriesEpisodes];
      const usedThumbnails = allMedias
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

  categorizeSeriesLength(totalSeasons) {
    if (!totalSeasons || totalSeasons === 0) return 'unknown';
    if (totalSeasons === 1) return 'mini-série';
    if (totalSeasons <= 3) return 'série-courte';
    if (totalSeasons <= 6) return 'série-moyenne';
    return 'série-longue';
  }

  // Ajouter un tag personnalisé
  async addCustomTag(tagName) {
    if (!this.data.config) await this.load();

    const normalizedTag = tagName.toLowerCase().trim();

    if (!this.data.config.tagManager.customTags.includes(normalizedTag)) {
      this.data.config.tagManager.customTags.push(normalizedTag);
      this.data.config.tagManager.tagStats[normalizedTag] = 0;
      await this.saveConfig();
      return { success: true, tag: normalizedTag };
    }

    return { success: false, message: 'Tag déjà existant' };
  }

  async removeCustomTag(tagName) {
    if (!this.data.config) await this.load();

    const normalizedTag = tagName.toLowerCase().trim();
    const index = this.data.config.tagManager.customTags.indexOf(normalizedTag);

    if (index > -1) {
      this.data.config.tagManager.customTags.splice(index, 1);
      delete this.data.config.tagManager.tagStats[normalizedTag];

      // Supprimer de tous les médias
      const allMedias = [...this.data.uniqueMedias, ...this.data.seriesEpisodes];
      allMedias.forEach(media => {
        if (media.personalTags) {
          media.personalTags = media.personalTags.filter(tag => tag !== normalizedTag);
        }
      });

      this.data.seriesMetadata.forEach(series => {
        if (series.personalTags) {
          series.personalTags = series.personalTags.filter(tag => tag !== normalizedTag);
        }
      });

      await this.saveAll();
      return { success: true };
    }

    return { success: false, message: 'Tag non trouvé' };
  }

  async addTagsToMedia(mediaId, tags, tagType = 'personalTags') {
    if (!this.data.config) await this.load();

    // Chercher dans les médias uniques
    let media = this.data.uniqueMedias.find(m => m.id === mediaId);
    let isEpisode = false;

    if (!media) {
      media = this.data.seriesEpisodes.find(m => m.id === mediaId);
      isEpisode = true;
    }

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

        if (!this.data.config.tagManager.tagStats[normalizedTag]) {
          this.data.config.tagManager.tagStats[normalizedTag] = 0;
        }
        this.data.config.tagManager.tagStats[normalizedTag]++;
      }
    });

    if (isEpisode) {
      await this.saveSeriesEpisodes();
    } else {
      await this.saveUniqueMedias();
    }
    await this.saveConfig();

    return { success: true, addedTags };
  }

  async removeTagsFromMedia(mediaId, tags, tagType = 'personalTags') {
    if (!this.data.config) await this.load();

    let media = this.data.uniqueMedias.find(m => m.id === mediaId);
    let isEpisode = false;

    if (!media) {
      media = this.data.seriesEpisodes.find(m => m.id === mediaId);
      isEpisode = true;
    }

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

        if (this.data.config.tagManager.tagStats[normalizedTag]) {
          this.data.config.tagManager.tagStats[normalizedTag]--;
          if (this.data.config.tagManager.tagStats[normalizedTag] <= 0) {
            delete this.data.config.tagManager.tagStats[normalizedTag];
          }
        }
      }
    });

    if (isEpisode) {
      await this.saveSeriesEpisodes();
    } else {
      await this.saveUniqueMedias();
    }
    await this.saveConfig();

    return { success: true, removedTags };
  }

  async searchByTags(searchTags, operator = 'AND') {
    if (!this.data.config) await this.load();

    const normalizedSearchTags = searchTags.map(tag => tag.toLowerCase().trim());
    const allMedias = [...this.data.uniqueMedias, ...this.data.seriesEpisodes];

    return allMedias.filter(media => {
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
        return normalizedSearchTags.every(searchTag =>
          allMediaTags.some(mediaTag => mediaTag.includes(searchTag))
        );
      } else {
        return normalizedSearchTags.some(searchTag =>
          allMediaTags.some(mediaTag => mediaTag.includes(searchTag))
        );
      }
    });
  }

  async getAllTags() {
    if (!this.data.config) await this.load();

    return {
      success: true,
      tags: {
        predefined: this.data.config.tagManager.predefinedTags,
        custom: this.data.config.tagManager.customTags,
        stats: this.data.config.tagManager.tagStats
      }
    };
  }

  async getTagSuggestions(query, limit = 10) {
    if (!this.data.config) await this.load();

    const normalizedQuery = query.toLowerCase().trim();
    const suggestions = [];

    Object.values(this.data.config.tagManager.predefinedTags || {}).forEach(tagGroup => {
      tagGroup.forEach(tag => {
        if (tag.toLowerCase().includes(normalizedQuery)) {
          suggestions.push({ tag, type: 'predefined' });
        }
      });
    });

    (this.data.config.tagManager.customTags || []).forEach(tag => {
      if (tag.includes(normalizedQuery)) {
        suggestions.push({ tag, type: 'custom' });
      }
    });

    suggestions.sort((a, b) => {
      const aStats = this.data.config.tagManager.tagStats[a.tag] || 0;
      const bStats = this.data.config.tagManager.tagStats[b.tag] || 0;
      return bStats - aStats;
    });

    return { success: true, suggestions: suggestions.slice(0, limit) };
  }

  async migrateToTagSystem() {
    if (!this.data.config) await this.load();

    console.log('🔄 Migration vers le système de tags...');

    let migrationCount = 0;

    const allMedias = [...this.data.uniqueMedias, ...this.data.seriesEpisodes];
    allMedias.forEach(media => {
      const originalData = { ...media };
      const enrichedData = this.enrichMediaData(media);

      if (JSON.stringify(originalData) !== JSON.stringify(enrichedData)) {
        Object.assign(media, enrichedData);
        migrationCount++;
      }
    });

    this.data.seriesMetadata.forEach(series => {
      const originalData = { ...series };
      const enrichedData = this.enrichSeriesData(series);

      if (series.totalSeasons) {
        enrichedData.seriesLength = this.categorizeSeriesLength(series.totalSeasons);
      }

      if (JSON.stringify(originalData) !== JSON.stringify(enrichedData)) {
        Object.assign(series, enrichedData);
        migrationCount++;
      }
    });

    if (migrationCount > 0) {
      await this.saveAll();
      console.log(`✅ Migration terminée: ${migrationCount} éléments mis à jour`);
    } else {
      console.log('ℹ️ Aucune migration nécessaire');
    }

    return { success: true, migrationCount };
  }
}

module.exports = JSONDatabase;
