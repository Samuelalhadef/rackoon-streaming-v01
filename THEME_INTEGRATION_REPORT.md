# Rapport d'intégration au système de thèmes - Rackoon Streaming

## Résumé

Ce rapport identifie tous les fichiers CSS qui nécessitent une intégration au système de thèmes centralisé (`css/theme.css`).

### Variables CSS disponibles dans `theme.css`

Le système de thèmes offre actuellement **100+ variables CSS** organisées en catégories :

- **Couleurs principales** : `--color-primary`, `--color-secondary`, etc.
- **Arrière-plans** : `--bg-primary`, `--bg-secondary`, `--bg-card`, etc.
- **Texte** : `--text-primary`, `--text-secondary`, `--text-muted`, etc.
- **Bordures** : `--border-color`, `--border-color-light`, etc.
- **Ombres** : `--shadow-sm`, `--shadow-md`, `--shadow-lg`, etc.
- **Couleurs de statut** : `--color-success`, `--color-warning`, `--color-error`, etc.
- **Gradients** : `--gradient-primary`, `--gradient-accent`, etc.
- **Boutons** : `--btn-primary-bg`, `--btn-secondary-bg`, etc.
- **Inputs** : `--input-bg`, `--input-border`, etc.
- **Transitions** : `--transition-fast`, `--transition-normal`, etc.
- **Espacements** : `--spacing-xs` à `--spacing-2xl`
- **Border radius** : `--radius-sm` à `--radius-full`

---

## Fichiers CSS à adapter (par priorité)

### 🔴 Priorité HAUTE

#### 1. **video-player.css** (554 lignes)
**Couleurs hardcodées détectées** : 100+ occurrences

**Éléments à convertir** :
- ✅ Arrière-plans noirs → `var(--bg-modal)` ou `var(--bg-overlay)`
- ✅ Arrière-plans semi-transparents → Variables custom avec alpha
- ✅ Texte blanc → `var(--text-primary)`
- ✅ Boutons et contrôles → Variables de boutons
- ✅ Barres de progression → Variables custom
- ✅ Overlays → `var(--bg-overlay)`

**Exemple de conversion** :
```css
/* AVANT */
background: rgba(0, 0, 0, 0.95);
color: white;

/* APRÈS */
background: var(--bg-modal);
color: var(--text-primary);
```

---

#### 2. **modal.css** (3975 lignes) ⚠️ **LE PLUS GROS FICHIER**
**Couleurs hardcodées détectées** : 200+ occurrences

**Éléments à convertir** :
- ✅ Overlays de modal → `var(--bg-overlay)`
- ✅ Arrière-plans de modal → `var(--bg-modal)`, `var(--bg-modal-content)`
- ✅ Bordures → `var(--border-color)`
- ✅ Textes blancs/noirs → Variables de texte
- ✅ Boutons d'action → Variables de boutons
- ✅ États hover/active → Variables avec modificateurs

**Catégories dans modal.css** :
- Modales de film/série
- Formulaires d'édition
- Galeries d'images
- Sélecteurs de saisons/épisodes
- Boutons d'action

---

#### 3. **import-classification.css** (1843 lignes)
**Couleurs hardcodées détectées** : 150+ occurrences

**Éléments à convertir** :
- ✅ Interface de classification → Variables de fond
- ✅ Cartes de fichiers → `var(--bg-card)`, `var(--bg-card-hover)`
- ✅ Boutons de catégories → Variables de boutons
- ✅ États de validation → Variables de statut
- ✅ Badges et labels → Variables custom

---

#### 4. **import-triage-inline.css** (1202 lignes)
**Couleurs hardcodées détectées** : 100+ occurrences

**Éléments à convertir** :
- ✅ Interface de triage → Variables de fond
- ✅ Drag & drop zones → Variables custom
- ✅ Preview de fichiers → Variables de carte
- ✅ Actions rapides → Variables de boutons

---

### 🟡 Priorité MOYENNE

#### 5. **series-modal.css** (1018 lignes)
**Couleurs hardcodées détectées** : 80+ occurrences

**Éléments à convertir** :
- ✅ Modal de série → Variables de modal
- ✅ Grille d'épisodes → Variables de carte
- ✅ Sélecteurs de saison → Variables custom
- ✅ Badges d'épisodes → Variables de badges

---

#### 6. **file-manager-new.css** (742 lignes)
**Couleurs hardcodées détectées** : 60+ occurrences

**Éléments à convertir** :
- ✅ Arborescence de fichiers → Variables de fond
- ✅ Items de fichiers → Variables de carte
- ✅ Icônes et badges → Variables d'icônes
- ✅ États de sélection → Variables custom

---

#### 7. **filters.css** (506 lignes)
**Couleurs hardcodées détectées** : 40+ occurrences

**Éléments à convertir** :
- ✅ Sidebar de filtres → Variables de fond
- ✅ Contrôles de filtre → Variables d'input
- ✅ Badges de filtre actif → Variables de badges
- ✅ Boutons de tri → Variables de boutons

---

#### 8. **watch-party.css** (387 lignes)
**Couleurs hardcodées détectées** : 50+ occurrences

**Éléments à convertir** :
- ✅ Interface Watch Party → Variables custom `--color-watchparty`
- ✅ Chat et participants → Variables de carte
- ✅ Boutons de contrôle → Variables de boutons
- ✅ Notifications → Variables de statut

---

### 🟢 Priorité BASSE

#### 9. **stats-overview.css** (349 lignes)
**Couleurs hardcodées détectées** : 30+ occurrences

