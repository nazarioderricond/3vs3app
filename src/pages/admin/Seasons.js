import { supabase, isAdmin } from '../../lib/supabaseClient.js';
import { navigateTo } from '../../application.js';

export async function renderAdminSeasonsPage() {
  if (!isAdmin()) {
    navigateTo('/');
    return document.createElement('div');
  }

  const page = document.createElement('div');
  page.className = 'admin-seasons-page container mt-xl';

  // Get all seasons
  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .order('year', { ascending: false });

  page.innerHTML = `
    <h1 class="text-center mb-xl">Gestione Stagioni</h1>
    
    <div class="admin-actions mb-lg">
      <button class="btn btn-primary" id="new-season-btn">
        ➕ Nuova Stagione
      </button>
    </div>
    
    <div id="season-form" class="glass-card mb-lg hidden">
      <h3 class="mb-md">Crea Nuova Stagione</h3>
      
      <form id="create-season-form">
        <div class="input-group">
          <label for="year">Anno *</label>
          <input type="number" id="year" name="year" min="2020" max="2100" required>
        </div>
        
        <div class="input-group">
          <label for="playoff-phase">Fase Playoff Iniziale *</label>
          <select id="playoff-phase" name="playoff-phase" required>
            <option value="">Seleziona fase...</option>
            <option value="round_16">Ottavi di Finale (16 squadre)</option>
            <option value="quarterfinals">Quarti di Finale (8 squadre)</option>
            <option value="semifinals">Semifinali (4 squadre)</option>
          </select>
        </div>
        
        <div id="form-error" class="error-message hidden"></div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Crea Stagione</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annulla</button>
        </div>
      </form>
    </div>
    
    <div class="seasons-list grid grid-2">
      ${seasons && seasons.length > 0 ? seasons.map(season => `
        <div class="card">
          <div class="season-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Stagione ${season.year}</h3>
            <span class="badge ${season.status === 'active' ? 'badge-admin' : 'badge-user'}">
              ${season.status === 'active' ? 'Attiva' : 'Archiviata'}
            </span>
          </div>
          
          <div class="season-details mt-md">
            <p><strong>Fase Playoff:</strong> ${getPhaseLabel(season.playoff_start_phase)}</p>
          </div>
          
          <div class="season-actions mt-md" style="display: flex; gap: 0.5rem;">
            ${season.status === 'active' ? `
              <button class="btn btn-secondary archive-btn" data-season-id="${season.id}">
                📦 Archivia
              </button>
            ` : `
              <button class="btn btn-secondary activate-btn" data-season-id="${season.id}">
                ✅ Riattiva
              </button>
            `}
          </div>
        </div>
      `).join('') : '<p class="text-center">Nessuna stagione creata.</p>'}
    </div>
  `;

  // Toggle form visibility
  const newSeasonBtn = page.querySelector('#new-season-btn');
  const seasonForm = page.querySelector('#season-form');
  const cancelBtn = page.querySelector('#cancel-btn');

  newSeasonBtn.addEventListener('click', () => {
    seasonForm.classList.toggle('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    seasonForm.classList.add('hidden');
  });

  // Handle form submission
  const form = page.querySelector('#create-season-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      year: parseInt(form.year.value),
      team_count: 0, // Deprecated
      group_count: 0, // Deprecated
      playoff_start_phase: form['playoff-phase'].value,
      status: 'active',
    };

    const errorDiv = page.querySelector('#form-error');

    try {
      errorDiv.classList.add('hidden');

      // Create season
      const { data: season, error } = await supabase
        .from('seasons')
        .insert(formData)
        .select()
        .single();

      if (error) throw error;

      // Re-render page
      const newPage = await renderAdminSeasonsPage();
      page.replaceWith(newPage);
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
    }
  });

  // Handle archive/activate buttons
  const archiveBtns = page.querySelectorAll('.archive-btn');
  const activateBtns = page.querySelectorAll('.activate-btn');

  archiveBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const seasonId = e.target.dataset.seasonId;
      await updateSeasonStatus(seasonId, 'archived');
      const newPage = await renderAdminSeasonsPage();
      page.replaceWith(newPage);
    });
  });

  activateBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const seasonId = e.target.dataset.seasonId;
      await updateSeasonStatus(seasonId, 'active');
      const newPage = await renderAdminSeasonsPage();
      page.replaceWith(newPage);
    });
  });

  return page;
}

async function updateSeasonStatus(seasonId, status) {
  await supabase
    .from('seasons')
    .update({ status })
    .eq('id', seasonId);
}

function getPhaseLabel(phase) {
  const labels = {
    'round_16': 'Ottavi di Finale',
    'quarterfinals': 'Quarti di Finale',
    'semifinals': 'Semifinali',
  };
  return labels[phase] || phase;
}
