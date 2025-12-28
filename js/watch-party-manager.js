const { customAlphabet } = require('nanoid');
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

class WatchPartyManager {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.activeSessions = new Map(); // sessionCode -> { host, guest, video, state }
  }

  initialize() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Socket connected:', socket.id);

      socket.on('join-room', ({ code, role }) => {
        this.handleJoinRoom(socket, code, role);
      });

      socket.on('playback:play', (data) => this.broadcastToRoom(socket, 'playback:play', data));
      socket.on('playback:pause', (data) => this.broadcastToRoom(socket, 'playback:pause', data));
      socket.on('playback:seek', (data) => this.broadcastToRoom(socket, 'playback:seek', data));
      socket.on('playback:ratechange', (data) => this.broadcastToRoom(socket, 'playback:ratechange', data));
      socket.on('chat:message', (data) => this.broadcastToRoom(socket, 'chat:message', data));

      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  createSession(videoInfo) {
    const code = generateCode();
    const sessionId = `session_${Date.now()}`;

    this.activeSessions.set(code, {
      sessionId,
      code,
      host: null,
      guest: null,
      video: videoInfo,
      state: {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1
      },
      chatHistory: [],
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Session créée: ${code}`);
    return { success: true, code, sessionId };
  }

  joinSession(code) {
    const session = this.activeSessions.get(code);
    if (!session) {
      return { success: false, message: 'Code invalide' };
    }

    return { success: true, session };
  }

  handleJoinRoom(socket, code, role) {
    const session = this.activeSessions.get(code);
    if (!session) {
      socket.emit('error', { message: 'Code de session invalide' });
      return;
    }

    socket.join(code);

    if (role === 'host') {
      session.host = socket.id;
      socket.emit('joined-as-host', { session });
      console.log(`👤 Host rejoint la room: ${code}`);
    } else {
      session.guest = socket.id;
      socket.to(code).emit('guest-joined', { guestId: socket.id });
      socket.emit('joined-as-guest', { session });
      console.log(`👥 Guest rejoint la room: ${code}`);
    }
  }

  broadcastToRoom(socket, event, data) {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length > 0) {
      socket.to(rooms[0]).emit(event, data);
      console.log(`📡 Broadcast ${event} dans room ${rooms[0]}`);
    }
  }

  handleDisconnect(socket) {
    // Trouver et nettoyer la session
    for (const [code, session] of this.activeSessions.entries()) {
      if (session.host === socket.id || session.guest === socket.id) {
        this.io.to(code).emit('peer-disconnected');
        this.activeSessions.delete(code);
        console.log(`❌ Session ${code} fermée suite à une déconnexion`);
      }
    }
  }

  leaveSession(sessionId) {
    for (const [code, session] of this.activeSessions.entries()) {
      if (session.sessionId === sessionId) {
        this.activeSessions.delete(code);
        console.log(`👋 Session ${code} quittée manuellement`);
        return { success: true };
      }
    }
    return { success: false };
  }

  getSessionInfo(sessionId) {
    for (const session of this.activeSessions.values()) {
      if (session.sessionId === sessionId) {
        return { success: true, session };
      }
    }
    return { success: false };
  }
}

module.exports = WatchPartyManager;
