'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

class SQLiteDatabase {
  constructor(dbPath) {
    this.dataDir = path.dirname(dbPath);
    this.dbDir = path.join(this.dataDir, 'database');
    this.dbFilePath = path.join(this.dbDir, 'rackoon.db');
    this.thumbnailsPath = path.join(this.dataDir, 'thumbnails');
    this.personPhotosPath = path.join(this.dataDir, 'person-photos');
    this.db = null;
  }

  async load() {
    fs.ensureDirSync(this.dbDir);
    fs.ensureDirSync(this.thumbnailsPath);
    fs.ensureDirSync(this.personPhotosPath);

    const Database = require('better-sqlite3');
    this.db = new Database(this.dbFilePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._createSchema();
    this._ensureDefaults();
    console.log('✅ Base SQLite chargée:', this.dbFilePath);
  }

  _createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS medias (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        path TEXT UNIQUE NOT NULL,
        format TEXT DEFAULT '',
        duration REAL DEFAULT 0,
        size_bytes INTEGER DEFAULT 0,
        thumbnail TEXT,
        category TEXT DEFAULT 'unsorted',
        media_type TEXT DEFAULT 'unique',
        description TEXT DEFAULT '',
        date_added TEXT,
        last_watched TEXT,
        rating REAL DEFAULT 0,
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        duration_formatted TEXT,
        duration_category TEXT,
        decade TEXT,
        franchise TEXT DEFAULT '',
        year INTEGER,
        release_date TEXT,
        poster_url TEXT DEFAULT '',
        series_id TEXT,
        series_name TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        director TEXT DEFAULT '',
        genres TEXT DEFAULT '[]',
        actors TEXT DEFAULT '[]',
        mood TEXT DEFAULT '[]',
        technical TEXT DEFAULT '[]',
        personal_tags TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS series (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        franchise TEXT DEFAULT '',
        networks TEXT DEFAULT '[]',
        country TEXT DEFAULT '',
        status TEXT DEFAULT 'unknown',
        date_added TEXT,
        episode_count INTEGER DEFAULT 0,
        year INTEGER,
        start_year INTEGER,
        decade TEXT,
        creator TEXT DEFAULT '',
        platform TEXT DEFAULT '',
        genres TEXT DEFAULT '[]',
        main_actors TEXT DEFAULT '[]',
        creators TEXT DEFAULT '[]',
        mood TEXT DEFAULT '[]',
        personal_tags TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS seasons (
        series_id TEXT NOT NULL,
        season_key TEXT NOT NULL,
        order_num INTEGER NOT NULL DEFAULT 0,
        type TEXT DEFAULT 'standard',
        name TEXT DEFAULT '',
        season_number INTEGER,
        episode_from INTEGER,
        episode_to INTEGER,
        is_editable INTEGER DEFAULT 1,
        PRIMARY KEY (series_id, season_key)
      );

      CREATE TABLE IF NOT EXISTS season_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id TEXT NOT NULL,
        season_key TEXT NOT NULL,
        slot_index INTEGER NOT NULL,
        media_id TEXT,
        UNIQUE(series_id, season_key, slot_index)
      );

      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        tmdb_id INTEGER,
        name TEXT NOT NULL,
        photo TEXT,
        biography TEXT,
        birthday TEXT,
        deathday TEXT,
        place_of_birth TEXT,
        known_for_department TEXT,
        date_added TEXT
      );

      CREATE TABLE IF NOT EXISTS person_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id TEXT NOT NULL,
        media_id TEXT NOT NULL,
        media_type TEXT DEFAULT 'unique',
        role TEXT NOT NULL,
        character_name TEXT,
        UNIQUE(person_id, media_id, role)
      );

      CREATE TABLE IF NOT EXISTS user_prefs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  _ensureDefaults() {
    const hasVersion = this.db.prepare("SELECT value FROM app_config WHERE key='version'").get();
    if (!hasVersion) {
      const cfg = this._defaultConfig();
      const ins = this.db.prepare('INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)');
      ins.run('version', cfg.settings.version);
      ins.run('lastScan', JSON.stringify(null));
      ins.run('categories', JSON.stringify(cfg.categories));
      ins.run('tagManager', JSON.stringify(cfg.tagManager));
    }
    const insP = this.db.prepare("INSERT OR IGNORE INTO user_prefs (key, value) VALUES (?, '{}')");
    for (const k of ['ratings', 'watchedMovies', 'watchCount', 'lastWatched', 'playProgress']) {
      insP.run(k);
    }
  }

