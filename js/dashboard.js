
// dashboard.js - Logique pour l'interface principale style Netflix simplifiée

// Fonction pour synchroniser les préférences utilisateur depuis le fichier JSON vers localStorage
async function syncUserPreferencesFromDatabase() {
  if (!window.electronAPI || !window.electronAPI.getUserPrefs) {
    console.warn('⚠️ API Electron non disponible pour charger les préférences');
    return;
  }

  try {
    console.log('🔄 Chargement des préférences utilisateur depuis le fichier JSON...');
    const result = await window.electronAPI.getUserPrefs();

    if (result.success && result.prefs) {
      // Fusionner avec les préférences localStorage existantes (localStorage prioritaire pour les nouvelles)
      const localPrefs = localStorage.getItem('userPrefs_global');
      let currentPrefs = localPrefs ? JSON.parse(localPrefs) : {};

      // Fusionner en profondeur : DB comme base, localStorage prioritaire par clé dans chaque sous-objet
      const dbPrefs = result.prefs;
      const mergedPrefs = {
        watchedMovies: { ...(dbPrefs.watchedMovies || {}), ...(currentPrefs.watchedMovies || {}) },
        ratings: { ...(dbPrefs.ratings || {}), ...(currentPrefs.ratings || {}) },
        watchCount: { ...(dbPrefs.watchCount || {}), ...(currentPrefs.watchCount || {}) },
        lastWatched: { ...(dbPrefs.lastWatched || {}), ...(currentPrefs.lastWatched || {}) },
        playProgress: { ...(dbPrefs.playProgress || {}), ...(currentPrefs.playProgress || {}) },
        watchedSeries: { ...(dbPrefs.watchedSeries || {}), ...(currentPrefs.watchedSeries || {}) }
      };

      // Sauvegarder dans localStorage
      localStorage.setItem('userPrefs_global', JSON.stringify(mergedPrefs));

      console.log('✅ Préférences synchronisées:', {
        ratings: Object.keys(mergedPrefs.ratings || {}).length,
        watched: Object.keys(mergedPrefs.watchedMovies || {}).length
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation des préférences:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Plus de système de connexion - application directe
  console.log('Application Rackoon Streaming démarrée');

  // Synchroniser les préférences utilisateur depuis le fichier JSON vers localStorage
  await syncUserPreferencesFromDatabase();

  // Fonction helper pour ouvrir une modale de film de manière robuste
  function safeOpenMovieModal(movieId) {
    if (window.openMovieModal) {
      window.openMovieModal(movieId);
    } else {
      console.log('⏳ Attente de openMovieModal...');
      let attempts = 0;
      const maxAttempts = 10;

      const waitForModal = () => {
        attempts++;
        if (window.openMovieModal) {
          console.log('✅ openMovieModal trouvée, ouverture de la modale');
          window.openMovieModal(movieId);
        } else if (attempts < maxAttempts) {
          setTimeout(waitForModal, 100);
        } else {
          console.error('❌ La fonction openMovieModal n\'est pas disponible après ' + maxAttempts + ' tentatives');
          console.log('🔍 Scripts chargés:', Object.keys(window).filter(key => key.includes('open') || key.includes('Modal')));
          console.log('🔍 Toutes les propriétés window:', Object.keys(window).sort());
        }
      };

      waitForModal();
    }
  }
  
  // Éléments de l'interface
  const addBtn = document.getElementById('add-btn');
  const scanMenu = document.getElementById('scan-menu');
  const scanFolderBtn = document.getElementById('scan-folder-btn');
  const scanFileBtn = document.getElementById('scan-file-btn');
  const filterSearch = document.getElementById('filter-search');
  const mediaGrid = document.getElementById('media-grid');
  const statusMessage = document.getElementById('status-message');
  const progressBar = document.getElementById('progress-bar');

  console.log('🔍 Éléments UI récupérés:');
  console.log('  - addBtn:', addBtn);
  console.log('  - scanMenu:', scanMenu);
  console.log('  - scanFolderBtn:', scanFolderBtn);
  console.log('  - scanFileBtn:', scanFileBtn);

  // Gestion du menu flottant
  addBtn.addEventListener('click', () => {
    console.log('➕ Bouton + cliqué');
    scanMenu.classList.toggle('active');
  });
  
  // Fermer le menu quand on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!scanMenu.contains(e.target) && e.target !== addBtn && !addBtn.contains(e.target)) {
      scanMenu.classList.remove('active');
    }
  });
  
  // Écouteur pour les mises à jour de statut de la recherche
  window.electronAPI.onScanStatus((status) => {
    statusMessage.textContent = status.message;
    progressBar.style.width = `${status.progress}%`;
  });
  
  // Plus de système de déconnexion
  
  // Recherche de dossier
  console.log('📁 Attachement du listener sur scanFolderBtn');
  scanFolderBtn.addEventListener('click', async () => {
    console.log('═══════════════════════════════════════');
    console.log('📁 BOUTON DOSSIER CLIQUÉ !');
    console.log('═══════════════════════════════════════');

    try {
      scanMenu.classList.remove('active');
      statusMessage.textContent = 'Sélection du dossier...';
      progressBar.style.width = '0%';

      console.log('🔍 Début du scan de dossier...');

      // Lancer le scan léger qui ouvrira l'overlay après la sélection
      const scanResult = await window.electronAPI.scanMediasLight();

      console.log('📊 Résultat du scan:', scanResult);

      if (scanResult.success && scanResult.medias && scanResult.medias.length > 0) {
        console.log(`📂 ${scanResult.medias.length} fichiers trouvés, ouverture de l'overlay`);
        console.log('🔍 window.startTriage existe?', typeof window.startTriage);
        console.log('🔍 window.importTriageSystem existe?', typeof window.importTriageSystem);

        // Maintenant afficher l'overlay avec les fichiers trouvés
        if (window.startTriage) {
          console.log('✅ Appel de window.startTriage avec', scanResult.medias.length, 'fichiers');
          window.startTriage(scanResult.medias, 'folder');
          console.log('✅ window.startTriage appelée');
        } else {
          console.error('❌ Système de tri non disponible');
          console.error('❌ window.startTriage est:', window.startTriage);
          statusMessage.textContent = 'Erreur : système de tri non disponible';
        }
      } else {
        // L'utilisateur a annulé ou aucun fichier trouvé
        statusMessage.textContent = scanResult.message || 'Aucun fichier trouvé';
        setTimeout(() => {
          statusMessage.textContent = 'Prêt à rechercher des vidéos';
        }, 2000);
      }

      // Masquer la barre de progression
      progressBar.style.width = '0%';

    } catch (error) {
      console.error('Erreur lors du scan:', error);
      statusMessage.textContent = 'Erreur lors du scan';
      progressBar.style.width = '0%';
    }
  });
  
  // Recherche de fichier individuel
  console.log('📄 Attachement du listener sur scanFileBtn');
  scanFileBtn.addEventListener('click', async () => {
    console.log('═══════════════════════════════════════');
    console.log('📄 BOUTON FICHIER CLIQUÉ !');
    console.log('═══════════════════════════════════════');

    try {
      scanMenu.classList.remove('active');
      statusMessage.textContent = 'Sélection du fichier vidéo...';
      progressBar.style.width = '0%';

      console.log('📞 Appel de window.electronAPI.scanSingleMedia()...');
      console.log('🔍 window.electronAPI existe?', typeof window.electronAPI);
      console.log('🔍 window.electronAPI.scanSingleMedia existe?', typeof window.electronAPI?.scanSingleMedia);

      // Lancer la sélection de fichier unique
      const result = await window.electronAPI.scanSingleMedia();

      console.log('📊 Résultat de scanSingleMedia:', result);

      if (result.success) {
        // ⚠️ CORRECTION: c'est result.media, pas result.movie
        const media = result.media || result.movie;

        if (media) {
          statusMessage.textContent = `Fichier sélectionné: ${media.title}`;
          progressBar.style.width = '100%';

          console.log('🎯 Lancement de la modale de tri pour 1 fichier');
          console.log('🔍 window.startTriage existe?', typeof window.startTriage);

          // Lancer la modale de tri même pour un seul fichier
          if (window.startTriage) {
            console.log('✅ Appel de window.startTriage avec le fichier:', media);
            window.startTriage([media], 'file');
            console.log('✅ window.startTriage appelée');
          } else {
            console.error('❌ Système de tri non disponible, ajout direct');
            await loadMediasFromDatabase();
          }
        } else {
          console.warn('⚠️ Aucun média dans le résultat');
          statusMessage.textContent = result.message || 'Fichier non sélectionné';
        }
        
        // Masquer la barre de progression après 3 secondes
        setTimeout(() => {
          progressBar.style.width = '0%';
          statusMessage.textContent = 'Prêt à rechercher des vidéos';
        }, 3000);
      } else {
        statusMessage.textContent = result.message || 'Erreur lors de la sélection';
        progressBar.style.width = '0%';
      }
    } catch (error) {
      console.error('═══════════════════════════════════════');
      console.error('❌ ERREUR lors de la sélection de fichier:', error);
      console.error('❌ Stack:', error.stack);
      console.error('═══════════════════════════════════════');
      statusMessage.textContent = 'Erreur lors de la sélection de fichier';
      progressBar.style.width = '0%';
    }
  });
  
  // Recherche dans la section films
  filterSearch.addEventListener('input', () => {
    const searchTerm = filterSearch.value.toLowerCase().trim();
    filterMedias(searchTerm);
  });

  // Fonction pour jouer un film
  window.playMedia = async function(mediaId) {
    try {
      // Récupérer les informations complètes du média
      const allMedias = await window.electronAPI.getAllMedias();
      let media = null;

      // Chercher le média dans la liste
      if (allMedias.success && allMedias.medias) {
        media = allMedias.medias.find(m => m.id === mediaId);
      }

      // Vérifier que le média existe
      if (!media) {
        console.error('Média non trouvé avec l\'ID:', mediaId);
        alert('Impossible de lire le média : média introuvable');
        return;
      }

      // Vérifier que le fichier existe toujours sur le disque
      if (media.path && !await window.electronAPI.checkFileExists(media.path)) {
        console.error('Fichier vidéo introuvable:', media.path);
        alert('Impossible de lire le média : fichier introuvable sur le disque');
        return;
      }

      const title = media.title || 'Média sans titre';
      const effectivePath = (media.audioStatus === 'ok' && media.audioConvertedPath)
        ? media.audioConvertedPath : media.path;

      window.openVideoPlayer(mediaId, title, effectivePath, null, media.audioStatus === 'ok', media.path);
    } catch (error) {
      console.error('Erreur lors du lancement de la vidéo:', error);
      alert('Erreur lors du lancement de la vidéo: ' + error.message);
    }
  };
  
  // Charger les films au démarrage depuis la base JSON
  async function loadMediasFromDatabase() {
    try {
      // Charger tous les médias
      const mediasResult = await window.electronAPI.getAllMedias();

      let totalCount = 0;
      let allMovies = [];

      if (mediasResult.success && mediasResult.medias) {
        allMovies = mediasResult.medias;
        totalCount = mediasResult.count;
        console.log(`📚 ${mediasResult.count} médias chargés depuis la base`);
      } else {
        console.error('Erreur chargement médias:', mediasResult.message);
        allMovies = []; // Initialiser avec un tableau vide
      }

      // Détecter les médias non triés (category: null)
      const untriagedMedias = allMovies.filter(movie => movie.category === null);

      if (untriagedMedias.length > 0) {
        console.log(`🔍 ${untriagedMedias.length} média(s) non trié(s) détecté(s), lancement du système de tri...`);

        // Lancer le système de tri automatiquement
        if (window.startTriage) {
          setTimeout(() => {
            window.startTriage(untriagedMedias, 'auto');
          }, 1000); // Délai pour s'assurer que l'interface est prête
        } else {
          console.error('❌ Système de tri non disponible (window.startTriage non défini)');
        }
      }

      // Séparer les films des séries (exclure les non triés)
      const films = allMovies.filter(movie =>
        movie.category !== null && movie.seriesId == null
      );

      const seriesEpisodes = allMovies.filter(movie =>
        movie.seriesId != null
      );

      // Grouper les épisodes par série
      const seriesGroups = {};
      const orphanedEpisodes = []; // Épisodes sans série

      seriesEpisodes.forEach(episode => {
        console.log('🔍 Analyse épisode:', {
          title: episode.title,
          seriesId: episode.seriesId,
          seriesName: episode.seriesName,
          hasSeriesId: !!episode.seriesId,
          hasSeriesName: !!episode.seriesName
        });

        if (!episode.seriesId || !episode.seriesName) {
          console.warn('⚠️ Épisode orphelin trouvé (sans seriesId/seriesName):', episode.title, {
            seriesId: episode.seriesId,
            seriesName: episode.seriesName,
            path: episode.path
          });
          orphanedEpisodes.push(episode);
          return;
        }

        if (!seriesGroups[episode.seriesId]) {
          seriesGroups[episode.seriesId] = {
            id: episode.seriesId,
            name: episode.seriesName,
            episodes: [],
            episodeCount: 0
          };
        }
        seriesGroups[episode.seriesId].episodes.push(episode);
        seriesGroups[episode.seriesId].episodeCount++;
      });

      const series = Object.values(seriesGroups);

      // Enrichir avec les métadonnées de la table series (posterUrl, description…)
      try {
        const seriesMetaResult = await window.electronAPI.getAllSeries();
        if (seriesMetaResult.success && seriesMetaResult.series) {
          const metaById = {};
          seriesMetaResult.series.forEach(s => { metaById[s.id] = s; });
          series.forEach(s => {
            const meta = metaById[s.id];
            if (meta && meta.posterUrl) s.posterUrl = meta.posterUrl;
          });
        }
      } catch (e) {
        console.warn('⚠️ Impossible de charger les métadonnées séries:', e);
      }

      console.log(`📺 ${series.length} séries reconstituées depuis les épisodes`);

      if (orphanedEpisodes.length > 0) {
        console.warn(`⚠️ ${orphanedEpisodes.length} épisode(s) orphelin(s) détecté(s)`);
      }
      console.log('🔍 Séries créées:', series);

      // Debug pour voir ce qui est passé à displayMedias
      console.log('🎬 Variable films avant displayMedias:', films.length, 'éléments');
      console.log('🎬 Détail films:', films.map(f => ({title: f.title, category: f.category})));

      // Utiliser le système de filtres unifié dès le démarrage
      if (window.filtersSystem && window.filtersSystem.applyFiltersAndSort) {
        console.log('✅ Utilisation du système de filtres unifié');
        await window.filtersSystem.applyFiltersAndSort();
      } else {
        // Fallback si le système de filtres n'est pas encore initialisé
        console.warn('⚠️ Système de filtres non disponible, utilisation du système legacy');
        displayMedias(films);
        displaySeries(series);
      }

      if (totalCount > 0) {
        statusMessage.textContent = `${totalCount} médias dans la bibliothèque`;
      }

    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      displayMedias([]);
      displaySeries([]);
    }
  }
  
  // Fonction pour afficher les séries
  function displaySeries(series) {
    console.log('🔍 displaySeries appelée avec:', series);
    const seriesGrid = document.getElementById('series-grid');
    const seriesCount = document.getElementById('series-count');

    console.log('🔍 seriesGrid trouvé:', !!seriesGrid);
    console.log('🔍 seriesCount trouvé:', !!seriesCount);

    if (!seriesGrid) {
      console.error('❌ Grid des séries non trouvé');
      return;
    }

    // Mettre à jour le compteur
    if (seriesCount) {
      seriesCount.textContent = series.length;
      console.log(`✅ Compteur séries mis à jour: ${series.length}`);
    }

    // Vider le grid
    seriesGrid.innerHTML = '';

    if (!series || series.length === 0) {
      console.log('ℹ️ Aucune série à afficher');
      seriesGrid.innerHTML = '<div class="empty-state"><span class="icon">📺</span><p>Aucune série trouvée.</p></div>';
      return;
    }

    console.log(`✅ Création de ${series.length} cartes série`);
    // Créer les cartes pour chaque série
    series.forEach((serie, index) => {
      console.log(`📺 Création carte pour: ${serie.name} (${serie.episodeCount} épisodes)`);
      const seriesCard = createSeriesCard(serie);
      seriesGrid.appendChild(seriesCard);
    });
  }

  // Fonction pour créer une carte série
  function createSeriesCard(serie) {
    const card = document.createElement('div');
    card.className = 'media-card series-card';
    card.dataset.seriesId = serie.id;
    card.dataset.title = serie.name;

    // Utiliser le poster > thumbnail du premier épisode > image par défaut
    const defaultSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjQwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwcHgiPlPDiVJJRTwvdGV4dD48L3N2Zz4=';
    let thumbnailSrc = defaultSrc;

    if (serie.posterUrl) {
      thumbnailSrc = serie.posterUrl;
    } else if (serie.seasons && serie.seasons[0] && serie.seasons[0].episodes && serie.seasons[0].episodes[0]) {
      const firstEpisode = serie.seasons[0].episodes[0];
      if (firstEpisode.thumbnail) {
        const thumbnailName = firstEpisode.thumbnail.split('\\').pop().split('/').pop();
        thumbnailSrc = `http://localhost:3001/thumbnails/${thumbnailName}`;
      }
    }

    const totalEpisodes = serie.episodeCount || 0;
    const totalSeasons = serie.seasons ? serie.seasons.length : 0;

    // Durée moyenne par épisode
    const episodes = serie.episodes || [];
    const episodesWithDuration = episodes.filter(ep => ep.duration > 0);
    const avgDuration = episodesWithDuration.length > 0
      ? Math.round(episodesWithDuration.reduce((sum, ep) => sum + ep.duration, 0) / episodesWithDuration.length)
      : 0;
    const durationLabel = avgDuration > 0 && window.formatTime ? `~${window.formatTime(avgDuration)}/ép` : `${totalEpisodes} ép`;

    card.innerHTML = `
      <div class="media-thumbnail-container">
        <img src="${thumbnailSrc}" alt="${serie.name}" class="media-thumbnail" loading="lazy"
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjQwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwcHgiPlPDiVJJRTwvdGV4dD48L3N2Zz4='">
        <div class="play-overlay">
          <button class="play-btn" title="Lancer la lecture">
            <i class="fas fa-play"></i>
          </button>
        </div>
        <div class="media-card-progress" style="display:none">
          <div class="media-card-progress-fill"></div>
        </div>
        <div class="watch-top">
          <button class="btn-watch-toggle">à voir</button>
        </div>
      </div>
      <div class="media-info">
        <div class="media-title-container">
          <h3 class="media-title">${serie.name}</h3>
        </div>
        <div class="media-extended-info">
          <div class="media-current-episode" style="display:none"></div>
          <div class="series-season-info">
            Saison : <span class="season-value">${totalSeasons}</span>
          </div>
          <div class="media-duration series-episodes">
            <span class="duration-value">${durationLabel}</span>
          </div>
          <div class="rating-container">
            <div class="stars-container">
              <span class="star" data-value="1"><i class="fas fa-star"></i></span>
              <span class="star" data-value="2"><i class="fas fa-star"></i></span>
              <span class="star" data-value="3"><i class="fas fa-star"></i></span>
              <span class="star" data-value="4"><i class="fas fa-star"></i></span>
              <span class="star" data-value="5"><i class="fas fa-star"></i></span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Barre de progression série
    const sp = window.progressData?.seriesProgress?.[serie.id];
    if (sp && sp.pct > 0.02) {
      const pw = card.querySelector('.media-card-progress');
      if (pw) {
        pw.style.display = '';
        pw.querySelector('.media-card-progress-fill').style.width = `${Math.min(100, Math.round(sp.pct * 100))}%`;
      }
      const epLabel = card.querySelector('.media-current-episode');
      if (epLabel) {
        const s = sp.seasonNumber ? `S${String(sp.seasonNumber).padStart(2, '0')}` : '';
        const e = sp.episodeNumber ? `E${String(sp.episodeNumber).padStart(2, '0')}` : '';
        if (s || e) { epLabel.textContent = `${s}${e} — en cours`; epLabel.style.display = ''; }
      }
    }

    // Étoiles de notation
    if (window.updateStarsDisplay) window.updateStarsDisplay(card, serie.rating || 0);
    if (window.setupStarsInteraction) {
      window.setupStarsInteraction(card, (r) => window.electronAPI.updateSeriesRating(serie.id, r));
    }

    // Bouton vu/à voir — init depuis localStorage + listener
    const watchBtn = card.querySelector('.btn-watch-toggle');
    if (watchBtn) {
      const savedPrefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');
      const initWatched = !!(savedPrefs.watchedSeries && savedPrefs.watchedSeries[serie.id]);
      watchBtn.textContent = initWatched ? 'vu !' : 'à voir';
      if (initWatched) watchBtn.classList.add('watched');

      watchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');
        if (!p.watchedSeries) p.watchedSeries = {};
        const nowWatched = !watchBtn.classList.contains('watched');
        if (nowWatched) {
          p.watchedSeries[serie.id] = true;
          watchBtn.textContent = 'vu !';
          watchBtn.classList.add('watched');
        } else {
          delete p.watchedSeries[serie.id];
          watchBtn.textContent = 'à voir';
          watchBtn.classList.remove('watched');
        }
        localStorage.setItem('userPrefs_global', JSON.stringify(p));
        // Persister en DB
        window.electronAPI.updateWatchedSeries(serie.id, nowWatched);
        // Sync overlay modale si elle affiche cette série
        const modalBtn = document.getElementById('btn-watch-toggle-series');
        if (modalBtn) {
          modalBtn.textContent = nowWatched ? 'Vu !' : 'À voir';
          modalBtn.classList.toggle('watched', nowWatched);
        }
      });
    }

    // Ajouter l'événement de clic pour ouvrir la modale série
    card.addEventListener('click', (e) => {
      if (e.target.closest('.play-btn') ||
          e.target.closest('.star') ||
          e.target.closest('.btn-watch-toggle')) return;
      openSeries(serie.id);
    });

    // Ajouter l'événement pour le bouton play
    const playBtn = card.querySelector('.play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Lire directement le premier épisode
        if (window.playSeriesFirstEpisode) {
          await window.playSeriesFirstEpisode(serie.id);
        }
      });
    }

    return card;
  }

  // Fonction pour filtrer les médias affichés
  function filterMedias(searchTerm) {
    // Si pas de terme de recherche, afficher tout
    if (!searchTerm || searchTerm === '') {
      showAllCards();
      return;
    }

    const categoriesContainer = document.querySelector('.categories-container');
    if (!categoriesContainer) return;

    // Récupérer toutes les cartes de tous les grids
    const allCards = [];
    const foundMovieIds = new Set();

    const gridIds = ['films-grid', 'series-grid', 'shorts-grid', 'others-grid', 'unsorted-grid'];

    gridIds.forEach(gridId => {
      const grid = document.getElementById(gridId);
      if (grid) {
        grid.querySelectorAll('.media-card').forEach(card => {
          const movieId = card.dataset.id;
          if (movieId && !foundMovieIds.has(movieId)) {
            allCards.push(card);
            foundMovieIds.add(movieId);
          }
        });
      }
    });

    let visibleCount = 0;

    // Masquer toutes les catégories
    document.querySelectorAll('.media-category').forEach(category => {
      category.style.display = 'none';
    });

    // Créer ou récupérer la section de résultats de recherche
    let searchResultsSection = document.querySelector('.search-results-section');
    if (!searchResultsSection) {
      searchResultsSection = document.createElement('div');
      searchResultsSection.className = 'media-category search-results-section';
      searchResultsSection.innerHTML = `
        <div class="category-header">
          <h3 class="category-title">
            <i class="fas fa-search"></i>
            Résultats de recherche
          </h3>
          <span class="category-count" id="search-count">0 résultat(s)</span>
        </div>
        <div class="media-grid search-results-grid" id="search-results-grid"></div>
      `;
      categoriesContainer.insertBefore(searchResultsSection, categoriesContainer.firstChild);
    }

    const searchGrid = searchResultsSection.querySelector('#search-results-grid');
    const searchCount = searchResultsSection.querySelector('#search-count');
    searchGrid.innerHTML = ''; // Vider les résultats précédents

    // Filtrer et ajouter les cartes correspondantes
    allCards.forEach(card => {
      const title = card.dataset.title ? card.dataset.title.toLowerCase() : '';

      if (title.includes(searchTerm)) {
        // Cloner la carte et l'ajouter aux résultats
        const cardClone = card.cloneNode(true);
        searchGrid.appendChild(cardClone);
        visibleCount++;
      }
    });

    // Mettre à jour le compteur
    searchCount.textContent = `${visibleCount}`;

    // Afficher la section de résultats
    searchResultsSection.style.display = 'block';

    // Afficher message si aucun résultat
    if (visibleCount === 0) {
      searchGrid.innerHTML = `
        <div class="empty-state">
          <span class="icon">🔍</span>
          <p>Aucun résultat trouvé pour "${searchTerm}"</p>
        </div>
      `;
    }
  }
  
  // Fonction pour afficher toutes les cartes (réinitialiser la recherche)
  function showAllCards() {
    const searchResultsSection = document.querySelector('.search-results-section');

    // Supprimer la section de résultats de recherche si elle existe
    if (searchResultsSection) {
      searchResultsSection.remove();
    }

    // Réafficher toutes les catégories principales
    document.querySelectorAll('.media-category:not(.search-results-section)').forEach(category => {
      category.style.display = 'block';
    });
  }
  
  // Marquer un film comme vu/à voir
  function toggleWatchStatus(movieId, button) {
    const card = button.closest('.media-card');
    const isCurrentlyWatched = button.classList.contains('watched');
    const nowWatched = !isCurrentlyWatched;

    // Mettre à jour l'UI immédiatement
    const allButtons = card.querySelectorAll('.btn-watch-toggle');
    allButtons.forEach(btn => {
      if (nowWatched) {
        btn.textContent = 'vu !';
        btn.classList.add('watched');
      } else {
        btn.textContent = 'à voir';
        btn.classList.remove('watched');
      }
    });

    // Persister en DB
    window.electronAPI.updateWatchStatus(movieId, nowWatched);
  }
  
  // Noter un film (1-5 étoiles)
  function rateMedia(movieId, rating) {
    window.electronAPI.updateRating(movieId, rating);

    const card = document.querySelector(`.media-card[data-id="${movieId}"]`);
    if (card) window.updateStarsDisplay(card, rating);
  }
  
  
  
  
  // Chargement des films - REDIRECTION vers loadMediasFromDatabase
  window.loadMovies = async function() {
    console.log('⚠️ loadMovies() appelée - redirection vers loadMediasFromDatabase()');
    await loadMediasFromDatabase();
  }
  
  // Affichage des films dans la grille - VERSION CATÉGORIES FIXES
function displayMedias(movies) {
  // Debug : voir les catégories des films
  console.log('Films et leurs catégories:', movies.map(m => ({title: m.title, category: m.category})));

  // Grouper les films par catégorie
  const moviesByCategory = movies.reduce((groups, movie) => {
    // Ne pas afficher les films avec category: null (en attente de tri)
    if (movie.category === null) {
      return groups;
    }
    const category = movie.category || 'unsorted';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(movie);
    return groups;
  }, {});

  // Nettoyer toutes les grilles et compter les médias
  const categoryMapping = {
    'film': { gridId: 'films-grid', countId: 'films-count' },
    'series': { gridId: 'series-grid', countId: 'series-count' },
    'short': { gridId: 'shorts-grid', countId: 'shorts-count' },
    'other': { gridId: 'others-grid', countId: 'others-count' },
    'unsorted': { gridId: 'unsorted-grid', countId: 'unsorted-count' }
  };

  // Réinitialiser toutes les catégories
  Object.values(categoryMapping).forEach(({ gridId, countId }) => {
    const grid = document.getElementById(gridId);
    const count = document.getElementById(countId);

    if (grid && count) {
      grid.innerHTML = '<div class="empty-state"><span class="icon">📼</span><p>Aucun média trouvé.</p></div>';
      count.textContent = '0';
    }
  });

  // Remplir chaque catégorie avec ses médias
  Object.keys(categoryMapping).forEach(category => {
    const { gridId, countId } = categoryMapping[category];
    const moviesInCategory = moviesByCategory[category] || [];

    const grid = document.getElementById(gridId);
    const count = document.getElementById(countId);

    if (grid && count) {
      count.textContent = moviesInCategory.length.toString();

      if (moviesInCategory.length > 0) {
        // Vider le grid et ajouter les médias
        grid.innerHTML = '';

        // Utiliser le template pour créer les cartes
        const template = document.getElementById('media-card-template');

        moviesInCategory.forEach(movie => {
          // Cloner le template
          const mediaCard = template.content.cloneNode(true).querySelector('.media-card');

          // Configurer les données de la carte
          setupMediaCard(mediaCard, movie);

          // Ajouter la carte au grid
          grid.appendChild(mediaCard);
        });
      }
    }
  });

  // Gérer les catégories personnalisées (autres que les 5 principales)
  Object.keys(moviesByCategory).forEach(category => {
    if (!categoryMapping[category] && moviesByCategory[category].length > 0) {
      // Pour les catégories personnalisées, les ajouter dans "Autres"
      const othersGrid = document.getElementById('others-grid');
      const othersCount = document.getElementById('others-count');

      if (othersGrid && othersCount) {
        const existingCount = parseInt(othersCount.textContent) || 0;
        const newCount = existingCount + moviesByCategory[category].length;
        othersCount.textContent = newCount.toString();

        if (othersGrid.querySelector('.empty-state')) {
          othersGrid.innerHTML = '';
        }

        const template = document.getElementById('media-card-template');
        moviesByCategory[category].forEach(movie => {
          const mediaCard = template.content.cloneNode(true).querySelector('.media-card');
          setupMediaCard(mediaCard, movie);
          othersGrid.appendChild(mediaCard);
        });
      }
    }
  });
}

// Fonction pour configurer une carte de média
function setupMediaCard(mediaCard, movie) {
  // Charger les préférences utilisateur
  let userPrefs = localStorage.getItem('userPrefs_global');

  if (!userPrefs) {
    userPrefs = {
      watchedMovies: {},
      ratings: {}
    };
  } else {
    userPrefs = JSON.parse(userPrefs);
    if (!userPrefs.watchedMovies) userPrefs.watchedMovies = {};
    if (!userPrefs.ratings) userPrefs.ratings = {};
  }

  // Configurer les attributs de la carte
  mediaCard.dataset.id = movie.id;
  mediaCard.dataset.mediaId = movie.id;
  mediaCard.dataset.title = movie.title.toLowerCase();

  // Overlay et bouton play — uniquement si conversion activement en cours
  const audioOverlay = mediaCard.querySelector('.audio-converting-overlay');
  const playBtnInit = mediaCard.querySelector('.play-btn');
  if (movie.audioStatus === 'converting') {
    if (audioOverlay) audioOverlay.style.display = '';
    if (playBtnInit) playBtnInit.disabled = true;
  }

  // Configurer l'image de couverture
  let thumbnailSrc;
  if (movie.posterUrl) {
    thumbnailSrc = movie.posterUrl;
  } else if (movie.thumbnail) {
    // Utiliser le serveur HTTP local pour les thumbnails
    const thumbnailFilename = movie.thumbnail.split(/[\\\/]/).pop();
    thumbnailSrc = `http://localhost:3001/thumbnails/${thumbnailFilename}`;
  } else {
    thumbnailSrc = window.DEFAULT_THUMBNAIL;
  }

  const thumbnailImg = mediaCard.querySelector('.media-thumbnail');
  thumbnailImg.src = thumbnailSrc;
  thumbnailImg.alt = movie.title;
  thumbnailImg.onerror = () => { thumbnailImg.src = window.DEFAULT_THUMBNAIL; };

  // Configurer le titre
  mediaCard.querySelector('.media-title').textContent = movie.title;

  // Configurer la durée
  mediaCard.querySelector('.duration-value').textContent = window.formatTime(movie.duration);

  // Configurer l'état "vu/à voir" — source de vérité : DB (lastWatched)
  const isWatched = !!movie.lastWatched;
  const watchButtons = mediaCard.querySelectorAll('.btn-watch-toggle');

  watchButtons.forEach(button => {
    if (isWatched) {
      button.textContent = 'vu !';
      button.classList.add('watched');
    } else {
      button.textContent = 'à voir';
      button.classList.remove('watched');
    }

    // Ajouter l'écouteur pour le changement d'état
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWatchStatus(movie.id, button);
    });
  });

  // Configurer les étoiles de notation
  const rating = movie.rating || 0;
  window.updateStarsDisplay(mediaCard, rating);
  window.setupStarsInteraction(mediaCard, (rating) => rateMedia(movie.id, rating));

  // Ajouter un écouteur pour le bouton de lecture
  const playBtn = mediaCard.querySelector('.play-btn');
  if (playBtn) {
    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const ep = (movie.audioStatus === 'ok' && movie.audioConvertedPath) ? movie.audioConvertedPath : movie.path;
        await window.openVideoPlayer(movie.id, movie.title, ep, null, movie.audioStatus === 'ok', movie.path);
      } catch (error) {
        console.error('Erreur lors du lancement du lecteur vidéo:', error);
        alert('Erreur lors du lancement de la vidéo: ' + error.message);
      }
    });
  }

  // Ajouter un écouteur pour la carte entière (clic sur l'image pour ouvrir la modal)
  mediaCard.addEventListener('click', async (e) => {
    // Éviter de déclencher si on clique sur un bouton ou les étoiles
    if (e.target.closest('.btn-watch-toggle') ||
        e.target.closest('.star') ||
        e.target.closest('.play-btn') ||
        e.target.closest('.play-overlay')) {
      return;
    }

    try {
      safeOpenMovieModal(movie.id);
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la modal:', error);
    }
  });
}

  // Ajouter une fonction pour la gestion du menu contextuel (bouton droit)
  function setupContextMenu() {
    document.addEventListener('contextmenu', async (e) => {
      // Vérifier si on clique sur une carte de film
      const mediaCard = e.target.closest('.media-card');
      if (mediaCard) {
        e.preventDefault();
        
        const movieId = mediaCard.dataset.id;
        if (!movieId) return;
        
        // Ouvrir le dossier contenant le fichier
        try {
          const result = await window.electronAPI.openMediaFolder(movieId);
          if (!result.success) {
            console.error(result.message);
          }
        } catch (error) {
          console.error('Erreur lors de l\'ouverture du dossier:', error);
        }
      }
    });
  }
  
  // Extension pour l'API Electron
  window.electronAPI.getMediaDetails = async function(movieId) {
    try {
      const result = await window.electronAPI.getMediaPath(movieId);
      
      if (result.success) {
        const data = await window.electronAPI.getAllMedias();
        const movie = data.movies.find(m => m.id === movieId);
        
        if (movie) {
          return {
            success: true,
            movie: {
              ...movie,
              path: result.path,
              description: movie.description || '', 
              genres: movie.genres || [], 
              releaseDate: movie.releaseDate || '',
              year: movie.year || (new Date()).getFullYear()
            }
          };
        }
      }
      
      return result;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du film:', error);
      return { success: false, message: 'Erreur lors de la récupération des détails du film' };
    }
  };
  
  // Jouer un film avec le lecteur intégré
  window.electronAPI.playMedia = async function(movieId) {
    try {
      // Obtenir les détails du film
      const movieDetails = await window.electronAPI.getMediaDetails(movieId);
      if (!movieDetails.success) {
        throw new Error(movieDetails.message || 'Impossible de charger les détails du film');
      }
      
      const movie = movieDetails.movie;
      
      // Ouvrir le lecteur vidéo moderne
      const ep2 = (movie.audioStatus === 'ok' && movie.audioConvertedPath) ? movie.audioConvertedPath : movie.path;
      await window.openVideoPlayer(movieId, movie.title, ep2, null, movie.audioStatus === 'ok', movie.path);
      
      return { success: true, message: 'Lecteur vidéo ouvert' };
    } catch (error) {
      console.error('Erreur lors de la lecture du film:', error);
      return { success: false, message: 'Erreur lors de la lecture du film: ' + error.message };
    }
  };
  
  // Exposer les fonctions pour la modal et les autres scripts
  window.loadMoviesFromDashboard = window.loadMovies;
  window.refreshDashboard = window.loadMovies;
  window.loadMediasFromDatabase = loadMediasFromDatabase;
  window.displayMedias = displayMedias;
  window.displaySeries = displaySeries;

  // Écouteur pour les mises à jour de films
  document.addEventListener('moviesUpdated', () => {
    console.log('🔄 Événement de mise à jour des films reçu');
    loadMediasFromDatabase();
  });

  // ── Drag & Drop import ────────────────────────────────────────────────────
  (function setupDragDrop() {
    const overlay = document.getElementById('drop-overlay');
    if (!overlay) return;

    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      dragCounter++;
      overlay.classList.add('active');
    });

    document.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.remove('active');
      }
    });

    document.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // En Electron, File.path contient le chemin système réel
      const paths = files.map(f => f.path).filter(Boolean);
      if (paths.length === 0) return;

      statusMessage.textContent = 'Analyse des fichiers déposés…';

      try {
        const result = await window.electronAPI.scanMediasFromPaths(paths);

        if (result.success && result.medias && result.medias.length > 0) {
          if (window.startTriage) {
            window.startTriage(result.medias, 'drop');
          } else {
            statusMessage.textContent = 'Système de tri non disponible';
          }
        } else {
          statusMessage.textContent = result.message || 'Aucun fichier vidéo détecté';
          setTimeout(() => { statusMessage.textContent = 'Prêt à rechercher des vidéos'; }, 3000);
        }
      } catch (err) {
        console.error('Erreur drag & drop:', err);
        statusMessage.textContent = 'Erreur lors de l\'import';
        setTimeout(() => { statusMessage.textContent = 'Prêt à rechercher des vidéos'; }, 3000);
      }
    });
  })();

  // Initialiser l'interface
  // Mise à jour en temps réel des étoiles sur les cards après notation dans une modale
  window.addEventListener('ratingUpdated', (e) => {
    document.querySelectorAll(`.media-card[data-id="${e.detail.movieId}"]`).forEach(card => {
      if (window.updateStarsDisplay) window.updateStarsDisplay(card, e.detail.rating);
    });
  });

  window.addEventListener('seriesRatingUpdated', (e) => {
    document.querySelectorAll(`.media-card[data-series-id="${e.detail.seriesId}"]`).forEach(card => {
      if (window.updateStarsDisplay) window.updateStarsDisplay(card, e.detail.rating);
    });
  });

  setupContextMenu();
  window.loadMovies();
});