**Éléments à convertir** :
- ✅ Cartes de statistiques → Variables de carte
- ✅ Graphiques et charts → Variables custom
- ✅ Badges de données → Variables de badges
- ✅ Gradients stats → `--gradient-stats-*`

---

#### 10. **file-manager.css** (644 lignes)
**Couleurs hardcodées détectées** : 50+ occurrences

**Note** : Possiblement remplacé par `file-manager-new.css` - À vérifier avant conversion

---

## Éléments spécifiques à créer dans theme.css

### Nouvelles variables nécessaires

```css
/* Video Player */
--video-player-bg: rgba(0, 0, 0, 0.95);
--video-player-controls-bg: rgba(0, 0, 0, 0.8);
--video-player-progress-bg: rgba(255, 255, 255, 0.3);
--video-player-progress-fill: var(--color-primary);
--video-player-buffer-bg: rgba(255, 255, 255, 0.5);

/* Modal Overlays */
--modal-overlay-dark: rgba(0, 0, 0, 0.9);
--modal-overlay-light: rgba(0, 0, 0, 0.6);
--modal-backdrop-blur: blur(10px);

/* Classification */
--classification-card-bg: var(--bg-card);
--classification-card-hover: var(--bg-card-hover);
--classification-card-selected: var(--bg-card-active);

/* Drag & Drop */
--drag-zone-bg: rgba(52, 116, 219, 0.1);
--drag-zone-border: rgba(52, 116, 219, 0.3);
--drag-zone-active: rgba(52, 116, 219, 0.2);

/* File Manager */
--file-item-bg: var(--bg-card);
--file-item-hover: var(--bg-card-hover);
--file-item-selected: var(--bg-card-active);

/* Stats Charts */
--chart-bar-bg: var(--bg-card);
--chart-grid-color: var(--border-color-light);
--chart-tooltip-bg: var(--bg-modal-content);
```

---

## Plan d'action recommandé

### Phase 1 : Lecteur vidéo et modales (Semaine 1)
1. ✅ Convertir `video-player.css` avec nouvelles variables
2. ✅ Convertir `modal.css` (le plus volumineux - split en sections si nécessaire)
3. ✅ Tester la lecture vidéo avec différents thèmes
4. ✅ Tester les modales avec différents thèmes

### Phase 2 : Import et classification (Semaine 2)
1. ✅ Convertir `import-classification.css`
2. ✅ Convertir `import-triage-inline.css`
3. ✅ Tester le workflow d'import complet
4. ✅ Vérifier le drag & drop avec différents thèmes

### Phase 3 : Gestion de fichiers et filtres (Semaine 3)
1. ✅ Convertir `file-manager-new.css` (vérifier si file-manager.css est obsolète)
2. ✅ Convertir `filters.css`
3. ✅ Convertir `series-modal.css`
4. ✅ Tester la navigation et les filtres

### Phase 4 : Features secondaires (Semaine 4)
1. ✅ Convertir `watch-party.css`
2. ✅ Convertir `stats-overview.css`
3. ✅ Tests finaux de tous les écrans
4. ✅ Documentation des thèmes personnalisés

---

## Méthodologie de conversion

### Étapes pour chaque fichier :

1. **Identifier** les couleurs hardcodées
2. **Mapper** vers les variables existantes ou créer de nouvelles variables
3. **Remplacer** les valeurs hardcodées par `var(--variable-name)`
4. **Tester** avec tous les thèmes prédéfinis
5. **Documenter** les nouvelles variables ajoutées

### Script de recherche des couleurs hardcodées :

```bash
# Trouver toutes les couleurs hardcodées
grep -E "rgba?\(|#[0-9a-fA-F]{3,6}|: white|: black" fichier.css | grep -v "var(--"
```

### Pattern de remplacement :

```css
/* AVANT : Couleur hardcodée */
.element {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* APRÈS : Variables CSS */
.element {
  background: var(--bg-modal-dark);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

---

## Bénéfices attendus

✅ **Cohérence visuelle** : Tous les éléments utilisent la même palette
✅ **Facilité de maintenance** : Changement centralisé dans theme.css
✅ **Personnalisation** : Les utilisateurs peuvent créer leurs thèmes
✅ **Thèmes multiples** : Facile d'ajouter de nouveaux thèmes prédéfinis
✅ **Accessibilité** : Possibilité de créer des thèmes à haut contraste
✅ **Performance** : Pas de recalcul de styles, juste des variables CSS

---

## État actuel

### ✅ Fichiers déjà intégrés (partiellement)
- `dashboard.css` - Utilise déjà beaucoup de variables
- `theme.css` - Définitions de variables
- `theme-customizer.css` - Interface de personnalisation

### 🔴 Fichiers à convertir (priorité haute)
- `video-player.css`
- `modal.css`
- `import-classification.css`
- `import-triage-inline.css`

### 🟡 Fichiers à convertir (priorité moyenne)
- `series-modal.css`
- `file-manager-new.css`
- `filters.css`
- `watch-party.css`

### 🟢 Fichiers à convertir (priorité basse)
- `stats-overview.css`
- `file-manager.css` (si toujours utilisé)
- `style.css`

---

## Prochaines étapes immédiates

1. **Commencer par video-player.css** (fichier critique mais de taille gérable)
2. **Créer les nouvelles variables** nécessaires dans theme.css
3. **Tester avec les thèmes existants** (default-dark, etc.)
4. **Documenter le processus** pour faciliter les conversions suivantes

**Voulez-vous que je commence la conversion d'un fichier spécifique ?**
