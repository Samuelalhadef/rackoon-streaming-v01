// movie-modal.js - Gestion de la modal de présentation des films

console.log('📁 Script movie-modal.js CHARGÉ');

// Liste des pays avec drapeaux (les plus courants en premier)
const COUNTRY_LIST = [
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'US', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'GB', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'JP', flag: '🇯🇵', name: 'Japon' },
  { code: 'KR', flag: '🇰🇷', name: 'Corée du Sud' },
  { code: 'DE', flag: '🇩🇪', name: 'Allemagne' },
  { code: 'IT', flag: '🇮🇹', name: 'Italie' },
  { code: 'ES', flag: '🇪🇸', name: 'Espagne' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'AU', flag: '🇦🇺', name: 'Australie' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', flag: '🇨🇭', name: 'Suisse' },
  { code: 'AT', flag: '🇦🇹', name: 'Autriche' },
  { code: 'NL', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: 'SE', flag: '🇸🇪', name: 'Suède' },
  { code: 'DK', flag: '🇩🇰', name: 'Danemark' },
  { code: 'NO', flag: '🇳🇴', name: 'Norvège' },
  { code: 'FI', flag: '🇫🇮', name: 'Finlande' },
  { code: 'PL', flag: '🇵🇱', name: 'Pologne' },
  { code: 'CZ', flag: '🇨🇿', name: 'Tchéquie' },
  { code: 'RO', flag: '🇷🇴', name: 'Roumanie' },
  { code: 'HU', flag: '🇭🇺', name: 'Hongrie' },
  { code: 'GR', flag: '🇬🇷', name: 'Grèce' },
  { code: 'IE', flag: '🇮🇪', name: 'Irlande' },
  { code: 'RU', flag: '🇷🇺', name: 'Russie' },
  { code: 'TR', flag: '🇹🇷', name: 'Turquie' },
  { code: 'CN', flag: '🇨🇳', name: 'Chine' },
  { code: 'TW', flag: '🇹🇼', name: 'Taïwan' },
  { code: 'HK', flag: '🇭🇰', name: 'Hong Kong' },
  { code: 'IN', flag: '🇮🇳', name: 'Inde' },
  { code: 'TH', flag: '🇹🇭', name: 'Thaïlande' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexique' },
  { code: 'BR', flag: '🇧🇷', name: 'Brésil' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentine' },
  { code: 'CO', flag: '🇨🇴', name: 'Colombie' },
  { code: 'ZA', flag: '🇿🇦', name: 'Afrique du Sud' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigéria' },
  { code: 'EG', flag: '🇪🇬', name: 'Égypte' },
  { code: 'IL', flag: '🇮🇱', name: 'Israël' },
  { code: 'NZ', flag: '🇳🇿', name: 'Nouvelle-Zélande' },
  { code: 'SK', flag: '🇸🇰', name: 'Slovaquie' },
];

// Retourne "🇫🇷 France" à partir d'un code ISO ou d'un nom anglais/français
function resolveCountryLabel(codeOrName) {
  if (!codeOrName) return '';
  const upper = codeOrName.toUpperCase();
  const byCode = COUNTRY_LIST.find(c => c.code === upper);
  if (byCode) return `${byCode.flag} ${byCode.name}`;
  // Essayer par nom (anglais TMDB → correspondance partielle)
  const tmdbNameMap = {
    'France': 'FR', 'United States of America': 'US', 'United States': 'US',
    'United Kingdom': 'GB', 'Japan': 'JP', 'South Korea': 'KR', 'Republic of Korea': 'KR',
    'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES', 'Canada': 'CA', 'Australia': 'AU',
    'Belgium': 'BE', 'Switzerland': 'CH', 'Austria': 'AT', 'Netherlands': 'NL',
    'Portugal': 'PT', 'Sweden': 'SE', 'Denmark': 'DK', 'Norway': 'NO', 'Finland': 'FI',
    'Poland': 'PL', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Romania': 'RO',
    'Hungary': 'HU', 'Greece': 'GR', 'Ireland': 'IE', 'Russia': 'RU', 'Turkey': 'TR',
    'China': 'CN', 'Taiwan': 'TW', 'Hong Kong': 'HK', 'India': 'IN', 'Thailand': 'TH',
    'Mexico': 'MX', 'Brazil': 'BR', 'Argentina': 'AR', 'Colombia': 'CO',
    'South Africa': 'ZA', 'Nigeria': 'NG', 'Egypt': 'EG', 'Israel': 'IL',
    'New Zealand': 'NZ', 'Slovakia': 'SK',
  };
  const code = tmdbNameMap[codeOrName];
  if (code) {
    const entry = COUNTRY_LIST.find(c => c.code === code);
    if (entry) return `${entry.flag} ${entry.name}`;
  }
  // Retourner tel quel si non reconnu
  return codeOrName;
}

// Crée un <select> de pays pour l'édition inline
function createCountrySelect(currentValue, id, className) {
  const select = document.createElement('select');
  select.id = id;
  select.className = className;

  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '— Choisir un pays —';
  select.appendChild(emptyOpt);

  const topGroup = document.createElement('optgroup');
  topGroup.label = 'Fréquents';
  COUNTRY_LIST.slice(0, 10).forEach(c => {
    const opt = document.createElement('option');
    opt.value = `${c.flag} ${c.name}`;
    opt.textContent = `${c.flag} ${c.name}`;
    topGroup.appendChild(opt);
  });
  select.appendChild(topGroup);

  const allGroup = document.createElement('optgroup');
  allGroup.label = 'Tous les pays';
  COUNTRY_LIST.slice(10).forEach(c => {
    const opt = document.createElement('option');
    opt.value = `${c.flag} ${c.name}`;
    opt.textContent = `${c.flag} ${c.name}`;
    allGroup.appendChild(opt);
  });
  select.appendChild(allGroup);

  // Sélectionner la valeur courante (qui peut être "🇫🇷 France" ou "France" ou "FR")
  const resolved = resolveCountryLabel(currentValue);
  if (resolved) {
    // Chercher dans les options
    const match = Array.from(select.options).find(o => o.value === resolved || o.value === currentValue);
    if (match) select.value = match.value;
  }

  return select;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 Initialisation de movie-modal.js...');

  // Références aux éléments de l'interface
  const modalOverlay = document.getElementById('modal-overlay');
  const movieModal = document.getElementById('movie-modal');
  const modalClose = document.getElementById('modal-close');
  const modalPoster = document.getElementById('modal-poster');
  const modalTitle = document.getElementById('modal-title');
  const movieYear = document.getElementById('movie-year');
  const releaseDate = document.getElementById('release-date');
  const duration = document.getElementById('duration');
  const genresContainer = document.getElementById('genres-container');
  const synopsisContent = document.getElementById('synopsis-content');
  const modalStars = document.querySelectorAll('.modal-star');
  const progressiveStars = document.getElementById('progressive-stars');
  const starsFill = document.getElementById('stars-fill');
  const starsOverlay = document.getElementById('stars-overlay');
  const ratingInput = document.getElementById('rating-input');
  const watchToggleModal = document.getElementById('btn-watch-toggle-modal');
  const watchFilmBtn = document.getElementById('btn-watch-film');
  const editButton = document.getElementById('edit-button');
  const editButtonGroup = document.getElementById('edit-button-group');
  const editCancelBtn = document.getElementById('edit-cancel-btn');
  const editSaveBtn = document.getElementById('edit-save-btn');

  // Debug: Vérifier que tous les éléments sont trouvés
  console.log('🔍 Éléments de boutons extensibles:');
  console.log('  - editButton:', !!editButton);
  console.log('  - editButtonGroup:', !!editButtonGroup);
  console.log('  - editCancelBtn:', !!editCancelBtn);
  console.log('  - editSaveBtn:', !!editSaveBtn);

  // Nouveaux éléments pour le système d'avis
  const reviewInput = document.getElementById('review-input');
  const reviewSaveBtn = document.getElementById('review-save-btn');
  
  // Éléments du mode édition
  const viewMode = document.getElementById('view-mode');
  // const editMode = document.getElementById('edit-mode'); // SUPPRIMÉ - plus utilisé
  const editTitleInput = document.getElementById('edit-title-input');
  const editReleaseDateInput = document.getElementById('edit-release-date');
  const editGenresContainer = document.getElementById('edit-genres-container');
  const genreDropdown = document.getElementById('genre-dropdown');
  const addPredefinedGenreBtn = document.getElementById('add-predefined-genre');
  const customGenreInput = document.getElementById('custom-genre-input');
  const addCustomGenreBtn = document.getElementById('add-custom-genre');
  const imagePreview = document.getElementById('image-preview');
  const uploadImageBtn = document.getElementById('upload-image-btn');
  const editSynopsisInput = document.getElementById('edit-synopsis-input');
  const saveChangesBtn = document.getElementById('save-changes-btn');
  const exitEditModeBtn = document.getElementById('exit-edit-mode');
  const tmdbSearchBtn = document.getElementById('tmdb-search-btn');
  
  // Configuration de l'API TMDB
  const TMDB_API_KEY = 'c220a4b30216e390c152a528e4efb79c';
  const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMjIwYTRiMzAyMTZlMzkwYzE1MmE1MjhlNGVmYjc5YyIsIm5iZiI6MTczMzkzMjAyOS40Nywic3ViIjoiNjc1OWIzZmQ1MDZiNDIzOTRkMjE2MDM3Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.RFQAh_1LTZWemAFFIHJUimpU7BEHJxxrua0ys5rruos';
  const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
  
  // Plus de système utilisateur - supprimé

  // ============================================
  // MAPPING DÉPARTEMENTS / RÔLES PERSONNES
  // ============================================
  const CREW_ROLES = {
    director:        { label: 'Réalisateur',  tmdbJobs: ['Director'] },
    producer:        { label: 'Producteur',   tmdbJobs: ['Producer', 'Executive Producer'] },
    writer:          { label: 'Scénariste',   tmdbJobs: ['Screenplay', 'Writer', 'Story'] },
    composer:        { label: 'Compositeur',  tmdbJobs: ['Original Music Composer', 'Music'] },
    cinematographer: { label: 'Dir. Photo',   tmdbJobs: ['Director of Photography'] }
  };

  function mapTMDBJobToRole(job) {
    for (const [role, config] of Object.entries(CREW_ROLES)) {
      if (config.tmdbJobs.includes(job)) return role;
    }
    return null;
  }

  function getDepartmentLabel(dept) {
    const map = {
      'Acting': 'Acteur/Actrice',
      'Directing': 'Réalisation',
      'Writing': 'Scénario',
      'Production': 'Production',
      'Sound': 'Son',
      'Camera': 'Photographie',
      'Editing': 'Montage',
      'Art': 'Direction artistique',
      'Costume & Make-Up': 'Costumes',
      'Visual Effects': 'Effets visuels',
      'Crew': 'Équipe technique'
    };
    return map[dept] || dept || '';
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Exposer la fonction openMovieModal immédiatement pour éviter les problèmes de timing
  window.openMovieModal = async function(movieId) {
    console.log('🎬 openMovieModal appelée avec ID:', movieId, '| Verrou actif:', isModalOpening);

    // Bloquer si une ouverture est déjà en cours
    if (isModalOpening) {
      console.warn('⏳ Ouverture de modale déjà en cours (verrou actif), requête ignorée');
      return;
    }

    // Vérifier que les éléments essentiels existent
    if (!modalOverlay) {
      console.error('❌ modal-overlay non trouvé dans le DOM');
      return;
    }

    if (!viewMode) {
      console.error('❌ Élément view-mode manquant');
      return;
    }

    try {
      isModalOpening = true;

      // Vérifier si la modale est déjà ouverte
      if (modalOverlay.classList.contains('active')) {
        console.log('La modale est deja ouverte, fermeture en cours...');
        if (isEditMode) {
          deactivateEditMode();
        }
        // Forcer la fermeture immédiate sans animation
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        currentMovieId = null;
        currentMoviePath = null;
        currentMovieData = {};
        selectedGenres = [];
        posterImageFile = null;
        // Attendre un peu pour laisser le navigateur traiter les changements
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return await openMovieModalInternal(movieId);
    } catch (error) {
      console.error('❌ Erreur dans openMovieModal:', error);
      // Restaurer le scroll en cas d'erreur
      document.body.style.overflow = '';
      modalOverlay.classList.remove('active');
    } finally {
      // Libérer le verrou après la fin de l'animation CSS (300ms de transition)
      setTimeout(() => {
        isModalOpening = false;
      }, 350);
    }
  };

  console.log('✅ window.openMovieModal exposée');

  // Exposer les utilitaires partagés (utilisés par series-modal.js)
  window.createPersonAvatarCard  = createPersonAvatarCard;
  window.openPersonMiniPopup     = openPersonMiniPopup;
  window.backfillPersonPhotos    = backfillPersonPhotos;

  // Fonction utilitaire pour forcer la restauration du scroll
  window.forceRestoreBodyScroll = function() {
    document.body.style.overflow = '';
    document.body.style.removeProperty('overflow');
    console.log('🔧 Scroll du body forcé à la restauration');
  };

  // Restaurer le scroll au chargement de la page (au cas où)
  window.addEventListener('load', () => {
    if (!modalOverlay || !modalOverlay.classList.contains('active')) {
      window.forceRestoreBodyScroll();
    }
  });

  // Variables globales pour le film actuel
  let currentMovieId = null;
  let currentMoviePath = null;
  let currentMovieData = {};
  let selectedGenres = [];
  let posterImageFile = null;
  let tmdbGenresCache = null;

  // Variable pour éviter les ouvertures multiples rapides
  let isModalOpening = false;

  // Variables pour le système de boutons extensibles
  let isEditMode = false;
  let hasUnsavedChanges = false;
  let originalMovieData = {};
  
  // Configuration des clés de stockage (plus de système utilisateur)
  const USER_PREFS_KEY = 'userPrefs_global';

  // ============================================
  // NOUVELLES FONCTIONS POUR LES TAGS ET MÉTADONNÉES
  // ============================================

  // Restaure les spans pills (remplace les inputs/selects du mode édition) et met à jour l'affichage
  function displayMoviePlatformCountryStudios(movie) {
    const _restoreSpan = (sectionId, spanId) => {
      const section = document.getElementById(sectionId);
      if (!section) return;
      const editable = section.querySelector('input, select');
      if (editable) {
        const span = document.createElement('span');
        span.id = spanId;
        editable.replaceWith(span);
      }
    };
    _restoreSpan('platform-section', 'platform-name');
    _restoreSpan('country-pill', 'country-name');
    _restoreSpan('studios-pill', 'studios-name');

    // Restaurer la date (replace l'input inline si présent)
    if (releaseDate) {
      const inlineDateInput = releaseDate.querySelector('input');
      if (inlineDateInput) {
        releaseDate.textContent = movie.releaseDate || '';
      }
    }

    const platformSection = document.getElementById('platform-section');
    const platformName = document.getElementById('platform-name');
    if (movie.platform && movie.platform.trim()) {
      if (platformName) platformName.textContent = movie.platform;
      if (platformSection) platformSection.style.display = 'block';
    } else {
      if (platformSection) platformSection.style.display = 'none';
    }

    const countryPill = document.getElementById('country-pill');
    const countryName = document.getElementById('country-name');
    if (movie.country && movie.country.trim()) {
      if (countryName) countryName.textContent = movie.country;
      if (countryPill) countryPill.style.display = 'flex';
    } else {
      if (countryPill) countryPill.style.display = 'none';
    }

    const studiosPill = document.getElementById('studios-pill');
    const studiosName = document.getElementById('studios-name');
    const studiosArr = movie.studios || [];
    if (studiosArr.length > 0) {
      if (studiosName) studiosName.textContent = studiosArr.join(', ');
      if (studiosPill) studiosPill.style.display = 'flex';
    } else {
      if (studiosPill) studiosPill.style.display = 'none';
    }
  }

  // Afficher les crédits du film (personnes liées + fallback texte)
  async function displayMovieCredits(movie) {
    // Masquer toutes les sections par défaut
    const crewSection = document.getElementById('crew-section');
    const castSection = document.getElementById('cast-section');
    const directorSection = document.getElementById('director-section');
    const actorsSection = document.getElementById('actors-section');

    if (crewSection) crewSection.style.display = 'none';
    if (castSection) castSection.style.display = 'none';
    if (directorSection) directorSection.style.display = 'none';
    if (actorsSection) actorsSection.style.display = 'none';

    // Réinitialiser les grids
    for (const dept of Object.keys(CREW_ROLES)) {
      const deptEl = document.getElementById(`crew-${dept}`);
      if (deptEl) {
        deptEl.style.display = 'none';
        const grid = deptEl.querySelector('.credits-persons-grid');
        if (grid) grid.innerHTML = '';
      }
    }
    const castGrid = document.getElementById('cast-persons-grid');
    if (castGrid) castGrid.innerHTML = '';

    // Récupérer les personnes liées
    let hasPersons = false;
    try {
      const result = await window.electronAPI.getPersonsForMedia(movie.id);
      if (result.success && result.persons && result.persons.length > 0) {
        hasPersons = true;
        const crewByRole = {};
        for (const dept of Object.keys(CREW_ROLES)) crewByRole[dept] = [];
        const cast = [];

        for (const person of result.persons) {
          for (const roleObj of (person.roles || [])) {
            const role = roleObj.role;
            if (role === 'actor') {
              cast.push({ person, roleObj });
            } else if (CREW_ROLES[role]) {
              crewByRole[role].push({ person, roleObj });
            }
          }
        }

        // Remplir les grids crew
        let hasAnyCrew = false;
        for (const [dept, items] of Object.entries(crewByRole)) {
          if (items.length > 0) {
            hasAnyCrew = true;
            const deptEl = document.getElementById(`crew-${dept}`);
            if (deptEl) {
              deptEl.style.display = 'block';
              const grid = deptEl.querySelector('.credits-persons-grid');
              for (const { person, roleObj } of items) {
                grid.appendChild(createPersonAvatarCard(person, roleObj, false));
              }
            }
          }
        }
        if (hasAnyCrew && crewSection) crewSection.style.display = 'block';

        // Remplir le grid casting
        if (cast.length > 0 && castSection) {
          castSection.style.display = 'block';
          for (const { person, roleObj } of cast) {
            castGrid.appendChild(createPersonAvatarCard(person, roleObj, false));
          }
        }

        // Backfill photos manquantes en arrière-plan (sans bloquer l'affichage)
        backfillPersonPhotos(result.persons);
      }
    } catch (err) {
      console.warn('⚠️ Impossible de charger les personnes liées:', err);
    }

    // Fallback rétrocompatibilité si aucune personne liée
    if (!hasPersons) {
      const directorName = document.getElementById('director-name');
      if (movie.director && movie.director.trim()) {
        if (directorName) directorName.textContent = movie.director;
        if (directorSection) directorSection.style.display = 'block';
      }

      const actorsList = document.getElementById('actors-list');
      if (movie.actors && movie.actors.length > 0) {
        if (actorsList) actorsList.textContent = movie.actors.slice(0, 3).join(', ');
        if (actorsSection) actorsSection.style.display = 'block';
      }
    }

    // Plateforme d'origine
    const platformSection = document.getElementById('platform-section');
    const platformName = document.getElementById('platform-name');
    if (movie.platform && movie.platform.trim()) {
      if (platformName) platformName.textContent = movie.platform;
      if (platformSection) platformSection.style.display = 'block';
    } else {
      if (platformSection) platformSection.style.display = 'none';
    }

    // Pays de production
    const countryPill = document.getElementById('country-pill');
    const countryName = document.getElementById('country-name');
    if (movie.country && movie.country.trim()) {
      if (countryName) countryName.textContent = movie.country;
      if (countryPill) countryPill.style.display = 'flex';
    } else {
      if (countryPill) countryPill.style.display = 'none';
    }

    // Studios de production
    const studiosPill = document.getElementById('studios-pill');
    const studiosName = document.getElementById('studios-name');
    const studiosArr = movie.studios || [];
    if (studiosArr.length > 0) {
      if (studiosName) studiosName.textContent = studiosArr.join(', ');
      if (studiosPill) studiosPill.style.display = 'flex';
    } else {
      if (studiosPill) studiosPill.style.display = 'none';
    }
  }

  // Télécharge en arrière-plan les photos manquantes et met à jour les cartes affichées
  async function backfillPersonPhotos(persons) {
    const missing = persons.filter(p => !p.photo && p.tmdbId);
    for (const person of missing) {
      try {
        const details = await getTMDBPersonDetails(person.tmdbId);
        if (!details || !details.profile_path) continue;
        const photoUrl = `${TMDB_IMAGE_BASE_URL}${details.profile_path}`;
        const dlResult = await window.electronAPI.downloadPersonPhoto(photoUrl, person.name);
        if (!dlResult.success) continue;
        await window.electronAPI.updatePerson(person.id, { photo: dlResult.fileName });
        // Mettre à jour toutes les cartes affichées pour cette personne
        document.querySelectorAll(`.person-avatar-card[data-person-id="${person.id}"]`).forEach(card => {
          const placeholder = card.querySelector('.person-avatar-placeholder');
          if (!placeholder) return;
          const img = document.createElement('img');
          img.className = 'person-avatar-photo';
          img.src = `http://localhost:3001/person-photos/${dlResult.fileName}`;
          img.alt = person.name;
          img.onerror = function() {
            const ph = document.createElement('div');
            ph.className = 'person-avatar-placeholder';
            ph.innerHTML = '<i class="fas fa-user"></i>';
            this.parentNode.replaceChild(ph, this);
          };
          placeholder.replaceWith(img);
        });
      } catch (e) {
        console.warn(`Backfill photo échouée pour ${person.name}:`, e);
      }
    }
  }

  // Créer une carte avatar pour une personne
  function createPersonAvatarCard(person, roleObj, isEditMode) {
    const card = document.createElement('div');
    card.className = 'person-avatar-card';
    card.dataset.personId = person.id;
    card.dataset.role = roleObj.role;

    // Photo ou placeholder
    if (person.photo) {
      const img = document.createElement('img');
      img.className = 'person-avatar-photo';
      img.src = `http://localhost:3001/person-photos/${person.photo}`;
      img.alt = escapeHtml(person.name);
      img.onerror = function() {
        const ph = document.createElement('div');
        ph.className = 'person-avatar-placeholder';
        ph.innerHTML = '<i class="fas fa-user"></i>';
        this.parentNode.replaceChild(ph, this);
      };
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'person-avatar-placeholder';
      ph.innerHTML = '<i class="fas fa-user"></i>';
      card.appendChild(ph);
    }

    // Nom
    const nameEl = document.createElement('div');
    nameEl.className = 'person-avatar-name';
    nameEl.textContent = person.name;
    card.appendChild(nameEl);

    // Rôle / Personnage
    if (roleObj.character) {
      const roleEl = document.createElement('div');
      roleEl.className = 'person-avatar-role';
      roleEl.textContent = roleObj.character;
      card.appendChild(roleEl);
    }

    if (!isEditMode) {
      card.addEventListener('click', () => openPersonMiniPopup(person.id));
    } else {
      // Bouton supprimer
      const removeBtn = document.createElement('button');
      removeBtn.className = 'person-avatar-remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Retirer';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePersonFromCredits(person.id, roleObj.role);
      });
      card.appendChild(removeBtn);
    }

    return card;
  }

  // ============================================
  // MINI-POPUP PERSONNE
  // ============================================
  async function openPersonMiniPopup(personId) {
    // Supprimer une popup existante
    const existing = document.querySelector('.person-mini-popup-overlay');
    if (existing) existing.remove();

    try {
      const result = await window.electronAPI.getPersonById(personId);
      if (!result.success || !result.person) {
        console.warn('Personne non trouvée:', personId);
        return;
      }
      const person = result.person;

      const overlay = document.createElement('div');
      overlay.className = 'person-mini-popup-overlay';

      const popup = document.createElement('div');
      popup.className = 'person-mini-popup';

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'person-mini-popup-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => overlay.remove());
      popup.appendChild(closeBtn);

      // Header (photo + info)
      const header = document.createElement('div');
      header.className = 'person-mini-popup-header';

      if (person.photo) {
        const img = document.createElement('img');
        img.className = 'person-mini-popup-photo';
        img.src = `http://localhost:3001/person-photos/${person.photo}`;
        img.alt = escapeHtml(person.name);
        img.onerror = function() {
          const ph = document.createElement('div');
          ph.className = 'person-mini-popup-photo-placeholder';
          ph.innerHTML = '<i class="fas fa-user"></i>';
          this.parentNode.replaceChild(ph, this);
        };
        header.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'person-mini-popup-photo-placeholder';
        ph.innerHTML = '<i class="fas fa-user"></i>';
        header.appendChild(ph);
      }

      const info = document.createElement('div');
      const nameEl = document.createElement('h3');
      nameEl.className = 'person-mini-popup-name';
      nameEl.textContent = person.name;
      info.appendChild(nameEl);

      if (person.knownForDepartment) {
        const deptEl = document.createElement('div');
        deptEl.className = 'person-mini-popup-dept';
        deptEl.textContent = getDepartmentLabel(person.knownForDepartment);
        info.appendChild(deptEl);
      }

      if (person.birthday) {
        const datesEl = document.createElement('div');
        datesEl.className = 'person-mini-popup-dates';
        let dateText = `Né(e) le ${person.birthday}`;
        if (person.deathday) dateText += ` — Décédé(e) le ${person.deathday}`;
        datesEl.textContent = dateText;
        info.appendChild(datesEl);
      }

      header.appendChild(info);
      popup.appendChild(header);

      // Bio
      if (person.biography) {
        const bio = document.createElement('div');
        bio.className = 'person-mini-popup-bio';
        bio.textContent = person.biography;
        popup.appendChild(bio);
      }

      // Filmographie locale
      if (person.roles && person.roles.length > 0) {
        const filmoTitle = document.createElement('div');
        filmoTitle.className = 'person-mini-popup-filmography-title';
        filmoTitle.textContent = 'Filmographie locale';
        popup.appendChild(filmoTitle);

        const filmoList = document.createElement('div');
        filmoList.className = 'person-mini-popup-filmography';

        for (const role of person.roles) {
          try {
            const mediaResult = await window.electronAPI.getMediaDetails(role.mediaId);
            if (mediaResult.success && mediaResult.media) {
              const item = document.createElement('div');
              item.className = 'person-mini-popup-film-item';

              const titleEl = document.createElement('span');
              titleEl.className = 'person-mini-popup-film-title';
              titleEl.textContent = mediaResult.media.title;
              item.appendChild(titleEl);

              const roleEl = document.createElement('span');
              roleEl.className = 'person-mini-popup-film-role';
              roleEl.textContent = role.character || (CREW_ROLES[role.role] ? CREW_ROLES[role.role].label : role.role);
              item.appendChild(roleEl);

              filmoList.appendChild(item);
            }
          } catch (e) {
            console.warn('Erreur chargement média pour filmographie:', e);
          }
        }

        popup.appendChild(filmoList);
      }

      overlay.appendChild(popup);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
      document.body.appendChild(overlay);

    } catch (err) {
      console.error('Erreur ouverture mini-popup personne:', err);
    }
  }

  // ============================================
  // MODE ÉDITION PERSONNES
  // ============================================
  async function transformCreditsToEditMode() {
    try {
      const result = await window.electronAPI.getPersonsForMedia(currentMovieId);
      const crewByRole = {};
      for (const dept of Object.keys(CREW_ROLES)) crewByRole[dept] = [];
      const cast = [];

      if (result.success && result.persons) {
        for (const person of result.persons) {
          for (const roleObj of (person.roles || [])) {
            if (roleObj.role === 'actor') {
              cast.push({ person, roleObj });
            } else if (CREW_ROLES[roleObj.role]) {
              crewByRole[roleObj.role].push({ person, roleObj });
            }
          }
        }
      }

      // Afficher toutes les sections crew (même vides en édition)
      const crewSection = document.getElementById('crew-section');
      if (crewSection) crewSection.style.display = 'block';

      for (const [dept, items] of Object.entries(crewByRole)) {
        const deptEl = document.getElementById(`crew-${dept}`);
        if (!deptEl) continue;
        deptEl.style.display = 'block';
        const grid = deptEl.querySelector('.credits-persons-grid');
        if (!grid) continue;
        grid.innerHTML = '';

        for (const { person, roleObj } of items) {
          grid.appendChild(createPersonAvatarCard(person, roleObj, true));
        }

        // Bouton "+"
        const addBtn = document.createElement('div');
        addBtn.className = 'person-avatar-card';
        addBtn.style.cursor = 'pointer';
        const addCircle = document.createElement('button');
        addCircle.className = 'add-person-btn';
        addCircle.innerHTML = '<i class="fas fa-plus"></i>';
        addCircle.addEventListener('click', () => openPersonSearchModal(dept));
        addBtn.appendChild(addCircle);
        grid.appendChild(addBtn);
      }

      // Section casting
      const castSection = document.getElementById('cast-section');
      if (castSection) castSection.style.display = 'block';
      const castGrid = document.getElementById('cast-persons-grid');
      if (castGrid) {
        castGrid.innerHTML = '';
        for (const { person, roleObj } of cast) {
          castGrid.appendChild(createPersonAvatarCard(person, roleObj, true));
        }
        // Bouton "+"
        const addBtn = document.createElement('div');
        addBtn.className = 'person-avatar-card';
        addBtn.style.cursor = 'pointer';
        const addCircle = document.createElement('button');
        addCircle.className = 'add-person-btn';
        addCircle.innerHTML = '<i class="fas fa-plus"></i>';
        addCircle.addEventListener('click', () => openPersonSearchModal('actor'));
        addBtn.appendChild(addCircle);
        castGrid.appendChild(addBtn);
      }

      // Masquer les fallback texte
      const directorSection = document.getElementById('director-section');
      const actorsSection = document.getElementById('actors-section');
      if (directorSection) directorSection.style.display = 'none';
      if (actorsSection) actorsSection.style.display = 'none';

    } catch (err) {
      console.error('Erreur transformCreditsToEditMode:', err);
    }
  }

  // ============================================
  // MODAL RECHERCHE PERSONNE
  // ============================================
  function openPersonSearchModal(department) {
    const existing = document.querySelector('.person-search-modal-overlay');
    if (existing) existing.remove();

    const roleLabel = department === 'actor' ? 'Acteur' : (CREW_ROLES[department] ? CREW_ROLES[department].label : department);

    const overlay = document.createElement('div');
    overlay.className = 'person-search-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'person-search-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'person-search-header';
    const title = document.createElement('h3');
    title.textContent = `Ajouter un ${roleLabel}`;
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'person-search-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Input
    const inputWrap = document.createElement('div');
    inputWrap.className = 'person-search-input-wrap';
    const input = document.createElement('input');
    input.className = 'person-search-input';
    input.type = 'text';
    input.placeholder = 'Rechercher une personne...';
    inputWrap.appendChild(input);
    modal.appendChild(inputWrap);

    // Résultats
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'person-search-results';
    resultsContainer.innerHTML = '<div class="person-search-empty">Tapez un nom pour rechercher</div>';
    modal.appendChild(resultsContainer);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);

    // Focus input
    setTimeout(() => input.focus(), 100);

    // Debounce search
    let debounceTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query.length < 2) {
        resultsContainer.innerHTML = '<div class="person-search-empty">Tapez au moins 2 caractères</div>';
        return;
      }
      debounceTimer = setTimeout(() => performPersonSearch(query, resultsContainer, overlay, department), 300);
    });
  }

  async function performPersonSearch(query, container, overlay, department) {
    container.innerHTML = '<div class="person-search-empty">Recherche en cours...</div>';

    try {
      // Récupérer les personnes déjà liées à ce média
      const linkedResult = await window.electronAPI.getPersonsForMedia(currentMovieId);
      const linkedIds = new Set();
      const linkedTmdbIds = new Set();
      if (linkedResult.success && linkedResult.persons) {
        for (const p of linkedResult.persons) {
          // Vérifier si déjà lié avec ce rôle spécifique
          for (const r of (p.roles || [])) {
            if (r.role === department) {
              linkedIds.add(p.id);
              if (p.tmdbId) linkedTmdbIds.add(p.tmdbId);
            }
          }
        }
      }

      // Recherche locale
      const localResult = await window.electronAPI.searchPersons(query);
      const localPersons = (localResult.success ? localResult.persons : [])
        .filter(p => !linkedIds.has(p.id));

      // Recherche TMDB
      let tmdbPersons = [];
      try {
        const tmdbResults = await searchTMDBPerson(query);
        tmdbPersons = tmdbResults.filter(p => !linkedTmdbIds.has(p.id));
      } catch (e) {
        console.warn('Recherche TMDB échouée:', e);
      }

      // Exclure les TMDB déjà en local (par tmdbId)
      const localTmdbIds = new Set(localPersons.filter(p => p.tmdbId).map(p => p.tmdbId));
      tmdbPersons = tmdbPersons.filter(p => !localTmdbIds.has(p.id));

      container.innerHTML = '';

      if (localPersons.length === 0 && tmdbPersons.length === 0) {
        container.innerHTML = '<div class="person-search-empty">Aucun résultat</div>';
        return;
      }

      // Section locale
      if (localPersons.length > 0) {
        const label = document.createElement('div');
        label.className = 'person-search-section-label';
        label.textContent = 'Bibliothèque locale';
        container.appendChild(label);

        for (const person of localPersons) {
          container.appendChild(createSearchResultItem(person, 'local', overlay, department));
        }
      }

      // Section TMDB
      if (tmdbPersons.length > 0) {
        const label = document.createElement('div');
        label.className = 'person-search-section-label';
        label.textContent = 'TMDB';
        container.appendChild(label);

        for (const tmdbPerson of tmdbPersons.slice(0, 10)) {
          const item = createSearchResultItem({
            tmdbId: tmdbPerson.id,
            name: tmdbPerson.name,
            photo: tmdbPerson.profile_path ? `https://image.tmdb.org/t/p/w185${tmdbPerson.profile_path}` : null,
            knownForDepartment: tmdbPerson.known_for_department,
            _isTMDB: true,
            _profilePath: tmdbPerson.profile_path
          }, 'tmdb', overlay, department);
          container.appendChild(item);
        }
      }

    } catch (err) {
      console.error('Erreur recherche personne:', err);
      container.innerHTML = '<div class="person-search-empty">Erreur de recherche</div>';
    }
  }

  function createSearchResultItem(person, source, overlay, department) {
    const item = document.createElement('div');
    item.className = 'person-search-result-item';

    // Photo
    if (person.photo) {
      const img = document.createElement('img');
      img.className = 'person-search-result-photo';
      if (source === 'local') {
        img.src = `http://localhost:3001/person-photos/${person.photo}`;
      } else {
        img.src = person.photo;
      }
      img.onerror = function() {
        const ph = document.createElement('div');
        ph.className = 'person-search-result-photo-placeholder';
        ph.innerHTML = '<i class="fas fa-user"></i>';
        this.parentNode.replaceChild(ph, this);
      };
      item.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'person-search-result-photo-placeholder';
      ph.innerHTML = '<i class="fas fa-user"></i>';
      item.appendChild(ph);
    }

    // Info
    const info = document.createElement('div');
    info.className = 'person-search-result-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'person-search-result-name';
    nameEl.textContent = person.name;
    info.appendChild(nameEl);

    if (person.knownForDepartment) {
      const deptEl = document.createElement('div');
      deptEl.className = 'person-search-result-dept';
      deptEl.textContent = getDepartmentLabel(person.knownForDepartment);
      info.appendChild(deptEl);
    }
    item.appendChild(info);

    // Badge
    const badge = document.createElement('span');
    badge.className = `person-search-result-badge ${source}`;
    badge.textContent = source === 'local' ? 'LOCAL' : 'TMDB';
    item.appendChild(badge);

    // Click handler
    item.addEventListener('click', () => handlePersonSearchSelection(person, source, overlay, department));

    return item;
  }

  function showCharacterNameDialog(parentOverlay) {
    return new Promise((resolve) => {
      // Remplacer le contenu de la modal par le dialogue
      const modal = parentOverlay.querySelector('.person-search-modal');
      if (!modal) { resolve(null); return; }

      const prevContent = modal.innerHTML;
      modal.innerHTML = `
        <div class="person-search-header">
          <h3>Nom du personnage</h3>
          <button class="person-search-close-btn" id="char-dialog-skip">&times;</button>
        </div>
        <div class="person-search-input-wrap">
          <input class="person-search-input" id="char-dialog-input" type="text" placeholder="Ex: Tony Stark (optionnel)">
        </div>
        <div style="padding: 12px 20px; display: flex; gap: 10px; justify-content: flex-end;">
          <button id="char-dialog-skip-btn" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #90a4ae; cursor: pointer;">Passer</button>
          <button id="char-dialog-ok-btn" style="padding: 8px 16px; background: rgba(100,181,246,0.3); border: 1px solid rgba(100,181,246,0.4); border-radius: 8px; color: #fff; cursor: pointer;">Valider</button>
        </div>
      `;

      const input = document.getElementById('char-dialog-input');
      const okBtn = document.getElementById('char-dialog-ok-btn');
      const skipBtn = document.getElementById('char-dialog-skip-btn');
      const closeBtn = document.getElementById('char-dialog-skip');

      setTimeout(() => input.focus(), 50);

      const submit = () => resolve(input.value.trim() || null);
      const skip = () => resolve(null);

      okBtn.addEventListener('click', submit);
      skipBtn.addEventListener('click', skip);
      closeBtn.addEventListener('click', skip);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') skip();
      });
    });
  }

  async function handlePersonSearchSelection(person, source, overlay, department) {
    try {
      let personId;

      if (source === 'local') {
        personId = person.id;
      } else {
        // TMDB: importer la personne
        let details;
        try {
          details = await getTMDBPersonDetails(person.tmdbId);
        } catch (e) {
          console.warn('Impossible de récupérer les détails TMDB:', e);
          details = {};
        }

        // Télécharger la photo
        let fileName = null;
        if (person._profilePath) {
          try {
            const photoUrl = `${TMDB_IMAGE_BASE_URL}${person._profilePath}`;
            const dlResult = await window.electronAPI.downloadPersonPhoto(photoUrl, person.name);
            if (dlResult.success) {
              fileName = dlResult.fileName;
            }
          } catch (e) {
            console.warn('Photo échouée:', e);
          }
        }

        // Créer la personne
        const addResult = await window.electronAPI.addPerson({
          tmdbId: person.tmdbId,
          name: person.name,
          photo: fileName,
          knownForDepartment: person.knownForDepartment || details.known_for_department,
          biography: details.biography || null,
          birthday: details.birthday || null,
          deathday: details.deathday || null,
          placeOfBirth: details.place_of_birth || null
        });

        if (!addResult.success || !addResult.person) {
          console.error('Impossible d\'ajouter la personne:', addResult.error);
          return;
        }
        personId = addResult.person.id;
      }

      // Pour les acteurs, demander le nom du personnage via dialogue inline
      if (department === 'actor') {
        const character = await showCharacterNameDialog(overlay);
        await window.electronAPI.linkPersonToMedia(personId, currentMovieId, 'film', department, character);
      } else {
        await window.electronAPI.linkPersonToMedia(personId, currentMovieId, 'film', department, null);
      }

      // Fermer la modal et rafraîchir
      overlay.remove();
      await transformCreditsToEditMode();
      hasUnsavedChanges = true;
      updateSaveButtonState();

    } catch (err) {
      console.error('Erreur ajout personne:', err);
    }
  }

  // ============================================
  // SUPPRESSION PERSONNE DES CRÉDITS
  // ============================================
  async function removePersonFromCredits(personId, role) {
    try {
      await window.electronAPI.unlinkPersonFromMedia(personId, currentMovieId, role);
      await transformCreditsToEditMode();
      hasUnsavedChanges = true;
      updateSaveButtonState();
    } catch (err) {
      console.error('Erreur suppression lien personne:', err);
    }
  }

  // Sync rétrocompatible: extraire director/actors depuis les person links
  async function syncLegacyCreditsFromPersons(movieId) {
    try {
      const result = await window.electronAPI.getPersonsForMedia(movieId);
      if (!result.success || !result.persons || result.persons.length === 0) {
        return null;
      }

      const directors = [];
      const actors = [];

      for (const person of result.persons) {
        for (const roleObj of (person.roles || [])) {
          if (roleObj.role === 'director') directors.push(person.name);
          if (roleObj.role === 'actor') actors.push(person.name);
        }
      }

      return {
        director: directors.join(', '),
        actors: actors
      };
    } catch (err) {
      console.warn('Erreur sync legacy credits:', err);
      return null;
    }
  }

  // Afficher les tags organisés par catégories avec chips colorés
  function displayOrganizedTags(movie) {
    // Genres
    displayTagCategory('genres', movie.genres, 'genre');

    // Ambiance/Mood
    displayTagCategory('mood', movie.mood, 'mood');

    // Technique
    displayTagCategory('technical', movie.technical, 'technical');

    // Personnel
    displayTagCategory('personal', movie.personalTags, 'personal');

    // Franchises (masquées si vides)
    displayTagCategory('franchise', movie.franchises, 'franchise', { hideWhenEmpty: true });
  }

  // Fonction helper pour afficher une catégorie de tags
  function displayTagCategory(categoryId, tags, chipClass, options = {}) {
    const categoryElement = document.getElementById(`${categoryId}-category`);
    const containerElement = document.getElementById(`${categoryId}-container`);

    if (!categoryElement || !containerElement) return;

    // Vider le conteneur
    containerElement.innerHTML = '';

    if (tags && tags.length > 0) {
      // Afficher les tags existants
      tags.forEach(tag => {
        if (tag && tag.trim()) {
          const chip = document.createElement('span');
          chip.className = `tag-chip ${chipClass}`;
          chip.textContent = tag;
          containerElement.appendChild(chip);
        }
      });
    }

    // En mode édition, toujours afficher le bouton + pour ajouter des tags
    if (isEditMode) {
      const addButton = document.createElement('button');
      addButton.className = 'add-tag-btn-inline';
      addButton.innerHTML = '<i class="fas fa-plus"></i>';
      addButton.dataset.category = categoryId;
      addButton.title = 'Ajouter un tag';
      containerElement.appendChild(addButton);
      categoryElement.style.display = 'block';
    } else if (!tags || tags.length === 0) {
      if (options.hideWhenEmpty) {
        categoryElement.style.display = 'none';
      } else {
        const emptyMessage = document.createElement('span');
        emptyMessage.className = 'empty-tags-message';
        emptyMessage.textContent = 'Aucun tag ajouté';
        containerElement.appendChild(emptyMessage);
        categoryElement.style.display = 'block';
      }
    } else {
      categoryElement.style.display = 'block';
    }
  }

  // Afficher les informations techniques du média
  function displayTechnicalInfo(movie) {
    // Utiliser les données disponibles + inférer quelques informations
    const videoQuality = movie.videoQuality || inferVideoQuality(movie.title);
    const fileSize = movie.formattedSize || (movie.fileSize ? window.formatFileSize(movie.fileSize) : null);
    const audioFormat = movie.audioFormat || null;
    const videoCodec = movie.videoCodec || null;
    const language = movie.language || 'Français';

    const hasAnyTechInfo = videoQuality || fileSize || movie.duration || audioFormat || videoCodec || language;

    // Qualité vidéo
    const techQuality = document.getElementById('tech-quality');
    const techQualityValue = document.getElementById('tech-quality-value');
    if (videoQuality) {
      techQualityValue.textContent = videoQuality;
      techQuality.style.display = 'flex';
    } else {
      techQuality.style.display = 'none';
    }

    // Taille du fichier
    const techFilesize = document.getElementById('tech-filesize');
    const techFilesizeValue = document.getElementById('tech-filesize-value');
    if (fileSize) {
      techFilesizeValue.textContent = fileSize;
      techFilesize.style.display = 'flex';
    } else {
      techFilesize.style.display = 'none';
    }

    // Durée précise
    const techDurationPrecise = document.getElementById('tech-duration-precise');
    const techDurationPreciseValue = document.getElementById('tech-duration-precise-value');
    if (movie.duration) {
      techDurationPreciseValue.textContent = formatPreciseDuration(movie.duration);
      techDurationPrecise.style.display = 'flex';
    } else {
      techDurationPrecise.style.display = 'none';
    }

    // Codec vidéo
    const techCodec = document.getElementById('tech-codec');
    const techCodecValue = document.getElementById('tech-codec-value');
    if (videoCodec) {
      techCodecValue.textContent = videoCodec;
      techCodec.style.display = 'flex';
    } else {
      techCodec.style.display = 'none';
    }

    // Format audio
    const techAudio = document.getElementById('tech-audio');
    const techAudioValue = document.getElementById('tech-audio-value');
    if (audioFormat) {
      techAudioValue.textContent = audioFormat;
      techAudio.style.display = 'flex';
    } else {
      techAudio.style.display = 'none';
    }

    // Langue
    const techLanguage = document.getElementById('tech-language');
    const techLanguageValue = document.getElementById('tech-language-value');
    if (language) {
      techLanguageValue.textContent = language;
      techLanguage.style.display = 'flex';
    } else {
      techLanguage.style.display = 'none';
    }

    // Sous-titres
    const techSubtitles = document.getElementById('tech-subtitles');
    const techSubtitlesValue = document.getElementById('tech-subtitles-value');
    if (techSubtitles && techSubtitlesValue) {
      if (movie.subtitles && movie.subtitles.length > 0) {
        const subtitlesText = Array.isArray(movie.subtitles) ? movie.subtitles.join(', ') : movie.subtitles;
        techSubtitlesValue.textContent = subtitlesText;
        techSubtitles.style.display = 'flex';
      } else {
        techSubtitlesValue.textContent = 'Aucun';
        techSubtitlesValue.style.fontStyle = 'italic';
        techSubtitlesValue.style.color = '#888';
        techSubtitles.style.display = 'flex';
      }
    }

    // Date d'ajout
    const techDateAdded = document.getElementById('tech-date-added');
    const techDateAddedValue = document.getElementById('tech-date-added-value');
    if (techDateAdded && techDateAddedValue) {
      if (movie.dateAdded || movie.date_added || movie.createdAt) {
        const dateAdded = movie.dateAdded || movie.date_added || movie.createdAt;
        const formattedDate = new Date(dateAdded).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        techDateAddedValue.textContent = formattedDate;
        techDateAdded.style.display = 'flex';
      } else {
        techDateAdded.style.display = 'none';
      }
    }

    // Afficher ou masquer la section entière
    const technicalInfoSection = document.querySelector('.technical-info');
    if (technicalInfoSection) {
      technicalInfoSection.style.display = hasAnyTechInfo ? 'block' : 'none';
    }
  }

  // Afficher les statistiques de visionnage
  function displayViewingStats(movieId, movie) {
    const userPrefs = loadUserPreferences();

    // Nombre de visionnages
    const watchCount = userPrefs.watchCount && userPrefs.watchCount[movieId] ? userPrefs.watchCount[movieId] : 0;
    const statWatchCount = document.getElementById('stat-watch-count');
    const statWatchCountValue = document.getElementById('stat-watch-count-value');
    if (watchCount > 0) {
      statWatchCountValue.textContent = `${watchCount} fois`;
      statWatchCount.style.display = 'flex';
    } else {
      statWatchCount.style.display = 'none';
    }

    // Dernier visionnage
    const lastWatched = userPrefs.lastWatched && userPrefs.lastWatched[movieId];
    const statLastWatched = document.getElementById('stat-last-watched');
    const statLastWatchedValue = document.getElementById('stat-last-watched-value');
    if (lastWatched) {
      const date = new Date(lastWatched);
      statLastWatchedValue.textContent = date.toLocaleDateString('fr-FR');
      statLastWatched.style.display = 'flex';
    } else {
      statLastWatched.style.display = 'none';
    }

    // Progression de lecture
    const progress = userPrefs.playProgress && userPrefs.playProgress[movieId];
    const statProgress = document.getElementById('stat-progress');
    const statProgressValue = document.getElementById('stat-progress-value');
    const progressBarFill = document.getElementById('progress-bar-fill');
    if (progress && progress.percentage > 0) {
      statProgressValue.textContent = `${Math.round(progress.percentage)}%`;
      progressBarFill.style.width = `${progress.percentage}%`;
      statProgress.style.display = 'flex';
    } else {
      statProgress.style.display = 'none';
    }

    // Note personnelle (DB en priorité, localStorage en fallback)
    const dbRatingStat = currentMovieData.rating || 0;
    const localRatingStat = (loadUserPreferences().ratings && loadUserPreferences().ratings[currentMovieId]) || 0;
    const rating = dbRatingStat > 0 ? dbRatingStat : localRatingStat;
    const statRatingPersonal = document.getElementById('stat-rating-personal');
    const statRatingPersonalValue = document.getElementById('stat-rating-personal-value');
    if (rating > 0) {
      const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
      statRatingPersonalValue.textContent = `${stars} (${rating}/5)`;
      statRatingPersonal.style.display = 'flex';
    } else {
      statRatingPersonal.style.display = 'none';
    }

    // Afficher ou masquer la section entière
    const hasAnyStats = watchCount > 0 || lastWatched || (progress && progress.percentage > 0) || rating > 0;
    const viewingStatsSection = document.querySelector('.viewing-stats');
    if (viewingStatsSection) {
      viewingStatsSection.style.display = hasAnyStats ? 'block' : 'none';
    }
  }

  function formatPreciseDuration(seconds) {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Fonctions d'inférence pour les données techniques
  function inferVideoQuality(title) {
    if (title.includes('4K') || title.includes('2160p')) return '4K Ultra HD';
    if (title.includes('1080p') || title.includes('FullHD')) return '1080p Full HD';
    if (title.includes('720p') || title.includes('HD')) return '720p HD';
    if (title.includes('480p')) return '480p SD';
    // Inférer basé sur l'année et la popularité
    return '1080p Full HD'; // Défaut moderne
  }

  // Basculer vers le mode édition avec changement visuel
  function toggleEditMode(enable) {
    const modalContent = document.querySelector('.modal-content');
    const editableFields = document.querySelectorAll('.editable-field');
    const addTagButtons = document.querySelectorAll('.add-tag-btn-inline');

    if (enable) {
      // Activer le mode édition
      if (modalContent) {
        modalContent.classList.add('edit-mode-active');
      }

      // Rendre les champs éditables visibles
      editableFields.forEach(field => {
        field.classList.add('editing');
      });

      // Préremplir les champs d'édition avec les valeurs actuelles
      if (editTitleInput && currentMovieData.title) {
        editTitleInput.value = currentMovieData.title;
      }
      if (editSynopsisInput && currentMovieData.description) {
        editSynopsisInput.value = currentMovieData.description;
      }
      if (editReleaseDateInput && currentMovieData.releaseDate) {
        // Convertir JJ/MM/AAAA en AAAA-MM-JJ pour l'input date
        const parts = currentMovieData.releaseDate.split('/');
        if (parts.length === 3) {
          editReleaseDateInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      // Copier les genres actuels
      selectedGenres = [...(currentMovieData.genres || [])];

      // Édition inline : platform, studios (remplace le span par un input)
      const _makePillInput = (sectionId, spanId, value, placeholder, displayMode = 'block') => {
        const section = document.getElementById(sectionId);
        const span = document.getElementById(spanId);
        if (!section || !span || span.tagName === 'INPUT') return;
        section.style.display = displayMode;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-credit-field';
        input.id = spanId;
        input.value = value || '';
        input.placeholder = placeholder;
        span.replaceWith(input);
      };
      _makePillInput('platform-section', 'platform-name', currentMovieData.platform, 'Plateforme');
      _makePillInput('studios-pill', 'studios-name', (currentMovieData.studios || []).join(', '), 'Studios (virgule)', 'flex');

      // Pays → select avec drapeaux
      const countrySection = document.getElementById('country-pill');
      const countrySpan = document.getElementById('country-name');
      if (countrySection && countrySpan && countrySpan.tagName !== 'SELECT') {
        countrySection.style.display = 'flex';
        const sel = createCountrySelect(currentMovieData.country, 'country-name', 'edit-credit-field edit-credit-select');
        countrySpan.replaceWith(sel);
      }

      // Date de sortie → input inline dans la pill release-date
      if (releaseDate && !releaseDate.querySelector('input')) {
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'edit-credit-field';
        dateInput.id = 'inline-release-date';
        const parts = (currentMovieData.releaseDate || '').split('/');
        if (parts.length === 3) dateInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        releaseDate.textContent = '';
        releaseDate.appendChild(dateInput);
      }

      // Rafraîchir l'affichage des tags pour montrer les boutons d'ajout
      displayOrganizedTags(currentMovieData);

    } else {
      // Désactiver le mode édition
      if (modalContent) {
        modalContent.classList.remove('edit-mode-active');
      }

      // Masquer les champs éditables
      editableFields.forEach(field => {
        field.classList.remove('editing');
      });

      // Restaurer les spans pills (platform, country, studios)
      displayMoviePlatformCountryStudios(currentMovieData);

      // Rafraîchir l'affichage des tags sans les boutons d'ajout
      displayOrganizedTags(currentMovieData);
    }
  }

  // Fonctions utilitaires pour les préférences globales
  function loadUserPreferences() {
    try {
      let userPrefs = JSON.parse(localStorage.getItem(USER_PREFS_KEY) || '{}');
      
      // S'assurer que les objets nécessaires existent
      if (!userPrefs.watchedMovies) userPrefs.watchedMovies = {};
      if (!userPrefs.ratings) userPrefs.ratings = {};
      if (!userPrefs.watchCount) userPrefs.watchCount = {};
      if (!userPrefs.lastWatched) userPrefs.lastWatched = {};
      if (!userPrefs.playProgress) userPrefs.playProgress = {};

      return userPrefs;
    } catch (e) {
      console.error('Erreur lors du chargement des préférences utilisateur:', e);
      return {
        watchedMovies: {},
        ratings: {},
        watchCount: {},
        lastWatched: {},
        playProgress: {}
      };
    }
  }
  
  function saveUserPreferences(prefs) {
    try {
      localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde des préférences utilisateur:', e);
    }
  }

  // Fonction pour sauvegarder une note dans le fichier JSON
  async function saveRatingToDatabase(mediaId, rating) {
    if (window.electronAPI && window.electronAPI.updateRating) {
      try {
        await window.electronAPI.updateRating(mediaId, rating);
        console.log(`💾 Note sauvegardée dans le fichier JSON: ${rating}/5`);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de la note dans le fichier:', error);
      }
    }
  }

  // Fonction pour automatiquement marquer comme "Vu"
  function autoMarkAsWatched() {
    if (!currentMovieId) return;

    const userPrefs = loadUserPreferences();

    // Si le film n'est pas encore marqué comme vu, le marquer
    if (!userPrefs.watchedMovies[currentMovieId]) {
      userPrefs.watchedMovies[currentMovieId] = true;
      saveUserPreferences(userPrefs);

      // Mettre à jour l'interface
      watchToggleModal.textContent = 'Vu !';
      watchToggleModal.classList.add('watched');

      // Mettre à jour la carte dans le dashboard
      const card = document.querySelector(`.media-card[data-id="${currentMovieId}"]`);
      if (card) {
        const buttons = card.querySelectorAll('.btn-watch-toggle');
        buttons.forEach(btn => {
          btn.textContent = 'vu !';
          btn.classList.add('watched');
        });
      }

      console.log('Film automatiquement marqué comme "Vu"');
    }
  }

  async function saveChanges() {
    if (!hasUnsavedChanges) {
      console.log('Aucune modification à sauvegarder');
      return;
    }

    if (!currentMovieId) {
      console.error('❌ Pas de film sélectionné');
      return;
    }

    console.log('💾 Sauvegarde des modifications...');

    try {
      // Récupérer les valeurs des champs d'édition
      const title = editTitleInput.value.trim() || currentMovieData.title;

      // Convertir la date au format JJ/MM/AAAA (input inline prioritaire sur le champ caché)
      const inlineDateInput = document.getElementById('inline-release-date');
      const dateSource = (inlineDateInput && inlineDateInput.value) ? inlineDateInput : editReleaseDateInput;
      let formattedDate = '';
      if (dateSource && dateSource.value) {
        const dateParts = dateSource.value.split('-');
        if (dateParts.length === 3) {
          formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }

      // Capture l'URL de l'image actuelle (poster visible ou données en mémoire)
      const visiblePoster = document.getElementById('modal-poster');
      let finalImageUrl = currentMovieData.posterUrl || (visiblePoster ? visiblePoster.src : null) || (imagePreview ? imagePreview.src : null);

      // Télécharger l'image TMDB si c'est une URL TMDB
      if (finalImageUrl && finalImageUrl.includes('image.tmdb.org')) {
        try {
          console.log('🔄 Téléchargement de l\'image TMDB...');
          const downloadResult = await window.electronAPI.downloadTMDBImage(finalImageUrl, currentMovieId);
          if (downloadResult.success) {
            const filename = downloadResult.localPath.split(/[\\/]/).pop();
            finalImageUrl = `http://localhost:3001/tmdb-images/${filename}`;
            console.log(`✅ Image TMDB téléchargée: ${filename}`);
          }
        } catch (error) {
          console.warn('⚠️ Échec téléchargement image, utilisation URL originale');
        }
      }

      // Extraire l'année
      let year = null;
      if (dateSource && dateSource.value) {
        year = new Date(dateSource.value).getFullYear();
      }

      // Synchroniser director/actors depuis les person links (source de vérité)
      const legacyCredits = await syncLegacyCreditsFromPersons(currentMovieId);
      const legacyDirector = legacyCredits ? legacyCredits.director : (currentMovieData.director || '');
      const legacyActors = legacyCredits ? legacyCredits.actors : (currentMovieData.actors || []);

      // Lire les champs pills éditables (platform, country, studios)
      const platformInput = document.getElementById('platform-name');
      const countryEl = document.getElementById('country-name');
      const studiosInput = document.getElementById('studios-name');

      // Préparer les données à sauvegarder
      const movieUpdates = {
        title: title,
        releaseDate: formattedDate,
        genres: selectedGenres || [],
        description: editSynopsisInput.value.trim(),
        posterUrl: finalImageUrl,
        year: year,
        mood: currentMovieData.mood || [],
        technical: currentMovieData.technical || [],
        personalTags: currentMovieData.personalTags || [],
        franchises: currentMovieData.franchises || [],
        director: legacyDirector,
        actors: legacyActors,
        platform: platformInput && platformInput.tagName === 'INPUT' ? platformInput.value.trim() : (currentMovieData.platform || ''),
        country: countryEl && (countryEl.tagName === 'INPUT' || countryEl.tagName === 'SELECT') ? countryEl.value.trim() : (currentMovieData.country || ''),
        studios: studiosInput && studiosInput.tagName === 'INPUT'
          ? studiosInput.value.split(',').map(s => s.trim()).filter(s => s)
          : (currentMovieData.studios || [])
      };

      console.log('📝 Données à sauvegarder:', movieUpdates);

      // Sauvegarder dans localStorage (backup local)
      window.movieEdits.save(currentMovieId, movieUpdates);

      // Sauvegarder dans la base de données via l'API
      if (window.electronAPI && window.electronAPI.updateMedia) {
        const result = await window.electronAPI.updateMedia(currentMovieId, movieUpdates);
        if (result.success) {
          console.log('✅ Modifications enregistrées dans la base de données');

          // Mettre à jour l'affichage
          modalTitle.textContent = title;
          movieYear.textContent = year ? `(${year})` : '';
          releaseDate.textContent = formattedDate;
          modalPoster.src = finalImageUrl;

          // Mettre à jour le synopsis
          if (movieUpdates.description) {
            synopsisContent.textContent = movieUpdates.description;
            synopsisContent.style.fontStyle = 'normal';
          }

          // Mettre à jour les données locales
          currentMovieData = { ...currentMovieData, ...movieUpdates };
          originalMovieData = { ...currentMovieData };

          // Restaurer les spans pills (platform, country, studios) et afficher les nouvelles valeurs
          displayMoviePlatformCountryStudios(currentMovieData);

          // Rafraîchir le dashboard
          if (typeof window.refreshDashboard === 'function') {
            window.refreshDashboard();
          }
        } else {
          console.error('❌ Échec de l\'enregistrement:', result.message);
          alert('Erreur lors de la sauvegarde: ' + result.message);
          return;
        }
      } else {
        console.error('❌ API updateMedia non disponible');
        alert('Erreur: API de sauvegarde non disponible');
        return;
      }

      hasUnsavedChanges = false;
      updateSaveButtonState();
      console.log('✅ Modifications sauvegardées avec succès');

    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  }

  function markAsChanged() {
    hasUnsavedChanges = true;
    updateSaveButtonState();

    // Afficher les boutons d'extension lors du premier changement
    showExtensionButtons();

    // Mettre à jour l'état des boutons extensibles
    if (isEditMode) {
      // Le bouton save devient vert (actif) s'il y a des modifications
      if (editSaveBtn) {
        editSaveBtn.classList.add('active');
      }
    }
  }
  
  // Fonction interne pour ouvrir la modal avec les données du film
  async function openMovieModalInternal(movieId) {
    try {
      console.log('🎬 Ouverture de la modale pour le film ID:', movieId);

      // Vérifier que les éléments essentiels existent
      if (!modalOverlay || !viewMode) {
        console.error('❌ Éléments de la modale manquants:', { modalOverlay, viewMode });
        return;
      }

      // S'assurer que la modale est complètement fermée avant de l'ouvrir
      modalOverlay.classList.remove('active');
      // Nettoyer les styles inline qui pourraient rester
      modalOverlay.style.pointerEvents = '';
      await new Promise(resolve => requestAnimationFrame(resolve));

      currentMovieId = movieId;
      console.log('✅ currentMovieId défini à:', currentMovieId);

      // Réinitialiser le mode d'affichage et forcer la visibilité
      viewMode.style.display = 'flex';
      viewMode.style.opacity = '1';
      viewMode.style.visibility = 'visible';
      
      // Récupérer les modifications précédentes du film
      const savedEdits = window.movieEdits.get(movieId);
      console.log("Modifications sauvegardées:", savedEdits);
      
      // Récupérer les détails du film
      const result = await window.electronAPI.getMediaDetails(movieId);
      
      if (!result.success) {
        console.error('Erreur lors de la récupération des détails du film:', result.message);
        return;
      }
      
      // Commencer avec les données originales du film
      let movie = result.media;
      currentMoviePath = movie.path;
      
      // Appliquer les modifications enregistrées si elles existent
      if (savedEdits) {
        movie = {
          ...movie,
          ...savedEdits
        };
      }
      
      // Mettre à jour les données actuelles du film
      currentMovieData = movie;
      console.log("Données du film après fusion:", currentMovieData);

      // Configurer l'image de couverture avec génération automatique
      window.setupImageWithFallback(
        modalPoster,
        movie.id,
        movie.posterUrl,
        movie.thumbnail,
        movie.title
      );
      
      // Configurer les informations du film
      modalTitle.textContent = movie.title;

      // Extraire l'année du titre ou utiliser une valeur par défaut
      const yearMatch = movie.title.match(/\((\d{4})\)$/);
      const year = movie.year || (yearMatch ? yearMatch[1] : new Date().getFullYear());
      movieYear.textContent = year;

      // Afficher la catégorie du média
      const mediaCategoryElement = document.getElementById('media-category');
      if (mediaCategoryElement) {
        const categoryMap = {
          'film': 'Film',
          'movie': 'Film',
          'short': 'Court-métrage',
          'documentary': 'Documentaire',
          'other': 'Autre',
          'unsorted': 'Non trié',
          'series': 'Série'
        };
        const categoryDisplay = categoryMap[movie.category] || categoryMap[movie.media_type] || movie.category || movie.media_type || 'Film';
        mediaCategoryElement.textContent = categoryDisplay;
      }
      
      // Configurer la date de sortie
      releaseDate.textContent = movie.releaseDate || '';
      
      // Configurer la durée (utiliser la version formatée si disponible)
      duration.textContent = movie.durationFormatted || window.formatTime(movie.duration);

      // Afficher les nouveaux champs enrichis
      displayMovieCredits(movie);

      // Afficher le système de tags organisé
      displayOrganizedTags(movie);

      // Afficher les nouvelles sections d'informations étendues
      displayTechnicalInfo(movie);
      displayViewingStats(movieId, movie);

      // Configurer le synopsis
      if (movie.description && movie.description.trim()) {
        synopsisContent.className = 'synopsis-content';
        synopsisContent.textContent = movie.description;
        synopsisContent.style.fontStyle = 'normal';
        synopsisContent.style.color = '#e0e0e0';
      } else {
        synopsisContent.className = 'synopsis-content synopsis-empty';
        synopsisContent.textContent = 'Aucun synopsis disponible';
        synopsisContent.style.fontStyle = 'italic';
        synopsisContent.style.color = '#888';
      }
      
      // Configurer l'état "vu/à voir" — source de vérité : DB (lastWatched)
      const isWatched = !!movie.lastWatched;

      if (isWatched) {
        watchToggleModal.textContent = 'vu !';
        watchToggleModal.classList.add('watched');
      } else {
        watchToggleModal.textContent = 'à voir';
        watchToggleModal.classList.remove('watched');
      }
      
      // Configurer les étoiles de notation (DB en priorité, localStorage en fallback)
      const dbRatingMovie = (movie && movie.rating) || 0;
      const localRatingMovie = (loadUserPreferences().ratings && loadUserPreferences().ratings[currentMovieId]) || 0;
      const rating = dbRatingMovie > 0 ? dbRatingMovie : localRatingMovie;
      updateModalStarsDisplay(rating);

      // Initialiser le système progressif
      updateProgressiveStars(rating);

      // Réinitialiser le mode notation
      isRatingActive = false;
      if (progressiveStars) {
        progressiveStars.classList.remove('active');
      }
      
      // Pré-remplir les champs du mode édition
      editTitleInput.value = movie.title;
      
      // Formater la date pour input type="date"
      if (movie.releaseDate) {
        // Convertir la date au format YYYY-MM-DD
        const dateParts = movie.releaseDate.split('/');
        if (dateParts.length === 3) {
          editReleaseDateInput.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
      } else {
        editReleaseDateInput.value = '';
      }
      
      // Réinitialiser et remplir les genres
      selectedGenres = movie.genres || [];
      updateEditGenresDisplay();
      
      // Configurer l'image d'aperçu (pour le mode édition)
      window.setupImageWithFallback(
        imagePreview,
        movie.id,
        movie.posterUrl,
        movie.thumbnail,
        movie.title
      );
      
      // Configurer le synopsis
      editSynopsisInput.value = movie.description || '';

      // Charger l'avis existant s'il y en a un
      if (reviewInput) {
        const userPrefs = loadUserPreferences();
        const existingReview = userPrefs.reviews ? userPrefs.reviews[movieId] : '';
        reviewInput.value = existingReview || '';

        // Mettre à jour l'état du bouton sauvegarder
        if (reviewSaveBtn) {
          reviewSaveBtn.disabled = !existingReview || existingReview.trim().length === 0;
        }
      }

      // Initialiser le système de tags avancé si pas encore fait
      if (!window.tagSystem && document.querySelector('.smart-add-btn')) {
        setupAdvancedTagSystem();
      }

      // Charger les tags existants dans le système de tags avancé
      if (window.tagSystem && typeof window.tagSystem.loadMediaTags === 'function') {
        window.tagSystem.loadMediaTags(movie);
      }

      // Forcer un reflow du navigateur pour s'assurer que tous les styles sont appliqués
      void modalOverlay.offsetHeight;

      // Afficher la modal avec animation
      requestAnimationFrame(() => {
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Empêcher le défilement
        console.log('✅ Modale activée et affichée');
      });

    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la modal:', error);
      // Nettoyer en cas d'erreur
      modalOverlay.classList.remove('active');
      document.body.style.overflow = '';
      throw error; // Propager l'erreur pour le catch externe
    }
  }
  
  // Fonction pour fermer la modal
  async function closeMovieModal() {
    try {
      // Vérifier si on est en mode édition avec des modifications
      if (isEditMode && hasUnsavedChanges) {
        const result = await createAdvancedConfirmationPopup(
          'Modifications en cours',
          'Vous avez des modifications non sauvegardées. Que souhaitez-vous faire ?',
          [
            { text: 'Retour', class: 'popup-secondary', action: 'return' },
            { text: 'Sauvegarder et fermer', class: 'popup-success', action: 'save' },
            { text: 'Fermer sans sauvegarder', class: 'popup-danger', action: 'discard' }
          ]
        );

        switch (result) {
          case 'return':
            return; // Ne pas fermer la modale
          case 'save':
            await saveChanges();
            deactivateEditMode();
            break;
          case 'discard':
            discardChangesAndExit();
            break;
          default:
            return; // Annulation
        }
      } else if (isEditMode) {
        // Mode édition mais pas de modifications, juste revenir au mode lecture
        deactivateEditMode();
      }

      // Fermeture normale de la modale
      modalOverlay.classList.remove('active');

      // Forcer la suppression de pointer-events pour être sûr que l'overlay ne bloque plus
      setTimeout(() => {
        if (!modalOverlay.classList.contains('active')) {
          modalOverlay.style.pointerEvents = 'none';
        }
      }, 50);

      currentMovieId = null;
      currentMoviePath = null;
      currentMovieData = {};
      selectedGenres = [];
      posterImageFile = null;

      // Nettoyer l'éditeur d'avis
      if (reviewInput) {
        reviewInput.value = '';
      }
      if (reviewSaveBtn) {
        reviewSaveBtn.textContent = 'Sauvegarder';
        reviewSaveBtn.disabled = true;
      }
    } finally {
      // TOUJOURS restaurer le scroll, même en cas d'erreur
      document.body.style.overflow = '';

      // Réinitialiser le verrou pour permettre une nouvelle ouverture
      isModalOpening = false;

      console.log('✅ Scroll du body restauré et verrou libéré');
    }
  }
  
  // Événement de fermeture - Listener direct
  if (modalClose) {
    modalClose.addEventListener('click', (e) => {
      console.log('🔴 Bouton fermer cliqué (direct)');
      e.preventDefault();
      e.stopPropagation();
      closeMovieModal();
    });
    console.log('✅ Listener sur #modal-close attaché');
  } else {
    console.error('❌ Élément #modal-close non trouvé');
  }

  // Backup: Délégation d'événements sur la modal pour le bouton fermer
  if (movieModal) {
    movieModal.addEventListener('click', (e) => {
      const target = e.target.closest('.modal-close');
      if (target && target.id === 'modal-close') {
        console.log('🔴 Bouton fermer cliqué (délégation)');
        e.preventDefault();
        e.stopPropagation();
        closeMovieModal();
      }
    });
  }

  // Fermer la modal en cliquant en dehors
  modalOverlay.addEventListener('click', (e) => {
    // Vérifier que le clic est bien sur l'overlay et pas sur ses enfants
    if (e.target === modalOverlay) {
      console.log('🔴 Clic sur overlay - fermeture');
      e.stopPropagation();
      closeMovieModal();
    }
  });

  // Fermer la modal avec la touche Echap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      console.log('🔴 Touche Échap - fermeture');
      closeMovieModal();
    }
  });
  
  
  // Gérer l'interaction avec les étoiles
  modalStars.forEach((star, index) => {
    star.style.setProperty('--star-index', index);
    
    star.addEventListener('mouseover', () => {
      const value = parseInt(star.dataset.value);
      
      modalStars.forEach((s, idx) => {
        if (idx < value) {
          s.classList.add('hover');
        } else {
          s.classList.remove('hover');
        }
      });
    });
    
    star.addEventListener('mouseout', () => {
      modalStars.forEach(s => s.classList.remove('hover'));
    });
    
    // Clic pour noter
    star.addEventListener('click', async () => {
      if (!currentMovieId) return;

      const value = parseInt(star.dataset.value);
      const userPrefs = loadUserPreferences();
      userPrefs.ratings[currentMovieId] = value;
      saveUserPreferences(userPrefs);

      // Sauvegarder aussi dans le fichier JSON
      await saveRatingToDatabase(currentMovieId, value);

      // Automatiquement marquer comme "Vu"
      autoMarkAsWatched();

      // Mettre à jour l'affichage des étoiles
      updateModalStarsDisplay(value);

      // Mettre également à jour les étoiles dans la carte du film
      const card = document.querySelector(`.media-card[data-id="${currentMovieId}"]`);
      if (card) {
        window.updateStarsDisplay(card, value);
      }

      // Déclencher un événement pour mettre à jour la carte sur le dashboard
      window.dispatchEvent(new CustomEvent('ratingUpdated', {
        detail: { movieId: currentMovieId, rating: value }
      }));
    });
  });
  
  // Mettre à jour l'affichage des étoiles dans la modal
  function updateModalStarsDisplay(rating) {
    modalStars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });
  }

  // ============================================
  // NOUVEAU SYSTÈME DE NOTATION PROGRESSIF
  // ============================================

  let currentRating = 0;
  let isRatingActive = false; // Mode slider actif
  let longPressTimer = null;
  const LONG_PRESS_DURATION = 500; // 500ms pour activer le mode slider

  // Fonction pour mettre à jour le remplissage des étoiles
  function updateProgressiveStars(rating) {
    if (!starsFill) return;

    currentRating = Math.max(0, Math.min(5, rating)); // Limiter entre 0 et 5
    const percentage = (currentRating / 5) * 100;
    starsFill.style.width = `${percentage}%`;

    if (ratingInput) {
      ratingInput.value = currentRating.toFixed(1);
    }
  }

  // Fonction pour calculer la note depuis la position de la souris
  function calculateRatingFromPosition(e) {
    const rect = progressiveStars.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const hoverRating = Math.max(0, Math.min(5, (x / width) * 5));
    return Math.round(hoverRating * 10) / 10; // Arrondir au 0.1 près
  }

  // Système de notation : clic ou clic-glissé
  if (starsOverlay && progressiveStars) {
    let isDraggingStars = false;

    starsOverlay.addEventListener('mousedown', (e) => {
      if (!currentMovieId) return;
      isDraggingStars = true;
      progressiveStars.classList.add('active');
      const rating = calculateRatingFromPosition(e);
      updateProgressiveStars(rating);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDraggingStars) return;
      const rating = calculateRatingFromPosition(e);
      updateProgressiveStars(rating);
    });

    document.addEventListener('mouseup', () => {
      if (!isDraggingStars) return;
      isDraggingStars = false;
      progressiveStars.classList.remove('active');
      if (!currentMovieId) return;

      const userPrefs = loadUserPreferences();
      userPrefs.ratings[currentMovieId] = currentRating;
      saveUserPreferences(userPrefs);
      saveRatingToDatabase(currentMovieId, currentRating);
      autoMarkAsWatched();
      window.dispatchEvent(new CustomEvent('ratingUpdated', {
        detail: { movieId: currentMovieId, rating: currentRating }
      }));
      console.log(`⭐ Note enregistrée: ${currentRating}/5`);
    });
  }

  // Gérer le changement de l'input numérique
  if (ratingInput) {
    // Empêcher le mousedown sur l'input de déclencher le système d'étoiles
    ratingInput.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // Flèches pour ajuster finement
    ratingInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        updateProgressiveStars(Math.min(5, currentRating + step));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        updateProgressiveStars(Math.max(0, currentRating - step));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        ratingInput.blur(); // Valide et ferme
      }
    });

    ratingInput.addEventListener('input', (e) => {
      let value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        value = Math.max(0, Math.min(5, value));
        updateProgressiveStars(value);
      }
    });

    ratingInput.addEventListener('blur', () => {
      if (!currentMovieId) return;

      // Validation au blur
      let value = parseFloat(ratingInput.value);
      if (isNaN(value)) value = 0;
      value = Math.max(0, Math.min(5, value));
      updateProgressiveStars(value);

      const userPrefs = loadUserPreferences();
      userPrefs.ratings[currentMovieId] = currentRating;
      saveUserPreferences(userPrefs);

      // Sauvegarder aussi dans le fichier JSON
      saveRatingToDatabase(currentMovieId, currentRating);

      // Automatiquement marquer comme "Vu"
      autoMarkAsWatched();

      // Déclencher un événement pour mettre à jour la carte sur le dashboard
      window.dispatchEvent(new CustomEvent('ratingUpdated', {
        detail: { movieId: currentMovieId, rating: currentRating }
      }));

      console.log(`⭐ Note enregistrée via input: ${currentRating}/5`);
    });
  }
  
  
  // Gérer le bouton "Vu/À voir"
  watchToggleModal.addEventListener('click', () => {
    if (!currentMovieId) return;

    const nowWatched = !watchToggleModal.classList.contains('watched');

    // Mettre à jour la modal
    if (nowWatched) {
      watchToggleModal.textContent = 'vu !';
      watchToggleModal.classList.add('watched');
    } else {
      watchToggleModal.textContent = 'à voir';
      watchToggleModal.classList.remove('watched');
    }

    // Mettre à jour la carte correspondante sur le dashboard
    const card = document.querySelector(`.media-card[data-id="${currentMovieId}"]`);
    if (card) {
      card.querySelectorAll('.btn-watch-toggle').forEach(btn => {
        btn.textContent = nowWatched ? 'vu !' : 'à voir';
        btn.classList.toggle('watched', nowWatched);
      });
    }

    // Persister en DB
    window.electronAPI.updateWatchStatus(currentMovieId, nowWatched);
  });
  
  // Gérer le bouton "Regarder le film"
  watchFilmBtn.addEventListener('click', async () => {
    try {
      if (!currentMovieId) {
        throw new Error('ID du film manquant');
      }

      // IMPORTANT: Sauvegarder l'ID AVANT de fermer la modale (qui le réinitialise)
      const movieIdToPlay = currentMovieId;

      // Fermer la modal
      closeMovieModal();

      // Utiliser la même fonction que les cartes médias (récupère les infos de la DB)
      if (window.playMedia) {
        await window.playMedia(movieIdToPlay);
      } else {
        throw new Error('Fonction playMedia non disponible');
      }
    } catch (error) {
      console.error('Erreur lors de la lecture du film:', error);
      alert('Erreur lors de la lecture de la vidéo: ' + error.message);
    }
  });
  
  // Fonction pour mettre à jour l'affichage des genres en mode édition
  function updateEditGenresDisplay() {
    editGenresContainer.innerHTML = '';
    
    selectedGenres.forEach(genre => {
      const genreChip = document.createElement('div');
      genreChip.className = 'genre-chip';
      genreChip.innerHTML = `
        ${genre}
        <button class="remove-genre" data-genre="${genre}">
          <i class="fas fa-times"></i>
        </button>
      `;
      editGenresContainer.appendChild(genreChip);
    });
    
    // Ajouter des écouteurs pour les boutons de suppression
    document.querySelectorAll('.remove-genre').forEach(btn => {
      btn.addEventListener('click', () => {
        const genreToRemove = btn.dataset.genre;
        selectedGenres = selectedGenres.filter(g => g !== genreToRemove);
        updateEditGenresDisplay();
      });
    });
  }
  
  // Ajouter un genre prédéfini
  addPredefinedGenreBtn.addEventListener('click', () => {
    const selectedGenre = genreDropdown.value;
    if (selectedGenre && !selectedGenres.includes(selectedGenre)) {
      selectedGenres.push(selectedGenre);
      updateEditGenresDisplay();
      genreDropdown.value = ''; // Réinitialiser la sélection
    }
  });
  
  // Ajouter un genre personnalisé
  addCustomGenreBtn.addEventListener('click', () => {
    const customGenre = customGenreInput.value.trim();
    if (customGenre && !selectedGenres.includes(customGenre)) {
      selectedGenres.push(customGenre);
      updateEditGenresDisplay();
      customGenreInput.value = ''; // Effacer le champ
    }
  });
  
  // Changer l'image du film
  uploadImageBtn.addEventListener('click', async () => {
    try {
      // Création d'un input file caché pour la sélection du fichier
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*'; // Accepter uniquement les images
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      
      // Événement quand un fichier est sélectionné
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          
          reader.onload = (e) => {
            const imageUrl = e.target.result;
            
            // Mettre à jour l'aperçu de l'image
            imagePreview.src = imageUrl;
            
            // Stocker l'URL dans la variable globale
            currentMovieData.posterUrl = imageUrl;
            
            console.log("Image changée avec succès:", file.name);
          };
          
          reader.readAsDataURL(file);
        }
        
        // Nettoyer après utilisation
        document.body.removeChild(fileInput);
      });
      
      // Déclencher le dialogue de sélection de fichier
      fileInput.click();
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'image:', error);
      alert('Erreur lors de la sélection de l\'image: ' + error.message);
    }
  });
  
  // ============================================
  // SYSTÈME TMDB UNIFIÉ
  // ============================================

  // Rechercher des films sur TMDB
  async function searchTMDB(query) {
    try {
      const url = `${TMDB_API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false&page=1`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
      });

      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Erreur recherche TMDB:', error);
      throw error;
    }
  }

  // Récupérer les détails complets d'un film TMDB
  async function getTMDBDetails(tmdbId) {
    try {
      const url = `${TMDB_API_BASE_URL}/movie/${tmdbId}?language=fr-FR&append_to_response=credits`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
      });

      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur détails TMDB:', error);
      throw error;
    }
  }

  // Rechercher une personne sur TMDB
  async function searchTMDBPerson(query) {
    try {
      const url = `${TMDB_API_BASE_URL}/search/person?query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false&page=1`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
      });

      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Erreur recherche personne TMDB:', error);
      throw error;
    }
  }

  // Récupérer les détails complets d'une personne TMDB
  async function getTMDBPersonDetails(tmdbPersonId) {
    try {
      const url = `${TMDB_API_BASE_URL}/person/${tmdbPersonId}?language=fr-FR&append_to_response=combined_credits`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
      });

      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur détails personne TMDB:', error);
      throw error;
    }
  }

  // Synchroniser les personnes (crew mappés + tous les acteurs) depuis les crédits TMDB
  async function syncPersonsFromCredits(credits, mediaId, mediaType) {
    if (!credits || !mediaId) return;

    const persons = [];

    // Crew : importer tous les membres dont le job correspond à CREW_ROLES
    for (const member of (credits.crew || [])) {
      const role = mapTMDBJobToRole(member.job);
      if (role) {
        persons.push({
          tmdbId: member.id,
          name: member.name,
          profilePath: member.profile_path,
          knownForDepartment: member.known_for_department || 'Crew',
          role: role,
          character: null
        });
      }
    }

    // Cast : importer TOUS les acteurs
    for (const a of (credits.cast || [])) {
      persons.push({
        tmdbId: a.id,
        name: a.name,
        profilePath: a.profile_path,
        knownForDepartment: 'Acting',
        role: 'actor',
        character: a.character || null
      });
    }

    console.log(`🎬 Sync personnes: ${persons.length} personnes à traiter pour le média ${mediaId}`);

    for (const p of persons) {
      try {
        // Télécharger la photo si disponible
        let fileName = null;
        if (p.profilePath) {
          const photoUrl = `${TMDB_IMAGE_BASE_URL}${p.profilePath}`;
          try {
            const dlResult = await window.electronAPI.downloadPersonPhoto(photoUrl, p.name);
            if (dlResult.success) {
              fileName = dlResult.fileName;
            }
          } catch (photoErr) {
            console.warn(`⚠️ Photo échouée pour ${p.name}:`, photoErr);
          }
        }

        // Créer ou récupérer la personne (dédoublonnage par tmdbId)
        const personResult = await window.electronAPI.addPerson({
          tmdbId: p.tmdbId,
          name: p.name,
          photo: fileName,
          knownForDepartment: p.knownForDepartment
        });

        if (personResult.success && personResult.person) {
          // Lier la personne au média
          await window.electronAPI.linkPersonToMedia(personResult.person.id, mediaId, mediaType, p.role, p.character);
          console.log(`✅ ${p.role}: ${p.name} lié(e) au média ${mediaId}`);
        } else {
          console.warn(`⚠️ Impossible d'ajouter ${p.name}:`, personResult.error);
        }
      } catch (err) {
        console.error(`❌ Erreur sync personne ${p.name}:`, err);
      }
    }

    console.log(`🎬 Sync personnes terminée pour le média ${mediaId}`);
  }

  // Ouvrir la modal de recherche TMDB
  function openTMDBSearch() {
    // Supprimer une ancienne modal si elle existe
    const existingModal = document.getElementById('tmdb-search-modal');
    if (existingModal) existingModal.remove();

    // Récupérer le titre actuel pour la recherche initiale
    const titleInput = document.querySelector('.edit-title-field') || editTitleInput;
    const initialQuery = titleInput ? titleInput.value.trim() : '';

    // Créer la modal
    const modal = document.createElement('div');
    modal.id = 'tmdb-search-modal';
    modal.className = 'tmdb-modal-overlay';
    modal.innerHTML = `
      <div class="tmdb-modal-container">
        <div class="tmdb-modal-header">
          <h2><i class="fas fa-film"></i> Recherche TMDB</h2>
          <button class="tmdb-close-btn" id="tmdb-close-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="tmdb-search-bar">
          <input type="text" id="tmdb-search-field" placeholder="Rechercher un film..." value="${initialQuery}">
          <button id="tmdb-search-action" class="tmdb-search-btn">
            <i class="fas fa-search"></i> Rechercher
          </button>
        </div>

        <div class="tmdb-results-area">
          <div id="tmdb-status" class="tmdb-status">
            <i class="fas fa-info-circle"></i>
            <span>Entrez un titre et cliquez sur Rechercher</span>
          </div>
          <div id="tmdb-results-grid" class="tmdb-results-grid"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Éléments de la modal
    const searchField = document.getElementById('tmdb-search-field');
    const searchBtn = document.getElementById('tmdb-search-action');
    const closeBtn = document.getElementById('tmdb-close-btn');
    const statusDiv = document.getElementById('tmdb-status');
    const resultsGrid = document.getElementById('tmdb-results-grid');

    // Focus sur le champ de recherche
    setTimeout(() => searchField.focus(), 100);

    // Fermer la modal
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Fonction de recherche
    const doSearch = async () => {
      const query = searchField.value.trim();
      if (!query) {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Veuillez entrer un titre</span>';
        statusDiv.style.display = 'flex';
        return;
      }

      // Afficher le chargement
      statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Recherche en cours...</span>';
      statusDiv.style.display = 'flex';
      resultsGrid.innerHTML = '';

      try {
        const results = await searchTMDB(query);

        if (results.length === 0) {
          statusDiv.innerHTML = '<i class="fas fa-search"></i><span>Aucun résultat trouvé</span>';
          return;
        }

        statusDiv.style.display = 'none';
        displayTMDBResults(results, resultsGrid, closeModal);
      } catch (error) {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Erreur de connexion à TMDB</span>';
      }
    };

    // Events
    searchBtn.addEventListener('click', doSearch);
    searchField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    // Recherche automatique si on a un titre
    if (initialQuery) {
      setTimeout(doSearch, 300);
    }
  }

  // Afficher les résultats TMDB
  function displayTMDBResults(results, container, onSelect) {
    container.innerHTML = '';
    console.log('📽️ Affichage de', results.length, 'résultats TMDB');

    const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"%3E%3Crect fill="%23222" width="300" height="450"/%3E%3Ctext x="150" y="225" fill="%23555" text-anchor="middle" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';

    results.slice(0, 20).forEach(movie => {
      const card = document.createElement('div');
      card.className = 'tmdb-result-card';

      const posterUrl = movie.poster_path
        ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
        : fallbackImage;

      const year = movie.release_date ? movie.release_date.substring(0, 4) : '----';
      const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

      // Échapper le titre pour éviter les problèmes XSS et d'attributs
      const safeTitle = (movie.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      card.innerHTML = `
        <div class="tmdb-card-poster">
          <img src="${posterUrl}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer">
          <div class="tmdb-card-rating">
            <i class="fas fa-star"></i> ${rating}
          </div>
        </div>
        <div class="tmdb-card-info">
          <h4>${safeTitle}</h4>
          <span class="tmdb-card-year">${year}</span>
        </div>
      `;

      // Ajouter un gestionnaire d'erreur pour l'image
      const img = card.querySelector('img');
      if (img) {
        img.onerror = function() {
          console.warn('⚠️ Erreur de chargement image TMDB:', posterUrl);
          this.src = fallbackImage;
          this.onerror = null; // Éviter boucle infinie
        };
        img.onload = function() {
          console.log('✅ Image TMDB chargée:', movie.title);
        };
      }

      card.addEventListener('click', () => selectTMDBMovie(movie.id, onSelect));
      container.appendChild(card);
    });
  }

  // Sélectionner un film TMDB et appliquer les données
  async function selectTMDBMovie(tmdbId, closeModal) {
    try {
      // Afficher un indicateur de chargement
      const statusDiv = document.getElementById('tmdb-status');
      if (statusDiv) {
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Chargement des détails...</span>';
        statusDiv.style.display = 'flex';
      }

      // Récupérer les détails complets
      const details = await getTMDBDetails(tmdbId);
      console.log('Détails TMDB récupérés:', details);

      // Extraire les informations
      const title = details.title || '';
      const year = details.release_date ? details.release_date.substring(0, 4) : '';
      const synopsis = details.overview || '';
      const genres = details.genres ? details.genres.map(g => g.name) : [];
      const posterPath = details.poster_path ? `${TMDB_IMAGE_BASE_URL}${details.poster_path}` : null;

      // Extraire réalisateur et acteurs
      let director = '';
      let actors = [];
      if (details.credits) {
        const directorInfo = details.credits.crew?.find(p => p.job === 'Director');
        director = directorInfo ? directorInfo.name : '';
        actors = details.credits.cast?.slice(0, 5).map(a => a.name) || [];
      }

      // Extraire studios et pays de production
      const studios = (details.production_companies || []).map(c => c.name);
      const rawCountry = details.production_countries && details.production_countries[0];
      const country = rawCountry ? resolveCountryLabel(rawCountry.iso_3166_1 || rawCountry.name) : '';

      // Appliquer le titre
      const titleInput = document.querySelector('.edit-title-field') || editTitleInput;
      if (titleInput) titleInput.value = title;

      // Appliquer la date de sortie (input inline prioritaire, sinon champ caché)
      if (details.release_date) {
        const inlineDateInp = document.getElementById('inline-release-date');
        if (inlineDateInp) inlineDateInp.value = details.release_date;
        if (editReleaseDateInput) editReleaseDateInput.value = details.release_date;
      }

      // Appliquer le synopsis
      const synopsisInput = document.querySelector('.edit-synopsis-field') || editSynopsisInput;
      if (synopsisInput) synopsisInput.value = synopsis;

      // Appliquer l'affiche
      let downloadedPosterUrl = null;
      if (posterPath) {
        // Télécharger l'image localement
        try {
          console.log('Téléchargement du poster TMDB...');
          const downloadResult = await window.electronAPI.downloadTMDBImage(posterPath, currentMovieId);

          if (downloadResult.success) {
            const filename = downloadResult.localPath.split(/[\\/]/).pop();
            downloadedPosterUrl = `http://localhost:3001/tmdb-images/${filename}`;

            if (imagePreview) {
              imagePreview.src = downloadedPosterUrl;
            }
            console.log('Poster téléchargé:', downloadedPosterUrl);
          } else {
            // Fallback: utiliser l'URL TMDB directement
            downloadedPosterUrl = posterPath;
            if (imagePreview) imagePreview.src = posterPath;
          }
        } catch (err) {
          console.warn('Erreur téléchargement poster:', err);
          downloadedPosterUrl = posterPath;
          if (imagePreview) imagePreview.src = posterPath;
        }
      }

      // Appliquer les genres
      if (genres.length > 0) {
        selectedGenres = [...genres];
        if (typeof updateEditGenresDisplay === 'function') {
          updateEditGenresDisplay();
        }
      }

      // Mettre à jour currentMovieData
      if (currentMovieData) {
        currentMovieData.title = title;
        currentMovieData.description = synopsis;
        currentMovieData.releaseDate = details.release_date ?
          details.release_date.split('-').reverse().join('/') : '';
        currentMovieData.genres = genres;
        currentMovieData.tmdb_id = tmdbId;
        currentMovieData.director = director;
        currentMovieData.actors = actors;
        if (studios.length > 0) currentMovieData.studios = studios;
        if (country) currentMovieData.country = country;
        if (downloadedPosterUrl) {
          currentMovieData.posterUrl = downloadedPosterUrl;
        }
      }

      // Appliquer studios et pays dans les champs inline si présents
      const studiosInputEl = document.getElementById('studios-name');
      if (studiosInputEl && studiosInputEl.tagName === 'INPUT' && studios.length > 0) {
        studiosInputEl.value = studios.join(', ');
      }
      const countryEl = document.getElementById('country-name');
      if (countryEl && countryEl.tagName === 'SELECT' && country) {
        const opt = Array.from(countryEl.options).find(o => o.value === country);
        if (opt) countryEl.value = country;
        else {
          // Pays inconnu → ajouter une option temporaire
          const tmpOpt = document.createElement('option');
          tmpOpt.value = country; tmpOpt.textContent = country;
          countryEl.insertBefore(tmpOpt, countryEl.options[1]);
          countryEl.value = country;
        }
      }

      // Marquer comme modifié et afficher les boutons de sauvegarde
      hasUnsavedChanges = true;
      if (typeof updateSaveButtonState === 'function') updateSaveButtonState();
      if (typeof showExtensionButtons === 'function') showExtensionButtons();

      console.log('Données TMDB appliquées avec succès');

      // Sync personnes en arrière-plan (fire-and-forget)
      if (details.credits && currentMovieId) {
        syncPersonsFromCredits(details.credits, currentMovieId, currentMovieData.media_type || 'film')
          .then(() => console.log('✅ Sync personnes terminée en arrière-plan'))
          .catch(err => console.error('❌ Erreur sync personnes en arrière-plan:', err));
      }

      // Fermer la modal TMDB
      if (closeModal) closeModal();

    } catch (error) {
      console.error('Erreur lors de la sélection TMDB:', error);
      alert('Erreur lors du chargement des données TMDB');
    }
  }
  
  // Bouton de recherche TMDB
  tmdbSearchBtn.addEventListener('click', () => openTMDBSearch());

  // Fonction pour mettre à jour immédiatement la carte dans la bibliothèque
  function updateMediaCardInLibrary(movieId, updates) {
    try {
      const movieCard = document.querySelector(`.media-card[data-id="${movieId}"]`);
      if (!movieCard) {
        console.log('Carte de film non trouvée dans la bibliothèque pour ID:', movieId);
        return;
      }

      // Mettre à jour le titre
      if (updates.title) {
        const titleElement = movieCard.querySelector('.media-title');
        if (titleElement) {
          titleElement.textContent = updates.title;
          console.log('Titre mis à jour:', updates.title);
        }
        // Mettre à jour aussi le data-title pour la recherche/filtrage
        movieCard.dataset.title = updates.title.toLowerCase();
      }

      // Mettre à jour l'image - chercher dans plusieurs emplacements possibles
      if (updates.posterUrl) {
        // Chercher l'image dans différentes structures possibles
        // L'image a la classe 'media-thumbnail' directement sur l'élément img
        let imageElement = movieCard.querySelector('img.media-thumbnail');
        if (!imageElement) {
          imageElement = movieCard.querySelector('.media-thumbnail-container img');
        }
        if (!imageElement) {
          imageElement = movieCard.querySelector('img');
        }

        if (imageElement) {
          imageElement.src = updates.posterUrl;
          imageElement.alt = updates.title || imageElement.alt;
          console.log('Image mise à jour:', updates.posterUrl);
        } else {
          console.warn('Élément image non trouvé dans la carte');
        }
      }

      console.log(`✅ Carte mise à jour en temps réel pour le film ${movieId}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la carte:', error);
    }
  }
  
  // Sauvegarder les modifications
  saveChangesBtn.addEventListener('click', async () => {
    try {
      if (!currentMovieId) return;
      
      const title = editTitleInput.value.trim();
      if (!title) {
        alert('Le titre du film est obligatoire');
        editTitleInput.focus();
        return;
      }
      
      // Convertir la date au format JJ/MM/AAAA (input inline prioritaire)
      const inlineDateInput2 = document.getElementById('inline-release-date');
      const dateSource2 = (inlineDateInput2 && inlineDateInput2.value) ? inlineDateInput2 : editReleaseDateInput;
      let formattedDate = '';
      if (dateSource2 && dateSource2.value) {
        const dateParts = dateSource2.value.split('-');
        if (dateParts.length === 3) {
          formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }

      // Capture l'URL de l'image actuelle
      let finalImageUrl = imagePreview.src;
      
      // Télécharger l'image TMDB uniquement si c'est une URL TMDB
      if (finalImageUrl && finalImageUrl.includes('image.tmdb.org')) {
        try {
          console.log('🔄 Téléchargement de l\'image TMDB lors de la sauvegarde...');
          const downloadResult = await window.electronAPI.downloadTMDBImage(finalImageUrl, currentMovieId);

          if (downloadResult.success) {
            const filename = downloadResult.localPath.split(/[\\/]/).pop();
            finalImageUrl = `http://localhost:3001/tmdb-images/${filename}`;
            console.log(`✅ Image TMDB sauvegardée localement: ${downloadResult.filename}`);
          } else {
            console.warn(`⚠️ Échec du téléchargement de l'image TMDB: ${downloadResult.message}`);
            // Garder l'URL originale en cas d'échec
          }
        } catch (error) {
          console.error('❌ Erreur lors du téléchargement de l\'image TMDB:', error);
          // Garder l'URL originale en cas d'erreur
        }
      }
      
      // Extraire l'année pour l'enregistrer séparément
      let year = null;
      if (dateSource2 && dateSource2.value) {
        year = new Date(dateSource2.value).getFullYear();
      }
      
      // Récupérer les tags du système de tags avancé
      let advancedTags = {};
      if (window.tagSystem && typeof window.tagSystem.getMediaTags === 'function') {
        advancedTags = window.tagSystem.getMediaTags();
      }

      // Préparer les données à enregistrer
      const movieUpdates = {
        title: title,
        releaseDate: formattedDate,
        genres: selectedGenres,
        description: editSynopsisInput.value.trim(),
        posterUrl: finalImageUrl, // Utiliser l'image locale ou l'URL originale
        year: year,
        tags: advancedTags // Ajouter les tags avancés
      };
      
      // Enregistrer les modifications localement
      window.movieEdits.save(currentMovieId, movieUpdates);
      
      console.log("Données sauvegardées:", movieUpdates);
      
      // Mettre à jour l'affichage en mode visualisation
      modalTitle.textContent = title;
      
      // Mettre à jour l'année affichée
      movieYear.textContent = `(${year || new Date().getFullYear()})`;
      
      // Mise à jour de la date
      releaseDate.textContent = formattedDate;
      
      // Mise à jour des genres
      genresContainer.innerHTML = '';
      selectedGenres.forEach(genre => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag';
        genreTag.textContent = genre;
        genresContainer.appendChild(genreTag);
      });
      
      // Mise à jour du synopsis
      const synopsisText = editSynopsisInput.value.trim();
      synopsisContent.textContent = synopsisText;

      // Appliquer le style italic si vide
      if (!synopsisText || synopsisText === 'Aucun synopsis disponible') {
        synopsisContent.className = 'synopsis-content synopsis-empty';
        synopsisContent.style.fontStyle = 'italic';
        synopsisContent.style.color = '#888';
      } else {
        synopsisContent.className = 'synopsis-content';
        synopsisContent.style.fontStyle = 'normal';
        synopsisContent.style.color = '#e0e0e0';
      }
      
      // Mise à jour de l'image
      modalPoster.src = finalImageUrl;
      
      // Enregistrer les modifications via l'API Electron
      if (window.electronAPI && window.electronAPI.updateMedia) {
        try {
          const result = await window.electronAPI.updateMedia(currentMovieId, movieUpdates);
          if (result.success) {
            console.log("✅ Modifications enregistrées dans la base de données:", result);
          } else {
            console.error("❌ Échec de l'enregistrement:", result.message);
          }
        } catch (apiError) {
          console.error("❌ Erreur avec l'API Electron:", apiError);
        }
      } else {
        console.error("❌ API updateMedia non disponible");
      }
      
      // Mettre à jour immédiatement la carte dans la bibliothèque
      updateMediaCardInLibrary(currentMovieId, movieUpdates);
      
      alert('Modifications enregistrées avec succès');
      
      // ANCIEN CODE SUPPRIMÉ - Plus besoin avec le nouveau système
      
      // Rafraîchir le dashboard pour refléter les modifications
      if (typeof window.refreshDashboard === 'function') {
        window.refreshDashboard();
      } else {
        // Si la fonction n'est pas disponible, recharger tous les films
        const dashboardLoadMovies = window.loadMoviesFromDashboard;
        if (typeof dashboardLoadMovies === 'function') {
          dashboardLoadMovies();
        }
      }
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des modifications:', error);
      alert('Les modifications ont bien été enregistrées.');
    }
  });
  
  // Gestion de l'éditeur d'avis
  if (reviewInput) {
    // Marquer automatiquement comme "Vu" dès que l'utilisateur commence à écrire
    reviewInput.addEventListener('input', () => {
      if (reviewInput.value.trim().length > 0) {
        autoMarkAsWatched();
      }
    });

    // Gestion de l'état du bouton sauvegarder
    reviewInput.addEventListener('input', () => {
      if (reviewSaveBtn) {
        reviewSaveBtn.disabled = reviewInput.value.trim().length === 0;
      }
    });
  }

  // Gestion du bouton sauvegarder l'avis
  if (reviewSaveBtn) {
    reviewSaveBtn.addEventListener('click', () => {
      if (!currentMovieId || !reviewInput) return;

      const reviewText = reviewInput.value.trim();
      if (reviewText.length === 0) return;

      // Sauvegarder l'avis dans localStorage
      const userPrefs = loadUserPreferences();
      if (!userPrefs.reviews) userPrefs.reviews = {};
      userPrefs.reviews[currentMovieId] = reviewText;
      saveUserPreferences(userPrefs);

      // Marquer automatiquement comme "Vu" si ce n'est pas déjà fait
      autoMarkAsWatched();

      // Feedback visuel
      reviewSaveBtn.textContent = 'Sauvegardé !';
      reviewSaveBtn.disabled = true;

      setTimeout(() => {
        reviewSaveBtn.textContent = 'Sauvegarder';
        reviewSaveBtn.disabled = false;
      }, 2000);

      console.log('Avis sauvegardé pour le film:', currentMovieId);
    });
  }

  // Initialisation des écouteurs d'événements pour ouvrir la modal depuis les cartes
  function setupModalTriggers() {
    // Cette fonction sera appelée depuis dashboard.js
    const mediaCards = document.querySelectorAll('.media-card');
    
    mediaCards.forEach(card => {
      // Modifier l'écouteur d'événements existant
      card.addEventListener('click', async (e) => {
        // Éviter de déclencher si on clique sur un bouton ou les étoiles
        if (e.target.closest('.btn-watch-toggle') || e.target.closest('.star')) {
          return;
        }
        
        const movieId = card.dataset.id;
        if (movieId) {
          console.log('🎯 Clic sur la carte, ID:', movieId);
          window.openMovieModal(movieId);
        }
      });
    });
    
    // Ajouter l'event listener pour le bouton play dans la modal
    const playMediaBtn = document.getElementById('play-movie-btn');
    if (playMediaBtn) {
      playMediaBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (currentMovieData && currentMovieData.id) {
          try {
            const effectivePath = (currentMovieData.audioStatus === 'ok' && currentMovieData.audioConvertedPath)
              ? currentMovieData.audioConvertedPath : currentMovieData.path;
            await window.openVideoPlayer(currentMovieData.id, currentMovieData.title, effectivePath, null, currentMovieData.audioStatus === 'ok', currentMovieData.path);
          } catch (error) {
            console.error('Erreur lors du lancement du lecteur vidéo:', error);
            alert('Erreur lors du lancement de la vidéo: ' + error.message);
          }
        }
      });
    }
  }
  
  // Gestion des boutons extensibles pour le mode édition
  // Variables déjà déclarées au début du fichier

  // Fonction pour afficher les boutons d'extension
  function showExtensionButtons() {
    editCancelBtn.style.display = 'flex';
    editSaveBtn.style.display = 'flex';
    editButtonGroup.classList.add('extended');

    setTimeout(() => {
      editCancelBtn.classList.add('show');
      editSaveBtn.classList.add('show');
    }, 100);
  }

  // Fonction pour masquer les boutons d'extension
  function hideExtensionButtons() {
    editCancelBtn.classList.remove('show');
    editSaveBtn.classList.remove('show');

    setTimeout(() => {
      editCancelBtn.style.display = 'none';
      editSaveBtn.style.display = 'none';
      editButtonGroup.classList.remove('extended');
    }, 400);
  }

  // Fonction pour activer le mode édition
  function activateEditMode() {
    isEditMode = true;
    hasUnsavedChanges = false;

    // Changer l'icône du bouton principal
    const editIcon = editButton.querySelector('i');
    if (editIcon) {
      editIcon.className = 'fas fa-edit';
    }

    // S'assurer que les boutons d'extension sont cachés au départ
    hideExtensionButtons();

    // Passer en mode édition visuel
    if (modalOverlay) {
      modalOverlay.classList.add('edit-mode-active');
      console.log('🎨 Mode édition activé - couleurs changées');
    } else {
      console.error('❌ modalOverlay non trouvé pour activer edit-mode-active');
    }

    // NOUVEAU: Transformer le bouton "Regarder le film" en "Rechercher sur TMDB"
    transformWatchButtonToTMDB();

    // NOUVEAU: Transformer les éléments de lecture en champs modifiables
    transformToEditableFields();

    // NOUVEAU: Transformer les tags existants pour ajouter les croix de suppression
    transformTagsToEditable();

    // NOUVEAU: Ajouter les event listeners pour la suppression des tags
    setupTagRemovalListeners();

    // NOUVEAU: Configurer la détection des changements sur les nouveaux champs
    setupChangeDetection();

    // NOUVEAU: Verrouiller les éléments interactifs du mode normal
    lockNormalModeElements();

    // NOUVEAU: Recharger les tags pour afficher les boutons +
    if (currentMovieData) {
      console.log('🏷️ Rechargement des tags en mode édition:', {
        genres: currentMovieData.genres,
        mood: currentMovieData.mood,
        technical: currentMovieData.technical,
        personalTags: currentMovieData.personalTags
      });
      displayOrganizedTags(currentMovieData);
    }

    // NOUVEAU: Configurer les boutons + pour ajouter des tags
    setupAddTagButtons();

    // Ajouter l'overlay d'édition sur le poster
    setupPosterEditOverlay();
  }

  // Fonction pour désactiver le mode édition
  function deactivateEditMode() {
    isEditMode = false;
    hasUnsavedChanges = false;

    // Remettre l'icône originale
    const editIcon = editButton.querySelector('i');
    if (editIcon) {
      editIcon.className = 'fas fa-pencil-alt';
    }

    // Masquer les boutons d'extension
    hideExtensionButtons();

    // Revenir en mode visualisation
    if (modalOverlay) {
      modalOverlay.classList.remove('edit-mode-active');
      console.log('🎨 Mode normal restauré - couleurs originales');
    }

    // NOUVEAU: Restaurer le bouton "Regarder le film"
    restoreTMDBButtonToWatch();

    // NOUVEAU: Restaurer les éléments de lecture originaux
    restoreReadOnlyFields();

    // NOUVEAU: Restaurer les tags en mode lecture seule
    restoreTagsToReadOnly();

    // NOUVEAU: Supprimer les event listeners de suppression des tags
    cleanupTagRemovalListeners();

    // NOUVEAU: Déverrouiller les éléments interactifs du mode normal
    unlockNormalModeElements();

    // CORRECTIF: Recharger complètement les tags pour s'assurer qu'ils sont en mode lecture
    if (currentMovieData) {
      console.log('🔄 Rechargement complet des tags en mode lecture');
      displayOrganizedTags(currentMovieData);
    }

    // NOUVEAU: Sauvegarder les tags automatiquement
    saveTagsToDatabase();

    // Retirer l'overlay d'édition du poster
    removePosterEditOverlay();
  }

  // Fonction pour sauvegarder les tags dans la base de données
  async function saveTagsToDatabase() {
    if (!currentMovieId || !window.electronAPI || !window.electronAPI.updateMedia) {
      console.log('⚠️ Impossible de sauvegarder les tags - API non disponible');
      return;
    }

    try {
      const tagUpdates = {
        genres: currentMovieData.genres || [],
        mood: currentMovieData.mood || [],
        technical: currentMovieData.technical || [],
        personalTags: currentMovieData.personalTags || [],
        franchises: currentMovieData.franchises || [],
        country: currentMovieData.country || '',
        studios: currentMovieData.studios || []
      };

      console.log('💾 Sauvegarde automatique des tags:', tagUpdates);

      const result = await window.electronAPI.updateMedia(currentMovieId, tagUpdates);
      if (result.success) {
        console.log('✅ Tags sauvegardés avec succès');
      } else {
        console.error('❌ Erreur lors de la sauvegarde des tags:', result.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des tags:', error);
    }
  }

  // Fonction pour gérer le changement de poster via fichier local
  async function handlePosterFileChange(file) {
    if (!file || !file.type.startsWith('image/')) {
      console.warn('⚠️ Fichier non valide, seules les images sont acceptées');
      return;
    }

    try {
      // Si c'est un fichier local avec un path (Electron), copier vers tmdb-images
      if (file.path && window.electronAPI && window.electronAPI.savePosterLocal) {
        const result = await window.electronAPI.savePosterLocal(file.path, currentMovieId);
        if (result.success) {
          const newUrl = `http://localhost:3001/tmdb-images/${result.filename}`;
          const posterImg = document.getElementById('modal-poster');
          if (posterImg) posterImg.src = newUrl;
          if (currentMovieData) currentMovieData.posterUrl = newUrl;
          hasUnsavedChanges = true;
          updateSaveButtonState();
          showExtensionButtons();
          console.log('✅ Poster mis à jour:', result.filename);
          return;
        }
      }

      // Fallback: lire comme Data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const posterImg = document.getElementById('modal-poster');
        if (posterImg) posterImg.src = e.target.result;
        if (currentMovieData) currentMovieData.posterUrl = e.target.result;
        hasUnsavedChanges = true;
        updateSaveButtonState();
        showExtensionButtons();
        console.log('✅ Poster mis à jour (DataURL)');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('❌ Erreur changement poster:', error);
    }
  }

  // Ajouter l'overlay et les handlers d'édition sur le poster
  function setupPosterEditOverlay() {
    const poster = document.querySelector('.modal-poster');
    if (!poster) return;

    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.className = 'poster-edit-overlay';
    overlay.innerHTML = `
      <i class="fas fa-camera"></i>
      <span>Cliquer ou glisser<br>une image</span>
    `;
    poster.appendChild(overlay);

    // Click → ouvrir sélecteur de fichier
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) handlePosterFileChange(file);
        document.body.removeChild(fileInput);
      });
      fileInput.click();
    });

    // Drag & Drop
    poster.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      poster.classList.add('drag-over');
    });

    poster.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      poster.classList.remove('drag-over');
    });

    poster.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      poster.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handlePosterFileChange(file);
    });
  }

  // Retirer l'overlay d'édition du poster
  function removePosterEditOverlay() {
    const overlay = document.querySelector('.poster-edit-overlay');
    if (overlay) overlay.remove();

    const poster = document.querySelector('.modal-poster');
    if (poster) poster.classList.remove('drag-over');
  }

  // NOUVELLES FONCTIONS pour transformer les éléments en champs modifiables
  function transformToEditableFields() {
    // Variables pour stocker les valeurs originales
    if (!window.originalFieldValues) {
      window.originalFieldValues = {};
    }

    // 1. Transformer le titre (h2 -> input text)
    const titleElement = document.getElementById('modal-title');
    if (titleElement) {
      window.originalFieldValues.title = titleElement.textContent;
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.value = titleElement.textContent;
      titleInput.className = 'edit-title-field';
      // Les styles visuels sont gérés par la classe CSS .edit-title-field
      titleInput.style.cssText = `
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        outline: none;
      `;
      titleElement.parentNode.replaceChild(titleInput, titleElement);
      titleInput.id = 'modal-title';
    }

    // 2. Transformer l'année (span -> input number)
    const yearElement = document.getElementById('movie-year');
    if (yearElement) {
      window.originalFieldValues.year = yearElement.textContent;
      const yearInput = document.createElement('input');
      yearInput.type = 'number';
      yearInput.value = yearElement.textContent.replace(/[()]/g, '');
      yearInput.className = 'edit-year-field';
      // Les styles visuels sont gérés par la classe CSS .edit-year-field
      yearInput.style.cssText = `
        width: 80px;
        max-width: 80px;
        min-width: 0;
        box-sizing: border-box;
        flex-shrink: 0;
        outline: none;
      `;
      yearElement.parentNode.replaceChild(yearInput, yearElement);
      yearInput.id = 'movie-year';
    }

    // 3. Transformer le synopsis (div -> textarea)
    const synopsisElement = document.getElementById('synopsis-content');
    if (synopsisElement) {
      window.originalFieldValues.synopsis = synopsisElement.textContent;
      const synopsisTextarea = document.createElement('textarea');
      synopsisTextarea.value = synopsisElement.textContent;
      synopsisTextarea.className = 'edit-synopsis-field';
      // Les styles visuels sont gérés par la classe CSS .edit-synopsis-field
      synopsisTextarea.style.cssText = `
        width: 100%;
        max-width: 100%;
        min-width: 0;
        min-height: 100px;
        resize: vertical;
        box-sizing: border-box;
        outline: none;
      `;
      synopsisElement.parentNode.replaceChild(synopsisTextarea, synopsisElement);
      synopsisTextarea.id = 'synopsis-content';
    }

    // 4. Transformer les crédits personnes en mode édition (avatars + boutons)
    transformCreditsToEditMode();

    // 5. Date de sortie → input inline dans la pill release-date
    if (releaseDate && !releaseDate.querySelector('input')) {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'edit-credit-field';
      dateInput.id = 'inline-release-date';
      const dateParts = (currentMovieData.releaseDate || '').split('/');
      if (dateParts.length === 3) dateInput.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      releaseDate.textContent = '';
      releaseDate.appendChild(dateInput);
    }

    // 6. Plateforme et studios → inputs inline
    const _makeInlinePillInput = (sectionId, spanId, value, placeholder, displayMode) => {
      const section = document.getElementById(sectionId);
      const span = document.getElementById(spanId);
      if (!section || !span || span.tagName === 'INPUT') return;
      section.style.display = displayMode || 'block';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-credit-field';
      input.id = spanId;
      input.value = value || '';
      input.placeholder = placeholder;
      span.replaceWith(input);
    };
    _makeInlinePillInput('platform-section', 'platform-name', currentMovieData.platform, 'Plateforme', 'block');
    _makeInlinePillInput('studios-pill', 'studios-name', (currentMovieData.studios || []).join(', '), 'Studios (virgule)', 'flex');

    // 7. Pays → select avec drapeaux
    const countryPillSection = document.getElementById('country-pill');
    const countryPillSpan = document.getElementById('country-name');
    if (countryPillSection && countryPillSpan && countryPillSpan.tagName !== 'SELECT') {
      countryPillSection.style.display = 'flex';
      const sel = createCountrySelect(currentMovieData.country, 'country-name', 'edit-credit-field edit-credit-select');
      countryPillSpan.replaceWith(sel);
    }

    console.log('🔧 Éléments transformés en champs modifiables');
  }

  function restoreReadOnlyFields() {
    if (!window.originalFieldValues) return;

    // 1. Restaurer le titre
    const titleInput = document.getElementById('modal-title');
    if (titleInput && titleInput.tagName === 'INPUT') {
      const titleH2 = document.createElement('h2');
      titleH2.className = 'modal-title';
      titleH2.textContent = titleInput.value || window.originalFieldValues.title;
      titleInput.parentNode.replaceChild(titleH2, titleInput);
      titleH2.id = 'modal-title';
    }

    // 2. Restaurer l'année
    const yearInput = document.getElementById('movie-year');
    if (yearInput && yearInput.tagName === 'INPUT') {
      const yearSpan = document.createElement('span');
      yearSpan.className = 'movie-year';
      yearSpan.textContent = `(${yearInput.value || window.originalFieldValues.year.replace(/[()]/g, '')})`;
      yearInput.parentNode.replaceChild(yearSpan, yearInput);
      yearSpan.id = 'movie-year';
    }

    // 3. Restaurer le synopsis
    const synopsisTextarea = document.getElementById('synopsis-content');
    if (synopsisTextarea && synopsisTextarea.tagName === 'TEXTAREA') {
      const synopsisDiv = document.createElement('div');
      const synopsisText = synopsisTextarea.value || window.originalFieldValues.synopsis || '';
      const synopsisTextTrimmed = synopsisText.trim();

      // Si vide ou "Aucun synopsis disponible", afficher avec style italic
      if (!synopsisTextTrimmed || synopsisTextTrimmed === 'Aucun synopsis disponible') {
        synopsisDiv.className = 'synopsis-content synopsis-empty';
        synopsisDiv.textContent = 'Aucun synopsis disponible';
        synopsisDiv.style.fontStyle = 'italic';
        synopsisDiv.style.color = '#888';
      } else {
        synopsisDiv.className = 'synopsis-content';
        synopsisDiv.textContent = synopsisText;
        synopsisDiv.style.fontStyle = 'normal';
        synopsisDiv.style.color = '#e0e0e0';
      }

      synopsisTextarea.parentNode.replaceChild(synopsisDiv, synopsisTextarea);
      synopsisDiv.id = 'synopsis-content';
    }

    // 4. Restaurer les crédits personnes en mode lecture
    if (currentMovieData) {
      displayMovieCredits(currentMovieData);
    }

    // 5. Restaurer les pills date, plateforme, pays, studios
    if (currentMovieData) {
      displayMoviePlatformCountryStudios(currentMovieData);
    }

    console.log('🔄 Éléments restaurés en mode lecture');
  }

  // NOUVELLE FONCTION pour transformer les tags en mode éditable
  function transformTagsToEditable() {
    // Transformer tous les tags existants pour ajouter des croix de suppression
    const tagCategories = ['genres', 'mood', 'technical', 'personal'];

    tagCategories.forEach(category => {
      const container = document.getElementById(`${category}-container`);
      if (!container) return;

      const tagChips = container.querySelectorAll('.tag-chip');
      tagChips.forEach(chip => {
        // Récupérer le texte du tag
        const tagText = chip.textContent;

        // Déterminer la catégorie pour data-category
        let dataCategory = category;
        if (category === 'genres') dataCategory = 'genre';

        // Transformer le contenu du chip
        chip.innerHTML = `
          <span class="tag-text">${tagText}</span>
          <button class="tag-remove-btn" data-tag="${tagText}" data-category="${dataCategory}" title="Supprimer ce tag">
            <i class="fas fa-times"></i>
          </button>
        `;
        chip.classList.add('editable');
      });
    });

    console.log('🏷️ Tags transformés en mode éditable avec croix de suppression');
  }

  function restoreTagsToReadOnly() {
    // Restaurer tous les tags en mode lecture seule
    const tagCategories = ['genres', 'mood', 'technical', 'personal'];

    tagCategories.forEach(category => {
      const container = document.getElementById(`${category}-container`);
      if (!container) return;

      // CORRECTIF: Sélectionner TOUS les tag-chips, pas seulement ceux avec .editable
      const tagChips = container.querySelectorAll('.tag-chip');
      tagChips.forEach(chip => {
        // Récupérer le texte du tag depuis le span
        const tagTextSpan = chip.querySelector('.tag-text');
        if (tagTextSpan) {
          const tagText = tagTextSpan.textContent;
          // Restaurer le contenu simple
          chip.textContent = tagText;
          chip.classList.remove('editable');
        } else {
          // Si pas de span (tag déjà en lecture seule), s'assurer que la classe editable est retirée
          chip.classList.remove('editable');
        }
      });
    });

    console.log('🏷️ Tags restaurés en mode lecture seule');
  }

  // NOUVELLES FONCTIONS pour gérer la suppression des tags
  function setupTagRemovalListeners() {
    // Ajouter des event listeners pour les boutons de suppression des tags
    document.addEventListener('click', handleTagRemoval);
  }

  function cleanupTagRemovalListeners() {
    // Supprimer les event listeners pour les boutons de suppression des tags
    document.removeEventListener('click', handleTagRemoval);
  }

  function handleTagRemoval(event) {
    // Vérifier si le clic est sur un bouton de suppression de tag
    if (event.target.classList.contains('tag-remove-btn') ||
        event.target.closest('.tag-remove-btn')) {

      event.preventDefault();
      event.stopPropagation();

      const button = event.target.closest('.tag-remove-btn');
      const tagText = button.getAttribute('data-tag');
      const category = button.getAttribute('data-category');
      const tagChip = button.closest('.tag-chip');

      if (tagText && category && tagChip) {
        removeTagFromMovie(tagText, category, tagChip);
      }
    }
  }

  function removeTagFromMovie(tagText, category, tagChip) {
    // Animation de suppression
    tagChip.classList.add('removing');

    setTimeout(() => {
      // Supprimer le tag des données du film
      if (currentMovieData) {
        let tagsArray;

        switch(category) {
          case 'genre':
            tagsArray = currentMovieData.genre_ids || [];
            currentMovieData.genre_ids = tagsArray.filter(tag => tag !== tagText);
            break;
          case 'mood':
            tagsArray = currentMovieData.mood || [];
            currentMovieData.mood = tagsArray.filter(tag => tag !== tagText);
            break;
          case 'technical':
            tagsArray = currentMovieData.technical || [];
            currentMovieData.technical = tagsArray.filter(tag => tag !== tagText);
            break;
          case 'personal':
            tagsArray = currentMovieData.personalTags || [];
            currentMovieData.personalTags = tagsArray.filter(tag => tag !== tagText);
            break;
        }

        // Marquer comme modifié
        hasUnsavedChanges = true;

        // Afficher les boutons d'extension lors du premier changement
        showExtensionButtons();

        // Rafraîchir l'affichage de cette catégorie de tags
        refreshTagCategory(category);

        console.log(`🗑️ Tag "${tagText}" supprimé de la catégorie "${category}"`);
      }
    }, 150); // Délai pour l'animation
  }

  function refreshTagCategory(category) {
    if (!currentMovieData) return;

    let tags;
    switch(category) {
      case 'genre':
        tags = currentMovieData.genre_ids || [];
        displayTagCategory('genres', tags, 'genre');
        break;
      case 'mood':
        tags = currentMovieData.mood || [];
        displayTagCategory('mood', tags, 'mood');
        break;
      case 'technical':
        tags = currentMovieData.technical || [];
        displayTagCategory('technical', tags, 'technical');
        break;
      case 'personal':
        tags = currentMovieData.personalTags || [];
        displayTagCategory('personal', tags, 'personal');
        break;
    }
  }

  // NOUVELLES FONCTIONS pour gérer le verrouillage des éléments
  function lockNormalModeElements() {
    // Verrouiller les étoiles de notation
    const modalStars = document.querySelectorAll('.modal-star');
    modalStars.forEach(star => {
      star.classList.add('locked');
      star.style.pointerEvents = 'none';
      star.style.opacity = '0.5';
    });

    // Verrouiller le bouton vu/à voir
    const watchToggle = document.getElementById('btn-watch-toggle-modal');
    if (watchToggle) {
      watchToggle.classList.add('locked');
      watchToggle.style.pointerEvents = 'none';
      watchToggle.style.opacity = '0.5';
    }

    // Verrouiller la section d'avis
    const reviewInput = document.getElementById('review-input');
    const reviewSaveBtn = document.getElementById('review-save-btn');
    if (reviewInput) {
      reviewInput.disabled = true;
      reviewInput.style.opacity = '0.5';
    }
    if (reviewSaveBtn) {
      reviewSaveBtn.disabled = true;
      reviewSaveBtn.style.opacity = '0.5';
    }

    // Ajouter un overlay explicatif
    addLockOverlay();
  }

  function unlockNormalModeElements() {
    // Déverrouiller les étoiles de notation
    const modalStars = document.querySelectorAll('.modal-star');
    modalStars.forEach(star => {
      star.classList.remove('locked');
      star.style.pointerEvents = '';
      star.style.opacity = '';
    });

    // Déverrouiller le bouton vu/à voir
    const watchToggle = document.getElementById('btn-watch-toggle-modal');
    if (watchToggle) {
      watchToggle.classList.remove('locked');
      watchToggle.style.pointerEvents = '';
      watchToggle.style.opacity = '';
    }

    // Déverrouiller la section d'avis
    const reviewInput = document.getElementById('review-input');
    const reviewSaveBtn = document.getElementById('review-save-btn');
    if (reviewInput) {
      reviewInput.disabled = false;
      reviewInput.style.opacity = '';
    }
    if (reviewSaveBtn) {
      reviewSaveBtn.disabled = false;
      reviewSaveBtn.style.opacity = '';
    }

    // Retirer l'overlay
    removeLockOverlay();
  }

  function addLockOverlay() {
    // Créer un overlay subtil sur les éléments verrouillés
    const sidebar = document.querySelector('.modal-sidebar .evaluation-section');
    if (sidebar && !sidebar.querySelector('.lock-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'lock-overlay';
      overlay.innerHTML = `
        <div class="lock-message">
          <i class="fas fa-lock"></i>
          <span>Disponible en mode normal</span>
        </div>
      `;
      sidebar.appendChild(overlay);
    }
  }

  function removeLockOverlay() {
    const overlay = document.querySelector('.lock-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // Transformer le bouton "Regarder" en "Rechercher sur TMDB" en mode édition
  function transformWatchButtonToTMDB() {
    const watchBtn = document.getElementById('btn-watch-film');
    if (!watchBtn) return;

    if (!watchBtn.dataset.originalHtml) {
      watchBtn.dataset.originalHtml = watchBtn.innerHTML;
    }

    watchBtn.innerHTML = '<img src="../assets/pictos/search.svg" class="rk-icon" style="filter:brightness(0)invert(1);width:20px;height:20px;"><span>Rechercher sur TMDB</span>';

    const newBtn = watchBtn.cloneNode(true);
    watchBtn.parentNode.replaceChild(newBtn, watchBtn);
    newBtn.addEventListener('click', () => openTMDBSearch());
  }

  // Restaurer le bouton "Regarder le film"
  function restoreTMDBButtonToWatch() {
    const watchBtn = document.getElementById('btn-watch-film');
    if (!watchBtn || !watchBtn.dataset.originalHtml) return;

    watchBtn.innerHTML = watchBtn.dataset.originalHtml;
    delete watchBtn.dataset.originalHtml;

    const newBtn = watchBtn.cloneNode(true);
    watchBtn.parentNode.replaceChild(newBtn, watchBtn);
    newBtn.addEventListener('click', async () => {
      if (currentMovieData) {
        const effectivePath = (currentMovieData.audioStatus === 'ok' && currentMovieData.audioConvertedPath)
          ? currentMovieData.audioConvertedPath : currentMovieData.path;
        await window.openVideoPlayer(currentMovieData.id, currentMovieData.title, effectivePath, null, currentMovieData.audioStatus === 'ok', currentMovieData.path);
      }
    });
  }

  // Nouvelle fonction pour créer une popup de confirmation avec 3 boutons
  function createAdvancedConfirmationPopup(title, message, buttons) {
    const popup = document.createElement('div');
    popup.className = 'advanced-confirmation-popup';

    const buttonsHtml = buttons.map(btn =>
      `<button class="popup-btn ${btn.class}" data-action="${btn.action}">${btn.text}</button>`
    ).join('');

    popup.innerHTML = `
      <div class="popup-content">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="popup-buttons">
          ${buttonsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animation d'entrée
    setTimeout(() => {
      popup.classList.add('show');
    }, 10);

    return new Promise((resolve) => {
      // Gestion des clics sur les boutons
      popup.querySelectorAll('.popup-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          popup.classList.remove('show');
          setTimeout(() => {
            document.body.removeChild(popup);
            resolve(action);
          }, 300);
        });
      });

      // Fermer en cliquant sur l'overlay
      popup.addEventListener('click', (e) => {
        if (e.target === popup) {
          popup.classList.remove('show');
          setTimeout(() => {
            document.body.removeChild(popup);
            resolve('cancel');
          }, 300);
        }
      });
    });
  }

  // Fonction simple pour créer une popup de confirmation à 2 boutons
  function createConfirmationPopup(message, onConfirm, onCancel) {
    const popup = document.createElement('div');
    popup.className = 'edit-confirmation-popup';
    popup.innerHTML = `
      <div class="popup-content">
        <p>${message}</p>
        <div class="popup-buttons">
          <button class="popup-btn popup-cancel">Annuler</button>
          <button class="popup-btn popup-confirm">Confirmer</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animation d'entrée
    setTimeout(() => {
      popup.classList.add('show');
    }, 10);

    // Événements
    popup.querySelector('.popup-cancel').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(popup);
        if (onCancel) onCancel();
      }, 300);
    });

    popup.querySelector('.popup-confirm').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(popup);
        if (onConfirm) onConfirm();
      }, 300);
    });
  }

  // NOUVEAU SYSTÈME DE BOUTONS EXTENSIBLES selon vos spécifications
  if (editButton) {
    editButton.addEventListener('click', async () => {
      if (!isEditMode) {
        // Activer le mode édition
        activateEditMode();
      } else {
        // Mode édition déjà actif, clic sur bouton central
        if (hasUnsavedChanges) {
          // Il y a des modifications → popup 3 boutons
          const result = await createAdvancedConfirmationPopup(
            'Modifications en cours',
            'Vous avez des modifications non sauvegardées. Que souhaitez-vous faire ?',
            [
              { text: 'Retour', class: 'popup-secondary', action: 'return' },
              { text: 'Sauvegarder', class: 'popup-success', action: 'save' },
              { text: 'Annuler les modifs', class: 'popup-danger', action: 'discard' }
            ]
          );

          switch (result) {
            case 'save':
              await saveChangesAndExit();
              break;
            case 'discard':
              discardChangesAndExit();
              break;
            case 'return':
            default:
              // Ne rien faire, rester en mode édition
              break;
          }
        } else {
          // Pas de modifications → retour direct au mode normal
          deactivateEditMode();
        }
      }
    });
  }

  // Événement pour le bouton d'annulation (rouge, gauche)
  if (editCancelBtn) {
    editCancelBtn.addEventListener('click', async () => {
      const result = await createAdvancedConfirmationPopup(
        'Annuler les modifications',
        'Êtes-vous sûr de vouloir annuler toutes les modifications ?',
        [
          { text: 'Non, continuer', class: 'popup-secondary', action: 'continue' },
          { text: 'Oui, annuler', class: 'popup-danger', action: 'discard' }
        ]
      );

      if (result === 'discard') {
        discardChangesAndExit();
        // Masquer les boutons après annulation
        hideExtensionButtons();
      }
    });
  }

  // Événement pour le bouton de sauvegarde (vert, droite)
  if (editSaveBtn) {
    editSaveBtn.addEventListener('click', async () => {
      if (hasUnsavedChanges) {
        await saveChanges();
        // Masquer les boutons après sauvegarde car plus de modifications
        hideExtensionButtons();
        console.log('Modifications sauvegardées, boutons masqués');
      }
    });
  }

  // Fonctions helper pour le nouveau système
  async function saveChangesAndExit() {
    await saveChanges();
    deactivateEditMode();
  }

  function discardChangesAndExit() {
    // Restaurer les données originales
    resetEditFields();
    hasUnsavedChanges = false;
    deactivateEditMode();
  }

  // Fonction pour mettre à jour l'état du bouton save
  function updateSaveButtonState() {
    if (editSaveBtn) {
      if (hasUnsavedChanges) {
        editSaveBtn.classList.add('active');
      } else {
        editSaveBtn.classList.remove('active');
      }
    }
  }

  // Fonction pour détecter les changements dans les champs d'édition
  function setupChangeDetection() {
    // Détecter les changements sur tous les champs d'édition créés par transformToEditableFields
    const editFieldClasses = [
      '.edit-title-field',
      '.edit-year-field',
      '.edit-synopsis-field',
      '.edit-director-field',
      '.edit-actors-field'
    ];

    editFieldClasses.forEach(fieldClass => {
      const field = document.querySelector(fieldClass);
      if (field) {
        field.addEventListener('input', () => {
          hasUnsavedChanges = true;
          updateSaveButtonState();

          // Afficher les boutons d'extension lors du premier changement
          showExtensionButtons();

          console.log('🔄 Changement détecté dans:', fieldClass);
        });
      }
    });
  }

  // Fonction pour réinitialiser les champs d'édition
  function resetEditFields() {
    if (currentMovieData) {
      const titleInput = document.getElementById('edit-title-input');
      const dateInput = document.getElementById('edit-release-date-input');
      const synopsisInput = document.getElementById('edit-synopsis-input');

      if (titleInput) titleInput.value = currentMovieData.title || '';
      if (dateInput && currentMovieData.releaseDate) {
        // Convertir le format DD/MM/YYYY vers YYYY-MM-DD
        const dateParts = currentMovieData.releaseDate.split('/');
        if (dateParts.length === 3) {
          dateInput.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
      }
      if (synopsisInput) synopsisInput.value = currentMovieData.description || '';
    }
  }

  // Initialiser la détection des changements
  try {
    setupChangeDetection();
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la détection des changements:', error);
  }

  // Initialiser le système de tags avancé seulement si les éléments existent
  try {
    const smartBtns = document.querySelectorAll('.smart-add-btn');
    console.log('🔍 Smart add buttons trouvés:', smartBtns.length);

    if (smartBtns.length > 0) {
      console.log('🚀 Initialisation du nouveau système de tags');
      setupAdvancedTagSystem();
    } else {
      console.warn('⚠️ Aucun bouton smart-add-btn trouvé');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du système de tags:', error);
  }

  // NOUVEAU SYSTÈME DE TAGS INTELLIGENT
  function setupAdvancedTagSystem() {
    // Variables pour stocker les tags par catégorie
    let mediaTags = {
      mood: [],
      technical: [],
      personal: []
    };

    // Base de données des tags existants par catégorie (simulée)
    const existingTags = {
      mood: [
        'Dynamique', 'Intense', 'Épique', 'Aventurier', 'Familial', 'Imaginatif', 'Léger', 'Divertissant',
        'Sombre', 'Tendu', 'Éducatif', 'Informatif', 'Émotionnel', 'Profond', 'Bienveillant', 'Magique',
        'Historique', 'Effrayant', 'Musical', 'Rythmé', 'Intriguant', 'Mystérieux', 'Romantique', 'Émouvant',
        'Futuriste', 'Innovant', 'Suspense', 'Classique'
      ],
      technical: [
        'HD', '4K', 'HDR', 'Dolby Atmos', 'IMAX', 'Director\'s Cut', 'Remastered', 'Restauré',
        'Version longue', 'Version originale', 'Sous-titré', 'VF', 'VOSTFR', 'Bonus inclus',
        'Making-of', 'Commentaires', 'Scènes coupées', 'Multi-angles', 'DTS', 'Surround'
      ],
      personal: [
        'Coup de cœur', 'À revoir', 'Culte', 'Nostalgie', 'Découverte', 'Recommandé',
        'Oscar', 'Cannes', 'Festival', 'Indie', 'Blockbuster', 'Art et essai',
        'Collection', 'Saga', 'Trilogie', 'Univers partagé', 'Adaptation', 'Original'
      ]
    };

    // Récupérer les boutons d'ajout de tags intelligents
    const smartAddButtons = document.querySelectorAll('.smart-add-btn');

    smartAddButtons.forEach(button => {
      const category = button.dataset.category;
      const dropdown = document.getElementById(`${category}-dropdown`);
      const searchInput = dropdown.querySelector('.dropdown-search');
      const createBtn = dropdown.querySelector('.dropdown-create-btn');
      const tagsList = dropdown.querySelector('.dropdown-tags-list');

      // Gestion du clic sur le bouton +
      button.addEventListener('click', (e) => {
        e.preventDefault();

        // Fermer tous les autres dropdowns
        document.querySelectorAll('.smart-tag-dropdown').forEach(dd => {
          if (dd !== dropdown) {
            dd.classList.remove('active');
            dd.style.display = 'none';
          }
        });
        document.querySelectorAll('.smart-add-btn').forEach(btn => {
          if (btn !== button) {
            btn.classList.remove('extended');
          }
        });

        // Toggle ce dropdown
        if (dropdown.classList.contains('active')) {
          // Fermer
          closeDropdown(button, dropdown);
        } else {
          // Ouvrir
          openDropdown(button, dropdown, category);
        }
      });

      // Gestion de la recherche
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterTags(category, searchTerm, tagsList, createBtn);
      });

      // Gestion du bouton "Créer nouveau tag"
      createBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newTagName = searchInput.value.trim();
        if (newTagName) {
          addNewTag(category, newTagName);
          searchInput.value = '';
          closeDropdown(button, dropdown);
        }
      });

      // Fermer dropdown en cliquant ailleurs
      document.addEventListener('click', (e) => {
        if (!button.contains(e.target) && !dropdown.contains(e.target)) {
          closeDropdown(button, dropdown);
        }
      });
    });

    // Fonctions helper pour le nouveau système
    function openDropdown(button, dropdown, category) {
      // Animation d'extension du bouton
      button.classList.add('extended');

      // Afficher le dropdown
      dropdown.style.display = 'block';

      // Délai pour l'animation
      setTimeout(() => {
        dropdown.classList.add('active');

        // Peupler la liste des tags
        populateTagsList(category, dropdown);

        // Focus sur la recherche
        const searchInput = dropdown.querySelector('.dropdown-search');
        searchInput.focus();
      }, 100);
    }

    function closeDropdown(button, dropdown) {
      button.classList.remove('extended');
      dropdown.classList.remove('active');

      setTimeout(() => {
        dropdown.style.display = 'none';

        // Réinitialiser la recherche
        const searchInput = dropdown.querySelector('.dropdown-search');
        searchInput.value = '';

        const createBtn = dropdown.querySelector('.dropdown-create-btn');
        createBtn.style.display = 'block';
        createBtn.classList.remove('hidden');
      }, 400);
    }

    function populateTagsList(category, dropdown) {
      const tagsList = dropdown.querySelector('.dropdown-tags-list');
      tagsList.innerHTML = '';

      // Récupérer les tags existants pour cette catégorie
      const availableTags = existingTags[category] || [];

      if (availableTags.length === 0) {
        tagsList.innerHTML = '<div class="dropdown-no-results">Aucun tag prédéfini pour cette catégorie</div>';
        return;
      }

      // Trier alphabétiquement
      const sortedTags = [...availableTags].sort((a, b) => a.localeCompare(b));

      sortedTags.forEach(tagName => {
        const tagItem = document.createElement('div');
        tagItem.className = 'dropdown-tag-item';
        tagItem.textContent = tagName;

        // Vérifier si le tag est déjà ajouté
        if (mediaTags[category].includes(tagName)) {
          tagItem.classList.add('already-added');
        }

        // Gestion du clic
        tagItem.addEventListener('click', () => {
          if (!tagItem.classList.contains('already-added')) {
            addExistingTag(category, tagName);
            closeDropdown(dropdown.closest('.edit-tag-category').querySelector('.smart-add-btn'), dropdown);
          }
        });

        tagsList.appendChild(tagItem);
      });
    }

    function filterTags(category, searchTerm, tagsList, createBtn) {
      const tagItems = tagsList.querySelectorAll('.dropdown-tag-item');
      let hasVisibleItems = false;

      tagItems.forEach(item => {
        const tagName = item.textContent.toLowerCase();
        if (tagName.includes(searchTerm)) {
          item.classList.remove('filtered-out');
          hasVisibleItems = true;
        } else {
          item.classList.add('filtered-out');
        }
      });

      // Gestion du bouton "Créer nouveau"
      if (searchTerm.length > 0) {
        createBtn.style.display = 'none';
        createBtn.classList.add('hidden');
      } else {
        createBtn.style.display = 'block';
        createBtn.classList.remove('hidden');
      }

      // Message si aucun résultat
      const noResults = tagsList.querySelector('.dropdown-no-results');
      if (!hasVisibleItems && searchTerm.length > 0) {
        if (!noResults) {
          const noResultsDiv = document.createElement('div');
          noResultsDiv.className = 'dropdown-no-results';
          noResultsDiv.textContent = `Aucun tag trouvé pour "${searchTerm}"`;
          tagsList.appendChild(noResultsDiv);
        }
      } else if (noResults) {
        noResults.remove();
      }
    }

    function addExistingTag(category, tagName) {
      if (!mediaTags[category].includes(tagName)) {
        mediaTags[category].push(tagName);

        const container = document.getElementById(`edit-${category}-tags`);
        const tagChip = createSmartTagChip(tagName, category);
        container.appendChild(tagChip);

        // Marquer comme modifié
        markAsChanged();
      }
    }

    function addNewTag(category, tagName) {
      if (!mediaTags[category].includes(tagName)) {
        // Ajouter à la liste locale
        mediaTags[category].push(tagName);

        // Ajouter à la base de tags existants (pour les futures utilisations)
        if (!existingTags[category].includes(tagName)) {
          existingTags[category].push(tagName);
        }

        const container = document.getElementById(`edit-${category}-tags`);
        const tagChip = createSmartTagChip(tagName, category, true); // true = nouveau tag
        container.appendChild(tagChip);

        // Marquer comme modifié
        markAsChanged();
      }
    }

    // Nouvelle fonction pour créer un smart tag chip avec état transparent
    function createSmartTagChip(tagValue, category, isNew = false) {
      const tagChip = document.createElement('div');
      tagChip.className = `edit-tag-chip ${isNew ? 'newly-added' : 'adding'}`;
      tagChip.innerHTML = `
        <span>${tagValue}</span>
        <button class="remove-tag" data-tag="${tagValue}" data-category="${category}">
          <i class="fas fa-times"></i>
        </button>
      `;

      // Ajouter l'événement de suppression/restauration
      const removeBtn = tagChip.querySelector('.remove-tag');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTagTransparency(tagValue, category, tagChip);
      });

      return tagChip;
    }

    // Nouvelle fonction pour gérer l'état transparent des tags
    function toggleTagTransparency(tagValue, category, tagElement) {
      if (tagElement.classList.contains('transparent')) {
        // Restaurer le tag
        tagElement.classList.remove('transparent');
        console.log(`Tag "${tagValue}" restauré`);
      } else {
        // Marquer comme transparent (suppression en attente)
        tagElement.classList.add('transparent');
        console.log(`Tag "${tagValue}" marqué pour suppression`);
      }

      // Marquer comme modifié
      markAsChanged();
    }

    // Fonction pour supprimer définitivement les tags transparents lors de la sauvegarde
    function applyTagChanges() {
      ['mood', 'technical', 'personal'].forEach(category => {
        const container = document.getElementById(`edit-${category}-tags`);
        const transparentTags = container.querySelectorAll('.edit-tag-chip.transparent');

        transparentTags.forEach(tagElement => {
          const tagValue = tagElement.querySelector('span').textContent;

          // Retirer de la liste des tags
          const index = mediaTags[category].indexOf(tagValue);
          if (index > -1) {
            mediaTags[category].splice(index, 1);
          }

          // Supprimer l'élément avec animation
          tagElement.classList.add('removing');
          setTimeout(() => {
            if (tagElement.parentNode) {
              tagElement.remove();
            }
          }, 300);
        });
      });
    }

    // Fonction pour charger les tags existants du média
    function loadMediaTags(mediaData) {
      if (mediaData && mediaData.tags) {
        mediaTags = {
          mood: mediaData.tags.mood || [],
          technical: mediaData.tags.technical || [],
          personal: mediaData.tags.personal || []
        };

        // Afficher les tags dans l'interface avec le nouveau système
        Object.keys(mediaTags).forEach(category => {
          const container = document.getElementById(`edit-${category}-tags`);
          if (container) {
            container.innerHTML = '';
            mediaTags[category].forEach(tag => {
              const tagChip = createSmartTagChip(tag, category);
              container.appendChild(tagChip);
            });
          }
        });
      }
    }

    // Fonction pour obtenir tous les tags du média pour la sauvegarde
    function getMediaTags() {
      // Appliquer les changements de transparence avant de retourner
      applyTagChanges();
      return mediaTags;
    }

    // Exposer les fonctions pour utilisation dans d'autres parties du code
    window.tagSystem = {
      loadMediaTags,
      getMediaTags,
      applyTagChanges,
      // Exposer aussi les autres fonctions utiles
      addExistingTag,
      addNewTag,
      toggleTagTransparency
    };
  }

  // Fonction pour configurer les boutons + d'ajout de tags
  function setupAddTagButtons() {
    const availableTags = {
      genres: ['Action', 'Aventure', 'Comédie', 'Drame', 'Fantastique', 'Horreur', 'Romance', 'Science-Fiction', 'Thriller', 'Animation', 'Documentaire', 'Musical'],
      mood: ['Sombre', 'Joyeux', 'Mélancolique', 'Intense', 'Relaxant', 'Inspirant', 'Nostalgique', 'Mystérieux'],
      technical: ['Effets Spéciaux', 'Cinématographie', 'Bande Originale', 'Montage', 'Direction Artistique', 'Costume', 'Maquillage'],
      personal: ['Coup de cœur', 'À revoir', 'Déçu', 'Surprise', 'Classique'],
      franchise: []
    };

    const addButtons = document.querySelectorAll('.add-tag-btn-inline');
    addButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const category = button.dataset.category;

        // Pour franchise : popup avec saisie libre + suggestions existantes
        if (category === 'franchise') {
          const existingFranchises = (currentMovieData && currentMovieData.franchises) || [];
          showFreeInputTagPopup(category, existingFranchises);
          return;
        }

        const container = document.getElementById(`${category}-container`);
        const existingTags = Array.from(container.querySelectorAll('.tag-chip')).map(chip => {
          const textNode = chip.querySelector('.tag-text');
          return textNode ? textNode.textContent : chip.textContent;
        });

        const tagsToShow = (availableTags[category] || []).filter(tag => !existingTags.includes(tag));
        if (tagsToShow.length === 0) {
          alert('Tous les tags sont déjà ajoutés pour cette catégorie');
          return;
        }

        showTagSelectionPopup(category, tagsToShow);
      });
    });
  }

  function showTagSelectionPopup(category, tags) {
    const popup = document.createElement('div');
    popup.className = 'tag-selection-popup';
    popup.innerHTML = `
      <div class="tag-selection-content">
        <h3>Ajouter un tag</h3>
        <div class="tag-selection-list">
          ${tags.map(tag => `<button class="tag-selection-item" data-tag="${tag}"><i class="fas fa-plus-circle"></i> ${tag}</button>`).join('')}
        </div>
        <button class="tag-selection-close">Fermer</button>
      </div>
    `;

    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 10);

    popup.querySelectorAll('.tag-selection-item').forEach(item => {
      item.addEventListener('click', () => {
        addTagToCategory(category, item.dataset.tag);
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
      });
    });

    popup.querySelector('.tag-selection-close').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 300);
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
      }
    });
  }

  function showFreeInputTagPopup(category, currentTags) {
    const popup = document.createElement('div');
    popup.className = 'tag-selection-popup';
    popup.innerHTML = `
      <div class="tag-selection-content">
        <h3>Ajouter une franchise</h3>
        <div class="tag-free-input-row">
          <input type="text" class="tag-free-input" placeholder="Nom de la franchise…" autocomplete="off">
          <button class="tag-free-confirm">Ajouter</button>
        </div>
        <button class="tag-selection-close">Fermer</button>
      </div>
    `;

    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 10);

    const input = popup.querySelector('.tag-free-input');
    const confirmBtn = popup.querySelector('.tag-free-confirm');
    input.focus();

    const doAdd = () => {
      const val = input.value.trim();
      if (!val) return;
      if (!currentTags.includes(val)) {
        addTagToCategory(category, val);
      }
      input.value = '';
      input.focus();
    };

    confirmBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

    popup.querySelector('.tag-selection-close').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 300);
    });
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
      }
    });
  }

  function addTagToCategory(category, tagName) {
    const container = document.getElementById(`${category}-container`);
    if (!container) return;

    // Mettre à jour currentMovieData pour persister le tag
    const dataKey = category === 'genres' ? 'genres'
      : category === 'mood' ? 'mood'
      : category === 'technical' ? 'technical'
      : category === 'franchise' ? 'franchises'
      : 'personalTags';
    if (!currentMovieData[dataKey]) {
      currentMovieData[dataKey] = [];
    }
    if (!currentMovieData[dataKey].includes(tagName)) {
      currentMovieData[dataKey].push(tagName);
    }

    // Retirer le message "Aucun tag ajouté" s'il existe
    const emptyMessage = container.querySelector('.empty-tags-message');
    if (emptyMessage) emptyMessage.remove();

    // Créer le chip
    const chip = document.createElement('span');
    chip.className = `tag-chip ${category === 'genres' ? 'genre' : category} editable`;
    chip.innerHTML = `<span class="tag-text">${tagName}</span><button class="tag-remove-btn" title="Supprimer ce tag"><i class="fas fa-times"></i></button>`;

    // Insérer avant le bouton +
    const addButton = container.querySelector('.add-tag-btn-inline');
    if (addButton) {
      container.insertBefore(chip, addButton);
    } else {
      container.appendChild(chip);
    }

    // Ajouter l'événement de suppression
    const removeBtn = chip.querySelector('.tag-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        chip.remove();

        // Mettre à jour currentMovieData pour supprimer le tag
        const index = currentMovieData[dataKey].indexOf(tagName);
        if (index > -1) {
          currentMovieData[dataKey].splice(index, 1);
        }

        // Réafficher "Aucun tag ajouté" si plus de tags
        const remainingTags = container.querySelectorAll('.tag-chip');
        if (remainingTags.length === 0) {
          const emptyMsg = document.createElement('span');
          emptyMsg.className = 'empty-tags-message';
          emptyMsg.textContent = 'Aucun tag ajouté';
          const addBtn = container.querySelector('.add-tag-btn-inline');
          if (addBtn) {
            container.insertBefore(emptyMsg, addBtn);
          } else {
            container.appendChild(emptyMsg);
          }
        }

        hasUnsavedChanges = true;
        showExtensionButtons();
      });
    }

    hasUnsavedChanges = true;
    showExtensionButtons();
  }

  // Exposer la fonction pour pouvoir l'appeler depuis dashboard.js
  window.setupModalTriggers = setupModalTriggers;

  // Vérification finale
  console.log('🔧 Movie modal initialisé. Fonctions exposées:', {
    openMovieModal: typeof window.openMovieModal,
    setupModalTriggers: typeof window.setupModalTriggers,
    tagSystem: typeof window.tagSystem
  });
});