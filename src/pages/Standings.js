import { supabase } from '../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES, PHASE_LABELS, formatPhase } from '../lib/constants.js';

export async function renderStandingsPage(params) {
  const page = document.createElement('div');
  page.className = 'standings-page container mt-xl';

  const seasonId = params?.season;
  let currentSeason = null;

  if (seasonId) {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();
    currentSeason = data;
  } else {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
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

  // Get teams for fallback player-team association
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('season_id', currentSeason.id);

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
      away_team:teams!away_team_id(name, logo_url),
      group:groups(name)
    `)
    .eq('season_id', currentSeason.id)
    .order('match_date', { ascending: true });

  // Get match scorers with player and team info
  const { data: scorers } = await supabase
    .from('match_scorers')
    .select(`
      *,
      player:players(id, first_name, last_name, team_id, team:teams(id, name, logo_url)),
      match:matches!inner(season_id, category, group_id, home_team_id, away_team_id)
    `)
    .eq('match.season_id', currentSeason.id);

  const groupStageMatches = allMatches?.filter(m => m.phase === 'group_stage') || [];
  const playoffMatches = allMatches?.filter(m => m.phase !== 'group_stage') || [];

  const firstCategoryWithData = TOURNAMENT_CATEGORIES.find(cat =>
    groups?.some(g => g.category === cat)
  ) || TOURNAMENT_CATEGORIES[0];

  let currentCategory = firstCategoryWithData;

  page.innerHTML = `
    <h1 class="text-center mb-xl">Stagione ${currentSeason.year}</h1>
    
    <!-- Category Filter Tabs (Pill style like Admin/Teams) -->
    <div class="category-tabs-container mb-md" style="display: flex; justify-content: center;">
      <div class="category-tabs">
        ${TOURNAMENT_CATEGORIES.map(cat => `
          <button class="category-tab category-filter-btn ${cat === currentCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>
        `).join('')}
      </div>
    </div>
    
    <!-- View Sub-section Tabs -->
    <div id="view-filter-container" class="category-tabs-container mb-xl" style="display: flex; justify-content: center; transition: opacity 0.3s ease;">
      <!-- Sub-section buttons will be injected here dynamically -->
    </div>
    
    <div id="standings-content">
      <!-- Content loaded dynamically -->
    </div>
  `;

  // Team Category Map
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

  // Function to render content for a specific category
  function renderCategoryContent(category) {
    const contentContainer = page.querySelector('#standings-content');
    const viewFilterContainer = page.querySelector('#view-filter-container');

    // Filter groups for this category
    const categoryGroups = groups ? groups.filter(g => g.category === category) : [];

    const isMatchInCategory = (match) => {
      if (match.category) {
        return match.category === category;
      }
      if (match.group_id) {
        const group = groups.find(g => g.id === match.group_id);
        return group && group.category === category;
      }
      const homeCat = teamCategoryMap.get(match.home_team_id);
      const awayCat = teamCategoryMap.get(match.away_team_id);
      return homeCat === category || awayCat === category;
    };

    const categoryGroupStageMatches = groupStageMatches.filter(isMatchInCategory);
    const categoryPlayoffMatches = playoffMatches.filter(isMatchInCategory);

    // Filter groups strictly for round-robin standings (exclude final phase sub-groups)
    const standingsGroups = categoryGroups.filter(g => {
      const nameLower = g.name.toLowerCase();
      const isFinalGroup = nameLower.includes('finale') || nameLower.includes('quarti') || nameLower.includes('semifinal') || nameLower.includes('ottavi') || nameLower.includes('posto');
      if (isFinalGroup) return false;
      return categoryGroupStageMatches.some(m => m.group_id === g.id) || nameLower.includes('girone');
    });

    // Group playoff matches dynamically by sub-phase name or formatted phase
    const playoffPhasesMap = {};
    categoryPlayoffMatches.forEach(m => {
      const title = m.group?.name || formatPhase(m.phase);
      if (!playoffPhasesMap[title]) {
        playoffPhasesMap[title] = [];
      }
      playoffPhasesMap[title].push(m);
    });

    // Calculate Top Scorers for this category (Media Goal = goals / played)
    const categoryScorers = {};
    const teamPlayedMatches = {};

    allMatches.forEach(m => {
      const isCompleted = m.status === 'completed' || m.status === 'live' || (m.home_score !== null && m.away_score !== null);
      if (isCompleted && isMatchInCategory(m)) {
        if (m.home_team_id) {
          teamPlayedMatches[m.home_team_id] = (teamPlayedMatches[m.home_team_id] || 0) + 1;
        }
        if (m.away_team_id) {
          teamPlayedMatches[m.away_team_id] = (teamPlayedMatches[m.away_team_id] || 0) + 1;
        }
      }
    });

    if (scorers) {
      scorers.forEach(s => {
        const matchData = s.match;
        let inCategory = false;

        if (matchData.category === category) {
          inCategory = true;
        } else if (matchData.group_id) {
          const group = groups.find(g => g.id === matchData.group_id);
          if (group && group.category === category) inCategory = true;
        } else {
          const homeCat = teamCategoryMap.get(matchData.home_team_id);
          const awayCat = teamCategoryMap.get(matchData.away_team_id);
          if (homeCat === category || awayCat === category) inCategory = true;
        }

        if (inCategory) {
          addScorerStats(s);
        }
      });
    }

    function addScorerStats(s) {
      if (!s.player) return; // Ignore Autogol (null player)

      const playerId = s.player.id;
      const teamId = s.team_id || s.player.team_id;

      if (!categoryScorers[playerId]) {
        const teamObj = s.player.team || teams?.find(t => t.id === teamId);
        categoryScorers[playerId] = {
          id: playerId,
          name: `${s.player.first_name} ${s.player.last_name}`,
          teamId: teamId,
          teamName: teamObj?.name || 'N/D',
          teamLogo: teamObj?.logo_url || null,
          goals: 0,
          uniqueMatches: new Set()
        };
      }
      categoryScorers[playerId].goals += s.goals;
      if (s.match_id) {
        categoryScorers[playerId].uniqueMatches.add(s.match_id);
      }
    }

    const sortedScorers = Object.values(categoryScorers).map(scorer => {
      const teamMatchesCount = teamPlayedMatches[scorer.teamId] || 0;
      const played = Math.max(1, teamMatchesCount || scorer.uniqueMatches.size);
      const avgGoals = scorer.goals / played;
      return {
        ...scorer,
        played,
        avgGoals
      };
    }).sort((a, b) => {
      if (b.avgGoals !== a.avgGoals) return b.avgGoals - a.avgGoals;
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (a.played !== b.played) return a.played - b.played;
      return a.name.localeCompare(b.name);
    });

    // Detect Grand Final Winner for this category (EXCLUSIVELY 1st place final)
    const grandFinalMatch = categoryPlayoffMatches.find(isMainGrandFinalMatch);

    let winnerBoxHtml = '';
    if (grandFinalMatch && (grandFinalMatch.status === 'completed' || grandFinalMatch.home_score !== null)) {
      const homeScore = grandFinalMatch.home_score !== null ? Number(grandFinalMatch.home_score) : null;
      const awayScore = grandFinalMatch.away_score !== null ? Number(grandFinalMatch.away_score) : null;

      if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
        const isHomeWinner = homeScore > awayScore;
        const winnerTeam = isHomeWinner ? grandFinalMatch.home_team : grandFinalMatch.away_team;
        const runnerUpTeam = isHomeWinner ? grandFinalMatch.away_team : grandFinalMatch.home_team;

        if (winnerTeam) {
          winnerBoxHtml = `
            <div class="winner-celebration-box mb-xl" style="
              background: linear-gradient(135deg, rgba(255, 215, 0, 0.22) 0%, rgba(20, 20, 35, 0.95) 60%, rgba(10, 10, 18, 0.98) 100%);
              border: 2px solid #ffd700;
              box-shadow: 0 0 35px rgba(255, 215, 0, 0.4), inset 0 0 15px rgba(255, 215, 0, 0.2);
              border-radius: 20px;
              padding: 2rem 1.5rem;
              text-align: center;
              position: relative;
              overflow: hidden;
            ">
              <div style="font-size: 2.2rem; margin-bottom: 0.4rem; filter: drop-shadow(0 0 10px #ffd700);">
                ✨ 🏆 🎉 🏆 ✨
              </div>
              <div class="badge" style="
                background: #ffd700;
                color: #000;
                font-size: 0.95rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 2px;
                padding: 0.4rem 1.2rem;
                border-radius: 50px;
                display: inline-block;
                box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
                margin-bottom: 1rem;
              ">
                VINCITORE TORNEO • CATEGORIA ${category.toUpperCase()}
              </div>
              <div style="display: flex; align-items: center; justify-content: center; gap: 1.2rem; margin: 0.8rem 0; flex-wrap: wrap;">
                ${winnerTeam.logo_url ? `<img src="${winnerTeam.logo_url}" alt="${winnerTeam.name}" style="width: 70px; height: 70px; object-fit: contain; filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.6));">` : ''}
                <h2 style="
                  font-size: 2.2rem;
                  font-weight: 900;
                  color: #ffd700;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  margin: 0;
                  text-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
                ">
                  ${winnerTeam.name}
                </h2>
              </div>
              <p style="font-size: 1.05rem; color: rgba(255, 255, 255, 0.9); margin-top: 0.5rem; font-weight: 600;">
                🥇 Campioni del Torneo 3vs3 Ischitella per la categoria ${category}!
              </p>
              <div style="
                display: inline-block;
                margin-top: 0.8rem;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 215, 0, 0.4);
                border-radius: 30px;
                padding: 0.5rem 1.2rem;
                font-size: 0.95rem;
                color: #ffffff;
              ">
                ⚽ Finale: <span style="color: #ffd700; font-weight: bold;">${winnerTeam.name}</span> ${homeScore} - ${awayScore} <span style="opacity: 0.8;">${runnerUpTeam?.name || 'TBD'}</span>
              </div>
            </div>
          `;
        }
      }
    }

    const html = `
      <!-- GROUP STAGE & STANDINGS -->
      <div class="view-section" id="view-standings">
        <div class="groups-container">
          ${standingsGroups.length > 0 ? standingsGroups.map(group => {
            const groupMatches = categoryGroupStageMatches.filter(m => m.group_id === group.id);
            const standings = calculateGroupStandings(group, groupMatches);
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
          }).join('') : '<p class="text-center mt-xl">Nessun girone in questa categoria.</p>'}
        </div>
      </div>

      <!-- TOP SCORERS SECTION -->
      <div class="view-section" id="view-scorers">
        <div class="scorers-section glass-card mb-2xl">
          <h3 class="mb-lg border-bottom-yellow text-center" style="color: var(--color-yellow); text-transform: uppercase; letter-spacing: 1.5px;">⚽ Classifica Marcatori (Media Gol) - ${category}</h3>
          <div class="standings-table-wrapper">
            <div class="standings-header" style="display: flex; align-items: center; padding: 0.75rem 1rem;">
              <div style="width: 50px; text-align: center; font-weight: bold;">Pos</div>
              <div style="flex: 2; font-weight: bold;">Giocatore</div>
              <div style="flex: 2; font-weight: bold;">Squadra</div>
              <div style="width: 90px; text-align: center; font-weight: bold;" title="Partite Giocate">Partite</div>
              <div style="width: 100px; text-align: center; font-weight: bold;" title="Media Gol (Gol / Partite)">Media Gol</div>
            </div>
            
            ${sortedScorers.length > 0 ? sortedScorers.map((scorer, index) => `
              <div class="standings-row ${index < 3 ? 'promotion-zone' : ''}" style="display: flex; align-items: center; padding: 0.75rem 1rem;">
                <div style="width: 50px; text-align: center;">
                  <span class="position" style="${index === 0 ? 'background: #ffd700; color: black; font-weight: 800;' : index === 1 ? 'background: #c0c0c0; color: black; font-weight: 800;' : index === 2 ? 'background: #cd7f32; color: black; font-weight: 800;' : ''}">${index + 1}</span>
                </div>
                <div style="flex: 2; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 0.4rem;">
                  <span>👤</span>
                  <span>${scorer.name}</span>
                </div>
                <div style="flex: 2; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${scorer.teamLogo ? `<img src="${scorer.teamLogo}" alt="${scorer.teamName}" class="team-logo-small">` : ''}
                  <span style="font-weight: 500; opacity: 0.9;">${scorer.teamName}</span>
                </div>
                <div style="width: 90px; text-align: center; font-weight: 600; opacity: 0.9; font-size: 0.95rem;">
                  ${scorer.played} (${scorer.goals} ${scorer.goals === 1 ? 'gol' : 'gol'})
                </div>
                <div style="width: 100px; text-align: center; font-weight: 800; color: var(--color-yellow); font-size: 1.15rem;">
                  ${scorer.avgGoals.toFixed(2)}
                </div>
              </div>
            `).join('') : '<p class="text-center p-lg opacity-7">Nessun gol registrato in questa categoria.</p>'}
          </div>
        </div>
      </div>

      <!-- PLAYOFF / FINAL PHASES SECTION -->
      <div class="view-section" id="view-playoffs">
        <div class="playoff-section mt-xl">
          <h2 class="text-center mb-xl" style="color: var(--color-black); background: var(--color-yellow); padding: 0.8rem 2rem; border-radius: 50px; display: inline-block; text-transform: uppercase; letter-spacing: 2px; font-size: 1.6rem; box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); font-weight: 800;">Fasi Finali - ${category}</h2>
        
          ${winnerBoxHtml}

          ${Object.keys(playoffPhasesMap).length > 0 ? `
            <div class="grid grid-2 gap-lg">
              ${Object.entries(playoffPhasesMap).map(([title, matches]) => `
                <div class="glass-card mb-lg">
                  <div class="flex items-center justify-between border-bottom-yellow pb-xs mb-lg">
                    <h3 class="m-0 text-yellow" style="font-size: 1.2rem; font-weight: 700;">${title}</h3>
                    <span class="badge badge-admin" style="font-size: 0.8rem;">${category}</span>
                  </div>
                  
                  <div class="matches-list-small">
                    ${matches.map(match => `
                      <a href="/match/${match.id}" class="match-row-small ${match.status === 'live' ? 'live-match-card' : ''}" style="text-decoration: none; color: inherit; ${match.status === 'live' ? 'border-left: 3px solid var(--color-red);' : ''}">
                        <div class="match-date-small">
                          ${match.status === 'live' ? '<span style="color: var(--color-red); font-weight: bold;">🔴 LIVE</span>' : formatDate(match.match_date)}
                        </div>
                        <div class="match-teams-score">
                          <span class="${match.home_score > match.away_score ? 'text-yellow font-bold' : ''}">${match.home_team?.name || 'TBD'}</span>
                          ${match.status === 'live' || match.home_score !== null ?
                            `<span class="score-badge ${match.status === 'live' ? 'live-score' : ''}">${match.home_score !== null ? match.home_score : 0} - ${match.away_score !== null ? match.away_score : 0}</span>` :
                            `<span class="vs-badge">VS</span>`
                          }
                          <span class="${match.away_score > match.home_score ? 'text-yellow font-bold' : ''}">${match.away_team?.name || 'TBD'}</span>
                        </div>
                      </a>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="glass-card text-center p-xl">
              <p class="text-muted" style="font-size: 1.1rem; margin: 0;">Nessuna partita delle Fasi Finali programmata per la categoria ${category}.</p>
            </div>
          `}
        </div>
      </div>
    `;

    contentContainer.innerHTML = html;

    // Track current active view tab
    let currentView = 'standings';

    // Build Sub-section View Tabs + Social Export Button
    viewFilterContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%;">
        <div class="category-tabs" style="background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 215, 0, 0.3);">
          <button class="category-tab view-tab active" data-view="standings">Classifica Gironi</button>
          <button class="category-tab view-tab" data-view="playoffs">Fasi Finali</button>
          <button class="category-tab view-tab" data-view="scorers">Classifica Marcatori</button>
          <button class="category-tab view-tab" data-view="all">Mostra Tutto</button>
        </div>
        <button id="export-standings-graphic-btn" class="btn-export-social-link" style="font-size: 0.95rem; padding: 0.55rem 1.5rem;">
          📸 Esporta Grafica Social
        </button>
      </div>
    `;

    // View tab click handlers
    const viewTabs = viewFilterContainer.querySelectorAll('.view-tab');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetView = e.target.dataset.view;
        currentView = targetView;
        viewTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        const allSections = contentContainer.querySelectorAll('.view-section');
        allSections.forEach(sec => {
          if (targetView === 'all' || sec.id === `view-${targetView}`) {
            sec.style.display = 'block';
            sec.style.animation = 'fadeInUp 0.4s ease forwards';
          } else {
            sec.style.display = 'none';
          }
        });
      });
    });

    // Social Export Handler
    const exportBtn = viewFilterContainer.querySelector('#export-standings-graphic-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportStandingsGraphic({
          currentSeason,
          currentCategory: category,
          currentView,
          standingsGroups,
          categoryGroupStageMatches,
          playoffPhasesMap,
          sortedScorers
        });
      });
    }

    // Trigger default selection (Classifica Gironi if available, else Fasi Finali)
    const defaultView = standingsGroups.length > 0 ? 'standings' : (categoryPlayoffMatches.length > 0 ? 'playoffs' : 'standings');
    const initialViewTab = viewFilterContainer.querySelector(`.view-tab[data-view="${defaultView}"]`);
    if (initialViewTab) {
      initialViewTab.click();
    }
  }

  // Category filter tabs handler
  const categoryFilterBtns = page.querySelectorAll('.category-filter-btn');
  categoryFilterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selectedCategory = e.target.dataset.category;
      currentCategory = selectedCategory;
      categoryFilterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderCategoryContent(selectedCategory);
    });
  });

  // Initial render
  renderCategoryContent(currentCategory);

  // Realtime Subscription
  supabase.removeChannel(supabase.channel('public:matches'));

  const subscription = supabase
    .channel('public:matches')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, async () => {
      const { data: updatedMatches } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!home_team_id(name, logo_url),
          away_team:teams!away_team_id(name, logo_url),
          group:groups(name)
        `)
        .eq('season_id', currentSeason.id)
        .order('match_date', { ascending: true });

      if (updatedMatches) {
        allMatches.length = 0;
        allMatches.push(...updatedMatches);
        const newGroupStage = allMatches.filter(m => m.phase === 'group_stage');
        const newPlayoffs = allMatches.filter(m => m.phase !== 'group_stage');
        groupStageMatches.length = 0;
        groupStageMatches.push(...newGroupStage);
        playoffMatches.length = 0;
        playoffMatches.push(...newPlayoffs);
        renderCategoryContent(currentCategory);
      }
    })
    .subscribe();

  return page;
}

function calculateGroupStandings(group, groupMatches) {
  const standings = {};

  // 1. Initialize teams registered in group.team_groups
  if (group.team_groups) {
    group.team_groups.forEach(tg => {
      if (tg.team) {
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
      }
    });
  }

  // 2. ALSO initialize any teams participating in groupMatches if not already in standings
  groupMatches.forEach(match => {
    if (match.home_team_id && !standings[match.home_team_id] && match.home_team) {
      standings[match.home_team_id] = {
        id: match.home_team_id,
        name: match.home_team.name,
        logo_url: match.home_team.logo_url,
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
      };
    }
    if (match.away_team_id && !standings[match.away_team_id] && match.away_team) {
      standings[match.away_team_id] = {
        id: match.away_team_id,
        name: match.away_team.name,
        logo_url: match.away_team.logo_url,
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
      };
    }
  });

  // 3. Calculate points and stats from matches
  groupMatches.forEach(match => {
    const isCompleted = match.status === 'completed' || (match.home_score !== null && match.away_score !== null);
    if (isCompleted && match.home_score !== null && match.away_score !== null) {
      const homeTeam = standings[match.home_team_id];
      const awayTeam = standings[match.away_team_id];

      if (homeTeam && awayTeam) {
        const homeScore = Number(match.home_score);
        const awayScore = Number(match.away_score);

        homeTeam.played++;
        awayTeam.played++;

        homeTeam.goalsFor += homeScore;
        homeTeam.goalsAgainst += awayScore;
        awayTeam.goalsFor += awayScore;
        awayTeam.goalsAgainst += homeScore;

        if (homeScore > awayScore) {
          homeTeam.won++;
          homeTeam.points += 3;
          awayTeam.lost++;
        } else if (homeScore < awayScore) {
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

  return Object.values(standings)
    .map(team => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
      return a.name.localeCompare(b.name);
    });
}

function isMainGrandFinalMatch(match) {
  if (!match) return false;
  const groupName = match.group?.name ? match.group.name.toLowerCase() : '';
  const phase = match.phase || '';

  // Exclude all sub-final placement matches (7°, 6°, 5°, 4°, 3°)
  if (phase === 'final_7th' || phase === 'final_6th' || phase === 'final_5th' || phase === 'final_4th' || phase === 'final_3rd') {
    return false;
  }
  if (groupName.includes('7°') || groupName.includes('7 posto') || groupName.includes('7° posto')) return false;
  if (groupName.includes('6°') || groupName.includes('6 posto') || groupName.includes('6° posto')) return false;
  if (groupName.includes('5°') || groupName.includes('5 posto') || groupName.includes('5° posto')) return false;
  if (groupName.includes('4°') || groupName.includes('4 posto') || groupName.includes('4° posto')) return false;
  if (groupName.includes('3°') || groupName.includes('3 posto') || groupName.includes('3° posto')) return false;

  // Must be phase 'final' AND group name is empty or 'finale' or 'finale 1°' or 'finale 1°/2°'
  if (phase === 'final') {
    if (!groupName || groupName === 'finale' || groupName.includes('1°') || groupName.includes('1/2') || groupName.includes('1°/2°')) {
      return true;
    }
  }

  return false;
}

function formatDate(dateString) {
  if (!dateString) return 'Data da definire';
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function exportStandingsGraphic({ currentSeason, currentCategory, currentView, standingsGroups, categoryGroupStageMatches, playoffPhasesMap, sortedScorers }) {
  const width = 1080;
  const paddingX = 50;
  const headerHeight = 220;
  let contentHeight = 0;

  const showStandings = (currentView === 'standings' || currentView === 'all');
  const showPlayoffs = (currentView === 'playoffs' || currentView === 'all');
  const showScorers = (currentView === 'scorers' || currentView === 'all');

  if (showStandings && standingsGroups && standingsGroups.length > 0) {
    standingsGroups.forEach(g => {
      const groupMatches = categoryGroupStageMatches.filter(m => m.group_id === g.id);
      const standings = calculateGroupStandings(g, groupMatches);
      if (standings.length > 0) {
        contentHeight += 60; // Group Title
        contentHeight += 45; // Table Header
        contentHeight += standings.length * 48; // Rows
        contentHeight += 35; // Gap
      }
    });
  }

  if (showPlayoffs && playoffPhasesMap && Object.keys(playoffPhasesMap).length > 0) {
    contentHeight += 40;
    Object.entries(playoffPhasesMap).forEach(([title, matches]) => {
      contentHeight += 50; // Sub-phase Header
      contentHeight += matches.length * 56; // Matches
      contentHeight += 25; // Gap
    });
  }

  if (showScorers && sortedScorers && sortedScorers.length > 0) {
    const scorersToShow = sortedScorers.slice(0, 15);
    contentHeight += 60; // Title
    contentHeight += 45; // Header
    contentHeight += scorersToShow.length * 48; // Rows
    contentHeight += 35; // Gap
  }

  const footerHeight = 80;
  const totalHeight = Math.max(1200, headerHeight + contentHeight + footerHeight + 40);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bgGradient.addColorStop(0, '#0a0e17');
  bgGradient.addColorStop(0.5, '#121a29');
  bgGradient.addColorStop(1, '#080b12');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, totalHeight);

  // Title & Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = '800 40px sans-serif';
  ctx.fillText('TORNEO 3vs3 ISCHITELLA', width / 2, 70);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '600 22px sans-serif';
  ctx.fillText(`STAGIONE ${currentSeason?.year || '2026'}`, width / 2, 105);

  let viewLabel = 'CLASSIFICA GIRONI';
  if (currentView === 'playoffs') viewLabel = 'FASI FINALI';
  else if (currentView === 'scorers') viewLabel = 'CLASSIFICA MARCATORI (MEDIA GOL)';
  else if (currentView === 'all') viewLabel = 'CLASSIFICHE COMPLETE';

  const badgeText = `${currentCategory.toUpperCase()}  •  ${viewLabel}`;
  ctx.font = 'bold 22px sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 60;
  const badgeY = 135;

  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect((width - badgeW) / 2, badgeY, badgeW, 44, 22);
  else ctx.rect((width - badgeW) / 2, badgeY, badgeW, 44);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.fillText(badgeText, width / 2, badgeY + 30);

  let currentY = 220;
  const tableW = width - (paddingX * 2);

  // SECTION 1: STANDINGS
  if (showStandings && standingsGroups && standingsGroups.length > 0) {
    standingsGroups.forEach(g => {
      const groupMatches = categoryGroupStageMatches.filter(m => m.group_id === g.id);
      const standings = calculateGroupStandings(g, groupMatches);
      if (standings.length === 0) return;

      // Group Title
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(g.name.toUpperCase(), paddingX, currentY);
      currentY += 15;

      // Table Header Background
      ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 42, 6);
      else ctx.rect(paddingX, currentY, tableW, 42);
      ctx.fill();

      // Column Positions
      const colPos = paddingX + 30;
      const colTeam = paddingX + 80;
      const colPt = paddingX + 540;
      const colG = paddingX + 610;
      const colV = paddingX + 670;
      const colN = paddingX + 730;
      const colP = paddingX + 790;
      const colGF = paddingX + 860;
      const colGS = paddingX + 920;
      const colDR = paddingX + 970;

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('POS', colPos, currentY + 27);
      ctx.textAlign = 'left'; ctx.fillText('SQUADRA', colTeam, currentY + 27);
      ctx.textAlign = 'center';
      ctx.fillText('PT', colPt, currentY + 27);
      ctx.fillText('G', colG, currentY + 27);
      ctx.fillText('V', colV, currentY + 27);
      ctx.fillText('N', colN, currentY + 27);
      ctx.fillText('P', colP, currentY + 27);
      ctx.fillText('GF', colGF, currentY + 27);
      ctx.fillText('GS', colGS, currentY + 27);
      ctx.fillText('DR', colDR, currentY + 27);

      currentY += 46;

      standings.forEach((team, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 44, 4);
        else ctx.rect(paddingX, currentY, tableW, 44);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = 'bold 18px sans-serif';
        if (idx === 0) ctx.fillStyle = '#ffd700';
        else if (idx === 1) ctx.fillStyle = '#c0c0c0';
        else if (idx === 2) ctx.fillStyle = '#cd7f32';
        else ctx.fillStyle = '#ffffff';
        ctx.fillText(`${idx + 1}`, colPos, currentY + 28);

        ctx.textAlign = 'left';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#ffffff';
        let teamName = team.name.toUpperCase();
        if (teamName.length > 28) teamName = teamName.substring(0, 26) + '...';
        ctx.fillText(teamName, colTeam, currentY + 28);

        ctx.textAlign = 'center';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`${team.points}`, colPt, currentY + 28);

        ctx.font = '17px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${team.played}`, colG, currentY + 28);
        ctx.fillText(`${team.won}`, colV, currentY + 28);
        ctx.fillText(`${team.drawn}`, colN, currentY + 28);
        ctx.fillText(`${team.lost}`, colP, currentY + 28);
        ctx.fillText(`${team.goalsFor}`, colGF, currentY + 28);
        ctx.fillText(`${team.goalsAgainst}`, colGS, currentY + 28);

        const drStr = team.goalDifference > 0 ? `+${team.goalDifference}` : `${team.goalDifference}`;
        ctx.fillText(drStr, colDR, currentY + 28);

        currentY += 48;
      });

      currentY += 30;
    });
  }

  // SECTION 2: PLAYOFFS
  if (showPlayoffs && playoffPhasesMap && Object.keys(playoffPhasesMap).length > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FASI FINALI', paddingX, currentY);
    currentY += 20;

    // Canvas Winner Box (EXCLUSIVELY 1st place final)
    let grandFinalWinner = null;
    const mainFinalMatch = Object.values(playoffPhasesMap).flat().find(isMainGrandFinalMatch);
    if (mainFinalMatch && mainFinalMatch.home_score !== null && mainFinalMatch.away_score !== null) {
      const h = Number(mainFinalMatch.home_score);
      const a = Number(mainFinalMatch.away_score);
      if (h !== a) {
        const isHomeWinner = h > a;
        grandFinalWinner = {
          name: isHomeWinner ? mainFinalMatch.home_team?.name : mainFinalMatch.away_team?.name,
          score: `${h} - ${a}`,
          runnerUp: isHomeWinner ? mainFinalMatch.away_team?.name : mainFinalMatch.home_team?.name
        };
      }
    }

    if (grandFinalWinner) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 90, 10);
      else ctx.rect(paddingX, currentY, tableW, 90);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`✨ 🏆 VINCITORE TORNEO • ${currentCategory.toUpperCase()} 🏆 ✨`, width / 2, currentY + 34);

      ctx.font = '900 28px sans-serif';
      ctx.fillText(`${grandFinalWinner.name.toUpperCase()} (${grandFinalWinner.score})`, width / 2, currentY + 70);

      currentY += 115;
    }

    Object.entries(playoffPhasesMap).forEach(([title, pMatches]) => {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 40, 6);
      else ctx.rect(paddingX, currentY, tableW, 40);
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title.toUpperCase(), paddingX + 20, currentY + 26);
      currentY += 46;

      pMatches.forEach((m, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 50, 6);
        else ctx.rect(paddingX, currentY, tableW, 50);
        ctx.fill();

        const midX = width / 2;
        const homeName = (m.home_team?.name || 'TBD').toUpperCase();
        const awayName = (m.away_team?.name || 'TBD').toUpperCase();
        let scoreStr = 'VS';
        if (m.status === 'completed' || m.status === 'live' || m.home_score !== null) {
          scoreStr = `${m.home_score !== null ? m.home_score : 0} - ${m.away_score !== null ? m.away_score : 0}`;
        }

        ctx.textAlign = 'right';
        ctx.font = 'bold 19px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(homeName, midX - 60, currentY + 32);

        ctx.textAlign = 'center';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(scoreStr, midX, currentY + 32);

        ctx.textAlign = 'left';
        ctx.font = 'bold 19px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(awayName, midX + 60, currentY + 32);

        currentY += 56;
      });

      currentY += 20;
    });
  }

  // SECTION 3: SCORERS
  if (showScorers && sortedScorers && sortedScorers.length > 0) {
    const scorersToShow = sortedScorers.slice(0, 15);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CLASSIFICA MARCATORI (MEDIA GOL)', paddingX, currentY);
    currentY += 20;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 42, 6);
    else ctx.rect(paddingX, currentY, tableW, 42);
    ctx.fill();

    const colPos = paddingX + 30;
    const colPlayer = paddingX + 80;
    const colTeam = paddingX + 480;
    const colPlayed = paddingX + 820;
    const colAvg = paddingX + 960;

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('POS', colPos, currentY + 27);
    ctx.textAlign = 'left'; ctx.fillText('GIOCATORE', colPlayer, currentY + 27);
    ctx.fillText('SQUADRA', colTeam, currentY + 27);
    ctx.textAlign = 'center';
    ctx.fillText('PARTITE', colPlayed, currentY + 27);
    ctx.fillText('MEDIA GOL', colAvg, currentY + 27);

    currentY += 46;

    scorersToShow.forEach((sc, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(paddingX, currentY, tableW, 44, 4);
      else ctx.rect(paddingX, currentY, tableW, 44);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.font = 'bold 18px sans-serif';
      if (idx === 0) ctx.fillStyle = '#ffd700';
      else if (idx === 1) ctx.fillStyle = '#c0c0c0';
      else if (idx === 2) ctx.fillStyle = '#cd7f32';
      else ctx.fillStyle = '#ffffff';
      ctx.fillText(`${idx + 1}`, colPos, currentY + 28);

      ctx.textAlign = 'left';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#ffffff';
      let pName = sc.name.toUpperCase();
      if (pName.length > 25) pName = pName.substring(0, 23) + '...';
      ctx.fillText(pName, colPlayer, currentY + 28);

      let tName = sc.teamName.toUpperCase();
      if (tName.length > 25) tName = tName.substring(0, 23) + '...';
      ctx.font = '17px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(tName, colTeam, currentY + 28);

      ctx.textAlign = 'center';
      ctx.font = '17px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${sc.played} (${sc.goals} GOL)`, colPlayed, currentY + 28);

      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`${sc.avgGoals.toFixed(2)}`, colAvg, currentY + 28);

      currentY += 48;
    });

    currentY += 30;
  }

  // Footer Branding
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '18px sans-serif';
  ctx.fillText('3vs3ischitella.it  •  #3vs3Ischitella', width / 2, totalHeight - 35);

  const link = document.createElement('a');
  const filenameCat = currentCategory.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filenameView = currentView.toLowerCase();
  link.download = `3vs3_Ischitella_Classifica_${filenameCat}_${filenameView}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}


