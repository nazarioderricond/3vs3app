import { supabase } from '../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES } from '../lib/constants.js';

export async function renderTeamsPage() {
  const page = document.createElement('div');
  page.className = 'teams-page container mt-xl';

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
        <p class="mt-md">Non ci sono stagioni attive al momento.</p>
      </div>
    `;
    return page;
  }

  // Get teams with their groups and players
  const { data: rawTeams } = await supabase
    .from('teams')
    .select(`
      *,
      team_groups(
        group:groups(name)
      ),
      players(*)
    `)
    .eq('season_id', currentSeason.id)
    .order('name');

  // Filter to show only teams that contain players
  const teams = rawTeams ? rawTeams.filter(t => t.players && t.players.length > 0) : [];

  page.innerHTML = `
    <h1 class="text-center mb-xl">Squadre Stagione ${currentSeason.year}</h1>

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
    
    <div class="grid grid-3">
      ${teams && teams.length > 0 ? teams.map(team => `
        <div class="card team-card" data-team-id="${team.id}" data-category="${team.category || ''}">
          ${team.logo_url ? `
            <div class="team-logo-container">
              <img src="${team.logo_url}" alt="${team.name}" class="team-logo">
            </div>
          ` : ''}
          
          <h3 class="text-center mt-md">${team.name}</h3>
          
          <div style="display: flex; justify-content: center; gap: 0.4rem; margin-top: 0.25rem;">
            <span class="admin-team-badge admin-team-badge-category">${team.category || 'Nessuna categoria'}</span>
            ${team.team_groups && team.team_groups.length > 0 ? `
              <span class="admin-team-badge admin-team-badge-group">${team.team_groups[0].group.name}</span>
            ` : ''}
          </div>
          
          <div class="mt-md">
            <h4 style="font-size: 1rem; margin-bottom: 0.5rem;">Rosa:</h4>
            ${team.players && team.players.length > 0 ? `
              <div class="players-list">
                ${team.players.map(player => `
                  <div class="player-item">
                    <span class="player-name">👤 ${player.first_name} ${player.last_name}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 0.875rem; opacity: 0.7;">Nessun giocatore registrato</p>
            `}
          </div>
        </div>
      `).join('') : '<p class="text-center">Nessuna squadra trovata.</p>'}
      <p id="no-teams-msg" class="text-center hidden" style="grid-column: 1 / -1; padding: 2rem; color: rgba(255,255,255,0.6);">
        Nessuna squadra presente in questa categoria.
      </p>
    </div>
  `;

  // Category Filter Tab Handler
  const filterTabs = page.querySelectorAll('.category-tab');
  const teamCards = page.querySelectorAll('.team-card');
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

  // Add click handlers for team details (could expand to show modal)
  teamCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      // Could implement modal with detailed team info
    });
  });

  return page;
}
