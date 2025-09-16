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
  async startClassification(files, scanType) {
    console.log(`🎯 Démarrage de la classification: ${files.length} fichiers (${scanType})`);

    // Marquer comme en cours d'import pour éviter les mises à jour du dashboard
    this.isImporting = true;

    // Sauvegarder les IDs des fichiers nouvellement scannés pour pouvoir les supprimer si annulé
    this.newlyScannedIds = files.map(file => file.id).filter(id => id);

    this.currentFiles = files.map((file, index) => ({
      ...file,
      originalIndex: index,
      classified: false
    }));
    this.classifiedFiles = [];
    this.currentFileIndex = 0;

    console.log('📋 IDs des fichiers nouvellement scannés:', this.newlyScannedIds);

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
    const template = document.getElementById('gallery-card-template');

    if (!galleryContainer || !template) {
      console.error('❌ Éléments de la galerie introuvables');
      return;
    }

    // Vider le conteneur
    galleryContainer.innerHTML = '';

    // Mettre à jour les statistiques
    galleryCount.textContent = `${this.currentFiles.length} fichiers`;
    galleryProgress.textContent = '0 classifiés';

    // Ajouter chaque fichier à la galerie
    this.currentFiles.forEach((file, index) => {
      const card = template.content.cloneNode(true).querySelector('.gallery-card');

      // Configurer les attributs de la carte
      card.dataset.fileIndex = index;

      // Remplir les informations du fichier
      const fileName = card.querySelector('.file-name');
      const fileDuration = card.querySelector('.file-duration');
      const titleInput = card.querySelector('.title-input');
      const categoryBadge = card.querySelector('.category-badge');

      fileName.textContent = file.name;
      fileDuration.textContent = file.duration ? this.formatDuration(file.duration) : '--:--';

      // Debug pour voir les valeurs
      console.log(`🔍 Remplissage carte ${index}:`, {
        fileName: file.name,
        fileTitle: file.title,
        triageType: file.triageType
      });

      titleInput.value = file.title || file.name;
      console.log(`📝 titleInput.value défini à: "${titleInput.value}"`);

      // Ajouter le nom du fichier comme data attribute pour backup
      card.setAttribute('data-file-name', file.name || '');

      // Afficher le badge de catégorie
      if (categoryBadge && file.triageType) {
        const categoryNames = {
          'film': '🎬 Film',
          'series': '📺 Série',
          'short': '🎞️ Court',
          'other': '📁 Autre',
          'unsorted': '❓ Non trié'
        };
        categoryBadge.textContent = categoryNames[file.triageType] || file.triageType;
        categoryBadge.className = `category-badge ${file.triageType}`;
      }

      // Afficher automatiquement les champs série si c'est une série
      if (file.triageType === 'series') {
        const seriesFields = card.querySelector('.series-fields');
        if (seriesFields) {
          seriesFields.style.display = 'block';
        }

        // Remplir le nom de la série (lecture seule)
        const seriesNameInput = card.querySelector('.series-name-readonly');
        if (seriesNameInput && file.seriesName) {
          seriesNameInput.value = file.seriesName;
        }
      }

      // Ajouter la carte au conteneur
      galleryContainer.appendChild(card);
    });
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

      if (e.target.classList.contains('save-btn')) {
        this.saveGalleryCard(card);
      } else if (e.target.classList.contains('skip-btn')) {
        this.skipGalleryCard(card);
      } else if (e.target.classList.contains('new-series-btn')) {
        this.showNewSeriesModal();
      }
    });

    // Boutons d'application globale (série et année seulement)
    const applyGlobalSeriesBtn = document.getElementById('apply-global-series');
    const applyGlobalYearBtn = document.getElementById('apply-global-year');
    const globalNewSeriesBtn = document.getElementById('global-new-series');

    if (applyGlobalSeriesBtn) {
      applyGlobalSeriesBtn.addEventListener('click', () => this.applyGlobalSeries());
    }

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

    // Bouton Annuler
    const cancelBtn = document.getElementById('cancel-import-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelImport());
    }

    // Bouton Retour
    const backBtn = document.getElementById('back-to-triage-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.backToTriage());
    }

    // Clic à l'extérieur de la modal équivaut à annuler
    if (this.galleryModal) {
      this.galleryModal.addEventListener('click', (e) => {
        if (e.target === this.galleryModal) {
          this.cancelImport();
        }
      });
    }

    if (this.importModal) {
      this.importModal.addEventListener('click', (e) => {
        if (e.target === this.importModal) {
          this.cancelImport();
        }
      });
    }
  }


  applyGlobalSeries() {
    // Cette fonction n'est plus nécessaire car les séries sont définies en Phase 1 (triage)
    console.log('ℹ️ Les séries sont maintenant définies lors du triage (Phase 1) et ne peuvent plus être modifiées en Phase 2');
    alert('Les séries sont définies lors du triage initial et ne peuvent pas être modifiées ici.');
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

    seriesSelect.innerHTML = '<option value="">Sélectionner une série</option>';

    if (this.series && Array.isArray(this.series)) {
      this.series.forEach(serie => {
        const option = document.createElement('option');
        option.value = serie.id;
        option.textContent = serie.name;
        seriesSelect.appendChild(option);
      });
    }
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
        description: '',
        releaseDate: null,
        year: formData.year || null,
        seriesId: formData.seriesId || null,
        seriesName: formData.seriesName || null,
        season_number: formData.seasonNumber || null,
        episode_number: formData.episodeNumber || null
      };

      console.log('📤 Envoi des données de sauvegarde:', saveData);
      const result = await window.electronAPI.saveClassifiedFile(saveData);
      console.log('📥 Résultat de sauvegarde:', result);

      if (result.success) {
        console.log('✅ Fichier sauvegardé avec succès');

        // Marquer comme sauvegardé
        this.markCardAsSaved(card, fileIndex);
        this.updateGalleryProgress();

      } else {
        console.error('❌ Erreur lors de la sauvegarde:', result.message);
        alert('Erreur lors de la sauvegarde: ' + result.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
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

    const result = {
      title: title.trim(),
      category: category,
      mediaType: file?.mediaType || (category === 'series' ? 'series' : 'unique'),
      year: parseInt(card.querySelector('.year-input')?.value) || null,
      seriesId: file?.seriesId || null,
      seriesName: file?.seriesName || null,
      seasonNumber: parseInt(card.querySelector('.season-input')?.value) || null,
      episodeNumber: parseInt(card.querySelector('.episode-input')?.value) || null
    };

    console.log(`   - Données finales:`, result);
    return result;
  }

  validateGalleryCardData(formData, card) {
    if (!formData.title || !formData.title.trim()) {
      alert('Le titre est obligatoire');
      card.querySelector('.title-input')?.focus();
      return false;
    }

    // La catégorie est maintenant définie en phase 1, pas besoin de validation supplémentaire

    if (formData.category === 'series' && (!formData.seriesId || formData.seriesId === '')) {
      alert('Erreur: aucune série définie. Veuillez revenir au triage pour sélectionner une série.');
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

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];

      try {
        const result = await window.electronAPI.saveClassifiedFile({
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
        });

        if (result.success) {
          file.classified = true;
          this.classifiedFiles.push(file);
        }
      } catch (error) {
        console.error('❌ Erreur pour', file.name, ':', error);
      }
    }

    this.finishGalleryClassification();
  }

  async finishGalleryClassification() {
    console.log('🎉 Finalisation de la classification galerie...');

    // Sauvegarder automatiquement tous les fichiers non encore sauvegardés
    const pendingFiles = this.currentFiles.filter(f => !f.classified && !f.skipped);

    console.log(`💾 Sauvegarde automatique de ${pendingFiles.length} fichiers restants`);

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];

      try {
        // Trouver la carte correspondante
        const card = document.querySelector(`[data-file-index="${this.currentFiles.indexOf(file)}"]`);
        if (card) {
          const fileName = file.name || file.title || file.path || 'Fichier inconnu';
          console.log(`💾 Sauvegarde automatique de: ${fileName}`);

          // Récupérer les données de la carte
          const formData = this.getGalleryCardData(card);

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
            console.log(`✅ ${fileName} sauvegardé automatiquement avec catégorie: ${formData.category}`);
          } else {
            console.error(`❌ Erreur lors de la sauvegarde automatique de ${fileName}:`, result.message);
          }
        }
      } catch (error) {
        const fileName = file.name || file.title || file.path || 'Fichier inconnu';
        console.error('❌ Erreur pour', fileName, ':', error);
      }
    }

    console.log('🎉 Classification galerie terminée!');

    // Marquer la fin de l'import
    this.isImporting = false;

    // Fermer la modal
    this.galleryModal.style.display = 'none';

    // Afficher les résultats
    const classifiedCount = this.classifiedFiles.length;
    const totalCount = this.currentFiles.length;
    const skippedCount = this.currentFiles.filter(f => f.skipped).length;

    let message = `Classification terminée!\n`;
    message += `📁 ${classifiedCount} fichiers classifiés\n`;
    if (skippedCount > 0) {
      message += `⏭️ ${skippedCount} fichiers passés\n`;
    }
    message += `\nLes fichiers ont été ajoutés à votre bibliothèque.`;

    // Recharger les films
    this.forceReloadMovies();

    setTimeout(() => {
      alert(message);
    }, 500);
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
        season_number: formData.seasonNumber || null,
        episode_number: formData.episodeNumber || null
      };

      console.log('🔍 Données API:', saveData);

      const result = await window.electronAPI.saveClassifiedFile(saveData);

      if (result.success) {
        console.log('✅ Fichier sauvegardé avec succès');

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
    this.seriesModal.style.display = 'flex';
    
    // Focus sur le champ nom
    const nameInput = document.getElementById('new-series-name');
    if (nameInput) {
      setTimeout(() => nameInput.focus(), 100);
    }
  }

  hideNewSeriesModal() {
    this.seriesModal.style.display = 'none';

    // Nettoyer les champs
    document.getElementById('new-series-name').value = '';
    document.getElementById('new-series-description').value = '';
  }

  async cancelImport() {
    // Afficher une confirmation avant d'annuler
    const isConfirmed = confirm('Êtes-vous sûr de vouloir annuler l\'importation ? Toutes les données non sauvegardées seront perdues.');

    if (isConfirmed) {
      console.log('❌ Annulation de l\'importation par l\'utilisateur');

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
    }
  }

  backToTriage() {
    console.log('🔙 Retour vers la phase de triage');

    // Fermer la modal galerie (phase 2)
    if (this.galleryModal) {
      this.galleryModal.style.display = 'none';
    }

    // Réouvrir la modal de triage (phase 1)
    if (this.importModal) {
      this.importModal.style.display = 'flex';
    }

    // IMPORTANT: Ne pas réinitialiser this.currentFiles car on veut garder les médias
    // Seulement réinitialiser les états de classification pour permettre une nouvelle classification
    this.currentFiles.forEach(file => {
      file.classified = false;
      file.skipped = false;
    });
    this.classifiedFiles = [];

    // Garder l'état d'import actif car on revient juste en arrière
    // this.isImporting reste true
  }

  async cleanupPartialImport() {
    console.log('🧹 Nettoyage des données d\'import partielles');

    if (this.newlyScannedIds && this.newlyScannedIds.length > 0) {
      console.log(`🗑️ Suppression de ${this.newlyScannedIds.length} fichiers nouvellement scannés`);

      try {
        // Supprimer chaque fichier nouvellement scanné de la base de données
        for (const movieId of this.newlyScannedIds) {
          console.log(`🗑️ Suppression du média ${movieId}`);
          const result = await window.electronAPI.deleteMovie(movieId);
          if (result.success) {
            console.log(`✅ Média ${movieId} supprimé avec succès`);
          } else {
            console.error(`❌ Erreur lors de la suppression du média ${movieId}:`, result.message);
          }
        }

        // Recharger la liste des films pour refléter les suppressions
        this.forceReloadMovies();

      } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
      }
    }

    // Réinitialiser la liste des IDs nouvellement scannés
    this.newlyScannedIds = [];
  }

  async createNewSeries() {
    const name = document.getElementById('new-series-name')?.value?.trim();
    const description = document.getElementById('new-series-description')?.value?.trim();

    if (!name) {
      alert('Le nom de la série est obligatoire');
      return;
    }

    try {
      console.log('📺 Création de la série:', name);
      
      const result = await window.electronAPI.createSeries({
        name: name,
        description: description
      });

      if (result.success) {
        console.log('✅ Série créée avec succès, ID:', result.id);
        
        // Ajouter la série à la liste locale
        const newSeries = {
          id: result.id,
          name: name,
          description: description
        };
        this.series.push(newSeries);
        
        // Mettre à jour les selects des séries (modal détails + contrôles globaux)
        this.populateSeriesSelect();
        this.populateSeriesSelect(document.getElementById('global-series-select'));

        // Mettre à jour aussi tous les selects des cartes galerie
        const allSeriesSelects = document.querySelectorAll('.gallery-card .series-select');
        allSeriesSelects.forEach(select => {
          this.populateSeriesSelect(select);
        });


        // Sélectionner aussi dans les contrôles globaux
        const globalSeriesSelect = document.getElementById('global-series-select');
        if (globalSeriesSelect) {
          globalSeriesSelect.value = result.id;
        }
        
        // Fermer la modal
        this.hideNewSeriesModal();
      } else {
        console.error('❌ Erreur lors de la création de la série:', result.message);
        alert('Erreur lors de la création de la série: ' + result.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la création de la série:', error);
      alert('Erreur lors de la création de la série: ' + error.message);
    }
  }

  completeClassification() {
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

    // Recharger les films MAINTENANT (à la fin seulement)
    this.forceReloadMovies();

    setTimeout(() => {
      alert(message);
    }, 500);
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
}

// Créer l'instance globale
window.importClassificationSystem = new ImportClassificationSystem();

// Export pour utilisation dans d'autres modules
window.startClassification = (files, scanType) => {
  window.importClassificationSystem.startClassification(files, scanType);
};

console.log('🎬 Système de classification avancé initialisé');