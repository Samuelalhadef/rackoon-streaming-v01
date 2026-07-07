// import-classification.js - Système de classification avancé des médias avec séries

class ImportClassificationSystem {
  constructor() {
    this.importModal = null;
    this.detailsModal = null;
    this.galleryModal = null;
    this.seriesModal = null;
    this.currentFiles = [];
    this.classifiedFiles = [];
    this.categories = [];
    this.series = [];
    this.currentFileIndex = 0;
    this.isProcessing = false;
    this.isImporting = false; // Flag pour éviter les mises à jour pendant l'import
    this.useGalleryMode = true; // Par défaut, utiliser le mode galerie
    this.newlyScannedIds = []; // IDs des fichiers nouvellement scannés (pour nettoyage si annulé)
    this.newlyCreatedSeriesIds = []; // IDs des séries créées durant l'import (pour nettoyage si annulé)

    this.init();
  }

  async init() {
    console.log('🎬 Initialisation du système de classification');
    
    // Références aux modales
    this.importModal = document.getElementById('import-modal');
    this.detailsModal = document.getElementById('details-classification-modal');
    this.galleryModal = document.getElementById('gallery-classification-modal');
    this.seriesModal = document.getElementById('new-series-modal');
    
    // Charger les données
    await this.loadCategories();
    await this.loadSeries();
    
    // Attacher les événements
    this.attachEventListeners();
    this.attachKeyboardListeners();
  }

  async loadCategories() {
    try {
      const result = await window.electronAPI.getAllCategories();
      if (result.success) {
        this.categories = result.categories;
        console.log('📂 Catégories chargées:', this.categories.length);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  }

  async loadSeries() {
    try {
      const result = await window.electronAPI.getAllSeries();
      if (result && result.success && result.series) {
        this.series = result.series;
        console.log('📺 Séries chargées:', this.series.length);
      } else {
        this.series = [];
        console.log('📺 Aucune série trouvée ou erreur lors du chargement');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des séries:', error);
      this.series = [];
    }
  }

  attachEventListeners() {
    // Événements de la modal de classification détaillée
    if (this.detailsModal) {
      const categorySelect = document.getElementById('detail-category');
      const seriesNameInput = document.getElementById('detail-series-name');
      const saveBtn = document.getElementById('save-file-btn');
      const skipBtn = document.getElementById('skip-file-btn');
      const prevBtn = document.getElementById('prev-file-btn');
      const nextBtn = document.getElementById('next-file-btn');

      if (categorySelect) {
        categorySelect.addEventListener('change', (e) => this.onCategoryChange(e.target.value));
      }


      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveCurrentFile());
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', () => this.skipCurrentFile());
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.previousFile());
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.nextFileWithoutSaving());
      }
    }

    // Événements de la modal nouvelle série
    if (this.seriesModal) {
      const createBtn = document.getElementById('create-series-btn');
      const cancelBtn = document.getElementById('cancel-series-btn');

      if (createBtn) {
        createBtn.addEventListener('click', () => this.createNewSeries());
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.hideNewSeriesModal());
      }

      // Chips de genres — toggle sélection
      const genrePicker = document.getElementById('new-series-genres');
      if (genrePicker) {
        genrePicker.addEventListener('click', (e) => {
          const chip = e.target.closest('.genre-chip');
          if (chip) chip.classList.toggle('selected');
        });
      }

