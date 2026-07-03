'use strict';

const path = require('path');
const fs = require('fs-extra');

/**
 * Migre les données JSON vers SQLite.
 * Appelé une seule fois au premier démarrage si rackoon.db n'existe pas.
 * Retourne l'instance SQLiteDatabase prête à l'emploi.
 */
async function migrateToSQLite(dataDir, SQLiteDatabase) {
  const dbDir = path.join(dataDir, 'database');

  function loadJson(file, fallback) {
    try {
      const p = path.join(dbDir, file);
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.warn(`⚠️  Impossible de lire ${file}:`, e.message);
    }
    return fallback;
  }

  const uniqueMedias   = loadJson('medias_uniques.json',   []);
  const seriesEpisodes = loadJson('series_episodes.json',  []);
  const seriesMetadata = loadJson('series_metadata.json',  []);
  const seriesSeasons  = loadJson('series_seasons.json',   {});
  const appConfig      = loadJson('app_config.json',       null);
  const userPrefs      = loadJson('user_prefs.json',       null);
  const persons        = loadJson('persons.json',          []);

  console.log(`📦 Migration JSON → SQLite`);
  console.log(`   ${uniqueMedias.length} médias uniques, ${seriesEpisodes.length} épisodes, ${seriesMetadata.length} séries, ${persons.length} personnes`);

  const db = new SQLiteDatabase(path.join(dataDir, 'medias.json'));
  await db.load();
  const sqlite = db.db;

  const s = v => JSON.stringify(v || []);
  const decade = y => y ? `${Math.floor(y / 10) * 10}s` : null;

  const migrate = sqlite.transaction(() => {
    // ── 1. Series ─────────────────────────────────────────────────────────
    const insSeries = sqlite.prepare(`
      INSERT OR IGNORE INTO series (
        id, name, description, franchise, networks, country, status,
        date_added, episode_count, year, start_year, decade, creator, platform,
        genres, main_actors, creators, mood, personal_tags
      ) VALUES (
        @id,@name,@description,@franchise,@networks,@country,@status,
        @date_added,@episode_count,@year,@start_year,@decade,@creator,@platform,
        @genres,@main_actors,@creators,@mood,@personal_tags
      )
    `);

    for (const s_ of seriesMetadata) {
      if (!s_.id) continue;
      const yr = s_.startYear || s_.year;
      insSeries.run({
        id: s_.id,
        name: s_.name || '',
        description: s_.description || '',
        franchise: s_.franchise || '',
        networks: s(s_.networks),
        country: s_.country || '',
        status: s_.status || 'unknown',
        date_added: s_.dateAdded || new Date().toISOString(),
        episode_count: s_.episodeCount || 0,
        year: s_.year || null,
        start_year: yr || null,
        decade: decade(yr),
        creator: s_.creator || '',
        platform: s_.platform || '',
        genres: s(s_.genres),
        main_actors: s(s_.mainActors || s_.actors),
        creators: s(s_.creators),
        mood: s(s_.mood),
        personal_tags: s(s_.personalTags)
      });
    }

    // ── 2. Medias ─────────────────────────────────────────────────────────
    const insMedia = sqlite.prepare(`
      INSERT OR IGNORE INTO medias (
        id, title, path, format, duration, size_bytes, thumbnail, category, media_type,
        description, date_added, last_watched, rating, width, height,
        duration_formatted, duration_category, decade, franchise, year, release_date,
        poster_url, series_id, series_name, season_number, episode_number,
        director, genres, actors, mood, technical, personal_tags
      ) VALUES (
        @id,@title,@path,@format,@duration,@size_bytes,@thumbnail,@category,@media_type,
        @description,@date_added,@last_watched,@rating,@width,@height,
        @duration_formatted,@duration_category,@decade,@franchise,@year,@release_date,
        @poster_url,@series_id,@series_name,@season_number,@episode_number,
        @director,@genres,@actors,@mood,@technical,@personal_tags
      )
    `);

    function mediaParams(m, type) {
      return {
        id: m.id,
        title: m.title || '',
        path: m.path,
        format: m.format || '',
        duration: m.duration || 0,
        size_bytes: m.size_bytes || 0,
        thumbnail: m.thumbnail || null,
        category: m.category || 'unsorted',
        media_type: m.mediaType || type,
        description: m.description || '',
        date_added: m.dateAdded || new Date().toISOString(),
        last_watched: m.lastWatched || null,
        rating: m.rating || 0,
        width: m.width || 0,
        height: m.height || 0,
        duration_formatted: m.durationFormatted || null,
        duration_category: m.durationCategory || null,
        decade: decade(m.year),
        franchise: m.franchise || '',
        year: m.year || null,
        release_date: m.releaseDate || null,
        poster_url: m.posterUrl || '',
        series_id: m.seriesId || null,
        series_name: m.seriesName || null,
        season_number: m.season_number || null,
        episode_number: m.episode_number || null,
        director: m.director || '',
        genres: s(m.genres),
        actors: s(m.actors),
        mood: s(m.mood),
        technical: s(m.technical),
        personal_tags: s(m.personalTags)
      };
    }

    for (const m of uniqueMedias) {
      if (!m.id || !m.path) continue;
      insMedia.run(mediaParams(m, 'unique'));
    }
    for (const m of seriesEpisodes) {
      if (!m.id || !m.path) continue;
      insMedia.run(mediaParams(m, 'series'));
    }

    // ── 3. Seasons & slots ────────────────────────────────────────────────
    const insSeason = sqlite.prepare(`
      INSERT OR IGNORE INTO seasons (
        series_id, season_key, order_num, type, name,
        season_number, episode_from, episode_to, is_editable
      ) VALUES (
        @series_id,@season_key,@order_num,@type,@name,
        @season_number,@episode_from,@episode_to,@is_editable
      )
    `);
    const insSlot = sqlite.prepare(
      'INSERT OR IGNORE INTO season_slots (series_id, season_key, slot_index, media_id) VALUES (?, ?, ?, ?)'
    );

    for (const [seriesId, seasons] of Object.entries(seriesSeasons)) {
      // Episodes de cette série dans l'ordre du fichier JSON (pour résoudre les index)
      const epsForSeries = seriesEpisodes.filter(ep => ep.seriesId === seriesId);

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
            let mediaId = null;
            if (ref !== null && ref !== undefined) {
              if (typeof ref === 'number') {
                // Ancien format: index positionnel dans le tableau d'épisodes
                const ep = epsForSeries[ref];
                mediaId = ep ? ep.id : null;
              } else if (typeof ref === 'string') {
                mediaId = ref;
              }
            }
            insSlot.run(seriesId, season.id, idx, mediaId);
          });
        }
      }
    }

    // ── 4. Persons & roles ────────────────────────────────────────────────
    const insPerson = sqlite.prepare(`
      INSERT OR IGNORE INTO persons (
        id, tmdb_id, name, photo, biography, birthday, deathday,
        place_of_birth, known_for_department, date_added
      ) VALUES (
        @id,@tmdb_id,@name,@photo,@biography,@birthday,@deathday,
        @place_of_birth,@known_for_department,@date_added
      )
    `);
    const insRole = sqlite.prepare(
      'INSERT OR IGNORE INTO person_roles (person_id, media_id, media_type, role, character_name) VALUES (?, ?, ?, ?, ?)'
    );

    for (const p of persons) {
      if (!p.id) continue;
      insPerson.run({
        id: p.id,
        tmdb_id: p.tmdbId || null,
        name: p.name || '',
        photo: p.photo || null,
        biography: p.biography || null,
        birthday: p.birthday || null,
        deathday: p.deathday || null,
        place_of_birth: p.placeOfBirth || null,
        known_for_department: p.knownForDepartment || null,
        date_added: p.dateAdded || new Date().toISOString()
      });
      if (Array.isArray(p.roles)) {
        for (const r of p.roles) {
          if (r.mediaId && r.role) {
            insRole.run(p.id, r.mediaId, r.mediaType || 'unique', r.role, r.character || null);
          }
        }
      }
    }

    // ── 5. User prefs ─────────────────────────────────────────────────────
    if (userPrefs) {
      const insP = sqlite.prepare('INSERT OR REPLACE INTO user_prefs (key, value) VALUES (?, ?)');
      for (const [k, v] of Object.entries(userPrefs)) insP.run(k, JSON.stringify(v));
    }

    // ── 6. App config ─────────────────────────────────────────────────────
    if (appConfig) {
      const insCfg = sqlite.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)');
      if (appConfig.settings) {
        insCfg.run('version', appConfig.settings.version || '2.0.0');
        insCfg.run('lastScan', JSON.stringify(appConfig.settings.lastScan));
      }
      if (appConfig.categories) insCfg.run('categories', JSON.stringify(appConfig.categories));
      if (appConfig.tagManager)  insCfg.run('tagManager',  JSON.stringify(appConfig.tagManager));
    }
  });

  migrate();

  const mediaCount  = sqlite.prepare('SELECT COUNT(*) as c FROM medias').get().c;
  const seriesCount = sqlite.prepare('SELECT COUNT(*) as c FROM series').get().c;
  const personCount = sqlite.prepare('SELECT COUNT(*) as c FROM persons').get().c;

  console.log(`✅ Migration terminée: ${mediaCount} médias, ${seriesCount} séries, ${personCount} personnes`);

  // Archiver les fichiers JSON pour ne plus les utiliser (mais garder comme backup)
  const archiveDir = path.join(dbDir, 'json-backup');
  fs.ensureDirSync(archiveDir);
  const jsonFiles = [
    'medias_uniques.json', 'series_episodes.json', 'series_metadata.json',
    'series_seasons.json', 'app_config.json', 'user_prefs.json', 'persons.json'
  ];
  for (const f of jsonFiles) {
    const src = path.join(dbDir, f);
    const dst = path.join(archiveDir, f);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.copySync(src, dst);
    }
  }
  console.log('📁 Fichiers JSON archivés dans json-backup/');

  return db;
}

module.exports = { migrateToSQLite };
