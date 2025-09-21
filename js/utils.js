/**
 * Utilitaires partagés pour l'application Rackoon Streaming
 */

// Formatage du temps/durée
window.formatTime = function(seconds) {
  if (!seconds || seconds === 0) return '0min';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}min`;
  } else if (minutes > 0) {
    return `${minutes}min${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
  } else {
    return `${remainingSeconds}s`;
  }
};

// Formatage de la taille des fichiers
window.formatFileSize = function(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};

// Gestion des préférences utilisateur
window.userPreferences = {
  load: function() {
    try {
      return JSON.parse(localStorage.getItem('userPreferences') || '{}');
    } catch (e) {
      console.error('Erreur lors du chargement des préférences:', e);
      return {};
    }
  },

  save: function(prefs) {
    try {
      const existing = this.load();
      const updated = { ...existing, ...prefs };
      localStorage.setItem('userPreferences', JSON.stringify(updated));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde des préférences:', e);
    }
  }
};

// Gestion des modifications locales de films
window.movieEdits = {
  load: function() {
    try {
      return JSON.parse(localStorage.getItem('movieEdits') || '{}');
    } catch (e) {
      console.error('Erreur lors du chargement des modifications:', e);
      return {};
    }
  },

  save: async function(movieId, edits) {
    try {
      // Sauvegarder d'abord en localStorage pour la compatibilité
      const existing = this.load();
      existing[movieId] = { ...existing[movieId], ...edits };
      localStorage.setItem('movieEdits', JSON.stringify(existing));
      
      // Puis sauvegarder dans la base JSON via l'API
      if (window.electronAPI && window.electronAPI.updateMedia) {
        const result = await window.electronAPI.updateMedia(movieId, edits);
        if (result.success) {
          console.log('✅ Modifications sauvegardées dans la base JSON:', edits);
          
          // Optionnel: nettoyer localStorage après sauvegarde réussie
          // delete existing[movieId];
          // localStorage.setItem('movieEdits', JSON.stringify(existing));
        } else {
          console.error('❌ Erreur sauvegarde base JSON:', result.message);
        }
      } else {
        console.warn('⚠️ API updateMedia non disponible, sauvegarde en localStorage uniquement');
      }
    } catch (e) {
      console.error('Erreur lors de la sauvegarde des modifications:', e);
    }
  },

  get: function(movieId) {
    const edits = this.load();
    return edits[movieId] || {};
  }
};

// Gestion des images par défaut
window.handleImageError = function(img, defaultSrc = '../public/img/default-thumbnail.svg') {
  img.onerror = () => { img.src = defaultSrc; };
};

// Mise à jour de l'affichage des étoiles
window.updateStarsDisplay = function(container, rating) {
  if (!container) return;
  
  const stars = container.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });
};

// Configuration d'interaction avec les étoiles
window.setupStarsInteraction = function(container, onRate) {
  if (!container || !onRate) return;
  
  const stars = container.querySelectorAll('.star');
  stars.forEach((star, index) => {
    star.addEventListener('click', () => onRate(index + 1));
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, i) => {
        s.classList.toggle('hover', i <= index);
      });
    });
  });
  
  container.addEventListener('mouseleave', () => {
    stars.forEach(s => s.classList.remove('hover'));
  });
};