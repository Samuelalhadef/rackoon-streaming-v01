// File Manager JavaScript pour Electron

class FileManagerElectron {
  constructor() {
    this.files = [];
    this.filteredFiles = [];
    this.selectedFiles = new Set();
    this.currentSort = 'title';
    this.viewMode = 'hierarchical'; // 'flat' ou 'hierarchical'
    this.expandedFolders = new Set();
    
    this.init();
  }

  init() {
    this.attachEventListeners();
    this.updateViewButton();
    this.loadStats();
    this.loadFiles();
  }

  // Attacher les événements
  attachEventListeners() {
    // Recherche
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.filterFiles();
    });
    
    // Filtres
    document.getElementById('format-filter').addEventListener('change', () => {
      this.filterFiles();
    });
    
    document.getElementById('sort-filter').addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.sortAndDisplayFiles();
    });
    
    // Bouton basculer vue
    document.getElementById('toggle-view-btn').addEventListener('click', () => {
      this.toggleViewMode();
      this.updateViewButton();
    });

    // Bouton actualiser
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadStats();
      this.loadFiles();
    });
    
    // Sélection de fichiers
    document.getElementById('master-checkbox').addEventListener('change', (e) => {
      this.toggleAllSelection(e.target.checked);
    });
    
    document.getElementById('select-all-btn').addEventListener('click', () => {
      this.toggleAllSelection(true);
    });
    
    document.getElementById('delete-selected-btn').addEventListener('click', () => {
      this.deleteSelectedFiles();
    });
    
    // Bouton de retour
    document.querySelector('.back-btn').addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
    
    // Modales
    this.setupModals();
  }

  // Configuration des modales
  setupModals() {
    // Modal de suppression
    const deleteModal = document.getElementById('delete-modal');
    const closeDeleteModal = document.getElementById('close-delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    
    closeDeleteModal.addEventListener('click', () => {
      deleteModal.style.display = 'none';
    });
    
    cancelDeleteBtn.addEventListener('click', () => {
      deleteModal.style.display = 'none';
    });
    
    confirmDeleteBtn.addEventListener('click', () => {
      this.executeDelete();
    });
    
    // Modal de détails
    const detailsModal = document.getElementById('details-modal');
    const closeDetailsModal = document.getElementById('close-details-modal');
    const closeDetailsBtn = document.getElementById('close-details-btn');
    
    closeDetailsModal.addEventListener('click', () => {
      detailsModal.style.display = 'none';
    });
    
    closeDetailsBtn.addEventListener('click', () => {
      detailsModal.style.display = 'none';
    });
    
    // Fermer les modales en cliquant sur l'overlay
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
      }
    });
  }

  // Charger les statistiques
  async loadStats() {
    try {
      const result = await window.electronAPI.getMovieStats();
      
      if (result.success) {
        this.updateStatsDisplay(result.stats);
        this.populateFormatFilter(result.stats.formats);
      } else {
        console.error('Erreur:', result.message);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  }

  // Mettre à jour l'affichage des statistiques
  updateStatsDisplay(stats) {
    document.getElementById('total-files').textContent = stats.totalFiles || 0;
    document.getElementById('total-size').textContent = this.formatFileSize(stats.totalSize || 0);
    document.getElementById('total-duration').textContent = this.formatDuration(stats.totalDuration || 0);
    document.getElementById('files-with-thumbnails').textContent = stats.filesWithThumbnails || 0;
  }

  // Peupler le filtre des formats
  populateFormatFilter(formats) {
    const formatFilter = document.getElementById('format-filter');
    
    // Garder l'option "Tous les formats"
    formatFilter.innerHTML = '<option value="">Tous les formats</option>';
    
    if (formats && formats.length > 0) {
      formats.forEach(format => {
        const option = document.createElement('option');
        option.value = format.format;
        option.textContent = `${format.format.toUpperCase()} (${format.count})`;
        formatFilter.appendChild(option);
      });
    }
  }

  // Charger la liste des fichiers
  async loadFiles() {
    try {
      const result = await window.electronAPI.getAllMovies();
      
      if (result.success) {
        this.files = result.movies;
        
        // Vérifier l'existence de tous les fichiers
        await this.checkAllFilesExistence();
        
        this.filteredFiles = [...this.files];
        this.sortAndDisplayFiles();
        this.updateFilesCount();
      } else {
        console.error('Erreur:', result.message);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
    }
  }

  // Vérifier l'existence de tous les fichiers
  async checkAllFilesExistence() {
    const checkPromises = this.files.map(async file => {
      try {
        const result = await window.electronAPI.checkFileExists(file.path);
        file.exists = result.success ? result.exists : false;
      } catch (error) {
        console.error(`Erreur lors de la vérification de ${file.path}:`, error);
        file.exists = false;
      }
    });

    await Promise.all(checkPromises);
  }

  // Grouper les fichiers par dossier pour la vue hiérarchique
  groupFilesByFolder(files) {
    const folderMap = new Map();
    const singleFileImports = new Set(); // Pour tracker les imports de fichiers uniques
    
    files.forEach(file => {
      const pathParts = file.path.split(/[\\\/]/);
      const fileName = pathParts.pop(); // Retirer le nom du fichier
      const folderPath = pathParts.join('\\'); // Reconstituer le chemin du dossier
      
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, {
          path: folderPath,
          name: pathParts[pathParts.length - 1] || folderPath, // Nom du dernier dossier
          files: [],
          isExpanded: this.expandedFolders.has(folderPath),
          isSingleFileImport: false
        });
      }
      
      folderMap.get(folderPath).files.push({
        ...file,
        fileName: fileName
      });
    });
    
    // Identifier les imports de fichiers uniques
    // Heuristique : un dossier avec un seul fichier qui est probablement un import individuel
    folderMap.forEach((folder, folderPath) => {
      if (folder.files.length === 1) {
        const file = folder.files[0];
        
        // Conditions pour considérer comme un import de fichier unique :
        // 1. Le dossier ne contient qu'un seul fichier
        // 2. ET une des conditions suivantes :
        //    - Le fichier a été scanné récemment (imports récents)
        //    - Le nom du fichier est très différent du nom du dossier (import individuel)
        //    - C'est dans un dossier racine simple (Desktop, Documents, etc.)
        
        const isRecentlyScanned = file.last_scan && 
          (new Date() - new Date(file.last_scan)) < (2 * 24 * 60 * 60 * 1000); // 2 jours
        
        const fileName = file.fileName || file.title;
        const folderName = folder.name.toLowerCase();
        const fileNameLower = fileName.toLowerCase();
        
        // Vérifier si le nom du fichier est très différent du dossier
        const isDifferentName = !fileNameLower.includes(folderName.substring(0, 5)) && 
                               !folderName.includes(fileNameLower.substring(0, 5));
        
        // Dossiers "racine" typiques où on met souvent des fichiers individuels
        const isRootFolder = ['desktop', 'documents', 'downloads', 'téléchargements', 'bureau'].includes(folderName);
        
        if (isRecentlyScanned || isDifferentName || isRootFolder) {
          folder.isSingleFileImport = true;
        }
      }
    });
    
    // Convertir en array et trier par nom de dossier
    return Array.from(folderMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  // Filtrer les fichiers
  filterFiles() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const formatFilter = document.getElementById('format-filter').value;
    
    this.filteredFiles = this.files.filter(file => {
      const matchesSearch = !searchTerm || 
        file.title.toLowerCase().includes(searchTerm) ||
        file.path.toLowerCase().includes(searchTerm);
      
      const matchesFormat = !formatFilter || file.format === formatFilter;
      
      return matchesSearch && matchesFormat;
    });
    
    this.sortAndDisplayFiles();
    this.updateFilesCount();
  }

  // Trier et afficher les fichiers
  sortAndDisplayFiles() {
    this.filteredFiles.sort((a, b) => {
      switch (this.currentSort) {
        case 'size_bytes':
          return (b.size_bytes || 0) - (a.size_bytes || 0);
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        case 'last_scan':
          return new Date(b.last_scan) - new Date(a.last_scan);
        default: // title
          return (a.title || '').localeCompare(b.title || '');
      }
    });
    
    this.displayFiles();
  }

  // Afficher les fichiers dans le tableau
  displayFiles() {
    const tbody = document.getElementById('files-table-body');
    tbody.innerHTML = '';
    
    if (this.filteredFiles.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #888;">
            <i class="fas fa-search" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
            Aucun fichier trouvé
          </td>
        </tr>
      `;
      return;
    }
    
    if (this.viewMode === 'hierarchical') {
      this.displayHierarchicalView(tbody);
    } else {
      this.displayFlatView(tbody);
    }
  }

  // Affichage hiérarchique avec dossiers
  displayHierarchicalView(tbody) {
    const folderGroups = this.groupFilesByFolder(this.filteredFiles);
    
    folderGroups.forEach(folder => {
      if (folder.files.length === 1 && folder.isSingleFileImport) {
        // Si c'est un import de fichier unique, afficher directement le fichier
        const fileRow = this.createFileRow(folder.files[0], false);
        tbody.appendChild(fileRow);
      } else {
        // Sinon, afficher le dossier avec ses fichiers
        const folderRow = this.createFolderRow(folder);
        tbody.appendChild(folderRow);
        
        // Ajouter les fichiers du dossier si il est développé
        if (folder.isExpanded) {
          folder.files.forEach(file => {
            const fileRow = this.createFileRow(file, true); // true = isChildFile
            tbody.appendChild(fileRow);
          });
        }
      }
    });
  }

  // Affichage plat (liste simple)
  displayFlatView(tbody) {
    this.filteredFiles.forEach(file => {
      const row = this.createFileRow(file, false);
      tbody.appendChild(row);
    });
  }

  // Créer une ligne de dossier
  createFolderRow(folder) {
    const tr = document.createElement('tr');
    tr.classList.add('folder-row');
    tr.setAttribute('data-folder-path', folder.path);
    
    const fileCount = folder.files.length;
    const accessibleCount = folder.files.filter(f => f.exists !== false).length;
    const totalSize = folder.files.reduce((sum, f) => sum + (f.size_bytes || 0), 0);
    
    const expandIcon = folder.isExpanded ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
    
    tr.innerHTML = `
      <td>
        <input type="checkbox" class="folder-checkbox" data-folder-path="${folder.path}">
      </td>
      <td>
        <div class="folder-thumbnail">
          <i class="fas fa-folder"></i>
        </div>
      </td>
      <td>
        <div class="folder-info">
          <button class="folder-toggle" onclick="fileManager.toggleFolder('${folder.path.replace(/\\/g, '\\\\')}')">
            <i class="${expandIcon}"></i>
          </button>
          <div class="folder-name">${this.escapeHtml(folder.name)}</div>
          <div class="folder-path">${this.escapeHtml(folder.path)}</div>
        </div>
      </td>
      <td>
        <span class="folder-badge">Dossier</span>
      </td>
      <td>${fileCount} fichier(s)</td>
      <td>${this.formatFileSize(totalSize)}</td>
      <td>
        <span class="status-badge status-info">${accessibleCount}/${fileCount} accessible(s)</span>
      </td>
      <td>
        <div class="file-actions">
          <button class="action-btn btn-details" onclick="fileManager.openFolderInExplorer('${folder.path.replace(/\\/g, '\\\\')}')">
            <i class="fas fa-folder-open"></i>
          </button>
        </div>
      </td>
    `;
    
    return tr;
  }

  // Créer une ligne de fichier
  createFileRow(file, isChildFile = false) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-file-id', file.id);
    
    if (isChildFile) {
      tr.classList.add('child-file-row');
    }
    
    const fileExists = file.exists !== false; // Par défaut true si pas vérifié
    const statusClass = fileExists ? 'status-ok' : 'status-missing';
    const statusText = fileExists ? 'Accessible' : 'Introuvable';
    
    const fileName = isChildFile && file.fileName ? file.fileName : file.title;
    const indentClass = isChildFile ? 'child-indent' : '';
    
    tr.innerHTML = `
      <td>
        <input type="checkbox" class="file-checkbox" data-file-id="${file.id}">
      </td>
      <td>
        <div class="file-thumbnail">
          ${file.thumbnail ? 
            `<img src="file://${file.thumbnail}" alt="Miniature" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <i class="fas fa-film" style="display: none;"></i>` :
            `<i class="fas fa-film"></i>`
          }
        </div>
      </td>
      <td class="${indentClass}">
        <div class="file-name">${this.escapeHtml(fileName || 'Sans titre')}</div>
        ${!isChildFile ? `<div class="file-path">${this.escapeHtml(file.path || '')}</div>` : ''}
      </td>
      <td>
        <span class="format-badge">${(file.format || 'N/A').toUpperCase()}</span>
      </td>
      <td>${this.formatDuration(file.duration || 0)}</td>
      <td>${this.formatFileSize(file.size_bytes || 0)}</td>
      <td>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </td>
      <td>
        <div class="file-actions">
          ${fileExists ? `<button class="action-btn btn-view" onclick="fileManager.playFile(${file.id})">
            <i class="fas fa-play"></i>
          </button>` : ''}
          <button class="action-btn btn-details" onclick="fileManager.showFileDetails(${file.id})">
            <i class="fas fa-info"></i>
          </button>
          <button class="action-btn btn-delete" onclick="fileManager.deleteFile(${file.id})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    // Ajouter l'événement de sélection
    const checkbox = tr.querySelector('.file-checkbox');
    checkbox.addEventListener('change', (e) => {
      this.toggleFileSelection(file.id, e.target.checked);
    });
    
    return tr;
  }


  // Basculer la sélection d'un fichier
  toggleFileSelection(fileId, selected) {
    if (selected) {
      this.selectedFiles.add(fileId);
    } else {
      this.selectedFiles.delete(fileId);
    }
    
    this.updateBulkActions();
    this.updateMasterCheckbox();
  }

  // Basculer la sélection de tous les fichiers
  toggleAllSelection(selectAll) {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      const fileId = parseInt(checkbox.dataset.fileId);
      
      if (selectAll) {
        this.selectedFiles.add(fileId);
      } else {
        this.selectedFiles.delete(fileId);
      }
    });
    
    this.updateBulkActions();
  }

  // Mettre à jour les actions en masse
  updateBulkActions() {
    const bulkActions = document.getElementById('bulk-actions');
    const hasSelection = this.selectedFiles.size > 0;
    
    bulkActions.style.display = hasSelection ? 'flex' : 'none';
  }

  // Mettre à jour la case de sélection principale
  updateMasterCheckbox() {
    const masterCheckbox = document.getElementById('master-checkbox');
    const totalFiles = this.filteredFiles.length;
    const selectedCount = this.selectedFiles.size;
    
    masterCheckbox.checked = selectedCount === totalFiles && totalFiles > 0;
    masterCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalFiles;
  }

  // Mettre à jour le compteur de fichiers
  updateFilesCount() {
    document.getElementById('files-count').textContent = this.filteredFiles.length;
  }

  // Jouer un fichier
  async playFile(fileId) {
    try {
      const result = await window.electronAPI.playMovie(fileId);
      if (!result.success) {
        console.error('Erreur:', result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la lecture:', error);
    }
  }

  // Afficher les détails d'un fichier
  async showFileDetails(fileId) {
    try {
      const result = await window.electronAPI.getMovieDetails(fileId);
      if (result.success) {
        const file = result.movie;
        
        document.getElementById('detail-title').textContent = file.title || 'Sans titre';
        document.getElementById('detail-path').textContent = file.path || 'N/A';
        document.getElementById('detail-format').textContent = (file.format || 'N/A').toUpperCase();
        document.getElementById('detail-duration').textContent = this.formatDuration(file.duration || 0);
        document.getElementById('detail-size').textContent = this.formatFileSize(file.size_bytes || 0);
        document.getElementById('detail-last-scan').textContent = this.formatDate(file.last_scan);
        
        const thumbnailStatus = document.getElementById('detail-thumbnail-status');
        const thumbnailImg = document.getElementById('detail-thumbnail-img');
        const thumbnailPreview = document.getElementById('thumbnail-preview');
        
        if (file.thumbnail) {
          thumbnailStatus.textContent = 'Disponible';
          thumbnailImg.src = `file://${file.thumbnail}`;
          thumbnailImg.style.display = 'block';
          thumbnailPreview.style.display = 'block';
        } else {
          thumbnailStatus.textContent = 'Non disponible';
          thumbnailPreview.style.display = 'none';
        }
        
        document.getElementById('details-modal').style.display = 'flex';
      } else {
        console.error('Erreur:', result.message);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    }
  }

  // Supprimer un fichier
  deleteFile(fileId) {
    this.fileToDelete = fileId;
    document.getElementById('delete-message').textContent = 
      'Êtes-vous sûr de vouloir supprimer ce fichier de la base de données ?';
    document.getElementById('delete-modal').style.display = 'flex';
  }

  // Supprimer les fichiers sélectionnés
  deleteSelectedFiles() {
    if (this.selectedFiles.size === 0) return;
    
    this.filesToDelete = Array.from(this.selectedFiles);
    document.getElementById('delete-message').textContent = 
      `Êtes-vous sûr de vouloir supprimer ${this.selectedFiles.size} fichier(s) de la base de données ?`;
    document.getElementById('delete-modal').style.display = 'flex';
  }

  // Exécuter la suppression
  async executeDelete() {
    const filesToDelete = this.filesToDelete || [this.fileToDelete];
    
    try {
      const deletePromises = filesToDelete.map(fileId => 
        window.electronAPI.deleteMovie(fileId)
      );
      
      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.success).length;
      
      if (successful > 0) {
        // Recharger les données
        await this.loadStats();
        await this.loadFiles();
        
        // Réinitialiser la sélection
        this.selectedFiles.clear();
        this.updateBulkActions();
        
        console.log(`${successful} fichier(s) supprimé(s) avec succès`);
      }
      
      document.getElementById('delete-modal').style.display = 'none';
      
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
    
    this.fileToDelete = null;
    this.filesToDelete = null;
  }

  // Basculer l'état d'un dossier (développé/réduit)
  toggleFolder(folderPath) {
    if (this.expandedFolders.has(folderPath)) {
      this.expandedFolders.delete(folderPath);
    } else {
      this.expandedFolders.add(folderPath);
    }
    
    // Réafficher la liste
    this.displayFiles();
  }

  // Ouvrir un dossier dans l'explorateur
  async openFolderInExplorer(folderPath) {
    try {
      // Utiliser l'IPC pour ouvrir le dossier
      await window.electronAPI.openMovieFolder(1); // On utilise l'API existante
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du dossier:', error);
    }
  }

  // Basculer entre vue hiérarchique et vue plate
  toggleViewMode() {
    this.viewMode = this.viewMode === 'hierarchical' ? 'flat' : 'hierarchical';
    this.displayFiles();
  }

  // Mettre à jour le texte du bouton de vue
  updateViewButton() {
    const btn = document.getElementById('toggle-view-btn');
    const icon = btn.querySelector('i');
    const text = btn.childNodes[2]; // Le nœud texte après l'icône
    
    if (this.viewMode === 'hierarchical') {
      icon.className = 'fas fa-list';
      btn.childNodes[2].textContent = ' Vue plate';
    } else {
      icon.className = 'fas fa-sitemap';
      btn.childNodes[2].textContent = ' Vue hiérarchique';
    }
  }

  // Utilitaires
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialiser le gestionnaire de fichiers
const fileManager = new FileManagerElectron();