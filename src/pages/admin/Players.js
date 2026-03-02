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
        
        <div class="input-group">
          <label for="jersey-number">Numero Maglia</label>
          <input type="number" id="jersey-number" name="jersey-number" min="1" max="99">
        </div>
        
        <div class="input-group">
          <label for="position">Ruolo</label>
          <select id="position" name="position">
            <option value="">Seleziona ruolo...</option>
            <option value="Portiere">Portiere</option>
            <option value="Difensore">Difensore</option>
            <option value="Centrocampista">Centrocampista</option>
            <option value="Attaccante">Attaccante</option>
          </select>
        </div>
        
        <div id="form-error" class="error-message hidden"></div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Aggiungi Giocatore</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annulla</button>
        </div>
      </form>
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
                <div class="player-card">
                  <div class="player-card-header">
                    <div class="player-number-badge">
                      ${player.jersey_number || '-'}
                    </div>
                    <button class="btn-icon btn-danger delete-player-btn" data-player-id="${player.id}" title="Elimina giocatore">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                  <div class="player-card-body">
                    <h4 class="player-fullname">${player.first_name} ${player.last_name}</h4>
                    <span class="player-position">${player.position || 'Nessun ruolo'}</span>
                  </div>
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
      jersey_number: form['jersey-number'].value ? parseInt(form['jersey-number'].value) : null,
      position: form.position.value || null,
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

      window.location.reload();
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Aggiungi Giocatore';
    }
  });

  // Handle player deletion
  const deleteBtns = page.querySelectorAll('.delete-player-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Sei sicuro di voler eliminare questo giocatore?')) return;

      const playerId = e.target.dataset.playerId;

      try {
        const { error } = await supabase
          .from('players')
          .delete()
          .eq('id', playerId);

        if (error) throw error;

        window.location.reload();
      } catch (error) {
        alert('Errore: ' + error.message);
      }
    });
  });

  return page;
}
