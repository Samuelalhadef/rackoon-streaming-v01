@echo off
echo ============================================
echo   Configuration Pare-feu Rackoon Streaming
echo ============================================
echo.
echo Ce script va autoriser le port 3001 pour Watch Party
echo.

REM Vérifier les droits admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERREUR: Ce script necessite les droits administrateur
    echo.
    echo Clic droit sur ce fichier ^> Executer en tant qu'administrateur
    echo.
    pause
    exit /b 1
)

echo [1/3] Suppression de l'ancienne regle (si elle existe)...
netsh advfirewall firewall delete rule name="Rackoon Watch Party" >nul 2>&1

echo [2/3] Creation de la regle pour le port 3001 TCP...
netsh advfirewall firewall add rule ^
    name="Rackoon Watch Party" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3001 ^
    profile=private,public ^
    description="Autorise les connexions Watch Party sur le port 3001"

if %errorLevel% equ 0 (
    echo [3/3] Configuration reussie !
    echo.
    echo ============================================
    echo   PARE-FEU CONFIGURE AVEC SUCCES
    echo ============================================
    echo.
    echo Le port 3001 est maintenant ouvert pour:
    echo   - Reseau prive (WiFi maison)
    echo   - Reseau public
    echo.
    echo Vous pouvez maintenant utiliser Watch Party
    echo entre plusieurs ordinateurs !
    echo.
) else (
    echo [3/3] ERREUR lors de la configuration
    echo.
    echo Verifiez que vous avez bien execute en tant qu'administrateur
    echo.
)

pause
