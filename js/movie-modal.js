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

  // Debug: Vérifier que tous les éléments sont trouvés
  console.log('🔍 Éléments de boutons extensibles:');
  console.log('  - editButton:', !!editButton);
  console.log('  - editButtonGroup:', !!editButtonGroup);
  console.log('  - editCancelBtn:', !!editCancelBtn);
  console.log('  - editSaveBtn:', !!editSaveBtn);

  // Nouveaux éléments pour le système d'avis
  const reviewInput = document.getElementById('review-input');
  const reviewSaveBtn = document.getElementById('review-save-btn');
  
  // Éléments du mode édition
  const viewMode = document.getElementById('view-mode');
  // const editMode = document.getElementById('edit-mode'); // SUPPRIMÉ - plus utilisé
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

    if (!viewMode) {
      console.error('❌ Élément view-mode manquant');
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
  // FONCTION SUPPRIMÉE - toggleEditMode obsolète avec le nouveau système
  
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

    // Mettre à jour l'état des boutons extensibles
    if (isEditMode) {
      // Le bouton save devient vert (actif) s'il y a des modifications
      if (editSaveBtn) {
        editSaveBtn.classList.add('active');
      }
    }
  }
  
  // Fonction interne pour ouvrir la modal avec les données du film
  async function openMovieModalInternal(movieId) {
    try {
      console.log('🎬 Ouverture de la modale pour le film ID:', movieId);

      // Vérifier que les éléments essentiels existent
      if (!modalOverlay || !viewMode) {
        console.error('❌ Éléments de la modale manquants:', { modalOverlay, viewMode });
        return;
      }

      currentMovieId = movieId;

      // Réinitialiser le mode d'affichage
      viewMode.style.display = 'flex';
      
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
      if (!window.tagSystem && document.querySelector('.smart-add-btn')) {
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
  
  // ANCIEN SYSTÈME DÉSACTIVÉ - Remplacé par le nouveau système de boutons extensibles
  /*
  editButton.addEventListener('click', () => {
    toggleEditMode(true);

    // Mettre le focus sur l'input du titre
    setTimeout(() => {
      if (editTitleInput) {
        editTitleInput.focus();
      }
    }, 100);
  });
  */
  
  // ANCIEN CODE COMMENTÉ - exitEditModeBtn obsolète avec le nouveau système
  /*
  exitEditModeBtn.addEventListener('click', () => {
    toggleEditMode(false);
    const viewModeElement = document.getElementById('view-mode');
    const editModeElement = document.getElementById('edit-mode');

    if (viewModeElement && editModeElement) {
      viewModeElement.style.display = 'flex';
      editModeElement.style.display = 'none';
    }
  });
  */
  
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
      
      // ANCIEN CODE SUPPRIMÉ - Plus besoin avec le nouveau système
      
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

    // Passer en mode édition visuel (nouveau système - switch dans view-mode)
    const viewModeElement = document.getElementById('view-mode');

    if (viewModeElement) {
      // Ne plus changer l'affichage - rester en view-mode
      // Juste changer les couleurs avec la classe edit-mode-active
      document.querySelector('.modal-overlay').classList.add('edit-mode-active');
      console.log('🎨 Mode édition activé - couleurs changées');
    }

    // NOUVEAU: Verrouiller les éléments interactifs du mode normal
    lockNormalModeElements();
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

    // Revenir en mode visualisation (nouveau système - rester en view-mode)
    const viewModeElement = document.getElementById('view-mode');

    if (viewModeElement) {
      // Ne plus changer l'affichage - déjà en view-mode
      // Juste retirer la classe des couleurs d'édition
      document.querySelector('.modal-overlay').classList.remove('edit-mode-active');
      console.log('🎨 Mode normal restauré - couleurs originales');
    }

    // NOUVEAU: Déverrouiller les éléments interactifs du mode normal
    unlockNormalModeElements();
  }

  // NOUVELLES FONCTIONS pour gérer le verrouillage des éléments
  function lockNormalModeElements() {
    // Verrouiller les étoiles de notation
    const modalStars = document.querySelectorAll('.modal-star');
    modalStars.forEach(star => {
      star.classList.add('locked');
      star.style.pointerEvents = 'none';
      star.style.opacity = '0.5';
    });

    // Verrouiller le bouton vu/à voir
    const watchToggle = document.getElementById('btn-watch-toggle-modal');
    if (watchToggle) {
      watchToggle.classList.add('locked');
      watchToggle.style.pointerEvents = 'none';
      watchToggle.style.opacity = '0.5';
    }

    // Verrouiller la section d'avis
    const reviewInput = document.getElementById('review-input');
    const reviewSaveBtn = document.getElementById('review-save-btn');
    if (reviewInput) {
      reviewInput.disabled = true;
      reviewInput.style.opacity = '0.5';
    }
    if (reviewSaveBtn) {
      reviewSaveBtn.disabled = true;
      reviewSaveBtn.style.opacity = '0.5';
    }

    // Ajouter un overlay explicatif
    addLockOverlay();
  }

  function unlockNormalModeElements() {
    // Déverrouiller les étoiles de notation
    const modalStars = document.querySelectorAll('.modal-star');
    modalStars.forEach(star => {
      star.classList.remove('locked');
      star.style.pointerEvents = '';
      star.style.opacity = '';
    });

    // Déverrouiller le bouton vu/à voir
    const watchToggle = document.getElementById('btn-watch-toggle-modal');
    if (watchToggle) {
      watchToggle.classList.remove('locked');
      watchToggle.style.pointerEvents = '';
      watchToggle.style.opacity = '';
    }

    // Déverrouiller la section d'avis
    const reviewInput = document.getElementById('review-input');
    const reviewSaveBtn = document.getElementById('review-save-btn');
    if (reviewInput) {
      reviewInput.disabled = false;
      reviewInput.style.opacity = '';
    }
    if (reviewSaveBtn) {
      reviewSaveBtn.disabled = false;
      reviewSaveBtn.style.opacity = '';
    }

    // Retirer l'overlay
    removeLockOverlay();
  }

  function addLockOverlay() {
    // Créer un overlay subtil sur les éléments verrouillés
    const sidebar = document.querySelector('.modal-sidebar .evaluation-section');
    if (sidebar && !sidebar.querySelector('.lock-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'lock-overlay';
      overlay.innerHTML = `
        <div class="lock-message">
          <i class="fas fa-lock"></i>
          <span>Disponible en mode normal</span>
        </div>
      `;
      sidebar.appendChild(overlay);
    }
  }

  function removeLockOverlay() {
    const overlay = document.querySelector('.lock-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // Nouvelle fonction pour créer une popup de confirmation avec 3 boutons
  function createAdvancedConfirmationPopup(title, message, buttons) {
    const popup = document.createElement('div');
    popup.className = 'advanced-confirmation-popup';

    const buttonsHtml = buttons.map(btn =>
      `<button class="popup-btn ${btn.class}" data-action="${btn.action}">${btn.text}</button>`
    ).join('');

    popup.innerHTML = `
      <div class="popup-content">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="popup-buttons">
          ${buttonsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animation d'entrée
    setTimeout(() => {
      popup.classList.add('show');
    }, 10);

    return new Promise((resolve) => {
      // Gestion des clics sur les boutons
      popup.querySelectorAll('.popup-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          popup.classList.remove('show');
          setTimeout(() => {
            document.body.removeChild(popup);
            resolve(action);
          }, 300);
        });
      });

      // Fermer en cliquant sur l'overlay
      popup.addEventListener('click', (e) => {
        if (e.target === popup) {
          popup.classList.remove('show');
          setTimeout(() => {
            document.body.removeChild(popup);
            resolve('cancel');
          }, 300);
        }
      });
    });
  }

  // Fonction simple pour créer une popup de confirmation à 2 boutons
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

  // NOUVEAU SYSTÈME DE BOUTONS EXTENSIBLES selon vos spécifications
  if (editButton) {
    editButton.addEventListener('click', async () => {
      if (!isEditMode) {
        // Activer le mode édition
        activateEditMode();
      } else {
        // Mode édition déjà actif, clic sur bouton central
        if (hasUnsavedChanges) {
          // Il y a des modifications → popup 3 boutons
          const result = await createAdvancedConfirmationPopup(
            'Modifications en cours',
            'Vous avez des modifications non sauvegardées. Que souhaitez-vous faire ?',
            [
              { text: 'Retour', class: 'popup-secondary', action: 'return' },
              { text: 'Sauvegarder', class: 'popup-success', action: 'save' },
              { text: 'Annuler les modifs', class: 'popup-danger', action: 'discard' }
            ]
          );

          switch (result) {
            case 'save':
              await saveChangesAndExit();
              break;
            case 'discard':
              discardChangesAndExit();
              break;
            case 'return':
            default:
              // Ne rien faire, rester en mode édition
              break;
          }
        } else {
          // Pas de modifications → retour direct au mode normal
          deactivateEditMode();
        }
      }
    });
  }

  // Événement pour le bouton d'annulation (rouge, gauche)
  if (editCancelBtn) {
    editCancelBtn.addEventListener('click', async () => {
      const result = await createAdvancedConfirmationPopup(
        'Annuler les modifications',
        'Êtes-vous sûr de vouloir annuler toutes les modifications ?',
        [
          { text: 'Non, continuer', class: 'popup-secondary', action: 'continue' },
          { text: 'Oui, annuler', class: 'popup-danger', action: 'discard' }
        ]
      );

      if (result === 'discard') {
        discardChangesAndExit();
      }
    });
  }

  // Événement pour le bouton de sauvegarde (vert, droite)
  if (editSaveBtn) {
    editSaveBtn.addEventListener('click', async () => {
      if (hasUnsavedChanges) {
        await saveChanges();
        // IMPORTANT: Rester en mode édition après sauvegarde selon vos specs
        updateSaveButtonState(); // Le bouton redevient gris
        console.log('Modifications sauvegardées, mode édition maintenu');
      }
    });
  }

  // Fonctions helper pour le nouveau système
  async function saveChangesAndExit() {
    await saveChanges();
    deactivateEditMode();
  }

  function discardChangesAndExit() {
    // Restaurer les données originales
    resetEditFields();
    hasUnsavedChanges = false;
    deactivateEditMode();
  }

  // Fonction pour mettre à jour l'état du bouton save
  function updateSaveButtonState() {
    if (editSaveBtn) {
      if (hasUnsavedChanges) {
        editSaveBtn.classList.add('active');
      } else {
        editSaveBtn.classList.remove('active');
      }
    }
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
    const smartBtns = document.querySelectorAll('.smart-add-btn');
    console.log('🔍 Smart add buttons trouvés:', smartBtns.length);

    if (smartBtns.length > 0) {
      console.log('🚀 Initialisation du nouveau système de tags');
      setupAdvancedTagSystem();
    } else {
      console.warn('⚠️ Aucun bouton smart-add-btn trouvé');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du système de tags:', error);
  }

  // NOUVEAU SYSTÈME DE TAGS INTELLIGENT
  function setupAdvancedTagSystem() {
    // Variables pour stocker les tags par catégorie
    let mediaTags = {
      mood: [],
      technical: [],
      personal: []
    };

    // Base de données des tags existants par catégorie (simulée)
    const existingTags = {
      mood: [
        'Dynamique', 'Intense', 'Épique', 'Aventurier', 'Familial', 'Imaginatif', 'Léger', 'Divertissant',
        'Sombre', 'Tendu', 'Éducatif', 'Informatif', 'Émotionnel', 'Profond', 'Bienveillant', 'Magique',
        'Historique', 'Effrayant', 'Musical', 'Rythmé', 'Intriguant', 'Mystérieux', 'Romantique', 'Émouvant',
        'Futuriste', 'Innovant', 'Suspense', 'Classique'
      ],
      technical: [
        'HD', '4K', 'HDR', 'Dolby Atmos', 'IMAX', 'Director\'s Cut', 'Remastered', 'Restauré',
        'Version longue', 'Version originale', 'Sous-titré', 'VF', 'VOSTFR', 'Bonus inclus',
        'Making-of', 'Commentaires', 'Scènes coupées', 'Multi-angles', 'DTS', 'Surround'
      ],
      personal: [
        'Coup de cœur', 'À revoir', 'Culte', 'Nostalgie', 'Découverte', 'Recommandé',
        'Oscar', 'Cannes', 'Festival', 'Indie', 'Blockbuster', 'Art et essai',
        'Collection', 'Saga', 'Trilogie', 'Univers partagé', 'Adaptation', 'Original'
      ]
    };

    // Récupérer les boutons d'ajout de tags intelligents
    const smartAddButtons = document.querySelectorAll('.smart-add-btn');

    smartAddButtons.forEach(button => {
      const category = button.dataset.category;
      const dropdown = document.getElementById(`${category}-dropdown`);
      const searchInput = dropdown.querySelector('.dropdown-search');
      const createBtn = dropdown.querySelector('.dropdown-create-btn');
      const tagsList = dropdown.querySelector('.dropdown-tags-list');

      // Gestion du clic sur le bouton +
      button.addEventListener('click', (e) => {
        e.preventDefault();

        // Fermer tous les autres dropdowns
        document.querySelectorAll('.smart-tag-dropdown').forEach(dd => {
          if (dd !== dropdown) {
            dd.classList.remove('active');
            dd.style.display = 'none';
          }
        });
        document.querySelectorAll('.smart-add-btn').forEach(btn => {
          if (btn !== button) {
            btn.classList.remove('extended');
          }
        });

        // Toggle ce dropdown
        if (dropdown.classList.contains('active')) {
          // Fermer
          closeDropdown(button, dropdown);
        } else {
          // Ouvrir
          openDropdown(button, dropdown, category);
        }
      });

      // Gestion de la recherche
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterTags(category, searchTerm, tagsList, createBtn);
      });

      // Gestion du bouton "Créer nouveau tag"
      createBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newTagName = searchInput.value.trim();
        if (newTagName) {
          addNewTag(category, newTagName);
          searchInput.value = '';
          closeDropdown(button, dropdown);
        }
      });

      // Fermer dropdown en cliquant ailleurs
      document.addEventListener('click', (e) => {
        if (!button.contains(e.target) && !dropdown.contains(e.target)) {
          closeDropdown(button, dropdown);
        }
      });
    });

    // Fonctions helper pour le nouveau système
    function openDropdown(button, dropdown, category) {
      // Animation d'extension du bouton
      button.classList.add('extended');

      // Afficher le dropdown
      dropdown.style.display = 'block';

      // Délai pour l'animation
      setTimeout(() => {
        dropdown.classList.add('active');

        // Peupler la liste des tags
        populateTagsList(category, dropdown);

        // Focus sur la recherche
        const searchInput = dropdown.querySelector('.dropdown-search');
        searchInput.focus();
      }, 100);
    }

    function closeDropdown(button, dropdown) {
      button.classList.remove('extended');
      dropdown.classList.remove('active');

      setTimeout(() => {
        dropdown.style.display = 'none';

        // Réinitialiser la recherche
        const searchInput = dropdown.querySelector('.dropdown-search');
        searchInput.value = '';

        const createBtn = dropdown.querySelector('.dropdown-create-btn');
        createBtn.style.display = 'block';
        createBtn.classList.remove('hidden');
      }, 400);
    }

    function populateTagsList(category, dropdown) {
      const tagsList = dropdown.querySelector('.dropdown-tags-list');
      tagsList.innerHTML = '';

      // Récupérer les tags existants pour cette catégorie
      const availableTags = existingTags[category] || [];

      if (availableTags.length === 0) {
        tagsList.innerHTML = '<div class="dropdown-no-results">Aucun tag prédéfini pour cette catégorie</div>';
        return;
      }

      // Trier alphabétiquement
      const sortedTags = [...availableTags].sort((a, b) => a.localeCompare(b));

      sortedTags.forEach(tagName => {
        const tagItem = document.createElement('div');
        tagItem.className = 'dropdown-tag-item';
        tagItem.textContent = tagName;

        // Vérifier si le tag est déjà ajouté
        if (mediaTags[category].includes(tagName)) {
          tagItem.classList.add('already-added');
        }

        // Gestion du clic
        tagItem.addEventListener('click', () => {
          if (!tagItem.classList.contains('already-added')) {
            addExistingTag(category, tagName);
            closeDropdown(dropdown.closest('.edit-tag-category').querySelector('.smart-add-btn'), dropdown);
          }
        });

        tagsList.appendChild(tagItem);
      });
    }

    function filterTags(category, searchTerm, tagsList, createBtn) {
      const tagItems = tagsList.querySelectorAll('.dropdown-tag-item');
      let hasVisibleItems = false;

      tagItems.forEach(item => {
        const tagName = item.textContent.toLowerCase();
        if (tagName.includes(searchTerm)) {
          item.classList.remove('filtered-out');
          hasVisibleItems = true;
        } else {
          item.classList.add('filtered-out');
        }
      });

      // Gestion du bouton "Créer nouveau"
      if (searchTerm.length > 0) {
        createBtn.style.display = 'none';
        createBtn.classList.add('hidden');
      } else {
        createBtn.style.display = 'block';
        createBtn.classList.remove('hidden');
      }

      // Message si aucun résultat
      const noResults = tagsList.querySelector('.dropdown-no-results');
      if (!hasVisibleItems && searchTerm.length > 0) {
        if (!noResults) {
          const noResultsDiv = document.createElement('div');
          noResultsDiv.className = 'dropdown-no-results';
          noResultsDiv.textContent = `Aucun tag trouvé pour "${searchTerm}"`;
          tagsList.appendChild(noResultsDiv);
        }
      } else if (noResults) {
        noResults.remove();
      }
    }

    function addExistingTag(category, tagName) {
      if (!mediaTags[category].includes(tagName)) {
        mediaTags[category].push(tagName);

        const container = document.getElementById(`edit-${category}-tags`);
        const tagChip = createSmartTagChip(tagName, category);
        container.appendChild(tagChip);

        // Marquer comme modifié
        markAsChanged();
      }
    }

    function addNewTag(category, tagName) {
      if (!mediaTags[category].includes(tagName)) {
        // Ajouter à la liste locale
        mediaTags[category].push(tagName);

        // Ajouter à la base de tags existants (pour les futures utilisations)
        if (!existingTags[category].includes(tagName)) {
          existingTags[category].push(tagName);
        }

        const container = document.getElementById(`edit-${category}-tags`);
        const tagChip = createSmartTagChip(tagName, category, true); // true = nouveau tag
        container.appendChild(tagChip);

        // Marquer comme modifié
        markAsChanged();
      }
    }

    // Nouvelle fonction pour créer un smart tag chip avec état transparent
    function createSmartTagChip(tagValue, category, isNew = false) {
      const tagChip = document.createElement('div');
      tagChip.className = `edit-tag-chip ${isNew ? 'newly-added' : 'adding'}`;
      tagChip.innerHTML = `
        <span>${tagValue}</span>
        <button class="remove-tag" data-tag="${tagValue}" data-category="${category}">
          <i class="fas fa-times"></i>
        </button>
      `;

      // Ajouter l'événement de suppression/restauration
      const removeBtn = tagChip.querySelector('.remove-tag');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTagTransparency(tagValue, category, tagChip);
      });

      return tagChip;
    }

    // Nouvelle fonction pour gérer l'état transparent des tags
    function toggleTagTransparency(tagValue, category, tagElement) {
      if (tagElement.classList.contains('transparent')) {
        // Restaurer le tag
        tagElement.classList.remove('transparent');
        console.log(`Tag "${tagValue}" restauré`);
      } else {
        // Marquer comme transparent (suppression en attente)
        tagElement.classList.add('transparent');
        console.log(`Tag "${tagValue}" marqué pour suppression`);
      }

      // Marquer comme modifié
      markAsChanged();
    }

    // Fonction pour supprimer définitivement les tags transparents lors de la sauvegarde
    function applyTagChanges() {
      ['mood', 'technical', 'personal'].forEach(category => {
        const container = document.getElementById(`edit-${category}-tags`);
        const transparentTags = container.querySelectorAll('.edit-tag-chip.transparent');

        transparentTags.forEach(tagElement => {
          const tagValue = tagElement.querySelector('span').textContent;

          // Retirer de la liste des tags
          const index = mediaTags[category].indexOf(tagValue);
          if (index > -1) {
            mediaTags[category].splice(index, 1);
          }

          // Supprimer l'élément avec animation
          tagElement.classList.add('removing');
          setTimeout(() => {
            if (tagElement.parentNode) {
              tagElement.remove();
            }
          }, 300);
        });
      });
    }

    // Fonction pour charger les tags existants du média
    function loadMediaTags(mediaData) {
      if (mediaData && mediaData.tags) {
        mediaTags = {
          mood: mediaData.tags.mood || [],
          technical: mediaData.tags.technical || [],
          personal: mediaData.tags.personal || []
        };

        // Afficher les tags dans l'interface avec le nouveau système
        Object.keys(mediaTags).forEach(category => {
          const container = document.getElementById(`edit-${category}-tags`);
          if (container) {
            container.innerHTML = '';
            mediaTags[category].forEach(tag => {
              const tagChip = createSmartTagChip(tag, category);
              container.appendChild(tagChip);
            });
          }
        });
      }
    }

    // Fonction pour obtenir tous les tags du média pour la sauvegarde
    function getMediaTags() {
      // Appliquer les changements de transparence avant de retourner
      applyTagChanges();
      return mediaTags;
    }

    // Exposer les fonctions pour utilisation dans d'autres parties du code
    window.tagSystem = {
      loadMediaTags,
      getMediaTags,
      applyTagChanges,
      // Exposer aussi les autres fonctions utiles
      addExistingTag,
      addNewTag,
      toggleTagTransparency
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