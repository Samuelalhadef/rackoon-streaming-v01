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

// Ancienne fonction pour compatibilité (deprecated)
window.handleImageError = function(img, defaultSrc = window.DEFAULT_THUMBNAIL) {
  img.onerror = () => {
    img.src = defaultSrc;
    img.onerror = null;
  };
};

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
    liveBtn.addEventListener('click', toggleRackoonLive);
  }
});

// Fonction pour basculer le mode Rackoon Live
function toggleRackoonLive() {
  const body = document.body;
  const isActive = body.classList.toggle('rackoon-live');

  // Sauvegarder la préférence
  localStorage.setItem('rackoonLiveMode', isActive);

  // Animations GSAP fluides et modernes
  if (typeof gsap !== 'undefined') {
    // Animation de la page entière avec effet de morphing
    gsap.to(body, {
      duration: 0.8,
      ease: 'power3.inOut',
      onStart: () => {
        body.style.transition = 'background 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    });

    // Animer toutes les cartes de médias avec un effet de vague
    const mediaCards = document.querySelectorAll('.media-card');
    if (mediaCards.length > 0) {
      gsap.from(mediaCards, {
        duration: 0.6,
        scale: 0.95,
        opacity: 0.8,
        y: 20,
        stagger: {
          amount: 0.4,
          from: 'start',
          ease: 'power2.out'
        },
        ease: 'back.out(1.2)',
        clearProps: 'all'
      });
    }

    // Animer les sections de catégories
    const categorySections = document.querySelectorAll('.category-section');
    if (categorySections.length > 0) {
      gsap.from(categorySections, {
        duration: 0.7,
        opacity: 0,
        y: 30,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'all'
      });
    }

    // Effet de brillance liquide sur le bouton
    const liveBtn = document.getElementById('rackoon-live-btn');
    if (liveBtn) {
      gsap.to(liveBtn, {
        duration: 0.4,
        scale: 1.05,
        ease: 'elastic.out(1, 0.5)',
        yoyo: true,
        repeat: 1
      });

      // Effet de glow pulsant si activé
      if (isActive) {
        gsap.to(liveBtn, {
          duration: 2,
          boxShadow: '0 0 20px rgba(74, 158, 255, 0.6), 0 0 40px rgba(74, 158, 255, 0.3)',
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });
      } else {
        gsap.killTweensOf(liveBtn);
        gsap.to(liveBtn, { duration: 0.3, boxShadow: 'none' });
      }
    }

    // Effet de particules liquides
    createLiquidParticles(isActive);
  }

  // Message de confirmation
  const message = isActive ? 'Mode Rackoon Live activé 🔴' : 'Mode normal activé ⚪';
  console.log(message);
}

// Créer un effet de particules liquides lors du changement de thème
function createLiquidParticles(isActive) {
  if (!isActive) return; // Particules uniquement lors de l'activation

  const colors = ['#4A9EFF', '#64B5F6', '#90CAF9'];
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'liquid-particles';
  particlesContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 9999;
  `;
  document.body.appendChild(particlesContainer);

  // Créer 20 particules
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 6 + 2}px;
      height: ${Math.random() * 6 + 2}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: 50%;
      filter: blur(2px);
      opacity: 0;
      box-shadow: 0 0 10px currentColor;
    `;

    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    particle.style.left = startX + 'px';
    particle.style.top = startY + 'px';

    particlesContainer.appendChild(particle);

    // Animer chaque particule
    gsap.to(particle, {
      duration: Math.random() * 2 + 1,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      opacity: 1,
      scale: Math.random() * 2 + 1,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(particle, {
          duration: 0.5,
          opacity: 0,
          scale: 0,
          ease: 'power2.in'
        });
      }
    });
  }

  // Nettoyer après l'animation
  setTimeout(() => {
    particlesContainer.remove();
  }, 3500);
}