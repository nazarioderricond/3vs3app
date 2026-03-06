import { supabase } from '../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES } from '../lib/constants.js';

const phaseLabels = {
    'group_stage': 'Fase a Gironi',
    'round_16': 'Ottavi di Finale',
    'quarterfinals': 'Quarti di Finale',
    'semifinals': 'Semifinali',
    'final': 'Finale'
};

function getStatusColor(status) {
    switch (status) {
        case 'live': return 'var(--color-red)';
        case 'completed': return 'var(--color-yellow)';
        default: return 'var(--color-muted)';
    }
}

function formatPhase(phase) {
    return phaseLabels[phase] || phase;
}

export async function renderPublicMatchesPage() {
    const page = document.createElement('div');
    page.className = 'public-matches-page container mt-xl';

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
        <p class="mt-md">Al momento non ci sono partite disponibili.</p>
        <a href="/" data-link class="btn btn-primary mt-md">Torna alla Home</a>
      </div>
    `;
        return page;
    }

    // Get all matches for the season
    let { data: allMatches } = await supabase
        .from('matches')
        .select(`
      *,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      group:groups(name)
    `)
        .eq('season_id', currentSeason.id)
        .order('match_date', { ascending: true });

    if (!allMatches || allMatches.length === 0) {
        page.innerHTML = `
      <div class="text-center">
        <h2>Partite - Stagione ${currentSeason.year}</h2>
        <p class="mt-md">Nessuna partita programmata al momento.</p>
      </div>
    `;
        return page;
    }

    // Group matches by date
    const matchesByDate = {};
    allMatches.forEach(match => {
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
                sortDate: sortDate,
                matches: []
            };
        }
        matchesByDate[sortDate].matches.push(match);
    });

    // Sort dates
    const sortedDates = Object.keys(matchesByDate).sort();

    // Find the closest date to today that has matches, or default to the first
    const todayDateString = new Date().toISOString().split('T')[0];
    let defaultDateString = sortedDates[0]; // fallback
    let futureDates = sortedDates.filter(d => d >= todayDateString && d !== '9999-99-99');

    if (futureDates.length > 0) {
        defaultDateString = futureDates[0];
    } else if (sortedDates.length > 0) {
        // If all dates are in the past, get the most recent one
        const pastDates = sortedDates.filter(d => d < todayDateString && d !== '9999-99-99').sort().reverse();
        if (pastDates.length > 0) {
            defaultDateString = pastDates[0];
        }
    }

    page.innerHTML = `
    <h1 class="text-center mb-xl">Calendario Partite - Stagione ${currentSeason.year}</h1>
    
    <div class="filter-container text-center mb-xl">
      <div class="category-select-container" style="max-width: 400px; margin: 0 auto;">
        <label for="date-select" class="category-select-label">Data:</label>
        <select id="date-select" class="group-select">
          <option value="all">Tutte le Date</option>
          ${sortedDates.map(dateKey => `
            <option value="${dateKey}">${matchesByDate[dateKey].title}</option>
          `).join('')}
        </select>
      </div>
    </div>
    
    <div id="matches-content">
      <!-- Content will be dynamically inserted here -->
    </div>
  `;

    const dateSelect = page.querySelector('#date-select');
    const matchesContent = page.querySelector('#matches-content');

    function renderMatchesForDate(selectedDate) {
        if (!matchesContent) return;

        let datesToRender = [];
        if (selectedDate === 'all') {
            datesToRender = sortedDates;
        } else {
            datesToRender = [selectedDate];
        }

        matchesContent.innerHTML = datesToRender.map(dateKey => {
            const group = matchesByDate[dateKey];
            if (!group) return '';

            // Further group matches by category to display them nicely ordered inside the date
            // Optional enhancement, but straightforward listing is fine too.
            // We will sort matches inside the date by time, and then by category.
            const dateMatches = group.matches.sort((a, b) => {
                const timeA = new Date(a.match_date).getTime();
                const timeB = new Date(b.match_date).getTime();
                if (timeA !== timeB) return timeA - timeB;
                const catA = a.category || '';
                const catB = b.category || '';
                return catA.localeCompare(catB);
            });


            return `
        <div class="match-group mb-2xl view-section" style="animation: fadeInUp 0.4s ease forwards;">
          <h2 class="text-center mb-lg" style="
              color: var(--color-black); 
              background: var(--gradient-yellow); 
              padding: 0.8rem 2rem; 
              border-radius: 50px; 
              display: inline-block; 
              text-transform: uppercase; 
              letter-spacing: 1px; 
              font-size: 1.4rem; 
              box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); 
              font-weight: 800;
              margin-left: auto;
              margin-right: auto;
              display: table;
          ">
            ${group.title}
          </h2>
          
          <div class="grid grid-2-desktop gap-lg">
            ${dateMatches.map(match => `
              <div class="glass-card match-card" style="border-left: 5px solid ${getStatusColor(match.status)};">
                <div class="match-header" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem; opacity: 0.9; align-items: center;">
                  <span style="font-weight: 600; color: var(--color-yellow); background: rgba(0,0,0,0.3); padding: 0.2rem 0.6rem; border-radius: 4px;">
                      ${match.category || 'N/A'} - ${match.phase === 'group_stage' ? (match.group?.name || 'Gironi') : formatPhase(match.phase)}
                  </span>
                  <span>${match.match_date ? new Date(match.match_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <span class="status-badge ${match.status === 'live' ? 'live-pulse' : ''}" style="color: ${getStatusColor(match.status)}; font-weight: bold; text-transform: uppercase; background: rgba(0,0,0,0.3); padding: 0.2rem 0.6rem; border-radius: 4px;">
                    ${match.status === 'live' ? '🔴 LIVE' : (match.status === 'completed' ? 'Terminata' : 'Programmata')}
                  </span>
                </div>
                
                <a href="/match/${match.id}" style="text-decoration: none; color: inherit; display: block;" class="mt-md">
                    <div class="match-content" style="display: flex; align-items: center; justify-content: space-between;">
                        <div class="team-home" style="flex: 1; text-align: right; font-weight: ${match.home_score > match.away_score ? '800' : '500'}; color: ${match.home_score > match.away_score ? 'var(--color-yellow)' : 'inherit'}; font-size: 1.1rem;">
                            ${match.home_team?.name || 'TBD'}
                        </div>
                        
                        <div class="match-score" style="
                            padding: 0.5rem 1.5rem; 
                            font-family: var(--font-display); 
                            font-size: 1.8rem; 
                            color: var(--color-white);
                            background: rgba(0,0,0,0.4);
                            border-radius: 8px;
                            margin: 0 1rem;
                            min-width: 100px;
                            text-align: center;
                            font-weight: bold;
                        ">
                            ${match.status === 'scheduled'
                    ? '<span style="font-size: 1.2rem; opacity: 0.7;">VS</span>'
                    : `${match.home_score !== null ? match.home_score : 0} <span style="opacity:0.5; margin:0 4px;">-</span> ${match.away_score !== null ? match.away_score : 0}`
                }
                        </div>
                        
                        <div class="team-away" style="flex: 1; text-align: left; font-weight: ${match.away_score > match.home_score ? '800' : '500'}; color: ${match.away_score > match.home_score ? 'var(--color-yellow)' : 'inherit'}; font-size: 1.1rem;">
                            ${match.away_team?.name || 'TBD'}
                        </div>
                    </div>
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
        }).join('');
    }

    // Handle dropdown changes
    dateSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        renderMatchesForDate(selected);
    });

    // Set initial default value
    if (dateSelect) {
        dateSelect.value = defaultDateString;
        renderMatchesForDate(defaultDateString);
    }

    // Realtime Subscription
    supabase.removeChannel(supabase.channel('public-matches-page'));

    const subscription = supabase
        .channel('public-matches-page')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, async (payload) => {
            console.log('Public Matches Page - update received:', payload);

            const updatedMatchId = payload.new.id;

            // Fetch the full match data including teams
            const { data: fullMatch, error } = await supabase
                .from('matches')
                .select(`
          *,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          group:groups(name)
        `)
                .eq('id', updatedMatchId)
                .single();

            if (error || !fullMatch) return;

            // Update local array
            const matchIndex = allMatches.findIndex(m => m.id === fullMatch.id);
            if (matchIndex !== -1) {
                allMatches[matchIndex] = fullMatch;

                // We need to rebuild the grouping since status or date might have changed.
                // For simplicity we just re-render the currently selected date.
                // But first we must update the specific match inside the groups.

                let dateKey = 'Data da definire';
                let sortDate = '9999-99-99';
                if (fullMatch.match_date) {
                    sortDate = fullMatch.match_date.split('T')[0];
                }

                if (matchesByDate[sortDate]) {
                    const innerIndex = matchesByDate[sortDate].matches.findIndex(m => m.id === fullMatch.id);
                    if (innerIndex !== -1) {
                        matchesByDate[sortDate].matches[innerIndex] = fullMatch;
                    }
                }

                renderMatchesForDate(dateSelect.value);

                // Flash effect
                setTimeout(() => {
                    const matchCards = page.querySelectorAll('.match-card');
                    // Difficult to target by ID easily without adding data-id to HTML, but let's add visual feedback if possible
                }, 100);
            }
        })
        .subscribe();

    return page;
}
