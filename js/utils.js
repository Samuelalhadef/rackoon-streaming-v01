/**
 * Utilitaires partagés pour l'application Rackoon Streaming
 */

// Image par défaut SVG en base64 (variable globale)
window.DEFAULT_THUMBNAIL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMxZTNhNmQiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2Ij7wn46sIEZpbG08L3RleHQ+PC9zdmc+';

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
      return JSON.parse(localStorage.getItem('userPrefs_global') || '{}');
    } catch (e) {
      console.error('Erreur lors du chargement des préférences:', e);
      return {};
    }
  },

  save: function(prefs) {
    try {
      const existing = this.load();
      const updated = { ...existing, ...prefs };
      localStorage.setItem('userPrefs_global', JSON.stringify(updated));
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

// Gestion intelligente des images avec génération automatique de thumbnails
window.setupImageWithFallback = async function(img, mediaId, posterUrl, thumbnailName, alt = '') {
  img.alt = alt;

  // Priorité 1: POSTER (affiche officielle)
  if (posterUrl) {
    img.onerror = () => {
      // Si le poster échoue, essayer le thumbnail
      setupImageThumbnailWithGeneration(img, mediaId, thumbnailName);
    };
    img.src = posterUrl;
    return;
  }

  // Priorité 2: THUMBNAIL (avec génération automatique si manquant)
  setupImageThumbnailWithGeneration(img, mediaId, thumbnailName);
};

// Fonction helper pour gérer le thumbnail avec génération automatique
async function setupImageThumbnailWithGeneration(img, mediaId, thumbnailName) {
  if (thumbnailName) {
    // Utiliser l'URL HTTP du serveur local au lieu du chemin relatif
    const thumbnailFilename = thumbnailName.split(/[\\\/]/).pop();
    const thumbnailUrl = `http://localhost:3001/thumbnails/${thumbnailFilename}`;

    let attemptedGeneration = false;

    img.onerror = async () => {
      // Éviter les boucles infinies
      if (img.dataset.errorHandled === 'true') return;
      img.dataset.errorHandled = 'true';

      // Si le thumbnail n'existe pas et qu'on n'a pas encore essayé de le générer
      if (!attemptedGeneration && mediaId && window.electronAPI && window.electronAPI.generateThumbnail) {
        attemptedGeneration = true;

        try {
          const result = await window.electronAPI.generateThumbnail(mediaId);
          if (result.success && result.thumbnail) {
            // Réessayer de charger l'image avec le nouveau thumbnail via HTTP
            img.dataset.errorHandled = 'false';
            const newThumbnailFilename = result.thumbnail.split(/[\\\/]/).pop();
            img.src = `http://localhost:3001/thumbnails/${newThumbnailFilename}`;
            return;
          }
        } catch (error) {
          console.error(`❌ Thumbnail:`, error);
        }
      }

      // Fallback final: image par défaut
      img.src = window.DEFAULT_THUMBNAIL;
      img.onerror = null;
    };

    img.src = thumbnailUrl;
  } else {
    // Pas de thumbnail, utiliser l'image par défaut
    img.src = window.DEFAULT_THUMBNAIL;
  }
}


// Mise à jour de l'affichage des étoiles
window.updateStarsDisplay = function(container, rating) {
  console.log('🌟 updateStarsDisplay appelé - container:', container, 'rating:', rating);

  if (!container) {
    console.warn('⚠️ Container non fourni');
    return;
  }

  // Si le container est une carte, chercher le container d'étoiles dedans
  let starsContainer = container;
  if (container.classList && container.classList.contains('media-card')) {
    console.log('📦 Container est une carte, recherche du container d\'étoiles...');
    starsContainer = container.querySelector('.rating-stars') || container.querySelector('.stars-container');
    if (!starsContainer) {
      console.warn('⚠️ Container d\'étoiles non trouvé dans la carte');
      console.log('🔍 Classes de la carte:', container.className);
      console.log('🔍 HTML de la carte:', container.innerHTML.substring(0, 500));
      return;
    }
    console.log('✅ Container d\'étoiles trouvé:', starsContainer.className);
  }

  const stars = starsContainer.querySelectorAll('.star');
  if (stars.length === 0) {
    console.warn('⚠️ Aucune étoile trouvée dans le container');
    console.log('🔍 HTML du container:', starsContainer.innerHTML);
    return;
  }

  console.log(`✨ ${stars.length} étoiles trouvées, mise à jour...`);
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });

  console.log(`✅ Étoiles mises à jour: ${rating}/5`);
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

// ========================================
// SYSTÈME RACKOON LIVE - Thème Rouge/Noir
// ========================================

// Initialiser le thème au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  // Charger la préférence sauvegardée
  const isLiveMode = localStorage.getItem('rackoonLiveMode') === 'true';
  if (isLiveMode) {
    document.body.classList.add('rackoon-live');
  }

  // Attacher l'événement au bouton
  const liveBtn = document.getElementById('rackoon-live-btn');
  if (liveBtn) {
    liveBtn.addEventListener('click', window.toggleRackoonLive);
  }
});

// Fonction pour basculer le mode Rackoon Live
window.toggleRackoonLive = function() {
  const body = document.body;
  const isActive = body.classList.toggle('rackoon-live');

  // Sauvegarder la préférence
  localStorage.setItem('rackoonLiveMode', isActive);

  // Message de confirmation
  const message = isActive ? 'Mode Rackoon Live activé 🔴' : 'Mode normal activé ⚪';
  console.log(message);
};