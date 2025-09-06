// import-classification.js - Système de classification avancé des médias avec séries

class ImportClassificationSystem {
  constructor() {
    this.importModal = null;
    this.detailsModal = null;
    this.seriesModal = null;
    this.currentFiles = [];
    this.classifiedFiles = [];
    this.categories = [];
    this.series = [];
    this.currentFileIndex = 0;
    this.isProcessing = false;
    
    this.init();
  }

  async init() {
    console.log('🎬 Initialisation du système de classification');
    
    // Références aux modales
    this.importModal = document.getElementById('import-modal');
    this.detailsModal = document.getElementById('details-classification-modal');
    this.seriesModal = document.getElementById('new-series-modal');
    
    // Charger les données
    await this.loadCategories();
    await this.loadSeries();
    
    // Attacher les événements
    this.attachEventListeners();
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
      if (result.success) {
        this.series = result.series;
        console.log('📺 Séries chargées:', this.series.length);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des séries:', error);
    }
  }

  attachEventListeners() {
    // Événements de la modal de classification détaillée
    if (this.detailsModal) {
      const categorySelect = document.getElementById('detail-category');
      const seriesSelect = document.getElementById('detail-series');
      const newSeriesBtn = document.getElementById('new-series-btn');
      const saveBtn = document.getElementById('save-file-btn');
      const skipBtn = document.getElementById('skip-file-btn');

      if (categorySelect) {
        categorySelect.addEventListener('change', (e) => this.onCategoryChange(e.target.value));
      }

      if (newSeriesBtn) {
        newSeriesBtn.addEventListener('click', () => this.showNewSeriesModal());
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveCurrentFile());
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', () => this.skipCurrentFile());
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

  // Démarrer le processus de classification (appelé depuis dashboard.js)
  async startClassification(files, scanType) {
    console.log(`🎯 Démarrage de la classification: ${files.length} fichiers (${scanType})`);
    
    this.currentFiles = files.map((file, index) => ({
      ...file,
      originalIndex: index,
      classified: false
    }));
    this.classifiedFiles = [];
    this.currentFileIndex = 0;

    // Commencer directement par la classification détaillée du premier fichier
    this.showDetailsModal();
  }

  showDetailsModal() {
    if (this.currentFileIndex >= this.currentFiles.length) {
      // Tous les fichiers ont été traités
      this.completeClassification();
      return;
    }

    const currentFile = this.currentFiles[this.currentFileIndex];
    console.log(`📝 Classification du fichier: ${currentFile.name}`);

    // Remplir les informations du fichier
    document.getElementById('detail-file-name').textContent = currentFile.name;
    
    // Pré-remplir le titre (sans extension)
    const titleInput = document.getElementById('detail-title');
    if (titleInput) {
      titleInput.value = currentFile.title || currentFile.name;
    }

    // Remplir les catégories
    this.populateCategorySelect();
    
    // Remplir les séries
    this.populateSeriesSelect();
    
    // Réinitialiser le formulaire
    this.resetDetailsForm();
    
    // Afficher la modal
    this.detailsModal.style.display = 'flex';
  }

  populateCategorySelect() {
    const categorySelect = document.getElementById('detail-category');
    if (!categorySelect) return;

    categorySelect.innerHTML = '<option value="">Sélectionner une catégorie</option>';
    
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id || category.name;
      option.textContent = `${category.icon} ${category.name}`;
      categorySelect.appendChild(option);
    });
  }

  populateSeriesSelect() {
    const seriesSelect = document.getElementById('detail-series');
    if (!seriesSelect) return;

    seriesSelect.innerHTML = '<option value="">Sélectionner une série</option>';
    
    this.series.forEach(serie => {
      const option = document.createElement('option');
      option.value = serie.id;
      option.textContent = serie.name;
      seriesSelect.appendChild(option);
    });
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

  resetDetailsForm() {
    const form = document.querySelector('.details-form');
    if (!form) return;

    // Réinitialiser tous les champs sauf le titre et le nom de fichier
    const inputs = form.querySelectorAll('input:not(#detail-title), select, textarea');
    inputs.forEach(input => {
      if (input.type === 'number') {
        input.value = '';
      } else {
        input.value = '';
      }
    });

    // Masquer la section série par défaut
    const seriesSection = document.getElementById('series-section');
    if (seriesSection) {
      seriesSection.style.display = 'none';
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

      const result = await window.electronAPI.saveClassifiedFile({
        filePath: currentFile.path,
        title: formData.title,
        category: formData.category,
        description: formData.description,
        releaseDate: formData.releaseDate,
        year: formData.year,
        seriesId: formData.seriesId,
        season_number: formData.seasonNumber,
        episode_number: formData.episodeNumber
      });

      if (result.success) {
        console.log('✅ Fichier sauvegardé avec succès');
        this.currentFiles[this.currentFileIndex].classified = true;
        this.classifiedFiles.push(currentFile);
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
    return {
      title: document.getElementById('detail-title')?.value || '',
      category: document.getElementById('detail-category')?.value || 'unsorted',
      description: document.getElementById('detail-description')?.value || '',
      releaseDate: document.getElementById('detail-release-date')?.value || '',
      year: parseInt(document.getElementById('detail-year')?.value) || null,
      seriesId: document.getElementById('detail-series')?.value || null,
      seasonNumber: parseInt(document.getElementById('detail-season')?.value) || null,
      episodeNumber: parseInt(document.getElementById('detail-episode')?.value) || null
    };
  }

  validateFormData(formData) {
    if (!formData.title.trim()) {
      alert('Le titre est obligatoire');
      return false;
    }

    if (!formData.category) {
      alert('La catégorie est obligatoire');
      return false;
    }

    // Si c'est une série, vérifier les champs obligatoires
    if (formData.category === 'series') {
      if (!formData.seriesId) {
        alert('Veuillez sélectionner ou créer une série');
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
        
        // Mettre à jour le select des séries
        this.populateSeriesSelect();
        
        // Sélectionner automatiquement la nouvelle série
        const seriesSelect = document.getElementById('detail-series');
        if (seriesSelect) {
          seriesSelect.value = result.id;
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
    
    alert(message);
    
    // Recharger la liste des films pour afficher les nouveaux
    if (typeof loadMovies === 'function') {
      loadMovies();
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