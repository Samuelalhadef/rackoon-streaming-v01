/**
 * Gestionnaire de statistiques et notations
 * Gère l'affichage et le suivi des statistiques de visionnage
 */

class StatsManager {
  constructor() {
    this.userPrefs = this.loadUserPrefs();
    this.allMovies = [];
    this.init();
  }

  init() {
    console.log('📊 Initialisation du gestionnaire de statistiques');
    this.attachEventListeners();
    this.loadStats();
  }

  // Charger les préférences utilisateur depuis localStorage
  loadUserPrefs() {
    const prefs = localStorage.getItem('userPrefs_global');
    if (!prefs) {
      return {
        watchedMovies: {},
        ratings: {},
        watchHistory: [],
        watchTime: {}
      };
    }

    const parsed = JSON.parse(prefs);
    // S'assurer que toutes les propriétés existent
    if (!parsed.watchedMovies) parsed.watchedMovies = {};
    if (!parsed.ratings) parsed.ratings = {};
    if (!parsed.watchHistory) parsed.watchHistory = [];
    if (!parsed.watchTime) parsed.watchTime = {};

    return parsed;
  }

  // Sauvegarder les préférences
  saveUserPrefs() {
    localStorage.setItem('userPrefs_global', JSON.stringify(this.userPrefs));
  }