      // Fermer avec Escape
      this.seriesModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.hideNewSeriesModal();
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') this.createNewSeries();
      });

      // Fermer en cliquant sur l'overlay
      this.seriesModal.addEventListener('click', (e) => {
        if (e.target === this.seriesModal) this.hideNewSeriesModal();
      });
    }

    // Boutons d'annulation de Phase 2 (Classification)
    // Note: cancel-import-btn est géré par import-triage.js (Phase 1)
    const cancelClassificationBtn = document.getElementById('cancel-classification-btn');
    if (cancelClassificationBtn) {
      cancelClassificationBtn.addEventListener('click', () => this.showCancelConfirmation());
    }

    const cancelGalleryBtn = document.getElementById('cancel-gallery-btn');
    if (cancelGalleryBtn) {
      cancelGalleryBtn.addEventListener('click', () => this.showCancelConfirmation());
    }

    // Gestion de la modal de confirmation d'annulation
    const cancelConfirmModal = document.getElementById('cancel-confirmation-modal');
    if (cancelConfirmModal) {
      // Empêcher la fermeture accidentelle
      cancelConfirmModal.addEventListener('click', (e) => {
        if (e.target === cancelConfirmModal) {
          cancelConfirmModal.style.display = 'none';
        }
      });
    }
  }

  attachKeyboardListeners() {
    // Ajouter des raccourcis clavier pour la navigation
    document.addEventListener('keydown', (e) => {
      // Vérifier si la modal de classification est ouverte
      if (!this.detailsModal || this.detailsModal.style.display !== 'flex') {
        return;
      }

      // Empêcher les raccourcis si on est en train de taper dans un champ
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.previousFile();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextFileWithoutSaving();
          break;
        case 'Enter':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.saveCurrentFile();
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.skipCurrentFile();
          break;
      }
    });
  }

  // Démarrer le processus de classification (appelé depuis dashboard.js)
  async startClassification(files, scanType, newlyCreatedSeriesIds = [], existingMediaIds = []) {
    console.log(`🎯 Démarrage de la classification: ${files.length} fichiers (${scanType})`);

    // Marquer comme en cours d'import pour éviter les mises à jour du dashboard
    this.isImporting = true;

    // Fusionner les IDs existants (déjà sauvegardés en Phase 1) avec ceux des fichiers
    const fileIds = files.map(file => file.id).filter(id => id);
    this.newlyScannedIds = [...new Set([...existingMediaIds, ...fileIds])]; // Dédupliquer

    // Sauvegarder les IDs des séries créées durant l'import
    this.newlyCreatedSeriesIds = newlyCreatedSeriesIds;

    this.currentFiles = files.map((file, index) => ({
      ...file,
      originalIndex: index,
      classified: false
    }));
    this.classifiedFiles = [];
    this.currentFileIndex = 0;

    console.log('📋 IDs des médias à tracker (Phase 1 + fichiers):', this.newlyScannedIds);
    console.log('📋 IDs des séries créées:', this.newlyCreatedSeriesIds);

    // Utiliser le mode galerie par défaut
    if (this.useGalleryMode) {
      this.showGalleryModal();
    } else {
      // Mode ancien : fichier par fichier
      this.showDetailsModal();
    }
  }

  showDetailsModal() {
    if (this.currentFileIndex >= this.currentFiles.length) {
      // Tous les fichiers ont été traités
      this.completeClassification();
      return;
    }

    const currentFile = this.currentFiles[this.currentFileIndex];
    console.log(`📝 Classification du fichier ${this.currentFileIndex + 1}/${this.currentFiles.length}: ${currentFile.name}`);

    // Remplir les informations du fichier avec indicateur de progression
    const fileNameElement = document.getElementById('detail-file-name');
    if (fileNameElement) {
      fileNameElement.textContent = `[${this.currentFileIndex + 1}/${this.currentFiles.length}] ${currentFile.name}`;
    }

    // Pré-remplir le titre (sans extension)
    const titleInput = document.getElementById('detail-title');
    if (titleInput) {
      titleInput.value = currentFile.title || currentFile.name;
    }

    // Remplir les catégories
    this.populateCategorySelect();

    // Si le fichier a déjà une catégorie (venant du triage), la pré-sélectionner
    const categorySelect = document.getElementById('detail-category');
    if (categorySelect && currentFile.triageType && currentFile.triageType !== 'unsorted') {
      console.log(`🏷️ Pré-sélection de la catégorie: ${currentFile.triageType}`);
      categorySelect.value = currentFile.triageType;
      this.onCategoryChange(currentFile.triageType);
    }

    // Afficher le nom de la série si c'est une série
    this.populateSeriesName(currentFile);

    // Réinitialiser le formulaire (mais garder la catégorie pré-sélectionnée)
    this.resetDetailsForm(currentFile.triageType !== 'unsorted');

    // Afficher la modal
    this.detailsModal.style.display = 'flex';

    // Mettre à jour l'état des boutons de navigation
    this.updateNavigationButtons();

    // Focus sur le premier champ éditable
    setTimeout(() => {
      const firstInput = this.detailsModal.querySelector('input[type="text"], select');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-file-btn');
    const nextBtn = document.getElementById('next-file-btn');

    if (prevBtn) {
      prevBtn.disabled = this.currentFileIndex === 0;
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentFileIndex >= this.currentFiles.length - 1;
    }
  }

  previousFile() {
    if (this.currentFileIndex > 0) {
      this.currentFileIndex--;
      this.showDetailsModal();
    }
  }

  nextFileWithoutSaving() {
    if (this.currentFileIndex < this.currentFiles.length - 1) {
      this.currentFileIndex++;
      this.showDetailsModal();
    }
  }

  showGalleryModal() {
    console.log('🖼️ Affichage de la modal galerie');

    // Remplir les contrôles globaux
    this.populateGlobalControls();

    // Remplir la galerie avec tous les fichiers
    this.populateGallery();

    // Afficher la modal
    this.galleryModal.style.display = 'flex';

    // Attacher les événements de la galerie
    this.attachGalleryEvents();
  }

  populateGlobalControls() {
    // Les séries ne sont plus modifiables en Phase 2 - garder la section cachée
    const seriesGroup = document.getElementById('global-series-group');
    if (seriesGroup) {
      seriesGroup.style.display = 'none';
    }
  }

  populateGallery() {
    const galleryContainer = document.getElementById('gallery-container');
    const galleryCount = document.getElementById('gallery-count');
    const galleryProgress = document.getElementById('gallery-progress');

    if (!galleryContainer) {
      console.error('❌ Élément gallery-container introuvable');
      return;
    }

    // Vider le conteneur
    galleryContainer.innerHTML = '';

    // Mettre à jour les statistiques
    galleryCount.textContent = `${this.currentFiles.length} fichiers`;
    galleryProgress.textContent = '0 classifiés';

    // 1. Séparer médias uniques et séries
    const uniqueMedias = this.currentFiles.filter(f => f.triageType !== 'series');
    const seriesMedias = this.currentFiles.filter(f => f.triageType === 'series');

    console.log(`📊 Répartition: ${uniqueMedias.length} médias uniques, ${seriesMedias.length} épisodes de séries`);

    // 2. Grouper les séries par seriesName
    const seriesGroups = {};
    seriesMedias.forEach(file => {
      const seriesKey = file.seriesName || `serie_${file.seriesId}`;
      if (!seriesGroups[seriesKey]) {
        seriesGroups[seriesKey] = {
          seriesId: file.seriesId,
          seriesName: file.seriesName,
          files: []
        };
      }
      seriesGroups[seriesKey].files.push(file);
    });

    // 3. Créer les sections
    this.renderUniqueMediaSection(uniqueMedias, galleryContainer);
    this.renderSeriesMediaSection(seriesGroups, galleryContainer);
  }

  renderUniqueMediaSection(uniqueMedias, container) {
    if (uniqueMedias.length === 0) {
      console.log('ℹ️ Aucun média unique à afficher');
      return;
    }

    // Créer la section
    const section = document.createElement('section');
    section.className = 'media-section unique-media-section';
    section.id = 'unique-media-section';

    // Header de section
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h3>📁 Médias uniques</h3>
      <span class="section-count">${uniqueMedias.length} média(s)</span>
    `;
    section.appendChild(header);

    // Grille de cartes
    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    // Ajouter chaque carte
    uniqueMedias.forEach(file => {
      const globalIndex = this.currentFiles.indexOf(file);
      const card = this.createGalleryCard(file, globalIndex);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);

    console.log(`✅ Section médias uniques créée: ${uniqueMedias.length} média(s)`);
  }

  renderSeriesMediaSection(seriesGroups, container) {
    const seriesKeys = Object.keys(seriesGroups);
    if (seriesKeys.length === 0) {
      console.log('ℹ️ Aucune série à afficher');
      return;
    }

    // Trier les séries par ordre alphabétique
    seriesKeys.sort((a, b) => a.localeCompare(b));

    // Créer la section
    const section = document.createElement('section');
    section.className = 'media-section series-media-section';
    section.id = 'series-media-section';
    section.style.cssText = 'grid-column: 1 / -1 !important; width: 100% !important; max-width: none !important; display: block !important; float: none !important; clear: both !important; position: relative !important;';

    // Header de section
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h3>📺 Médias en série</h3>
      <span class="section-count">${seriesKeys.length} série(s)</span>
    `;
    section.appendChild(header);

    // Créer un groupe pour chaque série
    seriesKeys.forEach(seriesKey => {
      const seriesData = seriesGroups[seriesKey];

      const group = document.createElement('div');
      group.className = 'series-group';
      group.dataset.seriesId = seriesData.seriesId;
      group.dataset.seriesName = seriesData.seriesName;
      group.style.cssText = 'width: 100% !important; max-width: none !important; display: block !important; float: none !important; clear: both !important; box-sizing: border-box !important; position: relative !important;';

      // Header du groupe (nom de la série)
      const groupHeader = document.createElement('div');
      groupHeader.className = 'series-group-header';
      groupHeader.innerHTML = `
        <div class="series-title-section">
          <h4>${seriesData.seriesName}</h4>
          <button class="btn-manage-seasons" data-series-id="${seriesData.seriesId}" data-series-name="${seriesData.seriesName}">
            <i class="fas fa-layer-group"></i> Gérer les saisons
          </button>
        </div>
        <span class="series-episodes-count">${seriesData.files.length} épisode(s)</span>
      `;
      group.appendChild(groupHeader);

      // NOUVELLE STRUCTURE: Organiser par saisons (async)
      this.renderSeasonsForSeries(group, seriesData).catch(err => {
        console.error('❌ Erreur lors du rendu des saisons:', err);
      });

      section.appendChild(group);
    });

    container.appendChild(section);

    console.log(`✅ Section séries créée: ${seriesKeys.length} série(s)`);

    // Debug: Vérifier les styles appliqués après ajout au DOM
    setTimeout(() => {
      const grids = document.querySelectorAll('.series-cards-grid');
      console.log(`🎨 Vérification styles après ajout au DOM:`);
      grids.forEach((grid, idx) => {
        const styles = window.getComputedStyle(grid);
        console.log(`  Grid ${idx + 1}:`, {
          display: styles.display,
          flexDirection: styles.flexDirection,
          flexWrap: styles.flexWrap,
          gap: styles.gap,
          childrenCount: grid.children.length,
          gridOffsetWidth: grid.offsetWidth + 'px'
        });

        // Vérifier les cartes
        const cards = grid.querySelectorAll('.gallery-card');
        console.log(`    ${cards.length} cartes trouvées:`);

        // DIAGNOSTIC POSITIONS
        console.log(`    🔍 POSITIONS RÉELLES DES CARTES:`);
        cards.forEach((card, cardIdx) => {
          const rect = card.getBoundingClientRect();
          const cardStyles = window.getComputedStyle(card);
          console.log(`      Carte ${cardIdx + 1}:`, {
            position: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            styles: {
              width: cardStyles.width,
              display: cardStyles.display,
              flexBasis: cardStyles.flexBasis,
              flexGrow: cardStyles.flexGrow,
              flexShrink: cardStyles.flexShrink
            }
          });
        });
      });
    }, 100);
  }

  async renderSeasonsForSeries(groupElement, seriesData) {
    console.log(`🎬 Rendu des saisons pour série "${seriesData.seriesName}"`);

    // Récupérer ou initialiser les saisons pour cette série
    const seasons = await this.getSeasonsForSeries(seriesData.seriesId) || [];

    // Séparer les épisodes assignés vs non assignés
    // Un épisode est "assigné" seulement si sa saison auto-détectée existe déjà en base
    const knownSeasonNumbers = new Set(seasons.map(s => s.number));
    const unassignedEpisodes = [];
    const assignedEpisodes = {};

    seriesData.files.forEach(file => {
      const sNum = file.seasonNumber;
      if (sNum != null && knownSeasonNumbers.has(sNum)) {
        if (!assignedEpisodes[sNum]) assignedEpisodes[sNum] = [];
        assignedEpisodes[sNum].push(file);
      } else {
        // Pas de saison en base → "Non assignés" (même si un numéro a été détecté)
        unassignedEpisodes.push(file);
      }
    });

    // Conteneur pour toutes les saisons
    const seasonsContainer = document.createElement('div');
    seasonsContainer.className = 'seasons-container';
    seasonsContainer.dataset.seriesId = seriesData.seriesId;

    // 1. Zone "Non assignés" (toujours affichée)
    this.renderUnassignedZone(seasonsContainer, unassignedEpisodes, seriesData.seriesId);

    // 2. Afficher chaque saison
    seasons.forEach(season => {
      this.renderSeasonZone(seasonsContainer, season, assignedEpisodes[season.number] || [], seriesData.seriesId);
    });

    // 3. Boutons d'action bas de série
    const seriesActions = document.createElement('div');
    seriesActions.className = 'series-bottom-actions';

    const autoSortBtn = document.createElement('button');
    autoSortBtn.className = 'btn-auto-sort';
    autoSortBtn.innerHTML = '<i class="fas fa-magic"></i> Tri auto';
    autoSortBtn.dataset.seriesId = seriesData.seriesId;
    autoSortBtn.addEventListener('click', () => this.autoSortSeries(seriesData.seriesId));
    seriesActions.appendChild(autoSortBtn);

    const addSeasonBtn = document.createElement('button');
    addSeasonBtn.className = 'btn-add-season';
    addSeasonBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter une saison';
    addSeasonBtn.dataset.seriesId = seriesData.seriesId;
    addSeasonBtn.addEventListener('click', () => this.quickAddSeason(seriesData.seriesId));
    seriesActions.appendChild(addSeasonBtn);

    seasonsContainer.appendChild(seriesActions);
    groupElement.appendChild(seasonsContainer);
  }

  renderUnassignedZone(container, episodes, seriesId) {
    const zone = document.createElement('div');
    zone.className = 'season-zone unassigned-zone';
    zone.dataset.seriesId = seriesId;
    zone.dataset.seasonNumber = 'unassigned';

    // Header
    const header = document.createElement('div');
    header.className = 'season-zone-header';
    header.innerHTML = `
      <div class="season-title">
        <i class="fas fa-box-open"></i>
        <span>Non assignés</span>
        <span class="season-episode-count">${episodes.length} épisode(s)</span>
      </div>
      <button class="btn-toggle-season" data-expanded="true">
        <i class="fas fa-chevron-down"></i>
      </button>
    `;
    zone.appendChild(header);

    // Grille des épisodes
    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'season-slots-grid';
    slotsGrid.dataset.seasonNumber = 'unassigned';

    episodes.forEach(file => {
      const slot = this.createEpisodeSlot(file, seriesId, 'unassigned', null);
      slotsGrid.appendChild(slot);
    });

    zone.appendChild(slotsGrid);

    // Event listener pour toggle
    header.querySelector('.btn-toggle-season').addEventListener('click', (e) => {
      this.toggleSeasonZone(zone);
    });

    container.appendChild(zone);
  }

  renderSeasonZone(container, season, assignedEpisodes, seriesId) {
    const zone = document.createElement('div');
    zone.className = 'season-zone';
    zone.dataset.seriesId = seriesId;
    zone.dataset.seasonNumber = season.number;

    // Header
    const header = document.createElement('div');
    header.className = 'season-zone-header';
    header.innerHTML = `
      <div class="season-title">
        <i class="fas fa-film"></i>
        <span>Saison ${season.number}</span>
        <span class="season-episode-count">${season.episodeCount} épisode(s)</span>
      </div>
      <button class="btn-toggle-season" data-expanded="true">
        <i class="fas fa-chevron-down"></i>
      </button>
    `;
    zone.appendChild(header);

    // Grille des slots
    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'season-slots-grid';
    slotsGrid.dataset.seasonNumber = season.number;

    // Créer les slots (vides ou remplis)
    for (let i = 1; i <= season.episodeCount; i++) {
      const episodeInSlot = assignedEpisodes.find(ep => ep.episodeNumber === i);
      const slot = this.createEpisodeSlot(episodeInSlot, seriesId, season.number, i);
      slotsGrid.appendChild(slot);
    }

    zone.appendChild(slotsGrid);

    // Boutons +/-
    const controls = document.createElement('div');
    controls.className = 'season-controls';
    controls.innerHTML = `
      <button class="btn-add-slot" data-series-id="${seriesId}" data-season-number="${season.number}" title="Ajouter un slot">
        <i class="fas fa-plus"></i>
      </button>
      <button class="btn-remove-slot" data-series-id="${seriesId}" data-season-number="${season.number}" title="Retirer le dernier slot">
        <i class="fas fa-minus"></i>
      </button>
    `;
    zone.appendChild(controls);

    // Event listeners
    header.querySelector('.btn-toggle-season').addEventListener('click', () => this.toggleSeasonZone(zone));
    controls.querySelector('.btn-add-slot').addEventListener('click', () => this.addSlotToSeason(seriesId, season.number));
    controls.querySelector('.btn-remove-slot').addEventListener('click', () => this.removeSlotFromSeason(seriesId, season.number));

    container.appendChild(zone);
  }

  createEpisodeSlot(file, seriesId, seasonNumber, slotNumber) {
    const slot = document.createElement('div');
    slot.className = file ? 'episode-slot filled' : 'episode-slot empty';
    slot.dataset.seriesId = seriesId;
    slot.dataset.seasonNumber = seasonNumber;
    slot.dataset.slotNumber = slotNumber || 'auto';

    slot.addEventListener('dragover',  (e) => this.onSlotDragOver(e));
    slot.addEventListener('drop',      (e) => this.onSlotDrop(e));
    slot.addEventListener('dragleave', (e) => this.onSlotDragLeave(e));

    if (file) {
      const chip = this.createEpisodeChip(file, slotNumber);
      slot.appendChild(chip);
    } else {
      slot.innerHTML = `
        <div class="empty-slot-placeholder">
          <i class="fas fa-plus"></i>
          <span>Ép.&nbsp;${slotNumber}</span>
        </div>
      `;
    }

    return slot;
  }

  createEpisodeChip(file, slotNumber) {
    const chip = document.createElement('div');
    chip.className = 'episode-chip';
    chip.setAttribute('draggable', 'true');
    chip.dataset.fileIndex = this.currentFiles.indexOf(file);

    // Miniature
    const thumb = document.createElement('img');
    thumb.className = 'episode-chip-thumb';
    thumb.alt = file.title || file.name || '';
    thumb.draggable = false;
    thumb.ondragstart = (e) => e.preventDefault();
    window.setupImageWithFallback(thumb, file.id, file.posterUrl || null, file.thumbnail || null, '');

    // Info
    const info = document.createElement('div');
    info.className = 'episode-chip-info';

    const label = slotNumber ? `E${String(slotNumber).padStart(2, '0')} — ` : '';
    const title = file.title || file.name || 'Sans titre';
    const duration = file.duration ? this.formatDuration(file.duration) : '';

    info.innerHTML = `
      <div class="episode-chip-title" title="${title}">${label}${title}</div>
      ${duration ? `<div class="episode-chip-meta">${duration}</div>` : ''}
    `;

    // Handle drag
    const handle = document.createElement('span');
    handle.className = 'episode-chip-handle';
    handle.innerHTML = '⠿';
    handle.title = 'Glisser pour déplacer';

    chip.appendChild(handle);
    chip.appendChild(thumb);
    chip.appendChild(info);

    chip.addEventListener('dragstart', (e) => this.onEpisodeDragStart(e, file));
    chip.addEventListener('dragend',   (e) => this.onEpisodeDragEnd(e));

    return chip;
  }

  createGalleryCard(file, globalIndex) {
    const template = document.getElementById('gallery-card-template');
    if (!template) {
      console.error('❌ Template gallery-card-template introuvable');
      return null;
    }

    const card = template.content.cloneNode(true).querySelector('.gallery-card');

    // Configurer les attributs de la carte
    card.dataset.fileIndex = globalIndex;

    // Définir le type de média pour le CSS
    const mediaType = file.triageType === 'series' ? 'series' : 'unique';
    card.dataset.mediaType = mediaType;

    // Ajouter le nom du fichier comme data attribute pour backup
    card.setAttribute('data-file-name', file.name || '');

    // Miniature
    const thumbImg = card.querySelector('.gallery-card-thumb-img');
    if (thumbImg) {
      thumbImg.alt = file.title || file.name || '';
      window.setupImageWithFallback(thumbImg, file.id, file.posterUrl || null, file.thumbnail || null, file.title || file.name);
    }

    // Remplir le titre (nettoyé si auto-détecté en phase 1)
    const titleInput = card.querySelector('.title-input');
    if (titleInput) {
      titleInput.value = file.title || file.name;
    }

    // Pré-remplir l'année si détectée automatiquement
    const yearInput = card.querySelector('.year-input');
    if (yearInput && file.year) {
      yearInput.value = file.year;
    }

    // Afficher automatiquement les champs série si c'est une série
    if (file.triageType === 'series') {
      // Afficher la section des champs série
      const seriesFields = card.querySelector('.series-fields');
      const uniqueFields = card.querySelector('.unique-fields');

      if (seriesFields) {
        seriesFields.style.display = 'block';
      }
      if (uniqueFields) {
        uniqueFields.style.display = 'none';
      }

      // Remplir le nom de la série (lecture seule)
      const seriesNameInput = card.querySelector('.series-name-readonly');
      if (seriesNameInput && file.seriesName) {
        seriesNameInput.value = file.seriesName;
      }

      // Pré-remplir saison/épisode depuis la détection automatique du nom
      const seasonDisplay = card.querySelector('.season-display');
      if (seasonDisplay && file.seasonNumber != null) {
        seasonDisplay.value = file.seasonNumber;
      }

      const episodeDisplay = card.querySelector('.episode-display');
      if (episodeDisplay && file.episodeNumber != null) {
        episodeDisplay.value = file.episodeNumber;
      }

      // Remplir la durée (lecture seule)
      const durationDisplay = card.querySelector('.duration-display');
      if (durationDisplay) {
        const formattedDuration = file.duration ? this.formatDuration(file.duration) : '--:--';
        durationDisplay.value = formattedDuration;
      }
    }

    return card;
  }

  attachGalleryEvents() {
    const galleryContainer = document.getElementById('gallery-container');
    const saveAllBtn = document.getElementById('save-all-unsorted-btn');
    const finishBtn = document.getElementById('finish-classification-btn');

    if (!galleryContainer) return;

    // Plus besoin de gérer le changement de catégorie car elle est définie en phase 1

    galleryContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.gallery-card');
      if (!card) return;

      // Gestion des boutons principaux
      if (e.target.classList.contains('save-btn')) {
        this.saveGalleryCard(card);
      } else if (e.target.classList.contains('skip-btn')) {
        this.skipGalleryCard(card);
      } else if (e.target.classList.contains('new-series-btn')) {
        this.showNewSeriesModal();
      }

      // Gestion du bouton "Ajouter un genre"
      if (e.target.classList.contains('genre-add-btn')) {
        e.stopPropagation();

        // Fermer tous les autres dropdowns d'abord
        document.querySelectorAll('.genre-dropdown-menu.active').forEach(dd => {
          if (dd !== card.querySelector('.genre-dropdown-menu')) {
            dd.classList.remove('active');
          }
        });

        const dropdown = card.querySelector('.genre-dropdown-menu');
        if (dropdown) {
          const isActive = dropdown.classList.contains('active');

          if (isActive) {
            // Si déjà ouvert, fermer
            dropdown.classList.remove('active');
          } else {
            // Ouvrir et positionner
            // Positionner le dropdown en fonction du bouton
            const rect = e.target.getBoundingClientRect();
            const dropdownHeight = 200; // max-height du dropdown
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            // Déterminer si on ouvre vers le haut ou le bas
            let top, left;

            if (spaceBelow >= dropdownHeight + 10) {
              // Assez d'espace en bas
              top = rect.bottom + 5;
              dropdown.classList.remove('open-upward');
            } else if (spaceAbove >= dropdownHeight + 10) {
              // Pas assez d'espace en bas, ouvrir vers le haut
              top = rect.top - dropdownHeight - 5;
              dropdown.classList.add('open-upward');
            } else {
              // Pas assez d'espace ni en haut ni en bas, centrer verticalement
              top = Math.max(10, (window.innerHeight - dropdownHeight) / 2);
              dropdown.classList.remove('open-upward');
            }

            // Position horizontale (aligné à gauche du bouton)
            left = rect.left;

            // Vérifier que le dropdown ne dépasse pas à droite
            const dropdownWidth = 180;
            if (left + dropdownWidth > window.innerWidth) {
              left = window.innerWidth - dropdownWidth - 10;
            }

            // Appliquer les positions
            dropdown.style.top = `${top}px`;
            dropdown.style.left = `${left}px`;

            // Ouvrir le dropdown
            dropdown.classList.add('active');
          }
        }
      }

      // Gestion de la sélection d'un genre dans le dropdown
      if (e.target.classList.contains('genre-dropdown-option')) {
        const genre = e.target.dataset.genre;
        const dropdown = card.querySelector('.genre-dropdown-menu');
        this.addGenreTag(card, genre);
        dropdown.classList.remove('active');
      }

      // Gestion du retrait d'un genre
      if (e.target.classList.contains('genre-tag-remove')) {
        const tag = e.target.closest('.genre-tag');
        if (tag) {
          tag.remove();
          this.updateGenreDropdown(card);
        }
      }
    });

    // Fermer les dropdowns quand on clique ailleurs (mais pas sur la modale du film)
    document.addEventListener('click', (e) => {
      // Ne pas fermer si on clique sur le dropdown lui-même ou sur la modale du film
      if (!e.target.closest('.genre-add-dropdown') &&
          !e.target.closest('.genre-dropdown-menu') &&
          !e.target.closest('.movie-modal') &&
          !e.target.closest('.modal-overlay')) {
        document.querySelectorAll('.genre-dropdown-menu.active').forEach(dropdown => {
          dropdown.classList.remove('active');
        });
      }
    });

    // Boutons d'application globale (année seulement)
    const applyGlobalYearBtn = document.getElementById('apply-global-year');
    const globalNewSeriesBtn = document.getElementById('global-new-series');

    if (applyGlobalYearBtn) {
      applyGlobalYearBtn.addEventListener('click', () => this.applyGlobalYear());
    }

    if (globalNewSeriesBtn) {
      globalNewSeriesBtn.addEventListener('click', () => this.showNewSeriesModal());
    }

    // Boutons globaux
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => this.saveAllAsUnsorted());
    }

    if (finishBtn) {
      finishBtn.addEventListener('click', () => this.finishGalleryClassification());
    }

    // Bouton Retour (spécifique à la galerie)
    const backBtn = document.getElementById('back-to-triage-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.backToTriage());
    }

    // Clic à l'extérieur de la modal affiche la confirmation d'annulation
    if (this.galleryModal) {
      this.galleryModal.addEventListener('click', (e) => {
        if (e.target === this.galleryModal) {
          this.showCancelConfirmation();
        }
      });
    }

    if (this.importModal) {
      this.importModal.addEventListener('click', (e) => {
        if (e.target === this.importModal) {
          this.showCancelConfirmation();
        }
      });
    }
  }


  applyGlobalYear() {
    const globalYearInput = document.getElementById('global-year-input');
    const yearValue = globalYearInput?.value;

    if (!yearValue) {
      alert('Veuillez saisir une année à appliquer');
      return;
    }

    console.log(`⚡ Application de l'année "${yearValue}" à toutes les cartes`);

    // Appliquer à toutes les cartes
    const allCards = document.querySelectorAll('.gallery-card');
    let appliedCount = 0;

    allCards.forEach(card => {
      const cardYearInput = card.querySelector('.year-input');
      if (cardYearInput && !cardYearInput.disabled) {
        cardYearInput.value = yearValue;
        appliedCount++;
      }
    });

    // Feedback visuel
    const button = document.getElementById('apply-global-year');
    if (button) {
      const originalText = button.textContent;
      button.textContent = `✓ Appliqué (${appliedCount})`;
      button.disabled = true;

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }
  }

  formatDuration(duration) {
    if (!duration || duration === 0) return '--:--';

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  populateCategorySelect() {
    const categorySelect = document.getElementById('detail-category');
    if (!categorySelect) return;

    categorySelect.innerHTML = '<option value="">Sélectionner une catégorie</option>';

    // Utiliser les catégories fixes du nouveau système
    const fixedCategories = [
      { value: 'film', icon: '🎬', name: 'Film' },
      { value: 'series', icon: '📺', name: 'Série' },
      { value: 'short', icon: '🎞️', name: 'Court métrage' },
      { value: 'other', icon: '📁', name: 'Autre' }
    ];

    fixedCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.value;
      option.textContent = `${category.icon} ${category.name}`;
      categorySelect.appendChild(option);
    });
  }

  populateSeriesName(currentFile) {
    const seriesNameInput = document.getElementById('detail-series-name');
    if (!seriesNameInput) return;

    // Afficher le nom de la série si c'est une série
    if (currentFile.triageType === 'series' && currentFile.seriesName) {
      seriesNameInput.value = currentFile.seriesName;
    } else {
      seriesNameInput.value = '';
    }
  }

  populateSeriesSelect(seriesSelect = null) {
    if (!seriesSelect) return;

    const previousValue = seriesSelect.value;

    seriesSelect.innerHTML = '<option value="">Sélectionner une série</option>';

    if (this.series && Array.isArray(this.series)) {
      this.series.forEach(serie => {
        const option = document.createElement('option');
        option.value = serie.id;
        option.textContent = serie.name;
        seriesSelect.appendChild(option);
      });
    }

    if (previousValue) seriesSelect.value = previousValue;
  }

  async saveGalleryCard(card) {
    const fileIndex = parseInt(card.dataset.fileIndex);
    const file = this.currentFiles[fileIndex];

    if (!file) {
      console.error('❌ Fichier non trouvé pour l\'index:', fileIndex);
      return;
    }

    // Récupérer les données du formulaire de la carte
    const formData = this.getGalleryCardData(card);

    if (!this.validateGalleryCardData(formData, card)) {
      return;
    }

    try {
      console.log('💾 Sauvegarde du fichier depuis la galerie:', file.name);

      const saveData = {
        filePath: file.path,
        title: formData.title.trim(),
        category: formData.category,
        mediaType: formData.mediaType,

        // Nouveaux champs enrichis
        description: formData.description || '',
        year: formData.year || null,
        genres: formData.genres || [],
        director: formData.director || '',
        actors: formData.actors || [],
        franchise: formData.franchise || '',
        posterUrl: formData.posterUrl || '',

        // Champs pour séries
        releaseDate: null,
        seriesId: formData.seriesId || null,
        seriesName: formData.seriesName || null,
        season_number: formData.seasonNumber ?? null,
        episode_number: formData.episodeNumber ?? null
      };

      console.log('📤 Envoi des données de sauvegarde:', saveData);
      const result = await window.electronAPI.saveClassifiedFile(saveData);
      console.log('📥 Résultat de sauvegarde:', result);

      if (result.success) {
        console.log('✅ Fichier sauvegardé avec succès');

        // Tracker l'ID du film nouvellement créé pour pouvoir l'annuler plus tard
        if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
          this.newlyScannedIds.push(result.movieId);
          console.log('📋 ID ajouté à la liste des films trackés:', result.movieId);
        }

        // Marquer comme sauvegardé
        this.markCardAsSaved(card, fileIndex);
        this.updateGalleryProgress();

      } else {
        console.error('❌ Erreur lors de la sauvegarde:', result.message);
        window.showNotification('Erreur de sauvegarde', result.message, 'error');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      window.showNotification('Erreur de sauvegarde', error.message, 'error');
    }
  }

  skipGalleryCard(card) {
    const fileIndex = parseInt(card.dataset.fileIndex);
    console.log('⏭️ Fichier passé:', this.currentFiles[fileIndex]?.name);

    // Marquer comme passé
    this.markCardAsSkipped(card, fileIndex);
    this.updateGalleryProgress();
  }

  getGalleryCardData(card) {
    const fileIndex = parseInt(card.dataset.fileIndex);
    const file = this.currentFiles[fileIndex];

    // La catégorie est TOUJOURS définie par file.triageType (venant de la phase 1)
    let category = file?.triageType || 'unsorted';

    console.log(`🔍 getGalleryCardData pour ${file?.name}:`);
    console.log(`   - fileIndex: ${fileIndex}`);
    console.log(`   - file.triageType: ${file?.triageType}`);
    console.log(`   - category utilisée: ${category}`);

    // Récupérer le titre depuis l'input ou utiliser le nom du fichier par défaut
    let title = card.querySelector('.title-input')?.value || '';
    if (!title || title.trim() === '') {
      // Essayer plusieurs fallbacks
      title = file?.name || file?.title || card.getAttribute('data-file-name') || 'Fichier sans nom';
      console.log(`   - Titre vide, utilisation du fallback: ${title}`);
    }

    // Récupérer les genres sélectionnés (pastilles)
    const genreTags = card.querySelectorAll('.genre-tag');
    const genres = Array.from(genreTags).map(tag => tag.dataset.genre);

    // Récupérer la description
    const description = card.querySelector('.description-input')?.value?.trim() || '';

    // Récupérer les champs avancés
    const director = card.querySelector('.director-input')?.value?.trim() || '';

    // Récupérer les acteurs et les convertir en array
    const actorsString = card.querySelector('.actors-input')?.value?.trim() || '';
    const actors = actorsString ? actorsString.split(',').map(a => a.trim()).filter(a => a) : [];

    const franchise = card.querySelector('.franchise-input')?.value?.trim() || '';
    const posterUrl = card.querySelector('.poster-input')?.value?.trim() || '';

    const result = {
      title: title.trim(),
      category: category,
      mediaType: file?.mediaType || (category === 'series' ? 'series' : 'unique'),
      year: parseInt(card.querySelector('.year-input')?.value) || null,

      // Nouveaux champs pour médias uniques
      genres: genres,
      description: description,
      director: director,
      actors: actors,
      franchise: franchise,
      posterUrl: posterUrl,

      // Champs pour séries
      seriesId: file?.seriesId || null,
      seriesName: file?.seriesName || null,
      // Lire depuis le champ éditable (utilisateur peut corriger), sinon fallback in-memory
      seasonNumber:  (() => { const v = parseInt(card.querySelector('.season-display')?.value);  return isNaN(v) ? (file?.seasonNumber  ?? null) : v; })(),
      episodeNumber: (() => { const v = parseInt(card.querySelector('.episode-display')?.value); return isNaN(v) ? (file?.episodeNumber ?? null) : v; })()
    };

    console.log(`   - Données finales:`, result);
    return result;
  }

  validateGalleryCardData(formData, card) {
    if (!formData.title || !formData.title.trim()) {
      window.showNotification('Titre manquant', 'Le titre est obligatoire pour sauvegarder.', 'warning');
      card.querySelector('.title-input')?.focus();
      return false;
    }

    // La catégorie est maintenant définie en phase 1, pas besoin de validation supplémentaire

    if (formData.category === 'series' && (!formData.seriesId || formData.seriesId === '')) {
      window.showNotification('Série manquante', 'Aucune série définie. Revenez au triage pour en sélectionner une.', 'warning');
      return false;
    }

    return true;
  }

  markCardAsSaved(card, fileIndex) {
    const statusIndicator = card.querySelector('.status-indicator');
    const saveBtn = card.querySelector('.save-btn');

    // Feedback visuel amélioré
    card.style.opacity = '0.8';
    card.style.border = '2px solid #4CAF50';
    card.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';

    if (statusIndicator) {
      statusIndicator.textContent = '✅ Sauvegardé';
      statusIndicator.style.color = '#4CAF50';
      statusIndicator.style.fontWeight = 'bold';
      statusIndicator.dataset.status = 'saved';
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '✓ Sauvé';
      saveBtn.style.backgroundColor = '#4CAF50';
      saveBtn.style.color = 'white';
      saveBtn.style.cursor = 'not-allowed';
    }

    // Marquer le fichier comme classifié
    this.currentFiles[fileIndex].classified = true;

    console.log(`✅ Carte ${fileIndex} marquée comme sauvegardée visuellement`);

    // Ajouter à la liste des fichiers classifiés si pas déjà présent
    if (!this.classifiedFiles) {
      this.classifiedFiles = [];
    }
    this.classifiedFiles.push(this.currentFiles[fileIndex]);
  }

  markCardAsSkipped(card, fileIndex) {
    const statusIndicator = card.querySelector('.status-indicator');
    const saveBtn = card.querySelector('.save-btn');

    if (statusIndicator) {
      statusIndicator.textContent = 'Passé';
      statusIndicator.dataset.status = 'skipped';
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '-';
    }

    // Marquer comme passé
    this.currentFiles[fileIndex].skipped = true;
  }

  updateGalleryProgress() {
    const galleryProgress = document.getElementById('gallery-progress');
    const classifiedCount = this.currentFiles.filter(f => f.classified || f.skipped).length;

    if (galleryProgress) {
      galleryProgress.textContent = `${classifiedCount} traités`;
    }
  }

  async saveAllAsUnsorted() {
    console.log('📥 Sauvegarde de tous les fichiers comme non triés');

    // Traiter tous les fichiers non encore sauvegardés
    const pendingFiles = this.currentFiles.filter(f => !f.classified && !f.skipped);

    console.log(`⚡ Sauvegarde PARALLÈLE de ${pendingFiles.length} fichiers...`);

    // Créer toutes les promesses de sauvegarde
    const savePromises = pendingFiles.map(file =>
      window.electronAPI.saveClassifiedFile({
        filePath: file.path,
        title: file.title || file.name,
        category: 'unsorted',
        mediaType: 'unique',
        description: '',
        releaseDate: null,
        year: null,
        seriesId: null,
        seriesName: null,
        season_number: null,
        episode_number: null
      })
      .then(result => {
        if (result.success) {
          file.classified = true;
          this.classifiedFiles.push(file);

          // Tracker l'ID du film nouvellement créé pour pouvoir l'annuler plus tard
          if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
            this.newlyScannedIds.push(result.movieId);
            console.log('📋 ID ajouté à la liste des films trackés (tout passer):', result.movieId);
          }
        }
        return result;
      })
      .catch(error => {
        console.error('❌ Erreur pour', file.name, ':', error);
        return { success: false, error };
      })
    );

    // Attendre que TOUTES les sauvegardes soient terminées
    await Promise.all(savePromises);
    console.log(`✅ ${pendingFiles.length} fichiers sauvegardés en parallèle !`);

    this.finishGalleryClassification();
  }

  async finishGalleryClassification() {
    console.log('🎉 Finalisation de la classification galerie...');

    const pendingFiles = this.currentFiles.filter(f => !f.classified && !f.skipped);
    const total = pendingFiles.length;

    // Désactiver le bouton pour éviter les double-clics
    const finishBtn = document.getElementById('finish-classification-btn');
    if (finishBtn) {
      finishBtn.disabled = true;
      finishBtn.textContent = 'Sauvegarde en cours...';
    }

    // Afficher l'overlay de progression
    const progressOverlay = this.showSavingOverlay(total);

    let savedCount = 0;

    for (const file of pendingFiles) {
      const card = document.querySelector(`[data-file-index="${this.currentFiles.indexOf(file)}"]`);
      if (!card) continue;

      const fileName = file.name || file.title || file.path || 'Fichier inconnu';
      this.updateSavingOverlay(progressOverlay, savedCount, total, fileName);
      console.log(`💾 Sauvegarde de: ${fileName}`);

      const formData = this.getGalleryCardData(card);

      try {
        const result = await window.electronAPI.saveClassifiedFile({
          filePath: file.path,
          title: formData.title.trim(),
          category: formData.category,
          mediaType: formData.mediaType,
          description: '',
          releaseDate: null,
          year: formData.year || null,
          seriesId: formData.seriesId || null,
          seriesName: formData.seriesName || null,
          season_number: formData.seasonNumber || null,
          episode_number: formData.episodeNumber || null
        });

        if (result.success) {
          file.classified = true;
          this.classifiedFiles.push(file);
          savedCount++;
          console.log(`✅ ${fileName} sauvegardé`);

          if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
            this.newlyScannedIds.push(result.movieId);
          }
        } else {
          console.error(`❌ Erreur sauvegarde ${fileName}:`, result.message);
        }
      } catch (error) {
        console.error('❌ Erreur pour', fileName, ':', error);
      }
    }

    if (finishBtn) finishBtn.disabled = false;

    // Transition vers la phase d'intégration (garde l'overlay visible)
    this.transitionOverlayToIntegrating(progressOverlay);

    // Marquer la fin de l'import
    this.isImporting = false;

    // Fermer la modal pendant le reload
    this.galleryModal.style.display = 'none';

    // Recharger les films (phase d'intégration)
    await this.forceReloadMovies();

    // Retirer l'overlay avec fondu
    if (progressOverlay) {
      progressOverlay.classList.remove('visible');
      setTimeout(() => progressOverlay.remove(), 400);
    }

    const classifiedCount = this.classifiedFiles.length;
    const skippedCount = this.currentFiles.filter(f => f.skipped).length;

    window.showNotification(
      'Classification terminée',
      `${classifiedCount} fichier(s) classifié(s)${skippedCount > 0 ? `, ${skippedCount} passé(s)` : ''}`,
      'success',
      6000
    );
  }

  onCategoryChange(categoryValue) {
    const seriesSection = document.getElementById('series-section');
    if (!seriesSection) return;

    // Afficher la section série si la catégorie est "series"
    if (categoryValue === 'series') {
      seriesSection.style.display = 'block';
    } else {
      seriesSection.style.display = 'none';
    }
  }

  resetDetailsForm(keepCategory = false) {
    const form = document.querySelector('.details-form');
    if (!form) return;

    // Réinitialiser tous les champs sauf le titre et le nom de fichier (et optionnellement la catégorie)
    const excludeSelectors = ['#detail-title', '#detail-file-name'];
    if (keepCategory) {
      excludeSelectors.push('#detail-category');
    }

    const inputs = form.querySelectorAll(`input:not(${excludeSelectors.join(', ')}), select:not(${excludeSelectors.join(', ')}), textarea`);
    inputs.forEach(input => {
      if (input.type === 'number') {
        input.value = '';
      } else {
        input.value = '';
      }
    });

    // Masquer la section série par défaut (sauf si on garde une catégorie série)
    const seriesSection = document.getElementById('series-section');
    const categorySelect = document.getElementById('detail-category');
    if (seriesSection) {
      if (keepCategory && categorySelect && categorySelect.value === 'series') {
        seriesSection.style.display = 'block';
      } else {
        seriesSection.style.display = 'none';
      }
    }
  }

  async saveCurrentFile() {
    const currentFile = this.currentFiles[this.currentFileIndex];

    // Récupérer les données du formulaire
    const formData = this.getFormData();

    if (!this.validateFormData(formData)) {
      return;
    }

    try {
      console.log('💾 Sauvegarde du fichier:', currentFile.name);
      console.log('📋 Données:', formData);

      // Préparer les données pour l'API
      const saveData = {
        filePath: currentFile.path,
        title: formData.title.trim(),
        category: formData.category,
        mediaType: formData.mediaType,
        description: formData.description.trim(),
        releaseDate: formData.releaseDate || null,
        year: formData.year || null,
        seriesId: formData.seriesId || null,
        seriesName: formData.seriesName || null,
        season_number: formData.seasonNumber ?? null,
        episode_number: formData.episodeNumber ?? null
      };

      console.log('🔍 Données API:', saveData);

      const result = await window.electronAPI.saveClassifiedFile(saveData);

      if (result.success) {
        console.log('✅ Fichier sauvegardé avec succès');

        // Tracker l'ID du film nouvellement créé pour pouvoir l'annuler plus tard
        if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
          this.newlyScannedIds.push(result.movieId);
          console.log('📋 ID ajouté à la liste des films trackés (mode détail):', result.movieId);
        }

        // Marquer le fichier comme classifié
        this.currentFiles[this.currentFileIndex].classified = true;
        this.classifiedFiles.push(currentFile);

        // Ne pas recharger pendant l'import pour éviter les perturbations visuelles
        // Le rechargement se fera seulement à la fin

        // Passer au fichier suivant automatiquement
        this.nextFile();
      } else {
        console.error('❌ Erreur lors de la sauvegarde:', result.message);
        alert('Erreur lors de la sauvegarde: ' + result.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  }

  getFormData() {
    const category = document.getElementById('detail-category')?.value || 'unsorted';
    return {
      title: document.getElementById('detail-title')?.value || '',
      category: category,
      mediaType: category === 'series' ? 'series' : 'unique',
      description: document.getElementById('detail-description')?.value || '',
      releaseDate: document.getElementById('detail-release-date')?.value || '',
      year: parseInt(document.getElementById('detail-year')?.value) || null,
      seriesId: this.currentFiles[this.currentFileIndex]?.seriesId || null,
      seriesName: null, // Sera récupéré depuis les données série si nécessaire
      seasonNumber: parseInt(document.getElementById('detail-season')?.value) || null,
      episodeNumber: parseInt(document.getElementById('detail-episode')?.value) || null
    };
  }

  validateFormData(formData) {
    if (!formData.title || !formData.title.trim()) {
      alert('Le titre est obligatoire');
      document.getElementById('detail-title')?.focus();
      return false;
    }

    if (!formData.category || formData.category === '') {
      alert('La catégorie est obligatoire');
      document.getElementById('detail-category')?.focus();
      return false;
    }

    // Vérifier que la catégorie est valide
    const validCategories = ['film', 'series', 'short', 'other'];
    if (!validCategories.includes(formData.category)) {
      alert('Catégorie invalide');
      document.getElementById('detail-category')?.focus();
      return false;
    }

    // Si c'est une série, vérifier les champs obligatoires
    if (formData.category === 'series') {
      if (!formData.seriesId || formData.seriesId === '') {
        alert('Erreur: aucune série définie. Veuillez revenir au triage pour sélectionner une série.');
        return false;
      }
    }

    return true;
  }

  skipCurrentFile() {
    console.log('⏭️ Fichier passé:', this.currentFiles[this.currentFileIndex].name);
    this.nextFile();
  }

  nextFile() {
    this.currentFileIndex++;
    
    // Fermer la modal actuelle
    this.detailsModal.style.display = 'none';
    
    // Afficher le fichier suivant ou terminer
    this.showDetailsModal();
  }

  showNewSeriesModal() {
    window._newSeriesCallback = null;
    this._resetNewSeriesForm();
    this.seriesModal.style.display = 'flex';
    setTimeout(() => document.getElementById('new-series-name')?.focus(), 100);
  }

  hideNewSeriesModal() {
    this.seriesModal.style.display = 'none';
    this._resetNewSeriesForm();
    window._newSeriesCallback = null;
  }

  _resetNewSeriesForm() {
    ['new-series-name', 'new-series-year', 'new-series-country',
     'new-series-creator', 'new-series-platform', 'new-series-description'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const statusEl = document.getElementById('new-series-status');
    if (statusEl) statusEl.value = 'unknown';
    document.querySelectorAll('#new-series-genres .genre-chip').forEach(chip => {
      chip.classList.remove('selected');
    });
  }

  showCancelConfirmation() {
    const confirmModal = document.getElementById('cancel-confirmation-modal');
    if (confirmModal) {
      confirmModal.style.display = 'flex';

      // Gérer les boutons de confirmation
      const btnNo = document.getElementById('cancel-confirmation-no');
      const btnYes = document.getElementById('cancel-confirmation-yes');

      btnNo.onclick = () => {
        confirmModal.style.display = 'none';
      };

      btnYes.onclick = () => {
        this.cancelImportCompletely();
        confirmModal.style.display = 'none';
      };
    }
  }

  async cancelImportCompletely() {
    console.log('❌ Annulation complète de l\'importation par l\'utilisateur');

    // Marquer la fin de l'import
    this.isImporting = false;

    // Fermer toutes les modales
    if (this.galleryModal) this.galleryModal.style.display = 'none';
    if (this.detailsModal) this.detailsModal.style.display = 'none';
    if (this.importModal) this.importModal.style.display = 'none';

    // Réinitialiser les données
    this.currentFiles = [];
    this.classifiedFiles = [];
    this.currentFileIndex = 0;

    // IMPORTANT: Nettoyer les fichiers partiellement importés (suppression de la DB)
    await this.cleanupPartialImport();

    // Notifier l'utilisateur
    if (window.showNotification) {
      window.showNotification('Import annulé', 'L\'import des médias a été annulé avec succès.', 'info');
    }

    console.log('✅ Import complètement annulé');
  }

  backToTriage() {
    console.log('🔙 Retour vers la phase de triage');

    // Vérifier s'il y a eu des modifications dans la phase 2
    const hasModifications = this.classifiedFiles.length > 0 ||
                             this.currentFiles.some(f => f.classified || f.skipped);

    if (hasModifications) {
      const confirmation = confirm(
        'Vous avez des modifications non sauvegardées.\n\n' +
        'En retournant à la phase 1, vous perdrez toutes les modifications effectuées dans la phase 2.\n\n' +
        'Voulez-vous vraiment continuer ?'
      );

      if (!confirmation) {
        console.log('🚫 Retour annulé par l\'utilisateur');
        return;
      }
    }

    // Fermer la modal galerie (phase 2)
    if (this.galleryModal) {
      this.galleryModal.style.display = 'none';
    }

    // IMPORTANT: Ne pas réinitialiser this.currentFiles car on veut garder les médias
    // Seulement réinitialiser les états de classification pour permettre une nouvelle classification
    this.currentFiles.forEach(file => {
      file.classified = false;
      file.skipped = false;
    });
    this.classifiedFiles = [];

    // Repeupler et réafficher la modal de triage (phase 1)
    // Utiliser l'instance du système de triage pour repeupler les données
    if (window.importTriageSystem && typeof window.importTriageSystem.populateTriageModal === 'function') {
      console.log('🔄 Repeuplement de la modale de triage avec', this.currentFiles.length, 'fichiers');
      // Transférer les fichiers vers le système de triage
      window.importTriageSystem.currentFiles = this.currentFiles;
      window.importTriageSystem.populateTriageModal();
      window.importTriageSystem.showTriageModal();
    } else if (this.importModal) {
      // Fallback : juste ouvrir la modal (peut être vide)
      console.warn('⚠️ Système de triage non disponible, ouverture simple de la modal');
      this.importModal.style.display = 'flex';
    }

    // Garder l'état d'import actif car on revient juste en arrière
    // this.isImporting reste true
  }

  async cleanupPartialImport() {
    console.log('🧹 Nettoyage des données d\'import partielles');

    // Supprimer les médias
    if (this.newlyScannedIds && this.newlyScannedIds.length > 0) {
      console.log(`🗑️ Suppression de ${this.newlyScannedIds.length} fichiers nouvellement scannés`);

      try {
        // Supprimer chaque fichier nouvellement scanné de la base de données
        for (const movieId of this.newlyScannedIds) {
          console.log(`🗑️ Suppression du média ${movieId}`);
          const result = await window.electronAPI.deleteMedia(movieId);
          if (result.success) {
            console.log(`✅ Média ${movieId} supprimé avec succès`);
          } else {
            console.error(`❌ Erreur lors de la suppression du média ${movieId}:`, result.message);
          }
        }
      } catch (error) {
        console.error('❌ Erreur lors du nettoyage des médias:', error);
      }
    }

    // Supprimer les séries créées durant l'import
    if (this.newlyCreatedSeriesIds && this.newlyCreatedSeriesIds.length > 0) {
      console.log(`🗑️ Suppression de ${this.newlyCreatedSeriesIds.length} série(s) créée(s) durant l'import`);

      try {
        for (const seriesId of this.newlyCreatedSeriesIds) {
          console.log(`🗑️ Suppression de la série ${seriesId}`);
          const result = await window.electronAPI.deleteSeries(seriesId);
          if (result.success) {
            console.log(`✅ Série ${seriesId} supprimée avec succès`);
          } else {
            console.error(`❌ Erreur lors de la suppression de la série ${seriesId}:`, result.message);
          }
        }
      } catch (error) {
        console.error('❌ Erreur lors du nettoyage des séries:', error);
      }
    }

    // Recharger la liste des films pour refléter les suppressions
    this.forceReloadMovies();

    // Réinitialiser les listes
    this.newlyScannedIds = [];
    this.newlyCreatedSeriesIds = [];
  }

  async createNewSeries() {
    const name = document.getElementById('new-series-name')?.value?.trim();
    if (!name) {
      window.showNotification('Nom requis', 'Le nom de la série est obligatoire.', 'warning');
      document.getElementById('new-series-name')?.focus();
      return;
    }

    const description = document.getElementById('new-series-description')?.value?.trim() || '';
    const startYear   = parseInt(document.getElementById('new-series-year')?.value) || null;
    const status      = document.getElementById('new-series-status')?.value || 'unknown';
    const country     = document.getElementById('new-series-country')?.value?.trim() || '';
    const creator     = document.getElementById('new-series-creator')?.value?.trim() || '';
    const platform    = document.getElementById('new-series-platform')?.value?.trim() || '';
    const genres      = [...document.querySelectorAll('#new-series-genres .genre-chip.selected')]
                          .map(chip => chip.dataset.genre);

    try {
      console.log('📺 Création de la série:', name);

      const result = await window.electronAPI.createSeries({
        name, description, startYear, status, country, creator, platform, genres
      });

      if (result.success) {
        console.log('✅ Série créée avec succès, ID:', result.series.id);

        const newSeries = { id: result.series.id, name, description };
        this.series.push(newSeries);

        // Mettre à jour tous les selects
        this.populateSeriesSelect();
        this.populateSeriesSelect(document.getElementById('global-series-select'));
        document.querySelectorAll('.gallery-card .series-select').forEach(select => {
          this.populateSeriesSelect(select);
        });

        const globalSeriesSelect = document.getElementById('global-series-select');
        if (globalSeriesSelect) {
          globalSeriesSelect.value = result.series.id;
        }

        // Appeler le callback spécifique à l'appelant (ex: sélection dans ligne triage)
        // Le callback gère lui-même la synchro triage si nécessaire
        if (typeof window._newSeriesCallback === 'function') {
          window._newSeriesCallback(result.series);
          window._newSeriesCallback = null;
        }

        this.hideNewSeriesModal();
      } else {
        console.error('❌ Erreur lors de la création de la série:', result.message);
        window.showNotification('Erreur', result.message, 'error');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la création de la série:', error);
      window.showNotification('Erreur', error.message, 'error');
    }
  }

  async completeClassification() {
    console.log('🎉 Classification terminée!');
    console.log(`📊 Fichiers classifiés: ${this.classifiedFiles.length}/${this.currentFiles.length}`);

    // Marquer la fin de l'import
    this.isImporting = false;

    // Fermer toutes les modales
    if (this.detailsModal) this.detailsModal.style.display = 'none';
    if (this.importModal) this.importModal.style.display = 'none';

    // Afficher un message de succès
    const classifiedCount = this.classifiedFiles.length;
    const totalCount = this.currentFiles.length;
    const skippedCount = totalCount - classifiedCount;

    let message = `Classification terminée!\n`;
    message += `📁 ${classifiedCount} fichiers classifiés\n`;
    if (skippedCount > 0) {
      message += `⏭️ ${skippedCount} fichiers passés\n`;
    }
    message += `\nLes fichiers ont été ajoutés à votre bibliothèque.`;

    // Recharger les films AVANT d'afficher la notification
    await this.forceReloadMovies();

    window.showNotification(
      'Classification terminée',
      `${classifiedCount} fichier(s) classifié(s)${skippedCount > 0 ? `, ${skippedCount} passé(s)` : ''}`,
      'success',
      6000
    );
  }

  showSavingOverlay(total) {
    const overlay = document.createElement('div');
    overlay.className = 'saving-overlay';
    overlay.innerHTML = `
      <div class="saving-overlay-box">
        <div class="saving-spinner"></div>
        <div class="saving-overlay-title">Sauvegarde en cours…</div>
        <div class="saving-overlay-bar-track">
          <div class="saving-overlay-bar-fill" style="width:0%"></div>
        </div>
        <div class="saving-overlay-label">0 / ${total}</div>
        <div class="saving-overlay-file"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    return overlay;
  }

  updateSavingOverlay(overlay, done, total, currentFile) {
    if (!overlay) return;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    overlay.querySelector('.saving-overlay-bar-fill').style.width = `${pct}%`;
    overlay.querySelector('.saving-overlay-label').textContent = `${done} / ${total}`;
    overlay.querySelector('.saving-overlay-file').textContent = currentFile;
  }

  transitionOverlayToIntegrating(overlay) {
    if (!overlay) return;
    const title = overlay.querySelector('.saving-overlay-title');
    const barTrack = overlay.querySelector('.saving-overlay-bar-track');
    const label = overlay.querySelector('.saving-overlay-label');
    const fileEl = overlay.querySelector('.saving-overlay-file');
    if (title) title.textContent = 'Intégration à la bibliothèque…';
    if (barTrack) { barTrack.querySelector('.saving-overlay-bar-fill').style.width = '100%'; }
    if (label) label.textContent = '';
    if (fileEl) fileEl.textContent = '';
    overlay.classList.add('integrating');
  }

  async forceReloadMovies() {
    try {
      console.log('🔄 Rechargement forcé de la liste des films après classification');

      // Appeler la fonction de rechargement des films
      if (window.loadMoviesFromDatabase) {
        await window.loadMoviesFromDatabase();
      }

      if (window.loadMovies) {
        await window.loadMovies();
      }

      // Déclencher un événement personnalisé pour informer le dashboard
      const event = new CustomEvent('moviesUpdated');
      document.dispatchEvent(event);

    } catch (error) {
      console.error('❌ Erreur lors du rechargement:', error);
    }
  }

  // Ajouter un genre tag à une carte
  addGenreTag(card, genre) {
    const tagsList = card.querySelector('.genres-tags-list');
    if (!tagsList) return;

    // Vérifier si le genre n'est pas déjà ajouté
    const existingTags = Array.from(tagsList.querySelectorAll('.genre-tag'));
    if (existingTags.some(tag => tag.dataset.genre === genre)) {
      console.log('Genre déjà ajouté:', genre);
      return;
    }

    // Créer la pastille
    const tag = document.createElement('div');
    tag.className = 'genre-tag';
    tag.dataset.genre = genre;
    tag.innerHTML = `
      <span>${genre}</span>
      <button type="button" class="genre-tag-remove" title="Retirer">×</button>
    `;

    tagsList.appendChild(tag);

    // Mettre à jour le dropdown pour désactiver ce genre
    this.updateGenreDropdown(card);
  }

  // Mettre à jour le dropdown pour désactiver les genres déjà sélectionnés
  updateGenreDropdown(card) {
    const tagsList = card.querySelector('.genres-tags-list');
    const dropdown = card.querySelector('.genre-dropdown-menu');

    if (!tagsList || !dropdown) return;

    // Récupérer les genres déjà sélectionnés
    const selectedGenres = Array.from(tagsList.querySelectorAll('.genre-tag'))
      .map(tag => tag.dataset.genre);

    // Mettre à jour les options du dropdown
    const options = dropdown.querySelectorAll('.genre-dropdown-option');
    options.forEach(option => {
      const genre = option.dataset.genre;
      if (selectedGenres.includes(genre)) {
        option.classList.add('disabled');
      } else {
        option.classList.remove('disabled');
      }
    });
  }

  // ========================================
  // GESTION DES SAISONS ET SLOTS
  // ========================================

  async getSeasonsForSeries(seriesId) {
    // Récupérer les saisons depuis le backend
    try {
      const response = await window.electronAPI.getSeriesSeasons(seriesId);
      if (response && response.success && response.seasons) {
        // Filtrer la saison "Non assignés" (order = 0) et convertir au format attendu
        return response.seasons
          .filter(s => s.order !== 0) // Exclure "Non assignés"
          .map(s => ({
            number: s.seasonNumber || s.order,
            episodeCount: s.episodeRange ? (s.episodeRange.to - s.episodeRange.from + 1) : 0,
            name: s.name
          }));
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des saisons:', error);
    }
    return []; // Aucune saison par défaut
  }

  async saveSeasonsForSeries(seriesId, seasons) {
    // Convertir au format backend et sauvegarder
    const backendSeasons = seasons.map((s, index) => ({
      id: `season-${s.number}`,
      order: s.number,
      type: 'standard',
      name: s.name || `Saison ${s.number}`,
      seasonNumber: s.number,
      episodeRange: { from: 1, to: s.episodeCount },
      episodes: Array(s.episodeCount).fill(null)
    }));

    try {
      const response = await window.electronAPI.saveSeriesSeasons(seriesId, backendSeasons);
      if (response && response.success) {
        console.log('✅ Saisons sauvegardées');
        return true;
      } else {
        console.error('❌ Erreur lors de la sauvegarde:', response?.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des saisons:', error);
      return false;
    }
  }

  toggleSeasonZone(zoneElement) {
    const header = zoneElement.querySelector('.season-zone-header');
    const grid = zoneElement.querySelector('.season-slots-grid');
    const toggleBtn = header.querySelector('.btn-toggle-season');
    const icon = toggleBtn.querySelector('i');

    if (grid.style.display === 'none') {
      grid.style.display = 'flex';
      icon.className = 'fas fa-chevron-down';
      toggleBtn.dataset.expanded = 'true';
    } else {
      grid.style.display = 'none';
      icon.className = 'fas fa-chevron-right';
      toggleBtn.dataset.expanded = 'false';
    }
  }

  quickAddSeason(seriesId) {
    // Ouvrir le gestionnaire de saisons avec l'éditeur de nouvelle saison
    const seriesGroup = document.querySelector(`[data-series-id="${seriesId}"]`);
    const seriesName = seriesGroup ? seriesGroup.dataset.seriesName : 'Série inconnue';

    console.log(`🎬 Ouverture rapide du gestionnaire pour "${seriesName}"`);

    // Utiliser le gestionnaire de saisons existant
    if (window.seasonsManager) {
      // Ouvrir le modal
      window.seasonsManager.openModal(seriesId, seriesName);

      // Attendre que le modal soit ouvert, puis déclencher la création d'une nouvelle saison
      setTimeout(() => {
        window.seasonsManager.createNewSeason();
      }, 300);
    } else {
      console.error('❌ SeasonsManager non disponible');
      alert('Le gestionnaire de saisons n\'est pas disponible. Veuillez utiliser le bouton "Gérer les saisons".');
    }
  }

  async autoSortSeries(seriesId) {
    const files = this.currentFiles.filter(f => f.seriesId === seriesId);

    // Group files by detected season number (ignore nulls)
    const detectedSeasons = new Map();
    files.forEach(file => {
      const sNum = file.seasonNumber ?? null;
      if (sNum !== null) {
        if (!detectedSeasons.has(sNum)) detectedSeasons.set(sNum, []);
        detectedSeasons.get(sNum).push(file);
      }
    });

    if (detectedSeasons.size === 0) {
      window.showNotification('Tri automatique', 'Aucun numéro de saison détecté dans les noms de fichiers.', 'warning');
      return;
    }

    // Compare with existing DB seasons
    const existingSeasons = await this.getSeasonsForSeries(seriesId);
    const knownNumbers = new Set(existingSeasons.map(s => s.number));
    const newSeasonNumbers = [...detectedSeasons.keys()].filter(n => !knownNumbers.has(n));

    if (newSeasonNumbers.length === 0) {
      // Seasons already exist, just refresh to place episodes
      await this.refreshSeriesDisplay(seriesId);
      window.showNotification('Tri automatique', 'Les saisons existent déjà. Épisodes replacés.', 'info');
      return;
    }

    // Build new season entries: use max detected episode number as episode count
    const newSeasons = newSeasonNumbers.map(n => {
      const seasonFiles = detectedSeasons.get(n);
      const maxEpisode = Math.max(...seasonFiles.map(f => f.episodeNumber ?? 0), seasonFiles.length);
      return { number: n, episodeCount: maxEpisode, name: `Saison ${n}` };
    });

    const allSeasons = [...existingSeasons, ...newSeasons].sort((a, b) => a.number - b.number);

    const saved = await this.saveSeasonsForSeries(seriesId, allSeasons);
    if (!saved) {
      window.showNotification('Erreur', 'Impossible de créer les saisons automatiquement.', 'error');
      return;
    }

    await this.refreshSeriesDisplay(seriesId);
    window.showNotification('Tri automatique', `${newSeasonNumbers.length} saison(s) créée(s), épisodes placés automatiquement.`, 'success');
  }

  async addSlotToSeason(seriesId, seasonNumber) {
    try {
      const response = await window.electronAPI.getSeriesSeasons(seriesId);
      if (!response || !response.success) {
        alert('Erreur lors du chargement des saisons');
        return;
      }

      const seasons = response.seasons.filter(s => s.order !== 0);
      const season = seasons.find(s => s.seasonNumber === seasonNumber);

      if (season) {
        season.episodeRange.to++;
        season.episodes.push(null);

        const saveResponse = await window.electronAPI.saveSeriesSeasons(seriesId, seasons);

        if (saveResponse && saveResponse.success) {
          console.log(`✅ Slot ajouté à la saison ${seasonNumber}`);
          await this.refreshSeriesDisplay(seriesId);
        }
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      alert('Erreur lors de l\'ajout du slot');
    }
  }

  async removeSlotFromSeason(seriesId, seasonNumber) {
    try {
      const response = await window.electronAPI.getSeriesSeasons(seriesId);
      if (!response || !response.success) {
        alert('Erreur lors du chargement des saisons');
        return;
      }

      const seasons = response.seasons.filter(s => s.order !== 0);
      const season = seasons.find(s => s.seasonNumber === seasonNumber);

      if (season && season.episodeRange.to > season.episodeRange.from) {
        const lastSlotNumber = season.episodeRange.to;

        // Vérifier si le dernier slot contient un épisode
        const episodeInLastSlot = this.currentFiles.find(
          f => f.seriesId === seriesId && f.seasonNumber === seasonNumber && f.episodeNumber === lastSlotNumber
        );

        if (episodeInLastSlot) {
          if (!confirm(`Le slot ${lastSlotNumber} contient un épisode. Il sera renvoyé dans "Non assignés". Continuer?`)) {
            return;
          }

          // Retirer l'assignation
          episodeInLastSlot.seasonNumber = null;
          episodeInLastSlot.episodeNumber = null;
        }

        // Retirer le slot
        season.episodeRange.to--;
        season.episodes.pop();

        const saveResponse = await window.electronAPI.saveSeriesSeasons(seriesId, seasons);

        if (saveResponse && saveResponse.success) {
          console.log(`✅ Slot retiré de la saison ${seasonNumber}`);
          await this.refreshSeriesDisplay(seriesId);
        }
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      alert('Erreur lors du retrait du slot');
    }
  }

  async refreshSeriesDisplay(seriesId) {
    // Cibler spécifiquement le .series-group (et non une season-zone ou seasons-container)
    const seriesGroup = document.querySelector(`.series-group[data-series-id="${seriesId}"]`);
    if (!seriesGroup) return;

    // Trouver l'élément qui scrolle réellement
    // Essayer plusieurs possibilités
    let scrollContainer = null;
    let scrollPosition = 0;

    const galleryModal = document.getElementById('gallery-modal');
    if (galleryModal) {
      const modalBody = galleryModal.querySelector('.import-modal-body');
      const galleryContainer = document.getElementById('gallery-container');

      // Déterminer quel élément a du scroll
      if (modalBody && modalBody.scrollTop > 0) {
        scrollContainer = modalBody;
        scrollPosition = modalBody.scrollTop;
        console.log(`📍 Scroll détecté sur .import-modal-body: ${scrollPosition}px`);
      } else if (galleryContainer && galleryContainer.scrollTop > 0) {
        scrollContainer = galleryContainer;
        scrollPosition = galleryContainer.scrollTop;
        console.log(`📍 Scroll détecté sur #gallery-container: ${scrollPosition}px`);
      } else if (modalBody) {
        scrollContainer = modalBody;
        scrollPosition = modalBody.scrollTop;
        console.log(`📍 Utilisation de .import-modal-body par défaut: ${scrollPosition}px`);
      }
    }

    // Récupérer les données de la série
    const seriesData = {
      seriesId: seriesId,
      seriesName: seriesGroup.dataset.seriesName,
      files: this.currentFiles.filter(f => f.seriesId === seriesId)
    };

    // Supprimer l'ancien conteneur de saisons
    const oldContainer = seriesGroup.querySelector('.seasons-container');
    if (oldContainer) {
      oldContainer.remove();
    }

    // Recréer le conteneur
    await this.renderSeasonsForSeries(seriesGroup, seriesData);

    // Restaurer la position de scroll après un court délai (pour laisser le DOM se mettre à jour)
    if (scrollContainer) {
      setTimeout(() => {
        scrollContainer.scrollTop = scrollPosition;
        console.log(`📍 Scroll restauré à ${scrollPosition}px sur`, scrollContainer.className || scrollContainer.id);
      }, 100);
    }
  }

  // ========================================
  // DRAG & DROP
  // ========================================

  onEpisodeDragStart(event, file) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify({
      fileId: file.id || file.path,
      seriesId: file.seriesId,
      currentSeasonNumber: file.seasonNumber,
      currentEpisodeNumber: file.episodeNumber
    }));

    // Ajouter une classe visuelle
    event.target.classList.add('dragging');
  }

  onEpisodeDragEnd(event) {
    event.target.classList.remove('dragging');
  }

  onSlotDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
  }

  onSlotDragLeave(event) {
    // Ne retirer la classe que si on quitte vraiment le slot (pas un enfant)
    if (!event.currentTarget.contains(event.relatedTarget)) {
      event.currentTarget.classList.remove('drag-over');
    }
  }

  onSlotDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const dragData = JSON.parse(event.dataTransfer.getData('application/json'));
    const targetSlot = event.currentTarget;

    const targetSeriesId = targetSlot.dataset.seriesId;
    const targetSeasonNumber = targetSlot.dataset.seasonNumber === 'unassigned' ? null : parseInt(targetSlot.dataset.seasonNumber);
    const targetSlotNumber = targetSlot.dataset.slotNumber === 'auto' ? null : parseInt(targetSlot.dataset.slotNumber);

    // Trouver le fichier dragué
    const draggedFile = this.currentFiles.find(
      f => (f.id || f.path) === dragData.fileId
    );

    if (!draggedFile) {
      console.error('Fichier dragué introuvable');
      return;
    }

    // Vérifier si le slot cible contient déjà un épisode
    const targetFile = this.currentFiles.find(
      f => f.seriesId === targetSeriesId &&
           f.seasonNumber === targetSeasonNumber &&
           f.episodeNumber === targetSlotNumber
    );

    if (targetFile) {
      // Swap: échanger les deux épisodes
      const tempSeason = draggedFile.seasonNumber;
      const tempEpisode = draggedFile.episodeNumber;

      draggedFile.seasonNumber = targetFile.seasonNumber;
      draggedFile.episodeNumber = targetFile.episodeNumber;

      targetFile.seasonNumber = tempSeason;
      targetFile.episodeNumber = tempEpisode;
    } else {
      // Déplacer simplement
      draggedFile.seasonNumber = targetSeasonNumber;
      draggedFile.episodeNumber = targetSlotNumber;
    }

    // Rafraîchir l'affichage
    this.refreshSeriesDisplay(targetSeriesId);

    console.log(`✅ Épisode déplacé vers Saison ${targetSeasonNumber || 'Non assignés'}, Épisode ${targetSlotNumber || 'auto'}`);
  }
}

// Créer l'instance globale
window.importClassificationSystem = new ImportClassificationSystem();

// Export pour utilisation dans d'autres modules
window.startClassification = (files, scanType) => {
  window.importClassificationSystem.startClassification(files, scanType);
};

console.log('🎬 Système de classification avancé initialisé');