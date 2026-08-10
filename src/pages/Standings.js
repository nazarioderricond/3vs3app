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

    // Calculate Top Scorers for this category
    const categoryScorers = {};

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
      if (!categoryScorers[playerId]) {
        const teamObj = s.player.team || teams?.find(t => t.id === s.player.team_id);
        categoryScorers[playerId] = {
          id: playerId,
          name: `${s.player.first_name} ${s.player.last_name}`,
          teamId: s.player.team_id,
          teamName: teamObj?.name || 'N/D',
          teamLogo: teamObj?.logo_url || null,
          goals: 0
        };
      }
      categoryScorers[playerId].goals += s.goals;
    }

    const sortedScorers = Object.values(categoryScorers)
      .sort((a, b) => b.goals - a.goals);

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
          <h3 class="mb-lg border-bottom-yellow text-center" style="color: var(--color-yellow); text-transform: uppercase; letter-spacing: 1.5px;">⚽ Classifica Marcatori - ${category}</h3>
          <div class="standings-table-wrapper">
            <div class="standings-header" style="display: flex; align-items: center; padding: 0.75rem 1rem;">
              <div style="width: 50px; text-align: center; font-weight: bold;">Pos</div>
              <div style="flex: 2; font-weight: bold;">Giocatore</div>
              <div style="flex: 2; font-weight: bold;">Squadra</div>
              <div style="width: 80px; text-align: center; font-weight: bold;">Gol</div>
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
                <div style="width: 80px; text-align: center; font-weight: 800; color: var(--color-yellow); font-size: 1.1rem;">
                  ${scorer.goals}
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

    // Build Sub-section View Tabs
    viewFilterContainer.innerHTML = `
      <div class="category-tabs" style="background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 215, 0, 0.3);">
        <button class="category-tab view-tab active" data-view="standings">Classifica Gironi</button>
        <button class="category-tab view-tab" data-view="playoffs">Fasi Finali</button>
        <button class="category-tab view-tab" data-view="scorers">Classifica Marcatori</button>
        <button class="category-tab view-tab" data-view="all">Mostra Tutto</button>
      </div>
    `;

    // View tab click handlers
    const viewTabs = viewFilterContainer.querySelectorAll('.view-tab');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetView = e.target.dataset.view;
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
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, async (payload) => {
      console.log('Match update received:', payload);
      const updatedMatchId = payload.new.id;

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

      const matchIndex = allMatches.findIndex(m => m.id === fullMatch.id);
      if (matchIndex !== -1) {
        const match = allMatches[matchIndex];
        Object.assign(match, fullMatch);
        renderCategoryContent(currentCategory);
      }
    })
    .subscribe();

  return page;
}

function calculateGroupStandings(group, groupMatches) {
  const standings = {};

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

  groupMatches.forEach(match => {
    if (match.home_score !== null && match.away_score !== null) {
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

  return Object.values(standings)
    .map(team => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
      return b.goalDifference - a.goalDifference;
    });
}

function formatDate(dateString) {
  if (!dateString) return 'Data da definire';
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}


