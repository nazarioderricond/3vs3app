import { supabase } from '../lib/supabaseClient.js';
import { TOURNAMENT_CATEGORIES, PHASE_LABELS, formatPhase } from '../lib/constants.js';
import { isQualifyingMatchForPoll, getMatchPredictions, submitMatchPrediction, getUserVoteForMatch } from '../lib/predictions.js';

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
                const homeScorers = match.match_scorers?.filter(s => String(s.team_id) === String(match.home_team_id) && s.player_id !== null && s.goals > 0) || [];
                const awayScorers = match.match_scorers?.filter(s => String(s.team_id) === String(match.away_team_id) && s.player_id !== null && s.goals > 0) || [];
                const hasScorers = homeScorers.length > 0 || awayScorers.length > 0;

                return `
              <div class="glass-card match-card" style="border-left: 5px solid ${getStatusColor(match.status)}; padding: 1rem;">
                <div class="match-header" style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.85rem; opacity: 0.9; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
                  <span class="match-category-badge" style="font-weight: 600; color: var(--color-yellow); background: rgba(0,0,0,0.3); padding: 0.2rem 0.6rem; border-radius: 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${match.category || 'N/A'} - ${match.group?.name || formatPhase(match.phase)}
                  </span>
                  <div class="match-meta-right" style="display: flex; align-items: center; gap: 0.5rem; margin-left: auto;">
                    <span>${match.match_date ? new Date(match.match_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <span class="status-badge ${match.status === 'live' ? 'live-pulse' : ''}" style="color: ${getStatusColor(match.status)}; font-weight: bold; text-transform: uppercase; background: rgba(0,0,0,0.3); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">
                      ${match.status === 'live' ? '🔴 LIVE' : (match.status === 'completed' ? 'Terminata' : 'Programmata')}
                    </span>
                  </div>
                </div>
                
                <a href="/match/${match.id}" style="text-decoration: none; color: inherit; display: block;" class="mt-xs">
                    <div class="match-content" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                        <div class="team-home" style="flex: 1; text-align: right; font-weight: ${match.home_score > match.away_score ? '800' : '500'}; color: ${match.home_score > match.away_score ? 'var(--color-yellow)' : 'inherit'}; font-size: 1.05rem; word-break: break-word; min-width: 0;">
                            ${match.home_team?.name || 'TBD'}
                        </div>
                        
                        <div class="match-score" style="
                            padding: 0.4rem 0.8rem; 
                            font-family: var(--font-display); 
                            font-size: 1.5rem; 
                            color: var(--color-white);
                            background: rgba(0,0,0,0.4);
                            border-radius: 8px;
                            flex-shrink: 0;
                            min-width: 75px;
                            text-align: center;
                            font-weight: bold;
                        ">
                            ${match.status === 'scheduled'
                    ? '<span style="font-size: 1.1rem; opacity: 0.7;">VS</span>'
                    : `${match.home_score !== null ? match.home_score : 0} <span style="opacity:0.5; margin:0 2px;">-</span> ${match.away_score !== null ? match.away_score : 0}`
                }
                        </div>
                        
                        <div class="team-away" style="flex: 1; text-align: left; font-weight: ${match.away_score > match.home_score ? '800' : '500'}; color: ${match.away_score > match.home_score ? 'var(--color-yellow)' : 'inherit'}; font-size: 1.05rem; word-break: break-word; min-width: 0;">
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

                ${isQualifyingMatchForPoll(match) ? `
                  <div class="match-poll-summary-box mt-sm pt-xs" data-poll-match-id="${match.id}" style="border-top: 1px dashed rgba(255, 215, 0, 0.3); font-size: 0.85rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; gap: 0.5rem; flex-wrap: wrap;">
                      <span style="font-weight: 700; color: var(--color-yellow); display: flex; align-items: center; gap: 0.35rem;">
                        📊 Pronostici Tifosi <span class="poll-voter-count text-muted" style="font-weight: normal; font-size: 0.75rem;">(Caricamento...)</span>
                      </span>
                      <button class="open-poll-btn btn-small" data-match-id="${match.id}" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; background: var(--color-yellow); color: #000; font-weight: 800; border-radius: 20px; border: none; cursor: pointer;">
                        🗳️ Vota Ora
                      </button>
                    </div>

                    <div class="poll-progress-bar-container" style="height: 9px; border-radius: 6px; overflow: hidden; display: flex; background: rgba(255,255,255,0.1); margin-bottom: 0.35rem;">
                      <div class="poll-bar-home" style="width: 33%; background: #22c55e; transition: width 0.5s ease;" title="Squadra Casa"></div>
                      <div class="poll-bar-draw" style="width: 34%; background: #eab308; transition: width 0.5s ease;" title="Pareggio"></div>
                      <div class="poll-bar-away" style="width: 33%; background: #3b82f6; transition: width 0.5s ease;" title="Squadra Ospite"></div>
                    </div>

                    <div class="poll-labels-row" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: rgba(255,255,255,0.85); font-weight: 600;">
                      <span class="poll-label-home" style="color: #22c55e;">33% Casa</span>
                      <span class="poll-label-draw" style="color: #eab308;">34% X</span>
                      <span class="poll-label-away" style="color: #3b82f6;">33% Ospite</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
            }).join('')}
          </div>
        </div>
      `;
        }).join('');

        // Populate poll stats and event listeners for cards
        const pollBoxes = matchesContent.querySelectorAll('.match-poll-summary-box');
        pollBoxes.forEach(async (box) => {
          const mId = box.dataset.pollMatchId;
          const mObj = allMatches.find(m => String(m.id) === String(mId));
          if (mId && mObj) {
            updateMatchCardPollUI(box, mObj);
          }
        });

        // Event Delegation for "🗳️ Vota Ora" buttons
        matchesContent.querySelectorAll('.open-poll-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mId = btn.dataset.matchId;
            const mObj = allMatches.find(m => String(m.id) === String(mId));
            if (mObj) {
              openMatchPollModal(mObj, () => {
                const box = matchesContent.querySelector(`.match-poll-summary-box[data-poll-match-id="${mId}"]`);
                if (box) updateMatchCardPollUI(box, mObj);
              });
            }
          });
        });
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

export async function updateMatchCardPollUI(box, match) {
  if (!box || !match) return;
  const stats = await getMatchPredictions(match.id);

  const voterCountEl = box.querySelector('.poll-voter-count');
  if (voterCountEl) voterCountEl.textContent = `(${stats.totalVotes} ${stats.totalVotes === 1 ? 'voto' : 'voti'})`;

  const barHome = box.querySelector('.poll-bar-home');
  const barDraw = box.querySelector('.poll-bar-draw');
  const barAway = box.querySelector('.poll-bar-away');

  if (barHome) barHome.style.width = `${stats.homePct}%`;
  if (barDraw) barDraw.style.width = `${stats.drawPct}%`;
  if (barAway) barAway.style.width = `${stats.awayPct}%`;

  const lblHome = box.querySelector('.poll-label-home');
  const lblDraw = box.querySelector('.poll-label-draw');
  const lblAway = box.querySelector('.poll-label-away');

  const homeShort = (match.home_team?.name || 'Casa');
  const awayShort = (match.away_team?.name || 'Ospite');

  if (lblHome) lblHome.textContent = `${stats.homePct}% ${homeShort.length > 11 ? homeShort.substring(0, 9) + '..' : homeShort}`;
  if (lblDraw) lblDraw.textContent = `${stats.drawPct}% X`;
  if (lblAway) lblAway.textContent = `${stats.awayPct}% ${awayShort.length > 11 ? awayShort.substring(0, 9) + '..' : awayShort}`;
}

export function openMatchPollModal(match, onVoteSubmitted) {
  const existing = document.getElementById('poll-modal-overlay');
  if (existing) existing.remove();

  const homeName = match.home_team?.name || 'Squadra Casa';
  const awayName = match.away_team?.name || 'Squadra Ospite';
  const matchPhase = match.group?.name || formatPhase(match.phase);

  const modal = document.createElement('div');
  modal.id = 'poll-modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(10px);
    z-index: 10000; display: flex; align-items: center; justify-content: center;
    padding: 1rem; animation: fadeIn 0.3s ease forwards;
  `;

  modal.innerHTML = `
    <div class="glass-card p-lg" style="
      max-width: 500px; width: 100%; border: 2px solid var(--color-yellow);
      border-radius: 20px; box-shadow: 0 0 35px rgba(255, 215, 0, 0.35);
      position: relative; background: linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(10,10,18,0.99) 100%);
    ">
      <button id="close-poll-modal" style="
        position: absolute; top: 15px; right: 20px; background: transparent;
        border: none; color: rgba(255,255,255,0.6); font-size: 1.5rem; cursor: pointer;
      ">✕</button>

      <div class="text-center mb-md">
        <div style="font-size: 2.2rem; margin-bottom: 0.3rem;">🏆 🗳️</div>
        <h3 class="m-0 text-yellow" style="font-size: 1.3rem; font-weight: 800; text-transform: uppercase;">
          Sondaggio Pronostico
        </h3>
        <p class="text-muted mt-xs mb-0" style="font-size: 0.85rem;">
          Seniores • ${matchPhase}
        </p>
      </div>

      <div class="text-center mb-lg p-sm" style="background: rgba(255,255,255,0.05); border-radius: 12px;">
        <h4 style="margin: 0; font-size: 1.05rem; color: #fff; font-weight: 700;">
          Chi vincerà tra <span style="color: var(--color-yellow);">${homeName}</span> e <span style="color: var(--color-yellow);">${awayName}</span>?
        </h4>
      </div>

      <div id="poll-modal-options" class="flex flex-col gap-md mb-md">
        <div class="text-center p-md"><span class="spinner"></span></div>
      </div>

      <div id="poll-voted-badge" class="text-center font-bold text-yellow ${getUserVoteForMatch(match.id) ? '' : 'hidden'}" style="font-size: 0.85rem; padding: 0.4rem; background: rgba(255, 215, 0, 0.1); border-radius: 8px;">
        ✓ Voto espresso! È consentito 1 solo voto per sondaggio.
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('close-poll-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  async function updateModalStats() {
    const stats = await getMatchPredictions(match.id);
    const currentVote = getUserVoteForMatch(match.id);
    const hasVoted = Boolean(currentVote);
    const container = document.getElementById('poll-modal-options');
    if (!container) return;

    container.innerHTML = `
      <!-- HOME OPTION -->
      <button class="poll-option-btn glass-card p-md flex items-center justify-between ${currentVote === 'home' ? 'voted-active' : ''}" data-vote="home" ${hasVoted ? 'disabled' : ''} style="
        border: 1.5px solid ${currentVote === 'home' ? '#22c55e' : 'rgba(255,255,255,0.15)'};
        background: ${currentVote === 'home' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255,255,255,0.05)'};
        cursor: ${hasVoted ? 'default' : 'pointer'}; text-align: left; width: 100%; border-radius: 12px; transition: all 0.2s ease;
        opacity: ${hasVoted && currentVote !== 'home' ? '0.6' : '1'};
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.2rem;">🛡️</span>
          <strong style="color: #fff; font-size: 0.95rem;">${homeName}</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.1rem; font-weight: 800; color: #22c55e;">${stats.homePct}%</span>
          <span class="btn-small" style="background: ${currentVote === 'home' ? '#22c55e' : 'rgba(255,255,255,0.15)'}; color: ${currentVote === 'home' ? '#000' : '#fff'}; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem;">
            ${currentVote === 'home' ? '✓ Tuo Voto' : (hasVoted ? 'Scelta' : 'Vota')}
          </span>
        </div>
      </button>

      <!-- DRAW OPTION -->
      <button class="poll-option-btn glass-card p-md flex items-center justify-between ${currentVote === 'draw' ? 'voted-active' : ''}" data-vote="draw" ${hasVoted ? 'disabled' : ''} style="
        border: 1.5px solid ${currentVote === 'draw' ? '#eab308' : 'rgba(255,255,255,0.15)'};
        background: ${currentVote === 'draw' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255,255,255,0.05)'};
        cursor: ${hasVoted ? 'default' : 'pointer'}; text-align: left; width: 100%; border-radius: 12px; transition: all 0.2s ease;
        opacity: ${hasVoted && currentVote !== 'draw' ? '0.6' : '1'};
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.2rem;">🤝</span>
          <strong style="color: #fff; font-size: 0.95rem;">PAREGGIO (X)</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.1rem; font-weight: 800; color: #eab308;">${stats.drawPct}%</span>
          <span class="btn-small" style="background: ${currentVote === 'draw' ? '#eab308' : 'rgba(255,255,255,0.15)'}; color: ${currentVote === 'draw' ? '#000' : '#fff'}; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem;">
            ${currentVote === 'draw' ? '✓ Tuo Voto' : (hasVoted ? 'Scelta' : 'Vota')}
          </span>
        </div>
      </button>

      <!-- AWAY OPTION -->
      <button class="poll-option-btn glass-card p-md flex items-center justify-between ${currentVote === 'away' ? 'voted-active' : ''}" data-vote="away" ${hasVoted ? 'disabled' : ''} style="
        border: 1.5px solid ${currentVote === 'away' ? '#3b82f6' : 'rgba(255,255,255,0.15)'};
        background: ${currentVote === 'away' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)'};
        cursor: ${hasVoted ? 'default' : 'pointer'}; text-align: left; width: 100%; border-radius: 12px; transition: all 0.2s ease;
        opacity: ${hasVoted && currentVote !== 'away' ? '0.6' : '1'};
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.2rem;">🛡️</span>
          <strong style="color: #fff; font-size: 0.95rem;">${awayName}</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.1rem; font-weight: 800; color: #3b82f6;">${stats.awayPct}%</span>
          <span class="btn-small" style="background: ${currentVote === 'away' ? '#3b82f6' : 'rgba(255,255,255,0.15)'}; color: #fff; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem;">
            ${currentVote === 'away' ? '✓ Tuo Voto' : (hasVoted ? 'Scelta' : 'Vota')}
          </span>
        </div>
      </button>

      <div class="text-center text-muted text-xs mt-xs">
        Totale Voti: <strong>${stats.totalVotes}</strong>
      </div>
    `;

    if (!hasVoted) {
      container.querySelectorAll('.poll-option-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const voteChoice = e.currentTarget.dataset.vote;
          await submitMatchPrediction(match.id, voteChoice);
          const badge = document.getElementById('poll-voted-badge');
          if (badge) badge.classList.remove('hidden');
          await updateModalStats();
          if (onVoteSubmitted) onVoteSubmitted();
        });
      });
    }
  }

  updateModalStats();
}

