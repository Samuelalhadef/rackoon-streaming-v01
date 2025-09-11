# 🎬 Rackoon Streaming v1.0

Application de streaming vidéo moderne avec lecteur intégré, support MKV, pistes audio multiples et sous-titres.

## 🎬 Fonctionnalités

### Gestion de Films
- **Scan automatique** des dossiers de films
- **Métadonnées automatiques** via FFmpeg (durée, résolution, format)
- **Miniatures** générées automatiquement
- **Base de données JSON** pour un stockage simple et portable
- **Interface dashboard** moderne et intuitive

### Lecteur Vidéo Avancé
- **Lecteur vidéo intégré** avec contrôles personnalisés
- **Support multi-formats** : MKV, MP4, AVI, MOV, etc.
- **Contrôles complets** : lecture, pause, volume, plein écran, vitesse
- **Navigation par raccourcis clavier**

### Système de Sous-titres Intelligent
- **Détection automatique** des pistes de sous-titres intégrées
- **Support multi-formats** : SRT, ASS/SSA, WebVTT, PGS, DVD
- **Conversion automatique** SRT/ASS → WebVTT pour compatibilité web
- **Extraction FFmpeg** des sous-titres intégrés dans MKV/MP4
- **Gestion des langues multiples** avec noms localisés
- **Tentative de conversion OCR** pour les sous-titres images (PGS)

### Pistes Audio
- **Détection des pistes audio multiples**
- **Affichage des informations** (langue, codec, canaux)
- **Interface de sélection** intuitive

## 🛠️ Technologies

- **Electron** - Framework d'application desktop
- **Node.js** - Runtime JavaScript
- **FFmpeg/FFprobe** - Traitement vidéo et extraction de métadonnées
- **HTML5 Video API** - Lecteur vidéo natif
- **CSS3** - Interface moderne et responsive
- **JSON** - Base de données simple et portable

## 📋 Prérequis

- **Node.js** 18.0.0 ou supérieur
- **npm** 8.0.0 ou supérieur
- **Système d'exploitation**: Windows, macOS, ou Linux

### Vérifier vos versions
```bash
node --version    # doit être >= 18.0.0
npm --version     # doit être >= 8.0.0
```

## 🚀 Installation Rapide

### Windows
```bash
# Méthode recommandée (installation sécurisée)
.\install-safe.bat

# Si problèmes persistants
.\install-alternative.bat

# Méthode classique
.\install.bat
```

### macOS / Linux
```bash
# Rendre le script exécutable et l'exécuter
chmod +x install.sh
./install.sh
```

### Installation Manuelle
```bash
# 1. Cloner le projet
git clone https://github.com/Samuelalhadef/Rackoon-Streaming-1.0.git
cd rackoon-streaming-v01

# 2. Installer les dépendances
npm install

# 3. Démarrer l'application
npm start
```

## 🛠️ Scripts Disponibles

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre l'application |
| `npm run dev` | Mode développement |
| `npm run build` | Construit l'application |
| `npm run dist` | Crée un exécutable |
| `npm run clean` | Nettoie node_modules |
| `npm run install:clean` | Installation propre |
| `npm run install:safe` | Installation sécurisée Windows |

## 📁 Structure du Projet

```
rackoon-streaming/
├── main.js                 # Processus principal Electron
├── preload.js             # Script de préchargement sécurisé
├── package.json           # Configuration et dépendances
├── views/                 # Pages HTML
│   ├── dashboard.html     # Interface principale
│   └── ...
├── js/                    # Scripts JavaScript
│   ├── video-player.js    # Lecteur vidéo avancé
│   ├── db-manager.js      # Gestionnaire base de données JSON
│   ├── dashboard.js       # Interface utilisateur
│   └── ...
├── css/                   # Styles CSS
│   ├── video-player.css   # Styles du lecteur
│   ├── dashboard.css      # Styles de l'interface
│   └── ...
├── data/                  # Données de l'application
│   ├── movies.json        # Base de données des films
│   └── thumbnails/        # Miniatures générées
└── temp/                  # Fichiers temporaires
    └── subtitles/         # Sous-titres extraits
```

## 🎮 Utilisation

### Première Configuration
1. Lancer l'application
2. Cliquer sur "Scanner les films"
3. Sélectionner vos dossiers de films
4. Attendre la génération des métadonnées et miniatures

### Lecture de Films
1. Cliquer sur un film dans le dashboard
2. Le lecteur s'ouvre automatiquement
3. Utiliser les contrôles ou raccourcis :
   - **Espace** : Lecture/Pause
   - **F** : Plein écran
   - **M** : Muet
   - **←/→** : Avancer/Reculer (10s)
   - **↑/↓** : Volume
   - **0-9** : Navigation par pourcentage

### Gestion des Sous-titres
1. Dans le lecteur, cliquer sur l'icône sous-titres
2. Sélectionner la piste désirée
3. L'extraction et conversion se font automatiquement
4. Les sous-titres s'affichent immédiatement

## 🔧 Configuration FFmpeg

Le projet recherche FFmpeg dans plusieurs emplacements :
- `C:\ffmpeg\bin\ffmpeg.exe`
- Dossier utilisateur : `~/Documents/ffmpeg/...`
- PATH système
- Installation Chocolatey

## 🔧 Dépannage

### Problèmes d'installation

1. **Erreur "node n'est pas reconnu"**
   - Installer Node.js depuis [nodejs.org](https://nodejs.org/)
   - Redémarrer le terminal

2. **Erreur lors de npm install (Windows)**
   ```bash
   # Fermer tous les processus Electron
   taskkill /f /im electron.exe
   
   # Essayer l'installation sécurisée
   .\install-safe.bat
   
   # Ou installation manuelle
   npm cache clean --force
   npm run install:safe
   ```

3. **Problèmes de permissions (Linux/macOS)**
   ```bash
   sudo chown -R $(whoami) ~/.npm
   ```

### Problèmes de lancement

1. **L'application ne démarre pas**
   - Vérifier que toutes les dépendances sont installées
   - Exécuter `npm run postinstall`

2. **Erreur FFmpeg**
   - Les binaires FFmpeg sont inclus automatiquement
   - Redémarrer l'application si nécessaire

## 🐛 Signaler un Bug

Si vous rencontrez un problème, veuillez [créer une issue](https://github.com/Samuelalhadef/Rackoon-Streaming-1.0/issues) avec :
- Description du problème
- Étapes pour reproduire
- Version de Node.js (`node --version`)
- Système d'exploitation

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment participer :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commiter vos changements (`git commit -m 'Ajouter nouvelle fonctionnalité'`)
4. Pousser vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🔄 Changelog

### Version Actuelle
- ✅ Système de sous-titres intelligent avec conversion automatique
- ✅ Support des formats PGS, SRT, ASS, WebVTT
- ✅ Lecteur vidéo avec contrôles avancés
- ✅ Interface moderne et responsive
- ✅ Base de données JSON portable
- ✅ Génération automatique de miniatures

### Fonctionnalités Prévues
- 🔲 Support des séries TV
- 🔲 Synchronisation cloud
- 🔲 Mode sombre
- 🔲 Filtres et recherche avancée
- 🔲 Playlists personnalisées

## 🙏 Remerciements

- **FFmpeg** pour le traitement vidéo
- **Electron** pour le framework d'application
- **La communauté open source** pour les outils et inspirations

---

**Rackoon Streaming** - Votre cinéma personnel, simplifié. 🎬