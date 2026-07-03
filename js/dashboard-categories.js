// dashboard-categories.js - Nouveau système de catégories pour le dashboard

class DashboardCategories {
  constructor() {
    this.categories = [];
    this.moviesByCategory = {};
    this.allMovies = [];
    this.init();
  }

  async init() {
    await this.loadCategories();
    await this.loadAllMovies();
    this.organizeMoviesByCategory();
    this.displayAllSections();
    this.attachEventListeners();
  }

  // Charger toutes les catégories
  async loadCategories() {
    try {
      const result = await window.electronAPI.getAllCategories();
      if (result.success) {
        this.categories = result.categories;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  }

  // Charger tous les médias
  async loadAllMovies() {
    try {
      const result = await window.electronAPI.getAllMedias();
      if (result.success) {
        this.allMovies = result.medias || [];
        console.log('Films chargés:', this.allMovies.length);
      } else {
        this.allMovies = [];
      }
    } catch (error) {
      console.error('Erreur lors du chargement des films:', error);
      this.allMovies = [];
    }
  }

  // Organiser les films par catégorie
  organizeMoviesByCategory() {
    // Initialiser les catégories
    this.moviesByCategory = {};
    
    // Ajouter les catégories prédéfinies
    const predefinedCategories = ['films', 'series', 'shorts', 'others'];
    predefinedCategories.forEach(catId => {
      this.moviesByCategory[catId] = [];
    });
    
    // Ajouter les catégories personnalisées
    this.categories.forEach(category => {
      if (!category.predefined) {
        this.moviesByCategory[category.id] = [];
      }
    });
    
    // Ajouter la catégorie unsorted
    this.moviesByCategory['unsorted'] = [];
    
    // Organiser les films
    this.allMovies.forEach(movie => {
      const category = movie.category || 'unsorted';
      if (this.moviesByCategory[category]) {
        this.moviesByCategory[category].push(movie);
      } else {
        // Si la catégorie n'existe pas, mettre en unsorted
        this.moviesByCategory['unsorted'].push(movie);
      }
    });

    console.log('Médias organisés par catégorie:', this.moviesByCategory);
  }

  // Afficher toutes les sections sur le dashboard
  displayAllSections() {
    const dashboardContent = document.getElementById('dashboard-content');
    if (!dashboardContent) return;

    // Vider le conteneur
    dashboardContent.innerHTML = '';

    // Créer les sections pour toutes les catégories (même vides)
    this.createCategorySections(dashboardContent);
  }

  createCategorySections(container) {
    // Ordre des catégories à afficher (toujours affichées même vides)
    const categoryOrder = [
      { id: 'films', name: 'Films', icon: '🎬' },
      { id: 'series', name: 'Séries', icon: '📺' },
      { id: 'shorts', name: 'Court métrage', icon: '🎞️' },
      { id: 'others', name: 'Autres', icon: '📁' }
    ];

    // Ajouter les catégories personnalisées
    this.categories.forEach(category => {
      if (!category.predefined) {
        categoryOrder.push({
          id: category.id,
          name: category.name,
          icon: category.icon || '📁'
        });
      }
    });

    // Créer les sections pour chaque catégorie (même vides)
    categoryOrder.forEach(category => {
      const movies = this.moviesByCategory[category.id] || [];
      const section = this.createCategorySection(category, movies);
      container.appendChild(section);
    });

    // Ajouter le bouton "Nouvelle catégorie"
    const newCategorySection = this.createNewCategorySection();
    container.appendChild(newCategorySection);

    // Ajouter la section "Médias non triés" à la fin
    const unsortedMovies = this.moviesByCategory['unsorted'] || [];
    if (unsortedMovies.length > 0) {
      const unsortedSection = this.createCategorySection(
        { id: 'unsorted', name: 'Médias non triés', icon: '📥' },
        unsortedMovies,
        true // marquer comme section non triée
      );
      container.appendChild(unsortedSection);
    }
  }

  // Créer une section de catégorie avec ses médias
  createCategorySection(category, movies, isUnsorted = false) {
    const section = document.createElement('div');
    section.className = `category-section ${isUnsorted ? 'unsorted' : ''} ${movies.length === 0 ? 'empty' : ''}`;
    section.dataset.category = category.id;

    section.innerHTML = `
      <div class="category-header">
        <div class="category-title-container">
          <span class="category-icon">${category.icon}</span>
          <h2 class="category-title">${category.name}</h2>
          <span class="category-count">${movies.length} média${movies.length > 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="category-grid" id="grid-${category.id}">
        <!-- Les médias seront ajoutés ici -->
      </div>
    `;

    // Ajouter les médias à la grille
    const grid = section.querySelector('.category-grid');
    
    if (movies.length === 0) {
      // Afficher un message pour les catégories vides
      grid.innerHTML = `
        <div class="empty-category-state">
          <span class="empty-category-icon">${category.icon}</span>
          <p>Aucun média dans cette catégorie</p>
        </div>
      `;
    } else {
      movies.forEach(movie => {
        const movieCard = this.createMovieCard(movie);
        grid.appendChild(movieCard);
      });
    }

    return section;
  }

  // Créer la section "Nouvelle catégorie"
  createNewCategorySection() {
    const section = document.createElement('div');
    section.className = 'new-category-section';

    section.innerHTML = `
      <div class="new-category-card">
        <div class="new-category-content">
          <div class="new-category-icon">+</div>
          <div class="new-category-text">Nouvelle catégorie</div>
        </div>
      </div>
    `;

    const card = section.querySelector('.new-category-card');
    card.addEventListener('click', () => {
      this.showNewCategoryModal();
    });

    return section;
  }

  // Attacher les événements
  attachEventListeners() {
    // Les événements seront attachés directement aux cartes de films
    // Plus besoin d'événements globaux avec le nouveau design

    // Écouter les mises à jour de note pour mettre à jour les cartes en temps réel
    window.addEventListener('ratingUpdated', (e) => {
      console.log('📢 Événement ratingUpdated reçu:', e.detail);
      this.updateCardRating(e.detail.movieId, e.detail.rating);
    });
  }

  // Mettre à jour la note sur une carte spécifique
  updateCardRating(movieId, rating) {
    const card = document.querySelector(`.media-card[data-id="${movieId}"]`);
    if (!card) {
      console.warn(`⚠️ Carte non trouvée pour l'ID: ${movieId}`);
      return;
    }

    // Chercher les étoiles (compatible avec les deux systèmes)
    let starsContainer = card.querySelector('.stars-container');
    if (!starsContainer) {
      starsContainer = card.querySelector('.rating-stars');
    }

    if (!starsContainer) {
      console.warn(`⚠️ Container d'étoiles non trouvé pour l'ID: ${movieId}`);
      return;
    }

    const stars = starsContainer.querySelectorAll('.star');
    const fullStars = Math.floor(rating);

    stars.forEach((star, index) => {
      if (index < fullStars) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });

    console.log(`✅ Carte mise à jour: ${movieId} - Note: ${rating}/5`);
  }


  // Créer une carte de film (utilise la logique existante)
  createMovieCard(movie) {
    // Pour l'instant, créer une carte simple
    // Cette fonction pourrait être intégrée avec le système existant
    const template = document.getElementById('media-card-template');
    if (!template) {
      // Fallback si pas de template
      const card = document.createElement('div');
      card.className = 'media-card movie-card';
      card.innerHTML = `
        <div class="media-thumbnail-container">
          <img src="${movie.thumbnail || window.DEFAULT_THUMBNAIL}" alt="${movie.title}" class="media-thumbnail">
        </div>
        <div class="media-info">
          <div class="media-title-container">
            <h3 class="media-title">${movie.title || 'Sans titre'}</h3>
          </div>
        </div>
      `;
      return card;
    }

    // Cloner le template existant et le remplir
    const card = template.content.cloneNode(true);
    const cardElement = card.querySelector('.media-card');
    
    cardElement.dataset.id = movie.id;
    cardElement.dataset.title = movie.title || '';
    
    const thumbnail = card.querySelector('.media-thumbnail');
    if (thumbnail) {
      window.setupImageWithFallback(
        thumbnail,
        movie.id,
        movie.posterUrl,
        movie.thumbnail,
        movie.title || 'Sans titre'
      );
    }
    
    const title = card.querySelector('.media-title');
    if (title) {
      title.textContent = movie.title || 'Sans titre';
    }
    
    const duration = card.querySelector('.duration-value');
    if (duration) {
      duration.textContent = window.formatTime(movie.duration || 0);
    }

    // Charger et afficher la note de l'utilisateur
    const userPrefs = this.loadUserPreferences();
    const userRating = userPrefs.ratings[movie.id] || 0;

    if (userRating > 0) {
      const starsContainer = card.querySelector('.stars-container');
      if (starsContainer) {
        const stars = starsContainer.querySelectorAll('.star');
        const fullStars = Math.floor(userRating);

        stars.forEach((star, index) => {
          if (index < fullStars) {
            star.classList.add('filled');
          }
        });
      }
    }

    return cardElement;
  }

  // Charger les préférences utilisateur depuis localStorage
  loadUserPreferences() {
    const stored = localStorage.getItem('userPrefs_global');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      watchedMovies: {},
      ratings: {},
      reviews: {}
    };
  }

  // Afficher la modale de création de catégorie
  showNewCategoryModal() {
    const name = prompt('Nom de la nouvelle catégorie :');
    if (name && name.trim()) {
      this.createNewCategory(name.trim());
    }
  }

  // Créer une nouvelle catégorie
  async createNewCategory(name) {
    try {
      const result = await window.electronAPI.createCategory({ name, icon: '📁' });
      
      if (result.success) {
        // Recharger les données et réafficher
        await this.refresh();
        
        console.log('Nouvelle catégorie créée:', name);
      } else {
        alert('Erreur lors de la création de la catégorie: ' + result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la création de la catégorie:', error);
      alert('Erreur lors de la création de la catégorie');
    }
  }

  // Actualiser les catégories
  async refresh() {
    await this.loadCategories();
    await this.loadAllMovies();
    this.organizeMoviesByCategory();
    this.displayAllSections();
  }
}

// Initialiser le système de catégories quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si on est sur la page dashboard
  if (document.getElementById('dashboard-content')) {
    window.dashboardCategories = new DashboardCategories();
  }
});