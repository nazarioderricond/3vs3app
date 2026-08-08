import { supabase, getActiveSeason, isAdmin } from '../lib/supabaseClient.js';

export async function renderHomePage() {
  const page = document.createElement('div');
  page.className = 'home-page';

  const activeSeason = await getActiveSeason();
  const showCompetitionLinks = isAdmin() || activeSeason;

  // Render static structure immediately
  page.innerHTML = `
    <div class="hero-section">
      <div class="container">
        <div class="hero-content text-center">
          <img src="/assets/logo_final.png" alt="3vs3 Ischitella" class="logo-blended" style="max-width: 300px;">
          <div id="season-badge-container"></div>
        </div>
      </div>
    </div>
    
    <div class="container mt-2xl">
      <div class="grid ${showCompetitionLinks ? 'grid-2' : 'grid-1'}">
        ${showCompetitionLinks ? `
          <div class="card">
            <h3>⚽ Classifiche</h3>
            <p class="mt-sm">Consulta le classifiche dei gironi e scopri chi è in testa!</p>
            <a href="/standings" data-link class="btn btn-primary mt-md">Vedi Classifiche</a>
          </div>
          
          <div class="card">
            <h3>👥 Squadre</h3>
            <p class="mt-sm">Scopri tutte le squadre partecipanti e i loro giocatori.</p>
            <a href="/teams" data-link class="btn btn-primary mt-md">Vedi Squadre</a>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Fetch data asynchronously
  loadHomeData(page);

  return page;
}

async function loadHomeData(page) {
  try {
    // 1. Get current season
    const { data: currentSeason } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!currentSeason) {
      const badgeContainer = page.querySelector('#season-badge-container');
      if (badgeContainer) {
        badgeContainer.innerHTML = '<p class="mt-md text-yellow">Nessuna stagione attiva al momento</p>';
      }
    }
  } catch (error) {
    console.error('Error loading home data:', error);
  }
}

