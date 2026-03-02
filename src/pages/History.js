import { navigateTo } from '../application.js';
import { supabase } from '../lib/supabaseClient.js';

export async function renderHistoryPage() {
  const page = document.createElement('div');
  page.className = 'history-page container mt-xl';

  // Get archived seasons
  const { data: archivedSeasons } = await supabase
    .from('seasons')
    .select('*')
    .eq('status', 'archived')
    .order('year', { ascending: false });

  page.innerHTML = `
    <h1 class="text-center mb-xl">Storico Tornei</h1>
    
    <div class="timeline">
      ${archivedSeasons && archivedSeasons.length > 0 ? archivedSeasons.map((season, index) => `
        <div class="timeline-item" style="animation-delay: ${index * 0.1}s;">
          <div class="timeline-marker"></div>
          <div class="timeline-content glass-card">
            <div class="season-header">
              <h2>Stagione ${season.year}</h2>
              <span class="badge badge-user">Archiviata</span>
            </div>
            
            <div class="season-info mt-md">
              <div class="info-item">
                <span class="info-label">Squadre Partecipanti:</span>
                <span class="info-value">${season.team_count}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Numero Gironi:</span>
                <span class="info-value">${season.group_count}</span>
              </div>
              ${season.playoff_start_phase ? `
                <div class="info-item">
                  <span class="info-label">Fase Playoff:</span>
                  <span class="info-value">${getPhaseLabel(season.playoff_start_phase)}</span>
                </div>
              ` : ''}
            </div>
            
            <button class="btn btn-secondary mt-md view-season-btn" data-season-id="${season.id}">
              Vedi Dettagli
            </button>
          </div>
        </div>
      `).join('') : `
        <div class="text-center">
          <p>Nessuna stagione archiviata.</p>
          <p class="mt-sm" style="opacity: 0.7;">Le stagioni completate appariranno qui.</p>
        </div>
      `}
    </div>
  `;

  // Add click handlers for viewing season details
  const viewButtons = page.querySelectorAll('.view-season-btn');
  viewButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const seasonId = e.target.dataset.seasonId;
      navigateTo(`/standings?season=${seasonId}`);
    });
  });

  return page;
}

function getPhaseLabel(phase) {
  const labels = {
    'round_16': 'Ottavi di Finale',
    'quarterfinals': 'Quarti di Finale',
    'semifinals': 'Semifinali',
  };
  return labels[phase] || phase;
}
