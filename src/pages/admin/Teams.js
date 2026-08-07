import { supabase, isAdmin, uploadFile } from '../../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES } from '../../lib/constants.js';
import { navigateTo } from '../../application.js';

export async function renderAdminTeamsPage() {
  if (!isAdmin()) {
    navigateTo('/');
    return document.createElement('div');
  }

  const page = document.createElement('div');
  page.className = 'admin-teams-page container mt-xl';

  // Get current season
  const { data: currentSeason } = await supabase
    .from('seasons')
    .select('*')
    .eq('status', 'active')
    .order('year', { ascending: false })
    .limit(1)
    .single();

  if (!currentSeason) {
    page.innerHTML = `
      <div class="text-center">
        <h2>Nessuna stagione attiva</h2>
        <p class="mt-md">Crea una stagione prima di aggiungere squadre.</p>
        <a href="/admin/seasons" data-link class="btn btn-primary mt-md">Gestione Stagioni</a>
      </div>
    `;
    return page;
  }

  // Get teams and groups
  const { data: teams } = await supabase
    .from('teams')
    .select(`
      *,
      team_groups(
        id,
       group:groups(id, name)
      )
    `)
    .eq('season_id', currentSeason.id)
    .order('name');

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .eq('season_id', currentSeason.id)
    .order('name');

  page.innerHTML = `
    <h1 class="text-center mb-xl">Gestione Squadre - Stagione ${currentSeason.year}</h1>
    
    <div class="admin-actions mb-lg">
      <button class="btn btn-primary" id="new-team-btn">
        ➕ Nuova Squadra
      </button>
    </div>
    
    <div id="team-form" class="glass-card mb-lg hidden">
      <h3 class="mb-md">Aggiungi Squadra</h3>
      
      <form id="create-team-form">
        <div class="input-group">
          <label>Logo Squadra</label>
          <div class="image-upload-container">
            <div class="image-preview" id="logo-preview" style="width: 100px; height: 100px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10,8 16,12 10,16"></polygon>
              </svg>
            </div>
            <input type="file" id="team-logo" accept="image/*" class="file-input">
            <label for="team-logo" class="file-label btn btn-secondary">
              Scegli Logo
            </label>
          </div>
        </div>
        
        <div class="input-group">
          <label for="team-name">Nome Squadra *</label>
          <input type="text" id="team-name" name="team-name" required>
        </div>
        
        <div class="input-group">
          <label for="team-category">Categoria *</label>
          <select id="team-category" name="team-category" required>
            <option value="">Seleziona categoria...</option>
            ${TOURNAMENT_CATEGORIES.map(cat => `
              <option value="${cat}">${cat}</option>
            `).join('')}
          </select>
        </div>

        <div class="input-group">
          <label for="team-group">Girone</label>
          <select id="team-group" name="team-group" disabled>
            <option value="">Seleziona prima una categoria</option>
          </select>
        </div>
        
        <div id="form-error" class="error-message hidden"></div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Aggiungi Squadra</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annulla</button>
        </div>
      </form>
    </div>

    <!-- Delete confirmation modal -->
    <div id="delete-modal" class="admin-modal-overlay" style="display: none;">
      <div class="admin-modal-card glass-card">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <h3 style="color: var(--color-yellow); margin-bottom: 0.5rem;">Eliminare questa squadra?</h3>
          <p id="delete-team-name" style="color: rgba(255,255,255,0.7); font-size: 0.95rem;"></p>
        </div>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; text-align: center; margin-bottom: 1.25rem;">
          Questa azione è irreversibile. Verranno rimossi anche giocatori e assegnazioni girone collegati.
        </p>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-secondary" id="delete-cancel-btn" style="flex: 1;">Annulla</button>
          <button class="btn" id="delete-confirm-btn" style="flex: 1; background: #dc2626; border-color: #991b1b; color: white; font-weight: 700;">Elimina</button>
        </div>
      </div>
    </div>
    
    <!-- Filter by Category -->
    <div class="category-tabs-container mb-lg" style="display: flex; justify-content: center;">
      <div class="category-tabs">
        <button class="category-tab active" data-category="all">Tutte (${teams ? teams.length : 0})</button>
        ${TOURNAMENT_CATEGORIES.map(cat => {
          const count = teams ? teams.filter(t => t.category === cat).length : 0;
          return `<button class="category-tab" data-category="${cat}">${cat} (${count})</button>`;
        }).join('')}
      </div>
    </div>
    
    <div class="teams-list grid grid-3">
      ${teams && teams.length > 0 ? teams.map(team => `
        <div class="card admin-team-card" data-category="${team.category || ''}">
          <!-- Card header with logo and info -->
          <div class="admin-team-card-header">
            ${team.logo_url ? `
              <div class="team-logo-container">
                <img src="${team.logo_url}" alt="${team.name}" class="team-logo">
              </div>
            ` : `
              <div class="team-logo-container" style="display: flex; align-items: center; justify-content: center; background: rgba(255,215,0,0.08); border-radius: 12px; width: 80px; height: 80px; margin: 0 auto;">
                <span style="font-size: 2rem; opacity: 0.4;">⚽</span>
              </div>
            `}
            
            <h3 class="text-center mt-md">${team.name}</h3>
            
            <div class="admin-team-card-badges">
              <span class="admin-team-badge admin-team-badge-category">${team.category || 'Nessuna categoria'}</span>
              ${team.team_groups && team.team_groups.length > 0 ? `
                <span class="admin-team-badge admin-team-badge-group">${team.team_groups[0].group.name}</span>
              ` : `
                <span class="admin-team-badge admin-team-badge-nogroup">Nessun girone</span>
              `}
            </div>
          </div>

          <!-- Card actions -->
          <div class="admin-team-card-actions">
            <div class="admin-team-action-row">
              <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.4); margin-bottom: 0.25rem; display: block;">Girone</label>
              <select class="group-select" data-team-id="${team.id}" data-current-group="${team.team_groups[0]?.group.id || ''}">
                <option value="">Cambia girone...</option>
                ${groups ? groups.map(group => `
                  <option value="${group.id}" ${team.team_groups[0]?.group.id === group.id ? 'selected' : ''}>
                    ${group.name}
                  </option>
                `).join('') : ''}
              </select>
            </div>
            <button class="btn-delete-team delete-team-btn" data-team-id="${team.id}" data-team-name="${team.name}" title="Elimina squadra">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <span>Elimina</span>
            </button>
          </div>
        </div>
      `).join('') : '<p class="text-center">Nessuna squadra creata.</p>'}
      <p id="no-teams-msg" class="text-center hidden" style="grid-column: 1 / -1; padding: 2rem; color: rgba(255,255,255,0.6);">
        Nessuna squadra presente in questa categoria.
      </p>
    </div>
  `;

  // Category Filter Tab Handler
  const filterTabs = page.querySelectorAll('.category-tab');
  const teamCards = page.querySelectorAll('.admin-team-card');
  const noTeamsMsg = page.querySelector('#no-teams-msg');

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const selectedCat = tab.dataset.category;
      let visibleCount = 0;

      teamCards.forEach(card => {
        if (selectedCat === 'all' || card.dataset.category === selectedCat) {
          card.style.display = 'flex';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (noTeamsMsg) {
        if (visibleCount === 0) {
          noTeamsMsg.classList.remove('hidden');
        } else {
          noTeamsMsg.classList.add('hidden');
        }
      }
    });
  });

  // Toggle form visibility
  const newTeamBtn = page.querySelector('#new-team-btn');
  const teamForm = page.querySelector('#team-form');
  const cancelBtn = page.querySelector('#cancel-btn');

  newTeamBtn.addEventListener('click', () => {
    teamForm.classList.toggle('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    teamForm.classList.add('hidden');
  });

  // Logo preview
  const logoInput = page.querySelector('#team-logo');
  const logoPreview = page.querySelector('#logo-preview');

  logoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        logoPreview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: contain;">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle category change to filter groups
  const categorySelect = page.querySelector('#team-category');
  const groupSelect = page.querySelector('#team-group');

  categorySelect.addEventListener('change', (e) => {
    const selectedCategory = e.target.value;

    // Reset group select
    groupSelect.innerHTML = '<option value="">Nessun girone (sarà assegnato dopo)</option>';

    if (!selectedCategory) {
      groupSelect.disabled = true;
      return;
    }

    groupSelect.disabled = false;

    // Filter groups by category
    const filteredGroups = groups ? groups.filter(g => g.category === selectedCategory) : [];

    filteredGroups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
  });

  // Handle team creation
  const form = page.querySelector('#create-team-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const teamName = form['team-name'].value;
    const category = form['team-category'].value;
    const groupId = form['team-group'].value;
    const errorDiv = page.querySelector('#form-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      errorDiv.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creazione...';

      let logoUrl = null;

      // Upload logo if provided
      if (logoInput.files[0]) {
        const file = logoInput.files[0];
        const fileName = `${currentSeason.id}-${Date.now()}.${file.name.split('.').pop()}`;
        logoUrl = await uploadFile('team-logos', file, fileName);
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          season_id: currentSeason.id,
          name: teamName,
          category: category,
          logo_url: logoUrl,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Assign to group if selected
      if (groupId) {
        const { error: groupError } = await supabase
          .from('team_groups')
          .insert({
            team_id: team.id,
            group_id: groupId,
          });

        if (groupError) throw groupError;
      }

      // Re-render page
      const newPage = await renderAdminTeamsPage();
      page.replaceWith(newPage);
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Aggiungi Squadra';
    }
  });

  // Handle group changes
  const groupSelects = page.querySelectorAll('.group-select');
  groupSelects.forEach(select => {
    select.addEventListener('change', async (e) => {
      const teamId = e.target.dataset.teamId;
      const currentGroupId = e.target.dataset.currentGroup;
      const newGroupId = e.target.value;

      if (!newGroupId) return;

      try {
        // Remove from current group
        if (currentGroupId) {
          await supabase
            .from('team_groups')
            .delete()
            .eq('team_id', teamId)
            .eq('group_id', currentGroupId);
        }

        // Add to new group
        await supabase
          .from('team_groups')
          .insert({
            team_id: teamId,
            group_id: newGroupId,
          });

        const newPage = await renderAdminTeamsPage();
        page.replaceWith(newPage);
      } catch (error) {
        alert('Errore: ' + error.message);
      }
    });
  });

  // ── DELETE TEAM LOGIC ──────────────────────────────────────────────────────
  const deleteModal = page.querySelector('#delete-modal');
  const deleteTeamNameEl = page.querySelector('#delete-team-name');
  const deleteCancelBtn = page.querySelector('#delete-cancel-btn');
  const deleteConfirmBtn = page.querySelector('#delete-confirm-btn');
  let teamIdToDelete = null;

  // Open modal on delete button click
  const deleteButtons = page.querySelectorAll('.delete-team-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      teamIdToDelete = btn.dataset.teamId;
      const teamName = btn.dataset.teamName;
      deleteTeamNameEl.textContent = `"${teamName}"`;
      deleteModal.style.display = 'flex';
    });
  });

  // Close modal
  deleteCancelBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    teamIdToDelete = null;
  });

  // Close modal on overlay click
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      deleteModal.style.display = 'none';
      teamIdToDelete = null;
    }
  });

  // Confirm deletion
  deleteConfirmBtn.addEventListener('click', async () => {
    if (!teamIdToDelete) return;

    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Eliminazione...';

    try {
      // 1. Remove team_groups associations
      await supabase
        .from('team_groups')
        .delete()
        .eq('team_id', teamIdToDelete);

      // 2. Remove players associated with this team
      await supabase
        .from('players')
        .delete()
        .eq('team_id', teamIdToDelete);

      // 3. Delete the team itself
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamIdToDelete);

      if (error) throw error;

      // Re-render page
      const newPage = await renderAdminTeamsPage();
      page.replaceWith(newPage);
    } catch (error) {
      alert('Errore durante l\'eliminazione: ' + error.message);
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Elimina';
    }
  });

  return page;
}
