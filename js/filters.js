// ========================================
//  SYSTÈME DE FILTRES ET TRI - RACKOON STREAMING
// ========================================

(function() {
  'use strict';

  // État des filtres et tri
  let filtersState = {
    sortBy: 'category', // 'category' affiche par catégories, les autres trient globalement
    sortOrder: 'asc', // 'asc' ou 'desc'
    viewMode: 'global', // 'global' ou 'sections' (affichage par lettres)
    mediaTypes: ['film', 'series', 'short', 'other'],
    genres: [],
    yearMin: 1900,
    yearMax: 2030,
    watchStatus: 'all', // 'all', 'toWatch', 'watched'
    minRating: 0
  };

  // Référence aux médias originaux
  let allMedias = [];

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

    // Attacher les événements
    attachEvents();

    // Charger les genres dynamiquement
    loadGenres();

    // Appliquer l'état initial
    updateSortToggleDisplay();
    updateViewModeDisplay();
    updateViewToggleAvailability();
    updateFilterBadge();

    console.log('✅ Système de filtres initialisé');
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
    sortToggleBtn.addEventListener('click', toggleSortOrder);

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
      applyFiltersAndSort();
      updateFilterBadge();
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
      applyFiltersAndSort();
      updateFilterBadge();
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
    const ratingStars = document.querySelectorAll('.rating-star');
    const ratingLabel = document.getElementById('rating-label');

    ratingStars.forEach((star, index) => {
      star.addEventListener('click', () => {
        const rating = index + 1;

        // Si on clique sur la même étoile, on désactive le filtre
        if (filtersState.minRating === rating) {
          filtersState.minRating = 0;
          ratingStars.forEach(s => s.classList.remove('active'));
          ratingStars.forEach(s => s.querySelector('i').classList.replace('fas', 'far'));
          ratingLabel.textContent = 'Aucune note minimale';
        } else {
          filtersState.minRating = rating;
          ratingStars.forEach((s, i) => {
            if (i < rating) {
              s.classList.add('active');
              s.querySelector('i').classList.replace('far', 'fas');
            } else {
              s.classList.remove('active');
              s.querySelector('i').classList.replace('fas', 'far');
            }
          });
          ratingLabel.textContent = `${rating}+ étoile${rating > 1 ? 's' : ''}`;
        }

        saveFiltersToStorage();
        applyFiltersAndSort();
        updateFilterBadge();
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
    const icon = sortToggleBtn.querySelector('i');
    const text = sortToggleBtn.querySelector('span');

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
    const icon = viewToggleBtn.querySelector('.view-icon i');
    const label = viewToggleBtn.querySelector('.view-label');

    if (filtersState.viewMode === 'sections') {
      icon.className = 'fas fa-th-large'; // Icône grille/sections
      label.textContent = 'Sections';
      viewToggleBtn.setAttribute('data-view', 'sections');
    } else {
      icon.className = 'fas fa-list'; // Icône liste
      label.textContent = 'Global';
      viewToggleBtn.setAttribute('data-view', 'global');
    }
  }

  function updateViewToggleAvailability() {
    // Le toggle est disponible pour TOUS les tris sauf "Catégorie"
    if (filtersState.sortBy === 'category') {
      viewToggleBtn.disabled = true;
      viewToggleBtn.style.opacity = '0.3';
      viewToggleBtn.style.cursor = 'not-allowed';
      viewToggleBtn.title = 'Non disponible en mode Catégorie';
    } else {
      viewToggleBtn.disabled = false;
      viewToggleBtn.style.opacity = '1';
      viewToggleBtn.style.cursor = 'pointer';
      viewToggleBtn.title = 'Basculer entre affichage par sections ou liste continue';
    }
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

      // 1. Filtrer les médias
      let filteredMedias = filterMedias(allMedias);

      // 2. Trier les médias
      filteredMedias = sortMedias(filteredMedias);

      // 3. Afficher les médias filtrés et triés
      displayFilteredMedias(filteredMedias);

      console.log(`✅ Filtrage et tri appliqués : ${filteredMedias.length} / ${allMedias.length} médias`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'application des filtres:', error);
    }
  }

  function filterMedias(medias) {
    return medias.filter(media => {
      // Filtre par type de média
      if (!filtersState.mediaTypes.includes(media.category)) {
        return false;
      }

      // Filtre par genre
      if (filtersState.genres.length > 0) {
        if (!media.genres || !Array.isArray(media.genres)) {
          return false;
        }
        const hasGenre = filtersState.genres.some(filterGenre =>
          media.genres.some(mediaGenre => mediaGenre === filterGenre)
        );
        if (!hasGenre) {
          return false;
        }
      }

      // Filtre par année
      if (media.year) {
        if (media.year < filtersState.yearMin || media.year > filtersState.yearMax) {
          return false;
        }
      }

      // Filtre par statut de visionnage
      if (filtersState.watchStatus !== 'all') {
        const userPrefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{"watchedMovies":{}}');
        const isWatched = userPrefs.watchedMovies[media.id] === true;

        if (filtersState.watchStatus === 'toWatch' && isWatched) {
          return false;
        }
        if (filtersState.watchStatus === 'watched' && !isWatched) {
          return false;
        }
      }

      // Filtre par note minimale
      if (filtersState.minRating > 0) {
        const userPrefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{"ratings":{}}');
        const rating = userPrefs.ratings[media.id] || 0;
        if (rating < filtersState.minRating) {
          return false;
        }
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
          const userPrefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{"ratings":{}}');
          valueA = userPrefs.ratings[a.id] || 0;
          valueB = userPrefs.ratings[b.id] || 0;
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
    // Masquer toutes les sections existantes
    hideAllSections();

    // Mode CATÉGORIE : Affiche par sections (Films / Séries / Courts métrages / Autres)
    if (filtersState.sortBy === 'category') {
      displayByCategories(medias);
    }
    // Tous les autres tris : Modes Sections ou Global selon le toggle
    else {
      if (filtersState.viewMode === 'sections') {
        displayMediasSections(medias);
      } else {
        displayMediasGlobalSort(medias);
      }
    }
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

  // Affichage par catégories (Films, Séries, Courts métrages, Autres)
  function displayByCategories(medias) {
    // Réafficher toutes les catégories
    const categories = ['films', 'series', 'shorts', 'others', 'unsorted'];
    categories.forEach(cat => {
      const catElement = document.getElementById(`${cat}-category`);
      if (catElement) catElement.style.display = 'block';
    });

    // Séparer les films des séries
    const films = medias.filter(media => media.category !== 'series');
    const seriesEpisodes = medias.filter(media => media.category === 'series');

    // Afficher avec displayMedias (qui groupe par catégorie)
    if (window.displayMedias) {
      window.displayMedias(films);
    }

    // Afficher les séries
    if (window.displaySeries) {
      const series = groupSeriesFromEpisodes(seriesEpisodes);
      window.displaySeries(series);
    }
  }

  // Grouper les épisodes en séries
  function groupSeriesFromEpisodes(episodes) {
    const seriesGroups = {};
    episodes.forEach(episode => {
      if (episode.seriesId && episode.seriesName) {
        if (!seriesGroups[episode.seriesId]) {
          seriesGroups[episode.seriesId] = {
            id: episode.seriesId,
            name: episode.seriesName,
            category: 'series',
            thumbnail: episode.thumbnail, // Prendre la miniature du premier épisode
            episodes: [],
            episodeCount: 0
          };
        }
        seriesGroups[episode.seriesId].episodes.push(episode);
        seriesGroups[episode.seriesId].episodeCount++;
      }
    });
    return Object.values(seriesGroups);
  }

  // Affichage en mode Sections (groupé selon le critère de tri)
  function displayMediasSections(medias) {
    console.log('📑 displayMediasSections appelé avec', medias.length, 'médias, tri:', filtersState.sortBy);

    // Préparer les médias : séparer séries et non-séries
    const seriesEpisodes = medias.filter(m => m.category === 'series');
    const nonSeriesMedias = medias.filter(m => m.category !== 'series');

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
          const userPrefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{"ratings":{}}');
          const rating = userPrefs.ratings[media.id] || 0;
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
    const seriesEpisodes = medias.filter(m => m.category === 'series');
    const nonSeriesMedias = medias.filter(m => m.category !== 'series');

    // Grouper les épisodes de séries (utilise la fonction commune)
    const series = groupSeriesFromEpisodes(seriesEpisodes);

    // Combiner médias non-série et groupes de séries
    const allMediasToDisplay = [...nonSeriesMedias, ...series];

    console.log('📊 Affichage de', allMediasToDisplay.length, 'médias (dont', series.length, 'séries)');

    // Afficher chaque média
    allMediasToDisplay.forEach(media => {
      const card = createMediaCard(media);
      if (card) allMediasGrid.appendChild(card);
    });

    // Mettre à jour le compteur
    allMediasCount.textContent = allMediasToDisplay.length;
  }

  // Créer une carte de média (simplifié, basé sur le template)
  function createMediaCard(media) {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.dataset.id = media.id;

    const thumbnailSrc = media.thumbnail
      ? `../data/thumbnails/${media.thumbnail}`
      : '../public/img/default-thumbnail.svg';

    card.innerHTML = `
      <div class="media-thumbnail-container">
        <img src="${thumbnailSrc}" alt="${media.title}" class="media-thumbnail"
             onerror="this.src='../public/img/default-thumbnail.svg'">
        <div class="play-overlay">
          <button class="play-btn" title="Lancer la lecture">
            <i class="fas fa-play"></i>
          </button>
        </div>
      </div>
      <div class="media-info">
        <div class="media-title-container">
          <h3 class="media-title">${media.title || 'Sans titre'}</h3>
        </div>
      </div>
    `;

    // Ajouter les event listeners
    card.querySelector('.play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.playMedia) window.playMedia(media.path);
    });

    card.addEventListener('click', () => {
      if (media.category === 'series' && window.showSeriesModal) {
        window.showSeriesModal(media.seriesId);
      } else if (window.showMovieModal) {
        window.showMovieModal(media.id);
      }
    });

    return card;
  }

  // Fonction pour trier les groupes de séries
  function sortSeriesGroups(series) {
    const sorted = [...series];
    const order = filtersState.sortOrder === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let valueA, valueB;

      switch (filtersState.sortBy) {
        case 'title':
          valueA = (a.name || '').toLowerCase();
          valueB = (b.name || '').toLowerCase();
          break;

        case 'year':
          // Pour les séries, on prend l'année du premier épisode
          valueA = (a.episodes[0] && a.episodes[0].year) || 0;
          valueB = (b.episodes[0] && b.episodes[0].year) || 0;
          break;

        case 'dateAdded':
        default:
          // Pour les séries, on prend la date du premier épisode
          valueA = new Date((a.episodes[0] && a.episodes[0].dateAdded) || 0).getTime();
          valueB = new Date((b.episodes[0] && b.episodes[0].dateAdded) || 0).getTime();
          break;
      }

      if (valueA < valueB) return -1 * order;
      if (valueA > valueB) return 1 * order;
      return 0;
    });

    return sorted;
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

    // Réinitialiser l'UI du tri
    document.querySelectorAll('input[name="sort-by"]').forEach(radio => {
      radio.checked = radio.value === 'category';
    });

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
    filtersState.mediaTypes = ['film', 'series', 'short', 'other'];
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
    document.getElementById('year-min-value').textContent = '1990';
    document.getElementById('year-max-value').textContent = '2024';

    document.querySelectorAll('input[name="watch-status"]').forEach(radio => {
      radio.checked = radio.value === 'all';
    });

    document.querySelectorAll('.rating-star').forEach(star => {
      star.classList.remove('active');
      star.querySelector('i').classList.replace('fas', 'far');
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
        filtersState = JSON.parse(saved);

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
      const ratingStars = document.querySelectorAll('.rating-star');
      const ratingLabel = document.getElementById('rating-label');

      ratingStars.forEach((star, index) => {
        if (index < filtersState.minRating) {
          star.classList.add('active');
          star.querySelector('i').classList.replace('far', 'fas');
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

})();
