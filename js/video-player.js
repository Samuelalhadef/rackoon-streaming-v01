/**
 * Lecteur vidéo moderne complet pour Rackoon Streaming
 */

class VideoPlayer {
  constructor() {
    this.modal = null;
    this.container = null;
    this.video = null;
    this.currentMovie = null;
    
    // États
    this.isPlaying = false;
    this.isFullscreen = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 1;
    this.playbackRate = 1;
    this.controlsVisible = true;
    this.isClosing = false;

    // Watch Party
    this.watchPartyActive = false;
    this.isSyncingFromRemote = false; // Empêche les boucles d'événements

    // Timers
    this.hideControlsTimer = null;
    this.progressUpdateTimer = null;
    
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
      <div class="video-player-container">
        <!-- Élément vidéo principal -->
        <video class="video-player-element" controls="false" controlslist="nodownload nofullscreen noremoteplayback"></video>
        
        <!-- Informations vidéo -->
        <div class="video-info">
          <div class="video-title"></div>
          <div class="video-details"></div>
        </div>
        
        <!-- Bouton fermer -->
        <button class="close-btn" title="Fermer (Échap)">
          <i class="fas fa-times"></i>
        </button>
        
        <!-- Indicateurs de chargement -->
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        
        <div class="buffering-indicator"></div>
        
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
              <button class="control-btn play-pause" title="Lecture/Pause (Espace)">
                <i class="fas fa-play"></i>
              </button>
              
              <div class="volume-container">
                <button class="control-btn volume-btn" title="Volume">
                  <i class="fas fa-volume-up"></i>
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
                <i class="fas fa-volume-up"></i>
              </button>
              
              <button class="control-btn subtitle-btn" title="Sous-titres">
                <i class="fas fa-closed-captioning"></i>
              </button>
              
              <button class="control-btn speed-btn" title="Vitesse de lecture">
                <i class="fas fa-tachometer-alt"></i>
                <span class="speed-text">1x</span>
              </button>
              
              <button class="control-btn fullscreen-btn" title="Plein écran (F)">
                <i class="fas fa-expand"></i>
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
      playPauseBtn: this.modal.querySelector('.play-pause'),
      playPauseIcon: this.modal.querySelector('.play-pause i'),
      volumeBtn: this.modal.querySelector('.volume-btn'),
      volumeIcon: this.modal.querySelector('.volume-btn i'),
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
      fullscreenBtn: this.modal.querySelector('.fullscreen-btn'),
      fullscreenIcon: this.modal.querySelector('.fullscreen-btn i')
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
    this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.elements.volumeBtn.addEventListener('click', () => this.toggleMute());
    this.elements.speedBtn.addEventListener('click', () => this.toggleSpeedMenu());
    this.elements.audioBtn.addEventListener('click', () => this.toggleAudioMenu());
    this.elements.subtitleBtn.addEventListener('click', () => this.toggleSubtitleMenu());
    this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    // Timeline
    this.elements.timelineContainer.addEventListener('click', (e) => this.seekToPosition(e));
    this.elements.timelineContainer.addEventListener('mousemove', (e) => this.updateTimeDisplay(e));
    this.elements.timelineContainer.addEventListener('mouseleave', () => this.hideTimeDisplay());
    
    // Volume slider
    this.elements.volumeSlider.addEventListener('click', (e) => this.setVolume(e));
    
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
  
  async open(movieId, movieTitle, moviePath) {
    try {
      // Validation des paramètres
      if (!movieTitle || typeof movieTitle !== 'string') {
        movieTitle = 'Vidéo sans titre';
      }

      if (!moviePath || typeof moviePath !== 'string') {
        throw new Error('Chemin de la vidéo manquant');
      }

      this.currentMovie = { id: movieId, title: movieTitle, path: moviePath };

      // Enregistrer le moment de début du visionnage pour les statistiques
      this.watchStartTime = Date.now();

      // Afficher la modal
      this.modal.classList.add('active');

      // Mettre à jour les informations
      const truncatedTitle = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
      this.elements.title.textContent = truncatedTitle;
      this.elements.details.textContent = 'Chargement...';

      // Charger la vidéo
      this.showLoading();

      // Vérifier si c'est une URL HTTP (streaming) ou un chemin local
      let videoUrl;
      if (moviePath.startsWith('http://') || moviePath.startsWith('https://')) {
        // URL de streaming - utiliser telle quelle
        videoUrl = moviePath;
        console.log('📡 URL de streaming:', videoUrl);
      } else {
        // Chemin local - convertir en file:// pour Electron
        if (!moviePath) {
          throw new Error('Chemin de la vidéo non fourni');
        }
        const normalizedPath = moviePath.replace(/\\/g, '/');
        videoUrl = `file:///${normalizedPath}`;
        console.log('🎬 URL vidéo locale:', videoUrl);
      }

      this.video.src = videoUrl;
      
      // Initialiser les propriétés audio
      this.video.volume = this.volume;
      this.video.muted = false;
      
      // Attendre le chargement pour détecter les pistes
      this.video.addEventListener('loadedmetadata', () => {
        console.log('📹 Métadonnées chargées - Détection des pistes...');
        this.detectAllTracks();
      });
      
      // Obtenir les détails du film
      const movieDetails = await window.electronAPI.getMediaDetails(movieId);
      if (movieDetails.success && movieDetails.movie) {
        const movie = movieDetails.movie;
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
      console.error('Erreur lors de l\'ouverture du lecteur:', error);
      this.hideLoading();
      alert('Erreur lors du chargement de la vidéo: ' + error.message);
      this.close();
    }
  }
  
  close() {
    this.isClosing = true; // Marquer comme en cours de fermeture

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

    this.pause();
    this.modal.classList.remove('active');

    // Nettoyer les URLs de sous-titres
    if (this.subtitleUrls) {
      this.subtitleUrls.forEach(url => URL.revokeObjectURL(url));
      this.subtitleUrls = [];
    }

    // Supprimer l'URL de la vidéo de manière propre
    this.video.removeAttribute('src');
    this.video.load(); // Forcer le nettoyage

    this.currentMovie = null;
    this.resetPlayer();
    
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
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.playbackRate = 1;
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
      icon.className = 'fas fa-pause';
      this.elements.playPauseBtn.title = 'Pause (Espace)';
    } else {
      icon.className = 'fas fa-play';
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
  
  setVolume(e) {
    const rect = this.elements.volumeSlider.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const volume = Math.max(0, Math.min(1, percent));
    
    this.video.volume = volume;
    this.video.muted = false;
    this.volume = volume;
    this.updateVolumeDisplay();
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
      icon.className = 'fas fa-volume-mute';
    } else if (volume < 0.5) {
      icon.className = 'fas fa-volume-down';
    } else {
      icon.className = 'fas fa-volume-up';
    }
  }
  
  // Navigation temporelle
  seekToPosition(e) {
    const rect = this.elements.timelineContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    this.seekToPercent(percent);
  }
  
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
      // Priorité 1: Demander les informations via FFprobe (plus fiable)
      if (window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
        console.log('🎵 Détection pistes audio via FFprobe...');
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.path);
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
            
            this.createAudioTrackButton(index, label, index === 0);
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
  
  async detectAllTracks() {
    console.log('🔍 Démarrage de la détection complète des pistes...');
    
    // Attendre un peu pour que les pistes soient disponibles
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Log des informations de base
      console.log('📊 Informations vidéo:', {
        readyState: this.video.readyState,
        duration: this.video.duration,
        videoTracks: this.video.videoTracks?.length || 0,
        audioTracks: this.video.audioTracks?.length || 0,
        textTracks: this.video.textTracks?.length || 0
      });
      
      // Forcer la détection des textTracks pour MKV
      await this.forceDetectTextTracks();
      
      // Log final après détection
      console.log('📊 Pistes détectées après analyse:', {
        audioTracks: this.video.audioTracks?.length || 0,
        textTracks: this.video.textTracks?.length || 0
      });
      
    } catch (error) {
      console.error('Erreur lors de la détection des pistes:', error);
    }
  }
  
  async forceDetectTextTracks() {
    // Tenter plusieurs méthodes pour forcer la détection des sous-titres MKV
    
    // Méthode 1: Vérifier les textTracks après un délai
    if (this.video.textTracks && this.video.textTracks.length > 0) {
      console.log('📝 TextTracks natifs détectés:', this.video.textTracks.length);
      for (let i = 0; i < this.video.textTracks.length; i++) {
        const track = this.video.textTracks[i];
        console.log(`📝 Piste ${i}:`, {
          kind: track.kind,
          label: track.label,
          language: track.language,
          mode: track.mode
        });
      }
      return;
    }
    
    // Méthode 2: Essayer de forcer l'activation des pistes
    try {
      // Parfois les pistes sont là mais en mode 'disabled'
      const trackElements = this.video.querySelectorAll('track');
      console.log('📝 Éléments track trouvés:', trackElements.length);
      
      trackElements.forEach((trackEl, index) => {
        console.log(`📝 Track element ${index}:`, {
          src: trackEl.src,
          kind: trackEl.kind,
          label: trackEl.label,
          srclang: trackEl.srclang
        });
      });
    } catch (error) {
      console.log('📝 Pas d\'éléments track trouvés');
    }
    
    // Méthode 3: Demander à FFmpeg via Electron (si disponible)
    if (window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
      try {
        console.log('📝 Tentative FFmpeg pour fichier:', this.currentMovie.path);
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.path);
        if (videoInfo.success) {
          console.log('📝 Informations FFmpeg:', videoInfo);
          if (videoInfo.subtitleTracks && videoInfo.subtitleTracks.length > 0) {
            console.log('📝 Sous-titres détectés via FFmpeg:', videoInfo.subtitleTracks.length);
            // Stocker les informations pour utilisation ultérieure
            this.detectedSubtitles = videoInfo.subtitleTracks;
          }
        }
      } catch (error) {
        console.log('📝 FFmpeg non disponible:', error.message);
      }
    }
    
    console.log('📝 Détection textTracks terminée');
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
      // Méthode 2: Si c'est une piste détectée via FFmpeg et qu'on a plusieurs pistes
      else if (this.detectedAudioTracks && this.detectedAudioTracks.length > 1) {
        // Pour l'instant, on ne peut pas changer de piste audio en temps réel via FFmpeg
        // sans recharger la vidéo. On affiche un message informatif.
        console.log('🎵 Changement de piste audio FFmpeg non supporté en temps réel');
        
        // Alternative: On pourrait recharger la vidéo avec une piste audio spécifique
        // mais cela nécessiterait une implémentation plus complexe
        alert('Le changement de piste audio en temps réel n\'est pas encore supporté pour ce fichier.\nVeuillez redémarrer la lecture pour changer de piste.');
      }
      
      // Mettre à jour l'interface
      this.elements.audioTracks.querySelectorAll('.audio-option').forEach((btn, index) => {
        btn.classList.toggle('active', index === trackIndex);
      });
      
    } catch (error) {
      console.error('Erreur lors du changement de piste audio:', error);
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
      // Priorité 1: Demander les informations via FFprobe (plus fiable)
      if (window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
        console.log('📝 Détection sous-titres via FFprobe...');
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.path);
        if (videoInfo.success && videoInfo.subtitleTracks && videoInfo.subtitleTracks.length > 0) {
          console.log('📝 Sous-titres détectés via FFprobe:', videoInfo.subtitleTracks.length);
          
          // Stocker les informations pour utilisation ultérieure
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
    
    // Désactiver tous les sous-titres natifs
    if (this.video.textTracks) {
      for (let i = 0; i < this.video.textTracks.length; i++) {
        this.video.textTracks[i].mode = 'hidden';
      }
      
      // Activer la piste sélectionnée si c'est une piste native
      if (trackIndex >= 0 && trackIndex < this.video.textTracks.length) {
        this.video.textTracks[trackIndex].mode = 'showing';
        console.log('📝 Piste native activée:', trackIndex);
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
    
    this.elements.subtitleMenu.classList.remove('active');
  }
  
  async loadExternalSubtitle(trackIndex) {
    if (!window.electronAPI || !window.electronAPI.extractSubtitle) {
      console.log('📝 Extraction de sous-titres non disponible');
      return;
    }
    
    try {
      console.log('📝 Extraction sous-titre piste:', trackIndex);
      console.log('📝 Chemin vidéo:', this.currentMovie.path);
      
      // Afficher un indicateur de chargement
      const loadingIndicator = this.showExtractionLoading();
      
      const result = await window.electronAPI.extractSubtitle(this.currentMovie.path, trackIndex);
      
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
        
        // Stocker l'URL pour nettoyage ultérieur
        if (!this.subtitleUrls) this.subtitleUrls = [];
        this.subtitleUrls.push(blobUrl);
        
        // Ajouter les événements
        track.addEventListener('load', () => {
          console.log('📝 Track WebVTT chargé avec succès');
          const textTrack = Array.from(this.video.textTracks).find(t => t.label === track.label);
          if (textTrack) {
            textTrack.mode = 'showing';
            console.log('📝 Sous-titre WebVTT activé, cues:', textTrack.cues ? textTrack.cues.length : 0);
            
            if (textTrack.cues && textTrack.cues.length > 0) {
              this.showSubtitleConfirmation();
            }
          }
        });
        
        track.addEventListener('error', (e) => {
          console.error('❌ Erreur chargement track WebVTT:', e);
          console.error('❌ URL du blob:', blobUrl);
        });
        
        // Ajouter le track à la vidéo
        this.video.appendChild(track);
        
        // Activation manuelle après un délai plus long pour WebVTT
        setTimeout(() => {
          const textTrack = Array.from(this.video.textTracks).find(t => t.label === track.label);
          if (textTrack) {
            textTrack.mode = 'showing';
            console.log('📝 Activation manuelle WebVTT, mode:', textTrack.mode);
            
            // Vérifier les cues après un délai plus long
            setTimeout(() => {
              const cueCount = textTrack.cues ? textTrack.cues.length : 0;
              console.log('📝 Nombre final de cues WebVTT:', cueCount);
              if (cueCount > 0) {
                console.log('✅ Sous-titres WebVTT chargés avec succès');
                
                // Vérifier les détails des sous-titres
                console.log('📝 Première cue:', textTrack.cues[0]);
                console.log('📝 Temps vidéo actuel:', this.video.currentTime);
                console.log('📝 Mode du track:', textTrack.mode);
                console.log('📝 Activecues:', textTrack.activeCues ? textTrack.activeCues.length : 'N/A');
                
                // Forcer l'affichage en cherchant une cue active
                this.checkAndDisplaySubtitles(textTrack);
                
                // Ajouter un listener pour surveiller les cues actives
                this.addCueChangeListener(textTrack);
                
                this.showSubtitleConfirmation();
              } else {
                console.log('⚠️ Aucune cue WebVTT chargée');
                console.log('📝 Aperçu du contenu WebVTT:', vttContent.substring(0, 300));
                console.log('📝 Statut du textTrack:', textTrack.readyState);
                
                // Essayer de forcer le chargement
                if (textTrack.readyState === 0) { // NONE
                  console.log('🔄 Tentative de rechargement du track...');
                  textTrack.mode = 'hidden';
                  setTimeout(() => {
                    textTrack.mode = 'showing';
                  }, 100);
                }
              }
            }, 2000);
          }
        }, 1000);
        
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
    this.elements.fullscreenIcon.className = 'fas fa-compress';
    this.elements.fullscreenBtn.title = 'Sortir du plein écran (F)';
    
    // Demander le plein écran du navigateur
    if (this.modal.requestFullscreen) {
      this.modal.requestFullscreen();
    } else if (this.modal.webkitRequestFullscreen) {
      this.modal.webkitRequestFullscreen();
    } else if (this.modal.msRequestFullscreen) {
      this.modal.msRequestFullscreen();
    }
  }
  
  exitFullscreen() {
    this.container.classList.remove('fullscreen');
    this.isFullscreen = false;
    this.elements.fullscreenIcon.className = 'fas fa-expand';
    this.elements.fullscreenBtn.title = 'Plein écran (F)';
    
    // Sortir du plein écran du navigateur
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
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

    // Démarrer automatiquement la lecture
    this.play();
  }
  
  onVideoEnded() {
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.showControls();
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
    
    let errorMessage = 'Erreur lors de la lecture de la vidéo';
    if (this.video.error) {
      switch(this.video.error.code) {
        case 1:
          errorMessage = 'Lecture interrompue par l\'utilisateur';
          break;
        case 2:
          errorMessage = 'Erreur réseau lors du chargement';
          break;
        case 3:
          errorMessage = 'Erreur de décodage de la vidéo';
          break;
        case 4:
          errorMessage = 'Format vidéo non supporté';
          break;
      }
    }
    
    alert(errorMessage);
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
          const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n');
          
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
            .replace(/<i>/g, '<i>')
            .replace(/<\/i>/g, '</i>')
            .replace(/<b>/g, '<b>')
            .replace(/<\/b>/g, '</b>')
            .replace(/<u>/g, '<u>')
            .replace(/<\/u>/g, '</u>');
          
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
      console.log('📝 Première cue commence à:', textTrack.cues[0]?.startTime || 'N/A');
      
      // Aller au début de la première cue pour tester (que ce soit avant ou après)
      if (textTrack.cues && textTrack.cues.length > 0) {
        const firstCueTime = textTrack.cues[0].startTime;
        if (Math.abs(currentTime - firstCueTime) > 2) { // Si on est loin du premier sous-titre
          console.log('🔄 Navigation vers le premier sous-titre pour test...');
          console.log(`📝 Passage de ${currentTime.toFixed(1)}s à ${firstCueTime.toFixed(1)}s`);
          this.video.currentTime = firstCueTime + 0.1;
          
          // Attendre un peu puis vérifier si les sous-titres s'affichent
          setTimeout(() => {
            const newActiveCues = textTrack.activeCues;
            console.log('📝 Après navigation - Cues actives:', newActiveCues ? newActiveCues.length : 0);
            if (newActiveCues && newActiveCues.length > 0) {
              console.log('✅ Sous-titre maintenant visible:', newActiveCues[0].text);
            }
          }, 500);
        }
      }
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
window.openVideoPlayer = async function(movieId, title, path) {
  try {
    await window.videoPlayer.open(movieId, title, path);
  } catch (error) {
    console.error('Erreur lors de l\'ouverture du lecteur vidéo:', error);
    alert('Erreur lors du chargement de la vidéo');
  }
};

console.log('🎬 Lecteur vidéo moderne initialisé');