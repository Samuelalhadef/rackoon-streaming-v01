// ========================================
//  SYSTÈME DE FILTRES ET TRI - RACKOON STREAMING
// ========================================

(function() {
  'use strict';

  // État des filtres et tri
  // Cache de progression pour le rendu des cards
  window.progressData = window.progressData || { playProgress: {}, seriesProgress: {} };

  let filtersState = {
    sortBy: 'category', // 'category' affiche par catégories, les autres trient globalement
    sortOrder: 'asc', // 'asc' ou 'desc'
    viewMode: 'global', // 'global' ou 'sections' (affichage par lettres)
    columnsCount: 5, // nombre de colonnes de la grille (3-8)
    mediaTypes: ['film', 'series', 'documentaire', 'animation', 'concert', 'sport', 'short', 'other', 'unsorted'],
    genres: [],
    yearMin: 1900,
    yearMax: 2030,
    watchStatus: 'all', // 'all', 'toWatch', 'watched'
    minRating: 0,
    externalPlatform: null, // filtre plateforme depuis la page Plateformes & Studios
    externalStudio: null    // filtre studio depuis la page Plateformes & Studios
  };

  // Référence aux médias originaux
  let allMedias = [];

  // Cache des métadonnées séries (posterUrl, etc.) — chargé une fois au démarrage
  let seriesMetaCache = {};

  // Éléments DOM - Bouton toggle de vue
  const viewToggleBtn = document.getElementById('view-toggle-btn');

  // Éléments DOM - Sidebar de TRI
  const sortBtn = document.getElementById('sort-btn');
  const sortSidebar = document.getElementById('sort-sidebar');
  const sortOverlay = document.getElementById('sort-overlay');
  const sortCloseBtn = document.getElementById('sort-close-btn');
  const sortResetBtn = document.getElementById('sort-reset-btn');
  const sortToggleBtn = document.getElementById('sort-toggle-btn');

  // Éléments DOM - Sidebar de FILTRES
  const filterBtn = document.getElementById('filter-btn');
  const filtersSidebar = document.getElementById('filters-sidebar');
  const filtersOverlay = document.getElementById('filters-overlay');
  const filtersCloseBtn = document.getElementById('filters-close-btn');
  const filtersResetBtn = document.getElementById('filters-reset-btn');
  const filterBadge = document.getElementById('filter-badge');

  // ========================================
  //  INITIALISATION
  // ========================================

  function init() {
    console.log('🔧 Initialisation du système de filtres...');

    // Charger les filtres sauvegardés
    loadFiltersFromStorage();

    // S'assurer que sortBy est défini (par défaut: 'category')
    if (!filtersState.sortBy) {
      filtersState.sortBy = 'category';
      console.log('📁 sortBy initialisé à "category"');
    }

    console.log('📊 État initial des filtres:', filtersState);

    // Attacher les événements
    attachEvents();

    // Charger les genres dynamiquement
    loadGenres();

    // Appliquer l'état initial
    updateSortToggleDisplay();
    updateViewModeDisplay();
    updateViewToggleAvailability();
    updateFilterBadge();
    updateColumnsDisplay();

    console.log('✅ Système de filtres initialisé');

    // Gestionnaire de mise à jour audio — accessible directement par main.js via executeJavaScript
    // Compteur de conversions actives par carte (pour les séries multi-épisodes)
    window.__activeConversions = window.__activeConversions || {};

    window.__onAudioStatus = ({ mediaId, status, progress }) => {
      console.log('[CONV]', { mediaId, status, progress });

      // Chercher la carte directement (standalone) ou via le groupe série
      let card = document.querySelector(`[data-media-id="${mediaId}"]`);
      const seriesCardId = window.__mediaSeriesMap?.[mediaId];
      const isSeriesEp = !card && !!seriesCardId;
      if (isSeriesEp) card = document.querySelector(`[data-media-id="${seriesCardId}"]`);
      if (!card) return;

      const cardId = seriesCardId || mediaId;
      // 'pending' = codec pas encore vérifié (quelques centaines de ms après l'import), pas une
      // conversion en cours. Sans cette distinction, TOUT fichier fraîchement importé affichait le
      // rond "conversion en cours", même un mp4/AAC qui n'a jamais besoin d'être converti.
      const isActive = status === 'converting';

      // Suivre les conversions actives par carte pour éviter de cacher le ring prématurément
      if (!window.__activeConversions[cardId]) window.__activeConversions[cardId] = new Set();
      if (isActive) {
        window.__activeConversions[cardId].add(mediaId);
      } else {
        window.__activeConversions[cardId].delete(mediaId);
      }
      const anyActive = window.__activeConversions[cardId].size > 0;

      const overlay = card.querySelector('.audio-converting-overlay');
      const playBtn = card.querySelector('.play-btn');
      if (!overlay) return;

      // Bouton play bloqué seulement pour les médias standalone (pas les séries)
      if (!isSeriesEp && playBtn) playBtn.disabled = anyActive;

      if (anyActive) {
        overlay.style.display = '';
        // Barre de progression seulement pour les médias standalone
        if (!isSeriesEp && typeof progress === 'number' && progress > 0) {
          const ring = overlay.querySelector('.audio-converting-ring');
          const ringFill = overlay.querySelector('.audio-ring-fill');
          const pctEl = overlay.querySelector('.audio-converting-pct');
          const labelEl = overlay.querySelector('.audio-converting-label');
          if (ring) ring.classList.add('has-progress');
          if (ringFill) {
            const dash = Math.round(progress * 0.999 * 10) / 10;
            ringFill.style.strokeDasharray = `${dash} 99.9`;
          }
          if (pctEl) { pctEl.style.display = ''; pctEl.textContent = `${progress}%`; }
          if (labelEl) labelEl.style.display = 'none';
        }
      } else {
        overlay.style.display = 'none';
        const ring = overlay.querySelector('.audio-converting-ring');
        const ringFill = overlay.querySelector('.audio-ring-fill');
        const pctEl = overlay.querySelector('.audio-converting-pct');
        const labelEl = overlay.querySelector('.audio-converting-label');
        if (ring) ring.classList.remove('has-progress');
        if (ringFill) ringFill.style.strokeDasharray = '';
        if (pctEl) { pctEl.style.display = 'none'; pctEl.textContent = ''; }
        if (labelEl) labelEl.style.display = '';
      }
    };


    // Sync initial des overlays audio après le premier rendu des cartes
    syncAudioOverlays();
  }

  // Synchronise les overlays audio de toutes les cartes visibles avec le statut réel.
  // Appelé à l'init et après chaque re-render pour rattraper les notifications manquées.
  function syncAudioOverlays() {
    if (!window.electronAPI?.getAudioStatuses) return;
    window.electronAPI.getAudioStatuses().then(result => {
      if (!result?.success) return;
      const statuses = result.statuses || {};
      Object.entries(statuses).forEach(([mediaId, info]) => {
        let card = document.querySelector(`[data-media-id="${mediaId}"]`);
        if (!card && window.__mediaSeriesMap?.[mediaId]) {
          card = document.querySelector(`[data-media-id="${window.__mediaSeriesMap[mediaId]}"]`);
        }
        if (!card) return;
        const overlay = card.querySelector('.audio-converting-overlay');
        if (!overlay) return;
        const active = info.status === 'converting';
        overlay.style.display = active ? '' : 'none';
      });
    }).catch(() => {});
  }

  // ========================================
  //  GESTION DES ÉVÉNEMENTS
  // ========================================

  function attachEvents() {
    // Toggle de vue (Sections / Global)
    viewToggleBtn.addEventListener('click', toggleViewMode);

    // Ouverture/fermeture du sidebar de TRI
    sortBtn.addEventListener('click', openSort);
    sortCloseBtn.addEventListener('click', closeSort);
    sortOverlay.addEventListener('click', closeSort);

    // Ouverture/fermeture du sidebar de FILTRES
    filterBtn.addEventListener('click', openFilters);
    filtersCloseBtn.addEventListener('click', closeFilters);
    filtersOverlay.addEventListener('click', closeFilters);

    // Toggle de tri global
    sortToggleBtn?.addEventListener('click', toggleSortOrder);

    // Options de tri (radio buttons)
    document.querySelectorAll('input[name="sort-by"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        filtersState.sortBy = e.target.value;
        updateViewToggleAvailability(); // Activer/désactiver le toggle selon le tri
        saveFiltersToStorage();
        applyFiltersAndSort();
      });
    });

    // Type de média (checkboxes)
    document.querySelectorAll('input[name="media-type"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          filtersState.mediaTypes.push(e.target.value);
        } else {
          filtersState.mediaTypes = filtersState.mediaTypes.filter(t => t !== e.target.value);
        }
        saveFiltersToStorage();
        applyFiltersAndSort();
        updateFilterBadge();
      });
    });

    // Recherche de genre
    const genreSearchInput = document.getElementById('genre-search-input');
    genreSearchInput.addEventListener('input', (e) => {
      filterGenresList(e.target.value);
    });

    // Range sliders pour l'année
    const yearMinSlider = document.getElementById('year-min-slider');
    const yearMaxSlider = document.getElementById('year-max-slider');
    const yearMinValue = document.getElementById('year-min-value');
    const yearMaxValue = document.getElementById('year-max-value');

    let yearDebounceTimer = null;
    const debouncedApply = () => {
      clearTimeout(yearDebounceTimer);
      yearDebounceTimer = setTimeout(() => { applyFiltersAndSort(); updateFilterBadge(); }, 300);
    };

    yearMinSlider.addEventListener('input', (e) => {
      const minVal = parseInt(e.target.value);
      const maxVal = parseInt(yearMaxSlider.value);

      if (minVal > maxVal - 1) {
        e.target.value = maxVal - 1;
        filtersState.yearMin = maxVal - 1;
      } else {
        filtersState.yearMin = minVal;
      }

      yearMinValue.textContent = filtersState.yearMin;
      saveFiltersToStorage();
      debouncedApply();
    });

    yearMaxSlider.addEventListener('input', (e) => {
      const minVal = parseInt(yearMinSlider.value);
      const maxVal = parseInt(e.target.value);

      if (maxVal < minVal + 1) {
        e.target.value = minVal + 1;
        filtersState.yearMax = minVal + 1;
      } else {
        filtersState.yearMax = maxVal;
      }

      yearMaxValue.textContent = filtersState.yearMax;
      saveFiltersToStorage();
      debouncedApply();
    });

    // Statut de visionnage (radio buttons)
    document.querySelectorAll('input[name="watch-status"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        filtersState.watchStatus = e.target.value;
        saveFiltersToStorage();
        applyFiltersAndSort();
        updateFilterBadge();
      });
    });

    // Étoiles de notation
    const ratingStars = document.querySelectorAll('#rating-stars-filter .rating-star');
    const ratingLabel = document.getElementById('rating-label');

    ratingStars.forEach((star, index) => {
      star.addEventListener('click', () => {
        const rating = index + 1;

        // Si on clique sur la même étoile, on désactive le filtre
        if (filtersState.minRating === rating) {
          filtersState.minRating = 0;
          ratingStars.forEach(s => {
            s.classList.remove('active');
            s.querySelector('i')?.classList.replace('fas', 'far');
          });
          ratingLabel.textContent = 'Aucune note minimale';
        } else {
          filtersState.minRating = rating;
          ratingStars.forEach((s, i) => {
            if (i < rating) {
              s.classList.add('active');
              s.querySelector('i')?.classList.replace('far', 'fas');
            } else {
              s.classList.remove('active');
              s.querySelector('i')?.classList.replace('fas', 'far');
            }
          });
          ratingLabel.textContent = `${rating}+ étoile${rating > 1 ? 's' : ''}`;
        }

        saveFiltersToStorage();
        applyFiltersAndSort();
        updateFilterBadge();
      });
    });

    // Sélecteur de colonnes
    document.querySelectorAll('.columns-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtersState.columnsCount = parseInt(btn.dataset.cols, 10);
        updateColumnsDisplay();
        applyGridColumns();
        saveFiltersToStorage();
      });
    });

    // Boutons de réinitialisation
    sortResetBtn.addEventListener('click', resetSort);
    filtersResetBtn.addEventListener('click', resetFilters);
  }

  // ========================================
  //  OUVERTURE / FERMETURE - SIDEBAR DE TRI
  // ========================================

  function openSort() {
    sortSidebar.classList.add('active');
    sortOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSort() {
    sortSidebar.classList.remove('active');
    sortOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ========================================
  //  OUVERTURE / FERMETURE - SIDEBAR DE FILTRES
  // ========================================

  function openFilters() {
    filtersSidebar.classList.add('active');
    filtersOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeFilters() {
    filtersSidebar.classList.remove('active');
    filtersOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ========================================
  //  TOGGLE DE TRI
  // ========================================

  function toggleSortOrder() {
    filtersState.sortOrder = filtersState.sortOrder === 'asc' ? 'desc' : 'asc';
    updateSortToggleDisplay();
    saveFiltersToStorage();
    applyFiltersAndSort();
  }

  function updateSortToggleDisplay() {
    if (!sortToggleBtn) return;
    const icon = sortToggleBtn.querySelector('i');
    const text = sortToggleBtn.querySelector('span');
    if (!icon || !text) return;

    if (filtersState.sortOrder === 'asc') {
      icon.className = 'fas fa-sort-alpha-down';
      text.textContent = 'A → Z';
      sortToggleBtn.setAttribute('data-order', 'asc');
    } else {
      icon.className = 'fas fa-sort-alpha-up';
      text.textContent = 'Z → A';
      sortToggleBtn.setAttribute('data-order', 'desc');
    }
  }

  // ========================================
  //  TOGGLE DE VUE (SECTIONS / GLOBAL)
  // ========================================

  function toggleViewMode() {
    // Animation de rotation
    viewToggleBtn.classList.add('switching');
    setTimeout(() => viewToggleBtn.classList.remove('switching'), 400);

    // Basculer entre les deux modes
    filtersState.viewMode = filtersState.viewMode === 'global' ? 'sections' : 'global';

    // Mettre à jour l'UI du bouton
    updateViewModeDisplay();

    // Sauvegarder et réappliquer
    saveFiltersToStorage();
    applyFiltersAndSort();
  }

  function updateViewModeDisplay() {
    // icons.js replaces <i class="fas"> with <span class="rk-icon">, so target either
    const iconEl = viewToggleBtn.querySelector('.view-icon .rk-icon')
                || viewToggleBtn.querySelector('.view-icon i');
    const label = viewToggleBtn.querySelector('.view-label');

    if (filtersState.viewMode === 'sections') {
      if (iconEl && window.rkIcon) iconEl.innerHTML = window.rkIcon.get('th-large') || '';
      if (label) label.textContent = 'Sections';
      viewToggleBtn.setAttribute('data-view', 'sections');
    } else {
      if (iconEl && window.rkIcon) iconEl.innerHTML = window.rkIcon.get('list') || '';
      if (label) label.textContent = 'Global';
      viewToggleBtn.setAttribute('data-view', 'global');
    }
  }

  function updateViewToggleAvailability() {
    // Le toggle est maintenant disponible pour TOUS les tris (y compris "Catégorie")
    viewToggleBtn.disabled = false;
    viewToggleBtn.style.opacity = '1';
    viewToggleBtn.style.cursor = 'pointer';
    viewToggleBtn.title = 'Basculer entre affichage par sections ou liste continue';
  }

  function updateColumnsDisplay() {
    document.querySelectorAll('.columns-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.cols, 10) === filtersState.columnsCount);
    });
  }

  function applyGridColumns() {
    document.documentElement.style.setProperty('--rk-grid-cols', filtersState.columnsCount);
  }

  // ========================================
  //  GENRES DYNAMIQUES
  // ========================================

  async function loadGenres() {
    try {
      // Récupérer tous les médias
      const mediasResult = await window.electronAPI.getAllMedias();

      if (!mediasResult.success || !mediasResult.medias) {
        console.warn('Impossible de charger les genres');
        return;
      }

      // Extraire tous les genres uniques
      const genresSet = new Set();
      mediasResult.medias.forEach(media => {
        if (media.genres && Array.isArray(media.genres)) {
          media.genres.forEach(genre => {
            if (genre && genre.trim()) {
              genresSet.add(genre.trim());
            }
          });
        }
      });

      const genres = Array.from(genresSet).sort();

      // Créer les checkboxes de genres
      const genreCheckboxes = document.getElementById('genre-checkboxes');
      genreCheckboxes.innerHTML = '';

      genres.forEach(genre => {
        const label = document.createElement('label');
        label.className = 'filter-checkbox';
        label.dataset.genre = genre.toLowerCase();

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'genre';
        checkbox.value = genre;

        const span = document.createElement('span');
        span.textContent = genre;

        label.appendChild(checkbox);
        label.appendChild(span);
        genreCheckboxes.appendChild(label);

        // Attacher l'événement
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            filtersState.genres.push(e.target.value);
          } else {
            filtersState.genres = filtersState.genres.filter(g => g !== e.target.value);
          }
          saveFiltersToStorage();
          applyFiltersAndSort();
          updateFilterBadge();
        });
      });

      console.log(`✅ ${genres.length} genres chargés`);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des genres:', error);
    }
  }

  function filterGenresList(searchTerm) {
    const genreCheckboxes = document.querySelectorAll('#genre-checkboxes .filter-checkbox');
    const term = searchTerm.toLowerCase().trim();

    genreCheckboxes.forEach(label => {
      const genre = label.dataset.genre;
      if (!term || genre.includes(term)) {
        label.style.display = 'flex';
      } else {
        label.style.display = 'none';
      }
    });
  }

  // ========================================
  //  APPLICATION DES FILTRES ET TRI
  // ========================================

  async function applyFiltersAndSort() {
    try {
      // Récupérer tous les médias
      const mediasResult = await window.electronAPI.getAllMedias();

      if (!mediasResult.success || !mediasResult.medias) {
        console.warn('Aucun média à filtrer');
        return;
      }

      allMedias = mediasResult.medias;

      // Rafraîchir le cache des métadonnées séries (posterUrl…)
      try {
        const seriesMetaResult = await window.electronAPI.getAllSeries();
        if (seriesMetaResult.success && seriesMetaResult.series) {
          seriesMetaCache = {};
          seriesMetaResult.series.forEach(s => { seriesMetaCache[s.id] = s; });
        }
      } catch (e) {
        console.warn('⚠️ Impossible de charger les métadonnées séries:', e);
      }

      // Charger la progression pour le rendu des cards
      try {
        const pr = await window.electronAPI.getAllProgress();
        if (pr.success) {
          window.progressData = { playProgress: pr.playProgress || {}, seriesProgress: pr.seriesProgress || {} };
        }
      } catch (e) { /* silencieux */ }

      // 1. Filtrer les médias
      let filteredMedias = filterMedias(allMedias);

      // 2. Trier les médias
      filteredMedias = sortMedias(filteredMedias);

      // 3. Afficher les médias filtrés et triés
      displayFilteredMedias(filteredMedias);

      // Rattraper les notifications audio qui ont pu arriver avant le rendu des cartes
      syncAudioOverlays();

      console.log(`✅ Filtrage et tri appliqués : ${filteredMedias.length} / ${allMedias.length} médias`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'application des filtres:', error);
    }
  }

  function filterMedias(medias) {
    console.log('🔍 État des filtres:', filtersState);
    console.log('📊 Médias à filtrer:', medias.length);

    return medias.filter(media => {
      // Filtre par type de média (null/undefined → 'unsorted')
      const effectiveCategory = media.category || 'unsorted';
      if (!filtersState.mediaTypes.includes(effectiveCategory)) {
        console.log(`❌ Média filtré (type): ${media.title} - catégorie: ${effectiveCategory}, types acceptés:`, filtersState.mediaTypes);
        return false;
      }

      // Filtre par genre
      if (filtersState.genres.length > 0) {
        if (!media.genres || !Array.isArray(media.genres) || media.genres.length === 0) {
          console.log(`❌ Média filtré (genre): ${media.title} - genres du média: ${JSON.stringify(media.genres)}, genres requis:`, filtersState.genres);
          return false;
        }
        const hasGenre = filtersState.genres.some(filterGenre =>
          media.genres.some(mediaGenre => mediaGenre === filterGenre)
        );
        if (!hasGenre) {
          console.log(`❌ Média filtré (genre): ${media.title} - aucun genre commun`);
          return false;
        }
      }

      // Filtre par année
      if (media.year) {
        if (media.year < filtersState.yearMin || media.year > filtersState.yearMax) {
          console.log(`❌ Média filtré (année): ${media.title} - année: ${media.year}, plage: ${filtersState.yearMin}-${filtersState.yearMax}`);
          return false;
        }
      }

      // Filtre par statut de visionnage
      if (filtersState.watchStatus !== 'all') {
        const prefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');
        let isWatched;
        if (media.category === 'series') {
          isWatched = !!(prefs.watchedSeries || {})[media.seriesId];
        } else {
          isWatched = !!media.lastWatched;
        }

        if (filtersState.watchStatus === 'toWatch' && isWatched) return false;
        if (filtersState.watchStatus === 'watched' && !isWatched) return false;
      }

      // Filtre par note minimale
      if (filtersState.minRating > 0) {
        const rating = media.rating || 0;
        if (rating < filtersState.minRating) {
          return false;
        }
      }

      // Filtre externe par plateforme (depuis page Plateformes & Studios)
      if (filtersState.externalPlatform) {
        const platformToMatch = filtersState.externalPlatform.toLowerCase();
        const mediaPlatform = (
          media.platform ||
          (media.category === 'series' && seriesMetaCache[media.seriesId]?.platform) ||
          ''
        ).toLowerCase();
        if (mediaPlatform !== platformToMatch) return false;
      }

      // Filtre externe par studio (depuis page Plateformes & Studios)
      if (filtersState.externalStudio) {
        const studioToMatch = filtersState.externalStudio.toLowerCase();
        const mediaStudios = (
          (media.studios?.length ? media.studios : null) ||
          (media.category === 'series' && seriesMetaCache[media.seriesId]?.studios?.length
            ? seriesMetaCache[media.seriesId].studios
            : null) ||
          []
        ).map(s => s.toLowerCase());
        if (!mediaStudios.some(s => s === studioToMatch)) return false;
      }

      return true;
    });
  }

  function sortMedias(medias) {
    const sorted = [...medias];
    const order = filtersState.sortOrder === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let valueA, valueB;

      switch (filtersState.sortBy) {
        case 'title':
          valueA = (a.title || '').toLowerCase();
          valueB = (b.title || '').toLowerCase();
          break;

        case 'year':
          valueA = a.year || 0;
          valueB = b.year || 0;
          break;

        case 'duration':
          valueA = a.duration || 0;
          valueB = b.duration || 0;
          break;

        case 'rating':
          valueA = a.rating || 0;
          valueB = b.rating || 0;
          break;

        case 'dateAdded':
        default:
          valueA = new Date(a.dateAdded || 0).getTime();
          valueB = new Date(b.dateAdded || 0).getTime();
          break;
      }

      if (valueA < valueB) return -1 * order;
      if (valueA > valueB) return 1 * order;
      return 0;
    });

    return sorted;
  }

  function displayFilteredMedias(medias) {
    console.log('🎯 displayFilteredMedias - État actuel:', {
      sortBy: filtersState.sortBy,
      viewMode: filtersState.viewMode,
      mediasCount: medias.length
    });

    // Masquer toutes les sections existantes
    hideAllSections();

    // TOUS les tris utilisent maintenant le système Sections/Global
    console.log(`📊 Affichage en mode "${filtersState.viewMode}" avec tri "${filtersState.sortBy}"`);

    if (filtersState.viewMode === 'sections') {
      displayMediasSections(medias);
    } else {
      displayMediasGlobalSort(medias);
    }

    applyGridColumns();
  }

  // Masquer toutes les sections
  function hideAllSections() {
    // Masquer les catégories fixes
    const categories = ['films', 'series', 'shorts', 'others', 'unsorted'];
    categories.forEach(cat => {
      const catElement = document.getElementById(`${cat}-category`);
      if (catElement) catElement.style.display = 'none';
    });

    // Masquer la section "Tous les médias"
    const allMediasSection = document.getElementById('all-medias-section');
    if (allMediasSection) allMediasSection.style.display = 'none';

    // Supprimer toutes les sections alphabétiques existantes
    document.querySelectorAll('.alphabetical-section').forEach(section => {
      section.remove();
    });
  }

  // Grouper les épisodes en séries
  function groupSeriesFromEpisodes(episodes) {
    const seriesGroups = {};
    episodes.forEach(episode => {
      if (episode.seriesId && episode.seriesName) {
        if (!seriesGroups[episode.seriesId]) {
          const meta = seriesMetaCache[episode.seriesId] || {};
          seriesGroups[episode.seriesId] = {
            id: episode.seriesId,
            seriesId: episode.seriesId,
            name: episode.seriesName,
            category: 'series',
            thumbnail: episode.thumbnail,
            posterUrl: meta.posterUrl || '',
            rating: meta.rating || 0,
            episodes: [],
            episodeCount: 0
          };
        }
        seriesGroups[episode.seriesId].episodes.push(episode);
        seriesGroups[episode.seriesId].episodeCount++;
      }
    });

    // Calculer la durée moyenne et l'état audio global pour chaque série
    Object.values(seriesGroups).forEach(s => {
      const withDuration = s.episodes.filter(ep => ep.duration > 0);
      s.duration = withDuration.length > 0
        ? Math.round(withDuration.reduce((sum, ep) => sum + ep.duration, 0) / withDuration.length)
        : 0;
      // audioStatus du groupe : 'converting' si au moins un épisode est en cours de conversion
      const anyConverting = s.episodes.some(ep => ep.audioStatus === 'converting');
      s.audioStatus = anyConverting ? 'converting' : 'ok';
      // Liste des IDs d'épisodes pour le mapping en direct
      s._episodeIds = s.episodes.map(ep => ep.id);
    });

    return Object.values(seriesGroups);
  }

  // Affichage en mode Sections (groupé selon le critère de tri)
  function displayMediasSections(medias) {
    console.log('📑 displayMediasSections appelé avec', medias.length, 'médias, tri:', filtersState.sortBy);

    // Préparer les médias : séparer séries et non-séries (via seriesId, pas category)
    const seriesEpisodes = medias.filter(m => m.seriesId != null);
    const nonSeriesMedias = medias.filter(m => m.seriesId == null);

    // Grouper les épisodes en séries
    const series = groupSeriesFromEpisodes(seriesEpisodes);

    // Combiner tous les médias
    const allMediasToDisplay = [...nonSeriesMedias, ...series];

    console.log('📊 Médias à afficher:', allMediasToDisplay.length, '(dont', series.length, 'séries)');

    // Grouper selon le critère de tri actuel
    const groupedMedias = groupMediasByCriteria(allMediasToDisplay, filtersState.sortBy);

    // Créer les sections
    const container = document.querySelector('.categories-container');
    if (!container) return;

    groupedMedias.sections.forEach(({ label, medias: sectionMedias }) => {
      // Créer la section
      const section = document.createElement('div');
      section.className = 'alphabetical-section';
      section.innerHTML = `
        <div class="alphabetical-section-header">
          <div class="alphabetical-letter">${label}</div>
          <div class="alphabetical-divider"></div>
          <span class="alphabetical-count">${sectionMedias.length}</span>
        </div>
        <div class="media-grid"></div>
      `;

      container.appendChild(section);

      // Remplir la grille
      const grid = section.querySelector('.media-grid');
      sectionMedias.forEach(media => {
        const card = createMediaCard(media);
        if (card) grid.appendChild(card);
      });
    });

    console.log(`✅ ${groupedMedias.sections.length} sections créées`);
  }

  // Grouper les médias selon le critère de tri
  function groupMediasByCriteria(medias, sortBy) {
    const groups = {};

    medias.forEach(media => {
      let key;

      switch (sortBy) {
        case 'category':
          // Grouper par catégorie
          const categoryMap = {
            'film': 'Films',
            'series': 'Séries',
            'documentaire': 'Documentaires',
            'animation': 'Animation',
            'concert': 'Concerts',
            'sport': 'Sport',
            'short': 'Courts métrages',
            'other': 'Autres',
            'unsorted': 'Non triés'
          };
          key = categoryMap[media.category] || 'Autres';
          break;

        case 'title':
          // Grouper par première lettre
          const title = media.title || media.name || '';
          const firstLetter = title.charAt(0).toUpperCase();
          key = /[A-Z]/.test(firstLetter) ? firstLetter : '#';
          break;

        case 'year':
          // Grouper par année
          key = media.year || 'Année inconnue';
          break;

        case 'dateAdded':
          // Grouper par année d'ajout
          if (media.dateAdded) {
            const date = new Date(media.dateAdded);
            key = date.getFullYear();
          } else {
            key = 'Date inconnue';
          }
          break;

        case 'rating':
          // Grouper par note (arrondie)
          const rating = media.rating || 0;
          if (rating === 0) {
            key = 'Non noté';
          } else {
            key = `${'⭐'.repeat(rating)} (${rating})`;
          }
          break;

        case 'duration':
          // Grouper par plage de durée
          const duration = media.duration || 0;
          if (duration === 0) {
            key = 'Durée inconnue';
          } else if (duration < 30) {
            key = '< 30 min';
          } else if (duration < 60) {
            key = '30-60 min';
          } else if (duration < 90) {
            key = '60-90 min';
          } else if (duration < 120) {
            key = '90-120 min';
          } else {
            key = '> 120 min';
          }
          break;

        default:
          key = 'Autres';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(media);
    });

    // Trier les groupes selon le critère et l'ordre
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      // Cas spéciaux toujours à la fin
      const specialKeys = ['#', 'Année inconnue', 'Date inconnue', 'Non noté', 'Durée inconnue', 'Autres'];
      const aIsSpecial = specialKeys.includes(a);
      const bIsSpecial = specialKeys.includes(b);

      if (aIsSpecial && !bIsSpecial) return 1;
      if (!aIsSpecial && bIsSpecial) return -1;
      if (aIsSpecial && bIsSpecial) return 0;

      // Tri spécifique pour les catégories
      if (sortBy === 'category') {
        const categoryOrder = ['Films', 'Séries', 'Documentaires', 'Animation', 'Concerts', 'Sport', 'Courts métrages', 'Autres', 'Non triés'];
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        // Note: Le tri par catégorie ne respecte pas sortOrder (asc/desc)
        // car l'ordre logique est toujours Films → Séries → Courts → Autres
        return indexA - indexB;
      }

      // Tri numérique pour les années
      if (sortBy === 'year' || sortBy === 'dateAdded') {
        const numA = parseInt(a);
        const numB = parseInt(b);
        return filtersState.sortOrder === 'asc' ? numB - numA : numA - numB; // Années récentes en premier par défaut
      }

      // Tri alphabétique par défaut
      if (filtersState.sortOrder === 'asc') {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });

    return {
      sections: sortedKeys.map(key => ({
        label: key,
        medias: groups[key]
      }))
    };
  }

  // Affichage en mode tri global (une seule liste de tous les médias)
  function displayMediasGlobalSort(medias) {
    console.log('🔍 displayMediasGlobalSort appelé avec', medias.length, 'médias');

    // Masquer toutes les catégories
    const categories = ['films', 'series', 'shorts', 'others', 'unsorted'];
    categories.forEach(cat => {
      const catElement = document.getElementById(`${cat}-category`);
      if (catElement) catElement.style.display = 'none';
    });

    // Créer ou récupérer une section "Tous les médias"
    let allMediasSection = document.getElementById('all-medias-section');
    if (!allMediasSection) {
      allMediasSection = document.createElement('div');
      allMediasSection.id = 'all-medias-section';
      allMediasSection.className = 'media-category';
      allMediasSection.innerHTML = `
        <div class="category-header">
          <h3 class="category-title">
            <i class="fas fa-layer-group"></i>
            Tous les médias
          </h3>
          <span class="category-count" id="all-medias-count">0</span>
        </div>
        <div class="media-grid" id="all-medias-grid"></div>
      `;
      const container = document.querySelector('.categories-container');
      if (container) container.insertBefore(allMediasSection, container.firstChild);
    }

    allMediasSection.style.display = 'block';
    const allMediasGrid = document.getElementById('all-medias-grid');
    const allMediasCount = document.getElementById('all-medias-count');

    // Vider la grille
    allMediasGrid.innerHTML = '';

    // Pour les séries, on affiche les groupes de séries plutôt que les épisodes individuels
    const seriesEpisodes = medias.filter(m => m.seriesId != null);
    const nonSeriesMedias = medias.filter(m => m.seriesId == null);

    // Grouper les épisodes de séries (utilise la fonction commune)
    const series = groupSeriesFromEpisodes(seriesEpisodes);

    // Combiner médias non-série et groupes de séries
    const allMediasToDisplay = [...nonSeriesMedias, ...series];

    console.log('📊 Affichage de', allMediasToDisplay.length, 'médias (dont', series.length, 'séries)');

    // Afficher chaque média ou état vide
    if (allMediasToDisplay.length === 0) {
      allMediasGrid.innerHTML = `
        <div class="empty-state">
          <span class="icon">🎬</span>
          <p>Aucun média ne correspond aux filtres sélectionnés.</p>
        </div>`;
    } else {
      allMediasToDisplay.forEach(media => {
        const card = createMediaCard(media);
        if (card) allMediasGrid.appendChild(card);
      });
    }

    // Mettre à jour le compteur
    allMediasCount.textContent = allMediasToDisplay.length;
  }

  // Créer une carte de média en utilisant le template HTML
  function createMediaCard(media) {
    // Utiliser le template HTML si disponible, sinon créer manuellement
    const template = document.getElementById('media-card-template');
    let card;

    if (template) {
      // Cloner le template
      card = template.content.cloneNode(true).querySelector('.media-card');
    } else {
      // Créer manuellement si le template n'est pas disponible
      card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <div class="media-thumbnail-container">
          <img src="" alt="" class="media-thumbnail">
          <div class="play-overlay">
            <button class="play-btn" title="Lancer la lecture">
              <i class="fas fa-play"></i>
            </button>
          </div>
          <div class="media-card-progress" style="display:none">
            <div class="media-card-progress-fill"></div>
          </div>
          <div class="audio-converting-overlay" style="display:none">
            <div class="audio-converting-ring">
              <svg viewBox="0 0 36 36" class="audio-ring-svg">
                <circle class="audio-ring-bg" cx="18" cy="18" r="15.9"/>
                <circle class="audio-ring-fill" cx="18" cy="18" r="15.9"/>
              </svg>
            </div>
            <span class="audio-converting-label">Conversion…</span>
            <span class="audio-converting-pct" style="display:none"></span>
          </div>
          <div class="watch-top">
            <button class="btn-watch-toggle">à voir</button>
          </div>
        </div>
        <div class="media-info">
          <div class="media-title-container">
            <h3 class="media-title"></h3>
          </div>
          <div class="media-extended-info">
            <div class="media-duration">
              Durée: <span class="duration-value"></span>
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
    }

    // Configurer les données de la carte
    card.dataset.id = media.id;
    card.dataset.mediaId = media.id;
    card.dataset.title = (media.title || media.name || '').toLowerCase();

    // Configurer l'image avec génération automatique de thumbnail
    const img = card.querySelector('.media-thumbnail');
    window.setupImageWithFallback(
      img,
      media.id,
      media.posterUrl,
      media.thumbnail,
      media.title || media.name || 'Sans titre'
    );

    // Configurer le titre
    card.querySelector('.media-title').textContent = media.title || media.name || 'Sans titre';

    // Configurer la durée
    const durationValue = card.querySelector('.duration-value');
    if (durationValue) {
      durationValue.textContent = window.formatTime ? window.formatTime(media.duration || 0) : '0min';
    }

    // Configurer le statut "vu/à voir"
    let isWatched;
    if (media.category === 'series') {
      const prefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');
      isWatched = !!(prefs.watchedSeries || {})[media.id];
    } else {
      isWatched = !!media.lastWatched;
    }
    const watchButton = card.querySelector('.btn-watch-toggle');

    if (watchButton) {
      watchButton.textContent = isWatched ? 'vu !' : 'à voir';
      if (isWatched) watchButton.classList.add('watched');

      watchButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (media.category === 'series') {
          toggleSeriesWatchStatus(media.id, watchButton);
        } else {
          toggleWatchStatus(media.id, watchButton);
        }
      });
    }

    // Barre de progression
    const progressWrap = card.querySelector('.media-card-progress');
    if (progressWrap) {
      let progressPct = null;
      if (media.category === 'series') {
        const sp = media.seriesId ? window.progressData?.seriesProgress?.[media.seriesId] : null;
        if (sp) progressPct = sp.pct;
      } else {
        const pp = window.progressData?.playProgress?.[media.id];
        if (pp) progressPct = pp.pct;
      }
      if (progressPct !== null && progressPct > 0.02) {
        progressWrap.style.display = '';
        progressWrap.querySelector('.media-card-progress-fill').style.width = `${Math.min(100, Math.round(progressPct * 100))}%`;
      }
    }

    // Overlay et bouton play — conversion en cours (standalone et groupe série)
    const audioOverlay = card.querySelector('.audio-converting-overlay');
    const playBtnInit = card.querySelector('.play-btn');
    if (media.audioStatus === 'converting') {
      if (audioOverlay) audioOverlay.style.display = '';
      if (media.category !== 'series' && playBtnInit) playBtnInit.disabled = true;
    }

    // Mapping épisode→série pour les mises à jour audio en direct
    if (media.category === 'series' && media._episodeIds?.length) {
      if (!window.__mediaSeriesMap) window.__mediaSeriesMap = {};
      media._episodeIds.forEach(epId => { window.__mediaSeriesMap[epId] = media.id; });
    }

    // Configurer les étoiles de notation
    const rating = media.rating || 0;
    if (window.updateStarsDisplay) {
      window.updateStarsDisplay(card, rating);
    }
    if (window.setupStarsInteraction) {
      window.setupStarsInteraction(card, (newRating) => rateMedia(media.id, newRating));
    }

    // Event listener pour le bouton play
    const playBtn = card.querySelector('.play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Pour les séries, lire directement le premier épisode
        if (media.category === 'series' && window.playSeriesFirstEpisode && media.seriesId) {
          await window.playSeriesFirstEpisode(media.seriesId);
        } else {
          // Pour les médias uniques, lire directement
          if (window.playMedia) window.playMedia(media.id);
        }
      });
    }

    // Event listener pour la carte entière
    card.addEventListener('click', () => {
      if (media.category === 'series' && window.openSeries && media.seriesId) {
        window.openSeries(media.seriesId);
      } else if (media.category === 'series') {
        console.warn('Épisode orphelin sans seriesId, impossible d\'ouvrir la série:', media.id);
      } else if (window.openMovieModal) {
        window.openMovieModal(media.id);
      }
    });

    return card;
  }

  // Fonctions helper pour les préférences utilisateur
  function toggleWatchStatus(mediaId, button) {
    const nowWatched = !button.classList.contains('watched');
    button.textContent = nowWatched ? 'vu !' : 'à voir';
    button.classList.toggle('watched', nowWatched);
    window.electronAPI.updateWatchStatus(mediaId, nowWatched);
  }

  function toggleSeriesWatchStatus(seriesId, button) {
    const nowWatched = !button.classList.contains('watched');
    button.textContent = nowWatched ? 'vu !' : 'à voir';
    button.classList.toggle('watched', nowWatched);
    const prefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');
    if (!prefs.watchedSeries) prefs.watchedSeries = {};
    if (nowWatched) prefs.watchedSeries[seriesId] = true;
    else delete prefs.watchedSeries[seriesId];
    localStorage.setItem('userPrefs_global', JSON.stringify(prefs));
    window.electronAPI.updateWatchedSeries(seriesId, nowWatched);
  }

  function rateMedia(mediaId, rating) {
    window.electronAPI.updateRating(mediaId, rating);
  }

  // ========================================
  //  BADGE DE COMPTEUR
  // ========================================

  function updateFilterBadge() {
    let activeFiltersCount = 0;

    // Compter les types de médias décochés
    const allTypes = ['film', 'series', 'short', 'other'];
    const uncheckedTypes = allTypes.filter(type => !filtersState.mediaTypes.includes(type));
    activeFiltersCount += uncheckedTypes.length;

    // Compter les genres sélectionnés
    activeFiltersCount += filtersState.genres.length;

    // Compter le filtre d'année s'il n'est pas par défaut
    if (filtersState.yearMin !== 1900 || filtersState.yearMax !== 2030) {
      activeFiltersCount++;
    }

    // Compter le statut de visionnage
    if (filtersState.watchStatus !== 'all') {
      activeFiltersCount++;
    }

    // Compter la note minimale
    if (filtersState.minRating > 0) {
      activeFiltersCount++;
    }

    // Afficher ou masquer le badge
    if (activeFiltersCount > 0) {
      filterBadge.textContent = activeFiltersCount;
      filterBadge.style.display = 'inline-flex';
    } else {
      filterBadge.style.display = 'none';
    }
  }

  // ========================================
  //  RÉINITIALISATION - TRI
  // ========================================

  function resetSort() {
    // Réinitialiser uniquement les paramètres de tri
    filtersState.sortBy = 'category';
    filtersState.sortOrder = 'asc';
    filtersState.columnsCount = 5;

    // Réinitialiser l'UI du tri
    document.querySelectorAll('input[name="sort-by"]').forEach(radio => {
      radio.checked = radio.value === 'category';
    });
    updateColumnsDisplay();

    // Sauvegarder et appliquer
    saveFiltersToStorage();
    updateSortToggleDisplay();
    applyFiltersAndSort();

    console.log('✅ Tri réinitialisé');
  }

  // ========================================
  //  RÉINITIALISATION - FILTRES
  // ========================================

  function resetFilters() {
    // Réinitialiser uniquement les filtres (pas le tri)
    filtersState.mediaTypes = ['film', 'series', 'documentaire', 'animation', 'concert', 'sport', 'short', 'other'];
    filtersState.genres = [];
    filtersState.yearMin = 1900;
    filtersState.yearMax = 2030;
    filtersState.watchStatus = 'all';
    filtersState.minRating = 0;

    // Réinitialiser l'UI des filtres (pas du tri)

    document.querySelectorAll('input[name="media-type"]').forEach(checkbox => {
      checkbox.checked = true;
    });

    document.querySelectorAll('input[name="genre"]').forEach(checkbox => {
      checkbox.checked = false;
    });

    document.getElementById('year-min-slider').value = 1900;
    document.getElementById('year-max-slider').value = 2030;
    document.getElementById('year-min-value').textContent = '1900';
    document.getElementById('year-max-value').textContent = '2030';

    document.querySelectorAll('input[name="watch-status"]').forEach(radio => {
      radio.checked = radio.value === 'all';
    });

    document.querySelectorAll('#rating-stars-filter .rating-star').forEach(star => {
      star.classList.remove('active');
      star.querySelector('i')?.classList.replace('fas', 'far');
    });
    document.getElementById('rating-label').textContent = 'Aucune note minimale';

    // Sauvegarder et appliquer
    saveFiltersToStorage();
    updateFilterBadge();
    applyFiltersAndSort();

    console.log('✅ Filtres réinitialisés');
  }

  // ========================================
  //  PERSISTANCE (localStorage)
  // ========================================

  function saveFiltersToStorage() {
    try {
      localStorage.setItem('filtersState', JSON.stringify(filtersState));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des filtres:', error);
    }
  }

  function loadFiltersFromStorage() {
    try {
      const saved = localStorage.getItem('filtersState');
      if (saved) {
        const savedState = JSON.parse(saved);

        // Fusionner avec l'état par défaut pour s'assurer qu'on a toutes les propriétés
        filtersState = {
          ...filtersState,
          ...savedState
        };

        // S'assurer que sortBy a une valeur valide
        if (!filtersState.sortBy) {
          filtersState.sortBy = 'category';
        }

        // Réinitialiser les filtres temporaires au lancement (ne pas persister entre sessions)
        filtersState.watchStatus = 'all';
        filtersState.minRating = 0;

        // MIGRATION: Ajouter 'unsorted' si absent (pour rétrocompatibilité)
        if (filtersState.mediaTypes && !filtersState.mediaTypes.includes('unsorted')) {
          filtersState.mediaTypes.push('unsorted');
          console.log('🔄 Migration: ajout de "unsorted" aux types de médias');
          saveFiltersToStorage(); // Sauvegarder la migration
        }

        // MIGRATION: Ajouter 'short' si absent (pour rétrocompatibilité)
        if (filtersState.mediaTypes && !filtersState.mediaTypes.includes('short')) {
          filtersState.mediaTypes.push('short');
          console.log('🔄 Migration: ajout de "short" aux types de médias');
          saveFiltersToStorage(); // Sauvegarder la migration
        }

        // Restaurer l'UI
        restoreUIFromState();

        console.log('✅ Filtres restaurés depuis localStorage');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des filtres:', error);
    }
  }

  function restoreUIFromState() {
    // Restaurer le tri
    document.querySelectorAll('input[name="sort-by"]').forEach(radio => {
      radio.checked = radio.value === filtersState.sortBy;
    });

    // Restaurer les types de médias
    document.querySelectorAll('input[name="media-type"]').forEach(checkbox => {
      checkbox.checked = filtersState.mediaTypes.includes(checkbox.value);
    });

    // Restaurer les années
    document.getElementById('year-min-slider').value = filtersState.yearMin;
    document.getElementById('year-max-slider').value = filtersState.yearMax;
    document.getElementById('year-min-value').textContent = filtersState.yearMin;
    document.getElementById('year-max-value').textContent = filtersState.yearMax;

    // Restaurer le statut de visionnage
    document.querySelectorAll('input[name="watch-status"]').forEach(radio => {
      radio.checked = radio.value === filtersState.watchStatus;
    });

    // Restaurer la note minimale (sera fait après le chargement du DOM)
    setTimeout(() => {
      const ratingStars = document.querySelectorAll('#rating-stars-filter .rating-star');
      const ratingLabel = document.getElementById('rating-label');

      ratingStars.forEach((star, index) => {
        if (index < filtersState.minRating) {
          star.classList.add('active');
          star.querySelector('i')?.classList.replace('far', 'fas');
        }
      });

      if (filtersState.minRating > 0) {
        ratingLabel.textContent = `${filtersState.minRating}+ étoile${filtersState.minRating > 1 ? 's' : ''}`;
      }
    }, 100);
  }

  // ========================================
  //  EXPOSITION GLOBALE
  // ========================================

  window.filtersSystem = {
    init,
    applyFiltersAndSort,
    resetFilters,
    getState: () => filtersState
  };

  // Auto-init quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ========================================
  //  API PUBLIQUE — filtres externes
  // ========================================

  window.filterByPlatform = function(name) {
    filtersState.externalPlatform = name;
    filtersState.externalStudio = null;
    _showExternalFilterBanner('plateforme', name);
    document.querySelector('.tab-link[data-tab="accueil"]')?.click();
    applyFiltersAndSort();
  };

  window.filterByStudio = function(name) {
    filtersState.externalStudio = name;
    filtersState.externalPlatform = null;
    _showExternalFilterBanner('studio', name);
    document.querySelector('.tab-link[data-tab="accueil"]')?.click();
    applyFiltersAndSort();
  };

  window.clearExternalFilter = function() {
    filtersState.externalPlatform = null;
    filtersState.externalStudio = null;
    _hideExternalFilterBanner();
    applyFiltersAndSort();
  };

  function _showExternalFilterBanner(type, name) {
    let banner = document.getElementById('external-filter-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'external-filter-banner';
      banner.className = 'external-filter-banner';
      const sectionHeader = document.querySelector('#section-accueil .section-header');
      if (sectionHeader) sectionHeader.insertAdjacentElement('afterend', banner);
    }
    const icon = type === 'plateforme' ? 'fa-tv' : 'fa-film';
    banner.innerHTML = `
      <i class="fas ${icon}"></i>
      <span>Filtré par ${type} : <strong>${name}</strong></span>
      <button class="external-filter-clear" onclick="window.clearExternalFilter()">
        <i class="fas fa-times"></i> Effacer le filtre
      </button>
    `;
    banner.style.display = 'flex';
  }

  function _hideExternalFilterBanner() {
    const banner = document.getElementById('external-filter-banner');
    if (banner) banner.style.display = 'none';
  }

})();
