import { supabase, isAdmin } from '../../lib/supabaseClient.js';
import { navigateTo } from '../../application.js';
import { TOURNAMENT_CATEGORIES } from '../../lib/constants.js';

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

  // Get teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, category')
    .eq('season_id', currentSeason.id)
    .order('name');

  // Get groups
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, category')
    .eq('season_id', currentSeason.id)
    .order('name');

  // Get existing matches
  let { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      group:groups(name)
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
          </div>
          
          <div class="input-group">
            <label for="away-team">Squadra Ospite *</label>
            <select id="away-team" name="away-team" required disabled>
              <option value="">Seleziona prima una categoria</option>
            </select>
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
              <option value="final">Finale</option>
            </select>
          </div>
        </div>
        
        <div class="input-group" id="group-select-container">
            <label for="group-id">Girone (opzionale)</label>
            <select id="group-id" name="group-id" disabled>
              <option value="">Seleziona prima una categoria</option>
            </select>
        </div>
        
        <div class="grid grid-2">
          <div class="input-group">
            <label for="home-score">Gol Casa</label>
            <input type="number" id="home-score" name="home-score" min="0">
          </div>
          
          <div class="input-group">
            <label for="away-score">Gol Ospite</label>
            <input type="number" id="away-score" name="away-score" min="0">
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
      ${(() => {
      if (!matches || matches.length === 0) return '<p class="text-center">Nessuna partita programmata.</p>';

      // Group matches by date
      const matchesByDate = {};
      matches.forEach(match => {
        let dateKey = 'Data da definire';
        let sortDate = '9999-99-99'; // Push to end

        if (match.match_date) {
          const date = new Date(match.match_date);
          dateKey = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          // Capitalize first letter
          dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
          sortDate = match.match_date.split('T')[0];
        }

        if (!matchesByDate[sortDate]) {
          matchesByDate[sortDate] = {
            title: dateKey,
            matches: []
          };
        }
        matchesByDate[sortDate].matches.push(match);
      });

      // Sort dates
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
                ${group.matches.map(match => `
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
                      
                      <div class="match-score" style="padding: 0 1rem; font-family: var(--font-display); font-size: 1.5rem; color: var(--color-yellow);">
                        ${match.home_score !== null ? match.home_score : '-'} : ${match.away_score !== null ? match.away_score : '-'}
                      </div>
                      
                      <div class="team-away" style="flex: 1; text-align: left; font-weight: bold;">
                        ${match.away_team?.name || 'TBD'}
                      </div>
                    </div>
                    
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
                              <span class="text-sm font-bold">${match.home_team.name}</span>
                              <div class="flex items-center gap-sm">
                                <button class="btn-small btn-danger score-btn" data-id="${match.id}" data-team="home" data-delta="-1">-</button>
                                <span class="text-xl font-bold">${match.home_score !== null ? match.home_score : 0}</span>
                                <button class="btn-small btn-success score-btn" data-id="${match.id}" data-team="home" data-delta="1">+</button>
                              </div>
                            </div>
                            <span class="text-lg font-bold text-yellow">-</span>
                            <div class="team-control flex flex-col items-center gap-xs">
                              <span class="text-sm font-bold">${match.away_team.name}</span>
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
                        data-category="${match.category || ''}"
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
                `).join('')}
              </div>
            </div>
          `;
      }).join('');
    })()}
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

  // Render scorer inputs
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
      <h4 class="mb-sm mt-md">Marcatori</h4>
      <div class="grid grid-2">
        <div class="home-scorers">
          <h5 class="text-yellow">Casa</h5>
          <div id="home-scorers-list"></div>
          <button type="button" class="btn-small btn-secondary mt-sm" id="add-home-scorer">+ Aggiungi</button>
        </div>
        <div class="away-scorers">
          <h5 class="text-yellow">Ospite</h5>
          <div id="away-scorers-list"></div>
          <button type="button" class="btn-small btn-secondary mt-sm" id="add-away-scorer">+ Aggiungi</button>
        </div>
      </div>
    `;

    const addScorerRow = (teamType, players, scorer = null) => {
      const listId = teamType === 'home' ? 'home-scorers-list' : 'away-scorers-list';
      const list = document.getElementById(listId);
      const div = document.createElement('div');
      div.className = 'scorer-row mb-sm flex gap-2';
      div.innerHTML = `
        <select name="scorer-${teamType}" class="scorer-select" style="flex: 1;">
          <option value="">Seleziona giocatore...</option>
          ${players.map(p => `<option value="${p.id}" ${scorer && scorer.player_id === p.id ? 'selected' : ''}>${p.last_name} ${p.first_name}</option>`).join('')}
        </select>
        <input type="number" name="goals-${teamType}" class="scorer-goals" value="${scorer ? scorer.goals : 1}" min="1" style="width: 60px;">
        <button type="button" class="btn-small btn-danger remove-scorer">X</button>
      `;

      div.querySelector('.remove-scorer').addEventListener('click', () => div.remove());
      list.appendChild(div);
    };

    // Add existing scorers
    existingScorers.filter(s => s.team_id === homeTeamId).forEach(s => addScorerRow('home', homePlayers, s));
    existingScorers.filter(s => s.team_id === awayTeamId).forEach(s => addScorerRow('away', awayPlayers, s));

    // Add handlers for buttons
    document.getElementById('add-home-scorer').addEventListener('click', () => addScorerRow('home', homePlayers));
    document.getElementById('add-away-scorer').addEventListener('click', () => addScorerRow('away', awayPlayers));
  }

  // Handle category change to filter teams and groups
  const categorySelect = page.querySelector('#match-category');
  const homeSelect = page.querySelector('#home-team');
  const awaySelect = page.querySelector('#away-team');
  const groupSelect = page.querySelector('#group-id');

  categorySelect.addEventListener('change', (e) => {
    const selectedCategory = e.target.value;

    // Reset selects
    homeSelect.innerHTML = '<option value="">Seleziona squadra...</option>';
    awaySelect.innerHTML = '<option value="">Seleziona squadra...</option>';
    groupSelect.innerHTML = '<option value="">Nessun girone</option>';

    if (!selectedCategory) {
      homeSelect.disabled = true;
      awaySelect.disabled = true;
      groupSelect.disabled = true;
      return;
    }

    homeSelect.disabled = false;
    awaySelect.disabled = false;
    groupSelect.disabled = false;

    // Filter teams by category
    const filteredTeams = teams ? teams.filter(t => t.category === selectedCategory) : [];
    filteredTeams.forEach(team => {
      homeSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
      awaySelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    });

    // Filter groups by category
    const filteredGroups = groups ? groups.filter(g => g.category === selectedCategory) : [];
    filteredGroups.forEach(group => {
      groupSelect.innerHTML += `<option value="${group.id}">${group.name}</option>`;
    });
  });

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      season_id: currentSeason.id,
      category: form['match-category'].value,
      home_team_id: form['home-team'].value,
      away_team_id: form['away-team'].value,
      match_date: form['match-date'].value || null,
      phase: form['phase'].value,
      group_id: form['group-id'].value || null,
      home_score: form['home-score'].value === '' ? null : parseInt(form['home-score'].value),
      away_score: form['away-score'].value === '' ? null : parseInt(form['away-score'].value),
    };

    const errorDiv = page.querySelector('#form-error');

    try {
      if (formData.home_team_id === formData.away_team_id) {
        throw new Error('Una squadra non può giocare contro se stessa');
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

      // Handle Scorers
      if (matchId) {
        // Delete existing scorers first (simpler than update)
        await supabase.from('match_scorers').delete().eq('match_id', matchId);

        const scorersToInsert = [];

        // Collect Home Scorers
        const homeScorerSelects = document.querySelectorAll('select[name="scorer-home"]');
        const homeGoalInputs = document.querySelectorAll('input[name="goals-home"]');
        homeScorerSelects.forEach((select, i) => {
          if (select.value) {
            scorersToInsert.push({
              match_id: matchId,
              team_id: formData.home_team_id,
              player_id: select.value,
              goals: parseInt(homeGoalInputs[i].value)
            });
          }
        });

        // Collect Away Scorers
        const awayScorerSelects = document.querySelectorAll('select[name="scorer-away"]');
        const awayGoalInputs = document.querySelectorAll('input[name="goals-away"]');
        awayScorerSelects.forEach((select, i) => {
          if (select.value) {
            scorersToInsert.push({
              match_id: matchId,
              team_id: formData.away_team_id,
              player_id: select.value,
              goals: parseInt(awayGoalInputs[i].value)
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
    // Optimistic update (optional, but let's rely on re-render for simplicity first)
    // Fetch current match data to get current score
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
        // Refresh list
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

    console.log('Matches fetched:', latestMatches?.length);

    // Update the local matches variable so subsequent actions use the fresh data
    if (latestMatches) {
      matches = latestMatches;
    }

    const listContainer = page.querySelector('.matches-list');
    if (listContainer && latestMatches) {
      // Update local matches variable for other functions
      // Note: we can't easily update the 'matches' const from outer scope if it was defined with const
      // But we can use the data directly.
      // Better: let's just re-generate the HTML.

      listContainer.innerHTML = latestMatches.length > 0 ? latestMatches.map(match => `
        <div class="glass-card mb-md match-card" style="border-left: 5px solid ${getStatusColor(match.status)};">
          <div class="match-header" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem; opacity: 0.8;">
            <span>${match.phase === 'group_stage' ? (match.group?.name || 'Gironi') : formatPhase(match.phase)}</span>
            <span>${match.match_date ? new Date(match.match_date).toLocaleString('it-IT') : 'Data da definire'}</span>
            <span class="status-badge ${match.status === 'live' ? 'live-pulse' : ''}" style="color: ${getStatusColor(match.status)}; font-weight: bold; text-transform: uppercase;">
              ${match.status === 'live' ? '🔴 LIVE' : (match.status === 'completed' ? 'Terminata' : 'Programmata')}
            </span>
          </div>
          
          <div class="match-content" style="display: flex; align-items: center; justify-content: space-between;">
            <div class="team-home" style="flex: 1; text-align: right; font-weight: bold;">
              ${match.home_team?.name || 'TBD'}
            </div>
            
            <div class="match-score" style="padding: 0 1rem; font-family: var(--font-display); font-size: 1.5rem; color: var(--color-yellow);">
              ${match.home_score !== null ? match.home_score : '-'} : ${match.away_score !== null ? match.away_score : '-'}
            </div>
            
            <div class="team-away" style="flex: 1; text-align: left; font-weight: bold;">
              ${match.away_team?.name || 'TBD'}
            </div>
          </div>
          
          <div class="match-actions text-center mt-md" style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
            ${match.status === 'scheduled' ? `
              <button class="btn-small btn-success start-match-btn" data-id="${match.id}" style="flex: 1; min-width: 100px;">
                ▶️ Avvia
              </button>
            ` : ''}
            
            ${match.status === 'live' ? `
              <div class="live-score-controls flex flex-col gap-sm mb-sm">
                <div class="flex justify-center items-center gap-md">
                  <div class="team-control flex flex-col items-center gap-xs">
                    <span class="text-sm font-bold">${match.home_team.name}</span>
                    <div class="flex items-center gap-sm">
                      <button class="btn-small btn-danger score-btn" data-id="${match.id}" data-team="home" data-delta="-1">-</button>
                      <span class="text-xl font-bold">${match.home_score !== null ? match.home_score : 0}</span>
                      <button class="btn-small btn-success score-btn" data-id="${match.id}" data-team="home" data-delta="1">+</button>
                    </div>
                  </div>
                  <span class="text-lg font-bold text-yellow">-</span>
                  <div class="team-control flex flex-col items-center gap-xs">
                    <span class="text-sm font-bold">${match.away_team.name}</span>
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
              data-category="${match.category || ''}"
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
      `).join('') : '<p class="text-center">Nessuna partita programmata.</p>';
    }
  };

  // Event Delegation for Match Actions
  const matchesList = page.querySelector('.matches-list');
  if (matchesList) {
    matchesList.addEventListener('click', (e) => {
      // Prevent default behavior for buttons to avoid any form submissions or weird navigation
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
            else renderMatchesList(); // Changed from renderAdminMatchesPage
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
        form['phase'].value = data.phase;
        form['group-id'].value = data.group;

        if (data.date) {
          const date = new Date(data.date);
          const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
          form['match-date'].value = localIso;
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
  // Clean up any existing subscription for this channel
  supabase.removeChannel(supabase.channel('admin-matches'));

  const subscription = supabase
    .channel('admin-matches')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, payload => {
      console.log('Admin match update:', payload);
      renderMatchesList();
    })
    .subscribe();

  return page;
}

function getStatusColor(status) {
  switch (status) {
    case 'live': return 'var(--color-red, #ff0000)';
    case 'completed': return '#4ade80'; /* Bright Green (Tailwind green-400 equivalent) for better visibility on dark */
    default: return 'rgba(255, 255, 255, 0.6)'; /* Brighter gray for scheduled */
  }
}

function formatPhase(phase) {
  const map = {
    'group_stage': 'Gironi',
    'round_16': 'Ottavi',
    'quarterfinals': 'Quarti',
    'semifinals': 'Semifinali',
    'final': 'Finale'
  };
  return map[phase] || phase;
}
