/**
 * Interface utilisateur pour la personnalisation des thèmes
 */

class ThemeCustomizerUI {
  constructor() {
    this.overlay = null;
    this.isOpen = false;
    this.init();
  }

  init() {
    // Attendre que le ThemeManager soit initialisé
    if (!window.themeManager) {
      setTimeout(() => this.init(), 100);
      return;
    }

    this.createUI();
    this.attachEventListeners();
    console.log('🎨 Interface de personnalisation initialisée');
  }

  /**
   * Créer l'interface utilisateur
   */
  createUI() {
    // Créer l'overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'theme-customizer-overlay';
    this.overlay.innerHTML = this.getHTML();
    document.body.appendChild(this.overlay);
  }

  /**
   * Générer le HTML de l'interface
   */
  getHTML() {
    return `
      <div class="theme-customizer-panel">
        <!-- Header -->
        <div class="theme-customizer-header">
          <h2 class="theme-customizer-title">
            <i class="fas fa-palette"></i>
            Personnalisation de l'interface
          </h2>
          <button class="theme-customizer-close" id="theme-customizer-close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Contenu -->
        <div class="theme-customizer-content">
          <!-- Section Thèmes prédéfinis -->
          <div class="theme-section">
            <h3 class="theme-section-title">
              <i class="fas fa-swatchbook"></i>
              Thèmes prédéfinis
            </h3>
            <p class="theme-section-description">
              Choisissez parmi nos thèmes préconçus pour changer instantanément l'apparence de l'application
            </p>
            <div class="preset-themes-grid" id="preset-themes-grid">
              <!-- Les thèmes seront injectés ici -->
            </div>
          </div>

          <!-- Section Personnalisation -->
          <div class="theme-section">
            <h3 class="theme-section-title">
              <i class="fas fa-sliders-h"></i>
              Personnalisation avancée
            </h3>
            <p class="theme-section-description">
              Modifiez les couleurs individuellement pour créer votre thème personnalisé
            </p>
            <div class="color-editor-grid" id="color-editor-grid">
              <!-- Les éditeurs de couleur seront injectés ici -->
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="theme-customizer-footer">
          <div class="theme-actions-left">
            <button class="theme-btn theme-btn-secondary" id="theme-export-btn">
              <i class="fas fa-download"></i>
              Exporter
            </button>
            <button class="theme-btn theme-btn-secondary" id="theme-import-btn">
              <i class="fas fa-upload"></i>
              Importer
            </button>
          </div>
          <div class="theme-actions-right">
            <button class="theme-btn theme-btn-danger" id="theme-reset-btn">
              <i class="fas fa-undo"></i>
              Réinitialiser
            </button>
            <button class="theme-btn theme-btn-primary" id="theme-apply-btn">
              <i class="fas fa-check"></i>
              Appliquer
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attacher les événements
   */
  attachEventListeners() {
    // Bouton de fermeture
    const closeBtn = this.overlay.querySelector('#theme-customizer-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Clic en dehors du panel pour fermer
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Boutons d'action
    const exportBtn = this.overlay.querySelector('#theme-export-btn');
    exportBtn?.addEventListener('click', () => this.exportTheme());

    const importBtn = this.overlay.querySelector('#theme-import-btn');
    importBtn?.addEventListener('click', () => this.importTheme());

    const resetBtn = this.overlay.querySelector('#theme-reset-btn');
    resetBtn?.addEventListener('click', () => this.resetTheme());

    const applyBtn = this.overlay.querySelector('#theme-apply-btn');
    applyBtn?.addEventListener('click', () => this.close());

    // Écouter les changements de thème
    window.addEventListener('theme-changed', () => this.updateUI());
  }

  /**
   * Ouvrir l'interface
   */
  open() {
    this.isOpen = true;
    this.overlay.classList.add('active');
    this.updateUI();
  }

  /**
   * Fermer l'interface
   */
  close() {
    this.isOpen = false;
    this.overlay.classList.remove('active');
  }

  /**
   * Basculer l'affichage
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Mettre à jour l'interface
   */
  updateUI() {
    this.renderPresetThemes();
    this.renderColorEditors();
  }

  /**
   * Afficher les thèmes prédéfinis
   */
  renderPresetThemes() {
    const grid = this.overlay.querySelector('#preset-themes-grid');
    if (!grid) return;

    const themes = window.themeManager.getAllThemes();
    const currentTheme = window.themeManager.getCurrentTheme();

    grid.innerHTML = themes.map(theme => `
      <div class="preset-theme-card ${currentTheme?.id === theme.id ? 'active' : ''}"
           data-theme-id="${theme.id}">
        <div class="theme-preview">
          <div class="theme-preview-color" style="background: ${theme.colors.primary}"></div>
          <div class="theme-preview-color" style="background: ${theme.colors.secondary}"></div>
          <div class="theme-preview-color" style="background: ${theme.colors['bg-primary']}"></div>
          <div class="theme-preview-color" style="background: ${theme.colors['bg-card']}"></div>
        </div>
        <div class="preset-theme-name">${theme.name}</div>
        <div class="preset-theme-description">${theme.description}</div>
      </div>
    `).join('');

    // Attacher les événements de clic
    grid.querySelectorAll('.preset-theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.themeId;
        window.themeManager.applyTheme({ id: themeId });
      });
    });
  }

  /**
   * Afficher les éditeurs de couleur
   */
  renderColorEditors() {
    const grid = this.overlay.querySelector('#color-editor-grid');
    if (!grid) return;

    const currentTheme = window.themeManager.getCurrentTheme();
    if (!currentTheme) return;

    const mainColors = [
      'primary', 'primary-dark', 'secondary',
      'bg-primary', 'bg-secondary', 'bg-card',
      'text-primary', 'text-secondary'
    ];

    grid.innerHTML = mainColors.map(colorKey => {
      const colorValue = currentTheme.colors[colorKey] || '#000000';
      return `
        <div class="color-editor-item">
          <div class="color-editor-label">
            ${this.formatColorLabel(colorKey)}
          </div>
          <div class="color-editor-input-group">
            <div class="color-picker-wrapper">
              <input type="color"
                     class="color-picker-input"
                     data-color-key="${colorKey}"
                     value="${colorValue}">
            </div>
            <input type="text"
                   class="color-text-input"
                   data-color-key="${colorKey}"
                   value="${colorValue}"
                   maxlength="7"
                   pattern="^#[0-9A-Fa-f]{6}$">
          </div>
        </div>
      `;
    }).join('');

    // Attacher les événements de changement de couleur
    grid.querySelectorAll('.color-picker-input, .color-text-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const colorKey = e.target.dataset.colorKey;
        const colorValue = e.target.value;

        // Synchroniser les deux inputs
        const sibling = e.target.classList.contains('color-picker-input')
          ? input.parentElement.nextElementSibling
          : input.parentElement.querySelector('.color-picker-input');

        if (sibling) {
          sibling.value = colorValue;
        }

        // Mettre à jour le thème
        window.themeManager.updateColor(colorKey, colorValue);
      });
    });
  }

  /**
   * Formater le label de couleur
   */
  formatColorLabel(colorKey) {
    return colorKey
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Exporter le thème
   */
  exportTheme() {
    const theme = window.themeManager.exportTheme();
    if (!theme) return;

    const dataStr = JSON.stringify(theme, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportName = `rackoon-theme-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();

    console.log('📦 Thème exporté:', exportName);
  }

  /**
   * Importer un thème
   */
  importTheme() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const themeData = JSON.parse(event.target.result);
          window.themeManager.importTheme(themeData);
          console.log('📦 Thème importé:', themeData.name);
        } catch (error) {
          console.error('❌ Erreur lors de l\'importation du thème:', error);
          alert('Erreur lors de l\'importation du thème. Vérifiez que le fichier est valide.');
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }

  /**
   * Réinitialiser au thème par défaut
   */
  resetTheme() {
    if (confirm('Voulez-vous vraiment réinitialiser au thème par défaut ?')) {
      window.themeManager.resetToDefault();
    }
  }
}

// Initialiser l'interface au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.themeCustomizerUI = new ThemeCustomizerUI();
});