  // Attacher les événements
  attachEventListeners() {
    const refreshBtn = document.getElementById('stats-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        console.log('🔄 Actualisation des statistiques...');
        this.loadStats();
      });
    }
  }

  // Charger toutes les statistiques
  async loadStats() {
    try {
      // Récupérer tous les médias
      const result = await window.electronAPI.getAllMedias();
      if (result.success) {
        this.allMovies = result.medias;

        // Mettre à jour toutes les statistiques
        this.updateOverviewStats();
        this.updateTopWatched();
        this.updateRecentHistory();
        this.updateTopRated();
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des statistiques:', error);
    }
  }

  // Mettre à jour les statistiques générales
  updateOverviewStats() {
    // Recharger les préférences pour avoir les données les plus récentes
    this.userPrefs = this.loadUserPrefs();

    // Nombre de médias visionnés
    const watchedCount = Object.keys(this.userPrefs.watchedMovies).length;
    document.getElementById('total-watched-count').textContent = watchedCount;

    // Nombre de médias notés
    const ratedCount = Object.keys(this.userPrefs.ratings).length;
    document.getElementById('total-rated-count').textContent = ratedCount;

    // Note moyenne
    const ratings = Object.values(this.userPrefs.ratings);
    if (ratings.length > 0) {
      const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
      document.getElementById('average-rating').textContent = `${avgRating} ⭐`;
    } else {
      document.getElementById('average-rating').textContent = '-';
    }

    // Temps total de visionnage
    const totalMinutes = Object.values(this.userPrefs.watchTime || {}).reduce((a, b) => a + b, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    document.getElementById('total-watch-time').textContent = `${hours}h ${minutes}m`;
  }

  // Mettre à jour le top 5 des films les plus regardés
  updateTopWatched() {
    const container = document.getElementById('top-watched-list');

    // Créer un tableau avec les films et leur nombre de vues
    const watchedMovies = [];
    for (const [movieId, data] of Object.entries(this.userPrefs.watchedMovies)) {
      const movie = this.allMovies.find(m => m.id === movieId);
      if (movie) {
        watchedMovies.push({
          movie,
          viewCount: data.viewCount || 1,
          lastWatched: data.lastWatched || null
        });
      }
    }

    // Trier par nombre de vues (décroissant)
    watchedMovies.sort((a, b) => b.viewCount - a.viewCount);

    // Prendre les 5 premiers
    const top5 = watchedMovies.slice(0, 5);

    if (top5.length === 0) {
      container.innerHTML = `
        <div class="stats-empty">
          <i class="fas fa-eye-slash"></i>
          <p>Aucun visionnage enregistré</p>
        </div>
      `;
      return;
    }

    // Générer le HTML
    container.innerHTML = top5.map((item, index) => `
      <div class="stats-item">
        <div class="stats-item-rank">#${index + 1}</div>
        <div class="stats-item-thumbnail">
          ${item.movie.thumbnail ?
            `<img src="../data/thumbnails/${item.movie.thumbnail}" alt="${item.movie.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <i class="fas fa-film" style="display:none;"></i>` :
            '<i class="fas fa-film"></i>'
          }
        </div>
        <div class="stats-item-info">
          <div class="stats-item-title">${this.truncate(item.movie.title, 40)}</div>
          <div class="stats-item-meta">
            <span class="stats-badge">
              <i class="fas fa-eye"></i> ${item.viewCount} vue${item.viewCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Mettre à jour l'historique récent
  updateRecentHistory() {
    const container = document.getElementById('recent-history-list');

    // Créer un tableau avec tous les films visionnés et leurs dates
    const history = [];
    for (const [movieId, data] of Object.entries(this.userPrefs.watchedMovies)) {
      const movie = this.allMovies.find(m => m.id === movieId);
      if (movie && data.lastWatched) {
        history.push({
          movie,
          lastWatched: new Date(data.lastWatched),
          viewCount: data.viewCount || 1
        });
      }
    }

    // Trier par date (plus récent d'abord)
    history.sort((a, b) => b.lastWatched - a.lastWatched);

    // Prendre les 5 premiers
    const recent5 = history.slice(0, 5);

    if (recent5.length === 0) {
      container.innerHTML = `
        <div class="stats-empty">
          <i class="fas fa-clock"></i>
          <p>Aucun historique disponible</p>
        </div>
      `;
      return;
    }

    // Générer le HTML
    container.innerHTML = recent5.map(item => `
      <div class="stats-item">
        <div class="stats-item-thumbnail">
          ${item.movie.thumbnail ?
            `<img src="../data/thumbnails/${item.movie.thumbnail}" alt="${item.movie.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <i class="fas fa-film" style="display:none;"></i>` :
            '<i class="fas fa-film"></i>'
          }
        </div>
        <div class="stats-item-info">
          <div class="stats-item-title">${this.truncate(item.movie.title, 40)}</div>
          <div class="stats-item-meta">
            <span class="stats-badge">
              <i class="fas fa-calendar"></i> ${this.formatDate(item.lastWatched)}
            </span>
            ${item.viewCount > 1 ? `
              <span class="stats-badge">
                <i class="fas fa-eye"></i> ${item.viewCount}×
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  // Mettre à jour le top des meilleures notes
  updateTopRated() {
    const container = document.getElementById('top-rated-list');

    // Créer un tableau avec les films notés
    const ratedMovies = [];
    for (const [movieId, rating] of Object.entries(this.userPrefs.ratings)) {
      const movie = this.allMovies.find(m => m.id === movieId);
      if (movie) {
        ratedMovies.push({
          movie,
          rating
        });
      }
    }

    // Trier par note (décroissant)
    ratedMovies.sort((a, b) => b.rating - a.rating);

    // Prendre les 5 premiers
    const top5 = ratedMovies.slice(0, 5);

    if (top5.length === 0) {
      container.innerHTML = `
        <div class="stats-empty">
          <i class="fas fa-star-half-alt"></i>
          <p>Aucune notation enregistrée</p>
        </div>
      `;
      return;
    }

    // Générer le HTML
    container.innerHTML = top5.map(item => `
      <div class="stats-item">
        <div class="stats-item-thumbnail">
          ${item.movie.thumbnail ?
            `<img src="../data/thumbnails/${item.movie.thumbnail}" alt="${item.movie.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <i class="fas fa-film" style="display:none;"></i>` :
            '<i class="fas fa-film"></i>'
          }
        </div>
        <div class="stats-item-info">
          <div class="stats-item-title">${this.truncate(item.movie.title, 40)}</div>
          <div class="stats-item-meta">
            <span class="stats-badge rating">
              ${this.generateStars(item.rating)}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Générer les étoiles pour une note
  generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars += '<i class="fas fa-star filled"></i>';
      } else {
        stars += '<i class="fas fa-star"></i>';
      }
    }
    return stars;
  }

  // Formater une date
  formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Aujourd'hui";
    } else if (days === 1) {
      return 'Hier';
    } else if (days < 7) {
      return `Il y a ${days} jours`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  // Tronquer un texte
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Enregistrer un visionnage
  static recordWatch(movieId, duration = 0) {
    const prefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');

    if (!prefs.watchedMovies) prefs.watchedMovies = {};
    if (!prefs.watchHistory) prefs.watchHistory = [];
    if (!prefs.watchTime) prefs.watchTime = {};

    // Mettre à jour les données de visionnage
    // Vérifier si l'entrée existe et est un objet (pas un booléen d'ancienne version)
    const existingEntry = prefs.watchedMovies[movieId];
    const isValidObject = existingEntry && typeof existingEntry === 'object' && !Array.isArray(existingEntry);

    if (!existingEntry || !isValidObject) {
      // Créer une nouvelle entrée (ou remplacer un booléen legacy)
      prefs.watchedMovies[movieId] = {
        viewCount: 1,
        lastWatched: new Date().toISOString(),
        firstWatched: new Date().toISOString()
      };
    } else {
      prefs.watchedMovies[movieId].viewCount = (prefs.watchedMovies[movieId].viewCount || 1) + 1;
      prefs.watchedMovies[movieId].lastWatched = new Date().toISOString();
    }

    // Ajouter à l'historique
    prefs.watchHistory.unshift({
      movieId,
      date: new Date().toISOString(),
      duration
    });

    // Limiter l'historique à 100 entrées
    if (prefs.watchHistory.length > 100) {
      prefs.watchHistory = prefs.watchHistory.slice(0, 100);
    }

    // Ajouter le temps de visionnage (en minutes)
    if (duration > 0) {
      prefs.watchTime[movieId] = (prefs.watchTime[movieId] || 0) + Math.round(duration / 60);
    }

    localStorage.setItem('userPrefs_global', JSON.stringify(prefs));

    console.log(`📊 Visionnage enregistré pour ${movieId}:`, {
      viewCount: prefs.watchedMovies[movieId].viewCount,
      duration: duration
    });
  }

  // Enregistrer le temps de visionnage
  static updateWatchTime(movieId, seconds) {
    const prefs = JSON.parse(localStorage.getItem('userPrefs_global') || '{}');

    if (!prefs.watchTime) prefs.watchTime = {};

    const minutes = Math.round(seconds / 60);
    prefs.watchTime[movieId] = (prefs.watchTime[movieId] || 0) + minutes;

    localStorage.setItem('userPrefs_global', JSON.stringify(prefs));
  }
}

// Initialiser le gestionnaire de statistiques au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.statsManager = new StatsManager();
});
