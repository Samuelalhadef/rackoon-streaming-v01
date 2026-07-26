/**
 * Lecteur vidéo moderne complet pour Rackoon Streaming
 */

class VideoPlayer {
  constructor() {
    this.modal = null;
    this.container = null;
    this.video = null;
    this.currentMovie = null;
    this.seriesContext = null; // { episodes: [...], currentIndex: n } pour les séries

    // États
    this.isPlaying = false;
    this.isFullscreen = false;
    this.isMiniPlayer = false;
    this._miniDragActive = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 0.5; // Volume par défaut à 50%
    this.playbackRate = 1;
    this.controlsVisible = true;
    this.isClosing = false;

    // Watch Party
    this.watchPartyActive = false;
    this.isSyncingFromRemote = false; // Empêche les boucles d'événements

    // Audio tracks
    this.originalMoviePath = null; // Chemin original du fichier vidéo
    this.selectedAudioTrack = null; // Piste audio sélectionnée
    this.detectedAudioTracks = null; // Pistes audio détectées via FFmpeg
    this.detectedVideoTracks = null; // Pistes vidéo détectées via FFmpeg
    this.needsVideoTranscode = false; // Flag si HEVC/H.265 nécessite transcodage
    this.hasTriedTranscode = false; // Flag pour éviter les boucles de transcodage
    this.isRetryingWithTranscode = false; // Flag pour ignorer onVideoError pendant retry
    this.isShowingConversionDialog = false; // Flag pour éviter les dialogues multiples
    this.selectedAudioTracksForConversion = [0]; // Pistes audio sélectionnées pour la conversion

    // Timers
    this.hideControlsTimer = null;
    this.progressUpdateTimer = null;

    // Progress tracking
    this._lastProgressSave = 0;
    this._resumeTime = 0;

    // Éléments du lecteur
    this.elements = {};
    
    this.init();
  }
  
  init() {
    this.createPlayerHTML();
    this.setupEventListeners();
    this.setupKeyboardControls();
  }
  
  createPlayerHTML() {
    // Créer la modal du lecteur
    this.modal = document.createElement('div');
    this.modal.className = 'video-player-modal';
    this.modal.innerHTML = `
      <!-- Bouton fermer - EN DEHORS du container pour éviter overflow:hidden -->
      <button class="close-btn" title="Fermer (Échap)">
        <img src="../assets/pictos/times.svg" class="picto-icon">
      </button>

      <div class="video-player-container">
        <!-- Élément vidéo principal -->
        <video class="video-player-element" controls="false" controlslist="nodownload nofullscreen noremoteplayback" preload="auto"></video>

        <!-- Informations vidéo -->
        <div class="video-info">
          <div class="video-title"></div>
          <div class="video-details"></div>
        </div>

        <!-- Indicateurs de chargement -->
        <div class="loading-indicator">
          <div class="spinner-anim"></div>
        </div>
        
        <div class="buffering-indicator"></div>

        <!-- Mini lecteur overlay -->
        <div class="mini-player-overlay">
          <div class="mini-player-top">
            <span class="mini-player-title"></span>
            <button class="mini-ctrl-btn mini-expand-btn" title="Agrandir">
              <img src="../assets/pictos/expand.svg" class="picto-icon">
            </button>
            <button class="mini-ctrl-btn mini-close-btn" title="Fermer">
              <img src="../assets/pictos/times.svg" class="picto-icon">
            </button>
          </div>
        </div>

        <!-- Contrôles vidéo -->
        <div class="video-controls">
          <!-- Timeline -->
          <div class="timeline-container">
            <div class="time-display" style="opacity: 0;">00:00</div>
            <div class="timeline">
              <div class="timeline-buffer"></div>
              <div class="timeline-progress"></div>
              <div class="timeline-thumb"></div>
            </div>
          </div>
          
          <!-- Contrôles principaux -->
          <div class="main-controls">
            <div class="controls-left">
              <button class="control-btn prev-episode-btn" title="Épisode précédent (P)" style="display:none">
                <img src="../assets/pictos/step-backward.svg" class="picto-icon">
              </button>

              <button class="control-btn play-pause" title="Lecture/Pause (Espace)">
                <img src="../assets/pictos/play.svg" class="picto-icon">
              </button>

              <button class="control-btn next-episode-btn" title="Épisode suivant (N)" style="display:none">
                <img src="../assets/pictos/step-forward.svg" class="picto-icon">
              </button>

              <div class="volume-container">
                <button class="control-btn volume-btn" title="Volume">
                  <img src="../assets/pictos/volume-up.svg" class="picto-icon">
                </button>
                <div class="volume-slider">
                  <div class="volume-progress"></div>
                </div>
              </div>
            </div>
            
            <div class="controls-center">
              <span class="time-current">00:00</span>
              <span>/</span>
              <span class="time-duration">00:00</span>
            </div>
            
            <div class="controls-right">
              <button class="control-btn audio-btn" title="Pistes audio">
                <img src="../assets/pictos/sliders-h.svg" class="picto-icon">
              </button>

              <button class="control-btn subtitle-btn" title="Sous-titres">
                <img src="../assets/pictos/list.svg" class="picto-icon">
              </button>

              <button class="control-btn speed-btn" title="Vitesse de lecture">
                <img src="../assets/pictos/bolt.svg" class="picto-icon">
                <span class="speed-text">1x</span>
              </button>

              <button class="control-btn mini-player-btn" title="Mini lecteur">
                <img src="../assets/pictos/pip.svg" class="picto-icon">
              </button>

              <button class="control-btn fullscreen-btn" title="Plein écran (F)">
                <img src="../assets/pictos/expand.svg" class="picto-icon">
              </button>
            </div>
          </div>
        </div>
        
        <!-- Menu vitesse -->
        <div class="speed-menu">
          <button class="speed-option" data-speed="0.5">0.5x</button>
          <button class="speed-option" data-speed="0.75">0.75x</button>
          <button class="speed-option active" data-speed="1">Normal</button>
          <button class="speed-option" data-speed="1.25">1.25x</button>
          <button class="speed-option" data-speed="1.5">1.5x</button>
          <button class="speed-option" data-speed="2">2x</button>
        </div>
        
        <!-- Menu pistes audio -->
        <div class="audio-menu">
          <div class="menu-header">Pistes audio</div>
          <div class="audio-tracks"></div>
        </div>
        
        <!-- Menu sous-titres -->
        <div class="subtitle-menu">
          <div class="menu-header">Sous-titres</div>
          <div class="subtitle-tracks">
            <button class="subtitle-option active" data-track="-1">Désactivés</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Récupérer les éléments
    this.container = this.modal.querySelector('.video-player-container');
    this.video = this.modal.querySelector('.video-player-element');
    
    this.elements = {
      info: this.modal.querySelector('.video-info'),
      title: this.modal.querySelector('.video-title'),
      details: this.modal.querySelector('.video-details'),
      closeBtn: this.modal.querySelector('.close-btn'),
      loadingIndicator: this.modal.querySelector('.loading-indicator'),
      bufferingIndicator: this.modal.querySelector('.buffering-indicator'),
      controls: this.modal.querySelector('.video-controls'),
      timelineContainer: this.modal.querySelector('.timeline-container'),
      timeDisplay: this.modal.querySelector('.time-display'),
      timeline: this.modal.querySelector('.timeline'),
      timelineBuffer: this.modal.querySelector('.timeline-buffer'),
      timelineProgress: this.modal.querySelector('.timeline-progress'),
      timelineThumb: this.modal.querySelector('.timeline-thumb'),
      prevEpisodeBtn: this.modal.querySelector('.prev-episode-btn'),
      nextEpisodeBtn: this.modal.querySelector('.next-episode-btn'),
      playPauseBtn: this.modal.querySelector('.play-pause'),
      playPauseIcon: this.modal.querySelector('.play-pause .picto-icon'),
      volumeBtn: this.modal.querySelector('.volume-btn'),
      volumeIcon: this.modal.querySelector('.volume-btn .picto-icon'),
      volumeSlider: this.modal.querySelector('.volume-slider'),
      volumeProgress: this.modal.querySelector('.volume-progress'),
      timeCurrent: this.modal.querySelector('.time-current'),
      timeDuration: this.modal.querySelector('.time-duration'),
      speedBtn: this.modal.querySelector('.speed-btn'),
      speedText: this.modal.querySelector('.speed-text'),
      speedMenu: this.modal.querySelector('.speed-menu'),
      audioBtn: this.modal.querySelector('.audio-btn'),
      audioMenu: this.modal.querySelector('.audio-menu'),
      audioTracks: this.modal.querySelector('.audio-tracks'),
      subtitleBtn: this.modal.querySelector('.subtitle-btn'),
      subtitleMenu: this.modal.querySelector('.subtitle-menu'),
      subtitleTracks: this.modal.querySelector('.subtitle-tracks'),
      miniPlayerBtn: this.modal.querySelector('.mini-player-btn'),
      miniOverlay: this.modal.querySelector('.mini-player-overlay'),
      miniTitle: this.modal.querySelector('.mini-player-title'),
      miniExpandBtn: this.modal.querySelector('.mini-expand-btn'),
      miniCloseBtn: this.modal.querySelector('.mini-close-btn'),
      fullscreenBtn: this.modal.querySelector('.fullscreen-btn'),
      fullscreenIcon: this.modal.querySelector('.fullscreen-btn .picto-icon')
    };
  }
  
  setupEventListeners() {
    // Événements vidéo
    this.video.addEventListener('loadstart', () => this.showLoading());
    this.video.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
    this.video.addEventListener('canplay', () => this.hideLoading());
    this.video.addEventListener('waiting', () => this.showBuffering());
    this.video.addEventListener('playing', () => this.hideBuffering());
    this.video.addEventListener('timeupdate', () => this.updateProgress());
    this.video.addEventListener('progress', () => this.updateBuffer());
    this.video.addEventListener('ended', () => this.onVideoEnded());
    this.video.addEventListener('error', (e) => this.onVideoError(e));
    
    // Boutons de contrôle
    this.elements.closeBtn.addEventListener('click', () => this.close());
    this.elements.prevEpisodeBtn.addEventListener('click', () => this.playPreviousEpisode());
    this.elements.nextEpisodeBtn.addEventListener('click', () => this.playNextEpisode());
    this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.elements.volumeBtn.addEventListener('click', () => this.toggleMute());
    this.elements.speedBtn.addEventListener('click', () => this.toggleSpeedMenu());
    this.elements.audioBtn.addEventListener('click', () => this.toggleAudioMenu());
    this.elements.subtitleBtn.addEventListener('click', () => this.toggleSubtitleMenu());
    this.elements.miniPlayerBtn.addEventListener('click', () => this.toggleMiniPlayer());
    this.elements.miniExpandBtn.addEventListener('click', () => this.exitMiniPlayer());
    this.elements.miniCloseBtn.addEventListener('click', () => this.close());
    this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.setupMiniPlayerDrag();
    
    // Timeline
    this.setupTimelineDrag();
    this.elements.timelineContainer.addEventListener('mousemove', (e) => this.updateTimeDisplay(e));
    this.elements.timelineContainer.addEventListener('mouseleave', () => this.hideTimeDisplay());

    // Volume slider
    this.setupVolumeDrag();
    
    // Menu vitesse
    this.modal.querySelectorAll('.speed-option').forEach(btn => {
      btn.addEventListener('click', () => this.setPlaybackRate(parseFloat(btn.dataset.speed)));
    });
    
    // Menu sous-titres - bouton "Désactivés"
    this.elements.subtitleTracks.querySelector('[data-track="-1"]').addEventListener('click', () => {
      this.setSubtitleTrack(-1);
    });
    
    // Masquer/afficher les contrôles
    this.container.addEventListener('mousemove', () => this.showControlsTemporary());
    this.container.addEventListener('mouseleave', () => this.hideControlsDelayed());
    this.video.addEventListener('click', () => this.togglePlayPause());
    
    // Fermer sur clic extérieur
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    
    // Masquer menu vitesse sur clic extérieur
    document.addEventListener('click', (e) => {
      if (!this.elements.speedBtn.contains(e.target) && !this.elements.speedMenu.contains(e.target)) {
        this.elements.speedMenu.classList.remove('active');
      }
    });
  }
  
  setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      if (!this.modal.classList.contains('active')) return;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'KeyF':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          this.toggleMute();
          break;
        case 'KeyN':
          e.preventDefault();
          this.playNextEpisode();
          break;
        case 'KeyP':
          e.preventDefault();
          this.playPreviousEpisode();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seek(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.changeVolume(-0.1);
          break;
        case 'Digit0':
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
        case 'Digit8':
        case 'Digit9':
          e.preventDefault();
          const percent = parseInt(e.code.slice(-1)) / 10;
          this.seekToPercent(percent);
          break;
      }
    });
  }
  
  async open(movieId, movieTitle, moviePath, seriesContext = null, audioReady = false, originalPath = null) {
    try {
      // Validation des paramètres
      if (!movieTitle || typeof movieTitle !== 'string') {
        movieTitle = 'Vidéo sans titre';
      }

      if (!moviePath || typeof moviePath !== 'string') {
        throw new Error('Chemin de la vidéo manquant');
      }

      // originalPath = fichier source (MKV original), moviePath = fichier à jouer (peut être le converti)
      this.currentMovie = { id: movieId, title: movieTitle, path: moviePath, audioReady, originalPath: originalPath || moviePath };
      this.seriesContext = seriesContext;
      this.updateSeriesNavigation();
      this._lastProgressSave = 0;
      this._resumeTime = 0;

      // Charger la progression sauvegardée pour l'auto-reprise
      if (movieId && window.electronAPI?.getAllProgress) {
        try {
          const pr = await window.electronAPI.getAllProgress();
          if (pr.success) {
            const saved = pr.playProgress[movieId];
            if (saved && saved.time > 15) this._resumeTime = saved.time;
          }
        } catch (e) { /* silencieux */ }
      }

      // Enregistrer le moment de début du visionnage pour les statistiques
      this.watchStartTime = Date.now();

      // Afficher la modal
      this.modal.classList.add('active');

      // Mettre à jour les informations
      this.elements.title.textContent = movieTitle;
      this.elements.details.textContent = 'Chargement...';

      // Charger la vidéo
      this.showLoading();

      // Vérifier si c'est une URL HTTP (streaming) ou un chemin local
      let videoUrl;
      let defaultAudioTrack = null;

      if (moviePath.startsWith('http://') || moviePath.startsWith('https://')) {
        // URL de streaming - utiliser telle quelle
        videoUrl = moviePath;
        console.log('📡 URL de streaming:', videoUrl);
      } else {
        // Chemin local - construire l'URL immédiatement
        if (!moviePath) {
          throw new Error('Chemin de la vidéo non fourni');
        }

        // Stocker le chemin du fichier source (original) pour la détection et les sous-titres
        this.originalMoviePath = originalPath || moviePath;

        // Construire l'URL avec piste audio 0 par défaut (chargement rapide)
        videoUrl = `http://localhost:3002/local-video?path=${encodeURIComponent(moviePath)}&audioTrack=0`;
        console.log('🎬 URL vidéo locale via serveur:', videoUrl);

        // Détecter les pistes depuis le fichier ORIGINAL (langues, sous-titres)
        // même quand on joue la version convertie
        this.detectAndFixAudioInBackground(this.originalMoviePath);
      }

