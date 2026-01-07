# Plan d'action - Nettoyage de modal.css

**Fichier source** : `css/modal.css` (3975 lignes)
**Fichier de référence** : `CSS_MODAL_DETAILED_ANALYSIS.md`
**Objectif** : Réduire à ~2500 lignes, éliminer doublons et code obsolète

---

## PHASE A : BACKUPS ET SUPPRESSION DU CODE OBSOLÈTE

### A.1 - Créer les backups (OBLIGATOIRE)

```bash
# Créer le dossier de backup s'il n'existe pas
mkdir -p css/backup

# Backup avec timestamp
cp css/modal.css css/backup/modal.css.backup_$(date +%Y%m%d_%H%M%S)

# Vérifier que le backup existe
ls -lh css/backup/
```

**Validation** : ✅ Fichier backup créé avec succès

---

### A.2 - Supprimer les blocs obsolètes (DU BAS VERS LE HAUT)

⚠️ **IMPORTANT** : Supprimer du bas vers le haut pour ne pas décaler les numéros de lignes

#### A.2.1 - Bloc 10 : Ancien modal-actions (~ligne 3965)
```bash
# Trouver la ligne exacte
grep -n "Masquer l'ancien container modal-actions" css/modal.css
```
**Lignes à supprimer** : [À déterminer après grep]

**Action** :
1. Ouvrir modal.css
2. Localiser le bloc
3. Supprimer le commentaire + code commenté
4. Sauvegarder
5. Tester la modal
6. Git commit : `git commit -m "Clean: Remove obsolete modal-actions block"`

---

#### A.2.2 - Bloc 9 : Éléments obsolètes (~ligne 3839)
```bash
grep -n "Masquer tous les éléments d'édition obsolètes" css/modal.css
```
**Action** : Même procédure que A.2.1

---

#### A.2.3 - Bloc 8 : Hover bouton (~ligne 2578)
```bash
grep -n "ANCIEN STYLE .edit-mode - Hover bouton" css/modal.css
```
**Action** : Même procédure que A.2.1

---

#### A.2.4 - Bloc 7 : Dropdowns (~ligne 2546)
```bash
grep -n "ANCIENS STYLES .edit-mode - Dropdowns et boutons" css/modal.css
```
**Action** : Même procédure que A.2.1

---

#### A.2.5 - Bloc 6 : TMDB (~ligne 2503)
```bash
grep -n "ANCIENS STYLES .edit-mode - TMDB et boutons" css/modal.css
```
**Action** : Même procédure que A.2.1

---

#### A.2.6 - Bloc 5 : Sélection image (~ligne 2456)
```bash
grep -n "ANCIENS STYLES .edit-mode - Sélection d'image" css/modal.css
```
**Action** : Même procédure que A.2.1

---

#### A.2.7 - Bloc 4 : Edit-mode suite (~ligne 1455)
```bash
grep -n "ANCIENS STYLES .edit-mode - Suite désactivée" css/modal.css
```
**Action** : Même procédure que A.2.1

---

#### A.2.8 - Bloc 3 : Edit-mode (lignes 1422-1453)
```bash
grep -n "ANCIENS STYLES .edit-mode - Désactivés (suite)" css/modal.css
```
**Lignes exactes** : 1422-1453 (32 lignes)

**Action** :
1. Ouvrir modal.css
2. Sélectionner lignes 1422-1453
3. Supprimer
4. Sauvegarder
5. Tester
6. Git commit

---

#### A.2.9 - Bloc 2 : Mode édition (lignes 1411-1420)
```bash
grep -n "ANCIENS STYLES MODE ÉDITION - Désactivés" css/modal.css
```
**Lignes exactes** : 1411-1420 (10 lignes)

**Action** : Même procédure

---

#### A.2.10 - Bloc 1 : Styles obsolètes (lignes 254-275)
```bash
grep -n "STYLES OBSOLÈTES - Ancienne version du mode édition" css/modal.css
```
**Lignes exactes** : 254-275 (22 lignes)

**Action** : Même procédure

---

### A.3 - Vérification post-suppression

**Tests à effectuer** :
- [ ] Ouvrir modal de film normal
- [ ] Ouvrir modal en mode édition
- [ ] Vérifier que tout fonctionne
- [ ] Pas d'erreurs dans la console

