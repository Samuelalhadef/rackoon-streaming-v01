/**
 * Watch Party UI - Gestion de l'interface utilisateur
 * Modales de création/join et interface de chat
 */

class WatchPartyUI {
  constructor() {
    this.currentSession = null;
    this.chatHTML = '';
    this.init();
  }

  init() {
    this.createModals();
    this.prepareChatInterface();
    this.setupEventListeners();
  }

  createModals() {
    // Créer le conteneur des modales Watch Party
    const modalHTML = `
      <!-- Modal Créer Watch Party -->
      <div id="watchparty-create-modal" class="modal-overlay">
        <div class="modal-content watchparty-modal">
          <div class="modal-header">
            <h2>Créer une Watch Party</h2>
            <button class="close-modal-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p>Partagez ce code avec votre ami pour regarder ensemble :</p>
            <div class="watchparty-code-display">
              <span id="watchparty-code-text">------</span>
              <button class="copy-code-btn" title="Copier le code">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="watchparty-status">
              <i class="fas fa-spinner fa-spin"></i>
              <span>En attente de l'invité...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Rejoindre Watch Party -->
      <div id="watchparty-join-modal" class="modal-overlay">
        <div class="modal-content watchparty-modal">
          <div class="modal-header">
            <h2>Rejoindre une Watch Party</h2>
            <button class="close-modal-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p>Entrez le code à 6 chiffres de votre ami :</p>
            <input type="text"
                   id="watchparty-code-input"
                   class="watchparty-code-input"
                   placeholder="XXXXXX"
                   maxlength="6">
            <div class="watchparty-error" id="watchparty-join-error"></div>
            <button class="watchparty-join-btn" id="watchparty-join-btn">
              Rejoindre la Watch Party
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  prepareChatInterface() {
    // Préparer le HTML du chat (sera injecté dans le lecteur vidéo)
    this.chatHTML = `
      <div id="watchparty-chat" class="watchparty-chat hidden">
        <div class="chat-header">
          <span>Chat Watch Party</span>
          <button class="chat-toggle-btn" id="chat-toggle-btn">
            <i class="fas fa-comment"></i>
          </button>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-container">
          <input type="text"
                 id="chat-input"
                 class="chat-input"
                 placeholder="Écrivez un message...">
          <button class="chat-send-btn" id="chat-send-btn">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Modal Créer
    document.getElementById('watchparty-create-modal')
      .querySelector('.close-modal-btn')
      .addEventListener('click', () => this.closeCreateModal());

    // Modal Rejoindre
    document.getElementById('watchparty-join-modal')
      .querySelector('.close-modal-btn')
      .addEventListener('click', () => this.closeJoinModal());

    document.getElementById('watchparty-join-btn')
      .addEventListener('click', () => this.handleJoinParty());

    document.getElementById('watchparty-code-input')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleJoinParty();
      });

    // Bouton copier le code
    document.querySelector('.copy-code-btn')
      .addEventListener('click', () => this.copyCode());
  }

  async showCreateModal(videoInfo) {
    const modal = document.getElementById('watchparty-create-modal');
    const statusDiv = modal.querySelector('.watchparty-status');
    modal.classList.add('active');

    statusDiv.innerHTML = `
      <i class="fas fa-spinner fa-spin"></i>
      <span>Création de la session en cours...</span>
    `;

    try {
      // Créer la session via IPC
      const result = await window.electronAPI.createWatchParty(videoInfo);

      if (result.success) {
        document.getElementById('watchparty-code-text').textContent = result.code;
        this.currentSession = {
          code: result.code,
          sessionId: result.sessionId,
          role: 'host',
          videoInfo
        };

        statusDiv.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>Connexion au serveur...</span>
        `;

        // Connecter au serveur Socket.io
        await watchPartyClient.connect(result.code, 'host');

        // Configurer les callbacks
        watchPartyClient.onGuestJoined = () => {
          this.onGuestJoined();
        };

        statusDiv.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>En attente de l'invité...</span>
        `;

        console.log('✅ Watch Party créée:', result.code);
      } else {
        statusDiv.innerHTML = `
          <i class="fas fa-exclamation-circle" style="color: #f44336;"></i>
          <span style="color: #f44336;">Échec de la création de la Watch Party</span>
        `;
        setTimeout(() => this.closeCreateModal(), 3000);
      }
    } catch (error) {
      console.error('Erreur création Watch Party:', error);
      statusDiv.innerHTML = `
        <i class="fas fa-exclamation-circle" style="color: #f44336;"></i>
        <span style="color: #f44336;">${error.message || 'Erreur de connexion au serveur'}</span>
      `;
      setTimeout(() => this.closeCreateModal(), 3000);
    }
  }

  showJoinModal() {
    const modal = document.getElementById('watchparty-join-modal');
    modal.classList.add('active');
    document.getElementById('watchparty-code-input').value = '';
    document.getElementById('watchparty-join-error').textContent = '';
  }

  async handleJoinParty() {
    const code = document.getElementById('watchparty-code-input').value.toUpperCase();
    const errorDiv = document.getElementById('watchparty-join-error');
    const joinBtn = document.getElementById('watchparty-join-btn');

    console.log('🔍 Tentative de join avec le code:', code);

    if (code.length !== 6) {
      console.error('❌ Code invalide - longueur:', code.length);
      errorDiv.textContent = 'Le code doit contenir 6 caractères';
      errorDiv.style.color = '#f44336';
      return;
    }

    // Afficher état de chargement
    joinBtn.disabled = true;
    joinBtn.textContent = 'Connexion en cours...';
    errorDiv.textContent = '';

    try {
      console.log('📞 Appel IPC joinWatchParty...');
      // Valider la session via IPC
      const result = await window.electronAPI.joinWatchParty(code);

      console.log('📥 Résultat IPC:', result);

      if (result.success) {
        console.log('✅ Session trouvée:', result.session);

        this.currentSession = {
          code,
          sessionId: result.session.sessionId,
          role: 'guest',
          videoInfo: result.session.video
        };

        errorDiv.textContent = 'Connexion au serveur...';
        errorDiv.style.color = '#4CAF50';

        console.log('🔌 Connexion Socket.io en tant que guest...');
        // Connecter au serveur Socket.io
        await watchPartyClient.connect(code, 'guest');

        console.log('✅ Connecté ! Fermeture modale et ouverture vidéo...');
        errorDiv.textContent = 'Connecté ! Ouverture de la vidéo...';

        // Fermer la modale et ouvrir le lecteur vidéo
        this.closeJoinModal();

        // Ouvrir la vidéo avec les infos de la session
        const video = result.session.video;
        console.log('📹 Ouverture vidéo:', video);
        await window.videoPlayer.open(video.id, video.title, video.path);
        window.videoPlayer.enableWatchParty();

        this.showChatInterface();

        console.log('✅ Watch Party rejointe:', code);
      } else {
        console.error('❌ Échec join:', result.message);
        errorDiv.textContent = result.message || 'Code invalide';
        errorDiv.style.color = '#f44336';
      }
    } catch (error) {
      console.error('❌ Erreur pour rejoindre Watch Party:', error);
      errorDiv.textContent = error.message || 'Erreur de connexion au serveur';
      errorDiv.style.color = '#f44336';
    } finally {
      // Réactiver le bouton
      joinBtn.disabled = false;
      joinBtn.textContent = 'Rejoindre la Watch Party';
    }
  }

  closeCreateModal() {
    document.getElementById('watchparty-create-modal').classList.remove('active');
  }

  closeJoinModal() {
    document.getElementById('watchparty-join-modal').classList.remove('active');
  }

  onGuestJoined() {
    const statusDiv = document.querySelector('.watchparty-status');
    statusDiv.innerHTML = `
      <i class="fas fa-check-circle" style="color: #4CAF50;"></i>
      <span>Invité connecté ! Démarrage de la Watch Party...</span>
    `;

    setTimeout(() => {
      this.closeCreateModal();
      this.showChatInterface();
    }, 1500);
  }

  showChatInterface() {
    // Injecter le chat dans le lecteur vidéo
    const playerContainer = document.querySelector('.video-player-container');
    if (playerContainer && !document.getElementById('watchparty-chat')) {
      playerContainer.insertAdjacentHTML('beforeend', this.chatHTML);

      // Configurer les événements du chat
      this.setupChatEvents();

      // Afficher le chat
      document.getElementById('watchparty-chat').classList.remove('hidden');

      console.log('💬 Interface de chat activée');
    }
  }

  setupChatEvents() {
    // Configurer les callbacks Socket.io pour le chat
    watchPartyClient.onChatMessage = (data) => {
      this.displayChatMessage(data);
    };

    // Bouton envoyer
    document.getElementById('chat-send-btn')
      .addEventListener('click', () => this.sendChatMessage());

    // Touche Entrée pour envoyer
    document.getElementById('chat-input')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });

    // Bouton toggle chat
    document.getElementById('chat-toggle-btn')
      .addEventListener('click', () => this.toggleChat());
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Envoyer via Socket.io
    const messageData = watchPartyClient.emitChatMessage(message);

    // Afficher localement (sender)
    this.displayChatMessage({ ...messageData, sender: 'Vous' });

    input.value = '';
  }

  displayChatMessage(data) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${data.sender === 'Vous' ? 'own-message' : ''}`;

    const time = new Date(data.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageElement.innerHTML = `
      <span class="message-sender">${this.escapeHTML(data.sender)}</span>
      <span class="message-text">${this.escapeHTML(data.message)}</span>
      <span class="message-time">${time}</span>
    `;

    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  toggleChat() {
    const chat = document.getElementById('watchparty-chat');
    chat.classList.toggle('hidden');
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  copyCode() {
    const code = document.getElementById('watchparty-code-text').textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector('.copy-code-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2000);
    });
  }

  cleanup() {
    if (this.currentSession) {
      window.electronAPI.leaveWatchParty(this.currentSession.sessionId);
      watchPartyClient.disconnect();
      this.currentSession = null;
    }

    // Retirer l'interface de chat
    const chatDiv = document.getElementById('watchparty-chat');
    if (chatDiv) chatDiv.remove();
  }
}

// Instance globale
window.watchPartyUI = new WatchPartyUI();
