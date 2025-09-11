# 🤝 Guide de Contribution

Merci de votre intérêt pour contribuer à Rackoon Streaming ! Ce guide vous aidera à démarrer.

## 🚀 Démarrage Rapide

### 1. Fork et Clone
```bash
# Fork le repository sur GitHub, puis :
git clone https://github.com/VOTRE-USERNAME/Rackoon-Streaming-1.0.git
cd rackoon-streaming-v01
```

### 2. Installation
```bash
# Utiliser le script d'installation
./install.sh       # Linux/macOS
# ou
./install.bat      # Windows

# Ou manuellement
npm install
```

### 3. Développement
```bash
npm run dev        # Démarre en mode développement
```

## 📋 Prérequis de Développement

- **Node.js** 18.0.0+
- **npm** 8.0.0+
- **Git**
- Éditeur de code (VS Code recommandé)

## 🏗️ Structure du Code

```
src/
├── main.js              # Process principal Electron
├── public/              # Assets statiques
│   ├── css/            # Styles CSS
│   ├── js/             # Scripts frontend
│   └── img/            # Images et icônes
└── data/               # Base de données JSON
```

## 🔧 Scripts Utiles

| Script | Description |
|--------|-------------|
| `npm start` | Démarre l'application |
| `npm run dev` | Mode développement |
| `npm run clean` | Nettoie les dépendances |
| `npm run build` | Build production |

## 📝 Standards de Code

### Style de Code
- **Indentation** : 2 espaces
- **Quotes** : Guillemets simples pour JS
- **Semicolons** : Obligatoires
- **Nommage** : camelCase pour variables/fonctions

### Conventions
- **Commits** : Messages clairs en français
- **Branches** : `feature/nom-fonctionnalite`
- **Pull Requests** : Description détaillée

## 🐛 Signaler un Bug

Avant de signaler un bug :

1. ✅ Vérifiez les [issues existantes](https://github.com/Samuelalhadef/Rackoon-Streaming-1.0/issues)
2. ✅ Testez avec la dernière version
3. ✅ Reproduisez le problème

### Template de Bug Report
```markdown
**Description du bug**
Description claire du problème.

**Étapes pour reproduire**
1. Aller à '...'
2. Cliquer sur '...'
3. Voir l'erreur

**Comportement attendu**
Ce qui devrait se passer.

**Captures d'écran**
Si applicable.

**Environnement:**
- OS: [Windows/macOS/Linux]
- Node.js version: [18.x.x]
- Version de l'app: [1.0.0]
```

## ✨ Proposer une Fonctionnalité

1. **Discutez d'abord** : Ouvrez une issue pour discuter
2. **Décrivez clairement** : Cas d'usage, bénéfices
3. **Mockups/Exemples** : Si applicable

## 🔄 Processus de Contribution

### 1. Préparation
```bash
# Créer une nouvelle branche
git checkout -b feature/ma-fonctionnalite

# Garder la branche à jour
git fetch origin
git rebase origin/main
```

### 2. Développement
- Écrire du code propre et documenté
- Tester les changements
- Vérifier que l'app fonctionne

### 3. Tests
```bash
# Tester l'installation propre
npm run clean
npm install
npm start
```

### 4. Commit et Push
```bash
# Commits atomiques avec messages clairs
git add .
git commit -m "feat: ajout support formats WEBM"

# Push vers votre fork
git push origin feature/ma-fonctionnalite
```

### 5. Pull Request
1. Ouvrir une PR vers `main`
2. Description détaillée des changements
3. Mentionner les issues liées
4. Attendre la review

## 🎯 Types de Contributions

### 🐛 Corrections de Bugs
- Résoudre les issues existantes
- Améliorer la stabilité
- Corriger les problèmes de compatibilité

### ✨ Nouvelles Fonctionnalités
- Améliorer l'UX/UI
- Ajouter support de formats
- Nouvelles options de lecture

### 📚 Documentation
- Améliorer le README
- Ajouter des tutoriels
- Documenter le code

### 🧹 Maintenance
- Mettre à jour les dépendances
- Optimiser les performances
- Refactoring du code

## ❌ Ce qui N'est PAS Accepté

- Code malveillant ou dangereux
- Fonctionnalités piratage/contournement
- Code non testé ou cassant l'existant
- Changements majeurs sans discussion
- Code ne respectant pas les standards

## 🎉 Reconnaissance

Tous les contributeurs sont listés dans le README. Merci pour votre aide ! 🙏

## 📞 Questions ?

- 💬 [Discussions GitHub](https://github.com/Samuelalhadef/Rackoon-Streaming-1.0/discussions)
- 🐛 [Issues](https://github.com/Samuelalhadef/Rackoon-Streaming-1.0/issues)
- 📧 Email: contact@production-directive.com

---

**Ensemble, rendons Rackoon Streaming encore meilleur ! 🚀**