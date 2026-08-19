// Main Application Router
import { initAuth, currentUser, currentProfile, isAdmin } from './lib/supabaseClient.js';
import { renderNavbar } from './components/AppNavbar.js';

// Page imports
import { renderLoginPage } from './pages/Login.js';
import { renderRegisterPage } from './pages/Register.js';
import { renderResetPasswordPage } from './pages/ResetPassword.js';
import { renderHomePage } from './pages/HomePage.js';
import { renderStandingsPage } from './pages/Standings.js';
import { renderTeamsPage } from './pages/Teams.js';
import { renderHistoryPage } from './pages/History.js';
import { renderNewsPage } from './pages/News.js';
import { renderTeamDetailsPage } from './pages/TeamDetails.js';
import { renderMatchDetailsPage } from './pages/MatchDetails.js';
import { renderPublicMatchesPage } from './pages/PublicMatches.js';
import { renderRulesPage } from './pages/Rules.js';
import { renderAdminSeasonsPage } from './pages/admin/Seasons.js';
import { renderAdminTeamsPage } from './pages/admin/Teams.js';
import { renderAdminPlayersPage } from './pages/admin/Players.js';
import { renderAdminMatchesPage } from './pages/admin/Matches.js';
import { renderAdminAdminsPage } from './pages/admin/Admins.js';
import { renderAdminGroupsPage } from './pages/admin/Groups.js';

// App state
let currentRoute = window.location.pathname;

// Routes configuration
const routes = {
    '/': { component: renderHomePage, requireAuth: true },
    '/login': { component: renderLoginPage, requireAuth: false },
    '/register': { component: renderRegisterPage, requireAuth: false },
    '/reset-password': { component: renderResetPasswordPage, requireAuth: false },
    '/standings': { component: renderStandingsPage, requireAuth: true },
    '/teams': { component: renderTeamsPage, requireAuth: true },
    '/matches': { component: renderPublicMatchesPage, requireAuth: true },
    '/rules': { component: renderRulesPage, requireAuth: true },
    '/history': { component: renderHistoryPage, requireAuth: true },
    '/news': { component: renderNewsPage, requireAuth: false },
    '/admin/seasons': { component: renderAdminSeasonsPage, requireAuth: true, requireAdmin: true },
    '/admin/teams': { component: renderAdminTeamsPage, requireAuth: true, requireAdmin: true },
    '/admin/players': { component: renderAdminPlayersPage, requireAuth: true, requireAdmin: true },
    '/admin/matches': { component: renderAdminMatchesPage, requireAuth: true, requireAdmin: true },
    '/admin/admins': { component: renderAdminAdminsPage, requireAuth: true, requireAdmin: true },
    '/admin/groups': { component: renderAdminGroupsPage, requireAuth: true, requireAdmin: true },
    '/team/:id': { component: renderTeamDetailsPage, requireAuth: true },
    '/match/:id': { component: renderMatchDetailsPage, requireAuth: true },
};

// Initialize app
async function init() {
    console.log('App: init() started');

    // Safety fallback: Ensure initial loading screen is NEVER stuck for more than 2.5s on mobile PWA
    const hideLoading = () => {
        const loadingEl = document.getElementById('loading');
        const mainAppEl = document.getElementById('main-app');
        if (loadingEl && !loadingEl.classList.contains('hidden')) {
            loadingEl.classList.add('hidden');
            mainAppEl.classList.remove('hidden');
        }
    };
    const safetyTimeout = setTimeout(hideLoading, 2500);

    try {
        await initAuth(renderCurrentPage);
        console.log('App: initAuth completed');
    } catch (e) {
        console.error('App: initAuth failed', e);
    } finally {
        clearTimeout(safetyTimeout);
        hideLoading();
    }

    // Set up navigation
    setupRouter();
}

// Setup client-side routing
function setupRouter() {
    // Handle navigation clicks
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-link]')) {
            e.preventDefault();
            navigateTo(e.target.getAttribute('href'));
        }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        renderCurrentPage();
    });
}

// Navigate to a new route
export function navigateTo(path) {
    console.log('Navigating to:', path);
    // Prevent infinite loops: do not navigate if already on the target path
    if (path === window.location.pathname) {
        return;
    }
    window.history.pushState({}, '', path);
    currentRoute = path;
    renderCurrentPage();
}

