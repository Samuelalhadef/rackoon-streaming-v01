// Mettre à jour les informations d'un film
window.electronAPI.updateMovieDetails = async function(movieId, updates) {
  try {
    // Simuler une mise à jour réussie
    // À implémenter dans l'API Electron
    console.log(`Mise à jour des informations pour le film ${movieId}:`, updates);
    
    // Retourner un succès simulé
    return { 
      success: true, 
      message: 'Informations mises à jour avec succès',
      movie: { id: movieId, ...updates }
    };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des informations du film:', error);
    return { success: false, message: 'Erreur lors de la mise à jour des informations du film' };
  }
};

// dashboard.js - Logique pour l'interface principale style Netflix améliorée
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si l'utilisateur est connecté
  const userString = localStorage.getItem('user');
  
  if (!userString) {
    // Rediriger vers la page de connexion
    window.location.href = 'login.html';
    return;
  }
  
  const user = JSON.parse(userString);
  
  // Afficher le nom d'utilisateur
  document.getElementById('username').textContent = user.username;
  
  // Éléments de l'interface
  const addBtn = document.getElementById('add-btn');
  const scanMenu = document.getElementById('scan-menu');
  const scanFolderBtn = document.getElementById('scan-folder-btn');
  const scanFileBtn = document.getElementById('scan-file-btn');
  const filterSearch = document.getElementById('filter-search');
  const mediaGrid = document.getElementById('media-grid');
  const statusMessage = document.getElementById('status-message');
  const progressBar = document.getElementById('progress-bar');
  const logoutBtn = document.getElementById('logout-btn');
  
  
  // Gestion du menu flottant
  addBtn.addEventListener('click', () => {
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
  
  // Gestion de la déconnexion
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });
  
  // Recherche de dossier
  scanFolderBtn.addEventListener('click', async () => {
    try {
      scanMenu.classList.remove('active');
      statusMessage.textContent = 'Sélection du dossier à scanner...';
      progressBar.style.width = '0%';
      
      // Lancer la recherche de dossier
      const result = await window.electronAPI.scanMovies();
      
      if (result.success) {
        statusMessage.textContent = result.message;
        progressBar.style.width = '100%';
        
        // Masquer la barre de progression après 3 secondes
        setTimeout(() => {
          progressBar.style.width = '0%';
          statusMessage.textContent = 'Prêt à rechercher des vidéos';
        }, 3000);
        
        // Mettre à jour la liste des films
        loadMovies();
      } else {
        statusMessage.textContent = result.message || 'Erreur lors de la recherche';
        progressBar.style.width = '0%';
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de films:', error);
      statusMessage.textContent = 'Erreur lors de la recherche';
      progressBar.style.width = '0%';
    }
  });
  
  // Recherche de fichier
  scanFileBtn.addEventListener('click', async () => {
    try {
      scanMenu.classList.remove('active');
      statusMessage.textContent = 'Sélection du fichier à ajouter...';
      progressBar.style.width = '0%';
      
      // Configuration pour rechercher un seul fichier
      const options = {
        mode: 'file',
        filters: [
          { name: 'Vidéos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] }
        ]
      };
      
      // Lancer la recherche d'un fichier
      const result = await window.electronAPI.scanMovies(options);
      
      if (result.success) {
        statusMessage.textContent = result.message;
        progressBar.style.width = '100%';
        
        // Masquer la barre de progression après 3 secondes
        setTimeout(() => {
          progressBar.style.width = '0%';
          statusMessage.textContent = 'Prêt à rechercher des vidéos';
        }, 3000);
        
        // Mettre à jour la liste des films
        loadMovies();
      } else {
        statusMessage.textContent = result.message || 'Erreur lors de l\'ajout du fichier';
        progressBar.style.width = '0%';
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du fichier:', error);
      statusMessage.textContent = 'Erreur lors de l\'ajout du fichier';
      progressBar.style.width = '0%';
    }
  });
  
  // Recherche dans la section films
  filterSearch.addEventListener('input', () => {
    const searchTerm = filterSearch.value.toLowerCase().trim();
    filterMovies(searchTerm);
  });
  
  // Fonction pour filtrer les médias affichés
  function filterMovies(searchTerm) {
    const cards = document.querySelectorAll('.media-card');
    
    let visibleCount = 0;
    
    cards.forEach(card => {
      const title = card.dataset.title.toLowerCase();
      
      if (title.includes(searchTerm)) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    
    // Afficher l'état vide si aucun résultat
    const existingEmptySearch = document.querySelector('.empty-search-results');
    if (existingEmptySearch) {
      existingEmptySearch.remove();
    }
    
    if (visibleCount === 0 && cards.length > 0 && searchTerm !== '') {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state empty-search-results';
      emptyState.innerHTML = `
        <span class="icon">🔍</span>
        <p>Aucun résultat trouvé pour "${searchTerm}"</p>
      `;
      mediaGrid.appendChild(emptyState);
    }
  }
  
  // Charger les préférences utilisateur (films vus et notations)
  function loadUserPreferences() {
    let userPrefs = localStorage.getItem(`userPrefs_${user.id}`);
    
    if (!userPrefs) {
      userPrefs = {
        watchedMovies: {},
        ratings: {}
      };
      localStorage.setItem(`userPrefs_${user.id}`, JSON.stringify(userPrefs));
    } else {
      userPrefs = JSON.parse(userPrefs);
      
      // S'assurer que les objets nécessaires existent
      if (!userPrefs.watchedMovies) userPrefs.watchedMovies = {};
      if (!userPrefs.ratings) userPrefs.ratings = {};
    }
    
    return userPrefs;
  }
  
  // Sauvegarder les préférences utilisateur
  function saveUserPreferences(prefs) {
    localStorage.setItem(`userPrefs_${user.id}`, JSON.stringify(prefs));
  }
  
  // Marquer un film comme vu/à voir
  function toggleWatchStatus(movieId, button) {
    const prefs = loadUserPreferences();
    
    if (prefs.watchedMovies[movieId]) {
      // Film déjà vu, le marquer comme "à voir"
      delete prefs.watchedMovies[movieId];
      button.textContent = 'à voir';
      button.classList.remove('watched');
    } else {
      // Film pas encore vu, le marquer comme "vu"
      prefs.watchedMovies[movieId] = true;
      button.textContent = 'vu !';
      button.classList.add('watched');
    }
    
    // Synchroniser tous les boutons dans la même carte si nécessaire
    const card = button.closest('.media-card');
    const otherButtons = card.querySelectorAll('.btn-watch-toggle');
    
    otherButtons.forEach(otherBtn => {
      if (otherBtn !== button) {
        otherBtn.textContent = button.textContent;
        if (prefs.watchedMovies[movieId]) {
          otherBtn.classList.add('watched');
        } else {
          otherBtn.classList.remove('watched');
        }
      }
    });
    
    saveUserPreferences(prefs);
  }
  
  // Noter un film (1-5 étoiles)
  function rateMovie(movieId, rating) {
    const prefs = loadUserPreferences();
    prefs.ratings[movieId] = rating;
    saveUserPreferences(prefs);
    
    // Mettre à jour l'affichage des étoiles
    const card = document.querySelector(`.media-card[data-id="${movieId}"]`);
    if (card) {
      updateStarsDisplay(card, rating);
    }
  }
  
  // Mettre à jour l'affichage des étoiles
  function updateStarsDisplay(card, rating) {
    const stars = card.querySelectorAll('.star');
    
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });
  }
  
  // Gérer l'interaction avec les étoiles
  function setupStarsInteraction(card) {
    const stars = card.querySelectorAll('.star');
    const movieId = card.dataset.id;
    
    stars.forEach((star, index) => {
      star.dataset.value = index + 1;
      
      star.addEventListener('mouseover', () => {
        const value = parseInt(star.dataset.value);
        
        stars.forEach((s, idx) => {
          if (idx < value) {
            s.classList.add('hover');
          } else {
            s.classList.remove('hover');
          }
        });
      });
      
      star.addEventListener('mouseout', () => {
        stars.forEach(s => s.classList.remove('hover'));
      });
      
      // Clic pour noter
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = parseInt(star.dataset.value);
        rateMovie(movieId, value);
      });
    });
  }
  
  // Formater la durée (secondes -> HH:MM:SS)
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) {
      return '00:00:00';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  }
  
  // Chargement des films
  async function loadMovies() {
    try {
      const data = await window.electronAPI.getAllMovies();
      
      if (data.success) {
        // Avant d'afficher les films, appliquer les modifications enregistrées localement
        const modifiedMovies = applyLocalEdits(data.movies);
        
        // Afficher les films avec les modifications appliquées
        displayMovies(modifiedMovies);
      } else {
        console.error('Erreur lors du chargement des films:', data.message);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des films:', error);
    }
  }
  
  // Fonction pour appliquer les modifications locales aux films
  function applyLocalEdits(movies) {
    const movieEdits = loadMovieEdits();
    
    return movies.map(movie => {
      const edits = movieEdits[movie.id];
      if (edits) {
        // Fusionner les données originales avec les modifications
        return { ...movie, ...edits };
      }
      return movie;
    });
  }
  
  // Fonction pour charger les modifications des films
  function loadMovieEdits() {
    const storageKey = `movieEdits_${user.id}`;
    let movieEdits = localStorage.getItem(storageKey);
    
    if (!movieEdits) {
      movieEdits = {};
      localStorage.setItem(storageKey, JSON.stringify(movieEdits));
    } else {
      movieEdits = JSON.parse(movieEdits);
    }
    
    return movieEdits;
  }
  
  // Fonction helper pour créer une section de catégorie
  function createCategorySection(categoryTitle, moviesInCategory) {
    let html = `
      <div class="category-section">
        <div class="category-header">
          <h3 class="category-title">${categoryTitle}</h3>
          <span class="category-count">${moviesInCategory.length} média(s)</span>
        </div>
        <div class="category-grid">
    `;
    
    // Charger les préférences utilisateur
    const userPrefs = loadUserPreferences();
    
    // Ajouter les films de cette catégorie
    moviesInCategory.forEach(movie => {
      // Configurer l'image de couverture
      let thumbnailSrc;
      if (movie.posterUrl) {
        thumbnailSrc = movie.posterUrl;
      } else if (movie.thumbnail) {
        thumbnailSrc = `file://${movie.thumbnail}`;
      } else {
        thumbnailSrc = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFlM2E2ZCIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPkF1Y3VuZSBpbWFnZTwvdGV4dD4KPC9zdmc+";
      }
      
      // État "vu/à voir"
      const isWatched = userPrefs.watchedMovies[movie.id] === true;
      const watchButtonText = isWatched ? 'vu !' : 'à voir';
      const watchButtonClass = isWatched ? 'watched' : '';
      
      // Étoiles de notation
      const rating = userPrefs.ratings[movie.id] || 0;
      const starsHtml = [1, 2, 3, 4, 5].map(star => {
        const filledClass = star <= rating ? 'filled' : '';
        return `<span class="star ${filledClass}" data-value="${star}">⭐</span>`;
      }).join('');
      
      html += `
        <div class="media-card" data-id="${movie.id}" data-title="${movie.title}">
          <div class="media-thumbnail">
            <img src="${thumbnailSrc}" alt="${movie.title}" loading="lazy">
            <div class="media-overlay">
              <button class="play-button" title="Lire la vidéo">▶</button>
            </div>
          </div>
          <div class="media-info">
            <h4 class="media-title">${movie.title}</h4>
            <div class="media-meta">
              <span class="media-duration">${formatTime(movie.duration)}</span>
              <span class="media-size">${movie.formattedSize}</span>
            </div>
            <div class="media-actions">
              <div class="rating-stars">
                ${starsHtml}
              </div>
              <button class="btn-watch-toggle ${watchButtonClass}" data-movie-id="${movie.id}">${watchButtonText}</button>
            </div>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
  
  // Affichage des films dans la grille - VERSION HYBRIDE (Template + Catégories)
function displayMovies(movies) {
  // Debug : voir les catégories des films
  console.log('Films et leurs catégories:', movies.map(m => ({title: m.title, category: m.category})));

  if (!movies || movies.length === 0) {
    mediaGrid.innerHTML = `
      <div class="empty-state">
        <span class="icon">📼</span>
        <p>Aucune vidéo trouvée. Utilisez le bouton + pour lancer une recherche.</p>
      </div>
    `;
    return;
  }

  // Grouper les films par catégorie
  const moviesByCategory = movies.reduce((groups, movie) => {
    const category = movie.category || 'unsorted';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(movie);
    return groups;
  }, {});

  // Vider la grille
  mediaGrid.innerHTML = '';

  // ÉTAPE 1 : Afficher d'abord les catégories TRIÉES (sauf "unsorted")
  const categoriesTriees = ['film', 'series', 'short', 'other'];
  
  categoriesTriees.forEach(category => {
    if (moviesByCategory[category] && moviesByCategory[category].length > 0) {
      createCategorySection(getCategoryDisplayName(category), moviesByCategory[category]);
    }
  });
  
  // Afficher les catégories personnalisées (autres que les principales et "unsorted")
  Object.keys(moviesByCategory).forEach(category => {
    if (!categoriesTriees.includes(category) && category !== 'unsorted' && moviesByCategory[category].length > 0) {
      createCategorySection(category, moviesByCategory[category]);
    }
  });
  
  // ÉTAPE 2 : Ajouter une séparation si il y a des médias triés ET non triés
  const hasTriedMovies = categoriesTriees.some(cat => moviesByCategory[cat] && moviesByCategory[cat].length > 0) ||
                        Object.keys(moviesByCategory).some(cat => cat !== 'unsorted' && moviesByCategory[cat] && moviesByCategory[cat].length > 0);
  
  if (hasTriedMovies && moviesByCategory['unsorted'] && moviesByCategory['unsorted'].length > 0) {
    const separator = document.createElement('div');
    separator.className = 'category-separator';
    separator.innerHTML = '<hr class="separator-line">';
    mediaGrid.appendChild(separator);
  }
  
  // ÉTAPE 3 : Afficher "unsorted" EN DERNIER (en bas)
  if (moviesByCategory['unsorted'] && moviesByCategory['unsorted'].length > 0) {
    createCategorySection('📥 Médias non triés', moviesByCategory['unsorted']);
  }
}

// Fonction helper pour obtenir le nom d'affichage des catégories
function getCategoryDisplayName(category) {
  const displayNames = {
    'film': '🎬 Films',
    'series': '📺 Séries', 
    'short': '🎞️ Courts métrages',
    'other': '📁 Autres'
  };
  return displayNames[category] || category;
}

// Fonction helper pour créer une section de catégorie AVEC LE TEMPLATE
function createCategorySection(categoryTitle, moviesInCategory) {
  // Créer le header de la catégorie
  const categorySection = document.createElement('div');
  categorySection.className = 'category-section';
  
  const categoryHeader = document.createElement('div');
  categoryHeader.className = 'category-header';
  categoryHeader.innerHTML = `
    <h3 class="category-title">${categoryTitle}</h3>
    <span class="category-count">${moviesInCategory.length} média(s)</span>
  `;
  
  const categoryGrid = document.createElement('div');
  categoryGrid.className = 'category-grid';
  
  // Charger les préférences utilisateur
  const userPrefs = loadUserPreferences();
  
  // Utiliser le template pour créer les cartes
  const template = document.getElementById('media-card-template');
  
  // Ajouter chaque film de cette catégorie
  moviesInCategory.forEach(movie => {
    // Cloner le template
    const mediaCard = template.content.cloneNode(true).querySelector('.media-card');
    
    // Configurer les attributs de la carte
    mediaCard.dataset.id = movie.id;
    mediaCard.dataset.title = movie.title.toLowerCase();
    
    // Configurer l'image de couverture - utiliser la miniature ou l'image personnalisée
    let thumbnailSrc;
    if (movie.posterUrl) {
      thumbnailSrc = movie.posterUrl;
    } else if (movie.thumbnail) {
      thumbnailSrc = `file://${movie.thumbnail}`;
    } else {
      thumbnailSrc = '../public/img/default-thumbnail.svg';
    }
    
    const thumbnailImg = mediaCard.querySelector('.media-thumbnail');
    thumbnailImg.src = thumbnailSrc;
    thumbnailImg.alt = movie.title;
    thumbnailImg.onerror = () => { thumbnailImg.src = '../public/img/default-thumbnail.svg'; };
    
    // Configurer le titre
    mediaCard.querySelector('.media-title').textContent = movie.title;
    
    // Configurer la durée
    mediaCard.querySelector('.duration-value').textContent = formatTime(movie.duration);
    
    // Configurer l'état "vu/à voir"
    const isWatched = userPrefs.watchedMovies[movie.id] === true;
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
    const rating = userPrefs.ratings[movie.id] || 0;
    updateStarsDisplay(mediaCard, rating);
    setupStarsInteraction(mediaCard);
    
    // Ajouter un écouteur pour la carte entière (clic sur l'image pour ouvrir la modal)
    mediaCard.addEventListener('click', async (e) => {
      // Éviter de déclencher si on clique sur un bouton ou les étoiles
      if (e.target.closest('.btn-watch-toggle') || e.target.closest('.star')) {
        return;
      }
      
      try {
        // Ouvrir la modal au lieu de lire directement la vidéo
        if (window.openMovieModal) {
          window.openMovieModal(movie.id);
        } else {
          console.error('La fonction openMovieModal n\'est pas disponible');
        }
      } catch (error) {
        console.error('Erreur lors de l\'ouverture de la modal:', error);
      }
    });
    
    // Ajouter la carte au grid de la catégorie
    categoryGrid.appendChild(mediaCard);
  });
  
  // Assembler la section complète
  categorySection.appendChild(categoryHeader);
  categorySection.appendChild(categoryGrid);
  
  // Ajouter la section au mediaGrid principal
  mediaGrid.appendChild(categorySection);
  
  // Initialiser les déclencheurs de modal
  if (window.setupModalTriggers) {
    window.setupModalTriggers();
  }
}
  
  // Configurer les événements des cartes média
  function setupMediaCardEvents() {
    // Configurer les boutons "vu/à voir"
    document.querySelectorAll('.btn-watch-toggle').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const movieId = button.getAttribute('data-movie-id');
        toggleWatchStatus(movieId, button);
      });
    });
    
    // Configurer les étoiles de notation
    document.querySelectorAll('.media-card').forEach(card => {
      setupStarsInteraction(card);
      
      // Ajouter l'écouteur pour la carte entière (clic pour ouvrir la modal)
      card.addEventListener('click', async (e) => {
        // Éviter de déclencher si on clique sur un bouton ou les étoiles
        if (e.target.closest('.btn-watch-toggle') || e.target.closest('.star') || e.target.closest('.play-button')) {
          return;
        }
        
        try {
          const movieId = card.getAttribute('data-id');
          // Ouvrir la modal au lieu de lire directement la vidéo
          if (window.openMovieModal) {
            window.openMovieModal(movieId);
          } else {
            console.error('La fonction openMovieModal n\'est pas disponible');
          }
        } catch (error) {
          console.error('Erreur lors de l\'ouverture de la modal:', error);
        }
      });
    });
    
    // Initialiser les déclencheurs de modal
    if (window.setupModalTriggers) {
      window.setupModalTriggers();
    }
  }
  
  // Fonction pour la génération dynamique des miniatures (sur demande)
  async function generateThumbnail(movieId) {
    try {
      const result = await window.electronAPI.generateThumbnail(movieId);
      
      if (result.success) {
        // Mettre à jour l'affichage avec la nouvelle miniature
        const card = document.querySelector(`.media-card[data-id="${movieId}"]`);
        if (card) {
          const img = card.querySelector('.media-thumbnail img');
          if (img && result.thumbnail) {
            img.src = `file://${result.thumbnail}`;
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la génération de la miniature:', error);
      return false;
    }
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
          const result = await window.electronAPI.openFolder(movieId);
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
  window.electronAPI.getMovieDetails = async function(movieId) {
    try {
      const result = await window.electronAPI.getMoviePath(movieId);
      
      if (result.success) {
        const data = await window.electronAPI.getAllMovies();
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
  
  // Jouer un film
  window.electronAPI.playMovie = async function(movieId) {
    try {
      return await window.electronAPI.getMoviePath(movieId);
    } catch (error) {
      console.error('Erreur lors de la lecture du film:', error);
      return { success: false, message: 'Erreur lors de la lecture du film' };
    }
  };
  
  // Ouvrir une boîte de dialogue de sélection de fichier
  window.electronAPI.openFileDialog = async function(options) {
    try {
      console.log("Ouverture du sélecteur de fichiers avec options:", options);
      
      if (options.properties && options.properties.includes('openFile')) {
        const filePath = await new Promise((resolve) => {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          
          if (options.filters && options.filters.length > 0) {
            const extensions = options.filters
              .flatMap(filter => filter.extensions.map(ext => `.${ext}`))
              .join(',');
            fileInput.accept = extensions;
          }
          
          fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
              const objectURL = URL.createObjectURL(file);
              resolve({
                path: objectURL,
                name: file.name
              });
            } else {
              resolve(null);
            }
          });
          
          fileInput.click();
        });
        
        if (!filePath) {
          return { canceled: true };
        }
        
        return {
          canceled: false,
          filePaths: [filePath.path],
          fileName: filePath.name
        };
      }
      
      return { canceled: true };
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la boîte de dialogue:', error);
      return { canceled: true, error: error.message };
    }
  };
  
  // Exposer les fonctions pour la modal
  window.loadMoviesFromDashboard = loadMovies;
  window.refreshDashboard = loadMovies;
  
  // Initialiser l'interface
  setupContextMenu();
  loadMovies();
});