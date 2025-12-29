@echo off
echo ============================================
echo   Suppression Pare-feu Rackoon Streaming
echo ============================================
echo.
echo Ce script va supprimer la regle du port 3001
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

echo Suppression de la regle "Rackoon Watch Party"...
netsh advfirewall firewall delete rule name="Rackoon Watch Party"

if %errorLevel% equ 0 (
    echo.
    echo ============================================
    echo   REGLE SUPPRIMEE AVEC SUCCES
    echo ============================================
    echo.
    echo Le port 3001 est maintenant ferme.
    echo.
) else (
    echo.
    echo ERREUR: Impossible de supprimer la regle
    echo (Peut-etre qu'elle n'existait pas)
    echo.
)

pause
