// movie-modal.js - Gestion de la modal de présentation des films

document.addEventListener('DOMContentLoaded', () => {
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
  
  // Récupérer le stockage des préférences utilisateur
  const userString = localStorage.getItem('user');
  if (!userString) {
    window.location.href = 'login.html';
    return;
  }
  const user = JSON.parse(userString);
  
  // Variables globales pour le film actuel
  let currentMovieId = null;
  let currentMoviePath = null;
  let currentMovieData = {};
  let selectedGenres = [];
  let posterImageFile = null;
  let tmdbGenresCache = null;
  
  // Configuration des clés de stockage spécifiques à l'utilisateur
  const USER_PREFS_KEY = `userPrefs_${user.id}`;
  
  // Fonctions utilitaires pour les préférences utilisateur spécifiques
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
  
  // Fonction pour ouvrir la modal avec les données du film
  window.openMovieModal = async function(movieId) {
    try {
      currentMovieId = movieId;
      
      // Réinitialiser le mode d'affichage
      viewMode.style.display = 'flex';
      editMode.style.display = 'none';
      
      // Récupérer les modifications précédentes du film
      const savedEdits = window.movieEdits.get(movieId);
      console.log("Modifications sauvegardées:", savedEdits);
      
      // Récupérer les détails du film
      const result = await window.electronAPI.getMovieDetails(movieId);
      
      if (!result.success) {
        console.error('Erreur lors de la récupération des détails du film:', result.message);
        return;
      }
      
      // Commencer avec les données originales du film
      let movie = result.movie;
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
      
      // Configurer la durée
      duration.textContent = window.formatTime(movie.duration);
      
      // Configurer les genres
      genresContainer.innerHTML = '';
      
      if (movie.genres && movie.genres.length > 0) {
        // Utiliser les genres du film s'ils existent
        movie.genres.forEach(genre => {
          const genreTag = document.createElement('span');
          genreTag.className = 'genre-tag';
          genreTag.textContent = genre;
          genresContainer.appendChild(genreTag);
        });
      } else {
        // Sinon créer 3 tags de genre vides
        for (let i = 0; i < 3; i++) {
          const genreTag = document.createElement('span');
          genreTag.className = 'genre-tag';
          genreTag.textContent = '';
          genresContainer.appendChild(genreTag);
        }
      }
      
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
      
      // Afficher la modal avec animation
      modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Empêcher le défilement
      
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la modal:', error);
    }
  };
  
  // Fonction pour fermer la modal
  function closeMovieModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = ''; // Réactiver le défilement
    currentMovieId = null;
    currentMoviePath = null;
    currentMovieData = {};
    selectedGenres = [];
    posterImageFile = null;
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
      const result = await window.electronAPI.getMoviePath(currentMovieId);
      
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
  
  // Passer en mode édition
  editButton.addEventListener('click', () => {
    const viewModeElement = document.getElementById('view-mode');
    const editModeElement = document.getElementById('edit-mode');
    
    if (viewModeElement && editModeElement) {
      viewModeElement.style.display = 'none';
      editModeElement.style.display = 'block';
      
      // Mettre le focus sur l'input du titre
      setTimeout(() => {
        if (editTitleInput) {
          editTitleInput.focus();
        }
      }, 100);
    }
  });
  
  // Sortir du mode édition
  exitEditModeBtn.addEventListener('click', () => {
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
    results.forEach(movie => {
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
      
      // Formater les données
      const formattedMovie = {
        title: movieDetails.title,
        release_date: movieDetails.release_date,
        poster_path: movieDetails.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieDetails.poster_path}` : null,
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
      const imageUrl = imagePreview.src;
      
      // Extraire l'année pour l'enregistrer séparément
      let year = null;
      if (editReleaseDateInput.value) {
        year = new Date(editReleaseDateInput.value).getFullYear();
      }
      
      // Préparer les données à enregistrer
      const movieUpdates = {
        title: title,
        releaseDate: formattedDate,
        genres: selectedGenres,
        description: editSynopsisInput.value.trim(),
        posterUrl: imageUrl, // Sauvegarder l'URL ou Data URL de l'image
        year: year
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
      modalPoster.src = imageUrl;
      
      // Tenter d'enregistrer les modifications via l'API Electron si disponible
      if (window.electronAPI && window.electronAPI.updateMovieDetails) {
        try {
          const result = await window.electronAPI.updateMovieDetails(currentMovieId, movieUpdates);
          if (result.success) {
            console.log("Modifications enregistrées via electronAPI:", result);
          }
        } catch (apiError) {
          console.error("Erreur avec l'API Electron:", apiError);
          // Continuer même en cas d'erreur avec l'API
        }
      }
      
      alert('Modifications enregistrées avec succès');
      
      // Revenir au mode visualisation
      const viewModeElement = document.getElementById('view-mode');
      const editModeElement = document.getElementById('edit-mode');
      
      if (viewModeElement && editModeElement) {
        viewModeElement.style.display = 'flex';
        editModeElement.style.display = 'none';
      }
      
      // Rafraîchir le dashboard pour refléter les modifications
      // Cette fonction doit être définie dans dashboard.js
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
          openMovieModal(movieId);
        }
      });
    });
    
    // Ajouter l'event listener pour le bouton play dans la modal
    const playMovieBtn = document.getElementById('play-movie-btn');
    if (playMovieBtn) {
      playMovieBtn.addEventListener('click', async (e) => {
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
  
  // Exposer la fonction pour pouvoir l'appeler depuis dashboard.js
  window.setupModalTriggers = setupModalTriggers;
});