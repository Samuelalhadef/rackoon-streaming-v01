/**
 * Gestionnaire de thèmes Rackoon Streaming
 * Gère l'application et la personnalisation des thèmes
 */

class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.presetThemes = [];
    this.customTheme = null;
    this.init();
  }

  async init() {
    console.log('🎨 Initialisation du gestionnaire de thèmes...');

    // Charger les thèmes prédéfinis
    await this.loadPresetThemes();

    // Charger le thème sauvegardé ou appliquer le thème par défaut
    const savedTheme = this.loadSavedTheme();
    if (savedTheme) {
      await this.applyTheme(savedTheme);
    } else {
      await this.applyTheme({ id: 'default-dark' });
    }

    console.log('✅ Gestionnaire de thèmes initialisé');
  }

  /**
   * Charger les thèmes prédéfinis depuis le fichier JSON
   */
  async loadPresetThemes() {
    try {
      const response = await fetch('../css/themes/presets.json');
      const data = await response.json();
      this.presetThemes = data.themes;
      console.log(`📦 ${this.presetThemes.length} thèmes prédéfinis chargés`);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des thèmes prédéfinis:', error);
      this.presetThemes = [];
    }
  }

  /**
   * Appliquer un thème
   * @param {Object} theme - Thème à appliquer (peut être un ID ou un objet complet)
   */
  async applyTheme(theme) {
    let themeToApply = null;

    // Si c'est juste un ID, chercher dans les presets
    if (typeof theme === 'string' || (theme && theme.id && !theme.colors)) {
      const themeId = typeof theme === 'string' ? theme : theme.id;
      themeToApply = this.presetThemes.find(t => t.id === themeId);

      if (!themeToApply) {
        console.error(`❌ Thème "${themeId}" non trouvé`);
        return;
      }
    } else {
      themeToApply = theme;
    }

    console.log(`🎨 Application du thème: ${themeToApply.name || themeToApply.id}`);

    // Ajouter la classe de transition
    document.body.classList.add('theme-changing');

    // Appliquer les variables CSS
    this.applyColors(themeToApply.colors);

    // Sauvegarder le thème actuel
    this.currentTheme = themeToApply;
    this.saveTheme(themeToApply);

    // Retirer la classe de transition après l'animation
    setTimeout(() => {
      document.body.classList.remove('theme-changing');
    }, 300);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: themeToApply }));
  }

  /**
   * Appliquer les couleurs au document
   */
  applyColors(colors) {
    const root = document.documentElement;

    // Appliquer chaque couleur comme variable CSS
    Object.entries(colors).forEach(([key, value]) => {
      // Si la clé commence par "bg-" ou "text-", on l'applique directement
      // Sinon on ajoute le préfixe "--color-"
      if (key.startsWith('bg-') || key.startsWith('text-')) {
        root.style.setProperty(`--${key}`, value);
      } else {
        root.style.setProperty(`--color-${key}`, value);
      }
    });

    // Recréer les gradients avec les nouvelles couleurs
    if (colors.primary && colors['primary-dark']) {
      root.style.setProperty(
        '--gradient-accent',
        `linear-gradient(135deg, ${colors.primary}, ${colors['primary-dark']})`
      );
      root.style.setProperty(
        '--gradient-accent-hover',
        `linear-gradient(135deg, ${colors['primary-dark']}, ${colors['primary-darker'] || colors['primary-dark']})`
      );
    }

    if (colors['bg-primary'] && colors['bg-secondary']) {
      root.style.setProperty(
        '--gradient-primary',
        `linear-gradient(135deg, ${colors['bg-primary']} 0%, ${colors['bg-secondary']} 100%)`
      );
      root.style.setProperty(
        '--gradient-primary-hover',
        `linear-gradient(135deg, ${colors['bg-secondary']} 0%, ${colors['bg-card-hover'] || colors['bg-card']} 100%)`
      );
    }
  }

  /**
   * Créer un thème personnalisé
   */
  createCustomTheme(name, colors) {
    const customTheme = {
      id: `custom-${Date.now()}`,
      name: name,
      description: 'Thème personnalisé',
      custom: true,
      colors: colors
    };

    this.customTheme = customTheme;
    this.saveCustomTheme(customTheme);

    return customTheme;
  }

  /**
   * Modifier une couleur du thème actuel
   */
  updateColor(colorKey, colorValue) {
    if (!this.currentTheme) return;

    // Créer un nouveau thème personnalisé basé sur le thème actuel
    const newColors = { ...this.currentTheme.colors, [colorKey]: colorValue };

    // Si c'est déjà un thème personnalisé, le mettre à jour
    if (this.currentTheme.custom) {
      this.currentTheme.colors = newColors;
      this.saveCustomTheme(this.currentTheme);
    } else {
      // Sinon, créer un nouveau thème personnalisé
      const customTheme = this.createCustomTheme(
        `${this.currentTheme.name} (Personnalisé)`,
        newColors
      );
      this.currentTheme = customTheme;
    }

    // Appliquer la nouvelle couleur immédiatement
    this.applyColors(this.currentTheme.colors);
  }

  /**
   * Obtenir tous les thèmes disponibles
   */
  getAllThemes() {
    const themes = [...this.presetThemes];

    // Ajouter le thème personnalisé s'il existe
    if (this.customTheme) {
      themes.push(this.customTheme);
    }

    return themes;
  }

  /**
   * Obtenir le thème actuel
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Sauvegarder le thème dans localStorage
   */
  saveTheme(theme) {
    try {
      localStorage.setItem('rackoon_theme', JSON.stringify({
        id: theme.id,
        custom: theme.custom || false,
        colors: theme.custom ? theme.colors : undefined
      }));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du thème:', error);
    }
  }

  /**
   * Sauvegarder un thème personnalisé
   */
  saveCustomTheme(theme) {
    try {
      localStorage.setItem('rackoon_custom_theme', JSON.stringify(theme));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du thème personnalisé:', error);
    }
  }

  /**
   * Charger le thème sauvegardé
   */
  loadSavedTheme() {
    try {
      const saved = localStorage.getItem('rackoon_theme');
      if (!saved) return null;

      const themeData = JSON.parse(saved);

      // Si c'est un thème personnalisé, charger les données complètes
      if (themeData.custom) {
        const customTheme = localStorage.getItem('rackoon_custom_theme');
        if (customTheme) {
          this.customTheme = JSON.parse(customTheme);
          return this.customTheme;
        }
      }

      return themeData;
    } catch (error) {
      console.error('❌ Erreur lors du chargement du thème sauvegardé:', error);
      return null;
    }
  }

  /**
   * Réinitialiser au thème par défaut
   */
  resetToDefault() {
    this.applyTheme({ id: 'default-dark' });
  }

  /**
   * Exporter le thème actuel
   */
  exportTheme() {
    if (!this.currentTheme) return null;

    return {
      name: this.currentTheme.name,
      description: this.currentTheme.description,
      colors: this.currentTheme.colors
    };
  }

  /**
   * Importer un thème
   */
  importTheme(themeData) {
    try {
      const customTheme = {
        id: `imported-${Date.now()}`,
        name: themeData.name || 'Thème importé',
        description: themeData.description || '',
        custom: true,
        colors: themeData.colors
      };

      this.customTheme = customTheme;
      this.saveCustomTheme(customTheme);
      this.applyTheme(customTheme);

      return customTheme;
    } catch (error) {
      console.error('❌ Erreur lors de l\'importation du thème:', error);
      return null;
    }
  }
}

// Initialiser le gestionnaire de thèmes au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
});
