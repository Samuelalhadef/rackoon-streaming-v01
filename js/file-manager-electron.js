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

    // Bouton déplier/replier tout
    document.getElementById('expand-all-btn').addEventListener('click', () => {
      this.toggleExpandAll();
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
      const result = await window.electronAPI.getMediaStats();
      
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
    document.getElementById('total-size').textContent = window.formatFileSize(stats.totalSize || 0);
    document.getElementById('total-duration').textContent = window.formatTime(stats.totalDuration || 0);
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
      const result = await window.electronAPI.getAllMedias();
      
      if (result.success) {
        this.files = result.medias;
        
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
          // Organiser les fichiers par sous-dossiers pour une meilleure hiérarchie
          const subFolderMap = new Map();
          const directFiles = [];
          
          folder.files.forEach(file => {
            const relativePath = file.path.substring(folder.path.length + 1);
            const pathParts = relativePath.split(/[\\\/]/);
            
            if (pathParts.length === 1) {
              // Fichier direct dans le dossier
              directFiles.push(file);
            } else {
              // Fichier dans un sous-dossier
              const subFolderName = pathParts[0];
              if (!subFolderMap.has(subFolderName)) {
                subFolderMap.set(subFolderName, []);
              }
              subFolderMap.get(subFolderName).push(file);
            }
          });
          
          // Afficher d'abord les fichiers directs
          directFiles.forEach((file, index) => {
            const isLastFile = index === directFiles.length - 1 && subFolderMap.size === 0;
            const fileRow = this.createFileRow(file, true, 1, isLastFile);
            tbody.appendChild(fileRow);
          });
          
          // Puis afficher les sous-dossiers et leurs fichiers
          let subFolderIndex = 0;
          subFolderMap.forEach((files, subFolderName) => {
            subFolderIndex++;
            const isLastSubFolder = subFolderIndex === subFolderMap.size;
            
            files.forEach((file, fileIndex) => {
              const depth = this.calculateFileDepth(file.path, folder.path);
              const isLastFile = fileIndex === files.length - 1 && isLastSubFolder;
              const fileRow = this.createFileRow(file, true, depth, isLastFile);
              tbody.appendChild(fileRow);
            });
          });
        }
      }
    });
    
    // Attacher les événements des dossiers APRÈS l'insertion dans le DOM
    this.attachFolderEvents(folderGroups);
  }

  // Attacher les événements de clic sur les checkboxes des dossiers
  attachFolderEvents(folderGroups) {
    console.log('🔗 Attachement des événements de dossier pour', folderGroups.length, 'dossiers');
    
    folderGroups.forEach(folder => {
      const folderId = this.getFolderId(folder.path);
      const folderCheckbox = document.getElementById(`folder-checkbox-${folderId}`);
      
      if (folderCheckbox) {
        // Supprimer l'ancien listener s'il existe pour éviter les doublons
        folderCheckbox.removeEventListener('change', folderCheckbox._folderHandler);
        
        // Créer le nouveau handler
        const folderHandler = (e) => {
          e.stopPropagation();
          console.log('📁 Clic sur checkbox du dossier:', folder.path);
          this.toggleFolderSelection(folder.path, folderCheckbox.checked);
        };
        
        // Stocker la référence pour pouvoir la supprimer plus tard
        folderCheckbox._folderHandler = folderHandler;
        
        // Attacher l'événement
        folderCheckbox.addEventListener('change', folderHandler);
        
        console.log(`✅ Événement attaché pour le dossier: ${folder.path} (ID: ${folderId})`);
      } else {
        console.error(`❌ Impossible de trouver la checkbox du dossier: ${folder.path} (ID: ${folderId})`);
      }
    });
  }

  // Calculer la profondeur d'un fichier par rapport à son dossier parent
  calculateFileDepth(filePath, baseFolderPath) {
    const filePathParts = filePath.split(/[\\\/]/);
    const baseParts = baseFolderPath.split(/[\\\/]/);
    
    // La profondeur est la différence entre le nombre de parties moins 1 (pour le fichier lui-même)
    return Math.max(1, filePathParts.length - baseParts.length);
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
    const folderId = this.getFolderId(folder.path);
    
    tr.innerHTML = `
      <td>
        <input type="checkbox" id="folder-checkbox-${folderId}" class="folder-checkbox" data-folder-path="${this.escapeHtml(folder.path)}">
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
      <td>${window.formatFileSize(totalSize)}</td>
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
  createFileRow(file, isChildFile = false, depth = 1, isLastInFolder = false) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-file-id', file.id);
    
    if (isChildFile) {
      tr.classList.add('child-file-row');
      tr.setAttribute('data-depth', depth.toString());
      
      if (isLastInFolder) {
        tr.classList.add('last-in-folder');
      }
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
      <td>${window.formatTime(file.duration || 0)}</td>
      <td>${window.formatFileSize(file.size_bytes || 0)}</td>
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
    this.updateFolderCheckboxes();
  }

  // Basculer la sélection d'un dossier et de tous ses fichiers
  toggleFolderSelection(folderPath, selected) {
    console.log(`📁 ${selected ? 'Sélection' : 'Désélection'} du dossier: "${folderPath}"`);
    
    // Si on sélectionne le dossier, l'ouvrir automatiquement (et tous ses sous-dossiers)
    if (selected) {
      this.expandFolderRecursively(folderPath);
    }
    
    console.log(`📁 Recherche de fichiers dans ${this.filteredFiles.length} fichiers totaux`);
    
    // Trouver tous les fichiers de ce dossier ET de ses sous-dossiers dans la liste filtrée
    const folderFiles = this.filteredFiles.filter(file => {
      const fileFolderPath = file.path.split(/[\\\/]/).slice(0, -1).join('\\');
      
      console.log(`🔍 Comparaison: "${fileFolderPath}" avec "${folderPath}"`);
      
      // Comparaison simple ET sous-dossier (avec logs détaillés)
      const isExactMatch = fileFolderPath === folderPath;
      const isSubFolder = fileFolderPath.startsWith(folderPath + '\\') || fileFolderPath.startsWith(folderPath + '/');
      
      console.log(`   - Exact match: ${isExactMatch}`);
      console.log(`   - Sub folder: ${isSubFolder}`);
      
      return isExactMatch || isSubFolder;
    });
    
    console.log(`📁 Fichiers trouvés dans le dossier "${folderPath}": ${folderFiles.length}`);
    console.log(`📁 Détails des fichiers:`, folderFiles.map(f => ({ name: f.title, path: f.path, id: f.id })));
    
    // Sélectionner/désélectionner tous les fichiers du dossier
    folderFiles.forEach(file => {
      console.log(`${selected ? '☑️ Sélection' : '☐ Désélection'} du fichier: ${file.title} (ID: ${file.id})`);
      
      if (selected) {
        this.selectedFiles.add(file.id);
      } else {
        this.selectedFiles.delete(file.id);
      }
      
      // Mettre à jour visuellement la checkbox du fichier
      const fileCheckbox = document.querySelector(`.file-checkbox[data-file-id="${file.id}"]`);
      if (fileCheckbox) {
        fileCheckbox.checked = selected;
        console.log(`✅ Checkbox du fichier ${file.id} mise à jour: ${selected}`);
      } else {
        console.warn(`⚠️ Checkbox introuvable pour le fichier ${file.id}`);
      }
    });
    
    this.updateBulkActions();
    this.updateMasterCheckbox();
    
    console.log(`📁 Nombre total de fichiers sélectionnés: ${this.selectedFiles.size}`);
  }

  // Normaliser un chemin pour la comparaison
  normalizePath(path) {
    return path.replace(/[\/\\]/g, '\\').toLowerCase();
  }

  // Vérifier si un chemin est un sous-chemin d'un autre (strictement)
  isSubPath(childPath, parentPath) {
    // Le chemin enfant doit commencer par le parent + un séparateur
    return childPath.startsWith(parentPath + '\\') && childPath !== parentPath;
  }

  // Dérouler récursivement un dossier et tous ses sous-dossiers
  expandFolderRecursively(folderPath) {
    console.log(`🔄 Déroulement automatique du dossier: ${folderPath}`);
    
    // Vérifier si le dossier était fermé
    const wasCollapsed = !this.expandedFolders.has(folderPath);
    
    // Marquer ce dossier comme étendu
    this.expandedFolders.add(folderPath);
    
    // Trouver tous les sous-dossiers dans ce dossier
    const subFolders = this.getAllSubfolders(folderPath);
    
    // Étendre tous les sous-dossiers
    subFolders.forEach(subFolder => {
      this.expandedFolders.add(subFolder);
      console.log(`📂 Sous-dossier auto-étendu: ${subFolder}`);
    });
    
    // Réafficher la liste pour montrer les dossiers déroulés
    if (wasCollapsed || subFolders.length > 0) {
      this.displayFiles();
      
      // Petit effet visuel pour indiquer l'ouverture automatique
      setTimeout(() => {
        const folderRow = document.querySelector(`tr[data-folder-path="${folderPath}"]`);
        if (folderRow) {
          folderRow.style.backgroundColor = 'rgba(0, 122, 204, 0.2)';
          setTimeout(() => {
            folderRow.style.backgroundColor = '';
          }, 1000);
        }
      }, 100);
      
      console.log(`📁 Dossier ${folderPath} auto-étendu avec ${subFolders.length} sous-dossiers`);
    }
  }

  // Obtenir tous les sous-dossiers d'un dossier donné
  getAllSubfolders(parentFolderPath) {
    const subFolders = new Set();
    
    // Parcourir tous les fichiers pour trouver les sous-dossiers
    this.filteredFiles.forEach(file => {
      const fileFolderPath = file.path.split(/[\\\/]/).slice(0, -1).join('\\');
      
      // Vérifier si ce fichier est dans un sous-dossier du dossier parent
      if (fileFolderPath.startsWith(parentFolderPath) && fileFolderPath !== parentFolderPath) {
        // Extraire tous les niveaux de sous-dossiers
        const relativePath = fileFolderPath.substring(parentFolderPath.length + 1);
        const subFolderParts = relativePath.split(/[\\\/]/);
        
        // Ajouter chaque niveau de sous-dossier
        let currentPath = parentFolderPath;
        subFolderParts.forEach(part => {
          currentPath = currentPath + '\\' + part;
          subFolders.add(currentPath);
        });
      }
    });
    
    return Array.from(subFolders);
  }

  // Basculer la sélection de tous les fichiers
  toggleAllSelection(selectAll) {
    if (selectAll) {
      // Si on sélectionne tout, d'abord déplier tous les dossiers
      this.expandAllFolders();
    }
    
    const checkboxes = document.querySelectorAll('.file-checkbox');
    const folderCheckboxes = document.querySelectorAll('.folder-checkbox');
    
    // Sélectionner/désélectionner tous les fichiers
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      const fileId = parseInt(checkbox.dataset.fileId);
      
      if (selectAll) {
        this.selectedFiles.add(fileId);
      } else {
        this.selectedFiles.delete(fileId);
      }
    });
    
    // Mettre à jour les checkboxes des dossiers
    folderCheckboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      checkbox.indeterminate = false;
    });
    
    this.updateBulkActions();
  }

  // Déplier tous les dossiers (pour "Tout sélectionner")
  expandAllFolders() {
    console.log('🔄 Dépliage automatique de tous les dossiers');
    
    // Récupérer tous les chemins de dossiers uniques
    const allFolderPaths = new Set();
    
    this.filteredFiles.forEach(file => {
      const filePath = file.path;
      const pathParts = filePath.split(/[\\\/]/);
      
      // Créer tous les niveaux de chemin
      for (let i = 1; i < pathParts.length; i++) {
        const folderPath = pathParts.slice(0, i).join('\\');
        if (folderPath) {
          allFolderPaths.add(folderPath);
        }
      }
    });
    
    // Marquer tous les dossiers comme étendus
    allFolderPaths.forEach(folderPath => {
      this.expandedFolders.add(folderPath);
    });
    
    console.log(`📁 ${allFolderPaths.size} dossiers étendus automatiquement`);
    
    // Réafficher avec tous les dossiers ouverts
    this.displayFiles();
    
    // Petit effet visuel pour montrer l'expansion globale
    setTimeout(() => {
      const allFolderRows = document.querySelectorAll('.folder-row');
      allFolderRows.forEach((row, index) => {
        setTimeout(() => {
          row.style.backgroundColor = 'rgba(0, 122, 204, 0.15)';
          setTimeout(() => {
            row.style.backgroundColor = '';
          }, 500);
        }, index * 50); // Effet cascade
      });
    }, 100);
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

  // Mettre à jour l'état des checkboxes des dossiers
  updateFolderCheckboxes() {
    if (this.viewMode !== 'hierarchical') return;
    
    const folderGroups = this.groupFilesByFolder(this.filteredFiles);
    
    folderGroups.forEach(folder => {
      // Utiliser un sélecteur plus spécifique avec l'ID du dossier
      const folderId = this.getFolderId(folder.path);
      const folderCheckbox = document.getElementById(`folder-checkbox-${folderId}`);
      if (!folderCheckbox) {
        console.warn(`⚠️ Checkbox de dossier introuvable pour: ${folder.path} (ID: ${folderId})`);
        return;
      }
      
      // Compter combien de fichiers de ce dossier ET de ses sous-dossiers sont sélectionnés
      const normalizedFolderPath = this.normalizePath(folder.path);
      const allFolderFiles = this.filteredFiles.filter(file => {
        const fileFolderPath = this.normalizePath(file.path.split(/[\\\/]/).slice(0, -1).join('\\'));
        return fileFolderPath === normalizedFolderPath || 
               this.isSubPath(fileFolderPath, normalizedFolderPath);
      });
      const folderFileIds = allFolderFiles.map(f => f.id);
      const selectedInFolder = folderFileIds.filter(id => this.selectedFiles.has(id));
      
      if (selectedInFolder.length === 0) {
        // Aucun fichier sélectionné
        folderCheckbox.checked = false;
        folderCheckbox.indeterminate = false;
      } else if (selectedInFolder.length === folderFileIds.length) {
        // Tous les fichiers sélectionnés
        folderCheckbox.checked = true;
        folderCheckbox.indeterminate = false;
      } else {
        // Sélection partielle
        folderCheckbox.checked = false;
        folderCheckbox.indeterminate = true;
      }
    });
  }

  // Mettre à jour le compteur de fichiers
  updateFilesCount() {
    document.getElementById('files-count').textContent = this.filteredFiles.length;
  }

  // Jouer un fichier
  async playFile(fileId) {
    try {
      const result = await window.electronAPI.playMedia(fileId);
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
      const result = await window.electronAPI.getMediaDetails(fileId);
      if (result.success) {
        const file = result.movie;
        
        document.getElementById('detail-title').textContent = file.title || 'Sans titre';
        document.getElementById('detail-path').textContent = file.path || 'N/A';
        document.getElementById('detail-format').textContent = (file.format || 'N/A').toUpperCase();
        document.getElementById('detail-duration').textContent = window.formatTime(file.duration || 0);
        document.getElementById('detail-size').textContent = window.formatFileSize(file.size_bytes || 0);
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
      await window.electronAPI.openMediaFolder(1); // On utilise l'API existante
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

  // Basculer entre déplier tout / replier tout
  toggleExpandAll() {
    const expandBtn = document.getElementById('expand-all-btn');
    const icon = expandBtn.querySelector('i');
    
    // Vérifier si tous les dossiers sont dépliés
    const allFolders = this.getAllUniqueFolderPaths();
    const allExpanded = allFolders.every(folderPath => this.expandedFolders.has(folderPath));
    
    if (allExpanded) {
      // Tout replier
      console.log('📁 Repliage de tous les dossiers');
      this.expandedFolders.clear();
      icon.className = 'fas fa-plus-square';
      expandBtn.childNodes[2].textContent = ' Tout déplier';
    } else {
      // Tout déplier
      console.log('📂 Dépliage de tous les dossiers');
      this.expandAllFolders();
      icon.className = 'fas fa-minus-square';
      expandBtn.childNodes[2].textContent = ' Tout replier';
    }
    
    this.displayFiles();
  }

  // Obtenir tous les chemins de dossiers uniques
  getAllUniqueFolderPaths() {
    const folderPaths = new Set();
    
    this.filteredFiles.forEach(file => {
      const filePath = file.path;
      const pathParts = filePath.split(/[\\\/]/);
      
      // Créer tous les niveaux de chemin
      for (let i = 1; i < pathParts.length; i++) {
        const folderPath = pathParts.slice(0, i).join('\\');
        if (folderPath) {
          folderPaths.add(folderPath);
        }
      }
    });
    
    return Array.from(folderPaths);
  }

  // Utilitaires

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Échapper les caractères spéciaux pour les sélecteurs CSS
  escapeCSSSelector(selector) {
    // Échapper les caractères spéciaux CSS : \ / [ ] ( ) { } : " '
    return selector.replace(/[\\\/\[\](){}"':]/g, '\\$&');
  }

  // Générer un ID unique pour un dossier basé sur son chemin
  getFolderId(folderPath) {
    // Créer un hash simple du chemin pour éviter les caractères spéciaux
    let hash = 0;
    for (let i = 0; i < folderPath.length; i++) {
      const char = folderPath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }
}

// Initialiser le gestionnaire de fichiers
const fileManager = new FileManagerElectron();