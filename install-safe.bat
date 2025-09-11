@echo off
echo ========================================
echo  Rackoon Streaming - Installation SAFE
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

echo ✅ Node.js détecté: 
node --version
echo ✅ npm détecté: 
npm --version
echo.

REM Fermer tous les processus Electron
echo 🔄 Fermeture des processus Electron...
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im "Rackoon Streaming.exe" >nul 2>&1
timeout /t 2 >nul

REM Nettoyer en douceur
echo 🧹 Nettoyage sécurisé...
if exist package-lock.json (
    del /q package-lock.json >nul 2>&1
)

REM Supprimer node_modules par étapes
if exist node_modules (
    echo ⚠️ Suppression progressive de node_modules...
    
    REM Étape 1: Supprimer les dossiers non-Electron
    for /d %%d in (node_modules\*) do (
        if /i not "%%~nxd"=="electron" (
            rmdir /s /q "%%d" >nul 2>&1
        )
    )
    
    REM Étape 2: Vider le cache npm
    echo 🗄️ Nettoyage du cache npm...
    npm cache clean --force
    
    REM Étape 3: Supprimer le reste
    rmdir /s /q node_modules >nul 2>&1
    
    REM Si toujours là, forcer avec PowerShell
    if exist node_modules (
        echo 🔧 Nettoyage forcé avec PowerShell...
        powershell -Command "Remove-Item -Path 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue"
    )
)

echo 📥 Installation des dépendances...
echo.

REM Installation avec options spéciales pour Windows
npm install --no-optional --no-fund --loglevel=warn

if %errorlevel% neq 0 (
    echo.
    echo ❌ Erreur lors de l'installation !
    echo.
    echo 🔧 Solutions à essayer:
    echo 1. Redémarrer en tant qu'administrateur
    echo 2. Fermer tous les antivirus temporairement  
    echo 3. Exécuter: npm cache clean --force
    echo 4. Utiliser install-alternative.bat
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
pause