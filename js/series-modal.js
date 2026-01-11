/**
 * Gestionnaire de la modale série - Version améliorée similaire aux médias uniques
 */
class SeriesModal {
  constructor() {
    this.modal = document.getElementById('series-modal-overlay');
    console.log('🔍 Element series-modal-overlay trouvé:', !!this.modal);
    this.currentSeries = null;
    this.currentSeriesId = null;
    this.USER_PREFS_KEY = 'userPrefs_global';
    this.isOpening = false; // Protection contre les ouvertures multiples
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

    // Bouton de lecture
    const playBtn = document.getElementById('btn-play-series');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.playFirstEpisode());
    }

    // Bouton édition (à implémenter plus tard)
    const editBtn = document.getElementById('series-edit-button');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        console.log('✏️ Mode édition série (à implémenter)');
        alert('Mode édition des séries à venir!');
      });
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
      this.populateModal(this.currentSeries);
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

  populateModal(series) {
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

    // Mise à jour de l'overlay saison/épisodes en haut à gauche de l'affiche
    const seasonInfoElement = document.getElementById('series-season-info');
    const episodeInfoOverlay = document.getElementById('series-episode-info-overlay');
    const seasonsQuick = document.getElementById('series-seasons-quick');

    if (seasonInfoElement) {
      if (totalSeasons === 1) {
        seasonInfoElement.textContent = 'S1';
      } else {
        seasonInfoElement.textContent = `${totalSeasons} saisons`;
      }
    }

    if (episodeInfoOverlay) {
      episodeInfoOverlay.textContent = `${totalEpisodes} ép.`;
    }

    if (seasonsQuick) {
      seasonsQuick.textContent = totalSeasons;
    }

    if (synopsisElement) {
      synopsisElement.textContent = series.description || 'Aucune description disponible.';
    }

    if (posterElement) {
      const defaultSeriesPoster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0NTAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0cHgiPvCfk7o8L3RleHQ+PC9zdmc+';
      let posterSrc = defaultSeriesPoster;

      // Priorité 1: POSTER officiel de la série (si disponible)
      if (series.posterUrl) {
        posterSrc = series.posterUrl;
        console.log('📸 Utilisation du poster officiel:', posterSrc);
      }
      // Priorité 2: THUMBNAIL du premier épisode
      else if (series.seasons && series.seasons[0] && series.seasons[0].episodes && series.seasons[0].episodes[0]) {
        const firstEpisode = series.seasons[0].episodes[0];
        if (firstEpisode.thumbnail) {
          const thumbnailName = firstEpisode.thumbnail.split('\\').pop().split('/').pop();
          posterSrc = `data/thumbnails/${thumbnailName}`;
          console.log('📸 Chargement du poster série depuis thumbnail:', posterSrc);
        }
      }
      // Priorité 3: Image par défaut (déjà définie ci-dessus)

      // IMPORTANT: Définir l'handler d'erreur AVANT de charger l'image
      posterElement.onerror = () => {
        console.log('❌ Erreur de chargement du poster, utilisation du placeholder');
        posterElement.src = defaultSeriesPoster;
        posterElement.onerror = null;
      };
      posterElement.src = posterSrc;
      posterElement.alt = series.name;
    }

    // Afficher les tags
    this.displayTags(series);

    // Afficher les crédits
    this.displayCredits(series);

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

  displayCredits(series) {
    // Créateur
    const directorSection = document.getElementById('series-director-section');
    const directorName = document.getElementById('series-director-name');
    if (series.creator && series.creator.trim()) {
      directorName.textContent = series.creator;
      directorSection.style.display = 'flex';
    } else {
      directorSection.style.display = 'none';
    }

    // Acteurs principaux
    const actorsSection = document.getElementById('series-actors-section');
    const actorsList = document.getElementById('series-actors-list');
    if (series.actors && series.actors.length > 0) {
      const actorsText = series.actors.slice(0, 3).join(', ');
      actorsList.textContent = actorsText;
      actorsSection.style.display = 'flex';
    } else {
      actorsSection.style.display = 'none';
    }

    // Plateforme
    const platformSection = document.getElementById('series-platform-section');
    const platformName = document.getElementById('series-platform-name');
    if (series.platform && series.platform.trim()) {
      platformName.textContent = series.platform;
      platformSection.style.display = 'flex';
    } else {
      platformSection.style.display = 'none';
    }
  }

  displayTechnicalInfo(series) {
    // Qualité vidéo
    const techQuality = document.getElementById('series-tech-quality');
    const techQualityValue = document.getElementById('series-tech-quality-value');
    if (series.videoQuality) {
      techQualityValue.textContent = series.videoQuality;
      techQuality.style.display = 'flex';
    } else {
      techQuality.style.display = 'none';
    }

    // Nombre de saisons
    const techSeasons = document.getElementById('series-tech-seasons');
    const techSeasonsValue = document.getElementById('series-tech-seasons-value');
    if (series.seasons && series.seasons.length > 0) {
      techSeasonsValue.textContent = `${series.seasons.length} saison${series.seasons.length > 1 ? 's' : ''}`;
      techSeasons.style.display = 'flex';
    } else {
      techSeasons.style.display = 'none';
    }

    // Date d'ajout
    const techDateAdded = document.getElementById('series-tech-date-added');
    const techDateAddedValue = document.getElementById('series-tech-date-added-value');
    if (series.dateAdded) {
      const date = new Date(series.dateAdded);
      techDateAddedValue.textContent = date.toLocaleDateString('fr-FR');
      techDateAdded.style.display = 'flex';
    } else {
      techDateAdded.style.display = 'none';
    }
  }

  displayViewingStats(series) {
    // Statistiques de visionnage (à implémenter avec les données réelles)
    const statWatchCount = document.getElementById('series-stat-watch-count');
    const statLastWatched = document.getElementById('series-stat-last-watched');
    const statRating = document.getElementById('series-stat-rating-personal');

    // Pour l'instant, masquer ces sections
    if (statWatchCount) statWatchCount.style.display = 'none';
    if (statLastWatched) statLastWatched.style.display = 'none';
    if (statRating) statRating.style.display = 'none';
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
        thumbnail.src = `data/thumbnails/${thumbnailName}`;
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

  playEpisode(episode) {
    console.log('🎬 Lecture de l\'épisode:', episode.title);

    if (!episode.path) {
      console.error('❌ Chemin de l\'épisode manquant');
      alert('Impossible de lire l\'épisode : chemin du fichier manquant');
      return;
    }

    // Fermer la modale et lancer la lecture
    this.hide();

    const title = episode.title || 'Épisode sans titre';

    // Utiliser le système de lecture existant
    // Les paramètres sont : (episodeId, title, path)
    if (window.openVideoPlayer) {
      window.openVideoPlayer(episode.id, title, episode.path);
    } else {
      console.error('❌ Fonction de lecture vidéo non trouvée');
      alert('Impossible de lire l\'épisode : lecteur vidéo non disponible');
    }
  }

  playFirstEpisode() {
    if (!this.currentSeries || !this.currentSeries.seasons) return;

    // Collecter tous les épisodes triés (qui ont un episode_number)
    const sortedEpisodes = [];

    for (const season of this.currentSeries.seasons) {
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
      console.warn('⚠️ Aucun épisode trié disponible pour la série:', this.currentSeries.name);
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
    this.playEpisode(firstEpisode);
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
