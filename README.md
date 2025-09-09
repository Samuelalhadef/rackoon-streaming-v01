# Rackoon Streaming

Une application Electron moderne pour gérer et lire votre collection de films personnels avec des fonctionnalités avancées de sous-titres et de métadonnées.

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

- **Node.js** (version 16 ou supérieure)
- **FFmpeg** installé et accessible dans le PATH système
  - Windows : Télécharger depuis [FFmpeg.org](https://ffmpeg.org/download.html)
  - Ou via Chocolatey : `choco install ffmpeg`

## 🚀 Installation

1. **Cloner le repository**
   ```bash
   git clone https://github.com/votre-username/rackoon-streaming.git
   cd rackoon-streaming
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Vérifier FFmpeg**
   ```bash
   ffmpeg -version
   ffprobe -version
   ```

4. **Lancer l'application**
   ```bash
   npm start
   ```

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

## 🐛 Dépannage

### Problèmes Courants

**FFmpeg non trouvé**
```bash
# Vérifier l'installation
ffmpeg -version

# Installer via Chocolatey (Windows)
choco install ffmpeg

# Ou télécharger manuellement et ajouter au PATH
```

**Sous-titres ne s'affichent pas**
- Vérifier que le fichier contient des sous-titres : menu "Sous-titres"
- Les PGS (images) sont convertis automatiquement mais peuvent être limités
- Préférer les fichiers avec sous-titres SRT intégrés

**Lecteur ne démarre pas**
- Vérifier les permissions de lecture du fichier vidéo
- S'assurer que le format est supporté
- Vérifier les logs dans la console développeur (Ctrl+Shift+I)

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