      this.video.src = videoUrl;

      // Initialiser les propriétés audio
      this.video.volume = this.volume;
      this.video.muted = false;

      // Charger les détails du film en parallèle (ne bloque pas)
      this.loadMovieDetailsInBackground(movieId);
      
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du lecteur:', error);
      this.hideLoading();
      alert('Erreur lors du chargement de la vidéo: ' + error.message);
      this.close();
    }
  }
  
  close() {
    this.isClosing = true; // Marquer comme en cours de fermeture

    // Nettoyer la Watch Party si active (détruit la session et ferme ngrok)
    if (window.watchPartyUI && window.watchPartyUI.currentSession) {
      console.log('🔌 Fermeture de la Watch Party depuis le lecteur');
      window.watchPartyUI.cleanup();
    }

    // Enregistrer les statistiques de visionnage avant de fermer
    if (this.currentMovie && this.currentMovie.id && this.watchStartTime) {
      const watchDuration = Math.floor((Date.now() - this.watchStartTime) / 1000); // Durée en secondes

      // Enregistrer seulement si le visionnage a duré au moins 10 secondes
      if (watchDuration >= 10) {
        console.log(`📊 Enregistrement du visionnage: ${this.currentMovie.title} (${watchDuration}s)`);

        // Appeler la méthode statique de StatsManager
        if (typeof StatsManager !== 'undefined' && typeof StatsManager.recordWatch === 'function') {
          StatsManager.recordWatch(this.currentMovie.id, watchDuration);

          // Actualiser les statistiques si le gestionnaire est initialisé
          if (window.statsManager) {
            setTimeout(() => window.statsManager.loadStats(), 500);
          }
        }
      }

      this.watchStartTime = null;
    }

    // Sauvegarder la progression finale avant fermeture
    this._saveProgress();

    this.pause();
    this.modal.classList.remove('active');

    // Nettoyer les tracks et URLs de sous-titres
    this._cancelSubtitleTimers();
    this._removeSubtitleTracks();

    // Supprimer l'URL de la vidéo de manière propre
    this.video.removeAttribute('src');
    this.video.load(); // Forcer le nettoyage

    this.currentMovie = null;
    this.resetPlayer();

    // Mettre à jour les cards visibles avec la nouvelle progression
    setTimeout(() => {
      if (window.filtersSystem?.applyFiltersAndSort) window.filtersSystem.applyFiltersAndSort();
    }, 300);
    
    // Sortir du mode plein écran
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
    
    // Reset le flag après un délai pour éviter les erreurs retardées
    setTimeout(() => {
      this.isClosing = false;
    }, 100);
  }
  
  resetPlayer() {
    if (this.isMiniPlayer) {
      this.isMiniPlayer = false;
      this._miniDragActive = false;
      this.modal.classList.remove('mini-player');
      this.modal.style.left = '';
      this.modal.style.top = '';
      this.modal.style.right = '';
      this.modal.style.bottom = '';
    }
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this._lastProgressSave = 0;
    this._resumeTime = 0;
    this.playbackRate = 1;
    this.hasTriedTranscode = false;
    this.isRetryingWithTranscode = false;
    this.needsVideoTranscode = false;
    this.isShowingConversionDialog = false;
    this._conversionPending = false;
    if (this._audioWaitCleanup) { this._audioWaitCleanup(); this._audioWaitCleanup = null; }
    this._cancelSubtitleTimers();
    this._removeSubtitleTracks();
    this._activeSubtitleIndex = -1;
    this.selectedAudioTracksForConversion = [0];
    this.detectedAudioTracks = null;
    this.detectedVideoTracks = null;
    this.detectedSubtitles = null;
    this.originalMoviePath = null;
    this.updatePlayPauseButton();
    this.updateProgress();
    this.setPlaybackRate(1);
  }
  
  // Contrôles de lecture
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
  
  play() {
    this.video.play();
    this.isPlaying = true;
    this.updatePlayPauseButton();
    this.showControlsTemporary();

    // Émettre l'événement Watch Party si actif et pas en sync
    if (this.watchPartyActive && !this.isSyncingFromRemote) {
      watchPartyClient.emitPlay(this.video.currentTime);
    }
  }

  pause() {
    this.video.pause();
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.showControls();

    // Émettre l'événement Watch Party si actif et pas en sync
    if (this.watchPartyActive && !this.isSyncingFromRemote) {
      watchPartyClient.emitPause(this.video.currentTime);
    }
  }
  
  updatePlayPauseButton() {
    const icon = this.elements.playPauseIcon;
    if (this.isPlaying) {
      icon.src = '../assets/pictos/pause.svg';
      this.elements.playPauseBtn.title = 'Pause (Espace)';
    } else {
      icon.src = '../assets/pictos/play.svg';
      this.elements.playPauseBtn.title = 'Lecture (Espace)';
    }
  }
  
  // Contrôle du volume
  toggleMute() {
    if (this.video.muted || this.video.volume === 0) {
      this.video.muted = false;
      this.video.volume = this.volume || 0.5;
    } else {
      this.video.muted = true;
    }
    this.updateVolumeDisplay();
  }
  
  setupTimelineDrag() {
    const container = this.elements.timelineContainer;
    let isDragging = false;

    const getPercent = (e) => {
      const rect = container.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      this.elements.timelineThumb.classList.add('dragging');
      this.seekToPercent(getPercent(e));
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.seekToPercent(getPercent(e));
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      this.elements.timelineThumb.classList.remove('dragging');
      this.seekToPercent(getPercent(e));
    });
  }

  setupVolumeDrag() {
    const slider = this.elements.volumeSlider;
    let isDragging = false;

    const applyVolume = (e) => {
      const rect = slider.getBoundingClientRect();
      const volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.video.volume = volume;
      this.video.muted = volume === 0;
      this.volume = volume;
      this.updateVolumeDisplay();
    };

    slider.addEventListener('mousedown', (e) => {
      isDragging = true;
      applyVolume(e);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      applyVolume(e);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
  
  changeVolume(delta) {
    const newVolume = Math.max(0, Math.min(1, this.video.volume + delta));
    this.video.volume = newVolume;
    this.video.muted = false;
    this.volume = newVolume;
    this.updateVolumeDisplay();
  }
  
  updateVolumeDisplay() {
    const volume = this.video.muted ? 0 : this.video.volume;
    this.elements.volumeProgress.style.width = `${volume * 100}%`;
    
    const icon = this.elements.volumeIcon;
    if (this.video.muted || volume === 0) {
      icon.src = '../assets/pictos/volume-mute.svg';
    } else if (volume < 0.5) {
      icon.src = '../assets/pictos/volume-down.svg';
    } else {
      icon.src = '../assets/pictos/volume-up.svg';
    }
  }
  
  // Navigation temporelle
  seekToPercent(percent) {
    const time = percent * this.duration;
    this.video.currentTime = Math.max(0, Math.min(this.duration, time));

    // Émettre l'événement Watch Party si actif et pas en sync
    if (this.watchPartyActive && !this.isSyncingFromRemote) {
      watchPartyClient.emitSeek(this.video.currentTime);
    }
  }

  seek(seconds) {
    this.video.currentTime = Math.max(0, Math.min(this.duration, this.video.currentTime + seconds));

    // Émettre l'événement Watch Party si actif et pas en sync
    if (this.watchPartyActive && !this.isSyncingFromRemote) {
      watchPartyClient.emitSeek(this.video.currentTime);
    }
  }
  
  updateProgress() {
    this.currentTime = this.video.currentTime;
    this.duration = this.video.duration || 0;

    if (this.duration > 0) {
      const percent = (this.currentTime / this.duration) * 100;
      this.elements.timelineProgress.style.width = `${percent}%`;
      this.elements.timelineThumb.style.left = `${percent}%`;
    }

    this.elements.timeCurrent.textContent = this.formatTime(this.currentTime);
    this.elements.timeDuration.textContent = this.formatTime(this.duration);

    // Sauvegarde throttlée toutes les 10s pendant la lecture
    if (this.isPlaying && this.duration > 30) {
      const now = Date.now();
      if (now - this._lastProgressSave > 10000) {
        this._lastProgressSave = now;
        this._saveProgress();
      }
    }
  }

  _saveProgress() {
    if (!this.currentMovie?.id || !this.duration) return;
    const pct = this.currentTime / this.duration;
    const seriesInfo = this.seriesContext ? {
      seriesId: this.seriesContext.episodes[this.seriesContext.currentIndex]?.seriesId,
      episodeNumber: this.seriesContext.episodes[this.seriesContext.currentIndex]?.episode_number,
      seasonNumber: this.seriesContext.episodes[this.seriesContext.currentIndex]?.season_number
    } : null;
    window.electronAPI?.saveProgress?.(
      this.currentMovie.id,
      pct,
      Math.floor(this.currentTime),
      seriesInfo
    );
  }
  
  updateBuffer() {
    if (this.video.buffered.length > 0) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      const duration = this.video.duration;
      if (duration > 0) {
        const percent = (bufferedEnd / duration) * 100;
        this.elements.timelineBuffer.style.width = `${percent}%`;
      }
    }
  }
  
  updateTimeDisplay(e) {
    const rect = this.elements.timelineContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * this.duration;
    
    this.elements.timeDisplay.textContent = this.formatTime(time);
    this.elements.timeDisplay.style.left = `${e.clientX - rect.left}px`;
    this.elements.timeDisplay.style.opacity = '1';
  }
  
  hideTimeDisplay() {
    this.elements.timeDisplay.style.opacity = '0';
  }
  
  // Vitesse de lecture
  toggleSpeedMenu() {
    this.elements.speedMenu.classList.toggle('active');
  }
  
  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.video.playbackRate = rate;
    this.elements.speedText.textContent = `${rate}x`;

    // Mettre à jour l'option active
    this.modal.querySelectorAll('.speed-option').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === rate);
    });

    this.elements.speedMenu.classList.remove('active');

    // Émettre l'événement Watch Party si actif et pas en sync
    if (this.watchPartyActive && !this.isSyncingFromRemote) {
      watchPartyClient.emitRateChange(rate);
    }
  }
  
  // Pistes audio
  toggleAudioMenu() {
    this.elements.audioMenu.classList.toggle('active');
    if (this.elements.audioMenu.classList.contains('active')) {
      // Attendre que la vidéo soit chargée pour détecter les pistes
      if (this.video.readyState >= 1) {
        this.loadAudioTracks();
      } else {
        // Attendre que les métadonnées soient chargées
        this.video.addEventListener('loadedmetadata', () => this.loadAudioTracks(), { once: true });
      }
    }
  }
  
  async loadAudioTracks() {
    this.elements.audioTracks.innerHTML = '';

    try {
      // Priorité 1: Utiliser les pistes déjà détectées lors du chargement
      if (this.detectedAudioTracks && this.detectedAudioTracks.length > 0) {
        console.log('🎵 Utilisation des pistes audio pré-détectées:', this.detectedAudioTracks.length);

        this.detectedAudioTracks.forEach((track, index) => {
          let label = '';
          if (track.title) {
            label = track.title;
          } else if (track.language && track.language !== 'und') {
            const langName = this.getLanguageName(track.language);
            label = `${langName} (${track.codec_name || 'Audio'})`;
          } else {
            label = `Piste ${index + 1} (${track.codec_name || 'Audio'})`;
          }

          // Afficher aussi les informations techniques si disponibles
          if (track.channels) {
            label += ` - ${track.channels} canaux`;
          }

          // Marquer comme active si c'est la piste actuellement sélectionnée
          const isActive = (this.selectedAudioTrack !== null && index === this.selectedAudioTrack) || (this.selectedAudioTrack === null && index === 0);
          this.createAudioTrackButton(index, label, isActive);
        });
        return;
      }

      // Priorité 2: Demander les informations via FFprobe si pas encore détectées
      if (window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
        console.log('🎵 Détection pistes audio via FFprobe...');
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.originalPath || this.currentMovie.path);
        if (videoInfo.success && videoInfo.audioTracks && videoInfo.audioTracks.length > 0) {
          console.log('🎵 Pistes audio détectées via FFprobe:', videoInfo.audioTracks.length);

          // Stocker les informations pour utilisation ultérieure
          this.detectedAudioTracks = videoInfo.audioTracks;

          videoInfo.audioTracks.forEach((track, index) => {
            let label = '';
            if (track.title) {
              label = track.title;
            } else if (track.language && track.language !== 'und') {
              const langName = this.getLanguageName(track.language);
              label = `${langName} (${track.codec_name || 'Audio'})`;
            } else {
              label = `Piste ${index + 1} (${track.codec_name || 'Audio'})`;
            }

            // Afficher aussi les informations techniques si disponibles
            if (track.channels) {
              label += ` - ${track.channels} canaux`;
            }

            // Marquer comme active si c'est la piste actuellement sélectionnée
            const isActive = (this.selectedAudioTrack !== null && index === this.selectedAudioTrack) || (this.selectedAudioTrack === null && index === 0);
            this.createAudioTrackButton(index, label, isActive);
          });
          return;
        }
      }
      
      // Fallback 1: API audioTracks native (si supportée)
      if (this.video.audioTracks && this.video.audioTracks.length > 1) {
        console.log('🎵 Pistes audio détectées via audioTracks API:', this.video.audioTracks.length);
        for (let i = 0; i < this.video.audioTracks.length; i++) {
          const track = this.video.audioTracks[i];
          this.createAudioTrackButton(i, track.label || track.language || `Piste ${i + 1}`, track.enabled);
        }
        return;
      }
      
      // Fallback 2: Vérifier via les propriétés de base de HTMLMediaElement
      if (this.hasAudioTrack()) {
        console.log('🎵 Une seule piste audio détectée');
        this.createAudioTrackButton(0, 'Piste audio principale', true);
        return;
      }
      
      // Fallback: Aucune piste détectée
      console.log('❌ Aucune piste audio détectée');
      const noTracks = document.createElement('div');
      noTracks.textContent = 'Aucune piste audio détectée';
      noTracks.className = 'no-tracks';
      this.elements.audioTracks.appendChild(noTracks);
      
    } catch (error) {
      console.error('Erreur lors de la détection des pistes audio:', error);
      const errorDiv = document.createElement('div');
      errorDiv.textContent = 'Erreur lors de la détection';
      errorDiv.className = 'no-tracks';
      this.elements.audioTracks.appendChild(errorDiv);
    }
  }
  
  /**
   * Détecte les pistes audio/vidéo et vérifie si un transcodage est nécessaire
   *
   * Logique de compatibilité :
   * - Audio AC3/DTS/EAC3/TrueHD → JAMAIS supporté nativement → conversion requise
   * - Vidéo HEVC/H.265 → PEUT être supporté (dépend du système) → essayer d'abord
   * - Vidéo H.264/VP9 + Audio AAC/MP3/Opus → Supporté → lecture directe
   */
  async detectAndFixAudioInBackground(moviePath) {
    // Codecs audio supportés nativement par les navigateurs (Chromium/Electron)
    const SUPPORTED_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le'];

    // Codecs audio qui ne sont JAMAIS supportés (Dolby/DTS - licences propriétaires)
    const UNSUPPORTED_AUDIO_CODECS = ['ac3', 'eac3', 'dts', 'dca', 'truehd', 'mlp'];

    // Codecs vidéo qui PEUVENT être supportés nativement (dépend du système)
    // HEVC peut fonctionner si le codec système est installé
    const MAYBE_SUPPORTED_VIDEO_CODECS = ['hevc', 'h265'];

    try {
      if (!window.electronAPI || !window.electronAPI.getVideoInfo) {
        console.log('⚠️ API getVideoInfo non disponible');
        return;
      }

      console.log('🔍 Analyse des codecs:', moviePath);
      const videoInfo = await window.electronAPI.getVideoInfo(moviePath);

      if (!videoInfo.success) {
        console.log('⚠️ Impossible d\'analyser le fichier - tentative de lecture directe');
        return;
      }

      // Stocker les pistes détectées
      this.detectedAudioTracks = videoInfo.audioTracks || [];
      this.detectedVideoTracks = videoInfo.videoTracks || [];

      // Stocker les sous-titres si disponibles
      if (videoInfo.subtitleTracks && videoInfo.subtitleTracks.length > 0) {
        this.detectedSubtitles = videoInfo.subtitleTracks;
        console.log(`📝 ${videoInfo.subtitleTracks.length} sous-titres détectés`);
      }

      // Analyser le codec vidéo
      let videoCodecName = '';
      let isHEVC = false;
      if (this.detectedVideoTracks.length > 0) {
        const videoTrack = this.detectedVideoTracks[0];
        videoCodecName = (videoTrack.codec_name || '').toLowerCase();
        console.log(`🎬 Codec vidéo: ${videoCodecName} (${videoTrack.width}x${videoTrack.height})`);
        isHEVC = MAYBE_SUPPORTED_VIDEO_CODECS.some(codec => videoCodecName.includes(codec));
      }

      // Analyser le codec audio
      let audioCodecName = '';
      let needsAudioTranscode = false;
      let isAudioSupported = true;
      if (this.detectedAudioTracks.length > 0) {
        const defaultTrack = this.detectedAudioTracks[0];
        audioCodecName = (defaultTrack.codec_name || '').toLowerCase();
        console.log(`🎵 Codec audio: ${audioCodecName} (${defaultTrack.channels || '?'} canaux)`);

        // Vérifier si l'audio est définitivement non supporté
        needsAudioTranscode = UNSUPPORTED_AUDIO_CODECS.some(codec => audioCodecName.includes(codec));
        isAudioSupported = !needsAudioTranscode;
      }

      // === DÉCISION DE LECTURE ===

      // CAS 1: Audio non supporté (AC3/DTS) — vérifier le système de conversion
      // Si audioReady = true, la conversion est déjà faite ou le fichier est natif : ne pas intervenir
      if (needsAudioTranscode && !this.currentMovie?.audioReady) {
        console.log(`Audio ${audioCodecName.toUpperCase()} non supporté - vérification via système de conversion...`);

        // Priorité 1 : vérifier la base de données (nouveau système)
        if (this.currentMovie?.id && window.electronAPI?.getAudioStatuses) {
          const statusRes = await window.electronAPI.getAudioStatuses();
          if (statusRes.success) {
            const entry = statusRes.statuses[this.currentMovie.id];
            if (entry?.status === 'ok' && entry.convertedPath) {
              console.log('Conversion DB trouvée - lecture directe');
              this.playConvertedFile(entry.convertedPath);
              return;
            }
            if (entry?.status === 'pending' || entry?.status === 'converting') {
              // Arrêter le chargement du fichier original pour éviter onVideoError
              this.video.pause();
              this.video.removeAttribute('src');
              this.video.load();
              this._conversionPending = true;
              this._showAudioWaitToast();
              return;
            }
          }
        }

        // Priorité 2 : vérifier l'ancien cache disque (compatibilité)
        if (window.electronAPI?.checkConvertedAudio) {
          const existingConversion = await window.electronAPI.checkConvertedAudio(moviePath, false);
          if (existingConversion.exists) {
            console.log('Conversion cache trouvée - lecture directe');
            this.playConvertedFile(existingConversion.path);
            return;
          }
        }

        // Aucune conversion disponible — le système de queue va s'en occuper, on laisse jouer
        console.log('Lecture avec audio natif (conversion en arrière-plan)');
        return;
      }

      // CAS 2: HEVC vidéo avec audio supporté → Essayer lecture native
      if (isHEVC && isAudioSupported) {
        console.log(`🎬 HEVC détecté avec audio compatible - tentative de lecture native...`);
        // On ne fait rien ici, la lecture va s'effectuer normalement
        // Si ça échoue, onVideoError gérera l'erreur et proposera la conversion
        this.needsVideoTranscode = true; // Marquer pour onVideoError
        return;
      }

      // CAS 3: Formats entièrement supportés → Lecture directe
      if (isAudioSupported) {
        console.log(`✅ Format supporté nativement (vidéo: ${videoCodecName || 'inconnu'}, audio: ${audioCodecName || 'inconnu'})`);
        // Lecture normale, pas besoin de faire quoi que ce soit
        return;
      }

      // CAS 4: Format inconnu → Tenter la lecture directe
      console.log(`⚠️ Format inconnu - tentative de lecture directe`);

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse:', error);
      // En cas d'erreur, on laisse la lecture se faire normalement
    }
  }

  /**
   * Joue un fichier converti
   */
  playConvertedFile(convertedPath) {
    const videoUrl = `http://localhost:3002/local-video?path=${encodeURIComponent(convertedPath)}&audioTrack=0`;
    const currentTime = this.video.currentTime;
    const wasPlaying = !this.video.paused;

    this.video.src = videoUrl;
    this.video.addEventListener('loadedmetadata', () => {
      if (currentTime > 0) this.video.currentTime = currentTime;
      if (wasPlaying) this.video.play().catch(err => console.warn('Reprise lecture:', err));
    }, { once: true });
  }

  /**
   * Affiche une notification temporaire pour informer l'utilisateur du transcodage
   */
  showAudioTranscodeNotification(codecName, fromCache = false) {
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${fromCache ? 'rgba(46, 204, 113, 0.9)' : 'rgba(255, 165, 0, 0.9)'};
      color: ${fromCache ? 'white' : 'black'};
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10001;
      font-size: 14px;
      text-align: center;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    if (fromCache) {
      notificationDiv.innerHTML = `
        <img src="../assets/pictos/check-circle.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;">
        <span>Audio ${codecName.toUpperCase()} → AAC (conversion sauvegardée)</span>
      `;
    } else {
      notificationDiv.innerHTML = `
        <img src="../assets/pictos/sync-alt.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;animation:spin-icon 1s linear infinite;">
        <span>Conversion audio ${codecName.toUpperCase()} → AAC en cours...</span>
      `;
    }

    this.container.appendChild(notificationDiv);

    // Supprimer après 5 secondes
    setTimeout(() => {
      if (notificationDiv.parentNode) {
        notificationDiv.style.transition = 'opacity 0.5s';
        notificationDiv.style.opacity = '0';
        setTimeout(() => notificationDiv.remove(), 500);
      }
    }, 5000);
  }

  _showAudioWaitToast() {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(30, 20, 60, 0.92); color: #c4b5fd;
      border: 1px solid rgba(167, 139, 250, 0.4);
      padding: 12px 20px; border-radius: 10px;
      z-index: 10001; font-size: 14px; display: flex; align-items: center; gap: 10px;
    `;
    const spinner = document.createElement('span');
    spinner.style.cssText = 'width:16px;height:16px;border:2px solid rgba(167,139,250,0.3);border-top-color:#a78bfa;border-radius:50%;animation:rk-spin 0.75s linear infinite;flex-shrink:0';
    toast.appendChild(spinner);
    toast.appendChild(Object.assign(document.createElement('span'), { textContent: 'Conversion audio en cours, veuillez patienter...' }));
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4000);

    // Écouter la fin de conversion pour relancer
    if (this.currentMovie?.id) {
      const mediaId = this.currentMovie.id;
      if (this._audioWaitCleanup) this._audioWaitCleanup();

      let done = false;
      const onDone = (convertedPath) => {
        if (done) return;
        done = true;
        this._audioWaitCleanup = null;
        if (this.currentMovie?.id === mediaId && convertedPath) {
          this.playConvertedFile(convertedPath);
        }
      };

      // Voie 1 : IPC via preload (rapide si ça fonctionne)
      let ipcCleanup = null;
      if (window.electronAPI?.onAudioStatusUpdate) {
        ipcCleanup = window.electronAPI.onAudioStatusUpdate(({ mediaId: id, status, convertedPath }) => {
          if (id !== mediaId) return;
          if (status === 'ok') { ipcCleanup?.(); onDone(convertedPath); }
          else if (status === 'error') { ipcCleanup?.(); done = true; }
        });
      }

      // Voie 2 : polling (filet de sécurité si IPC ne répond pas)
      const pollTimer = setInterval(async () => {
        if (done || this.currentMovie?.id !== mediaId) { clearInterval(pollTimer); return; }
        try {
          const res = await window.electronAPI?.getAudioStatuses?.();
          if (!res?.success) return;
          const entry = res.statuses[mediaId];
          if (entry?.status === 'ok' && entry.convertedPath) {
            clearInterval(pollTimer);
            ipcCleanup?.();
            onDone(entry.convertedPath);
          } else if (entry?.status === 'error') {
            clearInterval(pollTimer);
            ipcCleanup?.();
            done = true;
          }
        } catch {}
      }, 5000);

      this._audioWaitCleanup = () => {
        ipcCleanup?.();
        clearInterval(pollTimer);
        done = true;
      };
    }
  }

  /**
   * Affiche une boîte de dialogue pour sélectionner les pistes audio à convertir
   */
  showLanguageSelectionDialog(moviePath, codecName, transcodeVideo = false) {
    // Éviter les appels multiples
    if (this.isShowingConversionDialog) {
      console.log('⚠️ Dialogue de conversion déjà affiché');
      return;
    }
    this.isShowingConversionDialog = true;

    // Nettoyer complètement la vidéo pour éviter les erreurs en cascade
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();

    // Supprimer les notifications de streaming existantes
    const existingNotif = document.getElementById('streaming-conversion-notification');
    if (existingNotif) existingNotif.remove();

    // Réinitialiser les flags
    this.hasTriedTranscode = false;
    this.isRetryingWithTranscode = false;

    // Si pas de pistes audio détectées, passer directement à la conversion
    if (!this.detectedAudioTracks || this.detectedAudioTracks.length <= 1) {
      console.log('📋 Une seule piste audio - passage direct à la conversion');
      this.showAudioConversionChoice(moviePath, codecName, transcodeVideo, [0]);
      return;
    }

    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'language-selection-dialog';
    dialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    `;

    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = `
      background: linear-gradient(145deg, #1e1e2f, #252540);
      border-radius: 16px;
      padding: 35px;
      max-width: 500px;
      width: 90%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
    `;

    // Générer la liste des pistes audio
    const audioTracksHTML = this.detectedAudioTracks.map((track, index) => {
      let label = '';
      if (track.title) {
        label = track.title;
      } else if (track.language && track.language !== 'und') {
        label = this.getLanguageName(track.language);
      } else {
        label = `Piste ${index + 1}`;
      }

      const codecInfo = track.codec_name ? ` (${track.codec_name.toUpperCase()})` : '';
      const channelInfo = track.channels ? ` - ${track.channels}ch` : '';
      const isDefault = index === 0;

      return `
        <label style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        " class="audio-track-option" data-index="${index}">
          <input type="checkbox" value="${index}" ${isDefault ? 'checked' : ''} style="
            width: 20px;
            height: 20px;
            accent-color: #3498db;
            cursor: pointer;
          ">
          <div style="flex: 1;">
            <div style="color: white; font-weight: 500;">${label}${codecInfo}</div>
            <div style="color: #888; font-size: 12px;">${channelInfo}${isDefault ? ' - Piste par défaut' : ''}</div>
          </div>
        </label>
      `;
    }).join('');

    dialogBox.innerHTML = `
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="../assets/pictos/sliders-h.svg" style="width:48px;height:48px;filter:brightness(0) invert(1);margin-bottom:15px;">
        <h2 style="color: white; margin: 0 0 10px 0; font-size: 20px;">Sélection des pistes audio</h2>
        <p style="color: #aaa; margin: 0; font-size: 14px;">
          Choisissez les langues à inclure dans la conversion
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 25px; max-height: 300px; overflow-y: auto; padding-right: 5px;">
        ${audioTracksHTML}
      </div>

      <div style="display: flex; gap: 12px;">
        <button id="btn-confirm-languages" style="
          flex: 1;
          background: linear-gradient(145deg, #3498db, #2980b9);
          color: white;
          border: none;
          padding: 14px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: bold;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <img src="../assets/pictos/check.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;"> Continuer
        </button>
        <button id="btn-cancel-languages" style="
          background: transparent;
          color: #aaa;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 14px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          transition: all 0.2s;
        ">
          <img src="../assets/pictos/times.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;"> Annuler
        </button>
      </div>
    `;

    dialogOverlay.appendChild(dialogBox);
    document.body.appendChild(dialogOverlay);

    // Effets hover sur les options
    const options = dialogBox.querySelectorAll('.audio-track-option');
    options.forEach(option => {
      option.addEventListener('mouseenter', () => {
        option.style.background = 'rgba(255, 255, 255, 0.1)';
        option.style.borderColor = 'rgba(52, 152, 219, 0.5)';
      });
      option.addEventListener('mouseleave', () => {
        const checkbox = option.querySelector('input');
        if (!checkbox.checked) {
          option.style.background = 'rgba(255, 255, 255, 0.05)';
          option.style.borderColor = 'transparent';
        }
      });
      option.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          option.style.background = 'rgba(52, 152, 219, 0.2)';
          option.style.borderColor = '#3498db';
        } else {
          option.style.background = 'rgba(255, 255, 255, 0.05)';
          option.style.borderColor = 'transparent';
        }
      });
      // Initialiser l'état visuel
      const checkbox = option.querySelector('input');
      if (checkbox.checked) {
        option.style.background = 'rgba(52, 152, 219, 0.2)';
        option.style.borderColor = '#3498db';
      }
    });

    // Bouton Continuer
    dialogBox.querySelector('#btn-confirm-languages').addEventListener('click', () => {
      const selectedTracks = Array.from(dialogBox.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));

      if (selectedTracks.length === 0) {
        alert('Veuillez sélectionner au moins une piste audio.');
        return;
      }

      console.log('🎵 Pistes audio sélectionnées:', selectedTracks);
      dialogOverlay.remove();
      this.isShowingConversionDialog = false;
      this.showAudioConversionChoice(moviePath, codecName, transcodeVideo, selectedTracks);
    });

    // Bouton Annuler
    dialogBox.querySelector('#btn-cancel-languages').addEventListener('click', () => {
      dialogOverlay.remove();
      this.isShowingConversionDialog = false;
      this.close();
    });
  }

  /**
   * Affiche une boîte de dialogue pour choisir le mode de conversion
   * @param {boolean} transcodeVideo - Si true, transcode aussi la vidéo (HEVC → H.264)
   * @param {number[]} selectedTracks - Indices des pistes audio à convertir
   */
  showAudioConversionChoice(moviePath, codecName, transcodeVideo = false, selectedTracks = [0]) {
    // Marquer qu'un dialogue est affiché
    this.isShowingConversionDialog = true;

    // Stocker les pistes sélectionnées
    this.selectedAudioTracksForConversion = selectedTracks;

    // Mettre la vidéo en pause et supprimer la source pendant le choix
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();

    // Supprimer les notifications de streaming existantes
    const existingNotif = document.getElementById('streaming-conversion-notification');
    if (existingNotif) existingNotif.remove();

    // Supprimer les flags de transcodage car l'utilisateur va choisir
    this.hasTriedTranscode = false;
    this.isRetryingWithTranscode = false;

    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'audio-conversion-dialog';
    dialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    `;

    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = `
      background: linear-gradient(145deg, #1e1e2f, #252540);
      border-radius: 16px;
      padding: 35px;
      max-width: 450px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
    `;

    // Adapter le message selon le type de conversion
    const iconSvg = transcodeVideo
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#f39c12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:15px"><path d="M14.85,16.87h1.84"/><rect x="3.86" y="10.01" width="16.49" height="10.08"/><rect x="3.25" y="4.97" width="16.49" height="3.12" transform="translate(-1.23 2.93) rotate(-13.8)"/><line x1="7.76" y1="5.84" x2="6.84" y2="9.28"/><line x1="11.94" y1="4.81" x2="11.03" y2="8.25"/><line x1="16.26" y1="3.75" x2="15.35" y2="7.19"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#f39c12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:15px"><path stroke-miterlimit="3.83" d="M1.46,13.78V10.22A1.92,1.92,0,0,1,3.38,8.3H6.15a1,1,0,0,0,.53-.15l5.75-3.8a1,1,0,0,1,1.49.8v13.7a1,1,0,0,1-1.49.8l-5.75-3.8a1,1,0,0,0-.53-.15H3.38A1.92,1.92,0,0,1,1.46,13.78Z"/><path d="M17.27,7.69a5.81,5.81,0,0,1,0,7.66"/><path d="M20.15,4.81a10,10,0,0,1,2.39,6.71,10,10,0,0,1-2.39,6.71"/></svg>`;
    const title = transcodeVideo ? 'Conversion vidéo requise' : 'Conversion audio requise';

    // Extraire le nom du codec vidéo et audio pour un message plus clair
    let description;
    if (transcodeVideo) {
      // Extraction du codec vidéo depuis codecName qui peut être "HEVC (vidéo) + AC3" ou juste "HEVC"
      const videoCodecMatch = codecName.match(/^([^(]+)/);
      const videoCodecOnly = videoCodecMatch ? videoCodecMatch[1].trim() : codecName;
      description = `Le codec vidéo <strong style="color: #e74c3c;">${videoCodecOnly}</strong> n'est pas supporté par le navigateur.<br>Une conversion vers H.264/AAC est nécessaire pour la lecture.`;
    } else {
      description = `Le codec audio <strong style="color: #e74c3c;">${codecName.toUpperCase()}</strong> n'est pas supporté par le navigateur.<br>Une conversion vers AAC est nécessaire pour la lecture.`;
    }
    const timeWarning = transcodeVideo
      ? '<p style="color: #e67e22; margin-top: 10px; font-size: 12px;">⚠️ La conversion vidéo peut prendre plusieurs minutes.</p>'
      : '';

    dialogBox.innerHTML = `
      <div style="text-align: center; margin-bottom: 25px;">
        ${iconSvg}
        <h2 style="color: white; margin: 0 0 10px 0; font-size: 20px;">${title}</h2>
        <p style="color: #aaa; margin: 0; font-size: 14px;">
          ${description}
        </p>
        ${timeWarning}
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="btn-wait-conversion" style="
          background: linear-gradient(145deg, #3498db, #2980b9);
          color: white;
          border: none;
          padding: 15px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <img src="../assets/pictos/hourglass-half.svg" style="width:20px;height:20px;filter:brightness(0) invert(1);">
          <div style="text-align: left;">
            <div style="font-weight: bold;">Attendre la conversion</div>
            <div style="font-size: 12px; opacity: 0.8;">Convertir entièrement avant de regarder (recommandé)</div>
          </div>
        </button>

        <button id="btn-stream-conversion" data-transcode-video="${transcodeVideo}" style="
          background: linear-gradient(145deg, #27ae60, #1e8449);
          color: white;
          border: none;
          padding: 15px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <img src="../assets/pictos/play.svg" style="width:20px;height:20px;filter:brightness(0) invert(1);">
          <div style="text-align: left;">
            <div style="font-weight: bold;">Regarder pendant la conversion</div>
            <div style="font-size: 12px; opacity: 0.8;">${transcodeVideo ? 'Peut causer des saccades (conversion lente)' : 'Commencer la lecture immédiatement'}</div>
          </div>
        </button>

        <button id="btn-cancel-conversion" style="
          background: transparent;
          color: #aaa;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 12px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          margin-top: 5px;
        ">
          <img src="../assets/pictos/times.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;">
          Annuler
        </button>
      </div>

      <p style="color: #888; font-size: 11px; text-align: center; margin-top: 20px;">
        <img src="../assets/pictos/save.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;"> La conversion sera sauvegardée pour les prochaines lectures.
      </p>
    `;

    dialogOverlay.appendChild(dialogBox);
    document.body.appendChild(dialogOverlay);

    // Gestionnaires de clics
    const btnWait = dialogBox.querySelector('#btn-wait-conversion');
    const btnStream = dialogBox.querySelector('#btn-stream-conversion');
    const btnCancel = dialogBox.querySelector('#btn-cancel-conversion');

    // Effet hover
    [btnWait, btnStream, btnCancel].filter(Boolean).forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.02)';
        if (btn === btnCancel) {
          btn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
          btn.style.color = '#fff';
        } else {
          btn.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.3)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        if (btn === btnCancel) {
          btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          btn.style.color = '#aaa';
        } else {
          btn.style.boxShadow = 'none';
        }
      });
    });

    // Option 1: Attendre la conversion complète
    btnWait.addEventListener('click', async () => {
      dialogOverlay.remove();
      this.isShowingConversionDialog = false;
      await this.startPreConversion(moviePath, codecName, transcodeVideo);
    });

    // Option 2: Regarder pendant la conversion (streaming)
    btnStream.addEventListener('click', () => {
      const needsVideoTranscode = btnStream.dataset.transcodeVideo === 'true';
      dialogOverlay.remove();
      this.isShowingConversionDialog = false;
      this.startStreamingConversion(moviePath, codecName, needsVideoTranscode);
    });

    // Option 3: Annuler - fermer la boîte de dialogue et le lecteur
    btnCancel.addEventListener('click', () => {
      dialogOverlay.remove();
      this.isShowingConversionDialog = false;
      this.close();
    });
  }

  /**
   * Démarre la pré-conversion complète avec affichage de progression
   * @param {boolean} transcodeVideo - Si true, transcode aussi la vidéo (HEVC → H.264)
   */
  async startPreConversion(moviePath, codecName, transcodeVideo = false) {
    // Réinitialiser les flags de transcodage car l'utilisateur a explicitement choisi la conversion
    this.hasTriedTranscode = false;
    this.isRetryingWithTranscode = false;

    // Récupérer les pistes audio sélectionnées
    const selectedTracks = this.selectedAudioTracksForConversion || [0];
    const trackCount = selectedTracks.length;

    // Afficher l'écran de progression
    const progressOverlay = document.createElement('div');
    progressOverlay.id = 'conversion-progress-overlay';
    progressOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 100001;
    `;

    const conversionType = transcodeVideo ? 'HEVC → H.264 + AAC' : `${codecName.toUpperCase()} → AAC`;
    const trackInfo = trackCount > 1 ? `(${trackCount} pistes audio)` : '';
    const conversionWarning = transcodeVideo
      ? '<p style="color: #e67e22; font-size: 12px; margin-top: 10px;"><img src="../assets/pictos/clock.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;"> La conversion vidéo peut prendre plusieurs minutes</p>'
      : '';

    progressOverlay.innerHTML = `
      <img src="../assets/pictos/cog.svg" style="width:60px;height:60px;filter:brightness(0) invert(1);margin-bottom:20px;animation:spin-icon 2s linear infinite;">
      <h2 style="color: white; margin: 0 0 10px 0;">Conversion en cours...</h2>
      <p style="color: #aaa; margin: 0 0 25px 0;">
        ${conversionType} ${trackInfo}
      </p>
      ${conversionWarning}
      <div style="width: 300px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
        <div id="conversion-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); transition: width 0.3s;"></div>
      </div>
      <p id="conversion-progress-text" style="color: #888; margin-top: 15px; font-size: 14px;">0%</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        <img src="../assets/pictos/save.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;"> La conversion sera sauvegardée pour les prochaines lectures
      </p>
    `;

    this.container.appendChild(progressOverlay);

    const progressBar = progressOverlay.querySelector('#conversion-progress-bar');
    const progressText = progressOverlay.querySelector('#conversion-progress-text');

    // Écouter les événements de progression
    const removeProgressListener = window.electronAPI.onConversionProgress((data) => {
      if (data.path === moviePath) {
        progressBar.style.width = `${data.progress}%`;
        progressText.textContent = `${data.progress}%`;

        if (data.completed) {
          progressText.textContent = 'Terminé !';
        }
      }
    });

    try {
      // Lancer la pré-conversion (avec ou sans transcodage vidéo)
      console.log('🎬 Lancement pré-conversion pour:', moviePath, 'transcodeVideo:', transcodeVideo, 'tracks:', selectedTracks);
      const result = await window.electronAPI.preConvertAudio(moviePath, transcodeVideo, selectedTracks);
      console.log('🎬 Résultat pré-conversion:', result);

      // Nettoyer le listener
      removeProgressListener();

      if (result.success) {
        progressOverlay.remove();

        // Charger la vidéo convertie - utiliser directement le chemin du fichier converti
        // au lieu de passer par le système de lookup qui peut échouer
        const convertedFilePath = result.path;
        const videoUrl = `http://localhost:3002/local-video?path=${encodeURIComponent(convertedFilePath)}&audioTrack=0`;
        console.log('🎬 Chargement vidéo convertie:', videoUrl);
        console.log('📁 Fichier converti:', convertedFilePath);
        this.video.src = videoUrl;

        this.showAudioTranscodeNotification(codecName, true);

        this.video.addEventListener('loadedmetadata', () => {
          this.video.play().catch(err => console.warn('Lecture:', err));
        }, { once: true });

        // Gérer les erreurs de lecture du fichier converti
        this.video.addEventListener('error', (e) => {
          // Ignorer si fermeture ou dialogue en cours
          if (this.isClosing || this.isShowingConversionDialog) {
            console.log('Erreur fichier converti ignorée (fermeture ou dialogue en cours)');
            return;
          }
          console.error('❌ Erreur lecture fichier converti:', e);
          console.error('Fichier:', convertedFilePath);

          // Vérifier si c'est un problème de codec vidéo
          const videoCodec = this.detectedVideoTracks?.[0]?.codec_name || '';
          const isHEVC = videoCodec.toLowerCase().includes('hevc') || videoCodec.toLowerCase().includes('h265');

          if (isHEVC && !transcodeVideo) {
            // Si c'est du HEVC et qu'on n'a transcodé que l'audio, proposer de transcoder aussi la vidéo
            this.showErrorModal(
              `Le fichier utilise le codec vidéo HEVC (H.265) qui n'est pas supporté.\n\n` +
              `La conversion audio a réussi mais la vidéo doit aussi être convertie.\n\n` +
              `Voulez-vous lancer une conversion complète (vidéo + audio) ?\n` +
              `Cela peut prendre plusieurs minutes.`,
              true // Afficher le bouton retry
            );
          } else {
            this.showErrorModal(
              'Le fichier converti ne peut pas être lu.\n\n' +
              `Codec vidéo détecté: ${videoCodec || 'inconnu'}\n\n` +
              'Utilisez VLC pour lire ce fichier.',
              false
            );
          }
        }, { once: true });
      } else {
        progressOverlay.remove();
        console.error('❌ Pré-conversion échouée:', result.message);

        // Afficher l'erreur sans fallback (évite les boucles)
        this.showErrorModal(
          `Impossible de convertir l'audio.\n\n` +
          `${result.message || 'Erreur inconnue'}\n\n` +
          `Le fichier utilise peut-être un codec vidéo (HEVC/H.265) non supporté.\n\n` +
          `Utilisez VLC pour lire ce fichier.`,
          false
        );
      }
    } catch (error) {
      removeProgressListener();
      progressOverlay.remove();
      console.error('❌ Exception pré-conversion:', error);

      // Afficher l'erreur sans fallback
      this.showErrorModal(
        `Erreur lors de la conversion.\n\n` +
        `${error.message || 'Erreur inconnue'}\n\n` +
        `Utilisez VLC pour lire ce fichier.`,
        false
      );
    }
  }

  /**
   * Démarre la lecture avec conversion en streaming
   * @param {boolean} transcodeVideo - Si true, transcode aussi la vidéo (HEVC → H.264)
   */
  startStreamingConversion(moviePath, codecName, transcodeVideo = false) {
    // Afficher une notification de streaming progressif
    const streamNotification = document.createElement('div');
    streamNotification.id = 'streaming-conversion-notification';
    streamNotification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(52, 152, 219, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 100001;
      font-size: 14px;
      text-align: center;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;

    const conversionType = transcodeVideo ? `${codecName} → H.264/AAC` : `${codecName.toUpperCase()} → AAC`;
    streamNotification.innerHTML = `
      <img src="../assets/pictos/sync-alt.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;animation:spin-icon 1s linear infinite;">
      <span>Conversion ${conversionType} en cours... La lecture démarrera sous peu.</span>
    `;
    document.body.appendChild(streamNotification);

    const currentTime = this.video.currentTime;
    const wasPlaying = !this.video.paused;

    // Construire l'URL avec les paramètres appropriés
    let transcodeUrl = `http://localhost:3002/local-video?path=${encodeURIComponent(moviePath)}&audioTrack=0&transcode=true`;
    if (transcodeVideo) {
      transcodeUrl += '&transcodeVideo=true';
    }

    console.log(`🔄 Rechargement avec transcodage ${transcodeVideo ? 'vidéo+audio' : 'audio'} (streaming progressif)...`);
    this.video.src = transcodeUrl;

    // Indicateur de buffering pendant le streaming
    let bufferingTimeout = null;
    let playbackStarted = false;

    const onWaiting = () => {
      if (!playbackStarted) return;
      console.log('⏳ Buffering pendant streaming...');
      this.showBuffering();
    };

    const onPlaying = () => {
      playbackStarted = true;
      this.hideBuffering();
      // Mettre à jour la notification
      streamNotification.style.background = 'rgba(46, 204, 113, 0.95)';
      streamNotification.innerHTML = `
        <img src="../assets/pictos/check-circle.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;">
        <span>Lecture en cours - Conversion en arrière-plan</span>
      `;
      // Supprimer après 5 secondes
      setTimeout(() => {
        if (streamNotification.parentNode) {
          streamNotification.style.transition = 'opacity 0.5s';
          streamNotification.style.opacity = '0';
          setTimeout(() => streamNotification.remove(), 500);
        }
      }, 5000);
    };

    const onCanPlay = () => {
      console.log('✅ Streaming prêt pour lecture');
      this.hideLoading();
      if (wasPlaying || !playbackStarted) {
        this.video.play().catch(err => console.warn('Reprise lecture:', err));
      }
    };

    const onError = (e) => {
      // Ignorer les erreurs si on est en train de fermer ou si un dialogue est affiché
      if (this.isClosing || this.isShowingConversionDialog) {
        console.log('Erreur streaming ignorée (fermeture ou dialogue en cours)');
        return;
      }
      console.error('❌ Erreur streaming:', e);
      if (streamNotification.parentNode) {
        streamNotification.style.background = 'rgba(231, 76, 60, 0.95)';
        streamNotification.innerHTML = `
          <img src="../assets/pictos/exclamation-triangle.svg" style="width:1em;height:1em;filter:brightness(0) invert(1);vertical-align:middle;">
          <span>Erreur de streaming - Essayez "Attendre la conversion"</span>
        `;
      }
    };

    this.video.addEventListener('waiting', onWaiting);
    this.video.addEventListener('playing', onPlaying);
    this.video.addEventListener('canplay', onCanPlay);
    this.video.addEventListener('error', onError, { once: true });

    this.video.addEventListener('loadedmetadata', () => {
      console.log('📊 Métadonnées chargées - streaming');
      if (currentTime > 0 && currentTime < this.video.duration) {
        // Note: le seeking peut ne pas fonctionner pendant le streaming progressif
        console.log('⚠️ Seeking désactivé pendant le streaming progressif');
      }
    }, { once: true });

    // Nettoyer les listeners quand la vidéo change
    const cleanup = () => {
      this.video.removeEventListener('waiting', onWaiting);
      this.video.removeEventListener('playing', onPlaying);
      this.video.removeEventListener('canplay', onCanPlay);
    };
    this.video.addEventListener('emptied', cleanup, { once: true });
  }

  async loadMovieDetailsInBackground(movieId) {
    // Charger les détails du film en arrière-plan
    try {
      const movieDetails = await window.electronAPI.getMediaDetails(movieId);
      if (movieDetails.success && (movieDetails.media || movieDetails.movie)) {
        const movie = movieDetails.media || movieDetails.movie;
        const details = [];
        if (movie.year) details.push(movie.year);
        if (movie.duration) details.push(window.formatTime(movie.duration));
        if (movie.genres && movie.genres.length > 0) {
          const genres = Array.isArray(movie.genres) ? movie.genres : JSON.parse(movie.genres || '[]');
          details.push(genres.join(', '));
        }
        this.elements.details.textContent = details.join(' • ');
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors du chargement des détails:', error);
    }
  }
  hasAudioTrack() {
    // Méthodes multiples pour détecter l'audio
    try {
      // Méthode 1: Vérifier les propriétés WebKit
      if (this.video.webkitAudioDecodedByteCount !== undefined && this.video.webkitAudioDecodedByteCount > 0) {
        return true;
      }
      
      // Méthode 2: Vérifier mozHasAudio (Firefox)
      if (this.video.mozHasAudio !== undefined && this.video.mozHasAudio) {
        return true;
      }
      
      // Méthode 3: Vérifier le volume (si pas muet et > 0)
      if (!this.video.muted && this.video.volume > 0) {
        return true;
      }
      
      // Méthode 4: Essayer de créer un AudioContext pour analyser
      if (window.AudioContext || window.webkitAudioContext) {
        return true; // Assume audio if AudioContext is available
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors de la détection audio:', error);
      return true; // Assume audio on error
    }
  }
  
  createAudioTrackButton(index, label, isActive) {
    const button = document.createElement('button');
    button.className = 'audio-option';
    button.textContent = label;
    button.dataset.track = index;
    
    if (isActive) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', () => this.setAudioTrack(index));
    this.elements.audioTracks.appendChild(button);
  }
  
  async setAudioTrack(trackIndex) {
    console.log('🎵 Changement piste audio vers:', trackIndex);

    try {
      // Méthode 1: Utiliser les audioTracks natifs si disponibles
      if (this.video.audioTracks && this.video.audioTracks.length > trackIndex) {
        for (let i = 0; i < this.video.audioTracks.length; i++) {
          this.video.audioTracks[i].enabled = (i === trackIndex);
        }
        console.log('🎵 Piste audio native changée');
      }
      // Méthode 2: Si c'est une piste détectée via FFmpeg, recharger avec la bonne piste
      else if (this.detectedAudioTracks && this.detectedAudioTracks.length > 1) {
        console.log('🎵 Changement de piste audio via rechargement intelligent...');

        // Sauvegarder l'état actuel
        const currentTime = this.video.currentTime;
        const wasPlaying = !this.video.paused;
        const currentVolume = this.video.volume;
        const currentRate = this.video.playbackRate;

        // Stocker la piste audio sélectionnée
        this.selectedAudioTrack = trackIndex;

        // Toujours utiliser le fichier source original pour le remux (toutes les pistes disponibles)
        const sourcePath = this.originalMoviePath || this.currentMovie.path;
        const newUrl = new URL('http://localhost:3002/local-video');
        newUrl.searchParams.set('path', sourcePath);
        newUrl.searchParams.set('audioTrack', trackIndex);

        // Recharger la vidéo avec la nouvelle piste
        this.video.src = newUrl.toString();

        // Attendre que les métadonnées soient chargées (20s max pour éviter de bloquer l'UI :
        // le serveur streame maintenant progressivement dès qu'il a assez de données, donc ça
        // devrait arriver bien avant. Si ça timeout quand même, le listener 'loadedmetadata' reste
        // actif et restaurera l'état dès que le remux sera prêt, même après ce délai)
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⏱️ Changement de piste audio : le remux prend plus de temps que prévu, poursuite en arrière-plan');
            resolve();
          }, 20000);
          const onLoaded = () => {
            clearTimeout(timeout);
            this.video.currentTime = currentTime;
            this.video.volume = currentVolume;
            this.video.playbackRate = currentRate;
            if (wasPlaying) {
              this.video.play().catch(err => console.error('Erreur reprise lecture:', err));
            }
            resolve();
          };
          this.video.addEventListener('loadedmetadata', onLoaded, { once: true });
          this.video.addEventListener('error', () => { clearTimeout(timeout); resolve(); }, { once: true });
        });

        console.log('✅ Piste audio changée et lecture reprise à', currentTime.toFixed(2), 's');
      }

      // Mettre à jour l'interface
      this.elements.audioTracks.querySelectorAll('.audio-option').forEach((btn, index) => {
        btn.classList.toggle('active', index === trackIndex);
      });

      // Émettre l'événement Watch Party si actif et pas en sync
      if (this.watchPartyActive && !this.isSyncingFromRemote) {
        watchPartyClient.emitAudioTrackChange(trackIndex);
      }

    } catch (error) {
      console.error('Erreur lors du changement de piste audio:', error);
      alert('Erreur lors du changement de piste audio. Veuillez réessayer.');
    }

    this.elements.audioMenu.classList.remove('active');
  }
  
  // Sous-titres
  toggleSubtitleMenu() {
    this.elements.subtitleMenu.classList.toggle('active');
    if (this.elements.subtitleMenu.classList.contains('active')) {
      // Attendre que la vidéo soit chargée pour détecter les pistes
      if (this.video.readyState >= 1) {
        this.loadSubtitleTracks();
      } else {
        // Attendre que les métadonnées soient chargées
        this.video.addEventListener('loadedmetadata', () => this.loadSubtitleTracks(), { once: true });
      }
    }
  }
  
  async loadSubtitleTracks() {
    // Vider les pistes existantes mais garder le bouton "Désactivés"
    const disabledBtn = this.elements.subtitleTracks.querySelector('[data-track="-1"]');
    this.elements.subtitleTracks.innerHTML = '';
    if (disabledBtn) {
      this.elements.subtitleTracks.appendChild(disabledBtn);
    }
    
    let tracksFound = false;
    
    try {
      // Priorité 1: réutiliser le cache si déjà détecté (Bug 5 — évite FFprobe à chaque ouverture)
      const cachedTracks = this.detectedSubtitles && this.detectedSubtitles.length > 0
        ? this.detectedSubtitles : null;

      if (cachedTracks) {
        console.log('📝 Sous-titres depuis cache:', cachedTracks.length);
        cachedTracks.forEach((track, index) => {
          let label = track.title || (track.language && track.language !== 'und'
            ? `${this.getLanguageName(track.language)} (${track.codec_name || 'Sub'})`
            : `Sous-titre ${index + 1} (${track.codec_name || 'Sub'})`);
          const isImageBased = ['hdmv_pgs_subtitle','pgssub','dvd_subtitle','dvdsub'].includes(track.codec_name);
          this.createSubtitleTrackButton(index, label, false, isImageBased);
          tracksFound = true;
        });
      } else if (window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
        // Priorité 2 : FFprobe (une seule fois)
        console.log('📝 Détection sous-titres via FFprobe...');
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.originalPath || this.currentMovie.path);
        if (videoInfo.success && videoInfo.subtitleTracks && videoInfo.subtitleTracks.length > 0) {
          console.log('📝 Sous-titres détectés via FFprobe:', videoInfo.subtitleTracks.length);
          this.detectedSubtitles = videoInfo.subtitleTracks;
          videoInfo.subtitleTracks.forEach((track, index) => {
            let label = '';
            if (track.title) {
              label = track.title;
            } else if (track.language && track.language !== 'und') {
              const langName = this.getLanguageName(track.language);
              label = `${langName} (${track.codec_name || 'Sub'})`;
            } else {
              label = `Sous-titre ${index + 1} (${track.codec_name || 'Sub'})`;
            }
            
            // Indiquer le type de format pour information
            const isImageBased = track.codec_name === 'hdmv_pgs_subtitle' || 
                               track.codec_name === 'pgssub' || 
                               track.codec_name === 'dvd_subtitle' ||
                               track.codec_name === 'dvdsub';
            
            // Ne plus ajouter le marqueur (Image) car on essaie maintenant de les convertir
            
            this.createSubtitleTrackButton(index, label, false, isImageBased);
            tracksFound = true;
          });
        }
      }
      
      // Fallback 1: TextTracks API native
      if (!tracksFound && this.video.textTracks && this.video.textTracks.length > 0) {
        console.log('📝 Sous-titres détectés via textTracks API:', this.video.textTracks.length);
        for (let i = 0; i < this.video.textTracks.length; i++) {
          const track = this.video.textTracks[i];
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            this.createSubtitleTrackButton(i, track.label || track.language || `Sous-titre ${i + 1}`, track.mode === 'showing');
            tracksFound = true;
          }
        }
      }
      
      if (!tracksFound) {
        console.log('❌ Aucun sous-titre détecté');
        const noTracks = document.createElement('div');
        noTracks.textContent = 'Aucun sous-titre disponible';
        noTracks.className = 'no-tracks';
        this.elements.subtitleTracks.appendChild(noTracks);
      }
      
    } catch (error) {
      console.error('Erreur lors de la détection des sous-titres:', error);
      const errorDiv = document.createElement('div');
      errorDiv.textContent = 'Erreur lors de la détection';
      errorDiv.className = 'no-tracks';
      this.elements.subtitleTracks.appendChild(errorDiv);
    }
  }
  
  createSubtitleTrackButton(index, label, isActive, isImageBased = false) {
    const button = document.createElement('button');
    button.className = 'subtitle-option';
    button.textContent = label;
    button.dataset.track = index;
    
    if (isImageBased) {
      button.classList.add('image-based');
      button.title = 'Format d\'image non supporté par le lecteur web';
    }
    
    if (isActive) {
      button.classList.add('active');
      // Enlever active du bouton "Désactivés"
      const disabledBtn = this.elements.subtitleTracks.querySelector('[data-track="-1"]');
      if (disabledBtn) disabledBtn.classList.remove('active');
    }
    
    button.addEventListener('click', () => this.setSubtitleTrack(index));
    this.elements.subtitleTracks.appendChild(button);
  }
  
  async setSubtitleTrack(trackIndex) {
    console.log('📝 Activation sous-titre piste:', trackIndex);

    // Marquer la piste active et annuler tout timer en cours (Bug 4)
    this._activeSubtitleIndex = trackIndex;
    this._cancelSubtitleTimers();

    // Si on désactive, nettoyer les tracks existants
    if (trackIndex < 0) {
      this._removeSubtitleTracks();
    }

    // Désactiver tous les sous-titres natifs
    if (this.video.textTracks) {
      for (let i = 0; i < this.video.textTracks.length; i++) {
        this.video.textTracks[i].mode = 'hidden';
      }
    }

    // Si c'est une piste détectée via FFmpeg, essayer de l'extraire
    if (trackIndex >= 0 && this.detectedSubtitles && this.detectedSubtitles[trackIndex]) {
      try {
        await this.loadExternalSubtitle(trackIndex);
      } catch (error) {
        console.error('Erreur lors du chargement des sous-titres externes:', error);
      }
    }
    
    // Mettre à jour l'interface
    this.elements.subtitleTracks.querySelectorAll('.subtitle-option').forEach((btn, index) => {
      btn.classList.toggle('active', btn.dataset.track == trackIndex);
    });

    // Émettre l'événement Watch Party si actif et pas en sync
    if (this.watchPartyActive && !this.isSyncingFromRemote) {
      watchPartyClient.emitSubtitleChange(trackIndex);
    }

    this.elements.subtitleMenu.classList.remove('active');
  }
  
  async loadExternalSubtitle(trackIndex) {
    if (!window.electronAPI || !window.electronAPI.extractSubtitle) {
      console.log('📝 Extraction de sous-titres non disponible');
      return;
    }

    // Supprimer les anciens tracks et annuler les timers (Bug 1 + Bug 4)
    this._cancelSubtitleTimers();
    this._removeSubtitleTracks();

    try {
      console.log('📝 Extraction sous-titre piste:', trackIndex);
      console.log('📝 Chemin vidéo:', this.currentMovie.path);
      
      // Afficher un indicateur de chargement
      const loadingIndicator = this.showExtractionLoading();
      
      const result = await window.electronAPI.extractSubtitle(this.currentMovie.originalPath || this.currentMovie.path, trackIndex);
      
      // Supprimer l'indicateur de chargement
      if (loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      
      console.log('📝 Résultat extraction:', result);
      
      if (result.success && result.subtitlePath) {
        console.log('📝 Sous-titre extrait vers:', result.subtitlePath);
        
        // Vérifier le format du fichier extrait
        const format = result.format || 'srt';
        
        // Seuls certains formats sont supportés par le lecteur web
        const supportedFormats = ['srt', 'vtt', 'ass'];
        
        if (!supportedFormats.includes(format)) {
          console.log('⚠️ Format non supporté par le lecteur web:', format);
          alert(`Les sous-titres ont été extraits mais le format ${format.toUpperCase()} n'est pas supporté par le lecteur web.\nSeuls les formats SRT, VTT et ASS sont supportés.`);
          return;
        }
        
        // Lire le contenu du fichier via Electron
        console.log('📖 Lecture du fichier de sous-titres...');
        const subtitleData = await window.electronAPI.readSubtitleFile(result.subtitlePath);
        
        if (!subtitleData.success) {
          console.error('❌ Erreur lecture fichier:', subtitleData.message);
          alert('Erreur lors de la lecture du fichier de sous-titres : ' + subtitleData.message);
          return;
        }
        
        console.log('📝 Contenu du fichier lu:', subtitleData.content.length, 'caractères');
        
        // Convertir le contenu vers WebVTT pour meilleure compatibilité
        let vttContent = subtitleData.content;
        
        if (format === 'ass' || format === 'ssa') {
          console.log('🔄 Conversion ASS vers SRT puis WebVTT...');
          const srtContent = this.convertAssToSrt(subtitleData.content);
          vttContent = this.convertSrtToVtt(srtContent);
        } else if (format === 'srt' || !format) {
          console.log('🔄 Conversion SRT vers WebVTT...');
          vttContent = this.convertSrtToVtt(subtitleData.content);
        } else if (format === 'vtt') {
          console.log('📝 WebVTT natif utilisé');
          // S'assurer que le WebVTT a un header
          if (!vttContent.startsWith('WEBVTT')) {
            vttContent = 'WEBVTT\n\n' + vttContent;
          }
        }
        
        // Créer un Blob URL avec le type WebVTT
        const blob = new Blob([vttContent], { type: 'text/vtt; charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        
        console.log('📝 Contenu WebVTT créé:', vttContent.substring(0, 200));
        
        // Créer l'élément track
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = this.detectedSubtitles[trackIndex].title || this.detectedSubtitles[trackIndex].language || `Sous-titre ${trackIndex + 1}`;
        track.srclang = this.detectedSubtitles[trackIndex].language || 'fr';
        track.default = false;
        track.src = blobUrl;
        
        console.log('📝 Ajout du track avec Blob URL');

        // Stocker l'URL et le DOM element pour nettoyage (Bug 1)
        if (!this.subtitleUrls) this.subtitleUrls = [];
        this.subtitleUrls.push(blobUrl);
        if (!this._subtitleTrackElements) this._subtitleTrackElements = [];
        this._subtitleTrackElements.push(track);

        track.addEventListener('load', () => {
          if (this._activeSubtitleIndex !== trackIndex) return; // désactivé entre-temps (Bug 4)
          const textTrack = Array.from(this.video.textTracks).find(t => t.label === track.label);
          if (textTrack) {
            textTrack.mode = 'showing';
            console.log('📝 Sous-titre WebVTT activé, cues:', textTrack.cues ? textTrack.cues.length : 0);
            if (textTrack.cues && textTrack.cues.length > 0) this.showSubtitleConfirmation();
          }
        });

        track.addEventListener('error', (e) => {
          console.error('❌ Erreur chargement track WebVTT:', e);
        });

        // Ajouter le track à la vidéo
        this.video.appendChild(track);

        // Activation manuelle après délai (guard contre désactivation rapide — Bug 4).
        // Filet de sécurité pour le cas où l'event 'load' du <track> fire avant que les cues
        // soient réellement parsées (quirk WebVTT/Chromium) - le cas normal est déjà géré
        // immédiatement par le listener 'load' ci-dessus. Délais réduits (1000/2000 → 300/500ms) :
        // avec le cache d'extraction, l'affichage n'a plus besoin d'attendre systématiquement
        // jusqu'à 3s en plus du temps d'extraction FFmpeg.
        if (!this._subtitleTimers) this._subtitleTimers = [];
        const t1 = setTimeout(() => {
          if (this._activeSubtitleIndex !== trackIndex) return;
          const textTrack = Array.from(this.video.textTracks).find(t => t.label === track.label);
          if (!textTrack) return;
          textTrack.mode = 'showing';

          const t2 = setTimeout(() => {
            if (this._activeSubtitleIndex !== trackIndex) return;
            const cueCount = textTrack.cues ? textTrack.cues.length : 0;
            if (cueCount > 0) {
              this.checkAndDisplaySubtitles(textTrack);
              this.addCueChangeListener(textTrack);
              this.showSubtitleConfirmation();
            } else if (textTrack.readyState === 0) {
              textTrack.mode = 'hidden';
              setTimeout(() => {
                if (this._activeSubtitleIndex === trackIndex) textTrack.mode = 'showing';
              }, 100);
            }
          }, 500);
          this._subtitleTimers.push(t2);
        }, 300);
        this._subtitleTimers.push(t1);
        
      } else {
        console.error('📝 Échec de l\'extraction:', result.message);
        
        // Afficher un message d'erreur à l'utilisateur
        if (result.codecType && (result.codecType === 'hdmv_pgs_subtitle' || result.codecType === 'pgssub')) {
          alert('Ces sous-titres sont au format image (PGS) et ne peuvent pas être affichés dans le lecteur web.\n\nPour utiliser ces sous-titres, vous devriez :\n- Utiliser un lecteur externe comme VLC\n- Ou convertir le fichier avec des sous-titres SRT');
        } else {
          alert('Erreur lors de l\'extraction des sous-titres : ' + (result.message || 'Erreur inconnue'));
        }
      }
    } catch (error) {
      console.error('📝 Erreur lors de l\'extraction des sous-titres:', error);
      
      // Supprimer l'indicateur de chargement en cas d'erreur
      const loadingIndicator = this.container.querySelector('.extraction-loading');
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      
      alert('Erreur lors de l\'extraction des sous-titres : ' + error.message);
    }
  }
  
  // Mode plein écran
  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }
  
  enterFullscreen() {
    this.container.classList.add('fullscreen');
    this.isFullscreen = true;
    this.elements.fullscreenIcon.src = '../assets/pictos/compress.svg';
    this.elements.fullscreenBtn.title = 'Sortir du plein écran (F)';
    
    if (this.modal.requestFullscreen) {
      this.modal.requestFullscreen().catch(() => {});
    } else if (this.modal.webkitRequestFullscreen) {
      try { this.modal.webkitRequestFullscreen(); } catch (e) {}
    }
  }
  
  exitFullscreen() {
    this.container.classList.remove('fullscreen');
    this.isFullscreen = false;
    this.elements.fullscreenIcon.src = '../assets/pictos/expand.svg';
    this.elements.fullscreenBtn.title = 'Plein écran (F)';

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      try { document.webkitExitFullscreen(); } catch (e) {}
    }
  }
  
  // Mini lecteur
  toggleMiniPlayer() {
    if (this.isMiniPlayer) {
      this.exitMiniPlayer();
    } else {
      this.enterMiniPlayer();
    }
  }

  enterMiniPlayer() {
    this.isMiniPlayer = true;
    this.modal.classList.add('mini-player');
    this.modal.style.right = '20px';
    this.modal.style.bottom = '20px';
    this.modal.style.left = 'auto';
    this.modal.style.top = 'auto';
    if (this.elements.miniTitle) {
      this.elements.miniTitle.textContent = this.currentMovie?.title || '';
    }
  }

  exitMiniPlayer() {
    this.isMiniPlayer = false;
    this._miniDragActive = false;
    this.modal.classList.remove('mini-player');
    this.modal.style.left = '';
    this.modal.style.top = '';
    this.modal.style.right = '';
    this.modal.style.bottom = '';
  }

  setupMiniPlayerDrag() {
    let dragOffsetX = 0, dragOffsetY = 0;

    this.modal.addEventListener('mousedown', (e) => {
      if (!this.isMiniPlayer) return;
      if (e.target.closest('button')) return;
      this._miniDragActive = true;
      const rect = this.modal.getBoundingClientRect();
      this.modal.style.left = rect.left + 'px';
      this.modal.style.top = rect.top + 'px';
      this.modal.style.right = 'auto';
      this.modal.style.bottom = 'auto';
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._miniDragActive) return;
      const W = 320, H = 180;
      const newLeft = Math.max(0, Math.min(window.innerWidth - W, e.clientX - dragOffsetX));
      const newTop = Math.max(0, Math.min(window.innerHeight - H, e.clientY - dragOffsetY));
      this.modal.style.left = newLeft + 'px';
      this.modal.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
      this._miniDragActive = false;
    });
  }

  // Gestion des contrôles
  showControlsTemporary() {
    this.showControls();
    this.hideControlsDelayed();
  }
  
  showControls() {
    this.container.classList.remove('hide-controls', 'hide-cursor');
    this.controlsVisible = true;
    
    if (this.hideControlsTimer) {
      clearTimeout(this.hideControlsTimer);
      this.hideControlsTimer = null;
    }
  }
  
  hideControlsDelayed() {
    if (this.hideControlsTimer) {
      clearTimeout(this.hideControlsTimer);
    }
    
    this.hideControlsTimer = setTimeout(() => {
      if (this.isPlaying && this.modal.classList.contains('active')) {
        this.container.classList.add('hide-controls');
        if (this.isFullscreen) {
          this.container.classList.add('hide-cursor');
        }
        this.controlsVisible = false;
      }
    }, 3000);
  }
  
  // Indicateurs de chargement
  showLoading() {
    this.elements.loadingIndicator.classList.add('active');
  }
  
  hideLoading() {
    this.elements.loadingIndicator.classList.remove('active');
  }
  
  showBuffering() {
    this.elements.bufferingIndicator.classList.add('active');
  }
  
  hideBuffering() {
    this.elements.bufferingIndicator.classList.remove('active');
  }
  
  // Événements vidéo
  onMetadataLoaded() {
    this.duration = this.video.duration;
    this.updateProgress();
    this.updateVolumeDisplay();

    // Reprendre à la position sauvegardée
    if (this._resumeTime > 0 && this._resumeTime < this.duration - 5) {
      this.video.currentTime = this._resumeTime;
      this._resumeTime = 0;
    }

    // Démarrer automatiquement la lecture
    this.play();
  }
  
  onVideoEnded() {
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.showControls();

    // Marquer comme vu à 100% (efface le progress, met last_watched)
    if (this.currentMovie?.id && this.duration > 0) {
      const seriesInfo = this.seriesContext ? {
        seriesId: this.seriesContext.episodes[this.seriesContext.currentIndex]?.seriesId,
        episodeNumber: this.seriesContext.episodes[this.seriesContext.currentIndex]?.episode_number,
        seasonNumber: this.seriesContext.episodes[this.seriesContext.currentIndex]?.season_number
      } : null;
      window.electronAPI?.saveProgress?.(this.currentMovie.id, 1.0, Math.floor(this.duration), seriesInfo);
    }

    // Passer automatiquement à l'épisode suivant si on est en mode série
    if (this.seriesContext) {
      const { episodes, currentIndex } = this.seriesContext;
      if (currentIndex < episodes.length - 1) {
        console.log('▶️ Fin d\'épisode — passage automatique au suivant');
        setTimeout(() => this.playNextEpisode(), 1500);
      }
    }
  }

  updateSeriesNavigation() {
    const hasSeries = !!this.seriesContext;
    const { episodes, currentIndex } = this.seriesContext || { episodes: [], currentIndex: 0 };

    const showPrev = hasSeries && currentIndex > 0;
    const showNext = hasSeries && currentIndex < episodes.length - 1;

    this.elements.prevEpisodeBtn.style.display = showPrev ? '' : 'none';
    this.elements.nextEpisodeBtn.style.display = showNext ? '' : 'none';
  }

  playNextEpisode() {
    if (!this.seriesContext) return;
    const { episodes, currentIndex } = this.seriesContext;
    if (currentIndex >= episodes.length - 1) return;

    const nextEpisode = episodes[currentIndex + 1];
    const nextContext = { episodes, currentIndex: currentIndex + 1 };
    const nextPath = (nextEpisode.audioStatus === 'ok' && nextEpisode.audioConvertedPath)
      ? nextEpisode.audioConvertedPath : nextEpisode.path;
    console.log('⏭️ Épisode suivant:', nextEpisode.title);
    this.open(nextEpisode.id, nextEpisode.title, nextPath, nextContext, nextEpisode.audioStatus === 'ok', nextEpisode.path);
  }

  playPreviousEpisode() {
    if (!this.seriesContext) return;
    const { episodes, currentIndex } = this.seriesContext;
    if (currentIndex <= 0) return;

    const prevEpisode = episodes[currentIndex - 1];
    const prevContext = { episodes, currentIndex: currentIndex - 1 };
    const prevPath = (prevEpisode.audioStatus === 'ok' && prevEpisode.audioConvertedPath)
      ? prevEpisode.audioConvertedPath : prevEpisode.path;
    console.log('⏮️ Épisode précédent:', prevEpisode.title);
    this.open(prevEpisode.id, prevEpisode.title, prevPath, prevContext, prevEpisode.audioStatus === 'ok', prevEpisode.path);
  }
  
  onVideoError(e) {
    console.error('Erreur vidéo:', e);
    this.hideLoading();
    this.hideBuffering();

    // Ne pas afficher d'alerte si le lecteur est en cours de fermeture
    if (this.isClosing) {
      console.log('Erreur vidéo ignorée (lecteur en cours de fermeture)');
      return;
    }

    // Ne pas afficher d'alerte si la modal n'est pas active
    if (!this.modal.classList.contains('active')) {
      console.log('Erreur vidéo ignorée (modal inactive)');
      return;
    }

    // Ne pas traiter si on est en cours de retry avec transcodage
    if (this.isRetryingWithTranscode) {
      console.log('Erreur vidéo ignorée (retry transcodage en cours)');
      return;
    }

    // Ne pas traiter si un dialogue de conversion est déjà affiché
    if (this.isShowingConversionDialog) {
      console.log('Erreur vidéo ignorée (dialogue de conversion affiché)');
      return;
    }

    // Ne pas traiter si une conversion est en attente (évite les faux positifs
    // quand on remet src='' pour stopper la lecture du fichier original)
    if (this._conversionPending) {
      console.log('Erreur vidéo ignorée (conversion en attente)');
      return;
    }

    let errorMessage = 'Erreur lors de la lecture de la vidéo';

    if (this.video.error) {
      const errorCode = this.video.error.code;
      const errorMsg = this.video.error.message || '';

      console.log(`Code erreur: ${errorCode}, Message: ${errorMsg}`);

      switch(errorCode) {
        case 1:
          errorMessage = 'Lecture interrompue par l\'utilisateur';
          this.showErrorModal(errorMessage, false);
          return;

        case 2:
          errorMessage = 'Erreur réseau lors du chargement.\n\nVérifiez que le fichier existe toujours sur votre disque.';
          this.showErrorModal(errorMessage, false);
          return;

        case 3:
        case 4:
          // Erreur de décodage ou format non supporté

          // Si le fichier converti échoue aussi (ex: HEVC vidéo non transcodé) → forcer reconversion vidéo+audio
          if (this.currentMovie?.audioReady) {
            console.log('⚠️ Erreur sur fichier converti — reconversion complète (vidéo + audio) proposée');
            this.currentMovie.audioReady = false;
            this.hasTriedTranscode = false;
            this.needsVideoTranscode = true; // forcer transcodage vidéo même si HEVC pas encore détecté
            this._showConversionDialog();
            return;
          }

          // Vérifier le statut de conversion en DB avant de proposer le dialog
          if (this.currentMovie?.id && window.electronAPI?.getAudioStatuses) {
            window.electronAPI.getAudioStatuses().then(statusRes => {
              if (statusRes?.success) {
                const entry = statusRes.statuses[this.currentMovie.id];
                if (entry?.status === 'ok' && entry.convertedPath) {
                  console.log('✅ Conversion DB trouvée — lecture directe depuis onVideoError');
                  this.playConvertedFile(entry.convertedPath);
                  return;
                }
                if (entry?.status === 'converting' || entry?.status === 'pending') {
                  console.log('⏳ Conversion en cours — affichage toast depuis onVideoError');
                  this._conversionPending = true;
                  this._showAudioWaitToast();
                  return;
                }
              }
              // Statut inconnu ou absent → afficher le dialog de conversion
              this._showConversionDialog();
            }).catch(() => this._showConversionDialog());
            return;
          }

          // Éviter les boucles si on a déjà essayé
          if (this.hasTriedTranscode) {
            console.log('⚠️ Conversion déjà tentée, affichage erreur finale');
            this.showErrorModal(
              'Format non supporté.\n\nLe fichier utilise un codec incompatible.\n\nUtilisez VLC ou un lecteur externe.',
              false
            );
            return;
          }

          this._showConversionDialog();
          return;

        default:
          errorMessage = `Erreur de lecture (code ${errorCode}).\n\n${errorMsg || 'Veuillez réessayer.'}`;
      }
    }

    this.showErrorModal(errorMessage, false);
  }

  _showConversionDialog() {
    const videoCodec = this.detectedVideoTracks?.[0]?.codec_name || '';
    const audioCodec = this.detectedAudioTracks?.[0]?.codec_name || '';
    // needsVideoTranscode peut être pré-positionné (ex: fichier converti illisible = forcer transco vidéo)
    const isHEVC = this.needsVideoTranscode ||
      videoCodec.toLowerCase().includes('hevc') || videoCodec.toLowerCase().includes('h265');

    console.log(`⚠️ Erreur lecture - Vidéo: ${videoCodec}, Audio: ${audioCodec}, HEVC: ${isHEVC}`);

    if (this.originalMoviePath) {
      if (isHEVC) {
        console.log('📋 HEVC non supporté sur ce système - affichage menu conversion');
        this.needsVideoTranscode = true;
        this.showLanguageSelectionDialog(this.originalMoviePath, videoCodec.toUpperCase(), true);
      } else {
        // Si FFprobe n'a pas encore fini, audioCodec peut être vide — on affiche quand même
        // le dialog de conversion avec le nom connu ou un label générique
        const codecLabel = audioCodec ? audioCodec.toUpperCase() : 'CODEC NON SUPPORTÉ';
        console.log(`📋 Codec audio problématique (${codecLabel}) - affichage menu conversion`);
        this.showLanguageSelectionDialog(this.originalMoviePath, codecLabel, false);
      }
      return;
    }

    this.showErrorModal(
      'Format vidéo non supporté.\n\nLe fichier utilise peut-être un codec incompatible.',
      false
    );
  }

  /**
   * Affiche une modal d'erreur plus détaillée
   */
  showErrorModal(message, showRetry = false) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'video-error-modal';
    errorDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 30px;
      border-radius: 12px;
      z-index: 10002;
      max-width: 450px;
      text-align: center;
      border: 1px solid #ff6b6b;
    `;

    errorDiv.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
      <div style="font-size: 14px; line-height: 1.5; white-space: pre-line; margin-bottom: 20px; text-align: left;">${message}</div>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        ${showRetry ? `<button class="retry-btn" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Réessayer avec transcodage</button>` : ''}
        <button class="open-external-btn" style="
          background: #FF9800;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Ouvrir avec lecteur externe</button>
        <button class="close-error-btn" style="
          background: #666;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Fermer</button>
      </div>
    `;

    this.container.appendChild(errorDiv);

    // Gestionnaire pour fermer
    errorDiv.querySelector('.close-error-btn').addEventListener('click', () => {
      errorDiv.remove();
      this.close();
    });

    // Gestionnaire pour ouvrir avec lecteur externe
    errorDiv.querySelector('.open-external-btn').addEventListener('click', async () => {
      errorDiv.remove();
      if (this.originalMoviePath && window.electronAPI && window.electronAPI.playMedia) {
        try {
          await window.electronAPI.playMedia(this.currentMovie?.id);
          this.close();
        } catch (err) {
          console.error('Erreur ouverture externe:', err);
          alert('Impossible d\'ouvrir le fichier avec le lecteur externe.');
        }
      } else if (this.originalMoviePath) {
        // Fallback: copier le chemin
        navigator.clipboard.writeText(this.originalMoviePath);
        alert(`Chemin copié dans le presse-papier:\n${this.originalMoviePath}\n\nOuvrez ce fichier avec VLC.`);
        this.close();
      }
    });

    // Gestionnaire pour réessayer avec transcodage
    if (showRetry) {
      errorDiv.querySelector('.retry-btn').addEventListener('click', () => {
        errorDiv.remove();
        this.retryWithTranscode();
      });
    }
  }

  /**
   * Réessaye la lecture avec transcodage audio activé
   * Utilise la pré-conversion complète pour éviter les timeouts
   */
  async retryWithTranscode() {
    if (!this.originalMoviePath) {
      console.error('Pas de chemin original pour le transcodage');
      return;
    }

    // Marquer le transcodage comme tenté pour éviter les boucles infinies
    this.hasTriedTranscode = true;
    this.isRetryingWithTranscode = true;

    // Déterminer si on a besoin de transcoder la vidéo (HEVC)
    const needsVideoTranscode = this.needsVideoTranscode || false;
    const audioCodecName = this.detectedAudioTracks?.[0]?.codec_name || 'audio';
    const videoCodecName = this.detectedVideoTracks?.[0]?.codec_name || '';

    const codecInfo = needsVideoTranscode
      ? `${videoCodecName.toUpperCase()} (vidéo) + ${audioCodecName.toUpperCase()}`
      : audioCodecName.toUpperCase();

    console.log('🔄 Nouvelle tentative avec transcodage:', needsVideoTranscode ? 'vidéo + audio' : 'audio seulement');

    // Utiliser la pré-conversion complète au lieu du streaming
    // Cela évite les timeouts et sauvegarde la conversion pour les prochaines lectures
    await this.startPreConversion(this.originalMoviePath, codecInfo, needsVideoTranscode);

    this.isRetryingWithTranscode = false;
  }

  // Utilitaires
  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  getLanguageName(langCode) {
    const languages = {
      'fr': 'Français',
      'en': 'Anglais',
      'es': 'Espagnol',
      'de': 'Allemand',
      'it': 'Italien',
      'pt': 'Portugais',
      'ru': 'Russe',
      'ja': 'Japonais',
      'ko': 'Coréen',
      'zh': 'Chinois',
      'ar': 'Arabe',
      'hi': 'Hindi',
      'tr': 'Turc',
      'pl': 'Polonais',
      'nl': 'Néerlandais',
      'sv': 'Suédois',
      'da': 'Danois',
      'no': 'Norvégien',
      'fi': 'Finnois',
      'cs': 'Tchèque',
      'hu': 'Hongrois',
      'ro': 'Roumain',
      'bg': 'Bulgare',
      'hr': 'Croate',
      'sk': 'Slovaque',
      'sl': 'Slovène',
      'et': 'Estonien',
      'lv': 'Letton',
      'lt': 'Lituanien',
      'el': 'Grec',
      'he': 'Hébreu',
      'th': 'Thaï',
      'vi': 'Vietnamien',
      'id': 'Indonésien',
      'ms': 'Malais',
      'tl': 'Tagalog',
      'uk': 'Ukrainien',
      'be': 'Biélorusse',
      'mk': 'Macédonien',
      'sr': 'Serbe',
      'bs': 'Bosniaque',
      'sq': 'Albanais',
      'ca': 'Catalan',
      'eu': 'Basque',
      'gl': 'Galicien',
      'cy': 'Gallois',
      'ga': 'Irlandais',
      'mt': 'Maltais',
      'is': 'Islandais',
      'fo': 'Féroïen',
      'und': 'Non défini'
    };
    
    return languages[langCode] || langCode.toUpperCase();
  }

  _cancelSubtitleTimers() {
    if (this._subtitleTimers) this._subtitleTimers.forEach(id => clearTimeout(id));
    this._subtitleTimers = [];
  }

  _removeSubtitleTracks() {
    if (this._subtitleTrackElements) {
      this._subtitleTrackElements.forEach(track => {
        if (track.parentNode) track.parentNode.removeChild(track);
      });
    }
    this._subtitleTrackElements = [];
    if (this.subtitleUrls) {
      this.subtitleUrls.forEach(url => URL.revokeObjectURL(url));
      this.subtitleUrls = [];
    }
  }

  showSubtitleConfirmation() {
    // Créer un message temporaire pour confirmer que les sous-titres sont actifs
    const confirmationDiv = document.createElement('div');
    confirmationDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10001;
      font-size: 16px;
      text-align: center;
    `;
    confirmationDiv.textContent = '✅ Sous-titres activés';
    
    this.container.appendChild(confirmationDiv);
    
    // Supprimer après 2 secondes
    setTimeout(() => {
      if (confirmationDiv.parentNode) {
        confirmationDiv.parentNode.removeChild(confirmationDiv);
      }
    }, 2000);
  }

  showExtractionLoading() {
    // Créer un indicateur de chargement pour l'extraction
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'extraction-loading';
    loadingDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10002;
      font-size: 16px;
      text-align: center;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    loadingDiv.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        border: 2px solid #fff;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span>Extraction des sous-titres...</span>
    `;
    
    // Ajouter l'animation CSS
    if (!document.querySelector('#extraction-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'extraction-loading-styles';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.container.appendChild(loadingDiv);
    return loadingDiv;
  }


  convertAssToSrt(assContent) {
    console.log('🔄 Conversion ASS vers SRT en cours...');
    
    try {
      const lines = assContent.split('\n');
      const dialogueLines = lines.filter(line => line.startsWith('Dialogue:'));
      
      if (dialogueLines.length === 0) {
        console.log('⚠️ Aucune ligne de dialogue trouvée dans le fichier ASS');
        return '1\n00:00:01,000 --> 00:00:05,000\nAucun dialogue trouvé dans le fichier ASS\n';
      }
      
      let srtContent = '';
      let index = 1;
      
      dialogueLines.forEach(line => {
        try {
          // Format ASS : Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
          const parts = line.substring(9).split(','); // Enlever 'Dialogue:'
          
          if (parts.length < 10) return;
          
          const startTime = this.convertAssTimeToSrt(parts[1]);
          const endTime = this.convertAssTimeToSrt(parts[2]);
          const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ');
          
          if (startTime && endTime && text.trim()) {
            srtContent += `${index}\n${startTime} --> ${endTime}\n${text.trim()}\n\n`;
            index++;
          }
        } catch (err) {
          console.log('⚠️ Erreur conversion ligne ASS:', err.message);
        }
      });
      
      if (srtContent) {
        console.log('✅ Conversion ASS vers SRT réussie:', index - 1, 'sous-titres');
        return srtContent;
      } else {
        return '1\n00:00:01,000 --> 00:00:05,000\nErreur de conversion du fichier ASS\n';
      }
      
    } catch (error) {
      console.error('❌ Erreur conversion ASS:', error);
      return '1\n00:00:01,000 --> 00:00:05,000\nErreur de conversion du format ASS\n';
    }
  }

  convertAssTimeToSrt(assTime) {
    try {
      // Format ASS : H:MM:SS.CC (centièmes)
      // Format SRT : HH:MM:SS,mmm (millièmes)
      const parts = assTime.split(':');
      if (parts.length !== 3) return null;
      
      const hours = parseInt(parts[0]).toString().padStart(2, '0');
      const minutes = parseInt(parts[1]).toString().padStart(2, '0');
      const secParts = parts[2].split('.');
      const seconds = parseInt(secParts[0]).toString().padStart(2, '0');
      const centiseconds = secParts[1] || '00';
      const milliseconds = (parseInt(centiseconds) * 10).toString().padStart(3, '0');
      
      return `${hours}:${minutes}:${seconds},${milliseconds}`;
    } catch (error) {
      console.error('❌ Erreur conversion temps ASS:', error);
      return null;
    }
  }

  convertSrtToVtt(srtContent) {
    console.log('🔄 Conversion SRT vers WebVTT en cours...');

    try {
      // Normaliser les fins de ligne (CRLF Windows → LF) et supprimer le BOM UTF-8
      srtContent = srtContent.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Ajouter l'en-tête WebVTT
      let vttContent = 'WEBVTT\n\n';

      // Diviser en blocs de sous-titres
      const blocks = srtContent.trim().split(/\n\s*\n/);
      
      blocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        if (lines.length >= 3) {
          // Ignorer le numéro de séquence (première ligne)
          const timeLine = lines[1];
          const textLines = lines.slice(2);
          
          // Convertir le format de temps SRT vers WebVTT
          // SRT: 00:00:30,489 --> 00:00:32,866
          // VTT: 00:00:30.489 --> 00:00:32.866
          const vttTimeLine = timeLine.replace(/,/g, '.');
          
          // Nettoyer et convertir le texte
          let text = textLines.join('\n')
            .replace(/\{[^}]*\}/g, '')   // supprimer les tags ASS/SSA : {\an8}, {\pos(...)}, {\c&H...&}, etc.
            .replace(/<font[^>]*>/gi, '') // supprimer les balises <font ...>
            .replace(/<\/font>/gi, '')
            .replace(/<i>/g, '<i>')
            .replace(/<\/i>/g, '</i>')
            .replace(/<b>/g, '<b>')
            .replace(/<\/b>/g, '</b>')
            .replace(/<u>/g, '<u>')
            .replace(/<\/u>/g, '</u>')
            .trim();
          
          // Ajouter le bloc WebVTT
          vttContent += `${vttTimeLine}\n${text}\n\n`;
        }
      });
      
      console.log('✅ Conversion SRT vers WebVTT réussie');
      return vttContent;
      
    } catch (error) {
      console.error('❌ Erreur conversion SRT vers WebVTT:', error);
      // Fallback basique
      return `WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nErreur de conversion SRT vers WebVTT\n\n`;
    }
  }

  checkAndDisplaySubtitles(textTrack) {
    console.log('🔍 Vérification de l\'affichage des sous-titres...');
    
    // Forcer l'affichage des styles CSS pour les sous-titres
    this.ensureSubtitleStyles();
    
    // Vérifier si on a des cues actives au temps actuel
    const currentTime = this.video.currentTime;
    let activeCueFound = false;
    
    if (textTrack.cues) {
      for (let i = 0; i < textTrack.cues.length; i++) {
        const cue = textTrack.cues[i];
        if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
          console.log('📝 Cue active trouvée:', cue.text);
          activeCueFound = true;
          break;
        }
      }
    }
    
    if (!activeCueFound) {
      console.log('📝 Aucune cue active au temps', currentTime);
    }
    
    // Vérifier que l'élément vidéo a les bons attributs
    console.log('📝 Attributs vidéo - crossorigin:', this.video.crossOrigin);
    console.log('📝 Éléments track dans le DOM:', this.video.querySelectorAll('track').length);
  }

  ensureSubtitleStyles() {
    // Ajouter des styles CSS pour s'assurer que les sous-titres sont visibles
    if (!document.querySelector('#subtitle-styles')) {
      const style = document.createElement('style');
      style.id = 'subtitle-styles';
      style.textContent = `
        .video-player-element::cue {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          font-size: 18px;
          font-family: Arial, sans-serif;
          text-align: center;
          line-height: 1.4;
          padding: 0.1em 0.3em;
          border-radius: 2px;
        }
        
        .video-player-element::-webkit-media-text-track-display {
          z-index: 9999 !important;
        }
        
        .video-player-element::-webkit-media-text-track-container {
          z-index: 9999 !important;
          position: relative !important;
        }
      `;
      document.head.appendChild(style);
      console.log('📝 Styles des sous-titres ajoutés');
    }
  }

  addCueChangeListener(textTrack) {
    // Surveiller les changements de cues actives
    textTrack.addEventListener('cuechange', () => {
      const activeCues = textTrack.activeCues;
      console.log('📝 Changement de cues:', activeCues ? activeCues.length : 0, 'actives');
      
      if (activeCues && activeCues.length > 0) {
        for (let i = 0; i < activeCues.length; i++) {
          console.log('📝 Cue active:', activeCues[i].text);
        }
      } else {
        console.log('📝 Aucune cue active');
      }
    });

    console.log('📝 Listener cuechange ajouté');
  }

  // ========================================
  // WATCH PARTY METHODS
  // ========================================

  enableWatchParty() {
    this.watchPartyActive = true;

    // Configurer les callbacks pour les événements distants
    watchPartyClient.onPlaybackEvent = (type, data) => {
      this.handleRemotePlaybackEvent(type, data);
    };

    console.log('🎬 Watch Party activée');
  }

  disableWatchParty() {
    this.watchPartyActive = false;
    watchPartyClient.onPlaybackEvent = null;
    console.log('🎬 Watch Party désactivée');
  }

  handleRemotePlaybackEvent(type, data) {
    // Activer le flag pour empêcher la réémission
    this.isSyncingFromRemote = true;

    try {
      switch(type) {
        case 'play':
          // Synchroniser le temps si l'écart > 1 seconde
          if (Math.abs(this.video.currentTime - data.currentTime) > 1) {
            this.video.currentTime = data.currentTime;
          }
          this.play();
          break;

        case 'pause':
          // Synchroniser le temps si l'écart > 0.5 secondes
          if (Math.abs(this.video.currentTime - data.currentTime) > 0.5) {
            this.video.currentTime = data.currentTime;
          }
          this.pause();
          break;

        case 'seek':
          this.video.currentTime = data.currentTime;
          break;

        case 'ratechange':
          this.setPlaybackRate(data.playbackRate);
          break;

        case 'audiotrack':
          console.log('🎵 Synchronisation piste audio:', data.trackIndex);
          this.setAudioTrack(data.trackIndex);
          break;

        case 'subtitle':
          console.log('📝 Synchronisation sous-titres:', data.trackIndex);
          this.setSubtitleTrack(data.trackIndex);
          break;
      }
    } finally {
      // Réinitialiser le flag après 100ms
      setTimeout(() => {
        this.isSyncingFromRemote = false;
      }, 100);
    }
  }
}

// Créer l'instance globale du lecteur
window.videoPlayer = new VideoPlayer();

// Fonction globale pour ouvrir le lecteur vidéo
window.openVideoPlayer = async function(movieId, title, path, seriesContext = null, audioReady = false, originalPath = null) {
  try {
    await window.videoPlayer.open(movieId, title, path, seriesContext, audioReady, originalPath);
  } catch (error) {
    console.error('Erreur lors de l\'ouverture du lecteur vidéo:', error);
    alert('Erreur lors du chargement de la vidéo');
  }
};

console.log('🎬 Lecteur vidéo moderne initialisé');