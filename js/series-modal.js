/**
 * Gestionnaire de la modale série
 */
class SeriesModal {
  constructor() {
    this.modal = document.getElementById('series-modal-overlay');
    console.log('🔍 Element series-modal-overlay trouvé:', !!this.modal);
    this.currentSeries = null;
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Fermeture de la modale
    const closeBtn = document.getElementById('series-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Fermeture en cliquant sur l'overlay
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.hide();
        }
      });
    }

    // Gestion des boutons
    const playBtn = document.getElementById('btn-play-series');
    const editBtn = document.getElementById('btn-edit-series');

    if (playBtn) {
      playBtn.addEventListener('click', () => this.playFirstEpisode());
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => this.editSeries());
    }
  }

  async show(seriesId) {
    try {
      console.log('📺 Affichage de la série:', seriesId);

      // Récupérer les données de la série
      const result = await window.electronAPI.getSeriesById(seriesId);

      if (!result.success) {
        console.error('❌ Erreur lors du chargement de la série:', result.message);
        return;
      }

      this.currentSeries = result.series;
      this.populateModal(this.currentSeries);
      this.modal.style.display = 'flex';

      // Animation d'apparition
      requestAnimationFrame(() => {
        this.modal.classList.add('active');
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage de la série:', error);
    }
  }

  hide() {
    if (this.modal) {
      this.modal.classList.remove('active');
      setTimeout(() => {
        this.modal.style.display = 'none';
      }, 400);
    }
    this.currentSeries = null;
  }

  populateModal(series) {
    // Titre et métadonnées
    const titleElement = document.getElementById('series-title');
    const yearElement = document.getElementById('series-year');
    const episodeCountElement = document.getElementById('series-episode-count');
    const descriptionElement = document.getElementById('series-description');
    const posterElement = document.getElementById('series-poster');

    if (titleElement) titleElement.textContent = series.name;
    if (yearElement) yearElement.textContent = series.year || 'Année inconnue';
    if (episodeCountElement) {
      const totalEpisodes = series.episodeCount || 0;
      episodeCountElement.textContent = `${totalEpisodes} épisode${totalEpisodes > 1 ? 's' : ''}`;
    }
    if (descriptionElement) {
      descriptionElement.textContent = series.description || 'Aucune description disponible.';
    }
    if (posterElement) {
      // Utiliser la miniature du premier épisode comme poster de série
      if (series.seasons && series.seasons[0] && series.seasons[0].episodes && series.seasons[0].episodes[0]) {
        const firstEpisode = series.seasons[0].episodes[0];
        if (firstEpisode.thumbnail) {
          posterElement.src = `../data/thumbnails/${firstEpisode.thumbnail}`;
        }
      }
      posterElement.onerror = () => {
        posterElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTZweCI+UE9TVEVSPC90ZXh0Pgo8L3N2Zz4K';
      };
    }

    // Générer les saisons et épisodes
    this.populateSeasons(series.seasons || []);
  }

  populateSeasons(seasons) {
    const seasonsContainer = document.getElementById('seasons-container');
    if (!seasonsContainer) return;

    seasonsContainer.innerHTML = '';

    if (!seasons || seasons.length === 0) {
      seasonsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #888;">
          <i class="fas fa-tv" style="font-size: 48px; margin-bottom: 16px;"></i>
          <p>Aucun épisode trouvé pour cette série.</p>
        </div>
      `;
      return;
    }

    seasons.forEach(season => {
      const seasonElement = this.createSeasonElement(season);
      seasonsContainer.appendChild(seasonElement);
    });
  }

  createSeasonElement(season) {
    const template = document.getElementById('season-template');
    const seasonElement = template.content.cloneNode(true);

    // Remplir les informations de la saison
    const seasonNumber = seasonElement.querySelector('.season-number');
    const seasonEpisodeCount = seasonElement.querySelector('.season-episode-count');
    const episodesGrid = seasonElement.querySelector('.episodes-grid');

    if (seasonNumber) {
      seasonNumber.textContent = season.number;
    }

    if (seasonEpisodeCount) {
      const episodeCount = season.episodes ? season.episodes.length : 0;
      seasonEpisodeCount.textContent = `${episodeCount} épisode${episodeCount > 1 ? 's' : ''}`;
    }

    // Ajouter les épisodes
    if (season.episodes && episodesGrid) {
      season.episodes.forEach(episode => {
        const episodeElement = this.createEpisodeElement(episode, season.number);
        episodesGrid.appendChild(episodeElement);
      });
    }

    return seasonElement;
  }

  createEpisodeElement(episode, seasonNumber) {
    const template = document.getElementById('episode-template');
    const episodeElement = template.content.cloneNode(true);
    const card = episodeElement.querySelector('.episode-card');

    // Définir l'ID de l'épisode
    if (card) {
      card.dataset.episodeId = episode.id;
      card.addEventListener('click', () => this.playEpisode(episode));
    }

    // Remplir les informations
    const thumbnail = episodeElement.querySelector('.episode-thumbnail');
    const duration = episodeElement.querySelector('.episode-duration');
    const episodeNumber = episodeElement.querySelector('.episode-number');
    const episodeTitle = episodeElement.querySelector('.episode-title');
    const episodeDate = episodeElement.querySelector('.episode-date');
    const playBtn = episodeElement.querySelector('.episode-play-btn');

    if (thumbnail) {
      thumbnail.src = episode.thumbnail ? `../data/thumbnails/${episode.thumbnail}` : '';
      thumbnail.onerror = () => {
        thumbnail.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDI4MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTUwIiBmaWxsPSIjMjIyIi8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTRweCI+VFVOTU5BSUw8L3RleHQ+Cjwvc3ZnPgo=';
      };
    }

    if (duration && episode.duration) {
      duration.textContent = this.formatDuration(episode.duration);
    }

    if (episodeNumber) {
      if (episode.episode_number) {
        episodeNumber.textContent = `S${seasonNumber.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}`;
      } else {
        episodeNumber.textContent = `S${seasonNumber.toString().padStart(2, '0')}`;
      }
    }

    if (episodeTitle) {
      episodeTitle.textContent = episode.title || `Épisode ${episode.episode_number || '?'}`;
    }

    if (episodeDate && episode.dateAdded) {
      const date = new Date(episode.dateAdded);
      episodeDate.textContent = date.toLocaleDateString('fr-FR');
    }

    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playEpisode(episode);
      });
    }

    return episodeElement;
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  playEpisode(episode) {
    console.log('🎬 Lecture de l\'épisode:', episode.title);
    // Fermer la modale et lancer la lecture
    this.hide();

    // Utiliser le système de lecture existant
    if (window.playVideo) {
      window.playVideo(episode.path, episode.title);
    } else {
      console.error('❌ Fonction playVideo non trouvée');
    }
  }

  playFirstEpisode() {
    if (!this.currentSeries || !this.currentSeries.seasons) return;

    // Trouver le premier épisode de la première saison
    const firstSeason = this.currentSeries.seasons[0];
    if (firstSeason && firstSeason.episodes && firstSeason.episodes.length > 0) {
      const firstEpisode = firstSeason.episodes[0];
      this.playEpisode(firstEpisode);
    }
  }

  editSeries() {
    console.log('✏️ Édition de la série:', this.currentSeries.name);
    // TODO: Implémenter l'édition des séries
    alert('Fonctionnalité d\'édition des séries à venir !');
  }
}

// Initialiser le gestionnaire de modale série
let seriesModal;

document.addEventListener('DOMContentLoaded', () => {
  seriesModal = new SeriesModal();
});

// Fonction globale pour ouvrir une série
window.openSeries = function(seriesId) {
  console.log('🔍 openSeries appelée avec ID:', seriesId);
  console.log('🔍 seriesModal existe:', !!seriesModal);

  if (seriesModal) {
    seriesModal.show(seriesId);
  } else {
    console.error('❌ seriesModal non initialisé');
  }
};