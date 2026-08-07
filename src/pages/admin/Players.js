import { supabase, isAdmin } from '../../lib/supabaseClient.js';
import { navigateTo } from '../../application.js';

export async function renderAdminPlayersPage() {
  if (!isAdmin()) {
    navigateTo('/');
    return document.createElement('div');
  }

  const page = document.createElement('div');
  page.className = 'admin-players-page container mt-xl';

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
        <p class="mt-md">Crea una stagione prima di aggiungere giocatori.</p>
        <a href="/admin/seasons" data-link class="btn btn-primary mt-md">Gestione Stagioni</a>
      </div>
    `;
    return page;
  }

  // Get teams with players
  const { data: teams } = await supabase
    .from('teams')
    .select(`
      *,
      players(*)
    `)
    .eq('season_id', currentSeason.id)
    .order('name');

  page.innerHTML = `
    <h1 class="text-center mb-xl">Gestione Giocatori - Stagione ${currentSeason.year}</h1>
    
    <div class="admin-actions mb-lg">
      <button class="btn btn-primary" id="new-player-btn">
        ➕ Nuovo Giocatore
      </button>
    </div>
    
    <div id="player-form" class="glass-card mb-lg hidden">
      <h3 class="mb-md">Aggiungi Giocatore</h3>
      
      <form id="create-player-form">
        <div class="input-group">
          <label for="player-team">Squadra *</label>
          <select id="player-team" name="player-team" required>
            <option value="">Seleziona squadra...</option>
            ${teams ? teams.map(team => `
              <option value="${team.id}">${team.name}</option>
            `).join('') : ''}
          </select>
        </div>
        
        <div class="input-group">
          <label for="first-name">Nome *</label>
          <input type="text" id="first-name" name="first-name" required>
        </div>
        
        <div class="input-group">
          <label for="last-name">Cognome *</label>
          <input type="text" id="last-name" name="last-name" required>
        </div>
        
        <div id="form-error" class="error-message hidden"></div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Aggiungi Giocatore</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annulla</button>
        </div>
      </form>
    </div>
    
    <!-- Delete confirmation modal -->
    <div id="delete-player-modal" class="admin-modal-overlay" style="display: none;">
      <div class="admin-modal-card glass-card">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <h3 style="color: var(--color-yellow); margin-bottom: 0.5rem;">Eliminare questo giocatore?</h3>
          <p id="delete-player-name-text" style="color: rgba(255,255,255,0.7); font-size: 0.95rem;"></p>
        </div>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; text-align: center; margin-bottom: 1.25rem;">
          Questa azione è irreversibile. Verranno rimossi anche gli eventuali gol registrati per questo giocatore.
        </p>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-secondary" id="delete-player-cancel-btn" style="flex: 1;">Annulla</button>
          <button class="btn" id="delete-player-confirm-btn" style="flex: 1; background: #dc2626; border-color: #991b1b; color: white; font-weight: 700;">Elimina</button>
        </div>
      </div>
    </div>

    <div class="teams-players-list">
      ${teams && teams.length > 0 ? teams.map(team => `
        <div class="glass-card mb-lg">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
            ${team.logo_url ? `
              <img src="${team.logo_url}" alt="${team.name}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 50%; border: 2px solid var(--color-yellow);">
            ` : ''}
            <h3>${team.name}</h3>
          </div>
          
          ${team.players && team.players.length > 0 ? `
            <div class="players-grid">
              ${team.players.map(player => `
                <div class="player-card" style="display: flex; align-items: center; justify-content: space-between; flex-direction: row; padding: 0.85rem 1rem;">
                  <div class="player-card-body" style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.1rem;">👤</span>
                    <h4 class="player-fullname" style="font-size: 1.05rem; margin: 0;">${player.first_name} ${player.last_name}</h4>
                  </div>
                  <button class="btn-icon btn-danger delete-player-btn" data-player-id="${player.id}" data-player-name="${player.first_name} ${player.last_name}" title="Elimina giocatore">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="opacity: 0.7; text-align: center; padding: 1rem;">
              Nessun giocatore registrato
            </p>
          `}
        </div>
      `).join('') : '<p class="text-center">Nessuna squadra creata.</p>'}
    </div>
  `;

  // Toggle form visibility
  const newPlayerBtn = page.querySelector('#new-player-btn');
  const playerForm = page.querySelector('#player-form');
  const cancelBtn = page.querySelector('#cancel-btn');

  newPlayerBtn.addEventListener('click', () => {
    playerForm.classList.toggle('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    playerForm.classList.add('hidden');
  });

  // Handle player creation
  const form = page.querySelector('#create-player-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      team_id: form['player-team'].value,
      first_name: form['first-name'].value,
      last_name: form['last-name'].value,
    };

    const errorDiv = page.querySelector('#form-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      errorDiv.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Aggiunta...';

      const { error } = await supabase
        .from('players')
        .insert(formData);

      if (error) throw error;

      const newPage = await renderAdminPlayersPage();
      page.replaceWith(newPage);
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Aggiungi Giocatore';
    }
  });

  // ── DELETE PLAYER LOGIC ────────────────────────────────────────────────────
  const deletePlayerModal = page.querySelector('#delete-player-modal');
  const deletePlayerNameText = page.querySelector('#delete-player-name-text');
  const deletePlayerCancelBtn = page.querySelector('#delete-player-cancel-btn');
  const deletePlayerConfirmBtn = page.querySelector('#delete-player-confirm-btn');
  let playerIdToDelete = null;

  // Open delete modal
  const deleteBtns = page.querySelectorAll('.delete-player-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const button = e.target.closest('.delete-player-btn');
      if (!button) return;
      playerIdToDelete = button.dataset.playerId;
      const playerName = button.dataset.playerName;

      deletePlayerNameText.textContent = `"${playerName}"`;
      deletePlayerModal.style.display = 'flex';
    });
  });

  // Close modal on cancel
  deletePlayerCancelBtn.addEventListener('click', () => {
    deletePlayerModal.style.display = 'none';
    playerIdToDelete = null;
  });

  // Close modal on overlay click
  deletePlayerModal.addEventListener('click', (e) => {
    if (e.target === deletePlayerModal) {
      deletePlayerModal.style.display = 'none';
      playerIdToDelete = null;
    }
  });

  // Confirm delete action
  deletePlayerConfirmBtn.addEventListener('click', async () => {
    if (!playerIdToDelete) return;

    deletePlayerConfirmBtn.disabled = true;
    deletePlayerConfirmBtn.textContent = 'Eliminazione...';

    try {
      // 1. Delete associated match scorers records first (to prevent FK constraint failure)
      await supabase
        .from('match_scorers')
        .delete()
        .eq('player_id', playerIdToDelete);

      // 2. Delete the player
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerIdToDelete);

      if (error) throw error;

      // Re-render page smoothly without full page refresh
      const newPage = await renderAdminPlayersPage();
      page.replaceWith(newPage);
    } catch (error) {
      alert('Errore durante l\'eliminazione: ' + error.message);
      deletePlayerConfirmBtn.disabled = false;
      deletePlayerConfirmBtn.textContent = 'Elimina';
    }
  });

  return page;
}
