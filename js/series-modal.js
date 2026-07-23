/**
 * Gestionnaire de la modale série - Version améliorée similaire aux médias uniques
 */

// Configuration TMDB (mêmes clés que movie-modal.js)
const SERIES_TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMjIwYTRiMzAyMTZlMzkwYzE1MmE1MjhlNGVmYjc5YyIsIm5iZiI6MTczMzkzMjAyOS40Nywic3ViIjoiNjc1OWIzZmQ1MDZiNDIzOTRkMjE2MDM3Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.RFQAh_1LTZWemAFFIHJUimpU7BEHJxxrua0ys5rruos';
const SERIES_TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const SERIES_TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

class SeriesModal {
  constructor() {
    this.modal = document.getElementById('series-modal-overlay');
    console.log('🔍 Element series-modal-overlay trouvé:', !!this.modal);
    this.currentSeries = null;
    this.currentSeriesId = null;
    this.USER_PREFS_KEY = 'userPrefs_global';
    this.isOpening = false; // Protection contre les ouvertures multiples
    this.isEditMode = false;
    this.originalValues = null; // Sauvegarde des valeurs avant édition
    this.pendingPosterUrl = null; // URL du poster TMDB en attente
    this._episodeEdits = {};
    this._deletedEpisodeIds = [];
    this._tmdbImportRunning = false;
    this.attachEventListeners();
    this._listenAudioUpdates();
  }

  _listenAudioUpdates() {
    if (!window.electronAPI?.onAudioStatusUpdate) return;
    window.electronAPI.onAudioStatusUpdate(({ mediaId, status, convertedPath }) => {
      // Update episode objects in currentSeries so click handlers use fresh data
      if (this.currentSeries) {
        for (const season of this.currentSeries.seasons || []) {
          for (const ep of season.episodes || []) {
            if (ep.id === mediaId) {
              ep.audioStatus = status;
              ep.audioConvertedPath = convertedPath;
            }
          }
        }
      }

      // Update DOM if modal is open
      if (!this.modal) return;
      const card = this.modal.querySelector(`[data-episode-id="${mediaId}"]`);
      if (!card) return;
      card.dataset.episodeAudioStatus = status;
      if (status === 'ok' || status === 'error') {
        const playBtn = card.querySelector('.episode-play-btn');
        if (playBtn) {
          playBtn.disabled = false;
          playBtn.classList.remove('audio-converting');
          playBtn.title = status === 'error' ? 'Lecture (conversion audio indisponible)' : '';
          const spinner = card.querySelector('.episode-audio-spinner');
          if (spinner) spinner.remove();
        }
      }
    });
  }

  // Clé de stockage pour les préférences utilisateur
  getUserPrefs() {
    let userPrefs = localStorage.getItem(this.USER_PREFS_KEY);

    if (!userPrefs) {
      userPrefs = {
        watchedSeries: {},
        seriesRatings: {},
        seriesReviews: {}
      };
    } else {
      userPrefs = JSON.parse(userPrefs);
      if (!userPrefs.watchedSeries) userPrefs.watchedSeries = {};
      if (!userPrefs.seriesRatings) userPrefs.seriesRatings = {};
      if (!userPrefs.seriesReviews) userPrefs.seriesReviews = {};
    }

    return userPrefs;
  }

  saveUserPrefs(userPrefs) {
    localStorage.setItem(this.USER_PREFS_KEY, JSON.stringify(userPrefs));
  }

