// plateformes.js - Page Plateformes & Studios

console.log('📺 Script plateformes.js CHARGÉ');

document.addEventListener('DOMContentLoaded', () => {

  const platformsGrid = document.getElementById('platforms-grid');
  const platformsEmpty = document.getElementById('platforms-empty');
  const studiosGrid = document.getElementById('studios-grid');
  const studiosEmpty = document.getElementById('studios-empty');

  let loaded = false;

  // Lazy load au clic sur l'onglet
  const tabLink = document.querySelector('[data-tab="plateformes"]');
  if (tabLink) {
    tabLink.addEventListener('click', () => {
      if (!loaded) loadData();
    });
  }

  // Recharger si des données changent (ex: retour depuis accueil)
  window.addEventListener('rackoon:media-updated', () => {
    loaded = false;
    if (document.getElementById('section-plateformes')?.classList.contains('active')) {
      loadData();
    }
  });

  // ============================================================
  //  LOGOS CONNUS — domaines pour favicon
  // ============================================================

  const PLATFORM_DOMAINS = {
    'netflix': 'netflix.com',
    'disney+': 'disneyplus.com',
    'disney plus': 'disneyplus.com',
    'amazon prime': 'primevideo.com',
    'prime video': 'primevideo.com',
    'amazon prime video': 'primevideo.com',
    'apple tv+': 'apple.com',
    'apple tv': 'apple.com',
    'hbo max': 'max.com',
    'max': 'max.com',
    'hulu': 'hulu.com',
    'crunchyroll': 'crunchyroll.com',
    'funimation': 'funimation.com',
    'youtube': 'youtube.com',
    'youtube premium': 'youtube.com',
    'canal+': 'canalplus.com',
    'canal plus': 'canalplus.com',
    'arte': 'arte.tv',
    'france tv': 'france.tv',
    'ocs': 'ocs.fr',
    'mycanal': 'canalplus.com',
    'paramount+': 'paramountplus.com',
    'paramount plus': 'paramountplus.com',
    'peacock': 'peacocktv.com',
    'mubi': 'mubi.com',
    'shudder': 'shudder.com',
    'adn': 'animedigitalnetwork.fr',
    'wakanim': 'wakanim.tv',
  };

  function getFaviconUrl(platformName) {
    const key = platformName.toLowerCase().trim();
    const domain = PLATFORM_DOMAINS[key];
    if (domain) return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    return null;
  }

  // ============================================================
  //  COULEUR DÉTERMINISTE depuis le nom
  // ============================================================

  function nameToColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 45%)`;
  }

  function getInitials(name) {
    return name
      .split(/[\s\-_+&]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  // ============================================================
  //  CHARGEMENT & AGGREGATION
  // ============================================================

  async function loadData() {
    try {
      const [mediasResult, seriesResult] = await Promise.all([
        window.electronAPI.getAllMedias(),
        window.electronAPI.getAllSeries(),
      ]);

      const medias = mediasResult.success ? (mediasResult.medias || []) : [];
      const series = seriesResult.success ? (seriesResult.series || []) : [];

      // — Plateformes —
      const platformCounts = {};

      medias.forEach(m => {
        if (m.seriesId == null && m.platform && m.platform.trim()) {
          const p = m.platform.trim();
          platformCounts[p] = (platformCounts[p] || 0) + 1;
        }
      });
      series.forEach(s => {
        if (s.platform && s.platform.trim()) {
          const p = s.platform.trim();
          platformCounts[p] = (platformCounts[p] || 0) + 1;
        }
      });

      // — Studios —
      const studioCounts = {};

      const parseStudios = val => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return []; }
      };

      medias.forEach(m => {
        if (m.seriesId == null) {
          parseStudios(m.studios).forEach(s => {
            if (s && s.trim()) studioCounts[s.trim()] = (studioCounts[s.trim()] || 0) + 1;
          });
        }
      });
      series.forEach(s => {
        parseStudios(s.studios).forEach(name => {
          if (name && name.trim()) studioCounts[name.trim()] = (studioCounts[name.trim()] || 0) + 1;
        });
      });

      renderPlatforms(platformCounts);
      renderStudios(studioCounts);
      loaded = true;

    } catch (err) {
      console.error('❌ Erreur chargement plateformes/studios:', err);
    }
  }

  // ============================================================
  //  RENDU — Plateformes
  // ============================================================

  function renderPlatforms(counts) {
    if (!platformsGrid) return;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      platformsGrid.style.display = 'none';
      if (platformsEmpty) platformsEmpty.style.display = 'flex';
      return;
    }

    platformsGrid.style.display = 'grid';
    if (platformsEmpty) platformsEmpty.style.display = 'none';
    platformsGrid.innerHTML = entries.map(([name, count]) => renderCard(name, count, 'platform')).join('');

    platformsGrid.querySelectorAll('.ps-card').forEach(card => {
      card.addEventListener('click', () => {
        if (typeof window.filterByPlatform === 'function') {
          window.filterByPlatform(card.dataset.name);
        }
      });
    });
  }

  // ============================================================
  //  RENDU — Studios
  // ============================================================

  function renderStudios(counts) {
    if (!studiosGrid) return;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      studiosGrid.style.display = 'none';
      if (studiosEmpty) studiosEmpty.style.display = 'flex';
      return;
    }

    studiosGrid.style.display = 'grid';
    if (studiosEmpty) studiosEmpty.style.display = 'none';
    studiosGrid.innerHTML = entries.map(([name, count]) => renderCard(name, count, 'studio')).join('');

    studiosGrid.querySelectorAll('.ps-card').forEach(card => {
      card.addEventListener('click', () => {
        if (typeof window.filterByStudio === 'function') {
          window.filterByStudio(card.dataset.name);
        }
      });
    });
  }

  // ============================================================
  //  CARD HTML
  // ============================================================

  function renderCard(name, count, type) {
    const color = nameToColor(name);
    const initials = getInitials(name);
    const faviconUrl = type === 'platform' ? getFaviconUrl(name) : null;
    const label = count === 1
      ? (type === 'platform' ? '1 titre' : '1 titre')
      : `${count} titres`;

    const logoHtml = faviconUrl
      ? `<img class="ps-card-logo" src="${faviconUrl}" alt="${escapeHtml(name)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="ps-card-initials" style="background:${color};display:none">${escapeHtml(initials)}</div>`
      : `<div class="ps-card-initials" style="background:${color}">${escapeHtml(initials)}</div>`;

    return `
      <div class="ps-card" data-name="${escapeHtml(name)}" data-type="${type}" title="${escapeHtml(name)}">
        <div class="ps-card-visual">
          ${logoHtml}
        </div>
        <div class="ps-card-info">
          <div class="ps-card-name">${escapeHtml(name)}</div>
          <div class="ps-card-count">${label}</div>
        </div>
      </div>
    `;
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

});
