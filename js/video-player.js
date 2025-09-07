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
        <video class="video-player-element" controls="false"></video>
        
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
            <div class="time-display">00:00</div>
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
      this.currentMovie = { id: movieId, title: movieTitle, path: moviePath };
      
      // Afficher la modal
      this.modal.classList.add('active');
      
      // Mettre à jour les informations
      const truncatedTitle = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
      this.elements.title.textContent = truncatedTitle;
      this.elements.details.textContent = 'Chargement...';
      
      // Charger la vidéo
      this.showLoading();
      
      // Utiliser directement le path fourni avec le protocol file:// pour Electron
      if (!moviePath) {
        throw new Error('Chemin de la vidéo non fourni');
      }
      const videoUrl = `file:///${moviePath.replace(/\\\\/g, '/')}`;
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
      const movieDetails = await window.electronAPI.getMovieDetails(movieId);
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
    this.pause();
    this.modal.classList.remove('active');
    this.video.src = '';
    this.currentMovie = null;
    this.resetPlayer();
    
    // Sortir du mode plein écran
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
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
  }
  
  pause() {
    this.video.pause();
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.showControls();
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
  }
  
  seek(seconds) {
    this.video.currentTime = Math.max(0, Math.min(this.duration, this.video.currentTime + seconds));
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
      // Tentative 1: API audioTracks native (si supportée)
      if (this.video.audioTracks && this.video.audioTracks.length > 0) {
        console.log('🎵 Pistes audio détectées via audioTracks API:', this.video.audioTracks.length);
        for (let i = 0; i < this.video.audioTracks.length; i++) {
          const track = this.video.audioTracks[i];
          this.createAudioTrackButton(i, track.label || track.language || `Piste ${i + 1}`, track.enabled);
        }
        return;
      }
      
      // Tentative 2: Demander les informations via FFmpeg (Electron)
      if (window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
        console.log('🎵 Tentative de détection via FFmpeg...');
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.path);
        if (videoInfo.success && videoInfo.audioTracks && videoInfo.audioTracks.length > 1) {
          console.log('🎵 Pistes audio détectées via FFmpeg:', videoInfo.audioTracks.length);
          videoInfo.audioTracks.forEach((track, index) => {
            const label = track.title || track.language || `${track.codec_name || 'Audio'} ${index + 1}`;
            this.createAudioTrackButton(index, label, index === 0);
          });
          return;
        }
      }
      
      // Tentative 3: Vérifier via les propriétés de base de HTMLMediaElement
      if (this.hasAudioTrack()) {
        console.log('🎵 Audio détecté via HTMLMediaElement');
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
  
  setAudioTrack(trackIndex) {
    if (this.video.audioTracks) {
      for (let i = 0; i < this.video.audioTracks.length; i++) {
        this.video.audioTracks[i].enabled = (i === trackIndex);
      }
      
      // Mettre à jour l'interface
      this.elements.audioTracks.querySelectorAll('.audio-option').forEach((btn, index) => {
        btn.classList.toggle('active', index === trackIndex);
      });
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
      // Tentative 1: TextTracks API native
      if (this.video.textTracks && this.video.textTracks.length > 0) {
        console.log('📝 Sous-titres détectés via textTracks API:', this.video.textTracks.length);
        for (let i = 0; i < this.video.textTracks.length; i++) {
          const track = this.video.textTracks[i];
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            this.createSubtitleTrackButton(i, track.label || track.language || `Sous-titre ${i + 1}`, track.mode === 'showing');
            tracksFound = true;
          }
        }
      }
      
      // Tentative 2: Utiliser les sous-titres détectés précédemment via FFmpeg
      if (!tracksFound && this.detectedSubtitles && this.detectedSubtitles.length > 0) {
        console.log('📝 Utilisation des sous-titres détectés via FFmpeg:', this.detectedSubtitles.length);
        this.detectedSubtitles.forEach((track, index) => {
          const label = track.title || track.language || `Sous-titre ${index + 1}`;
          this.createSubtitleTrackButton(index, label, false);
          tracksFound = true;
        });
      }
      
      // Tentative 3: Demander les informations via FFmpeg si pas encore fait
      if (!tracksFound && window.electronAPI && window.electronAPI.getVideoInfo && this.currentMovie) {
        console.log('📝 Tentative de détection des sous-titres via FFmpeg...');
        const videoInfo = await window.electronAPI.getVideoInfo(this.currentMovie.path);
        if (videoInfo.success && videoInfo.subtitleTracks && videoInfo.subtitleTracks.length > 0) {
          console.log('📝 Sous-titres détectés via FFmpeg:', videoInfo.subtitleTracks.length);
          this.detectedSubtitles = videoInfo.subtitleTracks; // Stocker pour réutilisation
          videoInfo.subtitleTracks.forEach((track, index) => {
            const label = track.title || track.language || `Sous-titre ${index + 1}`;
            this.createSubtitleTrackButton(index, label, false);
            tracksFound = true;
          });
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
  
  createSubtitleTrackButton(index, label, isActive) {
    const button = document.createElement('button');
    button.className = 'subtitle-option';
    button.textContent = label;
    button.dataset.track = index;
    
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
      const result = await window.electronAPI.extractSubtitle(this.currentMovie.path, trackIndex);
      
      if (result.success && result.subtitlePath) {
        console.log('📝 Sous-titre extrait vers:', result.subtitlePath);
        
        // Créer un élément track et l'ajouter à la vidéo
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = `file:///${result.subtitlePath.replace(/\\\\/g, '/')}`;
        track.label = this.detectedSubtitles[trackIndex].title || this.detectedSubtitles[trackIndex].language || `Sous-titre ${trackIndex + 1}`;
        track.srclang = this.detectedSubtitles[trackIndex].language || 'fr';
        
        this.video.appendChild(track);
        
        // Activer le nouveau track
        const newTrackIndex = this.video.textTracks.length - 1;
        this.video.textTracks[newTrackIndex].mode = 'showing';
        
        console.log('📝 Sous-titre externe chargé et activé');
      } else {
        console.error('📝 Échec de l\'extraction:', result.message);
      }
    } catch (error) {
      console.error('📝 Erreur lors de l\'extraction des sous-titres:', error);
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