/**
 * Watch Party Client - Socket.io client pour le renderer process
 * Gère la connexion au serveur Socket.io et la communication en temps réel
 */

class WatchPartyClient {
  constructor() {
    this.socket = null;
    this.sessionCode = null;
    this.role = null; // 'host' or 'guest'
    this.isActive = false;
    this.messageCallbacks = [];
  }

  async connect(code, role) {
    this.socket = io('http://localhost:3001');
    this.sessionCode = code;
    this.role = role;

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log('🔌 Connecté au serveur Watch Party');
        this.socket.emit('join-room', { code, role });
      });

      this.socket.on(`joined-as-${role}`, (data) => {
        console.log(`✅ Rejoint en tant que ${role}:`, data);
        this.isActive = true;
        this.setupEventListeners();
        resolve(data.session);
      });

      this.socket.on('error', (err) => {
        console.error('❌ Erreur Watch Party:', err);
        reject(err);
      });
    });
  }

  setupEventListeners() {
    // Synchronisation de lecture
    this.socket.on('playback:play', (data) => {
      console.log('▶️ Événement play reçu:', data);
      this.onPlaybackEvent('play', data);
    });

    this.socket.on('playback:pause', (data) => {
      console.log('⏸️ Événement pause reçu:', data);
      this.onPlaybackEvent('pause', data);
    });

    this.socket.on('playback:seek', (data) => {
      console.log('⏩ Événement seek reçu:', data);
      this.onPlaybackEvent('seek', data);
    });

    this.socket.on('playback:ratechange', (data) => {
      console.log('⚡ Événement vitesse reçu:', data);
      this.onPlaybackEvent('ratechange', data);
    });

    // Chat
    this.socket.on('chat:message', (data) => {
      console.log('💬 Message chat reçu:', data);
      this.onChatMessage(data);
    });

    // Gestion de connexion
    this.socket.on('guest-joined', (data) => {
      console.log('👥 Guest a rejoint:', data);
      this.onGuestJoined(data);
    });

    this.socket.on('peer-disconnected', () => {
      console.log('🔌 Peer déconnecté');
      this.onPeerDisconnected();
    });
  }

  // Émettre des événements de lecture
  emitPlay(currentTime) {
    if (!this.isActive) return;
    this.socket.emit('playback:play', { currentTime, timestamp: Date.now() });
  }

  emitPause(currentTime) {
    if (!this.isActive) return;
    this.socket.emit('playback:pause', { currentTime, timestamp: Date.now() });
  }

  emitSeek(currentTime) {
    if (!this.isActive) return;
    this.socket.emit('playback:seek', { currentTime, timestamp: Date.now() });
  }

  emitRateChange(playbackRate) {
    if (!this.isActive) return;
    this.socket.emit('playback:ratechange', { playbackRate, timestamp: Date.now() });
  }

  emitChatMessage(message) {
    if (!this.isActive) return;
    const messageData = {
      sender: this.role,
      message,
      timestamp: Date.now()
    };
    this.socket.emit('chat:message', messageData);
    return messageData;
  }

  // Callbacks (seront définis par video-player.js et watch-party-ui.js)
  onPlaybackEvent(type, data) {
    // Sera implémenté par video-player.js
  }

  onChatMessage(data) {
    // Sera implémenté par watch-party-ui.js
  }

  onGuestJoined(data) {
    // Afficher notification
  }

  onPeerDisconnected() {
    // Afficher notification et nettoyer
    this.disconnect();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isActive = false;
    this.sessionCode = null;
    this.role = null;
  }
}

// Instance globale
const watchPartyClient = new WatchPartyClient();
