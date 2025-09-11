#!/bin/bash

echo "========================================"
echo "  Rackoon Streaming - Installation"
echo "========================================"
echo

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé !"
    echo
    echo "Veuillez installer Node.js depuis: https://nodejs.org/"
    echo "Version recommandée: 18.x ou supérieure"
    echo
    echo "Sur Ubuntu/Debian: sudo apt install nodejs npm"
    echo "Sur macOS avec Homebrew: brew install node"
    exit 1
fi

echo "✅ Node.js détecté: $(node --version)"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé !"
    exit 1
fi

echo "✅ npm détecté: $(npm --version)"
echo

# Vérifier la version de Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Attention: Node.js version $NODE_VERSION détectée"
    echo "   Version recommandée: 18.x ou supérieure"
    echo
fi

echo "📦 Installation des dépendances..."
echo

# Nettoyer les anciennes installations
if [ -d "node_modules" ]; then
    echo "🧹 Nettoyage des anciennes dépendances..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    rm package-lock.json
fi

# Installation propre
echo "📥 Installation des packages..."
npm install

if [ $? -ne 0 ]; then
    echo
    echo "❌ Erreur lors de l'installation !"
    echo
    echo "Solutions possibles:"
    echo "- Vérifier votre connexion internet"
    echo "- Supprimer node_modules et package-lock.json manuellement"
    echo "- Exécuter: npm cache clean --force"
    echo "- Sur Linux, installer build-essential: sudo apt install build-essential"
    echo
    exit 1
fi

echo
echo "✅ Installation terminée avec succès !"
echo
echo "🚀 Pour démarrer l'application:"
echo "   npm start"
echo
echo "🔧 Autres commandes utiles:"
echo "   npm run dev     - Mode développement"
echo "   npm run build   - Construire l'app"
echo "   npm run dist    - Créer un exécutable"
echo