  _defaultConfig() {
    return {
      settings: { version: '2.0.0', lastScan: null, totalMedias: 0 },
      categories: [
        { id: 'films', name: 'Films', icon: '🎬', count: 0 },
        { id: 'series', name: 'Séries', icon: '📺', count: 0 },
        { id: 'documentaires', name: 'Documentaires', icon: '📚', count: 0 },
        { id: 'concerts', name: 'Concerts', icon: '🎵', count: 0 },
        { id: 'unsorted', name: 'Non triés', icon: '📁', count: 0 }
      ],
      tagManager: {
        predefinedTags: {
          genres: ['Action','Aventure','Comédie','Drame','Horreur','Thriller',
            'Romance','Science-fiction','Fantasy','Documentaire','Animation',
            'Guerre','Western','Musical','Crime','Mystère','Biographie'],
          moods: ['Détente','Soirée entre amis','Famille','Date night','Nostalgie',
            'Frissons','Réflexion','Motivation','Escapisme','Tension','Feel-good'],
          technical: ['4K','HD','SD','HDR','Dolby','IMAX','Blu-ray','DVD'],
          personal: ['Coup de cœur','À revoir','Overrated','Underrated','Comfort food',
            'Guilty pleasure',"Chef-d'œuvre",'Déçu','Surprise'],
          collections: ['Marvel','DC','Star Wars','Bond','Fast & Furious','Pixar',
            'Studio Ghibli','Disney','Christopher Nolan','Tarantino']
        },
        customTags: [],
        tagStats: {}
      }
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  generateId() { return crypto.randomBytes(8).toString('hex'); }

  _j(v, fallback = []) {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  _s(v) { return JSON.stringify(v || []); }

  _mediaFromRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      path: row.path,
      format: row.format,
      duration: row.duration,
      size_bytes: row.size_bytes,
      thumbnail: row.thumbnail,
      category: row.category,
      mediaType: row.media_type,
      description: row.description,
      dateAdded: row.date_added,
      lastWatched: row.last_watched,
      rating: row.rating,
      width: row.width,
      height: row.height,
      durationFormatted: row.duration_formatted,
      durationCategory: row.duration_category,
      decade: row.decade,
      franchise: row.franchise,
      year: row.year,
      releaseDate: row.release_date,
      posterUrl: row.poster_url,
      seriesId: row.series_id,
      seriesName: row.series_name,
      season_number: row.season_number,
      episode_number: row.episode_number,
      director: row.director,
      genres: this._j(row.genres),
      actors: this._j(row.actors),
      mood: this._j(row.mood),
      technical: this._j(row.technical),
      personalTags: this._j(row.personal_tags)
    };
  }

  _seriesFromRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      franchise: row.franchise,
      networks: this._j(row.networks),
      country: row.country,
      status: row.status,
      dateAdded: row.date_added,
      episodeCount: row.episode_count,
      year: row.year,
      startYear: row.start_year,
      decade: row.decade,
      creator: row.creator,
      platform: row.platform,
      genres: this._j(row.genres),
      mainActors: this._j(row.main_actors),
      actors: this._j(row.main_actors),
      creators: this._j(row.creators),
      mood: this._j(row.mood),
      personalTags: this._j(row.personal_tags)
    };
  }

  _personFromRow(row) {
    if (!row) return null;
    const roles = this.db.prepare('SELECT * FROM person_roles WHERE person_id = ?').all(row.id);
    return {
      id: row.id,
      tmdbId: row.tmdb_id,
      name: row.name,
      photo: row.photo,
      biography: row.biography,
      birthday: row.birthday,
      deathday: row.deathday,
      placeOfBirth: row.place_of_birth,
      knownForDepartment: row.known_for_department,
      dateAdded: row.date_added,
      roles: roles.map(r => ({
        mediaId: r.media_id,
        mediaType: r.media_type,
        role: r.role,
        character: r.character_name
      }))
    };
  }

  _updateLastScan() {
    this.db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('lastScan', ?)")
      .run(JSON.stringify(new Date().toISOString()));
  }

  // ── Medias ────────────────────────────────────────────────────────────────

  async getAllMedias() {
    return this.db.prepare('SELECT * FROM medias ORDER BY date_added DESC').all()
      .map(r => this._mediaFromRow(r));
  }

  async getMediaById(id) {
    return this._mediaFromRow(this.db.prepare('SELECT * FROM medias WHERE id = ?').get(id));
  }

  async addMedia(mediaData) {
    if (mediaData.category === 'series' && mediaData.seriesId) {
      return this.addEpisodeToSeries(mediaData);
    }
    const existing = this.db.prepare('SELECT id FROM medias WHERE path = ?').get(mediaData.path);
    if (existing) return { success: false, message: 'Média déjà existant' };

    const e = this.enrichMediaData(mediaData);
    const id = this.generateId();
    this._insertMedia(id, e);
    this._updateLastScan();
    const media = this._mediaFromRow(this.db.prepare('SELECT * FROM medias WHERE id = ?').get(id));
    return { success: true, media };
  }

  _insertMedia(id, e) {
    this.db.prepare(`
      INSERT INTO medias (
        id, title, path, format, duration, size_bytes, thumbnail, category, media_type,
        description, date_added, last_watched, rating, width, height,
        duration_formatted, duration_category, decade, franchise, year, release_date,
        poster_url, series_id, series_name, season_number, episode_number,
        director, genres, actors, mood, technical, personal_tags
      ) VALUES (
        @id, @title, @path, @format, @duration, @size_bytes, @thumbnail, @category, @media_type,
        @description, @date_added, @last_watched, @rating, @width, @height,
        @duration_formatted, @duration_category, @decade, @franchise, @year, @release_date,
        @poster_url, @series_id, @series_name, @season_number, @episode_number,
        @director, @genres, @actors, @mood, @technical, @personal_tags
      )
    `).run({
      id,
      title: e.title || '',
      path: e.path,
      format: e.format || '',
      duration: e.duration || 0,
      size_bytes: e.size_bytes || 0,
      thumbnail: e.thumbnail || null,
      category: e.category || 'unsorted',
      media_type: e.mediaType || 'unique',
      description: e.description || '',
      date_added: e.dateAdded || new Date().toISOString(),
      last_watched: e.lastWatched || null,
      rating: e.rating || 0,
      width: e.width || 0,
      height: e.height || 0,
      duration_formatted: e.durationFormatted || null,
      duration_category: e.durationCategory || null,
      decade: e.decade || null,
      franchise: e.franchise || '',
      year: e.year || null,
      release_date: e.releaseDate || null,
      poster_url: e.posterUrl || '',
      series_id: e.seriesId || null,
      series_name: e.seriesName || null,
      season_number: e.season_number || null,
      episode_number: e.episode_number || null,
      director: e.director || '',
      genres: this._s(e.genres),
      actors: this._s(e.actors),
      mood: this._s(e.mood),
      technical: this._s(e.technical),
      personal_tags: this._s(e.personalTags)
    });
  }

  async updateMedia(mediaData) {
    const existing = this.db.prepare('SELECT * FROM medias WHERE path = ?').get(mediaData.path);
    if (!existing) return { success: false, message: 'Média non trouvé pour mise à jour' };

    const e = this.enrichMediaData({ ...this._mediaFromRow(existing), ...mediaData });
    this._updateMediaFields(existing.id, e);

    if (mediaData.seriesId) await this.addEpisodeToDefaultSeason(mediaData.seriesId);

    return { success: true, media: this._mediaFromRow(this.db.prepare('SELECT * FROM medias WHERE id = ?').get(existing.id)) };
  }

  async updateMediaById(mediaId, updates) {
    const existing = this.db.prepare('SELECT * FROM medias WHERE id = ?').get(mediaId);
    if (!existing) return { success: false, message: 'Média non trouvé' };

    const e = this.enrichMediaData({ ...this._mediaFromRow(existing), ...updates });
    this._updateMediaFields(mediaId, e);

    if (updates.seriesId) await this.addEpisodeToDefaultSeason(updates.seriesId);

    const updated = this._mediaFromRow(this.db.prepare('SELECT * FROM medias WHERE id = ?').get(mediaId));
    console.log(`✅ Média mis à jour par ID: ${updated.title}`);
    return { success: true, media: updated };
  }

  _updateMediaFields(id, e) {
    this.db.prepare(`
      UPDATE medias SET
        title = @title, thumbnail = @thumbnail, category = @category, media_type = @media_type,
        description = @description, franchise = @franchise, year = @year,
        release_date = @release_date, poster_url = @poster_url,
        series_id = @series_id, series_name = @series_name,
        season_number = @season_number, episode_number = @episode_number,
        director = @director, genres = @genres, actors = @actors,
        mood = @mood, technical = @technical, personal_tags = @personal_tags,
        decade = @decade, duration_formatted = @duration_formatted,
        duration_category = @duration_category
      WHERE id = @id
    `).run({
      id,
      title: e.title || '',
      thumbnail: e.thumbnail !== undefined ? e.thumbnail : null,
      category: e.category || 'unsorted',
      media_type: e.mediaType || 'unique',
      description: e.description || '',
      franchise: e.franchise || '',
      year: e.year || null,
      release_date: e.releaseDate || null,
      poster_url: e.posterUrl || '',
      series_id: e.seriesId || null,
      series_name: e.seriesName || null,
      season_number: e.season_number || null,
      episode_number: e.episode_number || null,
      director: e.director || '',
      genres: this._s(e.genres),
      actors: this._s(e.actors),
      mood: this._s(e.mood),
      technical: this._s(e.technical),
      personal_tags: this._s(e.personalTags),
      decade: e.decade || null,
      duration_formatted: e.durationFormatted || null,
      duration_category: e.durationCategory || null
    });
  }

  async deleteMedia(id) {
    const row = this.db.prepare('SELECT * FROM medias WHERE id = ?').get(id);
    if (!row) return { success: false, message: 'Média non trouvé' };

    if (row.thumbnail) {
      try { fs.unlinkSync(path.join(this.thumbnailsPath, row.thumbnail)); } catch {}
    }
    this.db.prepare('UPDATE season_slots SET media_id = NULL WHERE media_id = ?').run(id);
    this.db.prepare('DELETE FROM medias WHERE id = ?').run(id);
    this._updateLastScan();
    return { success: true };
  }

  async clearAllMedias() {
    const totalMedias = this.db.prepare('SELECT COUNT(*) as c FROM medias').get().c;
    const totalSeries = this.db.prepare('SELECT COUNT(*) as c FROM series').get().c;
    const thumbnailsDeleted = await this.deleteAllThumbnails();

    this.db.exec('DELETE FROM season_slots; DELETE FROM seasons; DELETE FROM medias; DELETE FROM series;');
    this._updateLastScan();
    return { success: true, deleted: { medias: totalMedias, series: totalSeries, thumbnails: thumbnailsDeleted } };
  }

  // ── Series ────────────────────────────────────────────────────────────────

  async addSeries(seriesData) {
    const existing = this.db.prepare('SELECT id FROM series WHERE LOWER(name) = LOWER(?)').get(seriesData.name);
    if (existing) return { success: false, message: 'Série déjà existante' };

    const e = this.enrichSeriesData(seriesData);
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO series (
        id, name, description, franchise, networks, country, status,
        date_added, episode_count, year, start_year, decade, creator, platform,
        genres, main_actors, creators, mood, personal_tags
      ) VALUES (
        @id, @name, @description, @franchise, @networks, @country, @status,
        @date_added, 0, @year, @start_year, @decade, @creator, @platform,
        @genres, @main_actors, @creators, @mood, @personal_tags
      )
    `).run({
      id,
      name: e.name || '',
      description: e.description || '',
      franchise: e.franchise || '',
      networks: this._s(e.networks),
      country: e.country || '',
      status: e.status || 'unknown',
      date_added: new Date().toISOString(),
      year: e.year || null,
      start_year: e.startYear || null,
      decade: e.decade || null,
      creator: e.creator || '',
      platform: e.platform || '',
      genres: this._s(e.genres),
      main_actors: this._s(e.mainActors),
      creators: this._s(e.creators),
      mood: this._s(e.mood),
      personal_tags: this._s(e.personalTags)
    });

    const series = this._seriesFromRow(this.db.prepare('SELECT * FROM series WHERE id = ?').get(id));
    return { success: true, series };
  }

  async getAllSeries() {
    const series = this.db.prepare('SELECT * FROM series ORDER BY name').all().map(r => this._seriesFromRow(r));
    return { success: true, series };
  }

  async getSeriesById(seriesId) {
    const row = this.db.prepare('SELECT * FROM series WHERE id = ?').get(seriesId);
    if (!row) return { success: false, message: 'Série non trouvée dans les métadonnées' };

    const episodes = this.db.prepare(
      'SELECT * FROM medias WHERE series_id = ? ORDER BY season_number, episode_number'
    ).all(seriesId).map(r => this._mediaFromRow(r));

    const seasonsMap = new Map();
    episodes.forEach(ep => {
      const sn = ep.season_number || 1;
      if (!seasonsMap.has(sn)) seasonsMap.set(sn, { number: sn, episodes: [] });
      seasonsMap.get(sn).episodes.push(ep);
    });

    const seasons = Array.from(seasonsMap.values())
      .sort((a, b) => a.number - b.number)
      .map(s => ({ ...s, episodes: s.episodes.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0)) }));

    return { success: true, series: { ...this._seriesFromRow(row), episodeCount: episodes.length, seasons } };
  }

  async addEpisodeToSeries(episodeData) {
    const seriesRow = this.db.prepare('SELECT * FROM series WHERE id = ?').get(episodeData.seriesId);
    if (!seriesRow) return { success: false, message: 'Série non trouvée dans les métadonnées' };

    const existing = this.db.prepare('SELECT id FROM medias WHERE path = ?').get(episodeData.path);
    if (existing) return { success: false, message: 'Épisode déjà existant' };

    const id = this.generateId();
    const e = {
      ...episodeData,
      mediaType: 'series',
      category: 'series',
      seriesName: seriesRow.name,
      dateAdded: new Date().toISOString(),
      lastWatched: null,
      rating: 0
    };
    this._insertMedia(id, e);

    const count = this.db.prepare('SELECT COUNT(*) as c FROM medias WHERE series_id = ?').get(episodeData.seriesId).c;
    this.db.prepare('UPDATE series SET episode_count = ? WHERE id = ?').run(count, episodeData.seriesId);
    this._updateLastScan();
    await this.addEpisodeToDefaultSeason(episodeData.seriesId);

    const episode = this._mediaFromRow(this.db.prepare('SELECT * FROM medias WHERE id = ?').get(id));
    const series = this._seriesFromRow(this.db.prepare('SELECT * FROM series WHERE id = ?').get(episodeData.seriesId));
    console.log(`📺 Épisode ajouté à la série "${seriesRow.name}": ${episode.title}`);
    return { success: true, episode, series };
  }

  async updateSeries(seriesId, updates) {
    const existing = this.db.prepare('SELECT * FROM series WHERE id = ?').get(seriesId);
    if (!existing) return { success: false, message: 'Série non trouvée' };

    const e = this.enrichSeriesData({ ...this._seriesFromRow(existing), ...updates });
    this.db.prepare(`
      UPDATE series SET
        name = @name, description = @description, franchise = @franchise,
        networks = @networks, country = @country, status = @status,
        year = @year, start_year = @start_year, decade = @decade,
        creator = @creator, platform = @platform,
        genres = @genres, main_actors = @main_actors, creators = @creators,
        mood = @mood, personal_tags = @personal_tags
      WHERE id = @id
    `).run({
      id: seriesId,
      name: e.name,
      description: e.description || '',
      franchise: e.franchise || '',
      networks: this._s(e.networks),
      country: e.country || '',
      status: e.status || 'unknown',
      year: e.year || null,
      start_year: e.startYear || null,
      decade: e.decade || null,
      creator: e.creator || '',
      platform: e.platform || '',
      genres: this._s(e.genres),
      main_actors: this._s(e.mainActors),
      creators: this._s(e.creators),
      mood: this._s(e.mood),
      personal_tags: this._s(e.personalTags)
    });

    return { success: true, series: this._seriesFromRow(this.db.prepare('SELECT * FROM series WHERE id = ?').get(seriesId)) };
  }

  async deleteSeries(seriesId) {
    if (!this.db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId)) {
      return { success: false, message: 'Série non trouvée' };
    }
    const count = this.db.prepare('SELECT COUNT(*) as c FROM medias WHERE series_id = ?').get(seriesId).c;
    if (count > 0) return { success: false, message: `Impossible de supprimer la série: ${count} épisode(s) associé(s)` };

    this.db.prepare('DELETE FROM season_slots WHERE series_id = ?').run(seriesId);
    this.db.prepare('DELETE FROM seasons WHERE series_id = ?').run(seriesId);
    this.db.prepare('DELETE FROM series WHERE id = ?').run(seriesId);
    return { success: true };
  }

  async cleanupCorruptedSeries() {
    return { success: true, cleaned: 0 };
  }

  // ── Seasons ───────────────────────────────────────────────────────────────

  async getSeriesSeasons(seriesId) {
    const seasonRows = this.db.prepare(
      'SELECT * FROM seasons WHERE series_id = ? ORDER BY order_num'
    ).all(seriesId);

    const seasons = seasonRows.map(s => {
      const slots = this.db.prepare(
        'SELECT slot_index, media_id FROM season_slots WHERE series_id = ? AND season_key = ? ORDER BY slot_index'
      ).all(seriesId, s.season_key);

      const season = {
        id: s.season_key,
        order: s.order_num,
        type: s.type,
        name: s.name,
        isEditable: s.is_editable === 1,
        episodes: slots.map(sl => sl.media_id || null)
      };
      if (s.season_number !== null) season.seasonNumber = s.season_number;
      if (s.episode_from !== null && s.episode_to !== null) {
        season.episodeRange = { from: s.episode_from, to: s.episode_to };
      }
      return season;
    });

    return { success: true, seasons };
  }

  async saveSeriesSeasons(seriesId, seasons) {
    if (!this.db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId)) {
      return { success: false, message: 'Série non trouvée' };
    }

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM season_slots WHERE series_id = ?').run(seriesId);
      this.db.prepare('DELETE FROM seasons WHERE series_id = ?').run(seriesId);

      const insSeason = this.db.prepare(`
        INSERT INTO seasons (series_id, season_key, order_num, type, name, season_number, episode_from, episode_to, is_editable)
        VALUES (@series_id, @season_key, @order_num, @type, @name, @season_number, @episode_from, @episode_to, @is_editable)
      `);
      const insSlot = this.db.prepare(
        'INSERT OR REPLACE INTO season_slots (series_id, season_key, slot_index, media_id) VALUES (?, ?, ?, ?)'
      );

      for (const season of seasons) {
        insSeason.run({
          series_id: seriesId,
          season_key: season.id,
          order_num: season.order,
          type: season.type || 'standard',
          name: season.name || '',
          season_number: season.seasonNumber || null,
          episode_from: season.episodeRange?.from || null,
          episode_to: season.episodeRange?.to || null,
          is_editable: season.isEditable !== false ? 1 : 0
        });

        if (Array.isArray(season.episodes)) {
          season.episodes.forEach((ref, idx) => {
            const mediaId = typeof ref === 'string' ? ref : null;
            insSlot.run(seriesId, season.id, idx, mediaId);
          });
        }
      }
    });

    tx();
    console.log(`✅ Saisons sauvegardées pour la série ${seriesId}: ${seasons.length} saison(s)`);
    return { success: true };
  }

  async addEpisodeToDefaultSeason(seriesId) {
    const episodes = this.db.prepare(
      'SELECT id FROM medias WHERE series_id = ? ORDER BY rowid'
    ).all(seriesId);

    const assignedIds = new Set(
      this.db.prepare(
        "SELECT media_id FROM season_slots WHERE series_id = ? AND season_key != 'season-0' AND media_id IS NOT NULL"
      ).all(seriesId).map(r => r.media_id)
    );

    const unassigned = episodes.filter(ep => !assignedIds.has(ep.id));

    const hasDefault = this.db.prepare(
      "SELECT season_key FROM seasons WHERE series_id = ? AND season_key = 'season-0'"
    ).get(seriesId);

    if (!hasDefault) {
      this.db.prepare(
        "INSERT OR IGNORE INTO seasons (series_id, season_key, order_num, type, name, is_editable) VALUES (?, 'season-0', 0, 'default', 'Non assignés', 0)"
      ).run(seriesId);
    }

    this.db.prepare("DELETE FROM season_slots WHERE series_id = ? AND season_key = 'season-0'").run(seriesId);

    const ins = this.db.prepare(
      "INSERT INTO season_slots (series_id, season_key, slot_index, media_id) VALUES (?, 'season-0', ?, ?)"
    );
    unassigned.forEach((ep, idx) => ins.run(seriesId, idx, ep.id));

    console.log(`📦 Saison "Non assignés" mise à jour: ${unassigned.length} épisode(s)`);
  }

  // ── User Prefs ────────────────────────────────────────────────────────────

  async getUserPrefs() {
    const rows = this.db.prepare('SELECT key, value FROM user_prefs').all();
    const prefs = {};
    for (const r of rows) prefs[r.key] = this._j(r.value, {});
    return prefs;
  }

  async updateRating(mediaId, rating) {
    const row = this.db.prepare("SELECT value FROM user_prefs WHERE key = 'ratings'").get();
    const ratings = this._j(row?.value, {});
    ratings[mediaId] = rating;
    this.db.prepare("INSERT OR REPLACE INTO user_prefs (key, value) VALUES ('ratings', ?)").run(JSON.stringify(ratings));
    return { success: true };
  }

  async updateWatchStatus(mediaId, isWatched) {
    const row = this.db.prepare("SELECT value FROM user_prefs WHERE key = 'watchedMovies'").get();
    const watched = this._j(row?.value, {});
    if (isWatched) watched[mediaId] = true;
    else delete watched[mediaId];
    this.db.prepare("INSERT OR REPLACE INTO user_prefs (key, value) VALUES ('watchedMovies', ?)").run(JSON.stringify(watched));
    return { success: true };
  }

  // ── Persons ───────────────────────────────────────────────────────────────

  async getAllPersons() {
    return { success: true, persons: this.db.prepare('SELECT * FROM persons ORDER BY name').all().map(r => this._personFromRow(r)) };
  }

  async getPersonById(personId) {
    const row = this.db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    if (!row) return { success: false, message: 'Personne non trouvée' };
    return { success: true, person: this._personFromRow(row) };
  }

  async getPersonByTmdbId(tmdbId) {
    const row = this.db.prepare('SELECT * FROM persons WHERE tmdb_id = ?').get(tmdbId);
    if (!row) return { success: false, message: 'Personne non trouvée' };
    return { success: true, person: this._personFromRow(row) };
  }

  async addPerson(personData) {
    if (personData.tmdbId) {
      const existing = this.db.prepare('SELECT * FROM persons WHERE tmdb_id = ?').get(personData.tmdbId);
      if (existing) return { success: true, person: this._personFromRow(existing), alreadyExists: true };
    }
    const id = crypto.randomBytes(8).toString('hex');
    this.db.prepare(`
      INSERT INTO persons (id, tmdb_id, name, photo, biography, birthday, deathday, place_of_birth, known_for_department, date_added)
      VALUES (@id, @tmdb_id, @name, @photo, @biography, @birthday, @deathday, @place_of_birth, @known_for_department, @date_added)
    `).run({
      id,
      tmdb_id: personData.tmdbId || null,
      name: personData.name || '',
      photo: personData.photo || null,
      biography: personData.biography || null,
      birthday: personData.birthday || null,
      deathday: personData.deathday || null,
      place_of_birth: personData.placeOfBirth || null,
      known_for_department: personData.knownForDepartment || null,
      date_added: new Date().toISOString()
    });
    console.log(`👤 Personne ajoutée: ${personData.name}`);
    return { success: true, person: this._personFromRow(this.db.prepare('SELECT * FROM persons WHERE id = ?').get(id)) };
  }

  async updatePerson(personId, updates) {
    const existing = this.db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    if (!existing) return { success: false, message: 'Personne non trouvée' };
    const { id, dateAdded, ...safe } = updates;
    this.db.prepare(`
      UPDATE persons SET
        name = @name, photo = @photo, biography = @biography,
        birthday = @birthday, deathday = @deathday,
        place_of_birth = @place_of_birth, known_for_department = @known_for_department
      WHERE id = @id
    `).run({
      id: personId,
      name: safe.name ?? existing.name,
      photo: safe.photo !== undefined ? safe.photo : existing.photo,
      biography: safe.biography !== undefined ? safe.biography : existing.biography,
      birthday: safe.birthday !== undefined ? safe.birthday : existing.birthday,
      deathday: safe.deathday !== undefined ? safe.deathday : existing.deathday,
      place_of_birth: safe.placeOfBirth !== undefined ? safe.placeOfBirth : existing.place_of_birth,
      known_for_department: safe.knownForDepartment !== undefined ? safe.knownForDepartment : existing.known_for_department
    });
    const person = this._personFromRow(this.db.prepare('SELECT * FROM persons WHERE id = ?').get(personId));
    console.log(`👤 Personne mise à jour: ${person.name}`);
    return { success: true, person };
  }

  async deletePerson(personId) {
    const row = this.db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    if (!row) return { success: false, message: 'Personne non trouvée' };
    if (row.photo) {
      try { fs.removeSync(path.join(this.personPhotosPath, row.photo)); } catch {}
    }
    this.db.prepare('DELETE FROM person_roles WHERE person_id = ?').run(personId);
    this.db.prepare('DELETE FROM persons WHERE id = ?').run(personId);
    console.log(`👤 Personne supprimée: ${row.name}`);
    return { success: true };
  }

  async linkPersonToMedia(personId, mediaId, mediaType, role, character = null) {
    if (!this.db.prepare('SELECT id FROM persons WHERE id = ?').get(personId)) {
      return { success: false, message: 'Personne non trouvée' };
    }
    this.db.prepare(
      'INSERT OR IGNORE INTO person_roles (person_id, media_id, media_type, role, character_name) VALUES (?, ?, ?, ?, ?)'
    ).run(personId, mediaId, mediaType || 'unique', role, character || null);
    if (character) {
      this.db.prepare('UPDATE person_roles SET character_name = ? WHERE person_id = ? AND media_id = ? AND role = ?')
        .run(character, personId, mediaId, role);
    }
    const person = this._personFromRow(this.db.prepare('SELECT * FROM persons WHERE id = ?').get(personId));
    console.log(`🔗 ${person.name} lié au média ${mediaId} en tant que ${role}`);
    return { success: true, person };
  }

  async unlinkPersonFromMedia(personId, mediaId, role = null) {
    if (!this.db.prepare('SELECT id FROM persons WHERE id = ?').get(personId)) {
      return { success: false, message: 'Personne non trouvée' };
    }
    if (role) {
      this.db.prepare('DELETE FROM person_roles WHERE person_id = ? AND media_id = ? AND role = ?').run(personId, mediaId, role);
    } else {
      this.db.prepare('DELETE FROM person_roles WHERE person_id = ? AND media_id = ?').run(personId, mediaId);
    }
    return { success: true, person: this._personFromRow(this.db.prepare('SELECT * FROM persons WHERE id = ?').get(personId)) };
  }

  async getPersonsForMedia(mediaId) {
    const personIds = this.db.prepare('SELECT DISTINCT person_id FROM person_roles WHERE media_id = ?').all(mediaId);
    const persons = personIds.map(({ person_id }) => {
      const p = this._personFromRow(this.db.prepare('SELECT * FROM persons WHERE id = ?').get(person_id));
      if (p) p.roles = p.roles.filter(r => r.mediaId === mediaId);
      return p;
    }).filter(Boolean);
    return { success: true, persons };
  }

  async searchPersons(query) {
    const rows = this.db.prepare('SELECT * FROM persons WHERE LOWER(name) LIKE ? ORDER BY name').all(`%${query.toLowerCase()}%`);
    return { success: true, persons: rows.map(r => this._personFromRow(r)) };
  }

  // ── Thumbnails ────────────────────────────────────────────────────────────

  getThumbnailPath(thumbnailName) {
    return path.join(this.thumbnailsPath, thumbnailName);
  }

  generateThumbnailName() {
    return `thumb_${Date.now()}.jpg`;
  }

  async saveThumbnail(sourceImagePath) {
    try {
      const name = this.generateThumbnailName();
      await fs.copy(sourceImagePath, path.join(this.thumbnailsPath, name));
      return name;
    } catch { return null; }
  }

  async deleteAllThumbnails() {
    let count = 0;
    try {
      if (await fs.pathExists(this.thumbnailsPath)) {
        const files = await fs.readdir(this.thumbnailsPath);
        for (const f of files) {
          if (/\.(jpg|jpeg|png|webp)$/i.test(f)) {
            try { await fs.unlink(path.join(this.thumbnailsPath, f)); count++; } catch {}
          }
        }
      }
    } catch {}
    return count;
  }

  // ── Enrichment (same logic as JSONDatabase) ───────────────────────────────

  enrichMediaData(d) {
    const e = { ...d };
    if (e.year) e.decade = this._decade(e.year);
    if (e.duration) {
      e.durationFormatted = this._fmtDuration(e.duration);
      e.durationCategory = this._catDuration(e.duration);
    }
    e.genres = e.genres || [];
    e.actors = e.actors || [];
    e.director = e.director || '';
    e.mood = e.mood || [];
    e.technical = e.technical || [];
    e.personalTags = e.personalTags || [];
    e.franchise = e.franchise || '';
    return e;
  }

  enrichSeriesData(d) {
    const e = { ...d };
    const year = e.startYear || e.year;
    if (year) { e.decade = this._decade(year); if (!e.startYear) e.startYear = year; }
    e.genres = e.genres || [];
    e.mainActors = e.mainActors || e.actors || [];
    e.creators = e.creators || [];
    e.mood = e.mood || [];
    e.personalTags = e.personalTags || [];
    e.franchise = e.franchise || '';
    e.networks = e.networks || [];
    e.country = e.country || '';
    e.status = e.status || 'unknown';
    return e;
  }

  _decade(year) { return year ? `${Math.floor(year / 10) * 10}s` : null; }

  _fmtDuration(min) {
    if (!min) return '0min';
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`;
  }

  _catDuration(min) {
    if (!min) return 'unknown';
    if (min < 90) return 'court';
    if (min <= 150) return 'moyen';
    return 'long';
  }
}

module.exports = SQLiteDatabase;