**Validation** :
```bash
# Compter les lignes avant/après
wc -l css/modal.css

# Vérifier qu'il ne reste pas de blocs obsolètes
grep -i "obsolète\|ancien" css/modal.css
```

**Estimation** : modal.css devrait passer de ~3975 à ~3600 lignes (-~400 lignes)

---

## PHASE B : FUSION DES DOUBLONS

### B.1 - Fusionner .modal-content (3 → 1 définition)

#### B.1.1 - Identifier les 3 définitions actuelles

```bash
grep -n "^\.modal-content\s*{" css/modal.css
```
Résultat attendu :
- Ligne ~646 : Définition BASE
- Ligne ~1374 : Définition ANIMATION
- Ligne ~3032 : Définition OVERRIDE

---

#### B.1.2 - Créer la définition unifiée

**Nouvelle définition** (remplace les 3) :
```css
.modal-content {
  flex: 1;
  padding: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 100%;
  min-width: 0;
  max-width: 100%;
  justify-content: flex-start;
  align-items: stretch;
  height: 100%;
  animation: slideInRight 0.8s ease-out 0.4s both;
}

.modal-content > * {
  margin-bottom: 28px;
}

.modal-content > *:last-child {
  margin-bottom: 0;
}
```

---

#### B.1.3 - Appliquer la fusion

**Étapes** :
1. **Remplacer la 1ère définition** (ligne ~646) par la nouvelle version unifiée
2. **Supprimer la 2ème définition** (ligne ~1374)
3. **Supprimer la 3ème définition** (ligne ~3032)
4. Sauvegarder
5. Tester
6. Git commit : `git commit -m "Refactor: Merge 3 .modal-content definitions into 1"`

**Validation** :
```bash
# Vérifier qu'il ne reste qu'1 définition
grep -n "^\.modal-content\s*{" css/modal.css | wc -l
# Résultat attendu : 1
```

---

### B.2 - Fusionner .modal-poster (3 → 1 définition)

#### B.2.1 - Identifier les 3 définitions

```bash
grep -n "^\.modal-poster\s*{" css/modal.css
```
Résultat attendu :
- Ligne ~623 : BASE
- Ligne ~1370 : ANIMATION
- Ligne ~2752 : OVERRIDE

---

#### B.2.2 - Créer la définition unifiée

```css
.modal-poster {
  position: relative;
  flex: 0 0 350px;
  width: 100%;
  height: 520px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7),
              0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 5;
  margin: 0 auto;
  aspect-ratio: 2/3;
  min-height: 525px;
  animation: slideInLeft 0.8s ease-out 0.2s both;
}

.modal-poster:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8),
              0 0 0 1px rgba(255, 255, 255, 0.15);
}

.modal-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  transition: transform 0.4s ease;
}

.modal-poster:hover img {
  transform: scale(1.05);
}
```

---

#### B.2.3 - Appliquer la fusion

**Étapes** :
1. Remplacer la 1ère définition (~ligne 623) + les règles `.modal-poster img` et `:hover`
2. Supprimer la 2ème définition (~ligne 1370)
3. Supprimer la 3ème définition (~ligne 2752) + toutes ses règles associées
4. Sauvegarder
5. Tester
6. Git commit : `git commit -m "Refactor: Merge 3 .modal-poster definitions into 1"`

**Validation** :
```bash
grep -n "^\.modal-poster\s*{" css/modal.css | wc -l
# Résultat attendu : 1
```

---

### B.3 - Fusionner .synopsis-content (3 → 1 définition)

#### B.3.1 - Identifier les 3 définitions

```bash
grep -n "^\.synopsis-content\s*{" css/modal.css
```
Résultat attendu :
- Ligne ~309 : BASE
- Ligne ~1147 : MAX-HEIGHT
- Ligne ~3298 : OVERRIDE

---

#### B.3.2 - Créer la définition unifiée

```css
.synopsis-content {
  font-size: 16px;
  line-height: 1.8;
  color: var(--text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 200px;
}

/* Modificateur pour synopsis complet */
.synopsis-content.expanded {
  max-height: none;
  -webkit-line-clamp: unset;
  -webkit-box-orient: unset;
  overflow: visible;
}
```

---

#### B.3.3 - Appliquer la fusion

**Étapes** :
1. Remplacer la 1ère définition (~ligne 309) par la version unifiée
2. Supprimer la 2ème définition (~ligne 1147)
3. Supprimer la 3ème définition (~ligne 3298)
4. Ajouter la classe modificatrice `.synopsis-content.expanded`
5. Sauvegarder
6. Tester
7. Git commit : `git commit -m "Refactor: Merge 3 .synopsis-content definitions + add .expanded modifier"`

