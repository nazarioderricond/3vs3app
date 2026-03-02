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
          <!-- Subtitle removed as per request -->
          <div id="season-badge-container"></div>
        </div>
      </div>
    </div>
    
    <div class="container mt-2xl">
      <div class="grid grid-2">
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
        
        <div class="card">
          <h3>📜 Storico</h3>
          <p class="mt-sm">Rivivi le passate edizioni del torneo e i loro campioni.</p>
          <a href="/history" data-link class="btn btn-primary mt-md">Vedi Storico</a>
        </div>
        
        <div class="card">
          <h3>📰 News</h3>
          <p class="mt-sm">Resta aggiornato con le ultime news dalla pagina Facebook.</p>
          <a href="/news" data-link class="btn btn-primary mt-md">Vedi News</a>
        </div>
      </div>
      
      <div id="latest-news-container" class="mt-2xl hidden">
        <h2 class="text-center mb-lg">Ultime News</h2>
        <div class="grid grid-3" id="news-grid">
          <!-- News will be injected here -->
        </div>
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

    if (currentSeason) {
      const subtitle = page.querySelector('#season-subtitle');
      const badgeContainer = page.querySelector('#season-badge-container');

      // User requested removal of "Torneo a X Squadre" and "Stagione Y"
      // Keeping subtitle static as "Torneo di Calcio" (default in HTML)
      // Removing Badge logic
      /*
      if (subtitle) subtitle.textContent = `Torneo di Calcio a ${currentSeason.team_count} Squadre`;
      if (badgeContainer) {
        badgeContainer.innerHTML = `
          <div class="season-badge mt-lg">
            <span class="badge" style="font-size: 1.5rem; padding: 0.5rem 2rem;">
              Stagione ${currentSeason.year}
            </span>
          </div>
        `;
      }
      */
    } else {
      const badgeContainer = page.querySelector('#season-badge-container');
      if (badgeContainer) {
        badgeContainer.innerHTML = '<p class="mt-md text-yellow">Nessuna stagione attiva al momento</p>';
      }
    }

    // 2. Get latest news
    const { data: latestNews } = await supabase
      .from('news_posts')
      .select('*')
      .order('created_time', { ascending: false })
      .limit(3);

    if (latestNews && latestNews.length > 0) {
      const newsContainer = page.querySelector('#latest-news-container');
      const newsGrid = page.querySelector('#news-grid');

      if (newsContainer && newsGrid) {
        newsContainer.classList.remove('hidden');
        newsGrid.innerHTML = latestNews.map(post => `
          <div class="glass-card">
            ${post.full_picture ? `
              <img src="${post.full_picture}" alt="News" style="width: 100%; border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
            ` : ''}
            <p style="font-size: 0.875rem; color: var(--color-yellow);">
              ${new Date(post.created_time).toLocaleDateString('it-IT')}
            </p>
            <p class="mt-sm">${post.message ? post.message.substring(0, 150) + '...' : ''}</p>
            ${post.permalink_url ? `
              <a href="${post.permalink_url}" target="_blank" class="btn btn-secondary mt-md" style="font-size: 0.875rem; padding: 0.5rem 1rem;">
                Leggi di più
              </a>
            ` : ''}
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Error loading home data:', error);
  }
}
