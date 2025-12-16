/**
 * Nouveau gestionnaire de fichiers avec modes d'affichage multiples
 * Architecture modulaire et flexible
 */

class FileManager {
  constructor() {
    this.files = [];
    this.filteredFiles = [];
    this.series = [];
    this.currentViewMode = 'flat'; // Par défaut: vue plate
    this.searchTerm = '';
    this.sortBy = 'title';
    this.formatFilter = '';
    this.expandedFolders = new Set(); // Gérer l'état des dossiers
    this.foldersInitialized = false; // Savoir si on a déjà initialisé les dossiers
    this.expandedCategories = new Set(); // Gérer l'état des catégories

    // Gestion de la sélection
    this.selectedFiles = new Set(); // IDs des fichiers sélectionnés
    this.selectionMode = false; // Mode sélection actif ou non

    // Configuration des modes d'affichage
    this.viewModes = {
      flat: {
        name: 'Vue Plate',
        icon: 'fas fa-list',
        description: 'Tous les médias en liste simple'
      },
      hierarchical: {
        name: 'Vue Hiérarchique',
        icon: 'fas fa-sitemap',
        description: 'Organisé par dossiers expandables'
      },
      category: {
        name: 'Vue par Catégorie',
        icon: 'fas fa-tags',
        description: 'Groupé par Films/Séries/etc.'
      },
      chronological: {
        name: 'Vue Chronologique',
        icon: 'fas fa-calendar-alt',
        description: 'Par date d\'import'
      }
    };

    this.init();
  }

  async init() {
    console.log('🎬 Initialisation du nouveau gestionnaire de fichiers');

    await this.loadData();
    this.setupEventListeners();
    this.createViewModeSelector();
    this.loadUserPreferences();
    this.render();
  }

  async loadData() {
    try {
      // Charger les médias
      const mediasResult = await window.electronAPI.getAllMedias();
      if (mediasResult.success) {
        this.files = mediasResult.medias || [];
      }

      // Charger les séries
      const seriesResult = await window.electronAPI.getAllSeries();
      if (seriesResult.success) {
        this.series = seriesResult.series || [];
      }

      console.log(`📊 Données chargées: ${this.files.length} médias, ${this.series.length} séries`);

      this.updateStats();
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
    }
  }

  createViewModeSelector() {
    const existingButton = document.getElementById('toggle-view-btn');

    // Si le bouton n'existe pas, chercher le container et ajouter le sélecteur
    if (!existingButton) {
      console.warn('⚠️ Bouton toggle-view-btn introuvable, tentative de création directe du sélecteur');

      // Chercher le container de filtres
      const filterControls = document.querySelector('.filter-controls');
      if (!filterControls) {
        console.warn('⚠️ Container filter-controls introuvable, sélecteur de mode non créé');
        return;
      }

      // Créer et ajouter le sélecteur directement
      const selector = document.createElement('div');
      selector.className = 'view-mode-selector';
      selector.innerHTML = `
        <select id="view-mode-select" class="btn-secondary">
          ${Object.entries(this.viewModes).map(([key, mode]) =>
            `<option value="${key}" ${key === this.currentViewMode ? 'selected' : ''}>
              ${mode.name}
            </option>`
          ).join('')}
        </select>
        <div class="view-mode-description" id="view-mode-description">
          ${this.viewModes[this.currentViewMode].description}
        </div>
      `;

      filterControls.appendChild(selector);
      console.log('✅ Sélecteur de mode créé sans remplacer le bouton');
      return;
    }

    const controlsContainer = existingButton.parentElement;

    // Sécurité: vérifier que le parent existe aussi
    if (!controlsContainer) {
      console.warn('⚠️ Container parent introuvable');
      return;
    }

    // Remplacer le bouton existant par un sélecteur de mode
    const selector = document.createElement('div');
    selector.className = 'view-mode-selector';
    selector.innerHTML = `
      <select id="view-mode-select" class="btn-secondary">
        ${Object.entries(this.viewModes).map(([key, mode]) =>
          `<option value="${key}" ${key === this.currentViewMode ? 'selected' : ''}>
            ${mode.name}
          </option>`
        ).join('')}
      </select>
      <div class="view-mode-description" id="view-mode-description">
        ${this.viewModes[this.currentViewMode].description}
      </div>
    `;

    controlsContainer.replaceChild(selector, existingButton);
  }

