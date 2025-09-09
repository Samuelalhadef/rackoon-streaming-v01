
// dashboard.js - Logique pour l'interface principale style Netflix simplifiée
document.addEventListener('DOMContentLoaded', () => {
  // Plus de système de connexion - application directe
  console.log('Application Rackoon Streaming démarrée');
  
  // Éléments de l'interface
  const addBtn = document.getElementById('add-btn');
  const scanMenu = document.getElementById('scan-menu');
  const scanFolderBtn = document.getElementById('scan-folder-btn');
  const scanFileBtn = document.getElementById('scan-file-btn');
  const filterSearch = document.getElementById('filter-search');
  const mediaGrid = document.getElementById('media-grid');
  const statusMessage = document.getElementById('status-message');
  const progressBar = document.getElementById('progress-bar');
  
  
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
  
  // Plus de système de déconnexion
  
  // Recherche de dossier
  scanFolderBtn.addEventListener('click', async () => {
    try {
      scanMenu.classList.remove('active');
      statusMessage.textContent = 'Sélection du dossier à scanner...';
      progressBar.style.width = '0%';
      
      // Lancer le scan direct
      const result = await window.electronAPI.scanMovies();
      
      if (result.success) {
        statusMessage.textContent = `${result.movies.length} fichiers vidéo trouvés`;
        progressBar.style.width = '100%';
        
        // Afficher les films trouvés
        if (result.movies && result.movies.length > 0) {
          displayMovies(result.movies);
        } else {
          statusMessage.textContent = 'Aucun fichier vidéo trouvé';
        }
        
        // Masquer la barre de progression après 3 secondes
        setTimeout(() => {
          progressBar.style.width = '0%';
          statusMessage.textContent = 'Prêt à rechercher des vidéos';
        }, 3000);
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
  
  // Recherche de fichier - désactivée pour simplifier
  scanFileBtn.addEventListener('click', async () => {
    scanMenu.classList.remove('active');
    statusMessage.textContent = 'Fonction temporairement désactivée - utilisez le scan de dossier';
    progressBar.style.width = '0%';
  });
  
  // Recherche dans la section films
  filterSearch.addEventListener('input', () => {
    const searchTerm = filterSearch.value.toLowerCase().trim();
    filterMovies(searchTerm);
  });
  
  // Fonction pour afficher les films avec miniatures
  function displayMovies(movies) {
    const mediaGrid = document.getElementById('media-grid');
    mediaGrid.innerHTML = '';
    
    if (!movies || movies.length === 0) {
      mediaGrid.innerHTML = '<p class="no-movies">Aucun film trouvé. Utilisez le bouton + pour scanner un dossier.</p>';
      return;
    }
    
    movies.forEach(movie => {
      const movieCard = document.createElement('div');
      movieCard.className = 'media-card';
      
      // Gérer l'affichage des miniatures
      let thumbnailSrc = '../public/img/default-thumbnail.svg';
      if (movie.thumbnail) {
        // Utiliser le chemin local de la miniature
        thumbnailSrc = `../data/thumbnails/${movie.thumbnail}`;
      }
      
      movieCard.innerHTML = `
        <div class="media-poster">
          <img src="${thumbnailSrc}" alt="${movie.title}" onerror="this.src='../public/img/default-thumbnail.svg'">
          <div class="play-overlay">
            <div class="play-button" onclick="playMovie('${movie.path.replace(/'/g, "\\'")}')">▶</div>
          </div>
        </div>
        <div class="media-info">
          <h3 class="media-title">${movie.title}</h3>
          <div class="media-details">
            <span class="media-duration">${window.formatFileSize ? window.formatFileSize(movie.size_bytes) : 'N/A'}</span>
            <span class="media-format">${movie.format.toUpperCase()}</span>
            ${movie.dateAdded ? `<span class="media-date">Ajouté ${new Date(movie.dateAdded).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
      `;
      mediaGrid.appendChild(movieCard);
    });
  }
  
  // Fonction pour jouer un film
  window.playMovie = async function(moviePath) {
    try {
      const result = await window.electronAPI.getMoviePath(moviePath);
      if (result.success) {
        window.openVideoPlayer(result.path);
      } else {
        console.error('Erreur:', result.message);
      }
    } catch (error) {
      console.error('Erreur lors du lancement de la vidéo:', error);
    }
  };
  
  // Charger les films au démarrage depuis la base JSON
  async function loadMoviesFromDatabase() {
    try {
      const result = await window.electronAPI.getAllMovies();
      if (result.success) {
        console.log(`📚 ${result.count} films chargés depuis la base`);
        displayMovies(result.movies);
        if (result.count > 0) {
          statusMessage.textContent = `${result.count} films dans la bibliothèque`;
        }
      } else {
        console.error('Erreur chargement films:', result.message);
        displayMovies([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      displayMovies([]);
    }
  }
  
  // Charger les films au démarrage
  loadMoviesFromDatabase();
  
  // Fonction pour filtrer les médias affichés
  function filterMovies(searchTerm) {
    // Si pas de terme de recherche, afficher tout
    if (!searchTerm || searchTerm === '') {
      showAllCards();
      return;
    }
    
    // Récupérer seulement les cartes des sections originales (pas de la recherche)
    const originalSections = document.querySelectorAll('.category-section:not(.search-results-section)');
    const cards = [];
    const foundMovieIds = new Set(); // Pour éviter les doublons
    
    originalSections.forEach(section => {
      section.querySelectorAll('.media-card').forEach(card => {
        const movieId = card.dataset.id;
        if (!foundMovieIds.has(movieId)) {
          cards.push(card);
          foundMovieIds.add(movieId);
        }
      });
    });
    
    let visibleCount = 0;
    
    // Masquer toutes les sections originales
    originalSections.forEach(section => {
      section.style.display = 'none';
    });
    
    // Créer ou récupérer la section de résultats de recherche
    let searchResultsSection = document.querySelector('.search-results-section');
    if (!searchResultsSection) {
      searchResultsSection = document.createElement('div');
      searchResultsSection.className = 'category-section search-results-section';
      searchResultsSection.innerHTML = `
        <div class="category-header">
          <h3 class="category-title">🔍 Résultats de recherche</h3>
          <span class="category-count" id="search-count">0 résultat(s)</span>
        </div>
        <div class="category-grid search-results-grid"></div>
      `;
      mediaGrid.insertBefore(searchResultsSection, mediaGrid.firstChild);
    }
    
    const searchGrid = searchResultsSection.querySelector('.search-results-grid');
    const searchCount = searchResultsSection.querySelector('#search-count');
    searchGrid.innerHTML = ''; // Vider les résultats précédents
    
    // Filtrer et ajouter les cartes correspondantes (sans doublons)
    cards.forEach(card => {
      const title = card.dataset.title.toLowerCase();
      
      if (title.includes(searchTerm)) {
        // Cloner la carte et l'ajouter aux résultats
        const cardClone = card.cloneNode(true);
        
        // Réattacher les événements sur la carte clonée
        setupCardEvents(cardClone);
        
        searchGrid.appendChild(cardClone);
        visibleCount++;
      }
    });
    
    // Mettre à jour le compteur
    searchCount.textContent = `${visibleCount} résultat(s)`;
    
    // Afficher la section de résultats
    searchResultsSection.style.display = 'block';
    
    // Afficher message si aucun résultat
    if (visibleCount === 0) {
      searchGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
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
    
    // Réafficher toutes les sections originales (exclure search-results-section)
    const originalSections = document.querySelectorAll('.category-section:not(.search-results-section)');
    originalSections.forEach(section => {
      section.style.display = 'block';
    });
  }
  
  // Fonction pour configurer les événements sur une carte
  function setupCardEvents(card) {
    const movieId = card.dataset.id;
    
    // Événement clic sur la carte
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-watch-toggle') || e.target.closest('.star')) {
        return;
      }
      
      try {
        if (window.openMovieModal) {
          window.openMovieModal(movieId);
        }
      } catch (error) {
        console.error('Erreur lors de l\'ouverture de la modal:', error);
      }
    });
    
    // Événements sur les boutons watch toggle
    const watchButtons = card.querySelectorAll('.btn-watch-toggle');
    watchButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWatchStatus(movieId, button);
      });
    });
    
    // Événements sur les étoiles
    window.setupStarsInteraction(card, (rating) => rateMovie(movieId, rating));
  }
  
  
  // Marquer un film comme vu/à voir
  function toggleWatchStatus(movieId, button) {
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
    
    if (userPrefs.watchedMovies[movieId]) {
      // Film déjà vu, le marquer comme "à voir"
      delete userPrefs.watchedMovies[movieId];
      button.textContent = 'à voir';
      button.classList.remove('watched');
    } else {
      // Film pas encore vu, le marquer comme "vu"
      userPrefs.watchedMovies[movieId] = true;
      button.textContent = 'vu !';
      button.classList.add('watched');
    }
    
    // Synchroniser tous les boutons dans la même carte si nécessaire
    const card = button.closest('.media-card');
    const otherButtons = card.querySelectorAll('.btn-watch-toggle');
    
    otherButtons.forEach(otherBtn => {
      if (otherBtn !== button) {
        otherBtn.textContent = button.textContent;
        if (userPrefs.watchedMovies[movieId]) {
          otherBtn.classList.add('watched');
        } else {
          otherBtn.classList.remove('watched');
        }
      }
    });
    
    localStorage.setItem('userPrefs_global', JSON.stringify(userPrefs));
  }
  
  // Noter un film (1-5 étoiles)
  function rateMovie(movieId, rating) {
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
    
    userPrefs.ratings[movieId] = rating;
    localStorage.setItem('userPrefs_global', JSON.stringify(userPrefs));
    
    // Mettre à jour l'affichage des étoiles
    const card = document.querySelector(`.media-card[data-id="${movieId}"]`);
    if (card) {
      window.updateStarsDisplay(card, rating);
    }
  }
  
  
  
  
  // Chargement des films
  window.loadMovies = async function() {
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
    const storageKey = 'movieEdits_global';
    let movieEdits = localStorage.getItem(storageKey);
    
    if (!movieEdits) {
      movieEdits = {};
    } else {
      movieEdits = JSON.parse(movieEdits);
    }
    
    return movies.map(movie => {
      const edits = movieEdits[movie.id];
      if (edits) {
        // Fusionner les données originales avec les modifications
        return { ...movie, ...edits };
      }
      return movie;
    });
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
              <span class="media-duration">${window.formatTime(movie.duration)}</span>
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
    mediaCard.querySelector('.duration-value').textContent = window.formatTime(movie.duration);
    
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
    window.updateStarsDisplay(mediaCard, rating);
    window.setupStarsInteraction(mediaCard, (rating) => rateMovie(movie.id, rating));
    
    // Ajouter un écouteur pour le bouton de lecture
    const playBtn = mediaCard.querySelector('.play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.openVideoPlayer(movie.id, movie.title, movie.path);
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
      const movieId = card.getAttribute('data-id');
      window.setupStarsInteraction(card, (rating) => rateMovie(movieId, rating));
      
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
  
  // Jouer un film avec le lecteur intégré
  window.electronAPI.playMovie = async function(movieId) {
    try {
      // Obtenir les détails du film
      const movieDetails = await window.electronAPI.getMovieDetails(movieId);
      if (!movieDetails.success) {
        throw new Error(movieDetails.message || 'Impossible de charger les détails du film');
      }
      
      const movie = movieDetails.movie;
      
      // Ouvrir le lecteur vidéo moderne
      await window.openVideoPlayer(movieId, movie.title, movie.path);
      
      return { success: true, message: 'Lecteur vidéo ouvert' };
    } catch (error) {
      console.error('Erreur lors de la lecture du film:', error);
      return { success: false, message: 'Erreur lors de la lecture du film: ' + error.message };
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
  window.loadMoviesFromDashboard = window.loadMovies;
  window.refreshDashboard = window.loadMovies;
  
  // Initialiser l'interface
  setupContextMenu();
  window.loadMovies();
});