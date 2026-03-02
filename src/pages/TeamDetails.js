import { supabase } from '../lib/supabaseClient.js';

export async function renderTeamDetailsPage(params) {
  const teamId = params.id;
  const page = document.createElement('div');
  page.className = 'team-details-page container mt-xl';

  if (!teamId) {
    page.innerHTML = '<p class="text-center">Squadra non trovata.</p>';
    return page;
  }

  // Fetch team details with players
  const { data: team, error } = await supabase
    .from('teams')
    .select(`
      *,
      players(*),
      team_groups(
        group:groups(name)
      )
    `)
    .eq('id', teamId)
    .single();

  if (error || !team) {
    page.innerHTML = '<p class="text-center">Errore nel caricamento della squadra.</p>';
    return page;
  }

  // Fetch matches for this team
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(name, logo_url),
      away_team:teams!away_team_id(name, logo_url)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('match_date', { ascending: false });

  // Calculate stats
  const stats = {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0
  };

  if (matches) {
    matches.forEach(m => {
      if (m.home_score !== null && m.away_score !== null) {
        stats.played++;
        const isHome = m.home_team_id === teamId;
        const myScore = isHome ? m.home_score : m.away_score;
        const opponentScore = isHome ? m.away_score : m.home_score;

        stats.goalsFor += myScore;
        stats.goalsAgainst += opponentScore;

        if (myScore > opponentScore) stats.won++;
        else if (myScore < opponentScore) stats.lost++;
        else stats.drawn++;
      }
    });
  }

  page.innerHTML = `
    <div class="glass-card mb-xl">
      <div class="team-header text-center">
        ${team.logo_url ? `<img src="${team.logo_url}" alt="${team.name}" class="team-logo mb-md">` : ''}
        <h1 class="mb-sm">${team.name}</h1>
        <p class="text-yellow font-bold text-uppercase">${team.team_groups?.[0]?.group?.name || 'Nessun Girone'}</p>
      </div>

      <div class="team-stats-grid mt-lg">
        <div class="stat-box">
          <span class="stat-value">${stats.played}</span>
          <span class="stat-label">Partite</span>
        </div>
        <div class="stat-box">
          <span class="stat-value text-green">${stats.won}</span>
          <span class="stat-label">Vittorie</span>
        </div>
        <div class="stat-box">
          <span class="stat-value text-yellow">${stats.drawn}</span>
          <span class="stat-label">Pareggi</span>
        </div>
        <div class="stat-box">
          <span class="stat-value text-red">${stats.lost}</span>
          <span class="stat-label">Sconfitte</span>
        </div>
        <div class="stat-box">
          <span class="stat-value">${stats.goalsFor}</span>
          <span class="stat-label">Gol Fatti</span>
        </div>
        <div class="stat-box">
          <span class="stat-value">${stats.goalsAgainst}</span>
          <span class="stat-label">Gol Subiti</span>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <!-- SQUADRA -->
      <div class="glass-card">
        <h3 class="mb-md border-bottom-yellow">Rosa Squadra</h3>
        <div class="players-list">
          ${team.players && team.players.length > 0 ? team.players.map(player => `
            <div class="player-item">
              <span class="player-number">${player.jersey_number || '-'}</span>
              <span class="player-name">${player.first_name} ${player.last_name}</span>
              <span class="player-role badge badge-user">${player.position || 'Giocatore'}</span>
            </div>
          `).join('') : '<p class="text-muted">Nessun giocatore in rosa.</p>'}
        </div>
      </div>

      <!-- PARTITE -->
      <div class="glass-card">
        <h3 class="mb-md border-bottom-yellow">Partite</h3>
        <div class="matches-list-small">
          ${matches && matches.length > 0 ? matches.map(match => `
            <a href="/match/${match.id}" class="match-row-small" style="text-decoration: none; color: inherit; display: block;">
              <div class="match-date-small">${new Date(match.match_date).toLocaleDateString('it-IT')}</div>
              <div class="match-teams-score">
                <span class="${match.home_team_id === teamId ? 'font-bold' : ''} ${match.home_score !== null && match.home_score > match.away_score ? 'text-yellow font-bold' : ''}">${match.home_team.name}</span>
                ${match.home_score !== null ?
      `<span class="score-badge">${match.home_score} - ${match.away_score}</span>` :
      `<span class="vs-badge">VS</span>`
    }
                <span class="${match.away_team_id === teamId ? 'font-bold' : ''} ${match.away_score !== null && match.away_score > match.home_score ? 'text-yellow font-bold' : ''}">${match.away_team.name}</span>
              </div>
            </a>
          `).join('') : '<p class="text-muted">Nessuna partita.</p>'}
        </div>
      </div>
    </div>
  `;

  return page;
}