// Render the current page
export async function renderCurrentPage() {
    const path = window.location.pathname;
    let route = routes[path];
    let params = {};

    // If no exact match, try matching dynamic routes
    if (!route) {
        for (const key in routes) {
            if (key.includes(':')) {
                const routeParts = key.split('/');
                const pathParts = path.split('/');

                if (routeParts.length === pathParts.length) {
                    let match = true;
                    let tempParams = {};

                    for (let i = 0; i < routeParts.length; i++) {
                        if (routeParts[i].startsWith(':')) {
                            const paramName = routeParts[i].slice(1);
                            tempParams[paramName] = pathParts[i];
                        } else if (routeParts[i] !== pathParts[i]) {
                            match = false;
                            break;
                        }
                    }

                    if (match) {
                        route = routes[key];
                        params = tempParams;
                        break;
                    }
                }
            }
        }
    }

    // Parse Query Parameters
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
        params[key] = value;
    }

    // Default to home if still no match
    if (!route) {
        route = routes['/'];
    }

    // Check authentication requirements
    if (route.requireAuth && !currentUser) {
        navigateTo('/login');
        return;
    }

    // Redirect authenticated users away from auth pages
    // Exception: Allow /register if profile is missing (to allow completion)
    if (!route.requireAuth && currentUser) {
        if (window.location.pathname === '/login') {
            navigateTo('/');
            return;
        }
        if (window.location.pathname === '/register' && currentProfile) {
            navigateTo('/');
            return;
        }
    }

    // Check admin requirements
    if (route.requireAdmin && !isAdmin()) {
        navigateTo('/');
        return;
    }

    // Check season requirements for non-admins
    if ((window.location.pathname === '/teams' || window.location.pathname === '/standings' || window.location.pathname === '/matches') && !isAdmin()) {
        try {
            const { getActiveSeason } = await import('./lib/supabaseClient.js');
            const activeSeason = await getActiveSeason();
            if (!activeSeason) {
                console.log('No active season, redirecting to home');
                navigateTo('/');
                return;
            }
        } catch (err) {
            console.warn('Error checking active season:', err);
        }
    }

    // Render navbar
    const navbarContainer = document.getElementById('navbar');
    if (currentUser) {
        try {
            const navbarElement = await renderNavbar();
            while (navbarContainer.firstChild) {
                navbarContainer.removeChild(navbarContainer.firstChild);
            }
            navbarContainer.appendChild(navbarElement);
        } catch (err) {
            console.warn('Error rendering navbar:', err);
        }
    } else {
        while (navbarContainer.firstChild) {
            navbarContainer.removeChild(navbarContainer.firstChild);
        }
    }

    // Check for zombie session (Auth OK but Profile Missing)
    if (currentUser && !currentProfile) {
        if (window.location.pathname !== '/register') {
            console.log('Zombie session detected, redirecting to register');
            navigateTo('/register');
            return;
        }
    }

    // Render page content with error boundary & mobile recovery
    const contentContainer = document.getElementById('content');
    try {
        const pageContent = await route.component(params);
        while (contentContainer.firstChild) {
            contentContainer.removeChild(contentContainer.firstChild);
        }
        contentContainer.appendChild(pageContent);
    } catch (err) {
        console.error('Error rendering page component:', err);
        while (contentContainer.firstChild) {
            contentContainer.removeChild(contentContainer.firstChild);
        }
        contentContainer.innerHTML = `
            <div class="glass-card text-center p-xl mt-xl" style="margin: 2rem auto; max-width: 500px;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">📱⚡</div>
                <h3 class="text-yellow mb-md">Connessione Mobile Lenta</h3>
                <p class="text-muted mb-lg" style="font-size: 0.9rem;">
                    Non è stato possibile caricare i dati in questo momento. Verifica la tua connessione internet e riprova.
                </p>
                <button class="btn btn-primary" onclick="window.location.reload()" style="padding: 0.6rem 1.5rem; font-weight: bold;">
                    🔄 Ricarica Pagina
                </button>
            </div>
        `;
    }
}

// Start the app
init();
initPWA();

// PWA Installation & Service Worker Registration
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('[PWA] ServiceWorker registration failed:', err);
      });
    });
  }

  // Check if app is already running in standalone mode (installed)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return;

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const deferredPrompt = e;
    showInstallBanner(deferredPrompt);
  });
}

function showInstallBanner(deferredPrompt) {
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'glass-card p-md flex items-center justify-between gap-md';
  banner.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    width: 90%; max-width: 450px; z-index: 9999; border: 2px solid var(--color-yellow);
    box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 12px;
  `;

  banner.innerHTML = `
    <div class="flex items-center gap-md">
      <img src="/assets/logo_final.png" alt="Logo" style="width: 40px; height: 40px; border-radius: 8px;">
      <div>
        <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">Installa l'App</h4>
        <p style="margin: 0; font-size: 0.75rem; color: var(--color-muted);">Accedi più velocemente dalla home</p>
      </div>
    </div>
    <div class="flex items-center gap-xs">
      <button id="pwa-install-btn" class="btn btn-primary btn-small" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Installa</button>
      <button id="pwa-dismiss-btn" class="btn-icon" style="color: var(--color-muted); font-size: 1.2rem;">✕</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    banner.remove();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
  });

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    banner.remove();
  });
}