  setupEventListeners() {
    // Sélecteur de mode d'affichage
    document.addEventListener('change', (e) => {
      if (e.target.id === 'view-mode-select') {
        this.changeViewMode(e.target.value);
      }
    });

    // Recherche
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.applyFilters();
        this.render();
      });
    }

    // Tri
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.applyFilters();
        this.render();
      });
    }

    // Filtre par format
    const formatFilter = document.getElementById('format-filter');
    if (formatFilter) {
      formatFilter.addEventListener('change', (e) => {
        this.formatFilter = e.target.value;
        this.applyFilters();
        this.render();
      });
    }

    // Actualiser
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Bouton tout déplier/replier
    const expandAllBtn = document.getElementById('expand-all-btn');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => this.toggleExpandAll());
    }

    // Bouton Clear All
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.showClearAllModal());
    }

    // Bouton de retour
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'dashboard.html';
      });
    }

    // Gestion des checkboxes et du mode sélection
    this.setupSelectionHandlers();

    // Gestion du modal de suppression
    this.setupDeleteModal();

    // Gestion du modal Clear All
    this.setupClearAllModal();
  }

  setupSelectionHandlers() {
    const tableBody = document.getElementById('files-table-body');
    const masterCheckbox = document.getElementById('master-checkbox');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    // Gestion du checkbox maître (tout sélectionner)
    if (masterCheckbox) {
      masterCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        this.toggleSelectAll(isChecked);
      });
    }

    // Bouton "Tout sélectionner"
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.toggleSelectAll(true);
      });
    }

    // Bouton "Supprimer sélectionnés"
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', () => {
        this.deleteSelectedFiles();
      });
    }

    // Délégation d'événements pour les checkboxes individuelles
    if (tableBody) {
      tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('file-checkbox')) {
          const fileId = parseInt(e.target.dataset.fileId);
          this.toggleFileSelection(fileId, e.target.checked);
        }
      });

      // Gestion du clic sur la ligne pour sélectionner
      tableBody.addEventListener('click', (e) => {
        const row = e.target.closest('.file-row, .child-file-row, .category-file-row');
        if (row && !e.target.closest('button') && !e.target.closest('input[type="checkbox"]')) {
          const checkbox = row.querySelector('.file-checkbox');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            const fileId = parseInt(checkbox.dataset.fileId);
            this.toggleFileSelection(fileId, checkbox.checked);
          }
        }
      });
    }
  }

  toggleFileSelection(fileId, isSelected) {
    if (isSelected) {
      this.selectedFiles.add(fileId);
    } else {
      this.selectedFiles.delete(fileId);
    }

    // Activer/désactiver le mode sélection
    this.updateSelectionMode();
  }

  toggleSelectAll(selectAll) {
    this.selectedFiles.clear();

    if (selectAll) {
      // Sélectionner tous les fichiers visibles
      this.filteredFiles.forEach(file => {
        this.selectedFiles.add(file.id);
      });
    }

    // Mettre à jour toutes les checkboxes
    document.querySelectorAll('.file-checkbox').forEach(checkbox => {
      checkbox.checked = selectAll;
    });

    // Mettre à jour le master checkbox
    const masterCheckbox = document.getElementById('master-checkbox');
    if (masterCheckbox) {
      masterCheckbox.checked = selectAll;
      masterCheckbox.indeterminate = false;
    }

    this.updateSelectionMode();
  }

  updateSelectionMode() {
    const selectedCount = this.selectedFiles.size;
    const bulkActions = document.getElementById('bulk-actions');
    const masterCheckbox = document.getElementById('master-checkbox');

    // Activer le mode sélection si au moins un fichier est sélectionné
    this.selectionMode = selectedCount > 0;

    // Afficher/masquer la barre d'actions
    if (bulkActions) {
      bulkActions.style.display = this.selectionMode ? 'flex' : 'none';
    }

    // Mettre à jour l'état du master checkbox
    if (masterCheckbox) {
      const totalFiles = this.filteredFiles.length;
      if (selectedCount === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
      } else if (selectedCount === totalFiles) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
      } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
      }
    }

    // Mettre à jour le style des lignes sélectionnées
    this.updateRowStyles();

    // Mettre à jour le compteur
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn && selectedCount > 0) {
      deleteSelectedBtn.textContent = `Supprimer sélectionnés (${selectedCount})`;
    }

    console.log(`📋 Mode sélection: ${this.selectionMode ? 'ACTIF' : 'INACTIF'} - ${selectedCount} fichier(s) sélectionné(s)`);
  }

  updateRowStyles() {
    // Appliquer le style aux lignes sélectionnées
    document.querySelectorAll('.file-row, .child-file-row, .category-file-row').forEach(row => {
      const checkbox = row.querySelector('.file-checkbox');
      if (checkbox) {
        const fileId = parseInt(checkbox.dataset.fileId);
        if (this.selectedFiles.has(fileId)) {
          row.classList.add('selected');
        } else {
          row.classList.remove('selected');
        }
      }
    });
  }

  async deleteSelectedFiles() {
    if (this.selectedFiles.size === 0) return;

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer ${this.selectedFiles.size} fichier(s) de la base de données ?`;
    if (!confirm(confirmMessage)) return;

    try {
      const fileIds = Array.from(this.selectedFiles);

      for (const fileId of fileIds) {
        await window.electronAPI.deleteMedia(fileId);
      }

      console.log(`✅ ${fileIds.length} fichier(s) supprimé(s) avec succès`);

      // Réinitialiser la sélection
      this.selectedFiles.clear();
      this.updateSelectionMode();

      // Recharger les données
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    }
  }

  setupDeleteModal() {
    const modal = document.getElementById('delete-modal');
    const closeBtn = document.getElementById('close-delete-modal');
    const cancelBtn = document.getElementById('cancel-delete-btn');
    const confirmBtn = document.getElementById('confirm-delete-btn');

    // Fermer le modal
    const closeModal = () => {
      modal.style.display = 'none';
      this.fileToDelete = null;
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Confirmer la suppression
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (this.fileToDelete) {
          await this.confirmDeleteFile(this.fileToDelete);
          closeModal();
        }
      });
    }
  }

  async confirmDeleteFile(fileId) {
    try {
      const result = await window.electronAPI.deleteMedia(fileId);
      if (result.success) {
        console.log('✅ Fichier supprimé avec succès');
        // Recharger les données
        await this.loadData();
        this.render();
      } else {
        console.error('❌ Erreur lors de la suppression:', result.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    }
  }

  changeViewMode(newMode) {
    if (this.viewModes[newMode]) {
      this.currentViewMode = newMode;

      // Mettre à jour la description
      const descriptionEl = document.getElementById('view-mode-description');
      if (descriptionEl) {
        descriptionEl.textContent = this.viewModes[newMode].description;
      }

      // Sauvegarder la préférence
      this.saveUserPreferences();

      // Re-rendre l'affichage
      this.render();

      console.log(`🎯 Mode d'affichage changé: ${this.viewModes[newMode].name}`);
    }
  }

  applyFilters() {
    let filtered = [...this.files];

    // Filtre de recherche
    if (this.searchTerm) {
      filtered = filtered.filter(file =>
        file.title.toLowerCase().includes(this.searchTerm) ||
        file.path.toLowerCase().includes(this.searchTerm)
      );
    }

    // Filtre par format
    if (this.formatFilter) {
      filtered = filtered.filter(file => file.format === this.formatFilter);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'size_bytes':
          return (b.size_bytes || 0) - (a.size_bytes || 0);
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        case 'dateAdded':
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        default:
          return 0;
      }
    });

    this.filteredFiles = filtered;
  }

  render() {
    this.applyFilters();

    switch (this.currentViewMode) {
      case 'flat':
        this.renderFlatView();
        break;
      case 'hierarchical':
        this.renderHierarchicalView();
        break;
      case 'category':
        this.renderCategoryView();
        break;
      case 'chronological':
        this.renderChronologicalView();
        break;
      default:
        this.renderFlatView();
    }

    this.updateFilesCount();
  }

  renderFlatView() {
    console.log('📄 Rendu en vue plate');
    const tableBody = document.getElementById('files-table-body');

    if (this.filteredFiles.length === 0) {
      tableBody.innerHTML = `
        <tr class="no-files-row">
          <td colspan="8" style="text-align: center; padding: 40px; color: #888;">
            <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>Aucun média trouvé</p>
          </td>
        </tr>
      `;
      return;
    }

    const rows = this.filteredFiles.map(file => this.createFileRow(file)).join('');
    tableBody.innerHTML = rows;
  }

  renderHierarchicalView() {
    console.log('🏗️ Rendu en vue hiérarchique');
    const tableBody = document.getElementById('files-table-body');

    if (this.filteredFiles.length === 0) {
      tableBody.innerHTML = `
        <tr class="no-files-row">
          <td colspan="8" style="text-align: center; padding: 40px; color: #888;">
            <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>Aucun média trouvé</p>
          </td>
        </tr>
      `;
      return;
    }

    // Organiser les fichiers par dossier
    const folderMap = new Map();

    this.filteredFiles.forEach(file => {
      const pathParts = file.path.split(/[\\\/]/);
      const fileName = pathParts.pop();
      const folderPath = pathParts.join('\\');

      if (!folderMap.has(folderPath)) {
        // Ajouter le dossier à expandedFolders SEULEMENT au premier chargement
        if (!this.foldersInitialized) {
          this.expandedFolders.add(folderPath);
        }

        folderMap.set(folderPath, {
          path: folderPath,
          name: pathParts[pathParts.length - 1] || folderPath,
          files: [],
          isExpanded: this.expandedFolders.has(folderPath) // État basé sur expandedFolders
        });
      }

      folderMap.get(folderPath).files.push({
        ...file,
        fileName: fileName
      });
    });

    // Générer le HTML
    let html = '';

    folderMap.forEach((folder, folderPath) => {
      // Ligne du dossier
      html += `
        <tr class="folder-row" data-folder-path="${this.escapeHtml(folderPath)}">
          <td>
            <input type="checkbox" class="folder-checkbox" data-folder-path="${this.escapeHtml(folderPath)}">
          </td>
          <td class="thumbnail-cell">
            <div class="folder-icon">
              <i class="fas fa-folder${folder.isExpanded ? '-open' : ''}"></i>
            </div>
          </td>
          <td class="file-name">
            <div class="folder-header" onclick="fileManager.toggleFolder('${this.escapeHtml(folderPath)}')">
              <i class="fas fa-chevron-${folder.isExpanded ? 'down' : 'right'} folder-toggle"></i>
              <strong>${this.escapeHtml(folder.name)}</strong>
              <span class="folder-count">(${folder.files.length} fichier${folder.files.length > 1 ? 's' : ''})</span>
            </div>
            <div class="file-path">${this.escapeHtml(folderPath)}</div>
          </td>
          <td colspan="5" class="folder-stats">
            ${this.getFolderStats(folder.files)}
          </td>
        </tr>
      `;

      // Fichiers du dossier (si expandé)
      if (folder.isExpanded) {
        folder.files.forEach((file, index) => {
          const isLast = index === folder.files.length - 1;
          html += this.createHierarchicalFileRow(file, isLast);
        });
      }
    });

    // Marquer les dossiers comme initialisés après le premier rendu
    this.foldersInitialized = true;

    tableBody.innerHTML = html;
  }

  renderCategoryView() {
    console.log('🏷️ Rendu en vue par catégorie');
    const tableBody = document.getElementById('files-table-body');

    if (this.filteredFiles.length === 0) {
      tableBody.innerHTML = `
        <tr class="no-files-row">
          <td colspan="8" style="text-align: center; padding: 40px; color: #888;">
            <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>Aucun média trouvé</p>
          </td>
        </tr>
      `;
      return;
    }

    // Organiser par catégorie
    const categories = {
      films: { name: 'Films', icon: 'fas fa-film', files: [] },
      series: { name: 'Séries', icon: 'fas fa-tv', files: [] },
      documentaires: { name: 'Documentaires', icon: 'fas fa-book', files: [] },
      unsorted: { name: 'Non classés', icon: 'fas fa-question-circle', files: [] }
    };

    this.filteredFiles.forEach(file => {
      const category = file.category || 'unsorted';
      if (categories[category]) {
        categories[category].files.push(file);
      } else {
        categories.unsorted.files.push(file);
      }
    });

    // Générer le HTML
    let html = '';

    Object.entries(categories).forEach(([categoryKey, category]) => {
      if (category.files.length === 0) return;

      // Initialiser l'état d'expansion de la catégorie
      if (!this.expandedCategories.has(categoryKey)) {
        this.expandedCategories.add(categoryKey); // Par défaut : toutes les catégories ouvertes
      }
      const isExpanded = this.expandedCategories.has(categoryKey);

      // En-tête de catégorie
      html += `
        <tr class="category-row" data-category="${categoryKey}">
          <td>
            <input type="checkbox" class="category-checkbox" data-category="${categoryKey}">
          </td>
          <td class="thumbnail-cell">
            <div class="category-icon">
              <i class="${category.icon}"></i>
            </div>
          </td>
          <td class="file-name">
            <div class="category-header" onclick="fileManager.toggleCategory('${categoryKey}')">
              <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} category-toggle"></i>
              <strong>${category.name}</strong>
              <span class="category-count">(${category.files.length} élément${category.files.length > 1 ? 's' : ''})</span>
            </div>
          </td>
          <td colspan="5" class="category-stats">
            ${this.getCategoryStats(category.files)}
          </td>
        </tr>
      `;

      // Fichiers de la catégorie (si expandé)
      if (isExpanded) {
        category.files.forEach((file, index) => {
          const isLast = index === category.files.length - 1;
          html += this.createCategoryFileRow(file, categoryKey, isLast);
        });
      }
    });

    tableBody.innerHTML = html;
  }

  renderChronologicalView() {
    console.log('📅 Rendu en vue chronologique');
    // TODO: Implémenter la vue chronologique
    // Pour l'instant, utiliser la vue plate
    this.renderFlatView();
  }

  createFileRow(file) {
    const isChecked = '';
    const thumbnail = file.thumbnail ? `../data/thumbnails/${file.thumbnail}` : '';
    const duration = this.formatDuration(file.duration);
    const size = this.formatFileSize(file.size_bytes);
    const status = file.exists !== false ?
      '<span class="status-ok"><i class="fas fa-check"></i> OK</span>' :
      '<span class="status-error"><i class="fas fa-times"></i> Introuvable</span>';

    return `
      <tr class="file-row" data-file-id="${file.id}">
        <td>
          <input type="checkbox" class="file-checkbox" data-file-id="${file.id}" ${isChecked}>
        </td>
        <td class="thumbnail-cell">
          ${thumbnail ? `<img src="${thumbnail}" alt="Miniature" class="file-thumbnail">` :
            '<div class="no-thumbnail"><i class="fas fa-file-video"></i></div>'}
        </td>
        <td class="file-name">
          <div class="file-title">${this.escapeHtml(file.title)}</div>
          <div class="file-path">${this.escapeHtml(file.path)}</div>
        </td>
        <td class="format-cell">
          <span class="format-badge">${file.format.toUpperCase()}</span>
        </td>
        <td class="duration-cell">${duration}</td>
        <td class="size-cell">${size}</td>
        <td class="status-cell">${status}</td>
        <td class="actions-cell">
          <button class="btn-icon" onclick="fileManager.showDetails('${file.id}')" title="Détails">
            <i class="fas fa-info-circle"></i>
          </button>
          <button class="btn-icon" onclick="fileManager.openFileLocation('${file.id}')" title="Ouvrir dans l'explorateur">
            <i class="fas fa-folder-open"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="fileManager.deleteFile('${file.id}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  updateStats() {
    const totalFiles = this.files.length;
    const totalSize = this.files.reduce((sum, file) => sum + (file.size_bytes || 0), 0);
    const totalDuration = this.files.reduce((sum, file) => sum + (file.duration || 0), 0);
    const filesWithThumbnails = this.files.filter(file => file.thumbnail).length;

    document.getElementById('total-files').textContent = totalFiles;
    document.getElementById('total-size').textContent = this.formatFileSize(totalSize);
    document.getElementById('total-duration').textContent = this.formatDuration(totalDuration);
    document.getElementById('files-with-thumbnails').textContent = filesWithThumbnails;
  }

  updateFilesCount() {
    document.getElementById('files-count').textContent = this.filteredFiles.length;
  }

  // Utilitaires
  formatDuration(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  formatFileSize(bytes) {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Actions
  async showDetails(fileId) {
    // TODO: Implémenter l'affichage des détails
    console.log('📋 Affichage des détails pour:', fileId);
  }

  async playFile(fileId) {
    // TODO: Implémenter la lecture
    console.log('▶️ Lecture du fichier:', fileId);
  }

  async openFileLocation(fileId) {
    try {
      const file = this.files.find(f => f.id === fileId);
      if (file && file.path) {
        const result = await window.electronAPI.openMediaFolder(file.path);
        if (result.success) {
          console.log('📂 Ouverture du dossier:', file.path);
        } else {
          console.error('❌ Erreur ouverture dossier:', result.message);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'ouverture du dossier:', error);
    }
  }

  async deleteFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    // Afficher le modal de confirmation
    const modal = document.getElementById('delete-modal');
    const messageElement = document.getElementById('delete-message');

    messageElement.textContent = `Êtes-vous sûr de vouloir supprimer "${file.title}" de la base de données ?`;
    modal.style.display = 'flex';

    // Stocker l'ID du fichier pour la confirmation
    this.fileToDelete = fileId;
  }

  async refresh() {
    console.log('🔄 Actualisation des données');
    await this.loadData();
    this.render();
  }

  // Gestion des préférences utilisateur
  saveUserPreferences() {
    const preferences = {
      viewMode: this.currentViewMode,
      sortBy: this.sortBy
    };
    localStorage.setItem('fileManagerPreferences', JSON.stringify(preferences));
  }

  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('fileManagerPreferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.currentViewMode = preferences.viewMode || 'flat';
        this.sortBy = preferences.sortBy || 'title';
      }
    } catch (error) {
      console.log('📝 Aucune préférence sauvegardée trouvée');
    }
  }

  // Méthodes utilitaires pour les vues spécialisées

  createHierarchicalFileRow(file, isLast) {
    const thumbnail = file.thumbnail ? `../data/thumbnails/${file.thumbnail}` : '';
    const duration = this.formatDuration(file.duration);
    const size = this.formatFileSize(file.size_bytes);
    const status = file.exists !== false ?
      '<span class="status-ok"><i class="fas fa-check"></i> OK</span>' :
      '<span class="status-error"><i class="fas fa-times"></i> Introuvable</span>';

    return `
      <tr class="child-file-row ${isLast ? 'last-in-folder' : ''}" data-file-id="${file.id}">
        <td>
          <input type="checkbox" class="file-checkbox" data-file-id="${file.id}">
        </td>
        <td class="thumbnail-cell">
          ${thumbnail ? `<img src="${thumbnail}" alt="Miniature" class="file-thumbnail">` :
            '<div class="no-thumbnail"><i class="fas fa-file-video"></i></div>'}
        </td>
        <td class="file-name">
          <div class="child-indent">
            <div class="file-title">${this.escapeHtml(file.title)}</div>
          </div>
        </td>
        <td class="format-cell">
          <span class="format-badge">${file.format.toUpperCase()}</span>
        </td>
        <td class="duration-cell">${duration}</td>
        <td class="size-cell">${size}</td>
        <td class="status-cell">${status}</td>
        <td class="actions-cell">
          <button class="btn-icon" onclick="fileManager.showDetails('${file.id}')" title="Détails">
            <i class="fas fa-info-circle"></i>
          </button>
          <button class="btn-icon" onclick="fileManager.openFileLocation('${file.id}')" title="Ouvrir dans l'explorateur">
            <i class="fas fa-folder-open"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="fileManager.deleteFile('${file.id}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  createCategoryFileRow(file, category, isLast) {
    const thumbnail = file.thumbnail ? `../data/thumbnails/${file.thumbnail}` : '';
    const duration = this.formatDuration(file.duration);
    const size = this.formatFileSize(file.size_bytes);
    const status = file.exists !== false ?
      '<span class="status-ok"><i class="fas fa-check"></i> OK</span>' :
      '<span class="status-error"><i class="fas fa-times"></i> Introuvable</span>';

    return `
      <tr class="category-file-row ${isLast ? 'last-in-category' : ''}" data-file-id="${file.id}" data-category="${category}">
        <td>
          <input type="checkbox" class="file-checkbox" data-file-id="${file.id}">
        </td>
        <td class="thumbnail-cell">
          ${thumbnail ? `<img src="${thumbnail}" alt="Miniature" class="file-thumbnail">` :
            '<div class="no-thumbnail"><i class="fas fa-file-video"></i></div>'}
        </td>
        <td class="file-name">
          <div class="category-indent">
            <div class="file-title">${this.escapeHtml(file.title)}</div>
            <div class="file-path">${this.escapeHtml(file.path)}</div>
          </div>
        </td>
        <td class="format-cell">
          <span class="format-badge">${file.format.toUpperCase()}</span>
        </td>
        <td class="duration-cell">${duration}</td>
        <td class="size-cell">${size}</td>
        <td class="status-cell">${status}</td>
        <td class="actions-cell">
          <button class="btn-icon" onclick="fileManager.showDetails('${file.id}')" title="Détails">
            <i class="fas fa-info-circle"></i>
          </button>
          <button class="btn-icon" onclick="fileManager.openFileLocation('${file.id}')" title="Ouvrir dans l'explorateur">
            <i class="fas fa-folder-open"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="fileManager.deleteFile('${file.id}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  getFolderStats(files) {
    const totalSize = files.reduce((sum, file) => sum + (file.size_bytes || 0), 0);
    const totalDuration = files.reduce((sum, file) => sum + (file.duration || 0), 0);
    return `
      <span class="folder-stat">Taille: ${this.formatFileSize(totalSize)}</span>
      <span class="folder-stat">Durée: ${this.formatDuration(totalDuration)}</span>
    `;
  }

  getCategoryStats(files) {
    const totalSize = files.reduce((sum, file) => sum + (file.size_bytes || 0), 0);
    const totalDuration = files.reduce((sum, file) => sum + (file.duration || 0), 0);
    return `
      <span class="category-stat">Taille: ${this.formatFileSize(totalSize)}</span>
      <span class="category-stat">Durée: ${this.formatDuration(totalDuration)}</span>
    `;
  }

  toggleFolder(folderPath) {
    if (this.expandedFolders.has(folderPath)) {
      this.expandedFolders.delete(folderPath);
      console.log('📁 Fermeture du dossier:', folderPath);
    } else {
      this.expandedFolders.add(folderPath);
      console.log('📁 Ouverture du dossier:', folderPath);
    }
    this.render();
  }

  toggleCategory(category) {
    if (this.expandedCategories.has(category)) {
      this.expandedCategories.delete(category);
      console.log('🏷️ Fermeture de la catégorie:', category);
    } else {
      this.expandedCategories.add(category);
      console.log('🏷️ Ouverture de la catégorie:', category);
    }
    this.render();
  }

  toggleExpandAll() {
    if (this.currentViewMode === 'hierarchical') {
      // Compter combien de dossiers sont actuellement ouverts
      const totalFolders = new Set();
      this.filteredFiles.forEach(file => {
        const pathParts = file.path.split(/[\\\/]/);
        pathParts.pop(); // Enlever le nom du fichier
        const folderPath = pathParts.join('\\');
        totalFolders.add(folderPath);
      });

      const allExpanded = totalFolders.size === this.expandedFolders.size;

      if (allExpanded) {
        // Fermer tous les dossiers
        this.expandedFolders.clear();
        console.log('📁 Fermeture de tous les dossiers');
        this.updateExpandAllButton('fas fa-plus-square', 'Tout déplier');
      } else {
        // Ouvrir tous les dossiers
        totalFolders.forEach(folder => this.expandedFolders.add(folder));
        console.log('📁 Ouverture de tous les dossiers');
        this.updateExpandAllButton('fas fa-minus-square', 'Tout replier');
      }
    } else if (this.currentViewMode === 'category') {
      // Gérer les catégories
      const categories = ['films', 'series', 'documentaires', 'unsorted'];
      const allExpanded = categories.every(cat => this.expandedCategories.has(cat));

      if (allExpanded) {
        // Fermer toutes les catégories
        this.expandedCategories.clear();
        console.log('🏷️ Fermeture de toutes les catégories');
        this.updateExpandAllButton('fas fa-plus-square', 'Tout déplier');
      } else {
        // Ouvrir toutes les catégories
        categories.forEach(cat => this.expandedCategories.add(cat));
        console.log('🏷️ Ouverture de toutes les catégories');
        this.updateExpandAllButton('fas fa-minus-square', 'Tout replier');
      }
    }

    this.render();
  }

  updateExpandAllButton(iconClass, text) {
    const expandAllBtn = document.getElementById('expand-all-btn');
    if (expandAllBtn) {
      const icon = expandAllBtn.querySelector('i');
      if (icon) {
        icon.className = iconClass;
      }
      expandAllBtn.childNodes[2].textContent = ` ${text}`;
    }
  }

  setupClearAllModal() {
    const modal = document.getElementById('clear-all-modal');
    const closeBtn = document.getElementById('close-clear-all-modal');
    const cancelBtn = document.getElementById('cancel-clear-all-btn');
    const confirmBtn = document.getElementById('confirm-clear-all-btn');
    const confirmationInput = document.getElementById('clear-confirmation');

    // Fermer le modal
    const closeModal = () => {
      modal.style.display = 'none';
      confirmationInput.value = '';
      confirmBtn.disabled = true;
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Validation de la saisie de confirmation
    if (confirmationInput) {
      confirmationInput.addEventListener('input', (e) => {
        const isValid = e.target.value.trim().toUpperCase() === 'CLEAR ALL';
        confirmBtn.disabled = !isValid;

        if (isValid) {
          confirmBtn.style.backgroundColor = '#dc3545';
          confirmBtn.style.opacity = '1';
        } else {
          confirmBtn.style.backgroundColor = '#6c757d';
          confirmBtn.style.opacity = '0.6';
        }
      });
    }

    // Confirmer la suppression
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        await this.confirmClearAll();
        closeModal();
      });
    }
  }

  showClearAllModal() {
    const modal = document.getElementById('clear-all-modal');
    modal.style.display = 'flex';
  }

  async confirmClearAll() {
    try {
      console.log('🗑️ Début de la suppression de tous les médias...');

      // Afficher un indicateur de chargement
      const confirmBtn = document.getElementById('confirm-clear-all-btn');
      const originalText = confirmBtn.innerHTML;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Suppression...';
      confirmBtn.disabled = true;

      // Supprimer tous les médias via l'API
      const result = await window.electronAPI.clearAllMedias();

      if (result.success) {
        console.log('✅ Tous les médias ont été supprimés avec succès');

        // Recharger les données
        await this.loadData();
        this.render();

        // Afficher un message de succès
        alert('✅ Tous les médias ont été supprimés avec succès !');
      } else {
        console.error('❌ Erreur lors de la suppression:', result.message);
        alert('❌ Erreur lors de la suppression: ' + result.message);
      }

      // Restaurer le bouton
      confirmBtn.innerHTML = originalText;

    } catch (error) {
      console.error('❌ Erreur lors de la suppression de tous les médias:', error);
      alert('❌ Erreur lors de la suppression: ' + error.message);
    }
  }
}

// Initialisation quand le DOM est prêt
let fileManager;

document.addEventListener('DOMContentLoaded', () => {
  fileManager = new FileManager();
  // Export global pour les actions après l'initialisation
  window.fileManager = fileManager;
});