  attachEventListeners() {
    // Fermeture de la modale
    const closeBtn = document.getElementById('series-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Fermeture en cliquant sur l'overlay
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        // Vérifier que le clic est bien sur l'overlay et pas sur ses enfants
        if (e.target === this.modal) {
          e.stopPropagation(); // Empêcher la propagation
          this.hide();
        }
      });
    }

    // Bouton de lecture (ou TMDB en mode édition)
    const playBtn = document.getElementById('btn-play-series');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.isEditMode) {
          this.openTMDBSearch();
        } else {
          this.playOrResume();
        }
      });
    }

    // Bouton édition
    const editBtn = document.getElementById('series-edit-button');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (this.isEditMode) {
          // En mode édition, le bouton principal ne fait rien (on utilise save/cancel)
          return;
        }
        this.activateEditMode();
      });
    }

    // Bouton annuler édition
    const cancelBtn = document.getElementById('series-edit-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelEditMode());
    }

    // Bouton sauvegarder édition
    const saveBtn = document.getElementById('series-edit-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSeriesChanges());
    }

    // Bouton Watch Toggle
    const watchToggle = document.getElementById('btn-watch-toggle-series');
    if (watchToggle) {
      watchToggle.addEventListener('click', () => this.toggleWatchStatus());
    }

    // Système d'étoiles
    this.setupStarsInteraction();

    // Bouton sauvegarde avis
    const reviewSaveBtn = document.getElementById('series-review-save-btn');
    if (reviewSaveBtn) {
      reviewSaveBtn.addEventListener('click', () => this.saveReview());
    }
  }

  // Système d'étoiles progressif : clic ou clic-glissé
  setupStarsInteraction() {
    const starsContainer = document.getElementById('series-progressive-stars');
    const starsFill = document.getElementById('series-stars-fill');
    const ratingInput = document.getElementById('series-rating-input');
    const starsOverlay = document.getElementById('series-stars-overlay');

    if (!starsContainer || !starsFill || !ratingInput || !starsOverlay) return;

    let isDragging = false;

    const getRating = (e) => {
      const rect = starsContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      return (pct / 100) * 5;
    };

    const updateDisplay = (rating) => {
      starsFill.style.width = `${(rating / 5) * 100}%`;
      ratingInput.value = rating.toFixed(1);
    };

    starsOverlay.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateDisplay(getRating(e));
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateDisplay(getRating(e));
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      const rating = parseFloat(ratingInput.value) || 0;
      this.saveRating(rating);
    });

    // Input numérique manuel
    ratingInput.addEventListener('change', () => {
      let rating = parseFloat(ratingInput.value) || 0;
      rating = Math.max(0, Math.min(5, rating));
      updateDisplay(rating);
      this.saveRating(rating);
    });
  }

  // Sauvegarder la note
  saveRating(rating) {
    if (!this.currentSeriesId) return;

    // Sauvegarde en DB
    if (window.electronAPI && window.electronAPI.updateSeriesRating) {
      window.electronAPI.updateSeriesRating(this.currentSeriesId, rating);
    }

    // Sauvegarde en localStorage (fallback et rétrocompatibilité)
    const userPrefs = this.getUserPrefs();
    userPrefs.seriesRatings[this.currentSeriesId] = rating;
    this.saveUserPrefs(userPrefs);

    // Mettre à jour toutes les cards de cette série en temps réel
    document.querySelectorAll(`.media-card[data-series-id="${this.currentSeriesId}"]`).forEach(card => {
      if (window.updateStarsDisplay) window.updateStarsDisplay(card, rating);
    });
    window.dispatchEvent(new CustomEvent('seriesRatingUpdated', {
      detail: { seriesId: this.currentSeriesId, rating }
    }));

    const ratingQuick = document.getElementById('series-rating-quick');
    if (ratingQuick) ratingQuick.textContent = this.getStarsDisplay(rating);

    console.log(`⭐ Note sauvegardée: ${rating}/5 pour la série ${this.currentSeriesId}`);
  }

  // Afficher les étoiles selon la note
  getStarsDisplay(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (halfStar) stars += '⯨';
    stars += '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));
    return stars;
  }

  // Toggle statut vu/à voir
  toggleWatchStatus() {
    if (!this.currentSeriesId) return;

    const userPrefs = this.getUserPrefs();
    const watchToggle = document.getElementById('btn-watch-toggle-series');

    if (userPrefs.watchedSeries[this.currentSeriesId]) {
      delete userPrefs.watchedSeries[this.currentSeriesId];
      watchToggle.textContent = 'À voir';
      watchToggle.classList.remove('watched');
    } else {
      userPrefs.watchedSeries[this.currentSeriesId] = true;
      watchToggle.textContent = 'Vu !';
      watchToggle.classList.add('watched');
    }

    this.saveUserPrefs(userPrefs);

    const nowWatched = !!userPrefs.watchedSeries[this.currentSeriesId];

    // Persister en DB
    window.electronAPI.updateWatchedSeries(this.currentSeriesId, nowWatched);

    // Sync carte du dashboard
    const seriesCard = document.querySelector(`.media-card[data-series-id="${this.currentSeriesId}"]`);
    if (seriesCard) {
      const cardBtn = seriesCard.querySelector('.btn-watch-toggle');
      if (cardBtn) {
        cardBtn.textContent = nowWatched ? 'vu !' : 'à voir';
        cardBtn.classList.toggle('watched', nowWatched);
      }
    }

    console.log(`👁️ Statut de visionnage modifié pour la série ${this.currentSeriesId}`);
  }

  // Sauvegarder l'avis
  saveReview() {
    if (!this.currentSeriesId) return;

    const reviewInput = document.getElementById('series-review-input');
    if (!reviewInput) return;

    const review = reviewInput.value.trim();
    const userPrefs = this.getUserPrefs();

    if (review) {
      userPrefs.seriesReviews[this.currentSeriesId] = review;
    } else {
      delete userPrefs.seriesReviews[this.currentSeriesId];
    }

    this.saveUserPrefs(userPrefs);

    // Feedback visuel
    const saveBtn = document.getElementById('series-review-save-btn');
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Sauvegardé !';
      saveBtn.style.background = 'rgba(76, 175, 80, 0.3)';

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
      }, 2000);
    }

    console.log(`💬 Avis sauvegardé pour la série ${this.currentSeriesId}`);
  }

  async show(seriesId) {
    // Bloquer si une ouverture est déjà en cours
    if (this.isOpening) {
      console.log('⏳ Ouverture de modale série déjà en cours, veuillez patienter...');
      return;
    }

    try {
      this.isOpening = true;
      console.log('📺 Affichage de la série:', seriesId);

      // Vérifier si la modale est déjà ouverte
      if (this.modal && this.modal.classList.contains('active')) {
        console.log('⚠️ La modale série est déjà ouverte, fermeture en cours...');
        // Forcer la fermeture immédiate sans animation
        this.modal.classList.remove('active');
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.currentSeries = null;
        this.currentSeriesId = null;
        // Attendre un peu pour laisser le navigateur traiter les changements
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      this.currentSeriesId = seriesId;

      // Récupérer les données de la série
      const result = await window.electronAPI.getSeriesById(seriesId);

      if (!result.success) {
        console.error('❌ Erreur lors du chargement de la série:', result.message);
        return;
      }

      this.currentSeries = result.series;

      // Rafraîchir la progression avant de rendre les épisodes
      try {
        const pr = await window.electronAPI.getAllProgress();
        if (pr.success) {
          if (!window.progressData) window.progressData = {};
          window.progressData.playProgress = pr.playProgress || {};
          window.progressData.seriesProgress = pr.seriesProgress || {};
        }
      } catch (e) { /* silencieux */ }

      await this.populateModal(this.currentSeries);
      this.loadUserPreferences();
      this._updatePlayButton();

      // Réinitialiser complètement l'état de la modale
      this.modal.classList.remove('active');
      this.modal.style.display = 'flex';

      // Forcer un reflow du navigateur
      void this.modal.offsetHeight;

      // Afficher avec animation
      requestAnimationFrame(() => {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Empêcher le défilement
        console.log('✅ Modale série activée et affichée');
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage de la série:', error);
      // Nettoyer en cas d'erreur
      if (this.modal) {
        this.modal.classList.remove('active');
        this.modal.style.display = 'none';
      }
      document.body.style.overflow = '';
    } finally {
      // Libérer le verrou après la fin de l'animation CSS (300ms de transition)
      setTimeout(() => {
        this.isOpening = false;
      }, 350);
    }
  }

  hide() {
    try {
      // Désactiver le mode édition si actif
      if (this.isEditMode) {
        this.deactivateEditMode();
      }
      if (this.modal) {
        this.modal.classList.remove('active');
        setTimeout(() => {
          this.modal.style.display = 'none';
        }, 400);
      }
      this.currentSeries = null;
      this.currentSeriesId = null;
    } finally {
      // TOUJOURS restaurer le scroll
      document.body.style.overflow = '';

      // Réinitialiser le verrou pour permettre une nouvelle ouverture
      this.isOpening = false;

      console.log('✅ Scroll du body restauré et verrou libéré (série)');
    }
  }

  loadUserPreferences() {
    if (!this.currentSeriesId) return;

    const userPrefs = this.getUserPrefs();

    // Charger le statut vu/à voir
    const watchToggle = document.getElementById('btn-watch-toggle-series');
    if (watchToggle) {
      if (userPrefs.watchedSeries[this.currentSeriesId]) {
        watchToggle.textContent = 'Vu !';
        watchToggle.classList.add('watched');
      } else {
        watchToggle.textContent = 'À voir';
        watchToggle.classList.remove('watched');
      }
    }

    // Charger la note : DB en priorité, localStorage en fallback
    const dbRating = (this.currentSeries && this.currentSeries.rating) || 0;
    const localRating = (userPrefs.seriesRatings && userPrefs.seriesRatings[this.currentSeriesId]) || 0;
    const rating = dbRating > 0 ? dbRating : localRating;
    const ratingInput = document.getElementById('series-rating-input');
    const starsFill = document.getElementById('series-stars-fill');
    const ratingQuick = document.getElementById('series-rating-quick');

    if (ratingInput) {
      ratingInput.value = rating.toFixed(1);
    }
    if (starsFill) {
      const percentage = (rating / 5) * 100;
      starsFill.style.width = `${percentage}%`;
    }
    if (ratingQuick) {
      ratingQuick.textContent = this.getStarsDisplay(rating);
    }

    // Charger l'avis
    const review = userPrefs.seriesReviews[this.currentSeriesId] || '';
    const reviewInput = document.getElementById('series-review-input');
    if (reviewInput) {
      reviewInput.value = review;
    }
  }

  async populateModal(series) {
    // Titre et métadonnées
    const titleElement = document.getElementById('series-title');
    const yearElement = document.getElementById('series-year');
    const episodeCountElement = document.getElementById('series-episode-count');
    const synopsisElement = document.getElementById('series-synopsis-content');
    const posterElement = document.getElementById('series-poster');
    const episodesQuick = document.getElementById('series-episodes-quick');

    if (titleElement) titleElement.textContent = series.name;

    // Gérer l'année - extraire du titre si nécessaire
    if (yearElement) {
      if (series.year) {
        yearElement.textContent = series.year;
      } else {
        // Essayer d'extraire l'année du titre
        const yearMatch = series.name.match(/\((\d{4})\)$/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
        yearElement.textContent = year;
      }
    }

    const totalEpisodes = series.episodeCount || 0;
    const totalSeasons = series.seasons ? series.seasons.length : 0;

    // Pills séparées : saisons + épisodes
    const seasonsEl = document.getElementById('series-seasons');
    const episodesEl = document.getElementById('series-episodes');
    if (seasonsEl) seasonsEl.textContent = `${totalSeasons} saison${totalSeasons > 1 ? 's' : ''}`;
    if (episodesEl) episodesEl.textContent = `${totalEpisodes} épisode${totalEpisodes > 1 ? 's' : ''}`;

    if (episodesQuick) {
      episodesQuick.textContent = totalEpisodes;
    }

    const seasonsQuick = document.getElementById('series-seasons-quick');
    if (seasonsQuick) {
      seasonsQuick.textContent = totalSeasons;
    }

    if (synopsisElement) {
      synopsisElement.textContent = series.description || 'Aucune description disponible.';
    }

    if (posterElement) {
      // Récupérer le thumbnail du premier épisode pour le fallback
      let firstEpisodeId = null;
      let firstEpisodeThumbnail = null;
      if (series.seasons && series.seasons[0] && series.seasons[0].episodes && series.seasons[0].episodes[0]) {
        const firstEpisode = series.seasons[0].episodes[0];
        firstEpisodeId = firstEpisode.id || null;
        firstEpisodeThumbnail = firstEpisode.thumbnail || null;
      }

      window.setupImageWithFallback(
        posterElement,
        firstEpisodeId,
        series.posterUrl,
        firstEpisodeThumbnail,
        series.name
      );
    }

    // Afficher les tags
    this.displayTags(series);

    // Afficher les crédits
    await this.displayCredits(series);

    // Afficher les informations techniques
    this.displayTechnicalInfo(series);

    // Afficher les statistiques de visionnage
    this.displayViewingStats(series);

    // Générer les saisons et épisodes
    this.populateSeasons(series.seasons || []);
  }

  displayTags(series) {
    // Genres
    this.displayTagCategory('series-genres', series.genres, 'genre');
    // Ambiance
    this.displayTagCategory('series-mood', series.mood, 'mood');
    // Technique
    this.displayTagCategory('series-technical', series.technical, 'technical');
    // Personnel
    this.displayTagCategory('series-personal', series.personalTags, 'personal');
    // Franchises (masquées si vides)
    this.displayTagCategory('series-franchise', series.franchises, 'franchise', { hideWhenEmpty: true });
  }

  displayTagCategory(categoryId, tags, chipClass, options = {}) {
    const categoryElement = document.getElementById(`${categoryId}-category`);
    const containerElement = document.getElementById(`${categoryId}-container`);

    if (!categoryElement || !containerElement) return;

    containerElement.innerHTML = '';

    if (tags && tags.length > 0) {
      tags.forEach(tag => {
        if (tag && tag.trim()) {
          const chip = document.createElement('span');
          chip.className = `tag-chip ${chipClass}`;
          chip.textContent = tag;
          containerElement.appendChild(chip);
        }
      });
      categoryElement.style.display = 'block';
    } else if (options.hideWhenEmpty) {
      categoryElement.style.display = 'none';
    } else {
      const emptyMsg = document.createElement('span');
      emptyMsg.className = 'empty-tags-message';
      emptyMsg.textContent = 'Aucun tag ajouté';
      containerElement.appendChild(emptyMsg);
      categoryElement.style.display = 'block';
    }
  }

  async displayCredits(series) {
    const SERIES_CREW_DEPT = ['creator', 'producer', 'writer', 'composer'];
    const crewSection = document.getElementById('series-crew-section');
    const castSection = document.getElementById('series-cast-section');
    const castGrid    = document.getElementById('series-cast-persons-grid');

    // Vider les grilles
    SERIES_CREW_DEPT.forEach(role => {
      const dept = document.getElementById(`series-crew-${role}`);
      if (dept) {
        const grid = dept.querySelector('.credits-persons-grid');
        if (grid) grid.innerHTML = '';
        dept.style.display = 'none';
      }
    });
    if (castGrid) castGrid.innerHTML = '';
    if (crewSection) crewSection.style.display = 'none';
    if (castSection) castSection.style.display = 'none';

    let persons = [];
    try {
      const result = await window.electronAPI.getPersonsForMedia(series.id);
      if (result && result.success) persons = result.persons || [];
    } catch (e) {
      console.warn('getPersonsForMedia série:', e);
    }

    let hasAnyCrewPerson = false;
    let hasCast = false;

    for (const person of persons) {
      for (const roleObj of (person.roles || [])) {
        const role = roleObj.role;
        if (role === 'actor') {
          if (castGrid && typeof window.createPersonAvatarCard === 'function') {
            castGrid.appendChild(window.createPersonAvatarCard(person, roleObj, false));
            hasCast = true;
          }
        } else if (SERIES_CREW_DEPT.includes(role)) {
          const dept = document.getElementById(`series-crew-${role}`);
          if (dept && typeof window.createPersonAvatarCard === 'function') {
            const grid = dept.querySelector('.credits-persons-grid');
            if (grid) {
              grid.appendChild(window.createPersonAvatarCard(person, roleObj, false));
              dept.style.display = '';
              hasAnyCrewPerson = true;
            }
          }
        }
      }
    }

    if (crewSection) crewSection.style.display = hasAnyCrewPerson ? '' : 'none';
    if (castSection) castSection.style.display = hasCast ? '' : 'none';

    // Backfill des photos manquantes en arrière-plan
    if (persons.length > 0 && typeof window.backfillPersonPhotos === 'function') {
      window.backfillPersonPhotos(persons);
    }

    // Pills movie-meta : Plateforme, Statut, Pays (hidden si vide)
    const show = (id, valueId, value) => {
      const section = document.getElementById(id);
      const span    = document.getElementById(valueId);
      if (value && value.trim()) {
        if (span) span.textContent = value;
        if (section) section.style.display = 'block';
      } else {
        if (section) section.style.display = 'none';
      }
    };
    show('series-platform-section', 'series-platform-name', series.platform);
    show('series-status-section',   'series-status-name',   series.status);
    show('series-country-section',  'series-country-name',  series.country);

    // Studios
    const studiosSection = document.getElementById('series-studios-section');
    const studiosSpan    = document.getElementById('series-studios-name');
    const studiosArr = series.studios || [];
    if (studiosArr.length > 0) {
      if (studiosSpan) studiosSpan.textContent = studiosArr.join(', ');
      if (studiosSection) studiosSection.style.display = 'flex';
    } else {
      if (studiosSection) studiosSection.style.display = 'none';
    }
  }

  // ============================================
  // GESTION DES PERSONNES — MODE ÉDITION
  // ============================================

  async transformCreditsToEditMode() {
    const SERIES_CREW_DEPT = ['creator', 'producer', 'writer', 'composer'];
    const SERIES_CREW_LABELS = {
      creator: 'Créateur', producer: 'Producteur',
      writer: 'Scénariste', composer: 'Compositeur'
    };

    const crewSection = document.getElementById('series-crew-section');
    const castSection = document.getElementById('series-cast-section');
    const castGrid    = document.getElementById('series-cast-persons-grid');

    SERIES_CREW_DEPT.forEach(role => {
      const dept = document.getElementById(`series-crew-${role}`);
      if (dept) { dept.style.display = 'block'; const g = dept.querySelector('.credits-persons-grid'); if (g) g.innerHTML = ''; }
    });
    if (castGrid) castGrid.innerHTML = '';
    if (crewSection) crewSection.style.display = 'block';
    if (castSection) castSection.style.display = 'block';

    let persons = [];
    try {
      const result = await window.electronAPI.getPersonsForMedia(this.currentSeriesId);
      if (result && result.success) persons = result.persons || [];
    } catch (e) { console.warn('transformCreditsToEditMode série:', e); }

    const crewByRole = {};
    SERIES_CREW_DEPT.forEach(r => { crewByRole[r] = []; });
    const cast = [];

    for (const person of persons) {
      for (const roleObj of (person.roles || [])) {
        const role = roleObj.role;
        if (role === 'actor') cast.push({ person, roleObj });
        else if (crewByRole[role]) crewByRole[role].push({ person, roleObj });
      }
    }

    for (const [dept, items] of Object.entries(crewByRole)) {
      const deptEl = document.getElementById(`series-crew-${dept}`);
      if (!deptEl) continue;
      const grid = deptEl.querySelector('.credits-persons-grid');
      if (!grid) continue;
      grid.innerHTML = '';
      for (const { person, roleObj } of items) {
        grid.appendChild(window.createPersonAvatarCard(person, roleObj, true));
        // Relier le bouton supprimer à la méthode série
        const removeBtn = grid.lastChild.querySelector('.person-avatar-remove-btn');
        if (removeBtn) {
          removeBtn.replaceWith(removeBtn.cloneNode(true));
          grid.lastChild.querySelector('.person-avatar-remove-btn')
            ?.addEventListener('click', (e) => { e.stopPropagation(); this.removePersonFromCredits(person.id, roleObj.role); });
        }
      }
      // Bouton "+"
      const addWrap = document.createElement('div');
      addWrap.className = 'person-avatar-card';
      addWrap.style.cursor = 'pointer';
      const addCircle = document.createElement('button');
      addCircle.className = 'add-person-btn';
      addCircle.innerHTML = '<i class="fas fa-plus"></i>';
      addCircle.addEventListener('click', () => this.openPersonSearchModal(dept));
      addWrap.appendChild(addCircle);
      grid.appendChild(addWrap);
    }

    // Casting
    if (castGrid) {
      for (const { person, roleObj } of cast) {
        castGrid.appendChild(window.createPersonAvatarCard(person, roleObj, true));
        const removeBtn = castGrid.lastChild.querySelector('.person-avatar-remove-btn');
        if (removeBtn) {
          removeBtn.replaceWith(removeBtn.cloneNode(true));
          castGrid.lastChild.querySelector('.person-avatar-remove-btn')
            ?.addEventListener('click', (e) => { e.stopPropagation(); this.removePersonFromCredits(person.id, roleObj.role); });
        }
      }
      const addWrap = document.createElement('div');
      addWrap.className = 'person-avatar-card';
      addWrap.style.cursor = 'pointer';
      const addCircle = document.createElement('button');
      addCircle.className = 'add-person-btn';
      addCircle.innerHTML = '<i class="fas fa-plus"></i>';
      addCircle.addEventListener('click', () => this.openPersonSearchModal('actor'));
      addWrap.appendChild(addCircle);
      castGrid.appendChild(addWrap);
    }
  }

  async removePersonFromCredits(personId, role) {
    try {
      await window.electronAPI.unlinkPersonFromMedia(personId, this.currentSeriesId, role);
      await this.transformCreditsToEditMode();
    } catch (e) { console.error('removePersonFromCredits série:', e); }
  }

  openPersonSearchModal(department) {
    const existing = document.querySelector('.person-search-modal-overlay');
    if (existing) existing.remove();

    const LABELS = { creator: 'Créateur', producer: 'Producteur', writer: 'Scénariste', composer: 'Compositeur', actor: 'Acteur' };
    const roleLabel = LABELS[department] || department;

    const overlay = document.createElement('div');
    overlay.className = 'person-search-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'person-search-modal';

    const header = document.createElement('div');
    header.className = 'person-search-header';
    const title = document.createElement('h3');
    title.textContent = `Ajouter un ${roleLabel}`;
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'person-search-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'person-search-input-wrap';
    const input = document.createElement('input');
    input.className = 'person-search-input';
    input.type = 'text';
    input.placeholder = 'Rechercher une personne...';
    inputWrap.appendChild(input);
    modal.appendChild(inputWrap);

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'person-search-results';
    resultsContainer.innerHTML = '<div class="person-search-empty">Tapez un nom pour rechercher</div>';
    modal.appendChild(resultsContainer);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 100);

    let debounceTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query.length < 2) {
        resultsContainer.innerHTML = '<div class="person-search-empty">Tapez au moins 2 caractères</div>';
        return;
      }
      debounceTimer = setTimeout(() => this.performPersonSearch(query, resultsContainer, overlay, department), 300);
    });
  }

  async performPersonSearch(query, container, overlay, department) {
    container.innerHTML = '<div class="person-search-empty">Recherche en cours...</div>';
    try {
      const linkedResult = await window.electronAPI.getPersonsForMedia(this.currentSeriesId);
      const linkedIds = new Set();
      const linkedTmdbIds = new Set();
      if (linkedResult.success && linkedResult.persons) {
        for (const p of linkedResult.persons) {
          for (const r of (p.roles || [])) {
            if (r.role === department) {
              linkedIds.add(p.id);
              if (p.tmdbId) linkedTmdbIds.add(p.tmdbId);
            }
          }
        }
      }

      const localResult = await window.electronAPI.searchPersons(query);
      const localPersons = (localResult.success ? localResult.persons : []).filter(p => !linkedIds.has(p.id));

      let tmdbPersons = [];
      try {
        const tmdbResults = await this.searchTMDBPersons(query);
        tmdbPersons = tmdbResults.filter(p => !linkedTmdbIds.has(p.id));
      } catch (e) { console.warn('Recherche TMDB personne échouée:', e); }

      const localTmdbIds = new Set(localPersons.filter(p => p.tmdbId).map(p => p.tmdbId));
      tmdbPersons = tmdbPersons.filter(p => !localTmdbIds.has(p.id));

      container.innerHTML = '';
      if (localPersons.length === 0 && tmdbPersons.length === 0) {
        container.innerHTML = '<div class="person-search-empty">Aucun résultat</div>';
        return;
      }

      if (localPersons.length > 0) {
        const label = document.createElement('div');
        label.className = 'person-search-section-label';
        label.textContent = 'Bibliothèque locale';
        container.appendChild(label);
        for (const person of localPersons) {
          container.appendChild(this.createSearchResultItem(person, 'local', overlay, department));
        }
      }

      if (tmdbPersons.length > 0) {
        const label = document.createElement('div');
        label.className = 'person-search-section-label';
        label.textContent = 'TMDB';
        container.appendChild(label);
        for (const p of tmdbPersons.slice(0, 10)) {
          container.appendChild(this.createSearchResultItem({
            tmdbId: p.id, name: p.name,
            photo: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
            knownForDepartment: p.known_for_department,
            _isTMDB: true, _profilePath: p.profile_path
          }, 'tmdb', overlay, department));
        }
      }
    } catch (err) {
      container.innerHTML = '<div class="person-search-empty">Erreur de recherche</div>';
      console.error('performPersonSearch série:', err);
    }
  }

  createSearchResultItem(person, source, overlay, department) {
    const item = document.createElement('div');
    item.className = 'person-search-result-item';

    if (person.photo) {
      const img = document.createElement('img');
      img.className = 'person-search-result-photo';
      img.src = source === 'local' ? `http://localhost:3001/person-photos/${person.photo}` : person.photo;
      img.onerror = function() {
        const ph = document.createElement('div');
        ph.className = 'person-search-result-photo-placeholder';
        ph.innerHTML = '<i class="fas fa-user"></i>';
        this.parentNode.replaceChild(ph, this);
      };
      item.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'person-search-result-photo-placeholder';
      ph.innerHTML = '<i class="fas fa-user"></i>';
      item.appendChild(ph);
    }

    const info = document.createElement('div');
    info.className = 'person-search-result-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'person-search-result-name';
    nameEl.textContent = person.name;
    info.appendChild(nameEl);
    if (person.knownForDepartment) {
      const dept = document.createElement('div');
      dept.className = 'person-search-result-dept';
      dept.textContent = person.knownForDepartment;
      info.appendChild(dept);
    }
    item.appendChild(info);

    const badge = document.createElement('span');
    badge.className = `person-search-result-badge ${source}`;
    badge.textContent = source === 'local' ? 'LOCAL' : 'TMDB';
    item.appendChild(badge);

    item.addEventListener('click', () => this.handlePersonSearchSelection(person, source, overlay, department));
    return item;
  }

  async handlePersonSearchSelection(person, source, overlay, department) {
    try {
      let personId;
      if (source === 'local') {
        personId = person.id;
      } else {
        let fileName = null;
        if (person._profilePath) {
          try {
            const dlResult = await window.electronAPI.downloadPersonPhoto(
              `${SERIES_TMDB_IMAGE_BASE_URL}${person._profilePath}`, person.name
            );
            if (dlResult.success) fileName = dlResult.fileName;
          } catch (e) { console.warn('Photo échouée:', e); }
        }
        const addResult = await window.electronAPI.addPerson({
          tmdbId: person.tmdbId, name: person.name, photo: fileName,
          knownForDepartment: person.knownForDepartment
        });
        if (!addResult.success || !addResult.person) return;
        personId = addResult.person.id;
      }

      if (department === 'actor') {
        const character = await this.showCharacterNameDialog(overlay);
        await window.electronAPI.linkPersonToMedia(personId, this.currentSeriesId, 'serie', 'actor', character);
      } else {
        await window.electronAPI.linkPersonToMedia(personId, this.currentSeriesId, 'serie', department, null);
      }

      overlay.remove();
      await this.transformCreditsToEditMode();
    } catch (err) { console.error('handlePersonSearchSelection série:', err); }
  }

  showCharacterNameDialog(parentOverlay) {
    return new Promise((resolve) => {
      const modal = parentOverlay.querySelector('.person-search-modal');
      if (!modal) { resolve(null); return; }
      const prevContent = modal.innerHTML;
      modal.innerHTML = `
        <div class="person-search-header"><h3>Nom du personnage</h3></div>
        <div class="person-search-input-wrap">
          <input class="person-search-input" type="text" placeholder="Nom du personnage (optionnel)" id="series-character-input">
        </div>
        <div style="display:flex;gap:8px;padding:12px 16px;">
          <button class="person-add-cancel-btn" id="series-char-skip" style="flex:1">Passer</button>
          <button class="person-add-confirm-btn" id="series-char-ok" style="flex:1">Confirmer</button>
        </div>`;
      const input = modal.querySelector('#series-character-input');
      const okBtn = modal.querySelector('#series-char-ok');
      const skipBtn = modal.querySelector('#series-char-skip');
      setTimeout(() => input?.focus(), 100);
      const submit = () => resolve(input?.value.trim() || null);
      const skip = () => resolve(null);
      okBtn?.addEventListener('click', submit);
      skipBtn?.addEventListener('click', skip);
      input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') skip(); });
    });
  }

  async searchTMDBPersons(query) {
    const url = `${SERIES_TMDB_API_BASE_URL}/search/person?query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false&page=1`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${SERIES_TMDB_TOKEN}` } });
    if (!response.ok) throw new Error(`Erreur API TMDB: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  }

  displayTechnicalInfo(series) {
    const show = (id, valueId, text) => {
      const el = document.getElementById(id);
      const val = document.getElementById(valueId);
      if (!el || !val) return;
      el.style.display = text !== null ? 'flex' : 'none';
      if (text !== null) val.textContent = text;
    };

    // Qualité vidéo
    show('series-tech-quality', 'series-tech-quality-value',
      series.videoQuality || null);

    // Codec
    show('series-tech-codec', 'series-tech-codec-value',
      series.codec || null);

    // Audio
    show('series-tech-audio', 'series-tech-audio-value',
      series.audioFormat || null);

    // Langue (défaut : Français)
    show('series-tech-language', 'series-tech-language-value',
      series.language || 'Français');

    // Sous-titres
    const subsEl    = document.getElementById('series-tech-subtitles');
    const subsValEl = document.getElementById('series-tech-subtitles-value');
    if (subsEl && subsValEl) {
      subsEl.style.display = 'flex';
      if (series.subtitles && series.subtitles.trim()) {
        subsValEl.textContent = series.subtitles;
        subsValEl.style.fontStyle = 'normal';
      } else {
        subsValEl.textContent = 'Aucun';
        subsValEl.style.fontStyle = 'italic';
      }
    }

    // Nombre de saisons
    const nbSaisons = series.seasons ? series.seasons.length : 0;
    show('series-tech-seasons', 'series-tech-seasons-value',
      nbSaisons > 0 ? `${nbSaisons} saison${nbSaisons > 1 ? 's' : ''}` : null);

    // Date d'ajout
    show('series-tech-date-added', 'series-tech-date-added-value',
      series.dateAdded ? new Date(series.dateAdded).toLocaleDateString('fr-FR') : null);
  }

  displayViewingStats(series) {
    const userPrefs   = this.getUserPrefs();
    const seriesId    = series.id;
    const statsSection = this.modal.querySelector('.viewing-stats');

    const watchedEpisodes = userPrefs.watchedEpisodes ? (userPrefs.watchedEpisodes[seriesId] || 0) : 0;
    const totalEpisodes   = series.episodeCount || 0;
    const lastWatched     = userPrefs.lastWatched  ? userPrefs.lastWatched[seriesId]  : null;
    const rating          = series.rating || 0;

    const hasAnyStats = watchedEpisodes > 0 || lastWatched || rating > 0;
    if (statsSection) statsSection.style.display = hasAnyStats ? '' : 'none';

    // Épisodes vus
    const statWatchCount      = document.getElementById('series-stat-watch-count');
    const statWatchCountValue = document.getElementById('series-stat-watch-count-value');
    if (statWatchCount) {
      if (totalEpisodes > 0) {
        if (statWatchCountValue) statWatchCountValue.textContent = `${watchedEpisodes} / ${totalEpisodes}`;
        statWatchCount.style.display = 'flex';
      } else {
        statWatchCount.style.display = 'none';
      }
    }

    // Progression
    const statProgress      = document.getElementById('series-stat-progress');
    const statProgressValue = document.getElementById('series-stat-progress-value');
    const progressFill      = document.getElementById('series-progress-bar-fill');
    if (statProgress) {
      if (totalEpisodes > 0) {
        const pct = Math.round((watchedEpisodes / totalEpisodes) * 100);
        if (statProgressValue) statProgressValue.textContent = `${pct} %`;
        if (progressFill) progressFill.style.width = `${pct}%`;
        statProgress.style.display = 'flex';
      } else {
        statProgress.style.display = 'none';
      }
    }

    // Dernier visionnage
    const statLastWatched      = document.getElementById('series-stat-last-watched');
    const statLastWatchedValue = document.getElementById('series-stat-last-watched-value');
    if (statLastWatched) {
      if (lastWatched) {
        if (statLastWatchedValue) statLastWatchedValue.textContent = new Date(lastWatched).toLocaleDateString('fr-FR');
        statLastWatched.style.display = 'flex';
      } else {
        statLastWatched.style.display = 'none';
      }
    }

    // Note personnelle
    const statRating      = document.getElementById('series-stat-rating-personal');
    const statRatingValue = document.getElementById('series-stat-rating-personal-value');
    if (statRating) {
      if (rating > 0) {
        if (statRatingValue) statRatingValue.textContent = `${rating.toFixed(1)} / 5`;
        statRating.style.display = 'flex';
      } else {
        statRating.style.display = 'none';
      }
    }
  }

  populateSeasons(seasons) {
    const seasonsContainer = document.getElementById('seasons-container');
    if (!seasonsContainer) return;

    seasonsContainer.innerHTML = '';

    if (!seasons || seasons.length === 0) {
      seasonsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #888;">
          <i class="fas fa-tv" style="font-size: 48px; margin-bottom: 16px;"></i>
          <p>Aucun épisode trouvé pour cette série.</p>
        </div>
      `;
      return;
    }

    seasons.forEach(season => {
      const seasonElement = this.createSeasonElement(season);
      seasonsContainer.appendChild(seasonElement);
    });
  }

  createSeasonElement(season) {
    const template = document.getElementById('season-template');
    const seasonElement = template.content.cloneNode(true);

    // Remplir les informations de la saison
    const seasonNumber = seasonElement.querySelector('.season-number');
    const seasonEpisodeCount = seasonElement.querySelector('.season-episode-count');
    const episodesGrid = seasonElement.querySelector('.episodes-grid');

    if (seasonNumber) {
      seasonNumber.textContent = season.number;
    }

    if (seasonEpisodeCount) {
      const episodeCount = season.episodes ? season.episodes.length : 0;
      seasonEpisodeCount.textContent = `${episodeCount} épisode${episodeCount > 1 ? 's' : ''}`;
    }

    // Ajouter les épisodes
    if (season.episodes && episodesGrid) {
      season.episodes.forEach(episode => {
        const episodeElement = this.createEpisodeElement(episode, season.number);
        episodesGrid.appendChild(episodeElement);
      });
    }

    return seasonElement;
  }

  createEpisodeElement(episode, seasonNumber) {
    const template = document.getElementById('episode-template');
    const episodeElement = template.content.cloneNode(true);
    const card = episodeElement.querySelector('.episode-card');

    // Définir l'ID de l'épisode
    if (card) {
      card.dataset.episodeId = episode.id;
      card.addEventListener('click', () => {
        const s = card.dataset.episodeAudioStatus;
        if (s === 'pending' || s === 'converting') return;
        this.playEpisode(episode);
      });
    }

    // Remplir les informations
    const thumbnail = episodeElement.querySelector('.episode-thumbnail');
    const duration = episodeElement.querySelector('.episode-duration');
    const episodeNumber = episodeElement.querySelector('.episode-number');
    const episodeTitle = episodeElement.querySelector('.episode-title');
    const episodeDate = episodeElement.querySelector('.episode-date');
    const playBtn = episodeElement.querySelector('.episode-play-btn');

    if (thumbnail) {
      if (episode.thumbnail) {
        const thumbnailName = episode.thumbnail.split('\\').pop().split('/').pop();
        thumbnail.src = `http://localhost:3001/thumbnails/${thumbnailName}`;
      } else {
        thumbnail.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDI4MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI4MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0cHgiPlRIVU1CTkFJTDwvdGV4dD48L3N2Zz4=';
      }
      thumbnail.onerror = () => {
        thumbnail.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDI4MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI4MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0cHgiPlRIVU1CTkFJTDwvdGV4dD48L3N2Zz4=';
      };
    }

    if (duration && episode.duration) {
      duration.textContent = this.formatDuration(episode.duration);
    }

    if (episodeNumber) {
      if (episode.episode_number) {
        episodeNumber.textContent = `S${seasonNumber.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}`;
      } else {
        episodeNumber.textContent = `S${seasonNumber.toString().padStart(2, '0')}`;
      }
    }

    if (episodeTitle) {
      episodeTitle.textContent = episode.title || `Épisode ${episode.episode_number || '?'}`;
    }

    if (episodeDate && episode.dateAdded) {
      const date = new Date(episode.dateAdded);
      episodeDate.textContent = date.toLocaleDateString('fr-FR');
    }

    if (playBtn) {
      const audioStatus = episode.audioStatus || 'pending';
      if (audioStatus === 'pending' || audioStatus === 'converting') {
        playBtn.disabled = true;
        playBtn.classList.add('audio-converting');
        playBtn.title = 'Conversion audio en cours...';
        const spinner = document.createElement('span');
        spinner.className = 'episode-audio-spinner';
        playBtn.parentNode.insertBefore(spinner, playBtn.nextSibling);
      }
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!playBtn.disabled) this.playEpisode(episode);
      });
    }

    if (card) {
      card.dataset.episodeAudioStatus = episode.audioStatus || 'pending';
    }

    // Progression de visionnage
    const progress = window.progressData?.playProgress?.[episode.id];
    const isFinished = !!episode.lastWatched && !progress;

    if (progress) {
      const bar = episodeElement.querySelector('.episode-progress-bar');
      const fill = episodeElement.querySelector('.episode-progress-fill');
      const status = episodeElement.querySelector('.episode-watch-status');
      if (bar) bar.style.display = '';
      if (fill) fill.style.width = `${Math.round(progress.pct * 100)}%`;
      const remaining = Math.max(0, (episode.duration || 0) - (progress.time || 0));
      if (status && remaining > 0) {
        status.textContent = `- ${this.formatDuration(remaining)}`;
      }
    } else if (isFinished) {
      const badge = episodeElement.querySelector('.episode-finished-badge');
      const status = episodeElement.querySelector('.episode-watch-status');
      if (badge) badge.style.display = '';
      if (status) { status.textContent = 'Vu'; status.classList.add('episode-status-finished'); }
    }

    return episodeElement;
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  getSortedEpisodes() {
    if (!this.currentSeries || !this.currentSeries.seasons) return [];

    const sortedEpisodes = [];
    for (const season of this.currentSeries.seasons) {
      if (season.episodes && season.episodes.length > 0) {
        for (const episode of season.episodes) {
          if (episode.episode_number !== null && episode.episode_number !== undefined) {
            sortedEpisodes.push({ ...episode, seasonNumber: season.number });
          }
        }
      }
    }

    sortedEpisodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
      return a.episode_number - b.episode_number;
    });

    return sortedEpisodes;
  }

  playEpisode(episode) {
    console.log('🎬 Lecture de l\'épisode:', episode.title);

    if (!episode.path) {
      console.error('❌ Chemin de l\'épisode manquant');
      alert('Impossible de lire l\'épisode : chemin du fichier manquant');
      return;
    }

    const title = episode.title || 'Épisode sans titre';

    // Construire le contexte série AVANT de fermer la modale (hide() efface currentSeries)
    let seriesContext = null;
    const sortedEpisodes = this.getSortedEpisodes();
    if (sortedEpisodes.length > 0) {
      const currentIndex = sortedEpisodes.findIndex(ep => ep.id === episode.id);
      if (currentIndex !== -1) {
        seriesContext = { episodes: sortedEpisodes, currentIndex };
      }
    }

    // Fermer la modale et lancer la lecture
    this.hide();

    if (window.openVideoPlayer) {
      const effectivePath = (episode.audioStatus === 'ok' && episode.audioConvertedPath)
        ? episode.audioConvertedPath : episode.path;
      window.openVideoPlayer(episode.id, title, effectivePath, seriesContext, episode.audioStatus === 'ok', episode.path);
    } else {
      console.error('❌ Fonction de lecture vidéo non trouvée');
      alert('Impossible de lire l\'épisode : lecteur vidéo non disponible');
    }
  }

  _updatePlayButton() {
    const playBtn = document.getElementById('btn-play-series');
    if (!playBtn || this.isEditMode) return;
    // Ne pas toucher si le bouton est en mode TMDB (originalHtml stocké)
    if (playBtn.dataset.originalHtml) return;

    const sp = window.progressData?.seriesProgress?.[this.currentSeriesId];
    const icon = '<i class="fas fa-play"></i>';
    if (sp && sp.episodeMediaId) {
      const s = sp.seasonNumber ? `S${String(sp.seasonNumber).padStart(2, '0')}` : '';
      const e = sp.episodeNumber ? `E${String(sp.episodeNumber).padStart(2, '0')}` : '';
      const label = (s || e) ? `${s}${e}` : 'dernier épisode';
      playBtn.innerHTML = `${icon}<span>Reprendre — ${label}</span>`;
    } else {
      playBtn.innerHTML = `${icon}<span>Premier épisode</span>`;
    }
  }

  playOrResume() {
    const sp = window.progressData?.seriesProgress?.[this.currentSeriesId];
    if (sp && sp.episodeMediaId) {
      const sortedEpisodes = this.getSortedEpisodes();
      const episode = sortedEpisodes.find(e => e.id === sp.episodeMediaId);
      if (episode) {
        this.playEpisode(episode);
        return;
      }
    }
    this.playFirstEpisode();
  }

  playFirstEpisode() {
    const sortedEpisodes = this.getSortedEpisodes();

    if (sortedEpisodes.length === 0) {
      alert('Aucun épisode trié trouvé.\n\nVeuillez d\'abord trier les épisodes de cette série avant de pouvoir la lire.');
      console.warn('⚠️ Aucun épisode trié disponible pour la série:', this.currentSeries?.name);
      return;
    }

    const firstEpisode = sortedEpisodes[0];
    this.playEpisode(firstEpisode);
  }

  // ============================================
  // MODE ÉDITION (cohérent avec movie-modal.js)
  // ============================================

  activateEditMode() {
    if (!this.currentSeries) return;
    this.isEditMode = true;
    this.hasUnsavedChanges = false;
    this.pendingPosterUrl = null;

    // Sauvegarder les valeurs originales
    this.originalValues = {
      name:        this.currentSeries.name        || '',
      description: this.currentSeries.description || '',
      genres:      this.currentSeries.genres       ? [...this.currentSeries.genres]      : [],
      year:        this.currentSeries.year         || '',
      creator:     this.currentSeries.creator      || '',
      actors:      this.currentSeries.actors       ? [...this.currentSeries.actors]      : [],
      country:     this.currentSeries.country      || '',
      status:      this.currentSeries.status       || '',
      platform:    this.currentSeries.platform     || '',
      studios:     this.currentSeries.studios      ? [...this.currentSeries.studios]     : [],
      mood:        this.currentSeries.mood         ? [...this.currentSeries.mood]        : [],
      personalTags:this.currentSeries.personalTags ? [...this.currentSeries.personalTags]: [],
      franchises:  this.currentSeries.franchises   ? [...this.currentSeries.franchises]  : [],
    };

    // Ajouter la classe visuelle (même classe que movie-modal)
    if (this.modal) this.modal.classList.add('edit-mode-active');

    // Afficher les boutons annuler/sauvegarder avec animation
    const cancelBtn = document.getElementById('series-edit-cancel-btn');
    const saveBtn = document.getElementById('series-edit-save-btn');
    const editBtn = document.getElementById('series-edit-button');
    const btnGroup = document.getElementById('series-edit-button-group');
    if (cancelBtn) cancelBtn.style.display = 'flex';
    if (saveBtn) saveBtn.style.display = 'flex';
    if (btnGroup) btnGroup.classList.add('extended');
    // Animation décalée comme movie-modal
    setTimeout(() => {
      if (cancelBtn) cancelBtn.classList.add('show');
      if (saveBtn) saveBtn.classList.add('show');
    }, 100);
    if (editBtn) {
      const icon = editBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-edit';
    }

    // Transformer les champs en mode éditable
    this.transformToEditableFields();

    // Transformer le bouton play en bouton TMDB
    this.transformPlayButtonToTMDB();

    // Verrouiller la sidebar
    this.lockSidebarElements();

    // Overlay poster
    this.setupPosterEditOverlay();

    // Détection des changements
    this.setupChangeDetection();

    // Mode édition saisons/épisodes
    this.activateEditModeSeasons();

    // Mode édition crédits (personnes)
    this.transformCreditsToEditMode();

    console.log('✏️ Mode édition série activé');
  }

  deactivateEditMode() {
    this.isEditMode = false;
    this.hasUnsavedChanges = false;
    this.pendingPosterUrl = null;

    // Retirer la classe visuelle
    if (this.modal) this.modal.classList.remove('edit-mode-active');

    // Masquer les boutons annuler/sauvegarder
    const cancelBtn = document.getElementById('series-edit-cancel-btn');
    const saveBtn = document.getElementById('series-edit-save-btn');
    const editBtn = document.getElementById('series-edit-button');
    const btnGroup = document.getElementById('series-edit-button-group');
    if (cancelBtn) { cancelBtn.classList.remove('show'); cancelBtn.style.display = 'none'; }
    if (saveBtn) { saveBtn.classList.remove('show'); saveBtn.style.display = 'none'; }
    if (btnGroup) btnGroup.classList.remove('extended');
    if (editBtn) {
      const icon = editBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-pencil-alt';
    }

    // Restaurer le bouton play
    this.restorePlayButton();

    // Déverrouiller la sidebar
    this.unlockSidebarElements();

    // Retirer l'overlay poster
    const posterOverlay = document.querySelector('.series-poster-edit-overlay');
    if (posterOverlay) posterOverlay.remove();

    // Restaurer les champs en mode lecture
    this.restoreReadOnlyFields();

    // Restaurer la vue saisons/épisodes
    this.deactivateEditModeSeasons();

    // Restaurer la vue crédits (personnes)
    if (this.currentSeries) this.displayCredits(this.currentSeries);

    console.log('✏️ Mode édition série désactivé');
  }

  cancelEditMode() {
    if (this.originalValues && this.currentSeries) {
      Object.assign(this.currentSeries, this.originalValues);
    }
    this.deactivateEditMode();
    console.log('↩️ Modifications annulées');
  }

  // ---- Transformation des champs ----

  transformToEditableFields() {
    const series = this.currentSeries;
    if (!series) return;

    // Titre → input (on garde l'id series-title)
    const titleEl = document.getElementById('series-title');
    if (titleEl) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-title-field';
      input.id = 'series-title';
      input.value = series.name || '';
      titleEl.replaceWith(input);
    }

    // Année → input number (on garde l'id series-year)
    const yearEl = document.getElementById('series-year');
    if (yearEl) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'edit-year-field';
      input.id = 'series-year';
      input.value = series.year || new Date().getFullYear();
      input.min = 1900;
      input.max = 2100;
      yearEl.replaceWith(input);
    }

    // Synopsis → textarea (on garde l'id series-synopsis-content)
    const synopsisEl = document.getElementById('series-synopsis-content');
    if (synopsisEl) {
      const textarea = document.createElement('textarea');
      textarea.className = 'edit-synopsis-field';
      textarea.id = 'series-synopsis-content';
      textarea.value = series.description || '';
      textarea.rows = 4;
      synopsisEl.replaceWith(textarea);
    }

    // Genres → chips éditables avec ✕ et bouton +
    this.displayEditableTagCategory('series-genres', series.genres || [], 'genre');
    this.displayEditableTagCategory('series-mood', series.mood || [], 'mood');
    this.displayEditableTagCategory('series-technical', series.technical || [], 'technical');
    this.displayEditableTagCategory('series-personal', series.personalTags || [], 'personal');
    this.displayEditableTagCategory('series-franchise', series.franchises || [], 'franchise');

    // Studios → input dans la pill movie-meta
    const studiosSection = document.getElementById('series-studios-section');
    const studiosSpan = document.getElementById('series-studios-name');
    if (studiosSection && studiosSpan) {
      studiosSection.style.display = 'flex';
      const input = document.createElement('input');
      input.type = 'text'; input.className = 'edit-credit-field';
      input.id = 'series-studios-input';
      input.value = (series.studios || []).join(', ');
      input.placeholder = 'Studios (séparés par une virgule)';
      studiosSpan.replaceWith(input);
    }

    // Plateforme → input dans la pill movie-meta
    const platformSection = document.getElementById('series-platform-section');
    const platformName = document.getElementById('series-platform-name');
    if (platformSection && platformName) {
      platformSection.style.display = 'block';
      const input = document.createElement('input');
      input.type = 'text'; input.className = 'edit-credit-field';
      input.id = 'series-platform-name'; input.value = series.platform || '';
      input.placeholder = 'Plateforme';
      platformName.replaceWith(input);
    }

    // Statut → select dans la pill movie-meta
    const statusSection = document.getElementById('series-status-section');
    const statusName = document.getElementById('series-status-name');
    if (statusSection && statusName) {
      statusSection.style.display = 'block';
      const select = document.createElement('select');
      select.className = 'edit-credit-field'; select.id = 'series-status-name';
      ['', 'En cours', 'Terminée', 'Annulée'].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt; option.textContent = opt || '-- Statut --';
        if (opt === (series.status || '')) option.selected = true;
        select.appendChild(option);
      });
      statusName.replaceWith(select);
    }

    // Pays → select avec drapeaux dans la pill movie-meta
    const countrySection = document.getElementById('series-country-section');
    const countryName = document.getElementById('series-country-name');
    if (countrySection && countryName && countryName.tagName !== 'SELECT') {
      countrySection.style.display = 'block';
      const sel = createCountrySelect(series.country || '', 'series-country-name', 'edit-credit-field edit-credit-select');
      countryName.replaceWith(sel);
    }
  }

  restoreReadOnlyFields() {
    if (!this.currentSeries) return;

    // Titre → h2
    const titleInput = document.getElementById('series-title');
    if (titleInput && titleInput.tagName === 'INPUT') {
      const h2 = document.createElement('h2');
      h2.className = 'modal-title';
      h2.id = 'series-title';
      h2.textContent = this.currentSeries.name || '';
      titleInput.replaceWith(h2);
    }

    // Année → span
    const yearInput = document.getElementById('series-year');
    if (yearInput && yearInput.tagName === 'INPUT') {
      const span = document.createElement('span');
      span.className = 'movie-year';
      span.id = 'series-year';
      span.textContent = this.currentSeries.year || new Date().getFullYear();
      yearInput.replaceWith(span);
    }

    // Synopsis → div
    const synopsisInput = document.getElementById('series-synopsis-content');
    if (synopsisInput && synopsisInput.tagName === 'TEXTAREA') {
      const div = document.createElement('div');
      div.className = 'synopsis-content';
      div.id = 'series-synopsis-content';
      div.textContent = this.currentSeries.description || 'Aucune description disponible.';
      synopsisInput.replaceWith(div);
    }

    // Tags → mode lecture
    this.displayTags(this.currentSeries);

    // Plateforme → span
    const platformInput = document.getElementById('series-platform-name');
    if (platformInput && platformInput.tagName === 'INPUT') {
      const span = document.createElement('span');
      span.className = 'platform-name';
      span.id = 'series-platform-name';
      platformInput.replaceWith(span);
    }

    // Statut → span
    const statusSelect = document.getElementById('series-status-name');
    if (statusSelect && statusSelect.tagName === 'SELECT') {
      const span = document.createElement('span');
      span.className = 'status-value';
      span.id = 'series-status-name';
      statusSelect.replaceWith(span);
    }

    // Pays → span
    const countryInput = document.getElementById('series-country-name');
    if (countryInput && (countryInput.tagName === 'INPUT' || countryInput.tagName === 'SELECT')) {
      const span = document.createElement('span');
      span.className = 'country-value';
      span.id = 'series-country-name';
      countryInput.replaceWith(span);
    }

    // Restaurer la visibilité et les contenus
    this.displayCredits(this.currentSeries);
  }

  // ---- Tags éditables (chips avec ✕ et +) ----

  displayEditableTagCategory(categoryId, tags, chipClass) {
    const categoryElement = document.getElementById(`${categoryId}-category`);
    const containerElement = document.getElementById(`${categoryId}-container`);
    if (!categoryElement || !containerElement) return;

    // Toujours afficher en mode édition pour pouvoir ajouter des tags
    categoryElement.style.display = 'block';
    containerElement.innerHTML = '';

    // Afficher les tags existants avec bouton ✕
    if (tags && tags.length > 0) {
      tags.forEach(tag => {
        if (tag && tag.trim()) {
          const chip = document.createElement('span');
          chip.className = `tag-chip ${chipClass} editable`;
          chip.innerHTML = `
            <span class="tag-text">${tag}</span>
            <button class="tag-remove-btn" data-tag="${tag}" data-category="${chipClass}" title="Supprimer">
              <i class="fas fa-times"></i>
            </button>
          `;
          // Listener suppression
          chip.querySelector('.tag-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeTag(tag, chipClass, categoryId);
          });
          containerElement.appendChild(chip);
        }
      });
    }

    // Bouton + pour ajouter un tag
    const addBtn = document.createElement('button');
    addBtn.className = 'tag-add-btn';
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addBtn.title = 'Ajouter un tag';
    addBtn.addEventListener('click', () => this.promptAddTag(chipClass, categoryId));
    containerElement.appendChild(addBtn);
  }

  removeTag(tagText, chipClass, categoryId) {
    const series = this.currentSeries;
    if (!series) return;

    const fieldMap = { genre: 'genres', mood: 'mood', technical: 'technical', personal: 'personalTags' };
    const field = fieldMap[chipClass];
    if (field && series[field]) {
      series[field] = series[field].filter(t => t !== tagText);
      this.displayEditableTagCategory(categoryId, series[field], chipClass);
      this.hasUnsavedChanges = true;
    }
  }

  promptAddTag(chipClass, categoryId) {
    const containerElement = document.getElementById(`${categoryId}-container`);
    if (!containerElement) return;

    // Éviter les doublons si un input est déjà ouvert
    if (containerElement.querySelector('.tag-inline-input')) return;

    // Masquer le bouton + temporairement
    const addBtn = containerElement.querySelector('.tag-add-btn');
    if (addBtn) addBtn.style.display = 'none';

    // Créer l'input inline
    const wrapper = document.createElement('span');
    wrapper.className = 'tag-inline-input-wrapper';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-inline-input';
    input.placeholder = 'Nouveau tag…';
    input.maxLength = 50;
    wrapper.appendChild(input);
    containerElement.appendChild(wrapper);
    input.focus();

    const confirm = () => {
      const tagText = input.value.trim();
      wrapper.remove();
      if (addBtn) addBtn.style.display = '';
      if (!tagText) return;

      const series = this.currentSeries;
      if (!series) return;
      const fieldMap = { genre: 'genres', mood: 'mood', technical: 'technical', personal: 'personalTags' };
      const field = fieldMap[chipClass];
      if (field) {
        if (!series[field]) series[field] = [];
        if (!series[field].includes(tagText)) {
          series[field].push(tagText);
          this.displayEditableTagCategory(categoryId, series[field], chipClass);
          this.hasUnsavedChanges = true;
        }
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { wrapper.remove(); if (addBtn) addBtn.style.display = ''; }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => { if (wrapper.isConnected) confirm(); }, 150);
    });
  }

  // ---- Bouton play ↔ TMDB ----

  transformPlayButtonToTMDB() {
    const playBtn = document.getElementById('btn-play-series');
    if (!playBtn) return;

    // Sauvegarder l'état original
    playBtn.dataset.originalHtml = playBtn.innerHTML;
    playBtn.dataset.originalMode = 'play';

    // Transformer en bouton TMDB
    playBtn.innerHTML = '<i class="fas fa-search"></i><span>Rechercher sur TMDB</span>';
    playBtn.classList.add('series-tmdb-btn');
  }

  restorePlayButton() {
    const playBtn = document.getElementById('btn-play-series');
    if (!playBtn || !playBtn.dataset.originalHtml) return;

    playBtn.innerHTML = playBtn.dataset.originalHtml;
    playBtn.classList.remove('series-tmdb-btn');
    delete playBtn.dataset.originalHtml;
    delete playBtn.dataset.originalMode;
  }

  // ---- Verrouillage sidebar ----

  lockSidebarElements() {
    // Watch toggle
    const watchToggle = document.getElementById('btn-watch-toggle-series');
    if (watchToggle) {
      watchToggle.style.pointerEvents = 'none';
      watchToggle.style.opacity = '0.5';
      watchToggle.classList.add('locked');
    }

    // Étoiles
    const starsOverlay = document.getElementById('series-stars-overlay');
    if (starsOverlay) {
      starsOverlay.style.pointerEvents = 'none';
      starsOverlay.style.opacity = '0.5';
    }

    // Review
    const reviewInput = document.getElementById('series-review-input');
    const reviewSaveBtn = document.getElementById('series-review-save-btn');
    if (reviewInput) { reviewInput.disabled = true; reviewInput.style.opacity = '0.5'; }
    if (reviewSaveBtn) { reviewSaveBtn.disabled = true; reviewSaveBtn.style.opacity = '0.5'; }
  }

  unlockSidebarElements() {
    const watchToggle = document.getElementById('btn-watch-toggle-series');
    if (watchToggle) {
      watchToggle.style.pointerEvents = '';
      watchToggle.style.opacity = '';
      watchToggle.classList.remove('locked');
    }

    const starsOverlay = document.getElementById('series-stars-overlay');
    if (starsOverlay) {
      starsOverlay.style.pointerEvents = '';
      starsOverlay.style.opacity = '';
    }

    const reviewInput = document.getElementById('series-review-input');
    const reviewSaveBtn = document.getElementById('series-review-save-btn');
    if (reviewInput) { reviewInput.disabled = false; reviewInput.style.opacity = ''; }
    if (reviewSaveBtn) { reviewSaveBtn.disabled = false; reviewSaveBtn.style.opacity = ''; }
  }

  // ---- Détection des changements ----

  setupChangeDetection() {
    const fields = document.querySelectorAll(
      '.series-modal .edit-title-field, .series-modal .edit-year-field, ' +
      '.series-modal .edit-synopsis-field, .series-modal .edit-credit-field'
    );
    fields.forEach(field => {
      field.addEventListener('input', () => {
        this.hasUnsavedChanges = true;
      });
    });
  }

  // ---- Sauvegarde ----

  async saveSeriesChanges() {
    if (!this.currentSeriesId || !this.currentSeries) return;

    const updates = {};

    const titleInput = document.getElementById('series-title');
    if (titleInput && titleInput.tagName === 'INPUT') updates.name = titleInput.value.trim();

    const yearInput = document.getElementById('series-year');
    if (yearInput && yearInput.tagName === 'INPUT') updates.year = parseInt(yearInput.value) || null;

    const synopsisInput = document.getElementById('series-synopsis-content');
    if (synopsisInput && synopsisInput.tagName === 'TEXTAREA') updates.description = synopsisInput.value.trim();

    // Tags sont déjà mis à jour dans currentSeries via removeTag/promptAddTag
    updates.genres = this.currentSeries.genres || [];
    updates.mood = this.currentSeries.mood || [];
    updates.personalTags = this.currentSeries.personalTags || [];
    updates.franchises = this.currentSeries.franchises || [];

    const studiosInput = document.getElementById('series-studios-input');
    if (studiosInput && studiosInput.tagName === 'INPUT') {
      updates.studios = studiosInput.value.split(',').map(s => s.trim()).filter(s => s);
    } else {
      updates.studios = this.currentSeries.studios || [];
    }

    // creator et actors sont gérés via le système de personnes, pas via un input direct
    updates.creator = this.currentSeries.creator || '';
    updates.actors  = this.currentSeries.actors  || [];

    const platformInput = document.getElementById('series-platform-name');
    if (platformInput && platformInput.tagName === 'INPUT') updates.platform = platformInput.value.trim();

    const statusSelect = document.getElementById('series-status-name');
    if (statusSelect && statusSelect.tagName === 'SELECT') updates.status = statusSelect.value;

    const countryInput = document.getElementById('series-country-name');
    if (countryInput && (countryInput.tagName === 'INPUT' || countryInput.tagName === 'SELECT')) updates.country = countryInput.value.trim();

    if (this.pendingPosterUrl) {
      updates.posterUrl = this.pendingPosterUrl;
    }

    try {
      console.log('💾 Sauvegarde des modifications série:', updates);

      // Sauvegarder les épisodes modifiés/supprimés
      await this.saveEpisodeEdits();

      const result = await window.electronAPI.updateSeries(this.currentSeriesId, updates);

      if (result.success) {
        // Recharger les données fraîches (incl. saisons mises à jour)
        const reloaded = await window.electronAPI.getSeriesById(this.currentSeriesId);
        if (reloaded.success) {
          this.currentSeries = reloaded.series;
        } else {
          Object.assign(this.currentSeries, updates);
        }

        this.pendingPosterUrl = null;
        this.deactivateEditMode();

        // Rafraichir l'affichage depuis la DB (le nom est maintenant propagé aux épisodes)
        if (window.filtersSystem?.applyFiltersAndSort) {
          await window.filtersSystem.applyFiltersAndSort();
        } else if (window.refreshDashboard) {
          window.refreshDashboard();
        }
        console.log('✅ Série mise à jour avec succès');
      } else {
        console.error('❌ Erreur lors de la mise à jour:', result.message);
        alert('Erreur lors de la sauvegarde : ' + (result.message || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde : ' + error.message);
    }
  }

  // ============================================
  // RECHERCHE TMDB
  // ============================================

  openTMDBSearch() {
    const existing = document.getElementById('series-tmdb-search-modal');
    if (existing) existing.remove();

    // Récupérer le titre actuel (input en mode edit ou currentSeries)
    const titleEl = document.getElementById('series-title');
    const initialQuery = (titleEl && titleEl.tagName === 'INPUT')
      ? titleEl.value.trim()
      : (this.currentSeries?.name || '');

    const modal = document.createElement('div');
    modal.id = 'series-tmdb-search-modal';
    modal.className = 'tmdb-modal-overlay';
    modal.innerHTML = `
      <div class="tmdb-modal-container">
        <div class="tmdb-modal-header">
          <h2><i class="fas fa-tv"></i> Recherche TMDB - Séries</h2>
          <button class="tmdb-close-btn" id="series-tmdb-close-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="tmdb-search-bar">
          <input type="text" id="series-tmdb-search-field" placeholder="Rechercher une série..." value="${initialQuery.replace(/"/g, '&quot;')}">
          <button id="series-tmdb-search-action" class="tmdb-search-btn">
            <i class="fas fa-search"></i> Rechercher
          </button>
        </div>

        <div class="tmdb-results-area">
          <div id="series-tmdb-status" class="tmdb-status">
            <i class="fas fa-info-circle"></i>
            <span>Entrez un titre et cliquez sur Rechercher</span>
          </div>
          <div id="series-tmdb-results-grid" class="tmdb-results-grid"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const searchField = document.getElementById('series-tmdb-search-field');
    const searchBtn = document.getElementById('series-tmdb-search-action');
    const closeBtn = document.getElementById('series-tmdb-close-btn');
    const statusDiv = document.getElementById('series-tmdb-status');
    const resultsGrid = document.getElementById('series-tmdb-results-grid');

    setTimeout(() => searchField.focus(), 100);

    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const doSearch = async () => {
      const query = searchField.value.trim();
      if (!query) {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Veuillez entrer un titre</span>';
        statusDiv.style.display = 'flex';
        return;
      }

      statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Recherche en cours...</span>';
      statusDiv.style.display = 'flex';
      resultsGrid.innerHTML = '';

      try {
        const results = await this.searchTMDBSeries(query);
        if (results.length === 0) {
          statusDiv.innerHTML = '<i class="fas fa-search"></i><span>Aucun résultat trouvé</span>';
          return;
        }
        statusDiv.style.display = 'none';
        this.displayTMDBResults(results, resultsGrid, closeModal);
      } catch (error) {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Erreur de connexion à TMDB</span>';
      }
    };

    searchBtn.addEventListener('click', doSearch);
    searchField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    if (initialQuery) {
      setTimeout(doSearch, 300);
    }
  }

  async searchTMDBSeries(query) {
    const url = `${SERIES_TMDB_API_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false&page=1`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${SERIES_TMDB_TOKEN}` }
    });
    if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  }

  async getTMDBSeriesDetails(tmdbId) {
    const url = `${SERIES_TMDB_API_BASE_URL}/tv/${tmdbId}?language=fr-FR&append_to_response=credits`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${SERIES_TMDB_TOKEN}` }
    });
    if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
    return await response.json();
  }

  displayTMDBResults(results, container, closeModal) {
    container.innerHTML = '';
    const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"%3E%3Crect fill="%23222" width="300" height="450"/%3E%3Ctext x="150" y="225" fill="%23555" text-anchor="middle" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';

    results.slice(0, 20).forEach(series => {
      const card = document.createElement('div');
      card.className = 'tmdb-result-card';

      const posterUrl = series.poster_path
        ? `${SERIES_TMDB_IMAGE_BASE_URL}${series.poster_path}`
        : fallbackImage;

      const year = series.first_air_date ? series.first_air_date.substring(0, 4) : '----';
      const rating = series.vote_average ? series.vote_average.toFixed(1) : 'N/A';
      const safeTitle = (series.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      card.innerHTML = `
        <div class="tmdb-card-poster">
          <img src="${posterUrl}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer">
          <div class="tmdb-card-rating">
            <i class="fas fa-star"></i> ${rating}
          </div>
        </div>
        <div class="tmdb-card-info">
          <h4>${safeTitle}</h4>
          <span class="tmdb-card-year">${year}</span>
        </div>
      `;

      const img = card.querySelector('img');
      if (img) {
        img.onerror = function() { this.src = fallbackImage; this.onerror = null; };
      }

      card.addEventListener('click', () => this.selectTMDBSeries(series.id, closeModal));
      container.appendChild(card);
    });
  }

  async selectTMDBSeries(tmdbId, closeModal) {
    if (this._tmdbImportRunning) return;
    this._tmdbImportRunning = true;
    try {
      const statusDiv = document.getElementById('series-tmdb-status');
      if (statusDiv) {
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Chargement des détails...</span>';
        statusDiv.style.display = 'flex';
      }

      const details = await this.getTMDBSeriesDetails(tmdbId);
      console.log('📺 Détails TMDB série récupérés:', details);

      // Remplir les champs éditables
      const titleInput = document.getElementById('series-title');
      if (titleInput && titleInput.tagName === 'INPUT') titleInput.value = details.name || '';

      const yearInput = document.getElementById('series-year');
      if (yearInput && yearInput.tagName === 'INPUT' && details.first_air_date) {
        yearInput.value = details.first_air_date.substring(0, 4);
      }

      const synopsisInput = document.getElementById('series-synopsis-content');
      if (synopsisInput && synopsisInput.tagName === 'TEXTAREA') synopsisInput.value = details.overview || '';

      // Genres → mettre à jour currentSeries et rafraîchir les chips
      if (details.genres) {
        this.currentSeries.genres = details.genres.map(g => g.name);
        this.displayEditableTagCategory('series-genres', this.currentSeries.genres, 'genre');
      }

      // --- Import automatique des personnes (créateurs, équipe, casting) ---
      const _importPersonsFromTMDB = async () => {
        const toImport = [];

        for (const c of (details.created_by || []).slice(0, 3)) {
          toImport.push({ p: c, role: 'creator', character: null });
        }

        const seenRoles = { composer: false, writer: false, producer: false };
        for (const m of (details.credits?.crew || [])) {
          if (!seenRoles.composer && m.job === 'Original Music Composer') {
            toImport.push({ p: m, role: 'composer', character: null }); seenRoles.composer = true;
          } else if (!seenRoles.writer && m.department === 'Writing') {
            toImport.push({ p: m, role: 'writer', character: null }); seenRoles.writer = true;
          } else if (!seenRoles.producer && (m.job === 'Executive Producer' || m.job === 'Producer')) {
            toImport.push({ p: m, role: 'producer', character: null }); seenRoles.producer = true;
          }
        }

        for (const a of (details.credits?.cast || []).slice(0, 8)) {
          toImport.push({ p: a, role: 'actor', character: a.character || null });
        }

        for (const { p, role, character } of toImport) {
          try {
            let fileName = null;
            if (p.profile_path) {
              try {
                const dlResult = await window.electronAPI.downloadPersonPhoto(
                  `${SERIES_TMDB_IMAGE_BASE_URL}${p.profile_path}`, p.name
                );
                if (dlResult.success) fileName = dlResult.fileName;
              } catch (e) { /* photo optionnelle */ }
            }
            const addResult = await window.electronAPI.addPerson({
              tmdbId: p.id, name: p.name, photo: fileName,
              knownForDepartment: p.known_for_department || null
            });
            if (!addResult.success || !addResult.person) continue;
            await window.electronAPI.linkPersonToMedia(
              addResult.person.id, this.currentSeriesId, 'serie', role, character
            );
          } catch (e) { console.warn('Import personne TMDB échoué:', p.name, e); }
        }

        if (this.isEditMode && this.currentSeriesId) {
          await this.transformCreditsToEditMode();
        }
      };
      _importPersonsFromTMDB();

      const countryInput = document.getElementById('series-country-name');
      if (countryInput && (countryInput.tagName === 'INPUT' || countryInput.tagName === 'SELECT') && details.origin_country) {
        const countryLabel = resolveCountryLabel(details.origin_country[0] || '');
        if (countryInput.tagName === 'SELECT') {
          const opt = Array.from(countryInput.options).find(o => o.value === countryLabel);
          if (opt) countryInput.value = countryLabel;
        } else {
          countryInput.value = countryLabel;
        }
        if (this.currentSeries) this.currentSeries.country = countryLabel;
      }

      // Extraire et appliquer les studios de production
      const tmdbStudios = (details.production_companies || []).map(c => c.name);
      if (tmdbStudios.length > 0) {
        const studiosInput = document.getElementById('series-studios-input');
        if (studiosInput && studiosInput.tagName === 'INPUT') {
          studiosInput.value = tmdbStudios.join(', ');
        }
        if (this.currentSeries) this.currentSeries.studios = tmdbStudios;
      }

      const statusSelect = document.getElementById('series-status-name');
      if (statusSelect && statusSelect.tagName === 'SELECT' && details.status) {
        const statusMap = {
          'Returning Series': 'En cours', 'Ended': 'Terminée',
          'Canceled': 'Annulée', 'In Production': 'En cours'
        };
        statusSelect.value = statusMap[details.status] || '';
      }

      // Poster
      if (details.poster_path) {
        const posterUrl = `${SERIES_TMDB_IMAGE_BASE_URL}${details.poster_path}`;
        try {
          const downloadResult = await window.electronAPI.downloadTMDBImage(posterUrl, this.currentSeriesId);
          if (downloadResult.success) {
            const filename = downloadResult.localPath.split(/[\\/]/).pop();
            this.pendingPosterUrl = `http://localhost:3001/tmdb-images/${filename}`;
            const posterEl = document.getElementById('series-poster');
            if (posterEl) posterEl.src = this.pendingPosterUrl;
          }
        } catch (err) {
          console.warn('⚠️ Erreur téléchargement poster série:', err);
        }
      }

      this.hasUnsavedChanges = true;
      console.log('Donnees TMDB appliquees');
      if (closeModal) closeModal();

    } catch (error) {
      console.error('Erreur selection TMDB serie:', error);
      alert('Erreur lors du chargement des données TMDB');
    } finally {
      this._tmdbImportRunning = false;
    }
  }

  // ---- Overlay poster ----

  setupPosterEditOverlay() {
    const posterContainer = document.querySelector('.series-modal .modal-poster');
    if (!posterContainer || posterContainer.querySelector('.series-poster-edit-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'series-poster-edit-overlay';
    overlay.innerHTML = '<i class="fas fa-camera"></i><span>Changer le poster</span>';
    overlay.addEventListener('click', () => this.openTMDBSearch());
    posterContainer.appendChild(overlay);
  }
  // ============================================
  // GESTION SAISONS/ÉPISODES EN MODE ÉDITION
  // ============================================

  activateEditModeSeasons() {
    const container = document.getElementById('seasons-container');
    if (!container || !this.currentSeries) return;

    this._episodeEdits = {};
    this._deletedEpisodeIds = [];

    const seasons = this.currentSeries.seasons || [];
    container.innerHTML = '';

    // Barre de contrôle
    const controlBar = document.createElement('div');
    controlBar.className = 'seasons-edit-controls';
    controlBar.innerHTML = `
      <button class="btn-manage-seasons-modal" id="btn-open-seasons-manager">
        <i class="fas fa-layer-group"></i> Gérer les saisons
      </button>
    `;
    container.appendChild(controlBar);

    if (seasons.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'seasons-empty-edit';
      empty.innerHTML = `<i class="fas fa-tv"></i><p>Aucun épisode — utilisez "Gérer les saisons" pour en ajouter.</p>`;
      container.appendChild(empty);
    } else {
      seasons.forEach(season => container.appendChild(this._renderEditableSeason(season)));
    }

    document.getElementById('btn-open-seasons-manager')
      ?.addEventListener('click', () => this.openSeasonsManager());
  }

  deactivateEditModeSeasons() {
    this._episodeEdits = {};
    this._deletedEpisodeIds = [];
    this.populateSeasons(this.currentSeries?.seasons || []);
  }

  _renderEditableSeason(season) {
    const div = document.createElement('div');
    div.className = 'edit-season-section';
    div.dataset.seasonNumber = season.number;

    const header = document.createElement('div');
    header.className = 'season-header-edit';
    header.innerHTML = `
      <h3 class="season-label">Saison ${season.number}</h3>
      <span class="season-ep-count">${(season.episodes || []).length} ép.</span>
    `;
    div.appendChild(header);

    const list = document.createElement('div');
    list.className = 'episodes-edit-list';

    if (season.episodes && season.episodes.length > 0) {
      season.episodes.forEach(ep => list.appendChild(this._renderEditableEpisodeRow(ep)));
    } else {
      list.innerHTML = `<p class="ep-empty">Aucun épisode dans cette saison.</p>`;
    }

    div.appendChild(list);
    return div;
  }

  _renderEditableEpisodeRow(episode) {
    const row = document.createElement('div');
    row.className = 'episode-edit-row';
    row.dataset.episodeId = episode.id;

    let thumbSrc = '';
    if (episode.thumbnail) {
      const thumbName = episode.thumbnail.split('\\').pop().split('/').pop();
      thumbSrc = `http://localhost:3001/thumbnails/${thumbName}`;
    }

    const sn = episode.season_number || 1;
    const en = episode.episode_number || '';
    const title = episode.title || '';

    row.innerHTML = `
      <img class="ep-edit-thumb" src="${thumbSrc}" alt="" onerror="this.style.display='none'">
      <div class="ep-edit-fields">
        <input class="ep-edit-title" type="text" value="${title.replace(/"/g, '&quot;')}" placeholder="Titre de l'épisode">
        <div class="ep-edit-numbers">
          <label>S<input class="ep-edit-sn" type="number" value="${sn}" min="1" max="99"></label>
          <label>E<input class="ep-edit-en" type="number" value="${en}" min="1" max="9999" placeholder="—"></label>
        </div>
      </div>
      <button class="btn-ep-delete" title="Supprimer l'épisode">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;

    row.dataset.origTitle = title;
    row.dataset.origSn = String(sn);
    row.dataset.origEn = String(en);

    row.querySelector('.btn-ep-delete')
      .addEventListener('click', () => this._confirmDeleteEpisode(episode.id, title || `S${sn}E${en}`, row));

    return row;
  }

  _confirmDeleteEpisode(episodeId, label, row) {
    if (!confirm(`Supprimer "${label}" de la bibliothèque ?\n\nCette action est irréversible.`)) return;
    this._deletedEpisodeIds.push(episodeId);
    row.style.opacity = '0.4';
    row.style.pointerEvents = 'none';
    const btn = row.querySelector('.btn-ep-delete');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = 'rgba(231,76,60,0.2)';
  }

  async saveEpisodeEdits() {
    const rows = document.querySelectorAll('#seasons-container .episode-edit-row');

    for (const row of rows) {
      const episodeId = row.dataset.episodeId;
      if (this._deletedEpisodeIds.includes(episodeId)) continue;

      const title = row.querySelector('.ep-edit-title')?.value?.trim() ?? '';
      const sn    = parseInt(row.querySelector('.ep-edit-sn')?.value) || 1;
      const en    = parseInt(row.querySelector('.ep-edit-en')?.value) || null;

      const changed =
        title !== row.dataset.origTitle ||
        String(sn) !== row.dataset.origSn ||
        String(en ?? '') !== row.dataset.origEn;

      if (changed) {
        try {
          await window.electronAPI.updateMedia(episodeId, { title, season_number: sn, episode_number: en });
          console.log(`✅ Épisode mis à jour: ${title}`);
        } catch (err) {
          console.error(`❌ Erreur mise à jour épisode ${episodeId}:`, err);
        }
      }
    }

    for (const epId of this._deletedEpisodeIds) {
      try {
        await window.electronAPI.deleteMedia(epId);
        console.log(`🗑️ Épisode supprimé: ${epId}`);
      } catch (err) {
        console.error(`❌ Erreur suppression épisode ${epId}:`, err);
      }
    }
  }

  async openSeasonsManager() {
    if (!window.seasonsManager || !this.currentSeriesId) return;

    // Sauvegarder les épisodes en cours d'édition avant d'ouvrir le gestionnaire
    await this.saveEpisodeEdits();

    window.seasonsManager._onFinishCallback = async () => {
      const result = await window.electronAPI.getSeriesById(this.currentSeriesId);
      if (result.success) {
        this.currentSeries = result.series;
        if (this.isEditMode) {
          this.activateEditModeSeasons();
        } else {
          this.populateSeasons(result.series.seasons || []);
        }
      }
    };

    window.seasonsManager.openModal(this.currentSeriesId, this.currentSeries.name);
  }

}

// Initialiser le gestionnaire de modale série
let seriesModal;

document.addEventListener('DOMContentLoaded', () => {
  seriesModal = new SeriesModal();
  console.log('✅ Modale série initialisée');
});

// Fonction globale pour ouvrir une série
window.openSeries = function(seriesId) {
  console.log('🔍 openSeries appelée avec ID:', seriesId);
  console.log('🔍 seriesModal existe:', !!seriesModal);

  if (seriesModal) {
    seriesModal.show(seriesId);
  } else {
    console.error('❌ seriesModal non initialisé');
  }
};

// Fonction globale pour lire directement le premier épisode d'une série
window.playSeriesFirstEpisode = async function(seriesId) {
  try {
    console.log('▶️ Lecture du premier épisode de la série:', seriesId);

    // Récupérer les données de la série
    const result = await window.electronAPI.getSeriesById(seriesId);

    if (!result.success) {
      console.error('❌ Erreur lors du chargement de la série:', result.message);
      alert('Impossible de charger la série');
      return;
    }

    const series = result.series;

    // Collecter tous les épisodes triés
    const sortedEpisodes = [];

    for (const season of series.seasons || []) {
      if (season.episodes && season.episodes.length > 0) {
        for (const episode of season.episodes) {
          if (episode.episode_number !== null && episode.episode_number !== undefined) {
            sortedEpisodes.push({
              ...episode,
              seasonNumber: season.number
            });
          }
        }
      }
    }

    // Vérifier s'il y a des épisodes triés
    if (sortedEpisodes.length === 0) {
      alert('Aucun épisode trié trouvé.\n\nVeuillez d\'abord trier les épisodes de cette série avant de pouvoir la lire.');
      console.warn('⚠️ Aucun épisode trié disponible pour la série:', series.name);
      return;
    }

    // Trier les épisodes par saison puis par numéro d'épisode
    sortedEpisodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }
      return a.episode_number - b.episode_number;
    });

    // Choisir l'épisode à lire : dernier en cours ou premier
    const sp = window.progressData?.seriesProgress?.[seriesId];
    let episodeToPlay = sortedEpisodes[0];
    if (sp && sp.episodeMediaId) {
      const resumed = sortedEpisodes.find(e => e.id === sp.episodeMediaId);
      if (resumed) episodeToPlay = resumed;
    }

    if (!episodeToPlay.path) {
      console.error('❌ Chemin de l\'épisode manquant');
      alert('Impossible de lire l\'épisode : chemin du fichier manquant');
      return;
    }

    const title = episodeToPlay.title || 'Épisode sans titre';
    const currentIndex = sortedEpisodes.indexOf(episodeToPlay);
    const seriesContext = { episodes: sortedEpisodes, currentIndex };

    // Lancer la lecture
    if (window.openVideoPlayer) {
      const ep = (episodeToPlay.audioStatus === 'ok' && episodeToPlay.audioConvertedPath)
        ? episodeToPlay.audioConvertedPath : episodeToPlay.path;
      window.openVideoPlayer(episodeToPlay.id, title, ep, seriesContext, episodeToPlay.audioStatus === 'ok', episodeToPlay.path);
    } else {
      console.error('❌ Fonction de lecture vidéo non trouvée');
      alert('Impossible de lire l\'épisode : lecteur vidéo non disponible');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du premier épisode:', error);
    alert('Erreur lors de la lecture : ' + error.message);
  }
};
