@echo off
echo ========================================
echo  Rackoon Streaming - Installation
echo ========================================
echo.

REM Vérifier si Node.js est installé
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé !
    echo.
    echo Veuillez installer Node.js depuis: https://nodejs.org/
    echo Version recommandée: 18.x ou supérieure
    pause
    exit /b 1
)

echo ✅ Node.js détecté
node --version

REM Vérifier la version de npm
echo ✅ npm détecté
npm --version

echo.
echo 📦 Installation des dépendances...
echo.

REM Nettoyer les anciennes installations
if exist node_modules (
    echo 🧹 Nettoyage des anciennes dépendances...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    del package-lock.json
)

REM Installation propre
echo 📥 Installation des packages...
npm install

if %errorlevel% neq 0 (
    echo.
    echo ❌ Erreur lors de l'installation !
    echo.
    echo Solutions possibles:
    echo - Vérifier votre connexion internet
    echo - Supprimer node_modules et package-lock.json manuellement
    echo - Exécuter: npm cache clean --force
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Installation terminée avec succès !
echo.
echo 🚀 Pour démarrer l'application:
echo    npm start
echo.
echo 🔧 Autres commandes utiles:
echo    npm run dev     - Mode développement  
echo    npm run build   - Construire l'app
echo    npm run dist    - Créer un exécutable
echo.
pause