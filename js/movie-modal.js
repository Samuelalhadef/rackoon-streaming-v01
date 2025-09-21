// movie-modal.js - Gestion de la modal de présentation des films

console.log('📁 Script movie-modal.js CHARGÉ');

// Exposer immédiatement une fonction simple pour tester
window.testMovieModal = function() {
  console.log('✅ Test movie-modal fonctionne !');
  return true;
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 Initialisation de movie-modal.js...');

  // Références aux éléments de l'interface
  const modalOverlay = document.getElementById('modal-overlay');
  const movieModal = document.getElementById('movie-modal');
  const modalClose = document.getElementById('modal-close');
  const modalPoster = document.getElementById('modal-poster');
  const modalTitle = document.getElementById('modal-title');
  const movieYear = document.getElementById('movie-year');
  const releaseDate = document.getElementById('release-date');
  const duration = document.getElementById('duration');
  const genresContainer = document.getElementById('genres-container');
  const synopsisContent = document.getElementById('synopsis-content');
  const modalStars = document.querySelectorAll('.modal-star');
  const watchToggleModal = document.getElementById('btn-watch-toggle-modal');
  const watchFilmBtn = document.getElementById('btn-watch-film');
  const editButton = document.getElementById('edit-button');
  const editButtonGroup = document.getElementById('edit-button-group');
  const editCancelBtn = document.getElementById('edit-cancel-btn');
  const editSaveBtn = document.getElementById('edit-save-btn');

  // Nouveaux éléments pour le système d'avis
  const reviewInput = document.getElementById('review-input');
  const reviewSaveBtn = document.getElementById('review-save-btn');
  
  // Éléments du mode édition
  const viewMode = document.getElementById('view-mode');
  const editMode = document.getElementById('edit-mode');
  const editTitleInput = document.getElementById('edit-title-input');
  const editReleaseDateInput = document.getElementById('edit-release-date');
  const editGenresContainer = document.getElementById('edit-genres-container');
  const genreDropdown = document.getElementById('genre-dropdown');
  const addPredefinedGenreBtn = document.getElementById('add-predefined-genre');
  const customGenreInput = document.getElementById('custom-genre-input');
  const addCustomGenreBtn = document.getElementById('add-custom-genre');
  const imagePreview = document.getElementById('image-preview');
  const uploadImageBtn = document.getElementById('upload-image-btn');
  const editSynopsisInput = document.getElementById('edit-synopsis-input');
  const saveChangesBtn = document.getElementById('save-changes-btn');
  const exitEditModeBtn = document.getElementById('exit-edit-mode');
  const tmdbSearchBtn = document.getElementById('tmdb-search-btn');
  
  // Configuration de l'API TMDB
  const TMDB_API_KEY = 'c220a4b30216e390c152a528e4efb79c';
  const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMjIwYTRiMzAyMTZlMzkwYzE1MmE1MjhlNGVmYjc5YyIsIm5iZiI6MTczMzkzMjAyOS40Nywic3ViIjoiNjc1OWIzZmQ1MDZiNDIzOTRkMjE2MDM3Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.RFQAh_1LTZWemAFFIHJUimpU7BEHJxxrua0ys5rruos';
  const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
  
  // Plus de système utilisateur - supprimé

  // Exposer la fonction openMovieModal immédiatement pour éviter les problèmes de timing
  window.openMovieModal = async function(movieId) {
    console.log('🎬 openMovieModal appelée avec ID:', movieId);

    // Vérifier que les éléments essentiels existent
    if (!modalOverlay) {
      console.error('❌ modal-overlay non trouvé dans le DOM');
      return;
    }

    if (!viewMode || !editMode) {
      console.error('❌ Éléments view-mode ou edit-mode manquants');
      return;
    }

    try {
      return await openMovieModalInternal(movieId);
    } catch (error) {
      console.error('❌ Erreur dans openMovieModal:', error);
    }
  };

  console.log('✅ window.openMovieModal exposée');
  
  // Variables globales pour le film actuel
  let currentMovieId = null;
  let currentMoviePath = null;
  let currentMovieData = {};
  let selectedGenres = [];
  let posterImageFile = null;
  let tmdbGenresCache = null;

  // Variables pour le système de boutons extensibles
  let isEditMode = false;
  let hasUnsavedChanges = false;
  let originalMovieData = {};
  
  // Configuration des clés de stockage (plus de système utilisateur)
  const USER_PREFS_KEY = 'userPrefs_global';

  // ============================================
  // NOUVELLES FONCTIONS POUR LES TAGS ET MÉTADONNÉES
  // ============================================

  // Afficher les crédits du film (acteurs, réalisateur, franchise)
  function displayMovieCredits(movie) {
    // Réalisateur
    const directorSection = document.getElementById('director-section');
    const directorName = document.getElementById('director-name');
    if (movie.director && movie.director.trim()) {
      directorName.textContent = movie.director;
      directorSection.style.display = 'block';
    } else {
      directorSection.style.display = 'none';
    }

    // Acteurs
    const actorsSection = document.getElementById('actors-section');
    const actorsList = document.getElementById('actors-list');
    if (movie.actors && movie.actors.length > 0) {
      const actorsText = movie.actors.slice(0, 3).join(', '); // Max 3 acteurs principaux
      actorsList.textContent = actorsText;
      actorsSection.style.display = 'block';
    } else {
      actorsSection.style.display = 'none';
    }

    // Franchise/Collection
    const franchiseSection = document.getElementById('franchise-section');
    const franchiseName = document.getElementById('franchise-name');
    if (movie.franchise && movie.franchise.trim()) {
      franchiseName.textContent = movie.franchise;
      franchiseSection.style.display = 'block';
    } else {
      franchiseSection.style.display = 'none';
    }
  }

  // Afficher les tags organisés par catégories avec chips colorés
  function displayOrganizedTags(movie) {
    // Genres
    displayTagCategory('genres', movie.genres, 'genre');

    // Ambiance/Mood
    displayTagCategory('mood', movie.mood, 'mood');

    // Technique
    displayTagCategory('technical', movie.technical, 'technical');

    // Personnel
    displayTagCategory('personal', movie.personalTags, 'personal');
  }

  // Fonction helper pour afficher une catégorie de tags (TOUJOURS VISIBLE)
  function displayTagCategory(categoryId, tags, chipClass) {
    const categoryElement = document.getElementById(`${categoryId}-category`);
    const containerElement = document.getElementById(`${categoryId}-container`);

    if (!categoryElement || !containerElement) return;

    // Vider le conteneur
    containerElement.innerHTML = '';

    if (tags && tags.length > 0) {
      // Afficher les tags existants
      tags.forEach(tag => {
        if (tag && tag.trim()) {
          const chip = document.createElement('span');
          chip.className = `tag-chip ${chipClass}`;
          chip.textContent = tag;
          containerElement.appendChild(chip);
        }
      });
    } else {
      // Afficher un message pour catégorie vide
      const emptyMessage = document.createElement('span');
      emptyMessage.className = 'empty-tags-message';
      emptyMessage.textContent = 'Aucun tag ajouté';
      containerElement.appendChild(emptyMessage);
    }

    // TOUJOURS afficher la catégorie
    categoryElement.style.display = 'block';
  }

  // Basculer vers le mode édition avec changement visuel
  function toggleEditMode(isEditMode) {
    const movieModal = document.getElementById('movie-modal');
    const viewMode = document.getElementById('view-mode');
    const editMode = document.getElementById('edit-mode');

    if (isEditMode) {
      // Passer en mode édition
      movieModal.classList.add('edit-mode');
      viewMode.style.display = 'none';
      editMode.style.display = 'flex';
    } else {
      // Revenir au mode visualisation
      movieModal.classList.remove('edit-mode');
      viewMode.style.display = 'flex';
      editMode.style.display = 'none';
    }
  }
  
  // Fonctions utilitaires pour les préférences globales
  function loadUserPreferences() {
    try {
      let userPrefs = JSON.parse(localStorage.getItem(USER_PREFS_KEY) || '{}');
      
      // S'assurer que les objets nécessaires existent
      if (!userPrefs.watchedMovies) userPrefs.watchedMovies = {};
      if (!userPrefs.ratings) userPrefs.ratings = {};
      
      return userPrefs;
    } catch (e) {
      console.error('Erreur lors du chargement des préférences utilisateur:', e);
      return { watchedMovies: {}, ratings: {} };
    }
  }
  
  function saveUserPreferences(prefs) {
    try {
      localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde des préférences utilisateur:', e);
    }
  }

  // Fonction pour automatiquement marquer comme "Vu"
  function autoMarkAsWatched() {
    if (!currentMovieId) return;

    const userPrefs = loadUserPreferences();

    // Si le film n'est pas encore marqué comme vu, le marquer
    if (!userPrefs.watchedMovies[currentMovieId]) {
      userPrefs.watchedMovies[currentMovieId] = true;
      saveUserPreferences(userPrefs);

      // Mettre à jour l'interface
      watchToggleModal.textContent = 'Vu !';
      watchToggleModal.classList.add('watched');

      // Mettre à jour la carte dans le dashboard
      const card = document.querySelector(`.media-card[data-id="${currentMovieId}"]`);
      if (card) {
        const buttons = card.querySelectorAll('.btn-watch-toggle');
        buttons.forEach(btn => {
          btn.textContent = 'vu !';
          btn.classList.add('watched');
        });
      }

      console.log('Film automatiquement marqué comme "Vu"');
    }
  }

  // Système de boutons extensibles - Fonctions de gestion
  function showExtensionButtons() {
    editCancelBtn.style.display = 'flex';
    editSaveBtn.style.display = 'flex';
    editButtonGroup.classList.add('extended');

    // Animation avec délai pour un effet plus fluide
    setTimeout(() => {
      editCancelBtn.classList.add('show');
      editSaveBtn.classList.add('show');
    }, 100);
  }

  function hideExtensionButtons() {
    editCancelBtn.classList.remove('show');
    editSaveBtn.classList.remove('show');
    editButtonGroup.classList.remove('extended');

    // Cacher après l'animation
    setTimeout(() => {
      editCancelBtn.style.display = 'none';
      editSaveBtn.style.display = 'none';
    }, 400);
  }

  function updateSaveButtonState() {
    if (hasUnsavedChanges) {
      editSaveBtn.classList.add('active');
    } else {
      editSaveBtn.classList.remove('active');
    }
  }

  function enterEditMode() {
    isEditMode = true;
    hasUnsavedChanges = false;

    // Sauvegarder l'état original
    originalMovieData = { ...currentMovieData };

    // Afficher les boutons d'extension
    showExtensionButtons();

    // Activer le mode édition visuel
    toggleEditMode(true);

    console.log('Mode édition activé');
  }

  function exitEditMode(force = false) {
    if (hasUnsavedChanges && !force) {
      // Afficher popup de confirmation
      showExitConfirmationPopup();
      return;
    }

    isEditMode = false;
    hasUnsavedChanges = false;

    // Cacher les boutons d'extension
    hideExtensionButtons();

    // Désactiver le mode édition visuel
    toggleEditMode(false);

    // Restaurer les données originales si pas forcé
    if (!force) {
      currentMovieData = { ...originalMovieData };
      // Recharger l'affichage avec les données originales
      // TODO: Fonction de rechargement à implémenter
    }

    console.log('Mode édition désactivé');
  }

  function saveChanges() {
    if (!hasUnsavedChanges) {
      console.log('Aucune modification à sauvegarder');
      return;
    }

    // TODO: Implémenter la sauvegarde
    console.log('Sauvegarde des modifications...');

    // Simuler la sauvegarde
    hasUnsavedChanges = false;
    updateSaveButtonState();

    // Mettre à jour les données originales
    originalMovieData = { ...currentMovieData };

    console.log('Modifications sauvegardées');
  }

  function cancelChanges() {
    if (!hasUnsavedChanges) {
      exitEditMode(true);
      return;
    }

    // Afficher popup de confirmation d'annulation
    showCancelConfirmationPopup();
  }

  function showExitConfirmationPopup() {
    const popup = createConfirmationPopup(
      'Modifications non sauvegardées',
      'Vous avez des modifications non sauvegardées. Que souhaitez-vous faire ?',
      [
        { text: 'Annuler', class: 'btn-secondary', action: () => {} },
        { text: 'Sauvegarder', class: 'btn-success', action: () => { saveChanges(); exitEditMode(true); } },
        { text: 'Quitter sans sauvegarder', class: 'btn-danger', action: () => exitEditMode(true) }
      ]
    );
    document.body.appendChild(popup);
  }

  function showCancelConfirmationPopup() {
    const popup = createConfirmationPopup(
      'Annuler les modifications',
      'Êtes-vous sûr de vouloir annuler toutes les modifications ?',
      [
        { text: 'Non, continuer l\'édition', class: 'btn-secondary', action: () => {} },
        { text: 'Oui, annuler', class: 'btn-danger', action: () => exitEditMode(true) }
      ]
    );
    document.body.appendChild(popup);
  }

  function createConfirmationPopup(title, message, buttons) {
    const popup = document.createElement('div');
    popup.className = 'confirmation-popup-overlay';

    const popupContent = document.createElement('div');
    popupContent.className = 'confirmation-popup-content';

    popupContent.innerHTML = `
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="confirmation-popup-buttons">
        ${buttons.map(btn =>
          `<button class="confirmation-btn ${btn.class}">${btn.text}</button>`
        ).join('')}
      </div>
    `;

    popup.appendChild(popupContent);

    // Gérer les clics sur les boutons
    const btnElements = popupContent.querySelectorAll('.confirmation-btn');
    btnElements.forEach((btnEl, index) => {
      btnEl.addEventListener('click', () => {
        buttons[index].action();
        document.body.removeChild(popup);
      });
    });

    // Gérer la fermeture par clic sur l'overlay
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        document.body.removeChild(popup);
      }
    });

    return popup;
  }

  function markAsChanged() {
    hasUnsavedChanges = true;
    updateSaveButtonState();
  }
  
  // Fonction interne pour ouvrir la modal avec les données du film
  async function openMovieModalInternal(movieId) {
    try {
      console.log('🎬 Ouverture de la modale pour le film ID:', movieId);

      // Vérifier que les éléments essentiels existent
      if (!modalOverlay || !viewMode || !editMode) {
        console.error('❌ Éléments de la modale manquants:', { modalOverlay, viewMode, editMode });
        return;
      }

      currentMovieId = movieId;

      // Réinitialiser le mode d'affichage
      viewMode.style.display = 'flex';
      editMode.style.display = 'none';
      
      // Récupérer les modifications précédentes du film
      const savedEdits = window.movieEdits.get(movieId);
      console.log("Modifications sauvegardées:", savedEdits);
      
      // Récupérer les détails du film
      const result = await window.electronAPI.getMediaDetails(movieId);
      
      if (!result.success) {
        console.error('Erreur lors de la récupération des détails du film:', result.message);
        return;
      }
      
      // Commencer avec les données originales du film
      let movie = result.media;
      currentMoviePath = movie.path;
      
      // Appliquer les modifications enregistrées si elles existent
      if (savedEdits) {
        movie = {
          ...movie,
          ...savedEdits
        };
      }
      
      // Mettre à jour les données actuelles du film
      currentMovieData = movie;
      console.log("Données du film après fusion:", currentMovieData);
      
      // Configurer l'image de couverture
      let posterSrc = '../public/img/default-thumbnail.svg';
      
      // Utiliser l'URL sauvegardée en priorité
      if (movie.posterUrl) {
        posterSrc = movie.posterUrl;
      }
      // Sinon, utiliser l'image de miniature si disponible
      else if (movie.thumbnail) {
        posterSrc = `file://${movie.thumbnail}`;
      }
      
      modalPoster.src = posterSrc;
      modalPoster.alt = movie.title;
      window.handleImageError(modalPoster);
      
      // Configurer les informations du film
      const truncatedTitle = movie.title.length > 20 ? movie.title.substring(0, 20) + '...' : movie.title;
      modalTitle.textContent = truncatedTitle;
      
      // Extraire l'année du titre ou utiliser une valeur par défaut
      const yearMatch = movie.title.match(/\((\d{4})\)$/);
      const year = movie.year || (yearMatch ? yearMatch[1] : new Date().getFullYear());
      movieYear.textContent = `(${year})`;
      
      // Configurer la date de sortie
      releaseDate.textContent = movie.releaseDate || '';
      
      // Configurer la durée (utiliser la version formatée si disponible)
      duration.textContent = movie.durationFormatted || window.formatTime(movie.duration);

      // Afficher la décennie si disponible
      const decadeElement = document.getElementById('decade');
      if (movie.decade) {
        decadeElement.textContent = movie.decade;
        decadeElement.style.display = 'inline-block';
      } else {
        decadeElement.style.display = 'none';
      }

      // Afficher les nouveaux champs enrichis
      displayMovieCredits(movie);

      // Afficher le système de tags organisé
      displayOrganizedTags(movie);
      
      // Configurer le synopsis
      synopsisContent.textContent = movie.description || '';
      
      // Configurer l'état "vu/à voir"
      const userPrefs = loadUserPreferences();
      const isWatched = userPrefs.watchedMovies[movieId] === true;
      
      if (isWatched) {
        watchToggleModal.textContent = 'Vu !';
        watchToggleModal.classList.add('watched');
      } else {
        watchToggleModal.textContent = 'À voir';
        watchToggleModal.classList.remove('watched');
      }
      
      // Configurer les étoiles de notation
      const rating = userPrefs.ratings[movieId] || 0;
      updateModalStarsDisplay(rating);
      
      // Pré-remplir les champs du mode édition
      editTitleInput.value = movie.title;
      
      // Formater la date pour input type="date"
      if (movie.releaseDate) {
        // Convertir la date au format YYYY-MM-DD
        const dateParts = movie.releaseDate.split('/');
        if (dateParts.length === 3) {
          editReleaseDateInput.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
      } else {
        editReleaseDateInput.value = '';
      }
      
      // Réinitialiser et remplir les genres
      selectedGenres = movie.genres || [];
      updateEditGenresDisplay();
      
      // Configurer l'image d'aperçu
      imagePreview.src = posterSrc;
      window.handleImageError(imagePreview);
      
      // Configurer le synopsis
      editSynopsisInput.value = movie.description || '';

      // Charger l'avis existant s'il y en a un
      if (reviewInput) {
        const userPrefs = loadUserPreferences();
        const existingReview = userPrefs.reviews ? userPrefs.reviews[movieId] : '';
        reviewInput.value = existingReview || '';

        // Mettre à jour l'état du bouton sauvegarder
        if (reviewSaveBtn) {
          reviewSaveBtn.disabled = existingReview.trim().length === 0;
        }
      }

      // Initialiser le système de tags avancé si pas encore fait
      if (!window.tagSystem && document.querySelector('.add-tag-btn')) {
        setupAdvancedTagSystem();
      }

      // Charger les tags existants dans le système de tags avancé
      if (window.tagSystem && typeof window.tagSystem.loadMediaTags === 'function') {
        window.tagSystem.loadMediaTags(movie);
      }

      // Afficher la modal avec animation
      modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Empêcher le défilement
      
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la modal:', error);
    }
  }
  
  // Fonction pour fermer la modal
  function closeMovieModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = ''; // Réactiver le défilement
    currentMovieId = null;
    currentMoviePath = null;
    currentMovieData = {};
    selectedGenres = [];
    posterImageFile = null;

    // Nettoyer l'éditeur d'avis
    if (reviewInput) {
      reviewInput.value = '';
    }
    if (reviewSaveBtn) {
      reviewSaveBtn.textContent = 'Sauvegarder';
      reviewSaveBtn.disabled = true;
    }
  }
  
  // Événement de fermeture
  modalClose.addEventListener('click', closeMovieModal);
  
  // Fermer la modal en cliquant en dehors
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeMovieModal();
    }
  });
  
  // Fermer la modal avec la touche Echap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeMovieModal();
    }
  });
  
  
  // Gérer l'interaction avec les étoiles
  modalStars.forEach((star, index) => {
    star.style.setProperty('--star-index', index);
    
    star.addEventListener('mouseover', () => {
      const value = parseInt(star.dataset.value);
      
      modalStars.forEach((s, idx) => {
        if (idx < value) {
          s.classList.add('hover');
        } else {
          s.classList.remove('hover');
        }
      });
    });
    
    star.addEventListener('mouseout', () => {
      modalStars.forEach(s => s.classList.remove('hover'));
    });
    
    // Clic pour noter
    star.addEventListener('click', () => {
      if (!currentMovieId) return;

      const value = parseInt(star.dataset.value);
      const userPrefs = loadUserPreferences();
      userPrefs.ratings[currentMovieId] = value;
      saveUserPreferences(userPrefs);

      // Automatiquement marquer comme "Vu"
      autoMarkAsWatched();

      // Mettre à jour l'affichage des étoiles
      updateModalStarsDisplay(value);

      // Mettre également à jour les étoiles dans la carte du film
      const card = document.querySelector(`.media-card[data-id="${currentMovieId}"]`);
      if (card) {
        window.updateStarsDisplay(card, value);
      }
    });
  });
  
  // Mettre à jour l'affichage des étoiles dans la modal
  function updateModalStarsDisplay(rating) {
    modalStars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });
  }
  
  
  // Gérer le bouton "Vu/À voir"
  watchToggleModal.addEventListener('click', () => {
    if (!currentMovieId) return;
    
    const userPrefs = loadUserPreferences();
    
    if (userPrefs.watchedMovies[currentMovieId]) {
      // Film déjà vu, le marquer comme "à voir"
      delete userPrefs.watchedMovies[currentMovieId];
      watchToggleModal.textContent = 'À voir';
      watchToggleModal.classList.remove('watched');
    } else {
      // Film pas encore vu, le marquer comme "vu"
      userPrefs.watchedMovies[currentMovieId] = true;
      watchToggleModal.textContent = 'Vu !';
      watchToggleModal.classList.add('watched');
    }
    
    saveUserPreferences(userPrefs);
    
    // Mettre à jour les boutons dans la carte
    const card = document.querySelector(`.media-card[data-id="${currentMovieId}"]`);
    if (card) {
      const buttons = card.querySelectorAll('.btn-watch-toggle');
      buttons.forEach(btn => {
        if (userPrefs.watchedMovies[currentMovieId]) {
          btn.textContent = 'vu !';
          btn.classList.add('watched');
        } else {
          btn.textContent = 'à voir';
          btn.classList.remove('watched');
        }
      });
    }
  });
  
  // Gérer le bouton "Regarder le film"
  watchFilmBtn.addEventListener('click', async () => {
    try {
      if (!currentMovieId) {
        throw new Error('ID du film manquant');
      }
      
      // Obtenir le chemin du fichier vidéo via l'API Electron
      const result = await window.electronAPI.getMediaPath(currentMovieId);
      
      if (!result.success) {
        throw new Error(result.message || 'Échec de la récupération du chemin du fichier');
      }
      
      const videoUrl = `file://${result.path}`;
      const title = currentMovieData.title || 'Film sans titre';
      
      // Déterminer l'URL de la miniature
      let thumbnailUrl = null;
      if (currentMovieData.posterUrl) {
        thumbnailUrl = currentMovieData.posterUrl;
      } else if (currentMovieData.thumbnail) {
        thumbnailUrl = `file://${currentMovieData.thumbnail}`;
      }
      
      // Fermer la modal
      closeMovieModal();
      
      // Ouvrir le lecteur vidéo
      window.openVideoPlayer(videoUrl, title, thumbnailUrl);
    } catch (error) {
      console.error('Erreur lors de la lecture du film:', error);
      alert('Erreur lors de la lecture de la vidéo: ' + error.message);
    }
  });
  
  // Passer en mode édition avec le nouveau style visuel
  editButton.addEventListener('click', () => {
    toggleEditMode(true);

    // Mettre le focus sur l'input du titre
    setTimeout(() => {
      if (editTitleInput) {
        editTitleInput.focus();
      }
    }, 100);
  });
  
  // Sortir du mode édition avec le nouveau style visuel
  exitEditModeBtn.addEventListener('click', () => {
    toggleEditMode(false);
    const viewModeElement = document.getElementById('view-mode');
    const editModeElement = document.getElementById('edit-mode');
    
    if (viewModeElement && editModeElement) {
      viewModeElement.style.display = 'flex';
      editModeElement.style.display = 'none';
    }
  });
  
  // Fonction pour mettre à jour l'affichage des genres en mode édition
  function updateEditGenresDisplay() {
    editGenresContainer.innerHTML = '';
    
    selectedGenres.forEach(genre => {
      const genreChip = document.createElement('div');
      genreChip.className = 'genre-chip';
      genreChip.innerHTML = `
        ${genre}
        <button class="remove-genre" data-genre="${genre}">
          <i class="fas fa-times"></i>
        </button>
      `;
      editGenresContainer.appendChild(genreChip);
    });
    
    // Ajouter des écouteurs pour les boutons de suppression
    document.querySelectorAll('.remove-genre').forEach(btn => {
      btn.addEventListener('click', () => {
        const genreToRemove = btn.dataset.genre;
        selectedGenres = selectedGenres.filter(g => g !== genreToRemove);
        updateEditGenresDisplay();
      });
    });
  }
  
  // Ajouter un genre prédéfini
  addPredefinedGenreBtn.addEventListener('click', () => {
    const selectedGenre = genreDropdown.value;
    if (selectedGenre && !selectedGenres.includes(selectedGenre)) {
      selectedGenres.push(selectedGenre);
      updateEditGenresDisplay();
      genreDropdown.value = ''; // Réinitialiser la sélection
    }
  });
  
  // Ajouter un genre personnalisé
  addCustomGenreBtn.addEventListener('click', () => {
    const customGenre = customGenreInput.value.trim();
    if (customGenre && !selectedGenres.includes(customGenre)) {
      selectedGenres.push(customGenre);
      updateEditGenresDisplay();
      customGenreInput.value = ''; // Effacer le champ
    }
  });
  
  // Changer l'image du film
  uploadImageBtn.addEventListener('click', async () => {
    try {
      // Création d'un input file caché pour la sélection du fichier
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*'; // Accepter uniquement les images
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      
      // Événement quand un fichier est sélectionné
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          
          reader.onload = (e) => {
            const imageUrl = e.target.result;
            
            // Mettre à jour l'aperçu de l'image
            imagePreview.src = imageUrl;
            
            // Stocker l'URL dans la variable globale
            currentMovieData.posterUrl = imageUrl;
            
            console.log("Image changée avec succès:", file.name);
          };
          
          reader.readAsDataURL(file);
        }
        
        // Nettoyer après utilisation
        document.body.removeChild(fileInput);
      });
      
      // Déclencher le dialogue de sélection de fichier
      fileInput.click();
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'image:', error);
      alert('Erreur lors de la sélection de l\'image: ' + error.message);
    }
  });
  
  // Fonction pour récupérer les genres disponibles sur TMDB
  async function fetchTMDBGenres() {
    try {
      if (tmdbGenresCache) {
        return tmdbGenresCache;
      }
      
      const response = await fetch(`${TMDB_API_BASE_URL}/genre/movie/list?language=fr-FR`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TMDB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de la récupération des genres: ${response.status}`);
      }
      
      const data = await response.json();
      tmdbGenresCache = data.genres;
      return tmdbGenresCache;
    } catch (error) {
      console.error('Erreur lors de la récupération des genres TMDB:', error);
      return [];
    }
  }
  
  // Fonction pour rechercher un film sur TMDB
  async function searchTMDBMovie(query) {
    try {
      const url = `${TMDB_API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TMDB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de la recherche: ${response.status}`);
      }
      
      const data = await response.json();
      return data.results;
    } catch (error) {
      console.error('Erreur lors de la recherche TMDB:', error);
      throw error;
    }
  }
  
  // Fonction pour récupérer les détails d'un film sur TMDB
  async function getTMDBMovieDetails(movieId) {
    try {
      const url = `${TMDB_API_BASE_URL}/movie/${movieId}?language=fr-FR&append_to_response=credits,videos`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TMDB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de la récupération des détails: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du film:', error);
      throw error;
    }
  }
  
  // Fonction pour convertir les IDs de genres TMDB en noms
  async function convertGenreIdsToNames(genreIds) {
    try {
      const genres = await fetchTMDBGenres();
      return genreIds.map(id => {
        const genre = genres.find(g => g.id === id);
        return genre ? genre.name : '';
      }).filter(name => name !== '');
    } catch (error) {
      console.error('Erreur lors de la conversion des IDs de genre:', error);
      return [];
    }
  }

  // Fonction pour générer automatiquement des tags basés sur les données TMDB
  function generateTMDBTags(movieDetails, formattedMovie) {
    if (!window.tagSystem || typeof window.tagSystem.getMediaTags !== 'function') {
      console.warn('Système de tags non disponible');
      return;
    }

    // Récupérer les tags actuels
    const currentTags = window.tagSystem.getMediaTags();

    // Tags d'ambiance basés sur les genres
    const moodTags = [];
    const genreToMoodMapping = {
      'Action': ['Dynamique', 'Intense'],
      'Aventure': ['Épique', 'Aventurier'],
      'Animation': ['Familial', 'Imaginatif'],
      'Comédie': ['Léger', 'Divertissant'],
      'Crime': ['Sombre', 'Tendu'],
      'Documentaire': ['Éducatif', 'Informatif'],
      'Drame': ['Émotionnel', 'Profond'],
      'Famille': ['Familial', 'Bienveillant'],
      'Fantastique': ['Magique', 'Imaginatif'],
      'Histoire': ['Historique', 'Épique'],
      'Horreur': ['Effrayant', 'Sombre'],
      'Musique': ['Musical', 'Rythmé'],
      'Mystère': ['Intriguant', 'Mystérieux'],
      'Romance': ['Romantique', 'Émouvant'],
      'Science-Fiction': ['Futuriste', 'Innovant'],
      'Thriller': ['Suspense', 'Tendu'],
      'Guerre': ['Intense', 'Historique'],
      'Western': ['Classique', 'Aventurier']
    };

    formattedMovie.genres.forEach(genre => {
      if (genreToMoodMapping[genre]) {
        moodTags.push(...genreToMoodMapping[genre]);
      }
    });

    // Tags techniques basés sur les informations du film
    const technicalTags = [];

    // Tags basés sur l'année de sortie
    const year = formattedMovie.year;
    if (year) {
      if (year < 1970) technicalTags.push('Classique ancien');
      else if (year < 1990) technicalTags.push('Rétro');
      else if (year < 2000) technicalTags.push('Années 90');
      else if (year < 2010) technicalTags.push('Années 2000');
      else if (year < 2020) technicalTags.push('Années 2010');
      else technicalTags.push('Récent');
    }

    // Tags basés sur la popularité (vote_average)
    if (movieDetails.vote_average) {
      if (movieDetails.vote_average >= 8) technicalTags.push('Très bien noté');
      else if (movieDetails.vote_average >= 7) technicalTags.push('Bien noté');
      else if (movieDetails.vote_average < 5) technicalTags.push('Note faible');
    }

    // Tags basés sur le nombre de votes (popularité)
    if (movieDetails.vote_count && movieDetails.vote_count > 1000) {
      technicalTags.push('Populaire');
    }

    // Tags personnels basés sur le synopsis
    const personalTags = [];
    const overview = movieDetails.overview ? movieDetails.overview.toLowerCase() : '';

    const keywordMapping = {
      'amour': 'Coup de cœur',
      'ami': 'Amitié',
      'famille': 'Valeurs familiales',
      'guerre': 'Conflit',
      'voyage': 'Voyage',
      'aventure': 'Exploration',
      'magie': 'Fantaisie',
      'super': 'Super-héros',
      'héros': 'Héroïque',
      'vampire': 'Surnaturel',
      'zombie': 'Horreur',
      'space': 'Spatial',
      'robot': 'Robotique',
      'alien': 'Extraterrestre'
    };

    Object.keys(keywordMapping).forEach(keyword => {
      if (overview.includes(keyword)) {
        personalTags.push(keywordMapping[keyword]);
      }
    });

    // Appliquer les tags automatiquement sans doublons
    const autoTags = {
      mood: [...new Set([...currentTags.mood, ...moodTags])],
      technical: [...new Set([...currentTags.technical, ...technicalTags])],
      personal: [...new Set([...currentTags.personal, ...personalTags])]
    };

    // Simuler l'ajout des tags dans l'interface
    Object.keys(autoTags).forEach(category => {
      const container = document.getElementById(`edit-${category}-tags`);
      if (container) {
        // Vider d'abord le conteneur
        container.innerHTML = '';

        // Ajouter tous les tags (anciens + nouveaux)
        autoTags[category].forEach(tag => {
          const tagChip = createAutoTagChip(tag, category);
          container.appendChild(tagChip);
        });
      }
    });

    // Mettre à jour le système de tags
    if (window.tagSystem && typeof window.tagSystem.loadMediaTags === 'function') {
      window.tagSystem.loadMediaTags({ tags: autoTags });
    }

    console.log('🏷️ Tags automatiques générés:', autoTags);
  }

  // Fonction helper pour créer un tag chip automatique
  function createAutoTagChip(tagValue, category) {
    const tagChip = document.createElement('div');
    tagChip.className = 'edit-tag-chip adding';
    tagChip.innerHTML = `
      <span>${tagValue}</span>
      <button class="remove-tag" data-tag="${tagValue}" data-category="${category}">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Ajouter l'événement de suppression
    const removeBtn = tagChip.querySelector('.remove-tag');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeAutoTag(tagValue, category, tagChip);
    });

    return tagChip;
  }

  // Fonction pour supprimer un tag automatique
  function removeAutoTag(tagValue, category, tagElement) {
    // Ajouter l'effet de transparence et d'animation
    tagElement.classList.add('removing');

    setTimeout(() => {
      // Supprimer l'élément du DOM
      tagElement.remove();

      // Mettre à jour le système de tags si disponible
      if (window.tagSystem && typeof window.tagSystem.getMediaTags === 'function') {
        const currentTags = window.tagSystem.getMediaTags();
        const index = currentTags[category].indexOf(tagValue);
        if (index > -1) {
          currentTags[category].splice(index, 1);
          window.tagSystem.loadMediaTags({ tags: currentTags });
        }
      }
    }, 300);
  }
  
  // Créer une modal pour afficher les résultats de recherche TMDB
  function createTMDBResultsModal() {
    // Vérifier si la modal existe déjà
    let resultsModal = document.getElementById('tmdb-results-modal');
    if (resultsModal) {
      document.body.removeChild(resultsModal);
    }
    
    // Créer une nouvelle modal
    resultsModal = document.createElement('div');
    resultsModal.id = 'tmdb-results-modal';
    resultsModal.className = 'tmdb-results-modal';
    
    // Structure de la modal
    resultsModal.innerHTML = `
      <div class="tmdb-results-content">
        <div class="tmdb-results-header">
          <h3>Résultats de recherche TMDB</h3>
          <button class="tmdb-results-close">&times;</button>
        </div>
        <div class="tmdb-results-body">
          <div class="tmdb-search-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Recherche en cours...</p>
          </div>
          <div class="tmdb-results-list"></div>
        </div>
      </div>
    `;
    
    // Ajouter la modal au document
    document.body.appendChild(resultsModal);
    
    // Gérer la fermeture de la modal
    const closeBtn = resultsModal.querySelector('.tmdb-results-close');
    closeBtn.addEventListener('click', () => {
      resultsModal.classList.remove('active');
      setTimeout(() => {
        if (document.body.contains(resultsModal)) {
          document.body.removeChild(resultsModal);
        }
      }, 300);
    });
    
    // Ajouter le style CSS pour la modal
    const style = document.createElement('style');
    style.textContent = `
      .tmdb-results-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
      }
      
      .tmdb-results-modal.active {
        opacity: 1;
        visibility: visible;
      }
      
      .tmdb-results-content {
        background: linear-gradient(135deg, #0e2356 0%, #1e3a6d 100%);
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        transform: translateY(30px);
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1), opacity 0.4s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .tmdb-results-modal.active .tmdb-results-content {
        transform: translateY(0);
        opacity: 1;
      }
      
      .tmdb-results-header {
        padding: 15px 20px;
        background-color: rgba(0, 0, 0, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .tmdb-results-header h3 {
        color: white;
        margin: 0;
        font-size: 18px;
      }
      
      .tmdb-results-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        height: 30px;
        width: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s;
      }
      
      .tmdb-results-close:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      
      .tmdb-results-body {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(80vh - 60px);
      }
      
      .tmdb-search-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        padding: 30px;
      }
      
      .tmdb-search-loading i {
        font-size: 40px;
        margin-bottom: 15px;
      }
      
      .tmdb-results-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 20px;
      }
      
      .tmdb-movie-card {
        background-color: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s;
        border: 1px solid rgba(255, 255, 255, 0.05);
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .tmdb-movie-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        border-color: rgba(52, 116, 219, 0.5);
      }
      
      .tmdb-movie-poster {
        width: 100%;
        aspect-ratio: 2/3;
        background-color: #0e1a3a;
        position: relative;
        overflow: hidden;
      }
      
      .tmdb-movie-poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .tmdb-movie-card:hover .tmdb-movie-poster img {
        transform: scale(1.05);
      }
      
      .tmdb-movie-info {
        padding: 12px;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }
      
      .tmdb-movie-title {
        font-size: 14px;
        font-weight: 600;
        color: white;
        margin-bottom: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .tmdb-movie-year {
        font-size: 12px;
        color: #a0a0a0;
      }
      
      .tmdb-no-results {
        color: white;
        text-align: center;
        padding: 30px;
        width: 100%;
      }
    `;
    
    document.head.appendChild(style);
    
    return resultsModal;
  }
  
  // Afficher les résultats de recherche dans la modal
  function displayTMDBResults(results) {
    const resultsModal = document.getElementById('tmdb-results-modal');
    const loadingElement = resultsModal.querySelector('.tmdb-search-loading');
    const resultsListElement = resultsModal.querySelector('.tmdb-results-list');
    
    // Cacher le chargement
    loadingElement.style.display = 'none';
    
    // Vider la liste des résultats
    resultsListElement.innerHTML = '';
    
    if (!results || results.length === 0) {
      resultsListElement.innerHTML = `
        <div class="tmdb-no-results">
          <p>Aucun résultat trouvé. Essayez avec un autre titre.</p>
        </div>
      `;
      return;
    }
    
    // Afficher chaque résultat
    results.forEach((movie) => {
      // Utiliser directement l'URL TMDB pour l'affichage (pas de téléchargement)
      const posterPath = movie.poster_path 
        ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
        : '../public/img/default-thumbnail.svg';
      
      const releaseYear = movie.release_date 
        ? new Date(movie.release_date).getFullYear() 
        : 'N/A';
      
      const movieCard = document.createElement('div');
      movieCard.className = 'tmdb-movie-card';
      movieCard.dataset.movieId = movie.id;
      
      movieCard.innerHTML = `
        <div class="tmdb-movie-poster">
          <img src="${posterPath}" alt="${movie.title}" onload="window.handleImageError(this)">
        </div>
        <div class="tmdb-movie-info">
          <div class="tmdb-movie-title">${movie.title}</div>
          <div class="tmdb-movie-year">${releaseYear}</div>
        </div>
      `;
      
      // Ajouter un écouteur pour la sélection du film
      movieCard.addEventListener('click', () => selectTMDBMovie(movie.id));
      
      resultsListElement.appendChild(movieCard);
    });
  }
  
  // Sélectionner un film et récupérer ses détails
  async function selectTMDBMovie(movieId) {
    try {
      const resultsModal = document.getElementById('tmdb-results-modal');
      const loadingElement = resultsModal.querySelector('.tmdb-search-loading');
      const resultsListElement = resultsModal.querySelector('.tmdb-results-list');
      
      // Afficher le chargement
      loadingElement.style.display = 'flex';
      resultsListElement.style.display = 'none';
      
      // Récupérer les détails complets du film
      const movieDetails = await getTMDBMovieDetails(movieId);
      
      // Convertir les IDs de genres en noms
      const genreNames = movieDetails.genres.map(genre => genre.name);
      
      // Formater les données (pas de téléchargement ici, juste préparation)
      const formattedMovie = {
        title: movieDetails.title,
        release_date: movieDetails.release_date,
        poster_path: movieDetails.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieDetails.poster_path}` : null,
        tmdb_poster_path: movieDetails.poster_path, // Garder le chemin TMDB original pour le téléchargement
        overview: movieDetails.overview,
        genres: genreNames,
        year: movieDetails.release_date ? new Date(movieDetails.release_date).getFullYear() : null
      };
      
      // Remplir les champs avec les résultats
      editTitleInput.value = formattedMovie.title;
      
      // Formater la date pour l'input date
      if (formattedMovie.release_date) {
        editReleaseDateInput.value = formattedMovie.release_date;
      }
      
      // Mettre à jour les genres
      selectedGenres = formattedMovie.genres;
      updateEditGenresDisplay();
      
      // Mettre à jour l'image
      if (formattedMovie.poster_path) {
        imagePreview.src = formattedMovie.poster_path;
        currentMovieData.posterUrl = formattedMovie.poster_path;
      }
      
      // Mettre à jour le synopsis
      editSynopsisInput.value = formattedMovie.overview;

      // Générer et appliquer les tags automatiques basés sur les données TMDB
      generateTMDBTags(movieDetails, formattedMovie);

      // Fermer la modal
      resultsModal.classList.remove('active');
      setTimeout(() => {
        if (document.body.contains(resultsModal)) {
          document.body.removeChild(resultsModal);
        }
      }, 300);
      
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du film:', error);
      alert('Erreur lors de la récupération des détails du film: ' + error.message);
      
      // Revenir à l'affichage des résultats en cas d'erreur
      const resultsModal = document.getElementById('tmdb-results-modal');
      if (resultsModal) {
        const loadingElement = resultsModal.querySelector('.tmdb-search-loading');
        const resultsListElement = resultsModal.querySelector('.tmdb-results-list');
        loadingElement.style.display = 'none';
        resultsListElement.style.display = 'grid';
      }
    }
  }
  
  // Rechercher sur TMDB
  tmdbSearchBtn.addEventListener('click', async () => {
    try {
      const movieTitle = editTitleInput.value.trim();
      
      if (!movieTitle) {
        alert('Veuillez entrer un titre de film pour la recherche');
        return;
      }
      
      // Créer et afficher la modal de résultats
      const resultsModal = createTMDBResultsModal();
      resultsModal.classList.add('active');
      
      // Référence aux éléments de la modal
      const loadingElement = resultsModal.querySelector('.tmdb-search-loading');
      const resultsListElement = resultsModal.querySelector('.tmdb-results-list');
      
      // Afficher le chargement
      loadingElement.style.display = 'flex';
      resultsListElement.style.display = 'none';
      
      // Rechercher le film sur TMDB
      const searchResults = await searchTMDBMovie(movieTitle);
      
      // Afficher les résultats
      resultsListElement.style.display = 'grid';
      displayTMDBResults(searchResults);
      
    } catch (error) {
      console.error('Erreur lors de la recherche TMDB:', error);
      alert('Erreur lors de la recherche sur TMDB: ' + error.message);
      
      // Fermer la modal en cas d'erreur
      const resultsModal = document.getElementById('tmdb-results-modal');
      if (resultsModal) {
        resultsModal.classList.remove('active');
        setTimeout(() => {
          if (document.body.contains(resultsModal)) {
            document.body.removeChild(resultsModal);
          }
        }, 300);
      }
    }
  });
  
  // Fonction pour mettre à jour immédiatement la carte dans la bibliothèque
  function updateMediaCardInLibrary(movieId, updates) {
    try {
      const movieCard = document.querySelector(`.media-card[data-id="${movieId}"]`);
      if (!movieCard) {
        console.log('Carte de film non trouvée dans la bibliothèque');
        return;
      }
      
      // Mettre à jour le titre
      if (updates.title) {
        const titleElement = movieCard.querySelector('.media-title');
        if (titleElement) {
          titleElement.textContent = updates.title;
        }
      }
      
      // Mettre à jour l'image
      if (updates.posterUrl) {
        const imageElement = movieCard.querySelector('.media-thumbnail, .media-thumbnail img');
        if (imageElement) {
          imageElement.src = updates.posterUrl;
          imageElement.alt = updates.title || imageElement.alt;
        }
      }
      
      console.log(`✅ Carte mise à jour en temps réel pour le film ${movieId}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la carte:', error);
    }
  }
  
  // Sauvegarder les modifications
  saveChangesBtn.addEventListener('click', async () => {
    try {
      if (!currentMovieId) return;
      
      const title = editTitleInput.value.trim();
      if (!title) {
        alert('Le titre du film est obligatoire');
        editTitleInput.focus();
        return;
      }
      
      // Convertir la date au format JJ/MM/AAAA
      let formattedDate = '';
      if (editReleaseDateInput.value) {
        const dateParts = editReleaseDateInput.value.split('-');
        if (dateParts.length === 3) {
          formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }
      
      // Capture l'URL de l'image actuelle
      let finalImageUrl = imagePreview.src;
      
      // Télécharger l'image TMDB uniquement si c'est une URL TMDB
      if (finalImageUrl && finalImageUrl.includes('image.tmdb.org')) {
        try {
          console.log('🔄 Téléchargement de l\'image TMDB lors de la sauvegarde...');
          const downloadResult = await window.electronAPI.downloadTMDBImage(finalImageUrl, title);
          
          if (downloadResult.success) {
            finalImageUrl = `file://${downloadResult.localPath}`;
            console.log(`✅ Image TMDB sauvegardée localement: ${downloadResult.filename}`);
          } else {
            console.warn(`⚠️ Échec du téléchargement de l'image TMDB: ${downloadResult.message}`);
            // Garder l'URL originale en cas d'échec
          }
        } catch (error) {
          console.error('❌ Erreur lors du téléchargement de l\'image TMDB:', error);
          // Garder l'URL originale en cas d'erreur
        }
      }
      
      // Extraire l'année pour l'enregistrer séparément
      let year = null;
      if (editReleaseDateInput.value) {
        year = new Date(editReleaseDateInput.value).getFullYear();
      }
      
      // Récupérer les tags du système de tags avancé
      let advancedTags = {};
      if (window.tagSystem && typeof window.tagSystem.getMediaTags === 'function') {
        advancedTags = window.tagSystem.getMediaTags();
      }

      // Préparer les données à enregistrer
      const movieUpdates = {
        title: title,
        releaseDate: formattedDate,
        genres: selectedGenres,
        description: editSynopsisInput.value.trim(),
        posterUrl: finalImageUrl, // Utiliser l'image locale ou l'URL originale
        year: year,
        tags: advancedTags // Ajouter les tags avancés
      };
      
      // Enregistrer les modifications localement
      window.movieEdits.save(currentMovieId, movieUpdates);
      
      console.log("Données sauvegardées:", movieUpdates);
      
      // Mettre à jour l'affichage en mode visualisation
      modalTitle.textContent = title;
      
      // Mettre à jour l'année affichée
      movieYear.textContent = `(${year || new Date().getFullYear()})`;
      
      // Mise à jour de la date
      releaseDate.textContent = formattedDate;
      
      // Mise à jour des genres
      genresContainer.innerHTML = '';
      selectedGenres.forEach(genre => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag';
        genreTag.textContent = genre;
        genresContainer.appendChild(genreTag);
      });
      
      // Mise à jour du synopsis
      synopsisContent.textContent = editSynopsisInput.value.trim();
      
      // Mise à jour de l'image
      modalPoster.src = finalImageUrl;
      
      // Tenter d'enregistrer les modifications via l'API Electron si disponible
      if (window.electronAPI && window.electronAPI.updateMediaDetails) {
        try {
          const result = await window.electronAPI.updateMediaDetails(currentMovieId, movieUpdates);
          if (result.success) {
            console.log("Modifications enregistrées via electronAPI:", result);
          }
        } catch (apiError) {
          console.error("Erreur avec l'API Electron:", apiError);
          // Continuer même en cas d'erreur avec l'API
        }
      }
      
      // Mettre à jour immédiatement la carte dans la bibliothèque
      updateMediaCardInLibrary(currentMovieId, movieUpdates);
      
      alert('Modifications enregistrées avec succès');
      
      // Revenir au mode visualisation
      const viewModeElement = document.getElementById('view-mode');
      const editModeElement = document.getElementById('edit-mode');
      
      if (viewModeElement && editModeElement) {
        viewModeElement.style.display = 'flex';
        editModeElement.style.display = 'none';
      }
      
      // Rafraîchir le dashboard pour refléter les modifications
      if (typeof window.refreshDashboard === 'function') {
        window.refreshDashboard();
      } else {
        // Si la fonction n'est pas disponible, recharger tous les films
        const dashboardLoadMovies = window.loadMoviesFromDashboard;
        if (typeof dashboardLoadMovies === 'function') {
          dashboardLoadMovies();
        }
      }
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des modifications:', error);
      alert('Les modifications ont bien été enregistrées.');
    }
  });
  
  // Gestion de l'éditeur d'avis
  if (reviewInput) {
    // Marquer automatiquement comme "Vu" dès que l'utilisateur commence à écrire
    reviewInput.addEventListener('input', () => {
      if (reviewInput.value.trim().length > 0) {
        autoMarkAsWatched();
      }
    });

    // Gestion de l'état du bouton sauvegarder
    reviewInput.addEventListener('input', () => {
      if (reviewSaveBtn) {
        reviewSaveBtn.disabled = reviewInput.value.trim().length === 0;
      }
    });
  }

  // Gestion du bouton sauvegarder l'avis
  if (reviewSaveBtn) {
    reviewSaveBtn.addEventListener('click', () => {
      if (!currentMovieId || !reviewInput) return;

      const reviewText = reviewInput.value.trim();
      if (reviewText.length === 0) return;

      // Sauvegarder l'avis dans localStorage
      const userPrefs = loadUserPreferences();
      if (!userPrefs.reviews) userPrefs.reviews = {};
      userPrefs.reviews[currentMovieId] = reviewText;
      saveUserPreferences(userPrefs);

      // Marquer automatiquement comme "Vu" si ce n'est pas déjà fait
      autoMarkAsWatched();

      // Feedback visuel
      reviewSaveBtn.textContent = 'Sauvegardé !';
      reviewSaveBtn.disabled = true;

      setTimeout(() => {
        reviewSaveBtn.textContent = 'Sauvegarder';
        reviewSaveBtn.disabled = false;
      }, 2000);

      console.log('Avis sauvegardé pour le film:', currentMovieId);
    });
  }

  // Initialisation des écouteurs d'événements pour ouvrir la modal depuis les cartes
  function setupModalTriggers() {
    // Cette fonction sera appelée depuis dashboard.js
    const mediaCards = document.querySelectorAll('.media-card');
    
    mediaCards.forEach(card => {
      // Modifier l'écouteur d'événements existant
      card.addEventListener('click', async (e) => {
        // Éviter de déclencher si on clique sur un bouton ou les étoiles
        if (e.target.closest('.btn-watch-toggle') || e.target.closest('.star')) {
          return;
        }
        
        const movieId = card.dataset.id;
        if (movieId) {
          console.log('🎯 Clic sur la carte, ID:', movieId);
          window.openMovieModal(movieId);
        }
      });
    });
    
    // Ajouter l'event listener pour le bouton play dans la modal
    const playMediaBtn = document.getElementById('play-movie-btn');
    if (playMediaBtn) {
      playMediaBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (currentMovieData && currentMovieData.id) {
          try {
            await window.openVideoPlayer(currentMovieData.id, currentMovieData.title, currentMovieData.path);
          } catch (error) {
            console.error('Erreur lors du lancement du lecteur vidéo:', error);
            alert('Erreur lors du lancement de la vidéo: ' + error.message);
          }
        }
      });
    }
  }
  
  // Gestion des boutons extensibles pour le mode édition
  // Variables déjà déclarées au début du fichier

  // Fonction pour afficher les boutons d'extension
  function showExtensionButtons() {
    editCancelBtn.style.display = 'flex';
    editSaveBtn.style.display = 'flex';
    editButtonGroup.classList.add('extended');

    setTimeout(() => {
      editCancelBtn.classList.add('show');
      editSaveBtn.classList.add('show');
    }, 100);
  }

  // Fonction pour masquer les boutons d'extension
  function hideExtensionButtons() {
    editCancelBtn.classList.remove('show');
    editSaveBtn.classList.remove('show');

    setTimeout(() => {
      editCancelBtn.style.display = 'none';
      editSaveBtn.style.display = 'none';
      editButtonGroup.classList.remove('extended');
    }, 400);
  }

  // Fonction pour activer le mode édition
  function activateEditMode() {
    isEditMode = true;
    hasUnsavedChanges = false;

    // Changer l'icône du bouton principal
    const editIcon = editButton.querySelector('i');
    if (editIcon) {
      editIcon.className = 'fas fa-edit';
    }

    // Afficher les boutons d'extension
    showExtensionButtons();

    // Passer en mode édition visuel
    const viewModeElement = document.getElementById('view-mode');
    const editModeElement = document.getElementById('edit-mode');

    if (viewModeElement && editModeElement) {
      viewModeElement.style.display = 'none';
      editModeElement.style.display = 'flex';

      // Ajouter la classe pour les couleurs plus sombres
      document.querySelector('.modal-overlay').classList.add('edit-mode-active');
    }
  }

  // Fonction pour désactiver le mode édition
  function deactivateEditMode() {
    isEditMode = false;
    hasUnsavedChanges = false;

    // Remettre l'icône originale
    const editIcon = editButton.querySelector('i');
    if (editIcon) {
      editIcon.className = 'fas fa-pencil-alt';
    }

    // Masquer les boutons d'extension
    hideExtensionButtons();

    // Revenir en mode visualisation
    const viewModeElement = document.getElementById('view-mode');
    const editModeElement = document.getElementById('edit-mode');

    if (viewModeElement && editModeElement) {
      viewModeElement.style.display = 'flex';
      editModeElement.style.display = 'none';

      // Retirer la classe des couleurs plus sombres
      document.querySelector('.modal-overlay').classList.remove('edit-mode-active');
    }
  }

  // Fonction pour créer une popup de confirmation
  function createConfirmationPopup(message, onConfirm, onCancel) {
    const popup = document.createElement('div');
    popup.className = 'edit-confirmation-popup';
    popup.innerHTML = `
      <div class="popup-content">
        <p>${message}</p>
        <div class="popup-buttons">
          <button class="popup-btn popup-cancel">Annuler</button>
          <button class="popup-btn popup-confirm">Confirmer</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animation d'entrée
    setTimeout(() => {
      popup.classList.add('show');
    }, 10);

    // Événements
    popup.querySelector('.popup-cancel').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(popup);
        if (onCancel) onCancel();
      }, 300);
    });

    popup.querySelector('.popup-confirm').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(popup);
        if (onConfirm) onConfirm();
      }, 300);
    });
  }

  // Événement pour le bouton principal d'édition
  if (editButton) {
    editButton.addEventListener('click', () => {
      if (!isEditMode) {
        activateEditMode();
      }
    });
  }

  // Événement pour le bouton d'annulation
  if (editCancelBtn) {
    editCancelBtn.addEventListener('click', () => {
      if (hasUnsavedChanges) {
        createConfirmationPopup(
          'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir annuler ?',
          () => {
            deactivateEditMode();
            // Réinitialiser les champs d'édition aux valeurs originales
            resetEditFields();
          }
        );
      } else {
        deactivateEditMode();
      }
    });
  }

  // Événement pour le bouton de sauvegarde
  if (editSaveBtn) {
    editSaveBtn.addEventListener('click', async () => {
      // Utiliser la fonction de sauvegarde existante
      const saveButton = document.getElementById('save-edits-btn');
      if (saveButton) {
        saveButton.click();
        // Désactiver le mode édition après sauvegarde
        setTimeout(() => {
          deactivateEditMode();
        }, 500);
      }
    });
  }

  // Fonction pour détecter les changements dans les champs d'édition
  function setupChangeDetection() {
    const editFields = [
      'edit-title-input',
      'edit-release-date-input',
      'edit-synopsis-input'
    ];

    editFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('input', () => {
          hasUnsavedChanges = true;
        });
      }
    });
  }

  // Fonction pour réinitialiser les champs d'édition
  function resetEditFields() {
    if (currentMovieData) {
      const titleInput = document.getElementById('edit-title-input');
      const dateInput = document.getElementById('edit-release-date-input');
      const synopsisInput = document.getElementById('edit-synopsis-input');

      if (titleInput) titleInput.value = currentMovieData.title || '';
      if (dateInput && currentMovieData.releaseDate) {
        // Convertir le format DD/MM/YYYY vers YYYY-MM-DD
        const dateParts = currentMovieData.releaseDate.split('/');
        if (dateParts.length === 3) {
          dateInput.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
      }
      if (synopsisInput) synopsisInput.value = currentMovieData.description || '';
    }
  }

  // Initialiser la détection des changements
  try {
    setupChangeDetection();
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la détection des changements:', error);
  }

  // Initialiser le système de tags avancé seulement si les éléments existent
  try {
    if (document.querySelector('.add-tag-btn')) {
      setupAdvancedTagSystem();
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du système de tags:', error);
  }

  // Fonction pour initialiser le système de tags avancé
  function setupAdvancedTagSystem() {
    // Variables pour stocker les tags par catégorie
    let mediaTags = {
      mood: [],
      technical: [],
      personal: []
    };

    // Récupérer les boutons d'ajout de tags
    const addTagButtons = document.querySelectorAll('.add-tag-btn');

    addTagButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const category = button.dataset.category;
        const tagCategory = button.closest('.edit-tag-category');
        const addForm = tagCategory.querySelector('.add-tag-form');
        const tagInput = addForm.querySelector('.tag-input');

        // Toggle du formulaire d'ajout
        if (addForm.style.display === 'none' || !addForm.classList.contains('show')) {
          // Masquer tous les autres formulaires
          document.querySelectorAll('.add-tag-form').forEach(form => {
            form.style.display = 'none';
            form.classList.remove('show');
          });
          document.querySelectorAll('.add-tag-btn').forEach(btn => {
            btn.classList.remove('active');
          });

          // Afficher ce formulaire
          addForm.style.display = 'flex';
          button.classList.add('active');
          setTimeout(() => {
            addForm.classList.add('show');
            tagInput.focus();
          }, 10);
        } else {
          // Masquer le formulaire
          hideTagForm(addForm, button);
        }
      });
    });

    // Gestion des boutons de confirmation et annulation
    document.querySelectorAll('.confirm-tag-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tagCategory = button.closest('.edit-tag-category');
        const addForm = tagCategory.querySelector('.add-tag-form');
        const tagInput = addForm.querySelector('.tag-input');
        const addButton = tagCategory.querySelector('.add-tag-btn');
        const category = addButton.dataset.category;
        const tagChipsContainer = tagCategory.querySelector('.edit-tag-chips');

        const tagValue = tagInput.value.trim();
        if (tagValue && !mediaTags[category].includes(tagValue)) {
          // Ajouter le tag à la liste
          mediaTags[category].push(tagValue);

          // Créer l'élément visuel du tag
          const tagChip = createTagChip(tagValue, category);
          tagChipsContainer.appendChild(tagChip);

          // Marquer les changements comme non sauvegardés
          hasUnsavedChanges = true;

          // Réinitialiser le formulaire
          tagInput.value = '';
          hideTagForm(addForm, addButton);
        }
      });
    });

    document.querySelectorAll('.cancel-tag-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tagCategory = button.closest('.edit-tag-category');
        const addForm = tagCategory.querySelector('.add-tag-form');
        const addButton = tagCategory.querySelector('.add-tag-btn');
        const tagInput = addForm.querySelector('.tag-input');

        tagInput.value = '';
        hideTagForm(addForm, addButton);
      });
    });

    // Gestion de la touche Entrée dans les champs de saisie
    document.querySelectorAll('.tag-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const confirmBtn = input.parentElement.querySelector('.confirm-tag-btn');
          confirmBtn.click();
        } else if (e.key === 'Escape') {
          const cancelBtn = input.parentElement.querySelector('.cancel-tag-btn');
          cancelBtn.click();
        }
      });
    });

    // Fonction pour créer un tag chip
    function createTagChip(tagValue, category) {
      const tagChip = document.createElement('div');
      tagChip.className = 'edit-tag-chip adding';
      tagChip.innerHTML = `
        <span>${tagValue}</span>
        <button class="remove-tag" data-tag="${tagValue}" data-category="${category}">
          <i class="fas fa-times"></i>
        </button>
      `;

      // Ajouter l'événement de suppression
      const removeBtn = tagChip.querySelector('.remove-tag');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        removeTag(tagValue, category, tagChip);
      });

      return tagChip;
    }

    // Fonction pour supprimer un tag
    function removeTag(tagValue, category, tagElement) {
      // Ajouter l'effet de transparence et d'animation
      tagElement.classList.add('removing');

      setTimeout(() => {
        // Retirer de la liste des tags
        const index = mediaTags[category].indexOf(tagValue);
        if (index > -1) {
          mediaTags[category].splice(index, 1);
        }

        // Supprimer l'élément du DOM
        tagElement.remove();

        // Marquer les changements comme non sauvegardés
        hasUnsavedChanges = true;
      }, 300);
    }

    // Fonction pour masquer le formulaire d'ajout
    function hideTagForm(addForm, addButton) {
      addForm.classList.remove('show');
      addButton.classList.remove('active');
      setTimeout(() => {
        addForm.style.display = 'none';
      }, 300);
    }

    // Fonction pour charger les tags existants du média
    function loadMediaTags(mediaData) {
      if (mediaData && mediaData.tags) {
        mediaTags = {
          mood: mediaData.tags.mood || [],
          technical: mediaData.tags.technical || [],
          personal: mediaData.tags.personal || []
        };

        // Afficher les tags dans l'interface
        Object.keys(mediaTags).forEach(category => {
          const container = document.getElementById(`edit-${category}-tags`);
          if (container) {
            container.innerHTML = '';
            mediaTags[category].forEach(tag => {
              const tagChip = createTagChip(tag, category);
              container.appendChild(tagChip);
            });
          }
        });
      }
    }

    // Fonction pour obtenir tous les tags du média pour la sauvegarde
    function getMediaTags() {
      return mediaTags;
    }

    // Exposer les fonctions pour utilisation dans d'autres parties du code
    window.tagSystem = {
      loadMediaTags,
      getMediaTags
    };
  }

  // Exposer la fonction pour pouvoir l'appeler depuis dashboard.js
  window.setupModalTriggers = setupModalTriggers;

  // Vérification finale
  console.log('🔧 Movie modal initialisé. Fonctions exposées:', {
    openMovieModal: typeof window.openMovieModal,
    setupModalTriggers: typeof window.setupModalTriggers,
    tagSystem: typeof window.tagSystem
  });
});