// Main Application Router
import { initAuth, currentUser, currentProfile, isAdmin } from './lib/supabaseClient.js';
import { renderNavbar } from './components/AppNavbar.js';

// Page imports
import { renderLoginPage } from './pages/Login.js';
import { renderRegisterPage } from './pages/Register.js';
import { renderHomePage } from './pages/HomePage.js';
import { renderStandingsPage } from './pages/Standings.js';
import { renderTeamsPage } from './pages/Teams.js';
import { renderHistoryPage } from './pages/History.js';
import { renderNewsPage } from './pages/News.js';
import { renderTeamDetailsPage } from './pages/TeamDetails.js';
import { renderMatchDetailsPage } from './pages/MatchDetails.js';
import { renderPublicMatchesPage } from './pages/PublicMatches.js';
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
    '/standings': { component: renderStandingsPage, requireAuth: true },
    '/teams': { component: renderTeamsPage, requireAuth: true },
    '/matches': { component: renderPublicMatchesPage, requireAuth: true },
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
    try {
        await initAuth(renderCurrentPage);
        console.log('App: initAuth completed');
    } catch (e) {
        console.error('App: initAuth failed', e);
    }

    // Hide loading screen
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Set up navigation
    setupRouter();

    // Render initial page
    // Render initial page
    // renderCurrentPage(); // Removed to avoid double rendering (initAuth callback handles it)
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
    // Teams, Standings, and Matches are only visible if there is an active season OR user is admin
    if ((window.location.pathname === '/teams' || window.location.pathname === '/standings' || window.location.pathname === '/matches') && !isAdmin()) {
        const { getActiveSeason } = await import('./lib/supabaseClient.js');
        const activeSeason = await getActiveSeason();
        if (!activeSeason) {
            console.log('No active season, redirecting to home');
            navigateTo('/');
            return;
        }
    }

    // Render navbar
    const navbarContainer = document.getElementById('navbar');
    if (currentUser) {
        const navbarElement = await renderNavbar();
        // Robust clearing: remove all children
        while (navbarContainer.firstChild) {
            navbarContainer.removeChild(navbarContainer.firstChild);
        }
        navbarContainer.appendChild(navbarElement);
    } else {
        while (navbarContainer.firstChild) {
            navbarContainer.removeChild(navbarContainer.firstChild);
        }
    }

    // Check for zombie session (Auth OK but Profile Missing)
    // Only redirect if we are not already on the register page to avoid loops
    if (currentUser && !currentProfile) {
        if (window.location.pathname !== '/register') {
            console.log('Zombie session detected, redirecting to register');
            navigateTo('/register');
            return;
        }
    }

    // Render page content
    // Render page content
    // Render page content
    const pageContent = await route.component(params);
    const contentContainer = document.getElementById('content');

    // Robust clearing: remove all children
    while (contentContainer.firstChild) {
        contentContainer.removeChild(contentContainer.firstChild);
    }
    contentContainer.appendChild(pageContent);
}

// Start the app
init();
