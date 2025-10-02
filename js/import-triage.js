// import-triage.js - Système de tri initial des médias importés

class ImportTriageSystem {
  constructor() {
    this.triageModal = null;
    this.currentFiles = [];
    this.processedFiles = [];
    this.isProcessing = false;
    this.series = []; // Liste des séries disponibles
    this.newlyScannedIds = []; // IDs des fichiers nouvellement scannés (pour nettoyage si annulé)

    this.init();
  }

  async init() {
    console.log('📋 Initialisation du système de tri des médias');

    // Référence à la modale de tri
    this.triageModal = document.getElementById('import-triage-modal');

    // Charger les séries
    await this.loadSeries();

    // Attacher les événements
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Bouton "Tout passer (médias non triés)"
    const skipAllBtn = document.getElementById('skip-all-triage-btn');
    if (skipAllBtn) {
      skipAllBtn.addEventListener('click', () => this.skipAllFiles());
    }

    // Bouton "Valider et continuer la classification"
    const validateBtn = document.getElementById('validate-triage-btn');
    if (validateBtn) {
      validateBtn.addEventListener('click', () => this.validateAndContinue());
    }

    // Bouton d'application globale de type
    const applyGlobalTypeBtn = document.getElementById('apply-global-triage-type');
    if (applyGlobalTypeBtn) {
      applyGlobalTypeBtn.addEventListener('click', () => this.applyGlobalTriageType());
    }

    // Bouton d'application groupée de série
    const batchApplySeriesBtn = document.getElementById('batch-apply-series');
    if (batchApplySeriesBtn) {
      batchApplySeriesBtn.addEventListener('click', () => this.applyBatchSeries());
    }

    // Bouton nouvelle série dans la section groupée
    const newSeriesBatchBtn = document.getElementById('new-series-batch-btn');
    if (newSeriesBatchBtn) {
      newSeriesBatchBtn.addEventListener('click', () => this.showNewSeriesModal());
    }

    // Empêcher la fermeture automatique en cliquant à l'extérieur
    if (this.triageModal) {
      this.triageModal.addEventListener('click', (e) => {
        if (e.target === this.triageModal) {
          // Afficher la confirmation d'annulation au lieu de fermer directement
          this.showCancelConfirmation();
        }
      });
    }

    // Bouton d'annulation d'import
    const cancelImportBtn = document.getElementById('cancel-import-btn');
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener('click', () => this.showCancelConfirmation());
    }
  }

  // Démarrer le processus de tri (appelé depuis dashboard.js)
  async startTriage(files, scanType) {
    console.log('═══════════════════════════════════════');
    console.log(`📋 DÉBUT startTriage: ${files.length} fichiers (${scanType})`);
    console.log('═══════════════════════════════════════');

    console.log('📂 Fichiers à traiter:', files.map(f => ({
      name: f.name || f.title,
      path: f.path,
      size: f.size_bytes || f.size,
      duration: f.duration
    })));

    // Afficher la modale IMMÉDIATEMENT avec un état de chargement
    console.log('⏳ Tentative d\'affichage de la modale...');
    this.showTriageModal();
    console.log('⏳ Affichage de l\'état de chargement...');
    this.showLoadingState(`Analyse de ${files.length} fichiers...`);
    console.log('✅ Modale et état de chargement configurés');

    // Réinitialiser la liste des IDs nouvellement scannés
    this.newlyScannedIds = files.map(file => file.id).filter(id => id);
    console.log('📋 IDs des fichiers existants à tracker:', this.newlyScannedIds);

    // Filtrer pour ne garder que les nouveaux fichiers
    console.log('🔍 Filtrage des nouveaux fichiers...');
    const newFiles = await this.filterNewFiles(files);

    // Utiliser SEULEMENT les nouveaux fichiers
    let filesToProcess = newFiles;

    console.log(`✅ Processus de triage: ${filesToProcess.length} fichiers nouveaux à traiter`);

    if (filesToProcess.length === 0) {
      const alreadyImportedCount = files.length - newFiles.length;
      console.log(`⚠️ Aucun fichier à traiter: ${files.length} totaux, ${newFiles.length} nouveaux, ${alreadyImportedCount} déjà importés`);

      // Fermer la modale avant d'afficher le message
      this.hideTriageModal();

      // SÉCURITÉ : En cas de problème de filtrage, permettre un mode de récupération
      if (files.length > 0) {
        console.log('🚨 Mode de récupération: le filtrage semble trop strict');
        const forceProcess = confirm(`Le filtrage automatique n'a trouvé aucun nouveau fichier.\n\nVoulez-vous forcer l'import de ${files.length} fichiers ?`);
        if (forceProcess) {
          console.log('🔄 Mode forcé activé');
          filesToProcess = [...files];
          // Réafficher la modale
          this.showTriageModal();
        } else {
          return;
        }
      } else {
        alert('Aucun fichier trouvé.');
        return;
      }
    }

    // Info de débogage
    console.log(`📋 Résultat: ${files.length} fichiers totaux, ${newFiles.length} nouveaux à traiter`);

    this.skippedFilesCount = files.length - filesToProcess.length;

    this.currentFiles = filesToProcess.map((file, index) => ({
      ...file,
      originalIndex: index,
      triageType: 'unsorted', // Type par défaut
      action: 'classify' // 'classify' ou 'skip'
    }));

    // Remplir la modale de tri (elle est déjà affichée)
    this.populateTriageModal();
    this.hideLoadingState();
  }

  // Filtrer les fichiers pour ne garder que ceux pas encore importés
  async filterNewFiles(files) {
    const newFiles = [];

    console.log('🔍 Vérification des fichiers déjà importés...');
    console.log('📂 Fichiers à vérifier:', files.map(f => ({ name: f.name, path: f.path })));

    // Récupérer la liste des films déjà importés (TOUS les médias, y compris non triés)
    let existingMovies = [];
    try {
      const result = await window.electronAPI.getAllMedias();
      if (result.success) {
        existingMovies = result.movies || [];
        console.log(`📚 ${existingMovies.length} médias existants trouvés dans la base`);

        // Debug détaillé : afficher les catégories des médias existants
        const categoriesCount = {};
        existingMovies.forEach(movie => {
          const category = movie.category || 'undefined';
          categoriesCount[category] = (categoriesCount[category] || 0) + 1;
        });
        console.log('📊 Répartition par catégorie:', categoriesCount);

      } else {
        console.log('📚 Aucun film existant trouvé ou erreur API');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des films existants:', error);
      // En cas d'erreur, on considère tous les fichiers comme nouveaux
      console.log('🔄 En cas d\'erreur, tous les fichiers seront considérés comme nouveaux');
      return [...files];
    }

    // Créer un Set des chemins de fichiers déjà importés pour une recherche rapide
    const existingPaths = new Set();
    existingMovies.forEach(movie => {
      if (movie.path) {
        // Normaliser le chemin pour la comparaison
        const normalizedPath = movie.path.replace(/\\/g, '/').toLowerCase();
        existingPaths.add(normalizedPath);
      }
    });

    console.log(`📚 ${existingPaths.size} chemins uniques dans la base de données`);

    // Debug: afficher quelques exemples de chemins existants
    const pathSamples = Array.from(existingPaths).slice(0, 3);
    if (pathSamples.length > 0) {
      console.log('🔍 Exemples de chemins existants:', pathSamples);
    }

    for (const file of files) {
      try {
        // Normaliser le chemin du fichier pour la comparaison
        const originalPath = file.path;
        if (!originalPath) {
          console.log(`⚠️ Fichier sans chemin ignoré: ${file.name}`);
          continue;
        }

        const normalizedFilePath = originalPath.replace(/\\/g, '/').toLowerCase();

        console.log(`🔍 Vérification: "${file.name}"`);
        console.log(`   Chemin original: "${originalPath}"`);
        console.log(`   Chemin normalisé: "${normalizedFilePath}"`);

        const isAlreadyImported = existingPaths.has(normalizedFilePath);
        console.log(`🎯 Résultat: ${isAlreadyImported ? 'DÉJÀ IMPORTÉ' : 'NOUVEAU'}`);

        if (!isAlreadyImported) {
          newFiles.push(file);
          console.log(`✅ Nouveau fichier ajouté: ${file.name}`);
        } else {
          console.log(`⏭️ Fichier déjà importé ignoré: ${file.name}`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la vérification de ${file.name}:`, error);
        // En cas d'erreur, on considère le fichier comme nouveau pour éviter de le perdre
        newFiles.push(file);
        console.log(`🔄 Fichier ajouté par sécurité: ${file.name}`);
      }
    }

    console.log(`📋 Résultat final: ${newFiles.length} nouveaux fichiers sur ${files.length} total`);
    console.log('📂 Nouveaux fichiers:', newFiles.map(f => f.name));
    return newFiles;
  }

  populateTriageModal() {
    const tableBody = document.getElementById('triage-table-body');
    const countElement = document.getElementById('triage-count');
    const template = document.getElementById('triage-row-template');

    if (!tableBody || !template) {
      console.error('❌ Éléments de la modale de tri introuvables');
      return;
    }

    // Vider le tableau
    tableBody.innerHTML = '';
    
    // Mettre à jour le compteur avec info sur les fichiers filtrés
    let countText = `${this.currentFiles.length} nouveau(x) fichier(s)`;
    if (this.skippedFilesCount > 0) {
      countText += ` (${this.skippedFilesCount} déjà importé(s))`;
    }
    countElement.textContent = countText;

    // Ajouter chaque fichier au tableau
    this.currentFiles.forEach((file, index) => {
      const row = template.content.cloneNode(true).querySelector('.import-row');
      
      // Configurer les attributs de la ligne
      row.dataset.fileIndex = index;
      
      // Image de prévisualisation (miniature par défaut)
      const thumbnail = row.querySelector('.thumbnail-preview');
      thumbnail.src = '../public/img/default-thumbnail.svg';
      thumbnail.alt = file.title || file.name;
      
      // Nom du fichier
      row.querySelector('.filename-title').textContent = file.title || file.name;
      row.querySelector('.filename-path').textContent = file.path || '';
      
      // Durée
      row.querySelector('.duration-value').textContent = file.duration ? 
        this.formatDuration(file.duration) : '--:--:--';
      
      // Taille
      row.querySelector('.size-value').textContent = file.formattedSize || '--';
      
      // Sélecteur de type
      const typeSelector = row.querySelector('.type-selector');
      typeSelector.value = file.triageType || 'unsorted';

      // Éléments pour le mode de tri et les séries
      const sortModeInput = row.querySelector('.sort-mode-input');
      const seriesFields = row.querySelector('.series-fields');
      const seriesSelector = row.querySelector('.series-name-selector');
      const newSeriesBtn = row.querySelector('.new-series-btn');
      const validationError = row.querySelector('.validation-error');

      // Initialiser les séries dans le sélecteur
      this.populateSeriesSelector(seriesSelector);

      // Événement sur le sélecteur de type
      typeSelector.addEventListener('change', (e) => {
        const newType = e.target.value;
        this.currentFiles[index].triageType = newType;
        this.updateSortMode(row, index, newType);
        console.log(`🏷️ Type modifié pour ${file.name}: ${newType}`);
      });

      // Événement sur le sélecteur de série
      if (seriesSelector) {
        seriesSelector.addEventListener('change', (e) => {
          const seriesId = e.target.value;
          this.currentFiles[index].seriesId = seriesId;
          this.currentFiles[index].seriesName = seriesId ?
            this.series.find(s => s.id == seriesId)?.name : '';
          this.hideValidationError(row);
          console.log(`📺 Série sélectionnée pour ${file.name}: ${this.currentFiles[index].seriesName}`);
        });
      }

      // Événement sur le bouton nouvelle série
      if (newSeriesBtn) {
        newSeriesBtn.addEventListener('click', () => {
          this.showNewSeriesModal(index, row);
        });
      }

      // Initialiser le mode de tri
      this.updateSortMode(row, index, file.triageType || 'unsorted');
      
      // Bouton "Passer"
      const skipBtn = row.querySelector('.quick-skip');
      skipBtn.addEventListener('click', () => {
        this.toggleFileAction(index, row);
      });
      
      // Ajouter la ligne au tableau
      tableBody.appendChild(row);
    });

    console.log(`📋 ${this.currentFiles.length} fichiers ajoutés à la modale de tri`);
  }

  toggleFileAction(fileIndex, rowElement) {
    const file = this.currentFiles[fileIndex];
    const skipBtn = rowElement.querySelector('.quick-skip');
    
    if (file.action === 'classify') {
      // Marquer comme "à passer"
      file.action = 'skip';
      rowElement.classList.add('skipped');
      skipBtn.textContent = 'Inclure';
      skipBtn.title = 'Inclure ce fichier dans la classification';
      console.log(`⏭️ Fichier marqué à passer: ${file.name}`);
    } else {
      // Marquer comme "à classifier"
      file.action = 'classify';
      rowElement.classList.remove('skipped');
      skipBtn.textContent = 'Passer';
      skipBtn.title = 'Passer ce fichier';
      console.log(`✅ Fichier marqué à classifier: ${file.name}`);
    }
  }

  skipAllFiles() {
    console.log('⏭️ Tous les fichiers marqués comme "médias non triés"');
    
    // Marquer tous les fichiers comme "unsorted" et "skip"
    this.currentFiles.forEach(file => {
      file.triageType = 'unsorted';
      file.action = 'skip';
    });

    // Sauvegarder directement tous les fichiers comme non triés
    this.saveAllAsUnsorted();
  }

  async saveAllAsUnsorted() {
    try {
      this.showProgress('Enregistrement des médias non triés...');
      
      const results = [];
      
      for (let i = 0; i < this.currentFiles.length; i++) {
        const file = this.currentFiles[i];
        
        // Mettre à jour la progression
        const progress = ((i + 1) / this.currentFiles.length) * 100;
        this.updateProgress(progress, `Enregistrement: ${file.name}`);
        
        try {
          const result = await window.electronAPI.saveClassifiedFile({
            filePath: file.path,
            title: file.title || file.name,
            category: 'unsorted',
            mediaType: 'unique',
            description: '',
            releaseDate: '',
            year: null,
            seriesId: null,
            seriesName: null,
            season_number: null,
            episode_number: null
          });
          
          if (result.success) {
            results.push({ success: true, file: file.name });
            console.log(`✅ ${file.name} enregistré comme non trié`);

            // Tracker l'ID du film nouvellement créé pour pouvoir l'annuler plus tard
            if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
              this.newlyScannedIds.push(result.movieId);
              console.log('📋 ID ajouté à la liste des films trackés (tout passer triage):', result.movieId);
            }
          } else {
            results.push({ success: false, file: file.name, error: result.message });
            console.error(`❌ Erreur pour ${file.name}: ${result.message}`);
          }
        } catch (error) {
          results.push({ success: false, file: file.name, error: error.message });
          console.error(`❌ Erreur pour ${file.name}:`, error);
        }
      }
      
      this.completeProcess(results, 'unsorted');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement:', error);
      this.hideProgress();
      alert('Erreur lors de l\'enregistrement: ' + error.message);
    }
  }

  async validateAndContinue() {
    // Valider les données avant de continuer
    if (!this.validateTriageData()) {
      console.log('❌ Validation échouée - erreurs dans les données');
      return;
    }

    // Séparer les fichiers à classifier de ceux à passer
    const filesToClassify = this.currentFiles.filter(file => file.action === 'classify');
    const filesToSkip = this.currentFiles.filter(file => file.action === 'skip');

    console.log(`📋 Validation du tri: ${filesToClassify.length} à classifier, ${filesToSkip.length} à passer`);
    
    if (filesToSkip.length > 0) {
      // Sauvegarder d'abord les fichiers à passer comme non triés
      await this.saveSkippedFiles(filesToSkip);

      // Forcer le rechargement immédiat après sauvegarde
      await this.forceReloadMovies();
    }

    if (filesToClassify.length > 0) {
      // NOUVEAU : Sauvegarder immédiatement la catégorie choisie en Phase 1
      await this.saveTriageCategories(filesToClassify);

      // Fermer la modale de tri
      this.closeTriageModal();

      // Lancer la classification détaillée pour les fichiers sélectionnés
      console.log('🎯 Lancement de la classification détaillée');

      // Appeler le système de classification avancé
      if (window.importClassificationSystem) {
        window.importClassificationSystem.startClassification(filesToClassify, 'triage');
      } else {
        console.error('❌ Système de classification avancé non disponible');
        alert('Erreur: Système de classification non disponible');
      }
    } else if (filesToSkip.length === 0) {
      // Aucun fichier sélectionné
      alert('Aucun fichier sélectionné pour la classification.');
    } else {
      // Tous les fichiers ont été passés, forcer le rechargement
      await this.forceReloadMovies();
      this.closeTriageModal();
    }
  }

  async saveSkippedFiles(skippedFiles) {
    try {
      console.log(`💾 Sauvegarde de ${skippedFiles.length} fichiers passés`);

      for (const file of skippedFiles) {
        const result = await window.electronAPI.saveClassifiedFile({
          filePath: file.path,
          title: file.title || file.name,
          category: file.triageType === 'unsorted' ? 'unsorted' : file.triageType,
          mediaType: file.mediaType || (file.triageType === 'series' ? 'series' : 'unique'),
          description: '',
          releaseDate: '',
          year: null,
          seriesId: file.seriesId || null,
          seriesName: file.seriesName || null,
          season_number: null,
          episode_number: null
        });

        if (result.success) {
          console.log(`✅ ${file.name} sauvegardé comme ${file.triageType}`);

          // Tracker l'ID du film nouvellement créé pour pouvoir l'annuler plus tard
          if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
            this.newlyScannedIds.push(result.movieId);
            console.log('📋 ID ajouté à la liste des films trackés (fichiers sautés):', result.movieId);
          }
        } else {
          console.error(`❌ Erreur pour ${file.name}: ${result.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des fichiers passés:', error);
    }
  }

  async saveTriageCategories(filesToClassify) {
    try {
      console.log(`📋 Sauvegarde immédiate des catégories Phase 1 pour ${filesToClassify.length} fichiers`);

      for (const file of filesToClassify) {
        console.log(`🔍 Sauvegarde Phase 1 pour: ${file.name}`);
        console.log(`   - category: ${file.triageType}`);
        console.log(`   - seriesId: ${file.seriesId}`);
        console.log(`   - seriesName: ${file.seriesName}`);

        const result = await window.electronAPI.saveClassifiedFile({
          filePath: file.path,
          title: file.title || file.name,
          category: file.triageType || 'unsorted',
          mediaType: file.mediaType || (file.triageType === 'series' ? 'series' : 'unique'),
          description: '',
          releaseDate: '',
          year: null,
          seriesId: file.seriesId || null,
          seriesName: file.seriesName || null,
          season_number: null,
          episode_number: null
        });

        if (result.success) {
          console.log(`✅ Phase 1: ${file.title || file.name} → catégorie: ${file.triageType}`);

          // Tracker l'ID du film nouvellement créé pour pouvoir l'annuler plus tard
          if (result.movieId && !this.newlyScannedIds.includes(result.movieId)) {
            this.newlyScannedIds.push(result.movieId);
            console.log('📋 ID ajouté à la liste des films trackés (validation triage):', result.movieId);
          }
        } else {
          console.error(`❌ Erreur Phase 1 pour ${file.title || file.name}: ${result.message}`);
        }
      }

      // Forcer le rechargement pour voir les changements immédiatement
      await this.forceReloadMovies();

    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des catégories Phase 1:', error);
    }
  }

  showTriageModal() {
    console.log('🔍 showTriageModal appelée');
    console.log('🔍 this.triageModal:', this.triageModal);

    if (this.triageModal) {
      console.log('✅ Élément trouvé, affichage de la modale');
      this.triageModal.style.display = 'flex';
      console.log('📋 Modale de tri affichée - display:', this.triageModal.style.display);

      // Force un reflow pour s'assurer que le changement est appliqué
      this.triageModal.offsetHeight;
    } else {
      console.error('❌ this.triageModal est null ou undefined !');
      console.log('🔍 Tentative de récupération de l\'élément...');
      this.triageModal = document.getElementById('import-triage-modal');
      console.log('🔍 Élément récupéré:', this.triageModal);

      if (this.triageModal) {
        this.triageModal.style.display = 'flex';
        console.log('✅ Modale affichée après récupération');
      }
    }
  }

  closeTriageModal() {
    if (this.triageModal) {
      this.triageModal.style.display = 'none';
      console.log('📋 Modale de tri fermée');
    }
  }

  hideTriageModal() {
    this.closeTriageModal();
  }

  showLoadingState(message) {
    // Afficher un état de chargement dans l'overlay
    const container = document.getElementById('triage-files-container');
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  hideLoadingState() {
    // Masquer l'état de chargement (sera remplacé par populateTriageModal)
    const container = document.getElementById('triage-files-container');
    if (container) {
      container.innerHTML = '';
    }
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
    console.log('🚫 Annulation complète de l\'import');

    // Nettoyer les fichiers partiellement importés (suppression de la DB)
    await this.cleanupPartialImport();

    // Réinitialiser les données d'import
    this.currentFiles = [];
    this.processedFiles = [];
    this.isProcessing = false;

    // Fermer toutes les modals d'import
    this.closeTriageModal();

    // Si la modal de classification est ouverte, la fermer aussi
    const classificationModal = document.getElementById('import-modal');
    if (classificationModal && classificationModal.style.display !== 'none') {
      classificationModal.style.display = 'none';
    }

    // Notifier l'utilisateur
    if (window.showNotification) {
      window.showNotification('Import annulé', 'L\'import des médias a été annulé avec succès.', 'info');
    }

    // Réinitialiser l'interface
    this.resetUI();

    console.log('✅ Import complètement annulé');
  }

  async cleanupPartialImport() {
    console.log('🧹 Nettoyage des données d\'import partielles (triage)');

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
        console.error('❌ Erreur lors du nettoyage des données partielles:', error);
      }
    }

    // Réinitialiser la liste des IDs nouvellement scannés
    this.newlyScannedIds = [];
  }

  resetUI() {
    // Réinitialiser le compteur
    const triageCount = document.getElementById('triage-count');
    if (triageCount) {
      triageCount.textContent = '0 fichiers trouvés';
    }

    // Vider le tableau
    const tableBody = document.getElementById('triage-table-body');
    if (tableBody) {
      tableBody.innerHTML = '';
    }

    // Réinitialiser les contrôles globaux
    const globalTypeSelect = document.getElementById('global-triage-type');
    if (globalTypeSelect) {
      globalTypeSelect.value = '';
    }

    // Masquer les contrôles de série par lot
    const seriesBatchControl = document.getElementById('series-batch-control');
    if (seriesBatchControl) {
      seriesBatchControl.style.display = 'none';
    }
  }

  showProgress(message) {
    const progressContainer = document.getElementById('triage-progress');
    const progressText = document.getElementById('triage-progress-text');
    
    if (progressContainer && progressText) {
      progressText.textContent = message;
      progressContainer.style.display = 'flex';
    }
  }

  updateProgress(percentage, message) {
    const progressFill = document.getElementById('triage-progress-fill');
    const progressText = document.getElementById('triage-progress-text');
    
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText && message) {
      progressText.textContent = message;
    }
  }

  hideProgress() {
    const progressContainer = document.getElementById('triage-progress');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
  }

  async completeProcess(results, type) {
    this.hideProgress();

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    let message = `Traitement terminé!\n`;
    message += `✅ ${successCount} fichier(s) traité(s) avec succès\n`;
    if (errorCount > 0) {
      message += `❌ ${errorCount} erreur(s)\n`;
    }

    if (type === 'unsorted') {
      message += `\nTous les fichiers ont été placés dans "Médias non triés".`;
    }

    // Fermer la modale d'abord
    this.closeTriageModal();

    // Forcer le rechargement des films AVANT l'alert
    await this.forceReloadMovies();

    // Afficher le message après le rechargement
    alert(message);
  }

  async forceReloadMovies() {
    try {
      console.log('🔄 Rechargement forcé de la liste des films');
      
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

  applyGlobalTriageType() {
    const globalTypeSelect = document.getElementById('global-triage-type');
    const typeValue = globalTypeSelect?.value;

    if (!typeValue) {
      alert('Veuillez sélectionner un type de média à appliquer');
      return;
    }

    console.log(`⚡ Application du type "${typeValue}" à toutes les lignes de triage`);

    // Appliquer à toutes les lignes
    const allRows = document.querySelectorAll('#triage-table-body .import-row');
    let appliedCount = 0;

    allRows.forEach((row, index) => {
      const typeSelector = row.querySelector('.type-selector');
      if (typeSelector && !row.classList.contains('skipped')) {
        typeSelector.value = typeValue;

        // Mettre à jour les données du fichier
        if (this.currentFiles[index]) {
          this.currentFiles[index].triageType = typeValue;
        }

        // Mettre à jour l'affichage du mode de tri
        this.updateSortMode(row, index, typeValue);

        appliedCount++;
      }
    });

    // Feedback visuel
    const button = document.getElementById('apply-global-triage-type');
    if (button) {
      const originalText = button.textContent;
      button.textContent = `✓ Appliqué (${appliedCount})`;
      button.disabled = true;

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }

    console.log(`📋 Type "${typeValue}" appliqué à ${appliedCount} fichiers`);
  }

  async loadSeries() {
    try {
      console.log('🔄 Chargement des séries...');

      // Nettoyer d'abord les séries corrompues
      try {
        await window.electronAPI.cleanupCorruptedSeries();
      } catch (error) {
        console.warn('⚠️ Impossible de nettoyer les séries corrompues:', error);
      }

      const result = await window.electronAPI.getAllSeries();
      console.log('📡 Résultat API getAllSeries:', result);

      if (result && result.success && result.series) {
        // Filtrer les séries invalides (sans ID)
        this.series = result.series.filter(serie => {
          if (!serie.id) {
            console.warn('⚠️ Série avec ID manquant ignorée:', serie.name);
            return false;
          }
          return true;
        });
        console.log('📺 Séries chargées:', this.series.length);
        console.log('📺 Détail des séries:', this.series);
      } else {
        this.series = [];
        console.log('📺 Aucune série trouvée ou erreur dans la réponse');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des séries:', error);
      this.series = [];
    }
  }

  populateSeriesSelector(seriesSelector) {
    if (!seriesSelector) return;

    seriesSelector.innerHTML = '<option value="">Sélectionner une série</option>';

    this.series.forEach(serie => {
      const option = document.createElement('option');
      option.value = serie.id;
      option.textContent = serie.name;
      seriesSelector.appendChild(option);
    });
  }

  updateSortMode(row, fileIndex, mediaType) {
    const sortModeInput = row.querySelector('.sort-mode-input');
    const seriesFields = row.querySelector('.series-fields');
    const file = this.currentFiles[fileIndex];

    // Mettre à jour l'affichage du mode de tri
    switch (mediaType) {
      case 'film':
        sortModeInput.value = '🎬 Unique';
        file.mediaType = 'unique';
        seriesFields.style.display = 'none';
        break;
      case 'short':
        sortModeInput.value = '🎞️ Unique';
        file.mediaType = 'unique';
        seriesFields.style.display = 'none';
        break;
      case 'other':
        sortModeInput.value = '📁 Unique';
        file.mediaType = 'unique';
        seriesFields.style.display = 'none';
        break;
      case 'series':
        sortModeInput.value = '📺 Série';
        file.mediaType = 'series';
        seriesFields.style.display = 'block';
        break;
      default:
        sortModeInput.value = 'Non défini';
        file.mediaType = null;
        seriesFields.style.display = 'none';
        break;
    }

    this.hideValidationError(row);

    // Mettre à jour la barre de gestion groupée des séries
    this.updateSeriesBatchControl();
  }

  showValidationError(row, message = 'Nom de série requis') {
    const validationError = row.querySelector('.validation-error');
    const errorText = row.querySelector('.error-text');

    if (validationError && errorText) {
      errorText.textContent = message;
      validationError.style.display = 'flex';

      // Animation de vibration
      row.classList.add('error-shake', 'error-highlight');

      // Retirer l'animation après la durée
      setTimeout(() => {
        row.classList.remove('error-shake');
      }, 500);
    }
  }

  hideValidationError(row) {
    const validationError = row.querySelector('.validation-error');
    if (validationError) {
      validationError.style.display = 'none';
    }
    row.classList.remove('error-highlight');
  }

  showNewSeriesModal(fileIndex, row) {
    // Créer un modal personnalisé pour la saisie du nom de série
    const modal = document.createElement('div');
    modal.className = 'new-series-modal-overlay';
    modal.innerHTML = `
      <div class="new-series-modal">
        <h3>Nouvelle série</h3>
        <input type="text" id="newSeriesName" placeholder="Nom de la série..." maxlength="100">
        <div class="modal-buttons">
          <button type="button" class="btn-cancel">Annuler</button>
          <button type="button" class="btn-create">Créer</button>
        </div>
      </div>
    `;

    // Ajouter le modal au document
    document.body.appendChild(modal);

    // Focus sur l'input
    const input = modal.querySelector('#newSeriesName');
    input.focus();

    // Gérer les événements
    const btnCancel = modal.querySelector('.btn-cancel');
    const btnCreate = modal.querySelector('.btn-create');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    const createSeries = () => {
      const seriesName = input.value.trim();
      if (seriesName) {
        this.createNewSeries(seriesName, fileIndex, row);
        closeModal();
      } else {
        input.focus();
        input.style.borderColor = '#e74c3c';
        setTimeout(() => {
          input.style.borderColor = '';
        }, 2000);
      }
    };

    btnCancel.addEventListener('click', closeModal);
    btnCreate.addEventListener('click', createSeries);

    // Fermer avec Escape
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'Enter') {
        createSeries();
      }
    });

    // Fermer en cliquant sur l'overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  async createNewSeries(seriesName, fileIndex, row) {
    try {
      console.log('📺 Création de la série:', seriesName);

      const result = await window.electronAPI.createSeries({
        name: seriesName,
        description: ''
      });

      if (result.success) {
        console.log('✅ Série créée avec succès, ID:', result.series.id);

        // Ajouter la série à la liste locale
        const newSeries = {
          id: result.series.id,
          name: seriesName,
          description: ''
        };
        this.series.push(newSeries);

        // Mettre à jour TOUS les sélecteurs de série
        this.updateAllSeriesSelectors();

        // Sélectionner automatiquement la nouvelle série dans ce sélecteur
        const seriesSelector = row.querySelector('.series-name-selector');
        seriesSelector.value = result.series.id;
        this.currentFiles[fileIndex].seriesId = result.series.id;
        this.currentFiles[fileIndex].seriesName = seriesName;

        this.hideValidationError(row);
        console.log('📺 Nouvelle série sélectionnée automatiquement');
      } else {
        console.error('❌ Erreur lors de la création de la série:', result.message);
        alert('Erreur lors de la création de la série: ' + result.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la création de la série:', error);
      alert('Erreur lors de la création de la série: ' + error.message);
    }
  }

  validateTriageData() {
    let hasErrors = false;
    const allRows = document.querySelectorAll('#triage-table-body .import-row');

    allRows.forEach((row, index) => {
      const file = this.currentFiles[index];

      // Valider seulement les fichiers qui ne sont pas passés
      if (file && file.action === 'classify') {
        if (file.triageType === 'series') {
          console.log(`🔍 Validation série fichier ${index}: seriesId="${file.seriesId}", seriesName="${file.seriesName}", triageType="${file.triageType}"`);
          if (!file.seriesId || !file.seriesName) {
            console.log(`❌ Validation échouée pour fichier ${index}: ${file.name}`);
            this.showValidationError(row);
            hasErrors = true;
          } else {
            console.log(`✅ Validation réussie pour fichier ${index}: ${file.name}`);
            this.hideValidationError(row);
          }
        }
      }
    });

    return !hasErrors;
  }

  formatDuration(duration) {
    if (!duration || duration === 0) return '--:--:--';

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Méthodes pour la gestion groupée des séries
  updateSeriesBatchControl() {
    const batchControl = document.getElementById('series-batch-control');
    const countSpan = document.getElementById('pending-series-count');
    const applyBtn = document.getElementById('batch-apply-series');
    const selector = document.getElementById('batch-series-selector');

    if (!batchControl) return;

    // Compter les médias en attente de sélection de série
    const pendingSeries = this.currentFiles.filter(file =>
      file.triageType === 'series' && !file.seriesId
    );

    if (pendingSeries.length > 0) {
      // Afficher la barre
      batchControl.style.display = 'block';

      // Mettre à jour le compteur
      if (countSpan) {
        countSpan.textContent = pendingSeries.length;
      }

      // Activer/désactiver le bouton selon la sélection
      if (applyBtn && selector) {
        applyBtn.disabled = !selector.value;
      }

      // Charger les séries dans le sélecteur si nécessaire
      this.loadSeriesInBatchSelector();
    } else {
      // Masquer la barre s'il n'y a pas de médias en attente
      batchControl.style.display = 'none';
    }
  }

  loadSeriesInBatchSelector() {
    const selector = document.getElementById('batch-series-selector');
    if (!selector) {
      console.warn('⚠️ Sélecteur batch-series-selector non trouvé');
      return;
    }


    // Sauvegarder la sélection actuelle
    const currentValue = selector.value;

    // Vider et recréer les options
    selector.innerHTML = '<option value="">Sélectionner une série existante...</option>';

    // Ajouter les séries (seulement celles avec un ID valide)
    this.series.forEach(serie => {
      if (!serie.id) {
        console.warn('⚠️ Série sans ID ignorée dans le sélecteur:', serie.name);
        return;
      }
      const option = document.createElement('option');
      option.value = serie.id;
      option.textContent = serie.name;
      selector.appendChild(option);
    });

    // Restaurer la sélection si elle existe encore
    if (currentValue) {
      selector.value = currentValue;
    }

    // Mettre à jour l'état du bouton
    const applyBtn = document.getElementById('batch-apply-series');
    if (applyBtn) {
      applyBtn.disabled = !selector.value;
    }

    // Écouter les changements de sélection
    selector.removeEventListener('change', this.handleBatchSelectorChange);
    this.handleBatchSelectorChange = () => {
      if (applyBtn) {
        applyBtn.disabled = !selector.value;
      }
    };
    selector.addEventListener('change', this.handleBatchSelectorChange);
  }

  async applyBatchSeries() {
    const selector = document.getElementById('batch-series-selector');
    const selectedSeriesId = selector?.value;


    if (!selectedSeriesId) {
      console.warn('⚠️ Aucune série sélectionnée pour l\'application groupée');
      return;
    }

    // Trouver la série sélectionnée
    const selectedSeries = this.series.find(s => s.id === selectedSeriesId);
    if (!selectedSeries) {
      console.error('❌ Série non trouvée:', selectedSeriesId);
      return;
    }

    console.log(`📺 Application de la série "${selectedSeries.name}" aux médias en attente`);

    // Appliquer la série à tous les médias en attente
    let appliedCount = 0;
    this.currentFiles.forEach((file, index) => {
      if (file.triageType === 'series' && !file.seriesId) {
        file.seriesId = selectedSeriesId;
        file.seriesName = selectedSeries.name;
        appliedCount++;

        // Mettre à jour l'affichage dans le tableau
        const row = document.querySelector(`#triage-table tbody tr:nth-child(${index + 1})`);
        if (row) {
          const seriesSelector = row.querySelector('.series-name-selector');
          if (seriesSelector) {
            seriesSelector.value = selectedSeriesId;
          }

          // Masquer l'erreur de validation pour cette ligne
          this.hideValidationError(row);
        }

        console.log(`✅ Série appliquée au fichier ${index}: ${file.name} -> ${selectedSeries.name} (ID: ${selectedSeriesId})`);
      } else {
        console.log(`⏭️ Fichier ${index} ignoré: triageType=${file.triageType}, seriesId=${file.seriesId}`);
      }
    });

    console.log(`✅ Série appliquée à ${appliedCount} médias`);

    // Mettre à jour l'affichage de la barre de contrôle
    this.updateSeriesBatchControl();

    // Notification visuelle
    const applyBtn = document.getElementById('batch-apply-series');
    if (applyBtn) {
      const originalText = applyBtn.innerHTML;
      applyBtn.innerHTML = `✅ Appliqué à ${appliedCount} médias`;
      applyBtn.style.background = 'linear-gradient(135deg, #27ae60 0%, #219653 100%)';

      setTimeout(() => {
        applyBtn.innerHTML = originalText;
        applyBtn.style.background = '';
      }, 2000);
    }
  }

  // Nouvelle méthode pour mettre à jour tous les sélecteurs de série
  updateAllSeriesSelectors() {
    // Mettre à jour tous les sélecteurs individuels dans le tableau
    const allSeriesSelectors = document.querySelectorAll('.series-name-selector');
    allSeriesSelectors.forEach(selector => {
      this.populateSeriesSelector(selector);
    });

    // Mettre à jour le sélecteur de la section groupée
    this.loadSeriesInBatchSelector();

    console.log('🔄 Tous les sélecteurs de série mis à jour');
  }

  // Méthode pour afficher la modale de création de série
  showNewSeriesModal() {
    const modal = document.getElementById('new-series-modal');
    if (modal) {
      modal.style.display = 'flex';

      // Focus sur le champ nom
      const nameInput = document.getElementById('new-series-name');
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 100);
      }
    }
  }
}

// CSS supplémentaire pour les fichiers passés
const style = document.createElement('style');
style.textContent = `
  .import-row.skipped {
    opacity: 0.6;
    background-color: rgba(255, 255, 255, 0.02);
  }
  
  .import-row.skipped .filename-title {
    text-decoration: line-through;
    color: #888;
  }
  
  .import-row.skipped .type-selector {
    background-color: rgba(255, 255, 255, 0.05);
    color: #888;
  }
`;
document.head.appendChild(style);

// Créer l'instance globale
window.importTriageSystem = new ImportTriageSystem();

// Export pour utilisation dans d'autres modules
window.startTriage = (files, scanType) => {
  window.importTriageSystem.startTriage(files, scanType);
};

console.log('📋 Système de tri des médias initialisé');