import { supabase, isAdmin } from '../lib/supabaseClient.js';
import { formatPhase } from '../lib/constants.js';
import { isQualifyingMatchForPoll, getMatchPredictions } from '../lib/predictions.js';
import { openMatchPollModal } from './PublicMatches.js';

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

  const homeScorers = scorers?.filter(s => String(s.team_id) === String(match.home_team_id)) || [];
  const awayScorers = scorers?.filter(s => String(s.team_id) === String(match.away_team_id)) || [];

  page.innerHTML = `
    <div class="glass-card text-center mb-xl">
      <div class="match-meta mb-md text-muted">
        <span>${new Date(match.match_date).toLocaleString('it-IT')}</span> | 
        <span>${match.group?.name || formatPhase(match.phase)}</span>
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
          ${match.status === 'scheduled' ? '<span class="badge badge-admin">DA GIOCARE</span>' : (match.status === 'live' ? '<span class="badge badge-danger">🔴 LIVE</span>' : '<span class="badge badge-user">FINALE</span>')}
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

    ${isQualifyingMatchForPoll(match) ? `
      <div id="match-details-poll-card" class="glass-card mb-xl p-lg text-center" style="border: 1.5px solid var(--color-yellow); border-radius: 16px;">
        <h3 class="m-0 text-yellow mb-xs font-bold" style="text-transform: uppercase;">📊 Sondaggio Pronostico Tifosi</h3>
        <p class="text-muted text-sm mb-md">Chi vincerà la partita secondo te?</p>
        
        <div class="mb-md">
          <div style="height: 12px; border-radius: 6px; overflow: hidden; display: flex; background: rgba(255,255,255,0.1); margin-bottom: 0.5rem;">
            <div id="dpoll-bar-home" style="width: 33%; background: #22c55e; transition: width 0.5s ease;"></div>
            <div id="dpoll-bar-draw" style="width: 34%; background: #eab308; transition: width 0.5s ease;"></div>
            <div id="dpoll-bar-away" style="width: 33%; background: #3b82f6; transition: width 0.5s ease;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #fff;">
            <span id="dpoll-lbl-home" style="color: #22c55e;">33% ${match.home_team.name}</span>
            <span id="dpoll-lbl-draw" style="color: #eab308;">34% Pareggio</span>
            <span id="dpoll-lbl-away" style="color: #3b82f6;">33% ${match.away_team.name}</span>
          </div>
        </div>

        <button id="open-details-poll-btn" class="btn btn-primary font-bold" style="padding: 0.6rem 1.5rem; font-size: 0.95rem; border-radius: 25px; cursor: pointer;">
          🗳️ Vota la tua Favorita
        </button>
      </div>
    ` : ''}

    ${(match.home_score !== null || match.status === 'completed' || (scorers && scorers.length > 0)) ? `
      <div class="glass-card">
        <h3 class="text-center mb-lg border-bottom-yellow">Tabellino Marcatori</h3>
        
        <div class="grid grid-2">
          <!-- Home Scorers -->
          <div class="scorers-list text-right" style="border-right: 1px solid rgba(255,255,255,0.1); padding-right: 1rem;">
            ${homeScorers.length > 0 ? homeScorers.map(s => `
              <div class="scorer-item mb-sm">
                <span class="font-bold">${s.player ? `${s.player.first_name} ${s.player.last_name}` : '⚽ Autogol'}</span>
                ${s.goals > 1 ? `<span class="badge badge-admin ml-sm">x${s.goals}</span>` : '⚽'}
              </div>
            `).join('') : '<p class="text-muted text-sm">Nessun marcatore registrato</p>'}
          </div>

          <!-- Away Scorers -->
          <div class="scorers-list text-left" style="padding-left: 1rem;">
            ${awayScorers.length > 0 ? awayScorers.map(s => `
              <div class="scorer-item mb-sm">
                ${s.goals > 1 ? `<span class="badge badge-admin mr-sm">x${s.goals}</span>` : '⚽'}
                <span class="font-bold">${s.player ? `${s.player.first_name} ${s.player.last_name}` : '⚽ Autogol'}</span>
              </div>
            `).join('') : '<p class="text-muted text-sm">Nessun marcatore registrato</p>'}
          </div>
        </div>
      </div>
    ` : ''}
  `;

  if (isQualifyingMatchForPoll(match)) {
    const pollCard = page.querySelector('#match-details-poll-card');
    if (pollCard) {
      const loadDetailsPollStats = async () => {
        const stats = await getMatchPredictions(match.id);
        const bH = pollCard.querySelector('#dpoll-bar-home');
        const bD = pollCard.querySelector('#dpoll-bar-draw');
        const bA = pollCard.querySelector('#dpoll-bar-away');
        if (bH) bH.style.width = `${stats.homePct}%`;
        if (bD) bD.style.width = `${stats.drawPct}%`;
        if (bA) bA.style.width = `${stats.awayPct}%`;

        const lH = pollCard.querySelector('#dpoll-lbl-home');
        const lD = pollCard.querySelector('#dpoll-lbl-draw');
        const lA = pollCard.querySelector('#dpoll-lbl-away');
        if (lH) lH.textContent = `${stats.homePct}% ${match.home_team.name}`;
        if (lD) lD.textContent = `${stats.drawPct}% Pareggio`;
        if (lA) lA.textContent = `${stats.awayPct}% ${match.away_team.name}`;
      };

      loadDetailsPollStats();

      pollCard.querySelector('#open-details-poll-btn').addEventListener('click', () => {
        openMatchPollModal(match, () => {
          loadDetailsPollStats();
        });
      });
    }
  }

  return page;
}
