import { supabase, isAdmin } from '../lib/supabaseClient.js';

export async function renderNewsPage() {
  const page = document.createElement('div');
  page.className = 'news-page container mt-xl';

  // Get news posts
  const { data: newsPosts } = await supabase
    .from('news_posts')
    .select('*')
    .order('created_time', { ascending: false });

  const adminUser = await isAdmin();

  page.innerHTML = `
    <h1 class="text-center mb-xl" style="font-size: 3rem; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 20px rgba(223, 247, 4, 0.3);">
      <span class="text-yellow">News</span> dal Torneo
    </h1>
    
    ${adminUser ? `
      <div class="admin-actions mb-2xl glass-card p-lg">
        <h3 class="mb-md text-yellow">Gestione News</h3>
        <div class="flex gap-md wrap" style="justify-content: center;">
          <button class="btn btn-primary" id="sync-fb-btn">
            🔄 Sincronizza con Facebook
          </button>
          <button class="btn btn-secondary" id="toggle-manual-form">
            ✍️ Scrivi News Manuale
          </button>
        </div>
        <p id="sync-status" class="mt-sm text-yellow hidden text-center"></p>
        
        <!-- Manual Entry Form (Hidden by default) -->
        <form id="manual-news-form" class="mt-lg hidden" style="max-width: 600px; margin: 1rem auto; text-align: left;">
          <div class="form-group mb-md">
            <label class="form-label">Messaggio</label>
            <textarea name="message" class="form-input" rows="4" required placeholder="Scrivi il contenuto della news..."></textarea>
          </div>
          <div class="form-group mb-md">
            <label class="form-label">URL Immagine (Opzionale)</label>
            <input type="url" name="full_picture" class="form-input" placeholder="https://esempio.com/immagine.jpg">
          </div>
          <button type="submit" class="btn btn-primary w-100">Pubblica News</button>
        </form>
      </div>
    ` : ''}
    
    <div class="news-grid grid grid-3-desktop" style="gap: 2rem;">
      ${newsPosts && newsPosts.length > 0 ? newsPosts.map(post => `
        <div class="news-card glass-card hover-scale" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
          ${post.full_picture ? `
            <div class="news-image" style="height: 200px; overflow: hidden;">
              <img src="${post.full_picture}" alt="News Image" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
            </div>
          ` : ''}
          
          <div class="news-content p-lg flex-grow flex column">
            <div class="news-date text-sm text-muted mb-sm flex align-center gap-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${new Date(post.created_time).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}
            </div>
            
            <p class="news-message mb-lg" style="line-height: 1.6;">
              ${post.message ? (post.message.length > 150 ? post.message.substring(0, 150) + '...' : post.message) : 'Vedi post su Facebook'}
            </p>
            
            <div class="mt-auto">
              ${post.permalink_url ? `
                <a href="${post.permalink_url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary w-100 text-center">
                  Leggi su Facebook
                </a>
              ` : `
                <button class="btn btn-outline-secondary w-100 text-center" disabled>
                  News Interna
                </button>
              `}
            </div>
          </div>
        </div>
      `).join('') : `
        <div class="text-center glass-card p-2xl" style="grid-column: 1 / -1;">
          <h3 class="text-muted">Nessuna news disponibile</h3>
          <p class="mt-sm text-muted">
            Le news dalla pagina Facebook appariranno qui automaticamente.
          </p>
        </div>
      `}
    </div>
  `;

  // Admin Logic
  if (adminUser) {
    // Toggle Manual Form
    const toggleBtn = page.querySelector('#toggle-manual-form');
    const manualForm = page.querySelector('#manual-news-form');
    if (toggleBtn && manualForm) {
      toggleBtn.addEventListener('click', () => {
        manualForm.classList.toggle('hidden');
        toggleBtn.textContent = manualForm.classList.contains('hidden') ? '✍️ Scrivi News Manuale' : '❌ Chiudi Form';
      });

      // Handle Manual Submit
      manualForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(manualForm);
        const message = formData.get('message');
        const full_picture = formData.get('full_picture');

        try {
          const { error } = await supabase
            .from('news_posts')
            .insert({
              message,
              full_picture: full_picture || null,
              author: 'Admin', // Could get actual user name if needed
              created_time: new Date().toISOString()
            });

          if (error) throw error;

          alert('News pubblicata con successo!');
          window.location.reload();
        } catch (error) {
          console.error('Error publishing news:', error);
          alert('Errore durante la pubblicazione: ' + error.message);
        }
      });
    }

    // Facebook Sync Logic
    const syncBtn = page.querySelector('#sync-fb-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        const statusEl = page.querySelector('#sync-status');
        // Import config dynamically
        const configModule = await import('../config.js');
        const config = configModule.default;

        const pageId = config.facebook.pageId;
        const accessToken = config.facebook.accessToken;

        if (!pageId || !accessToken || accessToken.includes('YOUR_FACEBOOK')) {
          alert('Token di accesso Facebook mancante in config.js. Inserisci un token valido per sincronizzare.');
          return;
        }

        try {
          syncBtn.disabled = true;
          syncBtn.textContent = 'Sincronizzazione in corso...';
          statusEl.textContent = 'Contatto Facebook API...';
          statusEl.classList.remove('hidden');

          // Fetch posts from Facebook Graph API
          // Note: For Groups, we need a User Token and the user must be admin of the group
          const response = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}/feed?fields=id,message,full_picture,created_time,permalink_url&access_token=${accessToken}&limit=10`
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Errore nella richiesta a Facebook');
          }

          const data = await response.json();
          const posts = data.data;

          statusEl.textContent = `Trovati ${posts.length} post. Salvataggio...`;

          // Save to Supabase
          let newCount = 0;
          for (const post of posts) {
            const { error } = await supabase
              .from('news_posts')
              .upsert({
                facebook_post_id: post.id,
                message: post.message,
                full_picture: post.full_picture,
                created_time: post.created_time,
                permalink_url: post.permalink_url
              }, { onConflict: 'facebook_post_id' });

            if (!error) newCount++;
          }

          alert(`Sincronizzazione completata! Aggiornati ${newCount} post.`);
          window.location.reload();

        } catch (error) {
          console.error('Facebook Sync Error:', error);
          alert('Errore durante la sincronizzazione: ' + error.message);
          statusEl.textContent = 'Errore: ' + error.message;
        } finally {
          syncBtn.disabled = false;
          syncBtn.textContent = '🔄 Sincronizza con Facebook';
        }
      });
    }
  }

  return page;
}
