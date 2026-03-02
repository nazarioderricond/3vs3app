import { supabase } from '../lib/supabaseClient.js';

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
  const { data: teams } = await supabase
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

  page.innerHTML = `
    <h1 class="text-center mb-xl">Squadre Stagione ${currentSeason.year}</h1>
    
    <div class="grid grid-3">
      ${teams && teams.length > 0 ? teams.map(team => `
        <div class="card team-card" data-team-id="${team.id}">
          ${team.logo_url ? `
            <div class="team-logo-container">
              <img src="${team.logo_url}" alt="${team.name}" class="team-logo">
            </div>
          ` : ''}
          
          <h3 class="text-center mt-md">${team.name}</h3>
          
          ${team.team_groups && team.team_groups.length > 0 ? `
            <p class="text-center text-yellow mt-sm" style="font-size: 0.875rem;">
              ${team.team_groups[0].group.name}
            </p>
          ` : ''}
          
          <div class="mt-md">
            <h4 style="font-size: 1rem; margin-bottom: 0.5rem;">Rosa:</h4>
            ${team.players && team.players.length > 0 ? `
              <div class="players-list">
                ${team.players.map(player => `
                  <div class="player-item">
                    ${player.jersey_number ? `<span class="player-number">#${player.jersey_number}</span>` : ''}
                    <span class="player-name">${player.first_name} ${player.last_name}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 0.875rem; opacity: 0.7;">Nessun giocatore registrato</p>
            `}
          </div>
        </div>
      `).join('') : '<p class="text-center">Nessuna squadra trovata.</p>'}
    </div>
  `;

  // Add click handlers for team details (could expand to show modal)
  const teamCards = page.querySelectorAll('.team-card');
  teamCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      // Could implement modal with detailed team info
    });
  });

  return page;
}
