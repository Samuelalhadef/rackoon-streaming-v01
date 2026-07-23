// personnes.js - Gestion de la page Personnes

console.log('👤 Script personnes.js CHARGÉ');

document.addEventListener('DOMContentLoaded', () => {
  console.log('👤 Initialisation de personnes.js...');

  // TMDB config (même token que movie-modal.js)
  const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMjIwYTRiMzAyMTZlMzkwYzE1MmE1MjhlNGVmYjc5YyIsIm5iZiI6MTczMzkzMjAyOS40Nywic3ViIjoiNjc1OWIzZmQ1MDZiNDIzOTRkMjE2MDM3Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.RFQAh_1LTZWemAFFIHJUimpU7BEHJxxrua0ys5rruos';
  const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

  const personsGrid = document.getElementById('persons-grid');
  const personsEmpty = document.getElementById('persons-empty');
  const personsSearchInput = document.getElementById('persons-search-input');
  const btnAddPerson = document.getElementById('btn-add-person');
  const btnAddPersonEmpty = document.getElementById('btn-add-person-empty');

  let allPersons = [];
  let personsLoaded = false;

  // Écouter le clic sur l'onglet pour lazy load
  const personnesTabLink = document.querySelector('[data-tab="personnes"]');
  if (personnesTabLink) {
    personnesTabLink.addEventListener('click', () => {
      if (!personsLoaded) {
        loadPersons();
      }
    });
  }

  // Boutons d'ajout
  if (btnAddPerson) btnAddPerson.addEventListener('click', openAddPersonModal);
  if (btnAddPersonEmpty) btnAddPersonEmpty.addEventListener('click', openAddPersonModal);

  // Recherche en temps réel
  if (personsSearchInput) {
    personsSearchInput.addEventListener('input', (e) => {
      searchPersons(e.target.value.trim());
    });
  }

  // ========================================
  // CHARGEMENT DES PERSONNES
  // ========================================

  async function loadPersons() {
    try {
      const result = await window.electronAPI.getAllPersons();
      if (result.success) {
        allPersons = result.persons || [];
        personsLoaded = true;
        renderPersons(allPersons);
      } else {
        console.error('Erreur chargement personnes:', result.error);
      }
    } catch (error) {
      console.error('Erreur chargement personnes:', error);
    }
  }

  // ========================================
  // RENDU
  // ========================================

  function renderPersons(persons) {
    if (!personsGrid) return;

    if (persons.length === 0) {
      personsGrid.style.display = 'none';
      if (personsEmpty) personsEmpty.style.display = 'flex';
      return;
    }

    personsGrid.style.display = 'grid';
    if (personsEmpty) personsEmpty.style.display = 'none';

    personsGrid.innerHTML = persons.map(person => renderPersonCard(person)).join('');

    // Event listeners
    personsGrid.querySelectorAll('.person-card').forEach(card => {
      card.addEventListener('click', () => {
        const personId = card.dataset.personId;
        openPersonDetail(personId);
      });
    });

    personsGrid.querySelectorAll('.person-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const personId = btn.dataset.personId;
        deletePersonUI(personId);
      });
    });
  }

  const DEPARTMENT_MAP = {
    'Acting': 'Acteur/Actrice',
    'Directing': 'Réalisateur/Réalisatrice',
    'Writing': 'Scénariste',
    'Production': 'Producteur/Productrice',
    'Sound': 'Son',
    'Camera': 'Caméra',
    'Editing': 'Montage',
    'Art': 'Direction artistique',
    'Crew': 'Équipe technique'
  };

  function getDepartmentLabel(dept) {
    return DEPARTMENT_MAP[dept] || dept || '';
  }

  function renderPersonCard(person) {
    const rolesCount = (person.roles || []).length;
    const department = getDepartmentLabel(person.knownForDepartment);

    let photoHtml;
    if (person.photo) {
      photoHtml = `<img class="person-photo" src="http://localhost:3001/person-photos/${person.photo}" alt="${escapeHtml(person.name)}">`;
    } else {
      photoHtml = `<div class="person-photo-placeholder"><i class="fas fa-user"></i></div>`;
    }

    return `
      <div class="person-card" data-person-id="${person.id}">
        <button class="person-delete-btn" data-person-id="${person.id}" title="Supprimer">
          <i class="fas fa-trash"></i>
        </button>
        ${photoHtml}
        <div class="person-name" title="${escapeHtml(person.name)}">${escapeHtml(person.name)}</div>
        ${department ? `<div class="person-department">${escapeHtml(department)}</div>` : ''}
        ${rolesCount > 0 ? `<div class="person-roles-badge"><i class="fas fa-link"></i> ${rolesCount} rôle${rolesCount > 1 ? 's' : ''}</div>` : ''}
      </div>
    `;
  }

  // ========================================
  // RECHERCHE
  // ========================================

  function searchPersons(query) {
    if (!query) {
      renderPersons(allPersons);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allPersons.filter(p => p.name.toLowerCase().includes(q));
    renderPersons(filtered);
  }

  // ========================================
  // MODAL AJOUT
  // ========================================

  function openAddPersonModal() {
    // Supprimer une ancienne modal si elle existe
    const existing = document.getElementById('person-add-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'person-add-modal';
    modal.className = 'person-add-modal-overlay';
    modal.innerHTML = `
      <div class="person-add-modal">
        <div class="person-add-modal-header">
          <h3><i class="fas fa-user-plus"></i> Ajouter une personne</h3>
          <button class="person-add-close-btn" id="person-add-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="person-add-modal-body">
          <div class="person-add-field">
            <label for="person-add-name">Nom</label>
            <input type="text" id="person-add-name" placeholder="Ex: Tom Hanks">
          </div>
          <button class="person-tmdb-search-btn" id="person-tmdb-search">
            <i class="fas fa-search"></i> Rechercher sur TMDB
          </button>
          <div id="person-tmdb-results-container"></div>
        </div>
        <div class="person-add-modal-footer">
          <button class="person-add-cancel-btn" id="person-add-cancel">Annuler</button>
          <button class="person-add-confirm-btn" id="person-add-confirm">
            <i class="fas fa-plus"></i> Ajouter manuellement
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const nameInput = document.getElementById('person-add-name');
    const closeBtn = document.getElementById('person-add-close');
    const cancelBtn = document.getElementById('person-add-cancel');
    const confirmBtn = document.getElementById('person-add-confirm');
    const tmdbSearchBtn = document.getElementById('person-tmdb-search');
    const resultsContainer = document.getElementById('person-tmdb-results-container');

    setTimeout(() => nameInput.focus(), 100);

    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Ajout manuel
    confirmBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      await addPersonManual(name);
      closeModal();
    });

    // Recherche TMDB
    tmdbSearchBtn.addEventListener('click', async () => {
      const query = nameInput.value.trim();
      if (!query) {
        nameInput.focus();
        return;
      }

      resultsContainer.innerHTML = `<div class="person-tmdb-status"><i class="fas fa-spinner fa-spin"></i> Recherche en cours...</div>`;

      try {
        const results = await searchTMDBPerson(query);
        if (results.length === 0) {
          resultsContainer.innerHTML = `<div class="person-tmdb-status">Aucun résultat trouvé</div>`;
          return;
        }

        resultsContainer.innerHTML = `<div class="person-tmdb-results">
          ${results.slice(0, 10).map(person => {
            const photoUrl = person.profile_path
              ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
              : '';
            const photoHtml = photoUrl
              ? `<img class="person-tmdb-result-photo" src="${photoUrl}" alt="">`
              : `<div class="person-tmdb-result-photo" style="display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);"><i class="fas fa-user" style="color:var(--text-muted);"></i></div>`;
            return `
              <div class="person-tmdb-result-item" data-tmdb-id="${person.id}">
                ${photoHtml}
                <div class="person-tmdb-result-info">
                  <div class="person-tmdb-result-name">${escapeHtml(person.name)}</div>
                  <div class="person-tmdb-result-dept">${escapeHtml(person.known_for_department || '')}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>`;

        // Click sur un résultat
        resultsContainer.querySelectorAll('.person-tmdb-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            const tmdbId = parseInt(item.dataset.tmdbId);
            const tmdbPerson = results.find(p => p.id === tmdbId);
            if (tmdbPerson) {
              resultsContainer.innerHTML = `<div class="person-tmdb-status"><i class="fas fa-spinner fa-spin"></i> Ajout en cours...</div>`;
              await addPersonFromTMDB(tmdbPerson);
              closeModal();
            }
          });
        });

      } catch (error) {
        console.error('Erreur recherche TMDB:', error);
        resultsContainer.innerHTML = `<div class="person-tmdb-status" style="color: #ff6b6b;">Erreur lors de la recherche</div>`;
      }
    });

    // Enter pour rechercher
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        tmdbSearchBtn.click();
      }
    });
  }

  // ========================================
  // AJOUT DE PERSONNES
  // ========================================

  async function addPersonFromTMDB(tmdbData) {
    try {
      // Télécharger la photo si disponible
      let photoFilename = null;
      if (tmdbData.profile_path) {
        const imageUrl = `https://image.tmdb.org/t/p/w500${tmdbData.profile_path}`;
        const result = await window.electronAPI.downloadPersonPhoto(imageUrl, tmdbData.name);
        if (result.success) {
          photoFilename = result.fileName;
        }
      }

      const personData = {
        name: tmdbData.name,
        tmdbId: tmdbData.id,
        photo: photoFilename,
        knownForDepartment: tmdbData.known_for_department || '',
        biography: '',
        birthday: '',
        placeOfBirth: ''
      };

      const result = await window.electronAPI.addPerson(personData);
      if (result.success) {
        console.log('Personne ajoutée:', tmdbData.name);
        await loadPersons();
      } else {
        console.error('Erreur ajout personne:', result.error);
        alert('Erreur : ' + (result.error || 'Impossible d\'ajouter la personne'));
      }
    } catch (error) {
      console.error('Erreur ajout personne TMDB:', error);
    }
  }

  async function addPersonManual(name) {
    try {
      const personData = {
        name: name,
        tmdbId: null,
        photo: null,
        knownForDepartment: '',
        biography: '',
        birthday: '',
        placeOfBirth: ''
      };

      const result = await window.electronAPI.addPerson(personData);
      if (result.success) {
        console.log('Personne ajoutée manuellement:', name);
        await loadPersons();
      } else {
        console.error('Erreur ajout personne:', result.error);
        alert('Erreur : ' + (result.error || 'Impossible d\'ajouter la personne'));
      }
    } catch (error) {
      console.error('Erreur ajout personne manuelle:', error);
    }
  }

  // ========================================
  // SUPPRESSION
  // ========================================

  async function deletePersonUI(personId) {
    const person = allPersons.find(p => p.id === personId);
    if (!person) return;

    const confirmed = confirm(`Supprimer "${person.name}" ? Cette action est irréversible.`);
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.deletePerson(personId);
      if (result.success) {
        console.log('Personne supprimée:', person.name);
        await loadPersons();
      } else {
        console.error('Erreur suppression:', result.error);
      }
    } catch (error) {
      console.error('Erreur suppression personne:', error);
    }
  }

  // ========================================
  // MODAL DÉTAIL PERSONNE
  // ========================================

  async function openPersonDetail(personId) {
    const person = allPersons.find(p => p.id === personId);
    if (!person) return;

    // Supprimer une ancienne modal
    const existing = document.getElementById('person-detail-modal');
    if (existing) existing.remove();

    const department = getDepartmentLabel(person.knownForDepartment);
    const roles = person.roles || [];

    let photoHtml;
    if (person.photo) {
      photoHtml = `<div class="person-photo-edit-area" title="Modifier la photo">
        <img class="person-detail-photo" src="http://localhost:3001/person-photos/${person.photo}" alt="${escapeHtml(person.name)}">
        <div class="person-photo-edit-overlay"><i class="fas fa-camera"></i></div>
      </div>`;
    } else {
      photoHtml = `<div class="person-photo-edit-area" title="Ajouter une photo">
        <div class="person-detail-photo-placeholder"><i class="fas fa-user"></i></div>
        <div class="person-photo-edit-overlay"><i class="fas fa-camera"></i></div>
      </div>`;
    }

    // Construire la liste des rôles liés
    let rolesHtml = '';
    if (roles.length > 0) {
      // Récupérer les noms des médias liés
      const rolesItems = await Promise.all(roles.map(async (role) => {
        let mediaName = role.mediaId;
        try {
          const mediaResult = await window.electronAPI.getMediaDetails(role.mediaId);
          if (mediaResult && mediaResult.title) {
            mediaName = mediaResult.title;
          }
        } catch (e) { /* ignore */ }

        const roleLabel = role.role === 'actor' ? 'Acteur' :
                          role.role === 'director' ? 'Réalisateur' :
                          role.role === 'writer' ? 'Scénariste' :
                          role.role || 'Rôle';
        const characterInfo = role.character ? ` (${escapeHtml(role.character)})` : '';

        return `
          <div class="person-detail-role-item">
            <div class="person-detail-role-media">${escapeHtml(mediaName)}</div>
            <div class="person-detail-role-type">${escapeHtml(roleLabel)}${characterInfo}</div>
          </div>
        `;
      }));
      rolesHtml = `
        <div class="person-detail-section">
          <h4><i class="fas fa-film"></i> Filmographie (${roles.length})</h4>
          <div class="person-detail-roles-list">${rolesItems.join('')}</div>
        </div>
      `;
    }

    // Biographie
    const bioHtml = person.biography ? `
      <div class="person-detail-section">
        <h4><i class="fas fa-book"></i> Biographie</h4>
        <p class="person-detail-bio">${escapeHtml(person.biography)}</p>
      </div>
    ` : '';

    // Infos complémentaires
    const infoParts = [];
    if (person.birthday) infoParts.push(`<span><i class="fas fa-birthday-cake"></i> ${escapeHtml(person.birthday)}</span>`);
    if (person.placeOfBirth) infoParts.push(`<span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(person.placeOfBirth)}</span>`);
    if (person.deathday) infoParts.push(`<span><i class="fas fa-cross"></i> ${escapeHtml(person.deathday)}</span>`);
    const infoHtml = infoParts.length > 0 ? `<div class="person-detail-infos">${infoParts.join('')}</div>` : '';

    const modal = document.createElement('div');
    modal.id = 'person-detail-modal';
    modal.className = 'person-add-modal-overlay';
    modal.innerHTML = `
      <div class="person-add-modal person-detail-modal-content">
        <div class="person-add-modal-header">
          <h3><i class="fas fa-user"></i> ${escapeHtml(person.name)}</h3>
          <button class="person-add-close-btn" id="person-detail-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="person-add-modal-body person-detail-body">
          <div class="person-detail-top">
            ${photoHtml}
            <div class="person-detail-main-info">
              <div class="person-detail-name">${escapeHtml(person.name)}</div>
              ${department ? `<div class="person-detail-dept">${escapeHtml(department)}</div>` : ''}
              ${infoHtml}
            </div>
          </div>
          ${bioHtml}
          ${rolesHtml}
          ${!bioHtml && !rolesHtml ? '<p class="person-tmdb-status">Aucune information supplémentaire disponible.</p>' : ''}
        </div>
        <div class="person-add-modal-footer">
          <button class="person-add-cancel-btn person-detail-delete-btn" data-person-id="${person.id}">
            <i class="fas fa-trash"></i> Supprimer
          </button>
          <button class="person-add-confirm-btn" id="person-detail-ok">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    document.getElementById('person-detail-close').addEventListener('click', closeModal);
    document.getElementById('person-detail-ok').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('.person-detail-delete-btn').addEventListener('click', async () => {
      closeModal();
      await deletePersonUI(person.id);
    });

    // Edition de la photo
    const photoEditArea = modal.querySelector('.person-photo-edit-area');
    if (photoEditArea) {
      photoEditArea.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (re) => {
            const base64Data = re.target.result.split(',')[1];
            const ext = '.' + (file.name.split('.').pop() || 'jpg');
            const result = await window.electronAPI.uploadPersonPhoto(person.id, base64Data, ext);
            if (result.success) {
              const newImg = document.createElement('img');
              newImg.className = 'person-detail-photo';
              newImg.src = `http://localhost:3001/person-photos/${result.fileName}`;
              const old = photoEditArea.querySelector('.person-detail-photo, .person-detail-photo-placeholder');
              if (old) old.replaceWith(newImg);
              photoEditArea.title = 'Modifier la photo';
              const personInArray = allPersons.find(p => p.id === person.id);
              if (personInArray) personInArray.photo = result.fileName;
              renderPersons(allPersons);
            }
          };
          reader.readAsDataURL(file);
        };
        input.click();
      });
    }
  }

  // ========================================
  // TMDB API
  // ========================================

  async function searchTMDBPerson(query) {
    const url = `${TMDB_API_BASE_URL}/search/person?query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false&page=1`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
    });
    if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  }

  // ========================================
  // UTILS
  // ========================================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Exposer pour usage externe
  window.loadPersons = loadPersons;
});