---

### B.4 - Fusionner les doublons mineurs

#### B.4.1 - .tags-container (2 définitions)

```bash
grep -n "^\.tags-container\s*{" css/modal.css
```

**Action** : Fusionner les 2 définitions en 1

---

#### B.4.2 - .tag-category (2 définitions)

```bash
grep -n "^\.tag-category\s*{" css/modal.css
```

**Action** : Fusionner

---

#### B.4.3 - Autres doublons

- `.synopsis-title`
- `.rating-section`
- `.modal-star`
- `.modal-close`
- `.modal-actions`

**Action** : Identifier et fusionner chacun

---

### B.5 - Éliminer les !important inutiles

**Recherche** :
```bash
grep -n "!important" css/modal.css | wc -l
```

**Action** :
Pour chaque `!important`, vérifier si :
1. Il est encore nécessaire après la fusion des doublons
2. Peut être remplacé par une meilleure spécificité CSS
3. Peut être supprimé complètement

**Objectif** : Réduire de ~50 à ~5-10 `!important` (seulement les vraiment nécessaires)

---

### B.6 - Vérification post-fusion

**Tests complets** :
- [ ] Modal de film (mode normal)
- [ ] Modal de film (mode édition)
- [ ] Modal de série
- [ ] Synopsis court vs long
- [ ] Système de tags
- [ ] Système de rating
- [ ] Hover sur poster
- [ ] Animations d'entrée
- [ ] Responsive (mobile/tablette)
- [ ] Tous les thèmes

**Validation** :
```bash
# Compter les sélecteurs en double
awk '/^[.#][a-zA-Z0-9_-]+\s*\{/ {gsub(/\s*\{.*/, ""); print}' css/modal.css | sort | uniq -c | sort -rn | head -20

# Vérifier qu'il n'y a plus de triple définition
# Résultat attendu : 0 sélecteur avec 3+ occurrences
```

**Estimation finale** : modal.css devrait être à ~2500 lignes

---

## PHASE C : AJOUTS (Intégration au système de thèmes)

### C.1 - Identifier les couleurs hardcodées

```bash
grep -n "rgba\|rgb\|#[0-9a-fA-F]" css/modal.css | wc -l
```

---

### C.2 - Créer les variables CSS nécessaires

Ajouter dans `css/theme.css` :
```css
/* Modal specific */
--modal-poster-bg: rgba(0, 0, 0, 0.4);
--modal-poster-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
--modal-poster-border: rgba(255, 255, 255, 0.1);
/* ... etc */
```

---

### C.3 - Remplacer les couleurs

Exemple :
```css
/* AVANT */
background: rgba(0, 0, 0, 0.4);

/* APRÈS */
background: var(--modal-poster-bg);
```

---

### C.4 - Tester avec tous les thèmes

- [ ] Rackoon Dark (défaut)
- [ ] Tous les autres thèmes prédéfinis

---

## COMMITS GIT RECOMMANDÉS

```bash
git commit -m "Clean: Remove obsolete code blocks from modal.css"
git commit -m "Refactor: Merge .modal-content definitions (3→1)"
git commit -m "Refactor: Merge .modal-poster definitions (3→1)"
git commit -m "Refactor: Merge .synopsis-content definitions (3→1)"
git commit -m "Refactor: Merge minor duplicate selectors"
git commit -m "Refactor: Remove unnecessary !important declarations"
git commit -m "Theme: Add modal-specific CSS variables"
git commit -m "Theme: Replace hardcoded colors with variables in modal.css"
```

---

## CHECKLIST FINALE

### Avant de commencer
- [ ] Backup créé
- [ ] Git status clean
- [ ] Screenshots de référence pris

### Après Phase A
- [ ] Code obsolète supprimé
- [ ] Tests passés
- [ ] Commits effectués

### Après Phase B
- [ ] Doublons fusionnés
- [ ] !important réduits
- [ ] Tests complets passés
- [ ] Commits effectués

### Après Phase C
- [ ] Variables CSS créées
- [ ] Couleurs remplacées
- [ ] Tests thèmes passés
- [ ] Documentation mise à jour

---

**Prêt à démarrer Phase A ?** 🚀
