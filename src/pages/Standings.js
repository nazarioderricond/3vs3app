import { supabase } from '../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES } from '../lib/constants.js';

const phaseLabels = {
  'group_stage': 'Fase a Gironi',
  'round_16': 'Ottavi di Finale',
  'quarterfinals': 'Quarti di Finale',
  'semifinals': 'Semifinali',
  'final': 'Finale'
};

export async function renderStandingsPage(params) {
  const page = document.createElement('div');
  page.className = 'standings-page container mt-xl';

  const seasonId = params?.season;
  let currentSeason = null;

  if (seasonId) {
    // 1. Fetch Specific Season (Archived or Active)
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();
    currentSeason = data;
  } else {
    // 2. Default: Fetch Current Active Season
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    // maybeSingle avoids 406 error if 0 rows
    currentSeason = data;
  }

  if (!currentSeason) {
    page.innerHTML = `
      <div class="text-center">
        <h2>Nessuna stagione trovata</h2>
        <p class="mt-md">Impossibile caricare i dati della stagione richiesta.</p>
        <a href="/" data-link class="btn btn-primary mt-md">Torna alla Home</a>
      </div>
    `;
    return page;
  }

  // Get groups with teams
  const { data: groups } = await supabase
    .from('groups')
    .select(`
      *,
      team_groups(
        team:teams(
          id,
          name,
          logo_url
        )
      )
    `)
    .eq('season_id', currentSeason.id)
    .order('name');

  // Get all matches for the season (Group Stage + Playoffs)
  const { data: allMatches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(name, logo_url),
      away_team:teams!away_team_id(name, logo_url)
    `)
    .eq('season_id', currentSeason.id)
    .order('match_date', { ascending: true });

  // Get match scorers
  const { data: scorers } = await supabase
    .from('match_scorers')
    .select(`
      *,
      player:players(id, first_name, last_name, team_id),
      match:matches!inner(season_id, category, group_id, home_team_id, away_team_id)
    `)
    .eq('match.season_id', currentSeason.id);

  // Filter matches
  const groupStageMatches = allMatches?.filter(m => m.phase === 'group_stage') || [];
  const playoffMatches = allMatches?.filter(m => m.phase !== 'group_stage') || [];

  page.innerHTML = `
    <h1 class="text-center mb-xl">Stagione ${currentSeason.year}</h1>
    
    <div class="text-center mb-xl">
      <div class="category-select-container">
        <label for="category-select" class="category-select-label">Categoria:</label>
        <select id="category-select" class="group-select">
          ${TOURNAMENT_CATEGORIES.map(cat => `
            <option value="${cat}">${cat}</option>
          `).join('')}
        </select>
      </div>
    </div>
    
    <div id="standings-content">
      <!-- Content will be loaded here -->
    </div>
  `;

  // Function to render content for a specific category
  function renderCategoryContent(category) {
    const contentContainer = page.querySelector('#standings-content');

    // Filter groups for this category
    const categoryGroups = groups ? groups.filter(g => g.category === category) : [];

    // Filter matches for this category (based on group or team category)
    // Note: Matches don't have category directly, but we can infer from groups or teams
    // For simplicity, we'll rely on the groups for group stage.
    // For playoffs, we might need to check the teams' category if we don't have it on the match.
    // However, since we don't have category on matches, we'll filter by checking if ANY of the teams in the match belongs to the category.
    // This assumes teams are correctly categorized.

    // Helper to check if a match belongs to the category
    // Helper to check if a match belongs to the category
    // Moved logic to unified function below
    // const isMatchInCategory = ... (removed duplicate)

    // Build Team Category Map
    const teamCategoryMap = new Map();
    if (groups) {
      groups.forEach(g => {
        if (g.team_groups) {
          g.team_groups.forEach(tg => {
            if (tg.team) {
              teamCategoryMap.set(tg.team.id, g.category);
            }
          });
        }
      });
    }

    // Filter matches for this category
    // Logic:
    // 1. If match has a category column (new schema), use it.
    // 2. If not, check if match belongs to a group of this category.
    // 3. If playoff (no group), check if teams belong to this category (via group association).

    const isMatchInCategory = (match) => {
      // 1. Direct category check (if migration ran)
      if (match.category) {
        return match.category === category;
      }

      // 2. Group category check
      if (match.group_id) {
        const group = groups.find(g => g.id === match.group_id);
        return group && group.category === category;
      }

      // 3. Team category check (fallback for playoffs without category on match)
      const homeCat = teamCategoryMap.get(match.home_team_id);
      const awayCat = teamCategoryMap.get(match.away_team_id);

      // If either team is in this category, show it (or should it be both?)
      // Safer to show if at least one matches, or if both match.
      // Let's require at least one known team in this category.
      return homeCat === category || awayCat === category;
    };

    const categoryGroupStageMatches = groupStageMatches.filter(isMatchInCategory);
    const categoryPlayoffMatches = playoffMatches.filter(isMatchInCategory);

    // Group playoff matches by phase
    const playoffPhases = {
      'round_16': [],
      'quarterfinals': [],
      'semifinals': [],
      'final': []
    };

    categoryPlayoffMatches.forEach(m => {
      if (playoffPhases[m.phase]) {
        playoffPhases[m.phase].push(m);
      }
    });

    // Calculate Top Scorers for this category
    const categoryScorers = {};

    if (scorers) {
      scorers.forEach(s => {
        // Check if the match belongs to this category
        // We can reuse isMatchInCategory logic but we need the match object
        // The scorer object has match data joined

        // Construct a match-like object for the helper or check directly
        // The joined match object has: season_id, category, group_id, home_team_id, away_team_id
        const matchData = s.match;

        // We need to check if this match belongs to the current category
        // 1. Direct category check
        if (matchData.category === category) {
          addScorerStats(s);
          return;
        }

        // 2. Group category check
        if (matchData.group_id) {
          const group = groups.find(g => g.id === matchData.group_id);
          if (group && group.category === category) {
            addScorerStats(s);
            return;
          }
        }

        // 3. Team category check (fallback)
        const homeCat = teamCategoryMap.get(matchData.home_team_id);
        const awayCat = teamCategoryMap.get(matchData.away_team_id);
        if (homeCat === category || awayCat === category) {
          addScorerStats(s);
        }
      });
    }

    function addScorerStats(s) {
      if (!s.player) return;

      const playerId = s.player.id;
      if (!categoryScorers[playerId]) {
        categoryScorers[playerId] = {
          id: playerId,
          name: `${s.player.first_name} ${s.player.last_name}`,
          teamId: s.player.team_id,
          goals: 0
        };
      }
      categoryScorers[playerId].goals += s.goals;
    }

    const sortedScorers = Object.values(categoryScorers)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10); // Top 10

    const html = `
      <!-- GROUP STAGE -->
      <div class="groups-container">
        ${categoryGroups.length > 0 ? categoryGroups.map(group => {
      // Filter matches for this group
      const groupMatches = categoryGroupStageMatches.filter(m => m.group_id === group.id);

      // Calculate standings
      const standings = calculateGroupStandings(group, groupMatches);

      // Split matches by status
      const liveMatches = groupMatches.filter(m => m.status === 'live');
      const playedMatches = groupMatches.filter(m => m.status === 'completed')
        .sort((a, b) => new Date(b.match_date || 0) - new Date(a.match_date || 0));
      const scheduledMatches = groupMatches.filter(m => m.status === 'scheduled')
        .sort((a, b) => new Date(a.match_date || 0) - new Date(b.match_date || 0));

      return `
            <div class="glass-card mb-2xl">
              <h2 class="text-center mb-lg" style="color: var(--color-yellow); text-transform: uppercase; letter-spacing: 2px;">${group.name}</h2>
              
              <div class="group-layout grid grid-3-desktop" style="gap: 2rem;">
                
                <!-- SECTION 1: STANDINGS -->
                <div class="standings-section" style="grid-column: span 2;">
                  <h3 class="mb-md border-bottom-yellow">Classifica</h3>
                  <div class="standings-table-wrapper">
                    <div class="standings-header">
                      <div style="flex: 3;">Squadra</div>
                      <div class="text-center font-bold" title="Punti">PT</div>
                      <div class="text-center" title="Partite Giocate">G</div>
                      <div class="text-center" title="Vittorie">V</div>
                      <div class="text-center" title="Pareggi">N</div>
                      <div class="text-center" title="Sconfitte">P</div>
                      <div class="text-center mobile-hide" title="Gol Fatti">GF</div>
                      <div class="text-center mobile-hide" title="Gol Subiti">GS</div>
                      <div class="text-center" title="Differenza Reti">DR</div>
                    </div>
                    
                    ${standings.map((team, index) => `
                      <div class="standings-row ${index < 2 ? 'promotion-zone' : ''}">
                        <div style="flex: 3; display: flex; align-items: center; gap: 0.5rem;">
                          <span class="position">${index + 1}</span>
                          ${team.logo_url ? `
                            <img src="${team.logo_url}" alt="${team.name}" class="team-logo-small">
                          ` : ''}
                          <a href="/team/${team.id}" class="team-name-truncate" style="color: inherit; text-decoration: none; font-weight: bold;">${team.name}</a>
                        </div>
                        <div class="text-center font-bold points">${team.points}</div>
                        <div class="text-center">${team.played}</div>
                        <div class="text-center">${team.won}</div>
                        <div class="text-center">${team.drawn}</div>
                        <div class="text-center">${team.lost}</div>
                        <div class="text-center mobile-hide">${team.goalsFor}</div>
                        <div class="text-center mobile-hide">${team.goalsAgainst}</div>
                        <div class="text-center">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- SECTION 2 & 3: MATCHES -->
                <div class="matches-section-wrapper">
                  
                  <!-- LIVE MATCHES -->
                  ${liveMatches.length > 0 ? `
                    <div class="live-section mb-lg">
                      <h3 class="mb-md border-bottom-yellow" style="color: var(--color-red); display: flex; align-items: center; gap: 0.5rem;">
                        <span class="live-pulse-dot"></span> LIVE NOW
                      </h3>
                      <div class="matches-list-small">
                        ${liveMatches.map(match => `
                          <a href="/match/${match.id}" class="match-row-small live-match-card" style="text-decoration: none; color: inherit; border-left: 3px solid var(--color-red);">
                            <div class="match-date-small" style="color: var(--color-red); font-weight: bold;">IN CORSO</div>
                            <div class="match-teams-score">
                              <span class="${match.home_score > match.away_score ? 'text-yellow font-bold' : ''}">${match.home_team.name}</span>
                              <span class="score-badge live-score">${match.home_score !== null ? match.home_score : 0} - ${match.away_score !== null ? match.away_score : 0}</span>
                              <span class="${match.away_score > match.home_score ? 'text-yellow font-bold' : ''}">${match.away_team.name}</span>
                            </div>
                          </a>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <!-- RESULTS -->
                  <div class="results-section mb-lg">
                    <h3 class="mb-md border-bottom-yellow">Ultimi Risultati</h3>
                    <div class="matches-list-small">
                      ${playedMatches.length > 0 ? playedMatches.slice(0, 5).map(match => `
                        <a href="/match/${match.id}" class="match-row-small" style="text-decoration: none; color: inherit;">
                          <div class="match-date-small">${formatDate(match.match_date)}</div>
                          <div class="match-teams-score">
                            <span class="${match.home_score > match.away_score ? 'text-yellow font-bold' : ''}">${match.home_team.name}</span>
                            <span class="score-badge">${match.home_score} - ${match.away_score}</span>
                            <span class="${match.away_score > match.home_score ? 'text-yellow font-bold' : ''}">${match.away_team.name}</span>
                          </div>
                        </a>
                      `).join('') : '<p class="text-muted text-sm">Nessuna partita terminata.</p>'}
                    </div>
                  </div>

                  <!-- FIXTURES -->
                  <div class="fixtures-section">
                    <h3 class="mb-md border-bottom-yellow">Prossimi Turni</h3>
                    <div class="matches-list-small">
                      ${scheduledMatches.length > 0 ? scheduledMatches.slice(0, 5).map(match => `
                        <a href="/match/${match.id}" class="match-row-small" style="text-decoration: none; color: inherit;">
                          <div class="match-date-small">${formatDate(match.match_date)}</div>
                          <div class="match-teams-vs">
                            <span>${match.home_team.name}</span>
                            <span class="vs-badge">VS</span>
                            <span>${match.away_team.name}</span>
                          </div>
                        </a>
                      `).join('') : '<p class="text-muted text-sm">Nessuna partita in programma.</p>'}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          `;
    }).join('') : '<p class="text-center mt-xl">Nessun girone o squadra in questa categoria.</p>'}
      </div>

      <!-- TOP SCORERS SECTION -->
      ${sortedScorers.length > 0 ? `
        <div class="scorers-section glass-card mb-2xl">
          <h3 class="mb-md border-bottom-yellow">Classifica Marcatori</h3>
          <div class="standings-table-wrapper">
            <div class="standings-header">
              <div style="width: 50px; text-align: center;">Pos</div>
              <div style="flex: 2;">Giocatore</div>
              <div style="flex: 1; text-align: center;">Gol</div>
            </div>
            ${sortedScorers.map((scorer, index) => `
              <div class="standings-row">
                <div style="width: 50px; text-align: center;">
                  <span class="position" style="${index < 3 ? 'background: var(--gradient-yellow); color: black;' : ''}">${index + 1}</span>
                </div>
                <div style="flex: 2; font-weight: 500;">${scorer.name}</div>
                <div style="flex: 1; text-align: center; font-weight: bold; color: var(--color-yellow); font-size: 1.1rem;">${scorer.goals}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- PLAYOFF PHASE -->
      ${categoryPlayoffMatches.length > 0 ? `
        <div class="playoff-section mt-2xl">
          <h2 class="text-center mb-xl" style="color: var(--color-black); background: var(--color-yellow); padding: 0.8rem 2rem; border-radius: 50px; display: inline-block; text-transform: uppercase; letter-spacing: 2px; font-size: 1.8rem; box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); font-weight: 800;">Fase Finale - ${category}</h2>
          
          <div class="grid grid-2">
            ${Object.entries(playoffPhases).map(([phase, matches]) => {
      if (matches.length === 0) return '';
      return `
                <div class="glass-card mb-lg">
                  <h3 class="text-center mb-lg border-bottom-yellow">${phaseLabels[phase]}</h3>
                  <div class="matches-list-small">
                    ${matches.map(match => `
                      <a href="/match/${match.id}" class="match-row-small ${match.status === 'live' ? 'live-match-card' : ''}" style="text-decoration: none; color: inherit; ${match.status === 'live' ? 'border-left: 3px solid var(--color-red);' : ''}">
                        <div class="match-date-small">
                          ${match.status === 'live' ? '<span style="color: var(--color-red); font-weight: bold;">🔴 LIVE</span>' : formatDate(match.match_date)}
                        </div>
                        <div class="match-teams-score" style="justify-content: center; gap: 1rem;">
                          <span class="${match.home_score > match.away_score ? 'text-yellow font-bold' : ''}" style="text-align: right; flex: 1;">${match.home_team.name}</span>
                          ${match.status === 'live' || match.home_score !== null ?
          `<span class="score-badge ${match.status === 'live' ? 'live-score' : ''}">${match.home_score !== null ? match.home_score : 0} - ${match.away_score !== null ? match.away_score : 0}</span>` :
          `<span class="vs-badge">VS</span>`
        }
                          <span class="${match.away_score > match.home_score ? 'text-yellow font-bold' : ''}" style="text-align: left; flex: 1;">${match.away_team.name}</span>
                        </div>
                      </a>
                    `).join('')}
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      ` : ''}
    `;

    contentContainer.innerHTML = html;
  }

  // Handle dropdown changes
  const categorySelect = page.querySelector('#category-select');
  categorySelect.addEventListener('change', (e) => {
    const category = e.target.value;
    currentCategory = category;
    renderCategoryContent(category);
  });

  // Initial render - Find first category with data or default to first
  const firstCategoryWithData = TOURNAMENT_CATEGORIES.find(cat =>
    groups.some(g => g.category === cat)
  ) || TOURNAMENT_CATEGORIES[0];

  let currentCategory = firstCategoryWithData;

  // Set initial selected value
  const initialSelect = page.querySelector('#category-select');
  if (initialSelect) {
    initialSelect.value = firstCategoryWithData;
    renderCategoryContent(firstCategoryWithData);
  } else {
    renderCategoryContent(TOURNAMENT_CATEGORIES[0]);
  }

  // Realtime Subscription
  const subscription = supabase
    .channel('public:matches')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, async (payload) => {
      console.log('Match update received:', payload);
      const updatedMatchId = payload.new.id;

      // Fetch the full match data including teams
      const { data: fullMatch, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!home_team_id(name, logo_url),
          away_team:teams!away_team_id(name, logo_url)
        `)
        .eq('id', updatedMatchId)
        .single();

      if (error) {
        console.error('Error fetching updated match:', error);
        return;
      }

      console.log('Full match fetched:', fullMatch);

      // Update local data
      const matchIndex = allMatches.findIndex(m => m.id === fullMatch.id);
      if (matchIndex !== -1) {
        // Update the object IN PLACE to preserve references in groupStageMatches/playoffMatches
        const match = allMatches[matchIndex];
        Object.assign(match, fullMatch);

        // Re-render current category
        console.log('Re-rendering category:', currentCategory);
        renderCategoryContent(currentCategory);

        // Visual feedback (flash effect)
        setTimeout(() => {
          const matchCard = page.querySelector(`a[href="/match/${fullMatch.id}"]`);
          if (matchCard) {
            matchCard.style.transition = 'background-color 0.5s ease';
            matchCard.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
            setTimeout(() => {
              matchCard.style.backgroundColor = '';
            }, 500);
          }
        }, 100);
      }
    })
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });

  // Cleanup subscription when page is removed (if we had a cleanup mechanism in the router)
  // For now, we rely on the fact that navigating away replaces the page content.
  // Ideally, the router should handle unmounting.

  return page;
}

function calculateGroupStandings(group, groupMatches) {
  const teamIds = group.team_groups.map(tg => tg.team.id);
  const standings = {};

  // Initialize standings for each team
  group.team_groups.forEach(tg => {
    standings[tg.team.id] = {
      id: tg.team.id,
      name: tg.team.name,
      logo_url: tg.team.logo_url,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  });

  // Calculate stats from matches
  groupMatches.forEach(match => {
    if (match.home_score !== null && match.away_score !== null) {
      // Ensure teams exist in standings (might be cross-group matches if configured poorly, but safer to check)
      const homeTeam = standings[match.home_team_id];
      const awayTeam = standings[match.away_team_id];

      if (homeTeam && awayTeam) {
        homeTeam.played++;
        awayTeam.played++;

        homeTeam.goalsFor += match.home_score;
        homeTeam.goalsAgainst += match.away_score;
        awayTeam.goalsFor += match.away_score;
        awayTeam.goalsAgainst += match.home_score;

        if (match.home_score > match.away_score) {
          homeTeam.won++;
          homeTeam.points += 3;
          awayTeam.lost++;
        } else if (match.home_score < match.away_score) {
          awayTeam.won++;
          awayTeam.points += 3;
          homeTeam.lost++;
        } else {
          homeTeam.drawn++;
          awayTeam.drawn++;
          homeTeam.points += 1;
          awayTeam.points += 1;
        }
      }
    }
  });

  // Calculate goal difference and sort
  return Object.values(standings)
    .map(team => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort((a, b) => {
      // 1. Total Points (Descending)
      if (b.points !== a.points) return b.points - a.points;

      // 2. Goals For (Descending)
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

      // 3. Goals Against (Ascending - fewer is better)
      if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;

      // 4. Goal Difference (Descending)
      return b.goalDifference - a.goalDifference;
    });
}

function formatDate(dateString) {
  if (!dateString) return 'Data da definire';
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}


