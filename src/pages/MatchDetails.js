import { supabase, isAdmin } from '../lib/supabaseClient.js';

export async function renderMatchDetailsPage(params) {
  const matchId = params.id;
  const page = document.createElement('div');
  page.className = 'match-details-page container mt-xl';

  if (!matchId) {
    page.innerHTML = '<p class="text-center">Partita non trovata.</p>';
    return page;
  }

  // Fetch match details with teams and scorers
  const { data: match, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(name, logo_url),
      away_team:teams!away_team_id(name, logo_url),
      group:groups(name)
    `)
    .eq('id', matchId)
    .single();

  if (error || !match) {
    page.innerHTML = '<p class="text-center">Errore nel caricamento della partita.</p>';
    return page;
  }

  // Fetch scorers
  const { data: scorers } = await supabase
    .from('match_scorers')
    .select(`
      *,
      player:players(first_name, last_name)
    `)
    .eq('match_id', matchId);

  const homeScorers = scorers?.filter(s => s.team_id === match.home_team_id) || [];
  const awayScorers = scorers?.filter(s => s.team_id === match.away_team_id) || [];

  page.innerHTML = `
    <div class="glass-card text-center mb-xl">
      <div class="match-meta mb-md text-muted">
        <span>${new Date(match.match_date).toLocaleString('it-IT')}</span> | 
        <span>${match.group?.name || 'Fase a Gironi'}</span>
      </div>

      <div class="match-scoreboard grid grid-3" style="align-items: center;">
        <!-- Home Team -->
        <div class="team-display">
          ${match.home_team.logo_url ? `<img src="${match.home_team.logo_url}" class="team-logo mb-sm">` : ''}
          <h2 class="mb-0"><a href="/team/${match.home_team_id}" style="color: inherit; text-decoration: none;">${match.home_team.name}</a></h2>
        </div>

        <!-- Score -->
        <div class="score-display">
          <div style="font-size: 4rem; font-family: var(--font-display); color: var(--color-yellow);">
            ${match.home_score !== null ? match.home_score : '-'} : ${match.away_score !== null ? match.away_score : '-'}
          </div>
          ${match.home_score === null ? '<span class="badge badge-admin">DA GIOCARE</span>' : '<span class="badge badge-user">FINALE</span>'}
        </div>

        <!-- Away Team -->
        <div class="team-display">
          ${match.away_team.logo_url ? `<img src="${match.away_team.logo_url}" class="team-logo mb-sm">` : ''}
          <h2 class="mb-0"><a href="/team/${match.away_team_id}" style="color: inherit; text-decoration: none;">${match.away_team.name}</a></h2>
        </div>
      </div>

      ${isAdmin() ? `
        <div class="mt-lg">
          <a href="/admin/matches" class="btn btn-secondary">✏️ Gestisci Partita</a>
        </div>
      ` : ''}
    </div>

    ${match.home_score !== null ? `
      <div class="glass-card">
        <h3 class="text-center mb-lg border-bottom-yellow">Tabellino Marcatori</h3>
        
        <div class="grid grid-2">
          <!-- Home Scorers -->
          <div class="scorers-list text-right" style="border-right: 1px solid rgba(255,255,255,0.1); padding-right: 1rem;">
            ${homeScorers.length > 0 ? homeScorers.map(s => `
              <div class="scorer-item mb-sm">
                <span class="font-bold">${s.player.first_name} ${s.player.last_name}</span>
                ${s.goals > 1 ? `<span class="badge badge-admin ml-sm">x${s.goals}</span>` : '⚽'}
              </div>
            `).join('') : '<p class="text-muted text-sm">Nessun marcatore registrato</p>'}
          </div>

          <!-- Away Scorers -->
          <div class="scorers-list text-left" style="padding-left: 1rem;">
            ${awayScorers.length > 0 ? awayScorers.map(s => `
              <div class="scorer-item mb-sm">
                ${s.goals > 1 ? `<span class="badge badge-admin mr-sm">x${s.goals}</span>` : '⚽'}
                <span class="font-bold">${s.player.first_name} ${s.player.last_name}</span>
              </div>
            `).join('') : '<p class="text-muted text-sm">Nessun marcatore registrato</p>'}
          </div>
        </div>
      </div>
    ` : ''}
  `;

  return page;
}
