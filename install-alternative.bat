@echo off
echo ========================================
echo  Installation Alternative (Sans Electron)
echo ========================================
echo.

REM Installation des dépendances principales seulement
echo 📦 Installation des dépendances de base...
npm install fs-extra glob ffmpeg-static ffprobe-static rimraf --save

if %errorlevel% neq 0 (
    echo ❌ Erreur avec les dépendances principales
    pause
    exit /b 1
)

echo.
echo 📦 Installation d'Electron séparément...
echo.

REM Installer Electron avec un délai
npm install electron@^38.1.0 --save-dev --no-optional

if %errorlevel% neq 0 (
    echo.
    echo ⚠️ Problème avec Electron, essai avec cache vidé...
    npm cache clean --force
    timeout /t 3 >nul
    npm install electron@^38.1.0 --save-dev --no-optional --force
)

echo.
echo 📦 Installation d'Electron Builder...
npm install electron-builder@^24.13.3 --save-dev

echo.
echo ✅ Installation alternative terminée !
echo.
echo 🚀 Test de l'application:
echo    npm start
echo.
pause