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
            <p style="margin-bottom: 15px;">Partagez ces informations avec votre ami :</p>

            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">Code de session :</label>
                <div class="watchparty-code-display">
                  <span id="watchparty-code-text">------</span>
                  <button class="copy-code-btn" id="copy-code-btn" title="Copier le code">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">IP Réseau Local (LAN) :</label>
                <div class="watchparty-code-display">
                  <span id="watchparty-ip-local" style="font-size: 14px;">---</span>
                  <button class="copy-code-btn" id="copy-ip-local-btn" title="Copier l'IP locale">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <div style="font-size: 11px; color: #666; margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">
                <strong>Pour connexion Internet :</strong><br>
                Configurez le port forwarding (port 3001) sur votre routeur puis partagez votre IP publique.
                <a href="#" id="show-port-forwarding-help" style="color: #4CAF50; text-decoration: none;"> Aide →</a>
              </div>
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
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px;">Mode de connexion :</label>
              <select id="watchparty-connection-mode" class="watchparty-code-input" style="width: 100%; margin-bottom: 15px;">
                <option value="localhost">Même ordinateur (localhost)</option>
                <option value="lan" selected>Réseau local (LAN)</option>
                <option value="internet">Internet (IP publique)</option>
              </select>
            </div>

            <div id="ip-input-container" style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px;">IP du Host :</label>
              <input type="text"
                     id="watchparty-host-ip"
                     class="watchparty-code-input"
                     placeholder="192.168.1.10"
                     style="width: 100%;">
              <div style="font-size: 11px; color: #666; margin-top: 5px;">
                Exemple: 192.168.1.10 (LAN) ou 82.123.45.67 (Internet)
              </div>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px;">Code de session :</label>
              <input type="text"
                     id="watchparty-code-input"
                     class="watchparty-code-input"
                     placeholder="XXXXXX"
                     maxlength="6"
                     style="width: 100%;">
            </div>

            <div class="watchparty-error" id="watchparty-join-error"></div>
            <button class="watchparty-join-btn" id="watchparty-join-submit-btn">
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

    document.getElementById('watchparty-join-submit-btn')
      .addEventListener('click', () => this.handleJoinParty());

    document.getElementById('watchparty-code-input')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleJoinParty();
      });

    document.getElementById('watchparty-host-ip')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleJoinParty();
      });

    // Boutons copier
    document.getElementById('copy-code-btn')
      .addEventListener('click', () => this.copyCode());

    document.getElementById('copy-ip-local-btn')
      .addEventListener('click', () => this.copyIPLocal());

    // Mode de connexion
    document.getElementById('watchparty-connection-mode')
      .addEventListener('change', (e) => this.handleConnectionModeChange(e.target.value));

    // Lien aide port forwarding
    document.getElementById('show-port-forwarding-help')
      .addEventListener('click', (e) => {
        e.preventDefault();
        this.showPortForwardingHelp();
      });
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
        // Afficher le code et l'IP locale
        document.getElementById('watchparty-code-text').textContent = result.code;
        document.getElementById('watchparty-ip-local').textContent = result.localIP || 'localhost';

        this.currentSession = {
          code: result.code,
          sessionId: result.sessionId,
          role: 'host',
          videoInfo,
          localIP: result.localIP,
          port: result.port
        };

        statusDiv.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>Connexion au serveur...</span>
        `;

        // Connecter au serveur Socket.io (localhost pour le host)
        const sessionData = await watchPartyClient.connect(result.code, 'host', 'localhost');

        // Configurer les callbacks
        watchPartyClient.onGuestJoined = () => {
          this.onGuestJoined();
        };

        statusDiv.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>En attente de l'invité...</span>
        `;

        console.log('✅ Watch Party créée:', result.code, 'IP:', result.localIP);
        console.log('   Session data:', sessionData);
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
    console.log('📖 Ouverture de la modale Join');
    const modal = document.getElementById('watchparty-join-modal');
    modal.classList.add('active');
    document.getElementById('watchparty-code-input').value = '';
    document.getElementById('watchparty-join-error').textContent = '';

    // Initialiser le mode de connexion
    const connectionMode = document.getElementById('watchparty-connection-mode').value;
    this.handleConnectionModeChange(connectionMode);
  }

  async handleJoinParty() {
    const code = document.getElementById('watchparty-code-input').value.toUpperCase();
    const connectionMode = document.getElementById('watchparty-connection-mode').value;
    const hostIP = document.getElementById('watchparty-host-ip').value.trim();
    const errorDiv = document.getElementById('watchparty-join-error');
    const joinBtn = document.getElementById('watchparty-join-submit-btn');

    console.log('🔍 Tentative de join avec le code:', code);

    if (code.length !== 6) {
      console.error('❌ Code invalide - longueur:', code.length);
      errorDiv.textContent = 'Le code doit contenir 6 caractères';
      errorDiv.style.color = '#f44336';
      return;
    }

    // Déterminer l'IP à utiliser selon le mode
    let serverHost;
    if (connectionMode === 'localhost') {
      serverHost = 'localhost';
    } else {
      if (!hostIP) {
        errorDiv.textContent = 'Veuillez entrer l\'IP du Host';
        errorDiv.style.color = '#f44336';
        return;
      }
      serverHost = hostIP;
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

        errorDiv.textContent = `Connexion au serveur ${serverHost}...`;
        errorDiv.style.color = '#4CAF50';

        console.log(`🔌 Connexion Socket.io en tant que guest sur ${serverHost}...`);

        // Connecter au serveur Socket.io avec l'IP spécifiée
        const sessionData = await watchPartyClient.connect(code, 'guest', serverHost);

        console.log('✅ Connecté ! Données reçues:', sessionData);

        // Récupérer les infos vidéo depuis le serveur Socket.io
        const video = sessionData.session.video;

        // Construire l'URL de streaming depuis le serveur HOST
        const streamUrl = `http://${serverHost}:3001/video/${code}`;
        console.log('📺 URL de streaming:', streamUrl);

        this.currentSession = {
          code,
          sessionId: sessionData.session.sessionId,
          role: 'guest',
          videoInfo: video,
          serverHost,
          streamUrl
        };

        errorDiv.textContent = 'Connecté ! Ouverture de la vidéo...';

        // Fermer la modale
        this.closeJoinModal();

        // Ouvrir la vidéo avec l'URL de streaming au lieu du chemin local
        console.log('📹 Ouverture vidéo en streaming:', video.title);
        await window.videoPlayer.open(video.id, video.title, streamUrl);
        window.videoPlayer.enableWatchParty();

        this.showChatInterface();

        console.log('✅ Watch Party rejointe:', code, 'via', serverHost);
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
      const btn = document.getElementById('copy-code-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2000);
    });
  }

  copyIPLocal() {
    const ip = document.getElementById('watchparty-ip-local').textContent;
    navigator.clipboard.writeText(ip).then(() => {
      const btn = document.getElementById('copy-ip-local-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2000);
    });
  }

  handleConnectionModeChange(mode) {
    console.log('🔄 Mode de connexion changé:', mode);
    const ipContainer = document.getElementById('ip-input-container');
    if (mode === 'localhost') {
      ipContainer.style.display = 'none';
    } else {
      ipContainer.style.display = 'block';
      // Placeholder selon le mode
      const ipInput = document.getElementById('watchparty-host-ip');
      if (mode === 'lan') {
        ipInput.placeholder = '192.168.1.10';
      } else if (mode === 'internet') {
        ipInput.placeholder = '82.123.45.67';
      }
    }
  }

  showPortForwardingHelp() {
    const helpText = `
═══════════════════════════════════════════════════════
   CONFIGURATION PORT FORWARDING (Connexion Internet)
═══════════════════════════════════════════════════════

Pour permettre à votre ami de se connecter via Internet :

1️⃣  PARE-FEU WINDOWS (Ordinateur Host)
   • Ouvrez le Panneau de configuration
   • Recherchez "Pare-feu Windows"
   • Cliquez sur "Paramètres avancés"
   • Règles de trafic entrant → Nouvelle règle
   • Type : Port → TCP → Port 3001
   • Action : Autoriser la connexion
   • Nom : "Rackoon Watch Party"

2️⃣  PORT FORWARDING (Routeur/Box)
   • Connectez-vous à votre routeur (souvent 192.168.1.1)
   • Trouvez la section "Port Forwarding" ou "NAT"
   • Créez une nouvelle règle :
     - Port externe : 3001
     - Port interne : 3001
     - IP locale : ${this.currentSession?.localIP || 'Votre IP locale'}
     - Protocole : TCP

3️⃣  TROUVER VOTRE IP PUBLIQUE
   • Visitez : https://www.monip.org
   • Ou tapez "quelle est mon ip" sur Google
   • Partagez cette IP avec votre ami

4️⃣  VOTRE AMI DOIT ENTRER
   • Mode : Internet (IP publique)
   • IP Host : Votre IP publique
   • Code : ${this.currentSession?.code || 'Code de session'}

⚠️  SÉCURITÉ
   • N'oubliez pas de désactiver le port forwarding après usage
   • Ne partagez votre IP qu'avec des personnes de confiance

═══════════════════════════════════════════════════════
    `;

    alert(helpText);
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
