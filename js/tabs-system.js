// tabs-system.js - Système de navigation par onglets avec swipe

document.addEventListener('DOMContentLoaded', () => {
  console.log('🔖 Système d\'onglets initialisé');

  // Éléments
  const tabsContainer = document.getElementById('tabs-container');
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabSections = document.querySelectorAll('.tab-section');

  let currentTabIndex = 0;
  let isTransitioning = false;

  // Fonction pour activer un onglet
  function activateTab(tabName, direction = 'right') {
    if (isTransitioning) return;

    isTransitioning = true;
    console.log(`🔄 Activation de l'onglet: ${tabName}, direction: ${direction}`);

    // Trouver l'index du nouvel onglet
    const newTabIndex = Array.from(tabSections).findIndex(
      section => section.dataset.section === tabName
    );

    if (newTabIndex === -1) {
      console.error(`❌ Onglet non trouvé: ${tabName}`);
      isTransitioning = false;
      return;
    }

    // Désactiver tous les onglets et sections
    tabLinks.forEach(link => link.classList.remove('active'));
    tabSections.forEach(section => {
      section.classList.remove('active', 'from-left', 'from-right');
    });

    // Activer le nouvel onglet
    const activeLink = document.querySelector(`.tab-link[data-tab="${tabName}"]`);
    const activeSection = document.getElementById(`section-${tabName}`);

    if (activeLink) activeLink.classList.add('active');
    if (activeSection) {
      activeSection.classList.add('active');
      // Ajouter la classe de direction pour l'animation
      if (direction === 'left') {
        activeSection.classList.add('from-left');
      } else {
        activeSection.classList.add('from-right');
      }
    }

    currentTabIndex = newTabIndex;

    // Réactiver les transitions après l'animation
    setTimeout(() => {
      isTransitioning = false;
    }, 400);
  }

  // Écouter les clics sur les onglets
  tabLinks.forEach((link, index) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = link.dataset.tab;
      const direction = index > currentTabIndex ? 'right' : 'left';
      activateTab(tabName, direction);
    });
  });

  // Support du swipe tactile
  let touchStartX = 0;
  let touchEndX = 0;
  const swipeThreshold = 50; // pixels minimum pour déclencher le swipe

  tabsContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  tabsContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeDistance = touchStartX - touchEndX;

    if (Math.abs(swipeDistance) < swipeThreshold) return;

    if (swipeDistance > 0) {
      // Swipe vers la gauche - onglet suivant
      if (currentTabIndex < tabSections.length - 1) {
        const nextSection = tabSections[currentTabIndex + 1];
        activateTab(nextSection.dataset.section, 'right');
      }
    } else {
      // Swipe vers la droite - onglet précédent
      if (currentTabIndex > 0) {
        const prevSection = tabSections[currentTabIndex - 1];
        activateTab(prevSection.dataset.section, 'left');
      }
    }
  }

  // Support du clavier (flèches gauche/droite)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && currentTabIndex > 0) {
      const prevSection = tabSections[currentTabIndex - 1];
      activateTab(prevSection.dataset.section, 'left');
    } else if (e.key === 'ArrowRight' && currentTabIndex < tabSections.length - 1) {
      const nextSection = tabSections[currentTabIndex + 1];
      activateTab(nextSection.dataset.section, 'right');
    }
  });

  // Gérer les hash dans l'URL
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1); // Enlever le #
    if (hash) {
      activateTab(hash);
    }
  });

  // Initialiser avec le hash actuel ou le premier onglet
  const initialHash = window.location.hash.substring(1);
  if (initialHash && document.querySelector(`.tab-link[data-tab="${initialHash}"]`)) {
    activateTab(initialHash);
  } else {
    // Activer le premier onglet par défaut
    const firstTab = tabSections[0];
    if (firstTab) {
      activateTab(firstTab.dataset.section);
    }
  }

  console.log('✅ Système d\'onglets prêt');
});
