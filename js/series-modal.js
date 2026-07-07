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
    this.attachEventListeners();
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
          this.playFirstEpisode();
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

  // Système d'étoiles progressif
  setupStarsInteraction() {
    const starsContainer = document.getElementById('series-progressive-stars');
    const starsFill = document.getElementById('series-stars-fill');
    const ratingInput = document.getElementById('series-rating-input');
    const starsOverlay = document.getElementById('series-stars-overlay');

    if (!starsContainer || !starsFill || !ratingInput || !starsOverlay) return;

    // Interaction au survol
    starsOverlay.addEventListener('mousemove', (e) => {
      const rect = starsContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      starsFill.style.width = `${percentage}%`;

      const rating = (percentage / 100) * 5;
      ratingInput.value = rating.toFixed(1);
    });

    starsOverlay.addEventListener('mouseleave', () => {
      const currentRating = parseFloat(ratingInput.value) || 0;
      const percentage = (currentRating / 5) * 100;
      starsFill.style.width = `${percentage}%`;
    });

    // Clic pour enregistrer la note
    starsOverlay.addEventListener('click', (e) => {
      const rect = starsContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const rating = (percentage / 100) * 5;

      ratingInput.value = rating.toFixed(1);
      this.saveRating(rating);
    });

    // Input manuel
    ratingInput.addEventListener('change', () => {
      let rating = parseFloat(ratingInput.value) || 0;
      rating = Math.max(0, Math.min(5, rating));
      ratingInput.value = rating.toFixed(1);

      const percentage = (rating / 5) * 100;
      starsFill.style.width = `${percentage}%`;

      this.saveRating(rating);
    });
  }

  // Sauvegarder la note
  saveRating(rating) {
    if (!this.currentSeriesId) return;

    const userPrefs = this.getUserPrefs();
    userPrefs.seriesRatings[this.currentSeriesId] = rating;
    this.saveUserPrefs(userPrefs);

    // Mettre à jour l'affichage rapide sur le poster
    const ratingQuick = document.getElementById('series-rating-quick');
    if (ratingQuick) {
      ratingQuick.textContent = this.getStarsDisplay(rating);
    }

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
      await this.populateModal(this.currentSeries);
      this.loadUserPreferences();

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

    // Charger la note
    const rating = userPrefs.seriesRatings[this.currentSeriesId] || 0;
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

    if (episodeCountElement) {
      episodeCountElement.textContent = `${totalEpisodes} épisode${totalEpisodes > 1 ? 's' : ''}`;
    }
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
  }

  displayTagCategory(categoryId, tags, chipClass) {
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
    } else {
      // Masquer si vide
      categoryElement.style.display = 'none';
    }
  }

  async displayCredits(series) {
    const CREW_ROLES = ['creator', 'producer', 'writer', 'composer'];
    const crewSection = document.getElementById('series-crew-section');
    const castSection = document.getElementById('series-cast-section');
    const castGrid   = document.getElementById('series-cast-persons-grid');

    // Vider les grilles
    CREW_ROLES.forEach(role => {
      const dept = document.getElementById(`series-crew-${role}`);
      if (dept) {
        const grid = dept.querySelector('.credits-persons-grid');
        if (grid) grid.innerHTML = '';
        dept.style.display = 'none';
      }
    });
    if (castGrid) castGrid.innerHTML = '';

    let persons = [];
    try {
      const result = await window.electronAPI.getPersonsForMedia(series.id);
      if (result && result.success) persons = result.persons || [];
    } catch (e) {
      console.warn('getPersonsForMedia non disponible pour la série:', e);
    }

    if (persons.length > 0 && typeof window.createPersonAvatarCard === 'function') {
      let hasAnyCrewPerson = false;
      let hasCast = false;

      persons.forEach(person => {
        const role = (person.role || '').toLowerCase();
        if (role === 'actor') {
          if (castGrid) {
            castGrid.appendChild(window.createPersonAvatarCard(person, () => window.openPersonMiniPopup && window.openPersonMiniPopup(person)));
            hasCast = true;
          }
        } else if (CREW_ROLES.includes(role)) {
          const dept = document.getElementById(`series-crew-${role}`);
          if (dept) {
            const grid = dept.querySelector('.credits-persons-grid');
            if (grid) {
              grid.appendChild(window.createPersonAvatarCard(person, () => window.openPersonMiniPopup && window.openPersonMiniPopup(person)));
              dept.style.display = '';
              hasAnyCrewPerson = true;
            }
          }
        }
      });

      if (crewSection) crewSection.style.display = hasAnyCrewPerson ? '' : 'none';
      if (castSection) castSection.style.display = hasCast ? '' : 'none';
    } else {
      // Fallback : masquer les grilles, afficher les sections texte
      if (crewSection) crewSection.style.display = 'none';
      if (castSection) castSection.style.display = 'none';
    }

    // Sections texte fallback (créateur, acteurs, plateforme, statut, pays)
    const directorSection = document.getElementById('series-director-section');
    const directorName    = document.getElementById('series-director-name');
    if (directorSection && directorName) {
      if (series.creator && series.creator.trim()) {
        directorName.textContent = series.creator;
        directorSection.style.display = 'flex';
      } else {
        directorSection.style.display = 'none';
      }
    }

    const actorsSection = document.getElementById('series-actors-section');
    const actorsList    = document.getElementById('series-actors-list');
    if (actorsSection && actorsList) {
      if (persons.length === 0 && series.actors && series.actors.length > 0) {
        actorsList.textContent = series.actors.slice(0, 3).join(', ');
        actorsSection.style.display = 'flex';
      } else {
        actorsSection.style.display = 'none';
      }
    }

    // Plateforme, statut, pays (toujours affichés indépendamment des persons)
    const platformSection = document.getElementById('series-platform-section');
    const platformName    = document.getElementById('series-platform-name');
    if (platformSection && platformName) {
      if (series.platform && series.platform.trim()) {
        platformName.textContent = series.platform;
        platformSection.style.display = 'flex';
      } else {
        platformSection.style.display = 'none';
      }
    }

    const statusSection = document.getElementById('series-status-section');
    const statusName    = document.getElementById('series-status-name');
    if (statusSection && statusName) {
      if (series.status && series.status.trim()) {
        statusName.textContent = series.status;
        statusSection.style.display = 'flex';
      } else {
        statusSection.style.display = 'none';
      }
    }

    const countrySection = document.getElementById('series-country-section');
    const countryName    = document.getElementById('series-country-name');
    if (countrySection && countryName) {
      if (series.country && series.country.trim()) {
        countryName.textContent = series.country;
        countrySection.style.display = 'flex';
      } else {
        countrySection.style.display = 'none';
      }
    }
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
    const rating          = userPrefs.seriesRatings ? (userPrefs.seriesRatings[seriesId] || 0) : 0;

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
      card.addEventListener('click', () => this.playEpisode(episode));
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
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playEpisode(episode);
      });
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
      window.openVideoPlayer(episode.id, title, episode.path, seriesContext);
    } else {
      console.error('❌ Fonction de lecture vidéo non trouvée');
      alert('Impossible de lire l\'épisode : lecteur vidéo non disponible');
    }
  }

  playFirstEpisode() {
    const sortedEpisodes = this.getSortedEpisodes();

    if (sortedEpisodes.length === 0) {
      alert('Aucun épisode trié trouvé.\n\nVeuillez d\'abord trier les épisodes de cette série avant de pouvoir la lire.');
      console.warn('⚠️ Aucun épisode trié disponible pour la série:', this.currentSeries?.name);
      return;
    }

    const firstEpisode = sortedEpisodes[0];
    console.log('▶️ Lecture du premier épisode trié:', firstEpisode.title);
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
      name: this.currentSeries.name || '',
      description: this.currentSeries.description || '',
      genres: this.currentSeries.genres ? [...this.currentSeries.genres] : [],
      year: this.currentSeries.year || '',
      creator: this.currentSeries.creator || '',
      actors: this.currentSeries.actors ? [...this.currentSeries.actors] : [],
      country: this.currentSeries.country || '',
      status: this.currentSeries.status || '',
      platform: this.currentSeries.platform || ''
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

    // Créateur → input (on garde l'id series-director-name)
    const directorSection = document.getElementById('series-director-section');
    const directorName = document.getElementById('series-director-name');
    if (directorSection && directorName) {
      directorSection.style.display = 'flex';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-credit-field';
      input.id = 'series-director-name';
      input.value = series.creator || '';
      input.placeholder = 'Créateur';
      directorName.replaceWith(input);
    }

    // Acteurs → input (on garde l'id series-actors-list)
    const actorsSection = document.getElementById('series-actors-section');
    const actorsList = document.getElementById('series-actors-list');
    if (actorsSection && actorsList) {
      actorsSection.style.display = 'flex';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-credit-field';
      input.id = 'series-actors-list';
      input.value = (series.actors || []).join(', ');
      input.placeholder = 'Acteurs (séparés par des virgules)';
      actorsList.replaceWith(input);
    }

    // Plateforme → input (on garde l'id series-platform-name)
    const platformSection = document.getElementById('series-platform-section');
    const platformName = document.getElementById('series-platform-name');
    if (platformSection && platformName) {
      platformSection.style.display = 'flex';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-credit-field';
      input.id = 'series-platform-name';
      input.value = series.platform || '';
      input.placeholder = 'Plateforme';
      platformName.replaceWith(input);
    }

    // Statut → select (on garde l'id series-status-name)
    const statusSection = document.getElementById('series-status-section');
    const statusName = document.getElementById('series-status-name');
    if (statusSection && statusName) {
      statusSection.style.display = 'flex';
      const select = document.createElement('select');
      select.className = 'edit-credit-field';
      select.id = 'series-status-name';
      const statusOptions = ['', 'En cours', 'Terminée', 'Annulée'];
      statusOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt || '-- Choisir --';
        if (opt === (series.status || '')) option.selected = true;
        select.appendChild(option);
      });
      statusName.replaceWith(select);
    }

    // Pays → input (on garde l'id series-country-name)
    const countrySection = document.getElementById('series-country-section');
    const countryName = document.getElementById('series-country-name');
    if (countrySection && countryName) {
      countrySection.style.display = 'flex';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-credit-field';
      input.id = 'series-country-name';
      input.value = series.country || '';
      input.placeholder = 'Pays';
      countryName.replaceWith(input);
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

    // Créateur → span
    const creatorInput = document.getElementById('series-director-name');
    if (creatorInput && creatorInput.tagName === 'INPUT') {
      const span = document.createElement('span');
      span.className = 'director-name';
      span.id = 'series-director-name';
      creatorInput.replaceWith(span);
    }

    // Acteurs → span
    const actorsInput = document.getElementById('series-actors-list');
    if (actorsInput && actorsInput.tagName === 'INPUT') {
      const span = document.createElement('span');
      span.className = 'actors-list';
      span.id = 'series-actors-list';
      actorsInput.replaceWith(span);
    }

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
    if (countryInput && countryInput.tagName === 'INPUT') {
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
    updates.technical = this.currentSeries.technical || [];
    updates.personalTags = this.currentSeries.personalTags || [];

    const creatorInput = document.getElementById('series-director-name');
    if (creatorInput && creatorInput.tagName === 'INPUT') updates.creator = creatorInput.value.trim();

    const actorsInput = document.getElementById('series-actors-list');
    if (actorsInput && actorsInput.tagName === 'INPUT') {
      updates.actors = actorsInput.value.split(',').map(a => a.trim()).filter(a => a);
    }

    const platformInput = document.getElementById('series-platform-name');
    if (platformInput && platformInput.tagName === 'INPUT') updates.platform = platformInput.value.trim();

    const statusSelect = document.getElementById('series-status-name');
    if (statusSelect && statusSelect.tagName === 'SELECT') updates.status = statusSelect.value;

    const countryInput = document.getElementById('series-country-name');
    if (countryInput && countryInput.tagName === 'INPUT') updates.country = countryInput.value.trim();

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

        // Mettre à jour l'image de la card en temps réel si un poster a changé
        if (this.pendingPosterUrl) {
          const seriesCard = document.querySelector(`.media-card[data-series-id="${this.currentSeriesId}"]`);
          if (seriesCard) {
            const img = seriesCard.querySelector('img.media-thumbnail');
            if (img) img.src = this.pendingPosterUrl;
          }
        }

        this.pendingPosterUrl = null;
        this.deactivateEditMode();
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

      const creatorInput = document.getElementById('series-director-name');
      if (creatorInput && creatorInput.tagName === 'INPUT' && details.created_by) {
        creatorInput.value = details.created_by.map(c => c.name).join(', ');
      }

      const actorsInput = document.getElementById('series-actors-list');
      if (actorsInput && actorsInput.tagName === 'INPUT' && details.credits?.cast) {
        actorsInput.value = details.credits.cast.slice(0, 10).map(a => a.name).join(', ');
      }

      const countryInput = document.getElementById('series-country-name');
      if (countryInput && countryInput.tagName === 'INPUT' && details.origin_country) {
        countryInput.value = details.origin_country.join(', ');
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
      console.log('✅ Données TMDB appliquées');
      if (closeModal) closeModal();

    } catch (error) {
      console.error('❌ Erreur sélection TMDB série:', error);
      alert('Erreur lors du chargement des données TMDB');
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

    // Lire le premier épisode trié
    const firstEpisode = sortedEpisodes[0];
    console.log('▶️ Lecture du premier épisode trié:', firstEpisode.title);

    if (!firstEpisode.path) {
      console.error('❌ Chemin de l\'épisode manquant');
      alert('Impossible de lire l\'épisode : chemin du fichier manquant');
      return;
    }

    const title = firstEpisode.title || 'Épisode sans titre';

    // Lancer la lecture
    if (window.openVideoPlayer) {
      window.openVideoPlayer(firstEpisode.id, title, firstEpisode.path);
    } else {
      console.error('❌ Fonction de lecture vidéo non trouvée');
      alert('Impossible de lire l\'épisode : lecteur vidéo non disponible');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du premier épisode:', error);
    alert('Erreur lors de la lecture : ' + error.message);
  }
};
