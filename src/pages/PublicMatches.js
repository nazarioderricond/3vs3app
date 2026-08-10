import { supabase } from '../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES, PHASE_LABELS, formatPhase } from '../lib/constants.js';

function getStatusColor(status) {
    switch (status) {
        case 'live': return 'var(--color-red)';
        case 'completed': return 'var(--color-yellow)';
        default: return 'var(--color-muted)';
    }
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

    // Get all matches for the season with scorers
    let { data: allMatches } = await supabase
        .from('matches')
        .select(`
      *,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      group:groups(name),
      match_scorers(*, player:players(first_name, last_name))
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

    // Group matches by date using local Italian timezone date
    const matchesByDate = {};
    allMatches.forEach(match => {
        let dateKey = 'Data da definire';
        let sortDate = '9999-99-99'; // Push to end

        if (match.match_date) {
            const date = new Date(match.match_date);
            dateKey = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            sortDate = `${year}-${month}-${day}`;
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
    const now = new Date();
    const todayDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let defaultDateString = sortedDates[0]; // fallback
    let futureDates = sortedDates.filter(d => d >= todayDateString && d !== '9999-99-99');

    if (futureDates.length > 0) {
        defaultDateString = futureDates[0];
    } else if (sortedDates.length > 0) {
        const pastDates = sortedDates.filter(d => d < todayDateString && d !== '9999-99-99').sort().reverse();
        if (pastDates.length > 0) {
            defaultDateString = pastDates[0];
        }
    }

    page.innerHTML = `
    <h1 class="text-center mb-xl">Calendario Partite - Stagione ${currentSeason.year}</h1>
    
    <div class="filter-container text-center mb-xl" style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
      <div class="category-select-container" style="max-width: 400px; margin: 0 auto;">
        <label for="date-select" class="category-select-label">Data:</label>
        <select id="date-select" class="group-select">
          <option value="all">Tutte le Date</option>
          ${sortedDates.map(dateKey => `
            <option value="${dateKey}">${matchesByDate[dateKey].title}</option>
          `).join('')}
        </select>
      </div>

      <button type="button" id="btn-export-social" class="btn-export-social-link">
        <span>Esporta Grafica Social</span>
      </button>
    </div>
    
    <div id="matches-content">
      <!-- Content will be dynamically inserted here -->
    </div>
  `;

    const dateSelect = page.querySelector('#date-select');
    const matchesContent = page.querySelector('#matches-content');
    const btnExport = page.querySelector('#btn-export-social');

    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const selectedDate = dateSelect.value;
            let matchesToExport = [];
            let dateTitle = 'Tutte le Partite';

            if (selectedDate === 'all') {
                matchesToExport = allMatches;
            } else if (matchesByDate[selectedDate]) {
                matchesToExport = matchesByDate[selectedDate].matches;
                dateTitle = matchesByDate[selectedDate].title;
            }

            if (matchesToExport.length === 0) {
                alert('Nessuna partita da esportare per questa data.');
                return;
            }

            btnExport.disabled = true;
            btnExport.innerHTML = '<span>⏳</span><span>Generazione...</span>';

            try {
                await exportMatchesGraphic(dateTitle, matchesToExport);
            } catch (err) {
                console.error('Error generating social image:', err);
                alert('Impossibile generare la grafica. Riprova.');
            } finally {
                btnExport.disabled = false;
                btnExport.innerHTML = '<span>📸</span><span>Esporta Grafica Social</span>';
            }
        });
    }

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
            ${dateMatches.map(match => {
                const homeScorers = match.match_scorers?.filter(s => String(s.team_id) === String(match.home_team_id)) || [];
                const awayScorers = match.match_scorers?.filter(s => String(s.team_id) === String(match.away_team_id)) || [];
                const hasScorers = homeScorers.length > 0 || awayScorers.length > 0;

                return `
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

                    ${hasScorers ? `
                      <div class="match-scorers-summary mt-md pt-xs" style="border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem;">
                        <div style="display: flex; justify-content: space-between; gap: 0.5rem;">
                          <div style="flex: 1; text-align: right; color: var(--color-yellow);">
                            ${homeScorers.map(s => `${s.player ? `${s.player.last_name} ${s.player.first_name}` : 'Autogol'}${s.goals > 1 ? ` (${s.goals})` : ''}`).join(', ')}
                          </div>
                          <div style="opacity: 0.5; font-size: 0.8rem;">⚽</div>
                          <div style="flex: 1; text-align: left; color: var(--color-yellow);">
                            ${awayScorers.map(s => `${s.player ? `${s.player.last_name} ${s.player.first_name}` : 'Autogol'}${s.goals > 1 ? ` (${s.goals})` : ''}`).join(', ')}
                          </div>
                        </div>
                      </div>
                    ` : ''}
                </a>
              </div>
            `;
            }).join('')}
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

            const matchIndex = allMatches.findIndex(m => m.id === fullMatch.id);
            if (matchIndex !== -1) {
                allMatches[matchIndex] = fullMatch;

                let sortDate = '9999-99-99';
                if (fullMatch.match_date) {
                    const d = new Date(fullMatch.match_date);
                    sortDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }

                if (matchesByDate[sortDate]) {
                    const innerIndex = matchesByDate[sortDate].matches.findIndex(m => m.id === fullMatch.id);
                    if (innerIndex !== -1) {
                        matchesByDate[sortDate].matches[innerIndex] = fullMatch;
                    }
                }

                renderMatchesForDate(dateSelect.value);
            }
        })
        .subscribe();

    return page;
}

// Canvas Graphic Generator for Social Export (Instagram Story / Post format)
async function exportMatchesGraphic(dateTitle, matches) {
    const width = 1080;

    // Sort matches chronologically by match_date
    const sortedMatches = [...matches].sort((a, b) => {
        const timeA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const timeB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return timeA - timeB;
    });

    const numMatches = sortedMatches.length;
    const cardHeight = 98;
    const cardGap = 14;
    const cardW = width - 120;
    const cardX = 60;

    // Calculate dynamic canvas height to ensure NO match is ever cut off
    const headerHeight = 300;
    const matchesTotalHeight = numMatches * (cardHeight + cardGap);
    const footerSpace = 90;
    const height = Math.max(1350, headerHeight + matchesTotalHeight + footerSpace);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0c1d13');
    bgGrad.addColorStop(0.5, '#060d09');
    bgGrad.addColorStop(1, '#020503');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Outer Decorative Gold Line
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Inner Corner Accents
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    const cSize = 40;
    ctx.beginPath(); ctx.moveTo(35, 35 + cSize); ctx.lineTo(35, 35); ctx.lineTo(35 + cSize, 35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - 35 - cSize, 35); ctx.lineTo(width - 35, 35); ctx.lineTo(width - 35, 35 + cSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(35, height - 35 - cSize); ctx.lineTo(35, height - 35); ctx.lineTo(35 + cSize, height - 35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - 35 - cSize, height - 35); ctx.lineTo(width - 35, height - 35); ctx.lineTo(width - 35, height - 35 - cSize); ctx.stroke();

    // Draw Logo
    let logoY = 65;
    try {
        const logoImg = new Image();
        logoImg.src = '/assets/logo_final.png';
        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
        });
        if (logoImg.complete && logoImg.naturalWidth !== 0) {
            const logoW = 150;
            const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
            ctx.drawImage(logoImg, (width - logoW) / 2, logoY, logoW, logoH);
            logoY += logoH + 18;
        } else {
            logoY += 25;
        }
    } catch (e) {
        logoY += 25;
    }

    // Main Header Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('TORNEO 3VS3 ISCHITELLA', width / 2, logoY);

    // Date Badge
    logoY += 45;
    const dateText = (dateTitle || 'CALENDARIO PARTITE').toUpperCase();
    ctx.font = 'bold 24px sans-serif';
    const dateW = ctx.measureText(dateText).width + 60;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect((width - dateW) / 2, logoY - 28, dateW, 42, 21);
    } else {
        ctx.rect((width - dateW) / 2, logoY - 28, dateW, 42);
    }
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.fillText(dateText, width / 2, logoY);

    // Render ALL Match Cards (No hardcoded limit!)
    const startY = logoY + 50;

    for (let i = 0; i < numMatches; i++) {
        const m = sortedMatches[i];
        const cardY = startY + i * (cardHeight + cardGap);

        // Card Fill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(cardX, cardY, cardW, cardHeight, 12);
        } else {
            ctx.rect(cardX, cardY, cardW, cardHeight);
        }
        ctx.fill();

        // Card Border
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Category & Time Header inside card
        const timeStr = m.match_date ? new Date(m.match_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
        const catStr = `${m.category || ''} • ${m.group?.name || formatPhase(m.phase)}`;

        ctx.fillStyle = '#ffd700';
        ctx.font = '600 17px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(catStr.toUpperCase(), cardX + 24, cardY + 26);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = 'bold 19px sans-serif';
        ctx.fillText(timeStr, cardX + cardW - 24, cardY + 26);

        // Score / VS Badge in Center
        const midX = width / 2;
        const midY = cardY + cardHeight - 28;

        ctx.textAlign = 'center';
        let scoreText = 'VS';
        if (m.status === 'completed' || m.status === 'live' || m.home_score !== null) {
            scoreText = `${m.home_score !== null ? m.home_score : 0} - ${m.away_score !== null ? m.away_score : 0}`;
        }

        ctx.font = 'bold 24px sans-serif';
        const scoreW = Math.max(95, ctx.measureText(scoreText).width + 28);
        ctx.fillStyle = scoreText === 'VS' ? 'rgba(255, 255, 255, 0.15)' : '#ffd700';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(midX - scoreW / 2, midY - 22, scoreW, 32, 8);
        } else {
            ctx.rect(midX - scoreW / 2, midY - 22, scoreW, 32);
        }
        ctx.fill();

        ctx.fillStyle = scoreText === 'VS' ? '#ffffff' : '#000000';
        ctx.fillText(scoreText, midX, midY);

        // Home Team Name (Left of Score)
        const homeName = (m.home_team?.name || 'TBD').toUpperCase();
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText(homeName, midX - (scoreW / 2) - 18, midY);

        // Away Team Name (Right of Score)
        const awayName = (m.away_team?.name || 'TBD').toUpperCase();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText(awayName, midX + (scoreW / 2) + 18, midY);
    }

    // Footer Branding
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '18px sans-serif';
    ctx.fillText('3vs3ischitella.it  •  #3vs3Ischitella', width / 2, height - 42);

    // Download PNG
    const link = document.createElement('a');
    const filenameDate = dateTitle ? dateTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'giornata';
    link.download = `3vs3_Ischitella_${filenameDate}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

