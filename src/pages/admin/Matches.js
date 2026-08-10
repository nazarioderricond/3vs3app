import { supabase, isAdmin } from '../../lib/supabaseClient.js';
import { navigateTo } from '../../application.js';
import { TOURNAMENT_CATEGORIES, PHASE_LABELS, formatPhase } from '../../lib/constants.js';

export async function renderAdminMatchesPage() {
  if (!isAdmin()) {
    navigateTo('/');
    return document.createElement('div');
  }

  const page = document.createElement('div');
  page.className = 'admin-matches-page container mt-xl';

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
        <p class="mt-md">Crea una stagione prima di gestire le partite.</p>
        <a href="/admin/seasons" data-link class="btn btn-primary mt-md">Gestione Stagioni</a>
      </div>
    `;
    return page;
  }

  // Fetch groups for group select
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .eq('season_id', currentSeason.id);

  // Fetch all teams for team select
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('season_id', currentSeason.id)
    .order('name');

  // Get existing matches with scorers
  let { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      group:groups(name),
      match_scorers(*, player:players(first_name, last_name))
    `)
    .eq('season_id', currentSeason.id)
    .order('match_date', { ascending: true });

  page.innerHTML = `
    <h1 class="text-center mb-xl">Gestione Partite - Stagione ${currentSeason.year}</h1>
    
    <div class="admin-actions mb-lg">
      <button class="btn btn-primary" id="new-match-btn">
        ➕ Nuova Partita
      </button>
    </div>
    
    <div id="match-form" class="glass-card mb-lg hidden">
      <h3 class="mb-md">Inserisci Partita</h3>
      
      <form id="create-match-form">
        <div class="input-group mb-md">
          <label for="match-category">Categoria *</label>
          <select id="match-category" name="match-category" required>
            <option value="">Seleziona categoria...</option>
            ${TOURNAMENT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
        </div>

        <div class="grid grid-2">
          <div class="input-group">
            <label for="home-team">Squadra Casa *</label>
            <select id="home-team" name="home-team" required disabled>
              <option value="">Seleziona prima una categoria</option>
            </select>
            <input type="text" id="home-team-custom" name="home-team-custom" placeholder="es. 1ª Classificata Girone A" class="hidden mt-xs" style="width: 100%; border: 1px solid var(--color-yellow);">
          </div>
          
          <div class="input-group">
            <label for="away-team">Squadra Ospite *</label>
            <select id="away-team" name="away-team" required disabled>
              <option value="">Seleziona prima una categoria</option>
            </select>
            <input type="text" id="away-team-custom" name="away-team-custom" placeholder="es. 2ª Classificata Girone B" class="hidden mt-xs" style="width: 100%; border: 1px solid var(--color-yellow);">
          </div>
        </div>

        <div class="grid grid-2">
           <div class="input-group">
            <label for="match-date">Data e Ora</label>
            <input type="datetime-local" id="match-date" name="match-date">
          </div>
          
          <div class="input-group">
            <label for="phase">Fase *</label>
            <select id="phase" name="phase" required>
              <option value="group_stage">Fase a Gironi</option>
              <option value="round_16">Ottavi di Finale</option>
              <option value="quarterfinals">Quarti di Finale</option>
              <option value="semifinals">Semifinali</option>
              <option value="final">Finale 1°/2° Posto</option>
              <option value="final_3rd">Finale 3° Posto</option>
              <option value="final_4th">Finale 4° Posto</option>
              <option value="final_5th">Finale 5° Posto</option>
              <option value="final_6th">Finale 6° Posto</option>
              <option value="final_7th">Finale 7° Posto</option>
            </select>
          </div>
        </div>
        
        <div class="input-group" id="group-select-container">
            <label for="group-id">Girone (opzionale)</label>
            <select id="group-id" name="group-id" disabled>
              <option value="">Seleziona prima una categoria</option>
            </select>
        </div>
        
        <div class="grid grid-3">
          <div class="input-group">
            <label for="home-score">Gol Casa</label>
            <input type="number" id="home-score" name="home-score" min="0">
          </div>
          
          <div class="input-group">
            <label for="away-score">Gol Ospite</label>
            <input type="number" id="away-score" name="away-score" min="0">
          </div>

          <div class="input-group">
            <label for="match-status">Stato Partita</label>
            <select id="match-status" name="match-status">
              <option value="scheduled">Programmata</option>
              <option value="live">🔴 In Corso (LIVE)</option>
              <option value="completed">Terminata</option>
            </select>
          </div>
        </div>

        <div id="scorers-container" class="mt-md"></div>
        
        <div id="form-error" class="error-message hidden"></div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Salva Partita</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annulla</button>
        </div>
      </form>
    </div>
    
    <div class="matches-list">
      ${renderMatchesHTML(matches)}
    </div>
  `;

  // Toggle form
  const newMatchBtn = page.querySelector('#new-match-btn');
  const matchForm = page.querySelector('#match-form');
  const cancelBtn = page.querySelector('#cancel-btn');
  const form = page.querySelector('#create-match-form');

  // State for editing
  let editingMatchId = null;

  newMatchBtn.addEventListener('click', () => {
    editingMatchId = null;
    form.reset();
    homeSelect.disabled = true;
    awaySelect.disabled = true;
    groupSelect.disabled = true;
    homeSelect.innerHTML = '<option value="">Seleziona prima una categoria</option>';
    awaySelect.innerHTML = '<option value="">Seleziona prima una categoria</option>';
    groupSelect.innerHTML = '<option value="">Seleziona prima una categoria</option>';
    document.getElementById('scorers-container').innerHTML = '';
    matchForm.classList.remove('hidden');
    page.querySelector('h3').textContent = 'Inserisci Partita';
  });

  cancelBtn.addEventListener('click', () => {
    matchForm.classList.add('hidden');
    editingMatchId = null;
    form.reset();
  });

  // Fetch players for scorer selection
  async function getTeamPlayers(teamId) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('last_name');
    return data || [];
  }

  async function renderScorerInputs(homeTeamId, awayTeamId, matchId = null) {
    const homePlayers = await getTeamPlayers(homeTeamId);
    const awayPlayers = await getTeamPlayers(awayTeamId);

    let existingScorers = [];
    if (matchId) {
      const { data } = await supabase
        .from('match_scorers')
        .select('*')
        .eq('match_id', matchId);
      existingScorers = data || [];
    }

    const container = document.getElementById('scorers-container');
    container.innerHTML = `
      <h4 class="mb-sm mt-md border-bottom-yellow pb-xs">Marcatori Partita</h4>
      <div class="grid grid-2" style="gap: 1.5rem;">
        <div class="home-scorers">
          <div class="flex items-center justify-between mb-sm">
            <h5 class="text-yellow font-bold" style="margin: 0;">Casa</h5>
            <span id="home-scorers-badge" class="scorer-badge-counter">0 gol</span>
          </div>
          <div id="home-scorers-list"></div>
          <button type="button" class="btn-small btn-secondary mt-sm w-full" id="add-home-scorer" style="min-height: 44px; font-weight: 600;">+ Aggiungi Marcatore Casa</button>
        </div>
        <div class="away-scorers">
          <div class="flex items-center justify-between mb-sm">
            <h5 class="text-yellow font-bold" style="margin: 0;">Ospite</h5>
            <span id="away-scorers-badge" class="scorer-badge-counter">0 gol</span>
          </div>
          <div id="away-scorers-list"></div>
          <button type="button" class="btn-small btn-secondary mt-sm w-full" id="add-away-scorer" style="min-height: 44px; font-weight: 600;">+ Aggiungi Marcatore Ospite</button>
        </div>
      </div>
    `;

    const updateScorerCounters = () => {
      const homeScoreVal = form['home-score'].value !== '' ? parseInt(form['home-score'].value) : null;
      const awayScoreVal = form['away-score'].value !== '' ? parseInt(form['away-score'].value) : null;

      let sumHome = 0;
      document.querySelectorAll('#home-scorers-list .scorer-row').forEach(row => {
        const sel = row.querySelector('.scorer-select');
        const input = row.querySelector('.scorer-goals-input');
        if (sel && sel.value && input) {
          sumHome += (parseInt(input.value) || 0);
        }
      });

      let sumAway = 0;
      document.querySelectorAll('#away-scorers-list .scorer-row').forEach(row => {
        const sel = row.querySelector('.scorer-select');
        const input = row.querySelector('.scorer-goals-input');
        if (sel && sel.value && input) {
          sumAway += (parseInt(input.value) || 0);
        }
      });

      const homeBadge = document.getElementById('home-scorers-badge');
      const awayBadge = document.getElementById('away-scorers-badge');

      if (homeBadge) {
        if (homeScoreVal !== null) {
          const isError = sumHome > homeScoreVal;
          homeBadge.textContent = `${sumHome}/${homeScoreVal} gol`;
          homeBadge.style.background = isError ? '#d32f2f' : (sumHome === homeScoreVal ? '#2e7d32' : 'rgba(255, 215, 0, 0.2)');
          homeBadge.style.color = isError ? '#fff' : (sumHome === homeScoreVal ? '#fff' : 'var(--color-yellow)');
          if (isError) homeBadge.textContent += ' ⚠️ Troppi';
        } else {
          homeBadge.textContent = `${sumHome} gol`;
          homeBadge.style.background = 'rgba(255, 255, 255, 0.1)';
          homeBadge.style.color = 'var(--color-white)';
        }
      }

      if (awayBadge) {
        if (awayScoreVal !== null) {
          const isError = sumAway > awayScoreVal;
          awayBadge.textContent = `${sumAway}/${awayScoreVal} gol`;
          awayBadge.style.background = isError ? '#d32f2f' : (sumAway === awayScoreVal ? '#2e7d32' : 'rgba(255, 215, 0, 0.2)');
          awayBadge.style.color = isError ? '#fff' : (sumAway === awayScoreVal ? '#fff' : 'var(--color-yellow)');
          if (isError) awayBadge.textContent += ' ⚠️ Troppi';
        } else {
          awayBadge.textContent = `${sumAway} gol`;
          awayBadge.style.background = 'rgba(255, 255, 255, 0.1)';
          awayBadge.style.color = 'var(--color-white)';
        }
      }
    };

    const addScorerRow = (teamType, players, scorer = null) => {
      const listId = teamType === 'home' ? 'home-scorers-list' : 'away-scorers-list';
      const list = document.getElementById(listId);
      const div = document.createElement('div');
      div.className = 'scorer-row glass-card p-sm mb-sm flex flex-col gap-sm';
      div.style.background = 'rgba(0, 0, 0, 0.4)';
      div.style.border = '1px solid rgba(255, 215, 0, 0.2)';
      div.style.borderRadius = 'var(--radius-md)';

      div.innerHTML = `
        <div class="flex items-center justify-between gap-sm">
          <select name="scorer-${teamType}" class="scorer-select flex-1">
            <option value="">Seleziona giocatore...</option>
            <option value="autogol" ${scorer && !scorer.player_id ? 'selected' : ''}>⚽ Autogol</option>
            ${players.map(p => `<option value="${p.id}" ${scorer && scorer.player_id === p.id ? 'selected' : ''}>${p.last_name} ${p.first_name}</option>`).join('')}
          </select>
          <button type="button" class="btn-icon btn-danger remove-scorer" title="Rimuovi marcatore" style="min-width: 44px; min-height: 44px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border-radius: var(--radius-md); flex-shrink: 0;">
            🗑️
          </button>
        </div>
        
        <div class="flex items-center justify-between gap-sm pt-xs" style="border-top: 1px solid rgba(255,255,255,0.08);">
          <span class="text-sm font-bold text-muted">Gol assegnati:</span>
          <div class="scorer-stepper flex items-center gap-xs">
            <button type="button" class="btn-stepper btn-minus" style="min-width: 40px; min-height: 40px; font-weight: bold; font-size: 1.2rem; background: rgba(255,255,255,0.1); color: var(--color-white); border: 1px solid rgba(255,255,255,0.2); border-radius: var(--radius-sm); cursor: pointer;">-</button>
            <input type="number" name="goals-${teamType}" class="scorer-goals-input text-center" value="${scorer ? scorer.goals : 1}" min="1" max="99" style="width: 50px; min-height: 40px; font-weight: bold; font-size: 1.1rem; border-radius: var(--radius-sm); border: 1px solid rgba(255,215,0,0.4); background: rgba(0,0,0,0.6); color: var(--color-yellow); text-align: center;">
            <button type="button" class="btn-stepper btn-plus" style="min-width: 40px; min-height: 40px; font-weight: bold; font-size: 1.2rem; background: rgba(255,215,0,0.2); color: var(--color-yellow); border: 1px solid rgba(255,215,0,0.4); border-radius: var(--radius-sm); cursor: pointer;">+</button>
          </div>
        </div>
      `;

      const input = div.querySelector('.scorer-goals-input');
      const btnMinus = div.querySelector('.btn-minus');
      const btnPlus = div.querySelector('.btn-plus');
      const select = div.querySelector('.scorer-select');

      btnMinus.addEventListener('click', (e) => {
        e.preventDefault();
        let val = parseInt(input.value || 1);
        if (val > 1) {
          input.value = val - 1;
          updateScorerCounters();
        }
      });

      btnPlus.addEventListener('click', (e) => {
        e.preventDefault();
        let val = parseInt(input.value || 1);
        input.value = val + 1;
        updateScorerCounters();
      });

      input.addEventListener('input', () => updateScorerCounters());
      select.addEventListener('change', () => updateScorerCounters());

      div.querySelector('.remove-scorer').addEventListener('click', (e) => {
        e.preventDefault();
        div.remove();
        updateScorerCounters();
      });

      list.appendChild(div);
      updateScorerCounters();
    };

    existingScorers.filter(s => s.team_id === homeTeamId).forEach(s => addScorerRow('home', homePlayers, s));
    existingScorers.filter(s => s.team_id === awayTeamId).forEach(s => addScorerRow('away', awayPlayers, s));

    document.getElementById('add-home-scorer').addEventListener('click', () => addScorerRow('home', homePlayers));
    document.getElementById('add-away-scorer').addEventListener('click', () => addScorerRow('away', awayPlayers));

    const homeScoreInput = form['home-score'];
    const awayScoreInput = form['away-score'];
    if (homeScoreInput) homeScoreInput.addEventListener('input', updateScorerCounters);
    if (awayScoreInput) awayScoreInput.addEventListener('input', updateScorerCounters);

    updateScorerCounters();
  }

  const categorySelect = page.querySelector('#match-category');
  const homeSelect = page.querySelector('#home-team');
  const awaySelect = page.querySelector('#away-team');
  const groupSelect = page.querySelector('#group-id');

  categorySelect.addEventListener('change', (e) => {
    const selectedCategory = e.target.value;

    if (!selectedCategory) {
      homeSelect.disabled = true;
      awaySelect.disabled = true;
      groupSelect.disabled = true;
      homeSelect.innerHTML = '<option value="">Seleziona prima una categoria</option>';
      awaySelect.innerHTML = '<option value="">Seleziona prima una categoria</option>';
      groupSelect.innerHTML = '<option value="">Seleziona prima una categoria</option>';
      document.getElementById('scorers-container').innerHTML = '';
      return;
    }

    homeSelect.disabled = false;
    awaySelect.disabled = false;
    groupSelect.disabled = false;

    const availableTeams = teams ? teams.filter(t => t.category === selectedCategory) : [];
    homeSelect.innerHTML = `<option value="">Seleziona Squadra Casa...</option>` +
      `<option value="custom">✏️ Inserisci descrizione libera...</option>` +
      availableTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    awaySelect.innerHTML = `<option value="">Seleziona Squadra Ospite...</option>` +
      `<option value="custom">✏️ Inserisci descrizione libera...</option>` +
      availableTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    const availableGroups = groups ? groups.filter(g => g.category === selectedCategory) : [];
    groupSelect.innerHTML = `<option value="">Fase Finale / Nessun Girone</option>` +
      availableGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    document.getElementById('scorers-container').innerHTML = '';
  });

  const homeCustomInput = page.querySelector('#home-team-custom');
  const awayCustomInput = page.querySelector('#away-team-custom');

  homeSelect.addEventListener('change', () => {
    if (homeSelect.value === 'custom') {
      homeCustomInput.classList.remove('hidden');
      homeCustomInput.required = true;
    } else {
      homeCustomInput.classList.add('hidden');
      homeCustomInput.required = false;
      homeCustomInput.value = '';
    }
  });

  awaySelect.addEventListener('change', () => {
    if (awaySelect.value === 'custom') {
      awayCustomInput.classList.remove('hidden');
      awayCustomInput.required = true;
    } else {
      awayCustomInput.classList.add('hidden');
      awayCustomInput.required = false;
      awayCustomInput.value = '';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusSelect = form['match-status'];
    const homeScoreInput = form['home-score'];
    const awayScoreInput = form['away-score'];
    const homeScoreVal = (homeScoreInput && homeScoreInput.value !== '') ? parseInt(homeScoreInput.value) : null;
    const awayScoreVal = (awayScoreInput && awayScoreInput.value !== '') ? parseInt(awayScoreInput.value) : null;

    let selectedStatus = statusSelect ? statusSelect.value : 'scheduled';
    if (selectedStatus === 'scheduled' && (homeScoreVal !== null || awayScoreVal !== null)) {
      selectedStatus = 'completed';
    }

    const categorySelect = form['match-category'];
    const dateInput = form['match-date'];
    const phaseSelect = form['phase'] || form['match-phase'];
    const groupSelect = form['group-id'];

    const selectedCategory = categorySelect ? categorySelect.value : '';

    const errorDiv = page.querySelector('#form-error');

    try {
      // Helper to get or create custom team placeholder
      async function resolveTeamId(selectElem, customElem) {
        if (selectElem.value === 'custom') {
          const customName = customElem.value.trim();
          if (!customName) throw new Error('Inserisci il nome/descrizione per la squadra');

          const existing = teams.find(t => t.category === selectedCategory && t.name.toLowerCase() === customName.toLowerCase());
          if (existing) return existing.id;

          const { data: newTeam, error: createError } = await supabase
            .from('teams')
            .insert({ season_id: currentSeason.id, name: customName, category: selectedCategory })
            .select()
            .single();

          if (createError) throw new Error('Errore creazione squadra: ' + createError.message);
          teams.push(newTeam);
          return newTeam.id;
        }
        return selectElem.value;
      }

      const homeTeamId = await resolveTeamId(homeSelect, homeCustomInput);
      const awayTeamId = await resolveTeamId(awaySelect, awayCustomInput);

      const finalSubPhases = {
        'final_3rd': 'Finale 3° Posto',
        'final_4th': 'Finale 4° Posto',
        'final_5th': 'Finale 5° Posto',
        'final_6th': 'Finale 6° Posto',
        'final_7th': 'Finale 7° Posto'
      };

      let targetPhase = phaseSelect ? phaseSelect.value : 'group_stage';
      let targetGroupId = (groupSelect && groupSelect.value) ? groupSelect.value : null;

      if (finalSubPhases[targetPhase]) {
        const groupName = finalSubPhases[targetPhase];
        targetPhase = 'final';

        let subGroup = groups ? groups.find(g => g.category === selectedCategory && g.name.toLowerCase() === groupName.toLowerCase()) : null;
        if (!subGroup) {
          const { data: newGrp, error: grpErr } = await supabase
            .from('groups')
            .insert({ season_id: currentSeason.id, name: groupName, category: selectedCategory })
            .select()
            .single();
          if (!grpErr && newGrp) {
            subGroup = newGrp;
            if (groups) groups.push(newGrp);
          }
        }
        if (subGroup) {
          targetGroupId = subGroup.id;
        }
      }

      const formData = {
        season_id: currentSeason.id,
        category: selectedCategory,
        match_date: (dateInput && dateInput.value) ? new Date(dateInput.value).toISOString() : null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        phase: targetPhase,
        group_id: targetGroupId,
        home_score: homeScoreVal,
        away_score: awayScoreVal,
        status: selectedStatus
      };

      if (formData.home_team_id === formData.away_team_id) {
        throw new Error('Una squadra non può giocare contro se stessa');
      }

      let totalHomeScorerGoals = 0;
      let totalAwayScorerGoals = 0;

      const homeScorerSelects = document.querySelectorAll('select[name="scorer-home"]');
      homeScorerSelects.forEach((select) => {
        if (select.value) {
          const row = select.closest('.scorer-row');
          const goalInput = row ? row.querySelector('.scorer-goals-input') : null;
          totalHomeScorerGoals += (goalInput ? parseInt(goalInput.value) || 0 : 0);
        }
      });

      const awayScorerSelects = document.querySelectorAll('select[name="scorer-away"]');
      awayScorerSelects.forEach((select) => {
        if (select.value) {
          const row = select.closest('.scorer-row');
          const goalInput = row ? row.querySelector('.scorer-goals-input') : null;
          totalAwayScorerGoals += (goalInput ? parseInt(goalInput.value) || 0 : 0);
        }
      });

      if (formData.home_score !== null && totalHomeScorerGoals > formData.home_score) {
        throw new Error(`I gol assegnati ai marcatori Casa (${totalHomeScorerGoals}) superano il risultato inserito (${formData.home_score})`);
      }

      if (formData.away_score !== null && totalAwayScorerGoals > formData.away_score) {
        throw new Error(`I gol assegnati ai marcatori Ospite (${totalAwayScorerGoals}) superano il risultato inserito (${formData.away_score})`);
      }

      let matchId = editingMatchId;
      let error;

      if (editingMatchId) {
        const { error: updateError } = await supabase
          .from('matches')
          .update(formData)
          .eq('id', editingMatchId);
        error = updateError;
      } else {
        const { data: newMatch, error: insertError } = await supabase
          .from('matches')
          .insert(formData)
          .select()
          .single();
        error = insertError;
        if (newMatch) matchId = newMatch.id;
      }

      if (error) throw error;

      if (matchId) {
        await supabase.from('match_scorers').delete().eq('match_id', matchId);

        const scorersToInsert = [];

        homeScorerSelects.forEach((select) => {
          if (select.value) {
            const row = select.closest('.scorer-row');
            const goalInput = row ? row.querySelector('.scorer-goals-input') : null;
            const goals = goalInput ? parseInt(goalInput.value) || 1 : 1;
            scorersToInsert.push({
              match_id: matchId,
              team_id: formData.home_team_id,
              player_id: select.value === 'autogol' ? null : select.value,
              goals: goals
            });
          }
        });

        awayScorerSelects.forEach((select) => {
          if (select.value) {
            const row = select.closest('.scorer-row');
            const goalInput = row ? row.querySelector('.scorer-goals-input') : null;
            const goals = goalInput ? parseInt(goalInput.value) || 1 : 1;
            scorersToInsert.push({
              match_id: matchId,
              team_id: formData.away_team_id,
              player_id: select.value === 'autogol' ? null : select.value,
              goals: goals
            });
          }
        });

        if (scorersToInsert.length > 0) {
          const { error: scorersError } = await supabase.from('match_scorers').insert(scorersToInsert);
          if (scorersError) throw scorersError;
        }
      }

      const newPage = await renderAdminMatchesPage();
      page.replaceWith(newPage);
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove('hidden');
    }
  });

  // Trigger scorer rendering when teams change or on edit
  const updateScorersUI = () => {
    const homeId = form['home-team'].value;
    const awayId = form['away-team'].value;
    if (homeId && awayId) {
      renderScorerInputs(homeId, awayId, editingMatchId);
    } else {
      document.getElementById('scorers-container').innerHTML = '';
    }
  };

  form['home-team'].addEventListener('change', updateScorersUI);
  form['away-team'].addEventListener('change', updateScorersUI);

  // Status Change Handlers
  const updateMatchStatus = async (id, status) => {
    console.log(`Attempting to update match ${id} to status: ${status}`);
    if (!confirm(`Sei sicuro di voler cambiare lo stato in "${status}"?`)) return;

    try {
      const { data, error } = await supabase
        .from('matches')
        .update({ status })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        alert('Errore aggiornamento stato: ' + error.message);
      } else {
        console.log('Update successful:', data);
        renderMatchesList();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Errore imprevisto: ' + err.message);
    }
  };

  // Score Update Handler
  const updateScore = async (matchId, team, delta) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    let currentScore = team === 'home' ? (match.home_score || 0) : (match.away_score || 0);
    let newScore = currentScore + parseInt(delta);
    if (newScore < 0) newScore = 0;

    console.log(`Updating score for match ${matchId} (${team}): ${currentScore} -> ${newScore}`);

    const updateData = team === 'home' ? { home_score: newScore } : { away_score: newScore };

    try {
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

      if (error) {
        console.error('Error updating score:', error);
        alert('Errore aggiornamento punteggio');
      } else {
        renderMatchesList();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  // Render Matches List Function
  const renderMatchesList = async () => {
    console.log('Refreshing matches list...');
    const { data: latestMatches, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name),
        group:groups(name)
      `)
      .eq('season_id', currentSeason.id)
      .order('match_date', { ascending: true });

    if (error) {
      console.error('Error fetching matches:', error);
      return;
    }

    if (latestMatches) {
      matches = latestMatches;
    }

    const listContainer = page.querySelector('.matches-list');
    if (listContainer && latestMatches) {
      listContainer.innerHTML = renderMatchesHTML(latestMatches);
    }
  };

  // Event Delegation for Match Actions
  const matchesList = page.querySelector('.matches-list');
  if (matchesList) {
    matchesList.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        e.preventDefault();
      }

      const target = e.target;
      console.log('Click detected on:', target);

      // Handle Score Update
      if (target.closest('.score-btn')) {
        const btn = target.closest('.score-btn');
        updateScore(btn.dataset.id, btn.dataset.team, btn.dataset.delta);
      }

      // Handle Start
      else if (target.closest('.start-match-btn')) {
        const btn = target.closest('.start-match-btn');
        updateMatchStatus(btn.dataset.id, 'live');
      }

      // Handle End
      else if (target.closest('.end-match-btn')) {
        const btn = target.closest('.end-match-btn');
        updateMatchStatus(btn.dataset.id, 'completed');
      }

      // Handle Reopen
      else if (target.closest('.reopen-match-btn')) {
        const btn = target.closest('.reopen-match-btn');
        updateMatchStatus(btn.dataset.id, 'live');
      }

      // Handle Delete
      else if (target.closest('.delete-match-btn')) {
        const btn = target.closest('.delete-match-btn');
        const id = btn.dataset.id;
        if (confirm('Sei sicuro di voler eliminare questa partita?')) {
          supabase.from('matches').delete().eq('id', id).then(({ error }) => {
            if (error) alert('Errore eliminazione: ' + error.message);
            else renderMatchesList();
          });
        }
      }

      // Handle Edit
      else if (target.closest('.edit-match-btn')) {
        const btn = target.closest('.edit-match-btn');
        const data = btn.dataset;
        editingMatchId = data.id;

        const matchCategory = data.category || (teams.find(t => t.id === data.home)?.category);

        if (matchCategory) {
          form['match-category'].value = matchCategory;
          categorySelect.dispatchEvent(new Event('change'));
        }

        form['home-team'].value = data.home;
        form['away-team'].value = data.away;
        form['home-score'].value = data.homescore;
        form['away-score'].value = data.awayscore;

        let phaseVal = data.phase || 'group_stage';
        const groupName = data.groupname || (groups ? groups.find(g => g.id === data.group)?.name : '');

        if (phaseVal === 'final' && groupName) {
          const nameLower = groupName.toLowerCase();
          if (nameLower.includes('7°') || nameLower.includes('7 posto')) phaseVal = 'final_7th';
          else if (nameLower.includes('6°') || nameLower.includes('6 posto')) phaseVal = 'final_6th';
          else if (nameLower.includes('5°') || nameLower.includes('5 posto')) phaseVal = 'final_5th';
          else if (nameLower.includes('4°') || nameLower.includes('4 posto')) phaseVal = 'final_4th';
          else if (nameLower.includes('3°') || nameLower.includes('3 posto')) phaseVal = 'final_3rd';
        }

        form['phase'].value = phaseVal;
        form['group-id'].value = data.group;

        if (form['match-status']) {
          form['match-status'].value = data.status || 'scheduled';
        }

        if (data.date) {
          form['match-date'].value = formatForDateTimeInput(data.date);
        } else {
          form['match-date'].value = '';
        }

        page.querySelector('h3').textContent = 'Modifica Partita';
        matchForm.classList.remove('hidden');
        matchForm.scrollIntoView({ behavior: 'smooth' });

        renderScorerInputs(data.home, data.away, editingMatchId);
      }
    });
  }

  // Realtime Subscription
  supabase.removeChannel(supabase.channel('admin-matches'));

  const subscription = supabase
    .channel('admin-matches')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, payload => {
      console.log('Admin Matches Page - update received:', payload);
      renderMatchesList();
    })
    .subscribe();

  return page;
}

function renderMatchesHTML(matches) {
  if (!matches || matches.length === 0) {
    return '<p class="text-center">Nessuna partita programmata.</p>';
  }

  // Group matches by date
  const matchesByDate = {};
  matches.forEach(match => {
    let dateKey = 'Data da definire';
    let sortDate = '9999-99-99';

    if (match.match_date) {
      const date = new Date(match.match_date);
      dateKey = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      sortDate = `${year}-${month}-${day}`;
    }

    if (!matchesByDate[sortDate]) {
      matchesByDate[sortDate] = {
        title: dateKey,
        matches: []
      };
    }
    matchesByDate[sortDate].matches.push(match);
  });

  const sortedDates = Object.keys(matchesByDate).sort();

  return sortedDates.map(dateKey => {
    const group = matchesByDate[dateKey];
    return `
      <div class="match-group mb-lg">
        <h3 class="sticky-header mb-md" style="
            color: var(--color-black); 
            background: var(--color-white); 
            padding: 0.5rem 1rem; 
            border-radius: 50px; 
            display: inline-block; 
            font-size: 1rem; 
            font-weight: 700;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            position: sticky;
            top: 10px;
            z-index: 10;
        ">
          ${group.title}
        </h3>
        
        <div class="grid grid-1 gap-md">
          ${group.matches.map(match => {
            const homeScorers = match.match_scorers?.filter(s => String(s.team_id) === String(match.home_team_id)) || [];
            const awayScorers = match.match_scorers?.filter(s => String(s.team_id) === String(match.away_team_id)) || [];
            const hasScorers = homeScorers.length > 0 || awayScorers.length > 0;

            return `
            <div class="glass-card match-card" style="border-left: 5px solid ${getStatusColor(match.status)};">
              <div class="match-header" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem; opacity: 0.8;">
                <span>${match.phase === 'group_stage' ? (match.group?.name || 'Gironi') : formatPhase(match.phase)}</span>
                <span>${match.match_date ? new Date(match.match_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                <span class="status-badge ${match.status === 'live' ? 'live-pulse' : ''}" style="color: ${getStatusColor(match.status)}; font-weight: bold; text-transform: uppercase;">
                  ${match.status === 'live' ? '🔴 LIVE' : (match.status === 'completed' ? 'Terminata' : 'Programmata')}
                </span>
              </div>
              
              <div class="match-content" style="display: flex; align-items: center; justify-content: space-between;">
                <div class="team-home" style="flex: 1; text-align: right; font-weight: bold;">
                  ${match.home_team?.name || 'TBD'}
                </div>
                
                <a href="/match/${match.id}" style="text-decoration: none;" title="Vedi dettaglio partita">
                  <div class="match-score" style="padding: 0 1rem; font-family: var(--font-display); font-size: 1.5rem; color: var(--color-yellow);">
                    ${match.home_score !== null ? match.home_score : '-'} : ${match.away_score !== null ? match.away_score : '-'}
                  </div>
                </a>
                
                <div class="team-away" style="flex: 1; text-align: left; font-weight: bold;">
                  ${match.away_team?.name || 'TBD'}
                </div>
              </div>

              ${hasScorers ? `
                <div class="match-scorers-summary mt-sm pt-xs" style="border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem;">
                  <div style="display: flex; justify-content: space-between; gap: 0.5rem;">
                    <div style="flex: 1; text-align: right; color: var(--color-yellow);">
                      ${homeScorers.map(s => `${s.player ? `${s.player.last_name} ${s.player.first_name}` : 'Autogol'}${s.goals > 1 ? ` (${s.goals})` : ''}`).join(', ')}
                    </div>
                    <div style="opacity: 0.5; font-size: 0.8rem;">⚽</div>
                    <div style="flex: 1; text-align: left; color: var(--color-yellow);">
                      ${awayScorers.map(s => `${s.player ? `${s.player.last_name} ${s.player.first_name}` : 'Autogol'}${s.goals > 1 ? ` (${s.goals})` : ''}`).join(', ')}
                    </div>
                  </div>
                </div>
              ` : ''}
              
              <div class="match-actions text-center mt-md" style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                ${match.status === 'scheduled' ? `
                  <button class="btn-small btn-success start-match-btn" data-id="${match.id}">
                    ▶️ Avvia
                  </button>
                ` : ''}
                
                ${match.status === 'live' ? `
                  <div class="live-score-controls flex flex-col gap-sm mb-sm">
                    <div class="flex justify-center items-center gap-md">
                      <div class="team-control flex flex-col items-center gap-xs">
                        <span class="text-sm font-bold">${match.home_team?.name || ''}</span>
                        <div class="flex items-center gap-sm">
                          <button class="btn-small btn-danger score-btn" data-id="${match.id}" data-team="home" data-delta="-1">-</button>
                          <span class="text-xl font-bold">${match.home_score !== null ? match.home_score : 0}</span>
                          <button class="btn-small btn-success score-btn" data-id="${match.id}" data-team="home" data-delta="1">+</button>
                        </div>
                      </div>
                      <span class="text-lg font-bold text-yellow">-</span>
                      <div class="team-control flex flex-col items-center gap-xs">
                        <span class="text-sm font-bold">${match.away_team?.name || ''}</span>
                        <div class="flex items-center gap-sm">
                          <button class="btn-small btn-danger score-btn" data-id="${match.id}" data-team="away" data-delta="-1">-</button>
                          <span class="text-xl font-bold">${match.away_score !== null ? match.away_score : 0}</span>
                          <button class="btn-small btn-success score-btn" data-id="${match.id}" data-team="away" data-delta="1">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button class="btn-small btn-danger end-match-btn" data-id="${match.id}">
                    ⏹️ Termina
                  </button>
                ` : ''}

                ${match.status === 'completed' ? `
                  <button class="btn-small btn-secondary reopen-match-btn" data-id="${match.id}" title="Riapri Partita" style="flex: 1; min-width: 80px;">
                    🔄 Riapri
                  </button>
                ` : ''}

                <button class="btn-small btn-secondary edit-match-btn" 
                  data-id="${match.id}"
                  data-home="${match.home_team_id}"
                  data-away="${match.away_team_id}"
                  data-homescore="${match.home_score !== null ? match.home_score : ''}"
                  data-awayscore="${match.away_score !== null ? match.away_score : ''}"
                  data-date="${match.match_date || ''}"
                  data-phase="${match.phase}"
                  data-group="${match.group_id || ''}"
                  data-groupname="${match.group?.name || ''}"
                  data-category="${match.category || ''}"
                  data-status="${match.status || 'scheduled'}"
                  title="Modifica Partita"
                  style="flex: 1; min-width: 80px;"
                >
                  ✏️ Modif.
                </button>
                <button class="btn-small btn-danger delete-match-btn" data-id="${match.id}" title="Elimina Partita" style="flex: 1; min-width: 40px;">
                  🗑️
                </button>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function formatForDateTimeInput(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getStatusColor(status) {
  switch (status) {
    case 'live': return 'var(--color-red, #ff0000)';
    case 'completed': return '#4ade80';
    default: return 'rgba(255, 255, 255, 0.6)';
  }
}

