/**
 * Gestionnaire de saisons pour les séries
 * Permet de créer, modifier, supprimer et gérer les saisons d'une série
 */

class SeasonsManager {
  constructor() {
    this.currentSeriesId = null;
    this.currentSeriesName = null;
    this.seriesEpisodes = []; // Tous les épisodes de la série
    this.seasons = []; // Saisons de la série actuelle
    this.currentSeasonIndex = null; // Index de la saison en cours d'édition

    this.modal = null;
    this._onFinishCallback = null;
    this.init();
  }

  init() {
    console.log('🎬 Initialisation du gestionnaire de saisons');
    this.modal = document.getElementById('seasons-manager-modal');
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Bouton pour ouvrir le modal (délégation d'événements)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-manage-seasons')) {
        const btn = e.target.closest('.btn-manage-seasons');
        const seriesId = btn.dataset.seriesId;
        const seriesName = btn.dataset.seriesName;
        this.openModal(seriesId, seriesName);
      }
    });

    // Fermer le modal
    const closeBtn = document.getElementById('close-seasons-manager');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // Toggle entre type standard et custom
    document.querySelectorAll('input[name="season-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => this.toggleSeasonType(e.target.value));
    });

    // Ajouter une saison
    const addSeasonBtn = document.getElementById('add-season-btn');
    if (addSeasonBtn) {
      addSeasonBtn.addEventListener('click', () => this.createNewSeason());
    }

    // Sauvegarder une saison
    const saveSeasonBtn = document.getElementById('save-season-btn');
    if (saveSeasonBtn) {
      saveSeasonBtn.addEventListener('click', () => this.saveSeason());
    }

    // Annuler l'édition
    const cancelSeasonBtn = document.getElementById('cancel-season-btn');
    if (cancelSeasonBtn) {
      cancelSeasonBtn.addEventListener('click', () => this.closeEditor());
    }

    // Supprimer une saison
    const deleteSeasonBtn = document.getElementById('delete-season-btn');
    if (deleteSeasonBtn) {
      deleteSeasonBtn.addEventListener('click', () => this.deleteSeason());
    }

    // Fermer l'éditeur
    const closeEditorBtn = document.getElementById('close-editor');
    if (closeEditorBtn) {
      closeEditorBtn.addEventListener('click', () => this.closeEditor());
    }

    // Terminer la gestion
    const finishBtn = document.getElementById('finish-seasons-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => this.finishManagement());
    }
  }

  /**
   * Ouvre le modal de gestion des saisons pour une série
   */
  async openModal(seriesId, seriesName) {
    console.log(`🎬 Ouverture du gestionnaire de saisons pour: ${seriesName} (ID: ${seriesId})`);

    this.currentSeriesId = seriesId;
    this.currentSeriesName = seriesName;

    // Mettre à jour le titre
    document.getElementById('seasons-series-name').textContent = seriesName;

    // Charger les épisodes de la série
    await this.loadSeriesEpisodes();

    // Charger les saisons existantes
    await this.loadSeasons();

    // Afficher le modal
    this.modal.style.display = 'flex';

    // Masquer l'éditeur par défaut
    this.closeEditor();
  }

  /**
   * Ferme le modal
   */
  closeModal() {
    this.modal.style.display = 'none';
    this.currentSeriesId = null;
    this.currentSeriesName = null;
    this.seriesEpisodes = [];
    this.seasons = [];
    this.currentSeasonIndex = null;
  }

  /**
   * Charge tous les épisodes de la série actuelle.
   * En contexte import : utilise importClassificationSystem.currentFiles.
   * En contexte bibliothèque : charge depuis la DB via getSeriesById.
   */
  async loadSeriesEpisodes() {
    const classificationManager = window.importClassificationSystem;
    const importFiles = classificationManager?.currentFiles || [];
    const importEpisodes = importFiles.filter(f =>
      String(f.seriesId) === String(this.currentSeriesId) && f.triageType === 'series'
    );

    if (importEpisodes.length > 0) {
      this.seriesEpisodes = importEpisodes;
    } else {
      // Contexte bibliothèque — charger depuis la DB
      try {
        const result = await window.electronAPI.getSeriesById(this.currentSeriesId);
        if (result.success && result.series.seasons) {
          this.seriesEpisodes = result.series.seasons.flatMap(s => s.episodes || []);
        } else {
          this.seriesEpisodes = [];
        }
      } catch (e) {
        console.error('❌ Erreur chargement épisodes bibliothèque:', e);
        this.seriesEpisodes = [];
      }
    }

    console.log(`📺 ${this.seriesEpisodes.length} épisodes chargés pour la série`);
  }

  /**
   * Charge les saisons existantes depuis la base de données
   */
  async loadSeasons() {
    try {
      // Charger les saisons depuis le backend
      const response = await window.electronAPI.getSeriesSeasons(this.currentSeriesId);

      if (response && response.success) {
        this.seasons = response.seasons || [];
      } else {
        this.seasons = [];
      }

      // S'assurer que la saison "Non assignés" existe toujours
      this.ensureDefaultSeason();

      // Trier les saisons par ordre
      this.seasons.sort((a, b) => a.order - b.order);

      this.renderSeasonsList();
      this.updateSeasonsCount();
    } catch (error) {
      console.error('❌ Erreur lors du chargement des saisons:', error);
      this.seasons = [];
      this.ensureDefaultSeason();
      this.renderSeasonsList();
    }
  }

  /**
   * S'assure que la saison "Non assignés" (order = 0) existe toujours
   */
  ensureDefaultSeason() {
    const defaultSeason = this.seasons.find(s => s.order === 0);

    if (!defaultSeason) {
      // Tous les épisodes non assignés vont dans cette saison par défaut
      const assignedEpisodes = new Set();
      this.seasons.forEach(season => {
        if (season.episodes) {
          season.episodes.forEach(ep => assignedEpisodes.add(ep));
        }
      });

      const unassignedEpisodes = this.seriesEpisodes
        .map((_, index) => index)
        .filter(index => !assignedEpisodes.has(index));

      this.seasons.unshift({
        id: 'season-0',
        order: 0,
        type: 'default',
        name: 'Non assignés',
        isEditable: false,
        episodes: unassignedEpisodes
      });

      console.log(`📦 Saison "Non assignés" créée avec ${unassignedEpisodes.length} épisodes`);
    }
  }

  /**
   * Toggle entre les champs de saison standard et personnalisée
   */
  toggleSeasonType(type) {
    const standardGroup = document.getElementById('standard-season-group');
    const customGroup = document.getElementById('custom-season-group');

    if (type === 'standard') {
      standardGroup.style.display = 'block';
      customGroup.style.display = 'none';
    } else {
      standardGroup.style.display = 'none';
      customGroup.style.display = 'block';
    }
  }

  /**
   * Affiche la liste des saisons
   */
  renderSeasonsList() {
    const seasonsList = document.getElementById('seasons-list');

    if (this.seasons.length === 0) {
      seasonsList.innerHTML = `
        <div class="no-seasons-message">
          <i class="fas fa-inbox"></i>
          <p>Aucune saison créée</p>
          <p class="hint">Cliquez sur "Ajouter une saison" pour commencer</p>
        </div>
      `;
      return;
    }

    seasonsList.innerHTML = this.seasons.map((season, index) => {
      const episodesCount = season.episodes ? season.episodes.length : 0;
      const seasonName = season.name;
      const isDefault = season.type === 'default';
      const orderDisplay = season.order === 0 ? '0' : season.order;

      return `
        <div class="season-item ${this.currentSeasonIndex === index ? 'active' : ''} ${isDefault ? 'default-season' : ''}" data-season-index="${index}">
          <div class="season-item-header">
            <span class="season-item-title">${isDefault ? '📦 ' : ''}${seasonName}</span>
            <span class="season-item-number">Ordre: ${orderDisplay}</span>
          </div>
          <div class="season-item-episodes">${episodesCount} épisode(s)</div>
        </div>
      `;
    }).join('');

    // Ajouter les event listeners sur les saisons
    seasonsList.querySelectorAll('.season-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.seasonIndex);
        const season = this.seasons[index];

        // Ne pas permettre l'édition de la saison "Non assignés"
        if (season.type === 'default') {
          return;
        }

        this.editSeason(index);
      });
    });
  }

  /**
   * Met à jour le compteur de saisons
   */
  updateSeasonsCount() {
    document.getElementById('seasons-count').textContent = this.seasons.length;
  }

  /**
   * Crée une nouvelle saison
   */
  createNewSeason() {
    this.currentSeasonIndex = null;

    // Déterminer le prochain numéro d'ordre disponible
    const nextOrder = this.seasons.length > 0
      ? Math.max(...this.seasons.map(s => s.order)) + 1
      : 1;

    // Déterminer le prochain numéro de saison standard
    const standardSeasons = this.seasons.filter(s => s.type === 'standard');
    const nextSeasonNumber = standardSeasons.length > 0
      ? Math.max(...standardSeasons.map(s => s.seasonNumber || 0)) + 1
      : 1;

    // Réinitialiser le formulaire
    document.querySelector('input[name="season-type"][value="standard"]').checked = true;
    this.toggleSeasonType('standard');

    document.getElementById('season-number-standard').value = nextSeasonNumber;
    document.getElementById('season-custom-name').value = '';
    document.getElementById('season-order').value = nextOrder;
    document.getElementById('editor-title').textContent = 'Nouvelle saison';
    document.getElementById('delete-season-btn').style.display = 'none';

    // Réinitialiser les champs de plage d'épisodes
    document.getElementById('episode-from').value = 1;
    document.getElementById('episode-to').value = '';

    // Afficher l'éditeur
    this.showEditor();
  }

  /**
   * Édite une saison existante
   */
  editSeason(index) {
    this.currentSeasonIndex = index;
    const season = this.seasons[index];

    // Définir le type de saison
    const seasonType = season.type === 'standard' ? 'standard' : 'custom';
    document.querySelector(`input[name="season-type"][value="${seasonType}"]`).checked = true;
    this.toggleSeasonType(seasonType);

    // Remplir le formulaire selon le type
    if (season.type === 'standard') {
      document.getElementById('season-number-standard').value = season.seasonNumber || 1;
    } else {
      document.getElementById('season-custom-name').value = season.name || '';
    }

    document.getElementById('season-order').value = season.order;
    document.getElementById('editor-title').textContent = `Édition: ${season.name}`;
    document.getElementById('delete-season-btn').style.display = 'block';

    // Charger la plage d'épisodes
    if (season.episodeRange) {
      document.getElementById('episode-from').value = season.episodeRange.from || 1;
      document.getElementById('episode-to').value = season.episodeRange.to || '';
    } else {
      // Si pas de plage définie, essayer de deviner depuis les épisodes
      const episodesCount = season.episodes ? season.episodes.length : 0;
      document.getElementById('episode-from').value = 1;
      document.getElementById('episode-to').value = episodesCount || '';
    }

    // Mettre à jour la liste pour montrer la saison active
    this.renderSeasonsList();

    // Afficher l'éditeur
    this.showEditor();
  }

  /**
   * Affiche l'éditeur de saison
   */
  showEditor() {
    document.getElementById('season-editor').style.display = 'flex';
  }

  /**
   * Masque l'éditeur de saison
   */
  closeEditor() {
    document.getElementById('season-editor').style.display = 'none';
    this.currentSeasonIndex = null;
    this.renderSeasonsList();
  }

  /**
   * Sauvegarde la saison actuelle
   */
  async saveSeason() {
    // Récupérer le type de saison
    const seasonType = document.querySelector('input[name="season-type"]:checked').value;

    // Récupérer le numéro d'ordre
    const order = parseInt(document.getElementById('season-order').value);

    // Validation du numéro d'ordre
    if (!order || order < 1 || order > 1000) {
      alert('Le numéro d\'ordre doit être entre 1 et 1000');
      return;
    }

    // Vérifier les doublons (sauf si on édite la même saison)
    const existingSeasonWithOrder = this.seasons.find((s, index) =>
      s.order === order && index !== this.currentSeasonIndex
    );
    if (existingSeasonWithOrder) {
      alert(`Le numéro d'ordre ${order} est déjà utilisé par "${existingSeasonWithOrder.name}"`);
      return;
    }

    let seasonData;

    if (seasonType === 'standard') {
      const seasonNumber = parseInt(document.getElementById('season-number-standard').value);

      if (!seasonNumber || seasonNumber < 1) {
        alert('Veuillez entrer un numéro de saison valide');
        return;
      }

      seasonData = {
        id: `season-${order}`,
        order: order,
        type: 'standard',
        name: `Saison ${seasonNumber}`,
        seasonNumber: seasonNumber,
        episodeRange: { from: 1, to: 0 },
        episodes: []
      };
    } else {
      const customName = document.getElementById('season-custom-name').value.trim();

      if (!customName) {
        alert('Veuillez entrer un nom pour la saison personnalisée');
        return;
      }

      seasonData = {
        id: `season-custom-${order}`,
        order: order,
        type: 'custom',
        name: customName,
        customName: customName,
        episodeRange: { from: 1, to: 0 },
        episodes: []
      };
    }

    // Récupérer la plage d'épisodes
    const episodeFrom = parseInt(document.getElementById('episode-from').value) || 1;
    const episodeTo = parseInt(document.getElementById('episode-to').value);

    if (episodeTo && episodeTo < episodeFrom) {
      alert('Le numéro de fin doit être supérieur ou égal au numéro de début');
      return;
    }

    seasonData.episodeRange = {
      from: episodeFrom,
      to: episodeTo || episodeFrom
    };

    // Créer des emplacements vides pour les épisodes
    const episodeCount = episodeTo ? (episodeTo - episodeFrom + 1) : 0;
    seasonData.episodes = Array(episodeCount).fill(null); // Emplacements vides

    if (this.currentSeasonIndex !== null) {
      // Mise à jour d'une saison existante
      this.seasons[this.currentSeasonIndex] = seasonData;
      console.log(`✅ Saison "${seasonData.name}" mise à jour`);
    } else {
      // Nouvelle saison
      this.seasons.push(seasonData);
      console.log(`✅ Nouvelle saison "${seasonData.name}" créée`);
    }

    // Recalculer la saison "Non assignés" avec les épisodes restants
    this.updateUnassignedSeason();

    // Trier les saisons par ordre
    this.seasons.sort((a, b) => a.order - b.order);

    // Sauvegarder dans la base de données
    try {
      const response = await window.electronAPI.saveSeriesSeasons(this.currentSeriesId, this.seasons);
      if (response && response.success) {
        console.log('✅ Saisons sauvegardées dans la base de données');
      } else {
        throw new Error(response?.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des saisons:', error);
      alert('Erreur lors de la sauvegarde des saisons: ' + error.message);
      return;
    }

    // Rafraîchir l'affichage
    this.renderSeasonsList();
    this.updateSeasonsCount();
    this.closeEditor();
  }

  /**
   * Met à jour la saison "Non assignés" avec les épisodes non assignés
   */
  updateUnassignedSeason() {
    const defaultSeason = this.seasons.find(s => s.order === 0);
    if (!defaultSeason) return;

    // Récupérer tous les épisodes assignés
    const assignedEpisodes = new Set();
    this.seasons.forEach(season => {
      if (season.order !== 0 && season.episodes) {
        season.episodes.forEach(ep => assignedEpisodes.add(ep));
      }
    });

    // Mettre à jour les épisodes non assignés
    defaultSeason.episodes = this.seriesEpisodes
      .map((_, index) => index)
      .filter(index => !assignedEpisodes.has(index));

    console.log(`📦 Saison "Non assignés" mise à jour: ${defaultSeason.episodes.length} épisodes`);
  }

  /**
   * Supprime la saison actuelle
   */
  async deleteSeason() {
    if (this.currentSeasonIndex === null) return;

    const season = this.seasons[this.currentSeasonIndex];
    const seasonName = season.name || `Saison ${season.number}`;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${seasonName}" ?`)) {
      return;
    }

    this.seasons.splice(this.currentSeasonIndex, 1);
    console.log(`🗑️ Saison "${seasonName}" supprimée`);

    // Sauvegarder dans la base de données
    try {
      const response = await window.electronAPI.saveSeriesSeasons(this.currentSeriesId, this.seasons);
      if (response && response.success) {
        console.log('✅ Saisons sauvegardées après suppression');
      } else {
        throw new Error(response?.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la suppression de la saison: ' + error.message);
      return;
    }

    // Rafraîchir l'affichage
    this.renderSeasonsList();
    this.updateSeasonsCount();
    this.closeEditor();
  }

  /**
   * Termine la gestion des saisons et retourne à la classification
   */
  finishManagement() {
    console.log('✅ Gestion des saisons terminée');

    // Contexte bibliothèque (modal série)
    if (typeof this._onFinishCallback === 'function') {
      const cb = this._onFinishCallback;
      this._onFinishCallback = null;
      this.closeModal();
      cb();
      return;
    }

    // Contexte import — rafraîchir la galerie de classification
    if (this.currentSeriesId && window.importClassificationSystem) {
      window.importClassificationSystem.refreshSeriesDisplay(this.currentSeriesId)
        .then(() => console.log('✅ Affichage de la série rafraîchi'))
        .catch(err => console.error('❌ Erreur lors du rafraîchissement:', err));
    }

    this.closeModal();
  }
}

// Initialiser le gestionnaire de saisons au chargement
window.addEventListener('DOMContentLoaded', () => {
  window.seasonsManager = new SeasonsManager();
});
