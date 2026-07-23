// tags.js - Gestion de la page Tags

document.addEventListener('DOMContentLoaded', () => {

  const CATEGORIES = {
    genres:    { label: 'Genres',    icon: 'fa-film',       desc: 'Films & Séries',    editable: false },
    mood:      { label: 'Ambiance',  icon: 'fa-heart',      desc: 'Films & Séries',    editable: true  },
    technical: { label: 'Technique', icon: 'fa-sliders-h',  desc: 'Films uniquement',  editable: true  },
    personal:  { label: 'Personnel', icon: 'fa-tag',        desc: 'Films & Séries',    editable: true  }
  };

  const tagsGrid   = document.getElementById('tags-grid');
  const searchInput = document.getElementById('tags-search-input');

  let allTags    = {};
  let filterQuery = '';

  // ── Chargement ────────────────────────────────────────────────────────

  async function loadTags() {
    if (!window.electronAPI?.getAllTags) return;
    const result = await window.electronAPI.getAllTags();
    if (!result.success) return;
    allTags = result.tags;
    renderAll();
  }

  // ── Rendu ─────────────────────────────────────────────────────────────

  function renderAll() {
    if (!tagsGrid) return;
    tagsGrid.innerHTML = '';
    for (const [category, info] of Object.entries(CATEGORIES)) {
      const raw  = allTags[category] || [];
      const tags = filterQuery
        ? raw.filter(t => t.tag.toLowerCase().includes(filterQuery))
        : raw;
      tagsGrid.appendChild(buildCategoryCard(category, info, tags, raw.length));
    }
  }

  function buildCategoryCard(category, info, tags, totalCount) {
    const card = document.createElement('div');
    card.className = 'tags-category-card';

    // En-tête
    const header = document.createElement('div');
    header.className = 'tags-category-header';

    const title = document.createElement('div');
    title.className = 'tags-category-title';
    title.innerHTML = `<i class="fas ${info.icon}"></i><span>${info.label}</span>`;

    const headerRight = document.createElement('div');
    headerRight.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const countBadge = document.createElement('span');
    countBadge.className = 'tags-category-count';
    countBadge.textContent = `${totalCount} tag${totalCount !== 1 ? 's' : ''}`;
    headerRight.appendChild(countBadge);

    // Bouton + uniquement pour les catégories éditables
    if (info.editable) {
      const addBtn = document.createElement('button');
      addBtn.className = 'tags-category-add-btn';
      addBtn.innerHTML = '<i class="fas fa-plus"></i>';
      addBtn.title = 'Ajouter un tag';
      addBtn.addEventListener('click', () => openAddInput(category, list));
      headerRight.appendChild(addBtn);
    }

    header.appendChild(title);
    header.appendChild(headerRight);
    card.appendChild(header);

    const desc = document.createElement('div');
    desc.className = 'tags-category-desc';
    desc.textContent = info.desc;
    card.appendChild(desc);

    // Liste
    const list = document.createElement('div');
    list.className = 'tags-list';

    if (tags.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tags-empty';
      empty.textContent = filterQuery ? 'Aucun résultat pour ce filtre' : 'Aucun tag défini';
      list.appendChild(empty);
    } else {
      for (const { tag, count } of tags) {
        list.appendChild(buildTagRow(category, tag, count));
      }
    }
    card.appendChild(list);

    return card;
  }

  function buildTagRow(category, tag, count) {
    const row = document.createElement('div');
    row.className = 'tags-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'tags-row-name';
    nameEl.textContent = tag;

    const countBadge = document.createElement('span');
    countBadge.className = 'tags-row-count';
    countBadge.textContent = count;
    countBadge.title = `Utilisé dans ${count} média${count !== 1 ? 's' : ''}`;

    const actions = document.createElement('div');
    actions.className = 'tags-row-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'tags-row-btn tags-edit-btn';
    editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    editBtn.title = 'Renommer';
    editBtn.addEventListener('click', () => openRenameInput(row, nameEl, category, tag));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tags-row-btn tags-delete-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = 'Supprimer';
    deleteBtn.addEventListener('click', () => openDeleteConfirm(row, category, tag, count));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(nameEl);
    row.appendChild(countBadge);
    row.appendChild(actions);

    return row;
  }

  // ── Renommage inline ──────────────────────────────────────────────────

  function openRenameInput(row, nameEl, category, oldTag) {
    if (row.querySelector('.tags-rename-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tags-rename-input';
    input.value = oldTag;
    input.maxLength = 80;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let confirmed = false;

    const confirm = async () => {
      if (confirmed) return;
      confirmed = true;
      const newTag = input.value.trim();
      if (!newTag || newTag === oldTag) {
        input.replaceWith(nameEl);
        return;
      }
      await window.electronAPI.renameTag(category, oldTag, newTag);
      await loadTags();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { confirmed = true; input.replaceWith(nameEl); }
    });
    input.addEventListener('blur', confirm);
  }

  // ── Suppression avec confirmation ─────────────────────────────────────

  function openDeleteConfirm(row, category, tag, count) {
    if (row.querySelector('.tags-delete-confirm')) return;

    const confirmEl = document.createElement('div');
    confirmEl.className = 'tags-delete-confirm';

    const msg = document.createElement('span');
    msg.textContent = count > 0
      ? `Retirer "${tag}" de ${count} média${count !== 1 ? 's' : ''} ?`
      : `Supprimer "${tag}" ?`;

    const yesBtn = document.createElement('button');
    yesBtn.className = 'tags-confirm-yes';
    yesBtn.textContent = 'Supprimer';
    yesBtn.addEventListener('click', async () => {
      await window.electronAPI.deleteTag(category, tag);
      await loadTags();
    });

    const noBtn = document.createElement('button');
    noBtn.className = 'tags-confirm-no';
    noBtn.textContent = 'Annuler';
    noBtn.addEventListener('click', () => confirmEl.remove());

    confirmEl.appendChild(msg);
    confirmEl.appendChild(yesBtn);
    confirmEl.appendChild(noBtn);
    row.appendChild(confirmEl);
  }

  // ── Ajout d'un tag prédéfini ──────────────────────────────────────────

  function openAddInput(category, list) {
    // Éviter les doublons d'input
    if (list.querySelector('.tags-add-input')) return;

    const row = document.createElement('div');
    row.className = 'tags-row tags-add-row-inline';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tags-rename-input';
    input.placeholder = 'Nouveau tag...';
    input.maxLength = 80;
    input.style.flex = '1';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'tags-row-btn tags-edit-btn';
    confirmBtn.innerHTML = '<i class="fas fa-check"></i>';
    confirmBtn.title = 'Valider';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tags-row-btn tags-delete-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.title = 'Annuler';

    row.appendChild(input);
    row.appendChild(confirmBtn);
    row.appendChild(cancelBtn);
    list.appendChild(row);
    input.focus();

    // Supprimer la mention "Aucun tag défini" si présente
    const emptyEl = list.querySelector('.tags-empty');
    if (emptyEl) emptyEl.remove();

    let done = false;

    const cancel = () => {
      if (done) return; done = true;
      row.remove();
      // Réafficher "vide" si aucun tag n'existe
      if (list.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tags-empty';
        empty.textContent = 'Aucun tag défini';
        list.appendChild(empty);
      }
    };

    const confirm = async () => {
      if (done) return;
      const newTag = input.value.trim();
      if (!newTag) { cancel(); return; }
      // Doublon ?
      const existing = (allTags[category] || []).find(t => t.tag.toLowerCase() === newTag.toLowerCase());
      if (existing) { cancel(); return; }

      done = true;
      await window.electronAPI.addPredefinedTag(category, newTag);
      await loadTags();
    };

    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') cancel();
    });
    input.addEventListener('blur', (e) => {
      if (e.relatedTarget === confirmBtn || e.relatedTarget === cancelBtn) return;
      cancel();
    });
  }

  // ── Recherche ─────────────────────────────────────────────────────────

  searchInput?.addEventListener('input', () => {
    filterQuery = searchInput.value.trim().toLowerCase();
    renderAll();
  });

  // ── Activation au clic sur l'onglet ───────────────────────────────────

  document.querySelector('.tab-link[data-tab="tags"]')?.addEventListener('click', () => {
    loadTags();
  });

  // Charger si l'onglet est actif au démarrage
  const section = document.getElementById('section-tags');
  if (section?.classList.contains('active')) loadTags();
});
