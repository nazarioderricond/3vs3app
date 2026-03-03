import { currentProfile, signOut, isAdmin, getActiveSeason } from '../lib/supabaseClient.js';
// import { navigateTo } from '../application.js'; // Removed to break circular dependency

export async function renderNavbar() {
  const nav = document.createElement('nav');
  nav.className = 'navbar';

  const activeSeason = await getActiveSeason();
  console.log('AppNavbar Debug:', {
    isAdmin: isAdmin(),
    activeSeason,
    showLinks: isAdmin() || !!activeSeason
  });
  const showCompetitionLinks = isAdmin() || activeSeason;

  const navHTML = `
    <div class="navbar-container">
      <div class="navbar-logo">
        <a href="/" data-link>
          <img src="/assets/logo_final.png" alt="3vs3 Ischitella" class="logo-img">
        </a>
      </div>
      
      <div class="navbar-menu">
        <a href="/" data-link class="nav-link">Home</a>
        ${showCompetitionLinks ? `
          <a href="/standings" data-link class="nav-link">Classifiche</a>
          <a href="/teams" data-link class="nav-link">Squadre</a>
        ` : ''}
        <a href="/history" data-link class="nav-link">Storico</a>
        <a href="/news" data-link class="nav-link">News</a>
        
        ${isAdmin() ? `
          <div class="nav-dropdown desktop-only">
            <button class="nav-link dropdown-toggle">Admin</button>
            <div class="dropdown-menu">
              <a href="/admin/seasons" data-link class="dropdown-item">Gestione Stagioni</a>
              <a href="/admin/groups" data-link class="dropdown-item">Gestione Gironi</a>
              <a href="/admin/teams" data-link class="dropdown-item">Gestione Squadre</a>
              <a href="/admin/players" data-link class="dropdown-item">Gestione Giocatori</a>
              <a href="/admin/matches" data-link class="dropdown-item">Gestione Partite</a>
              <a href="/admin/admins" data-link class="dropdown-item">Gestione Amministratori</a>
            </div>
          </div>
          <!-- Mobile Admin Links (Flat list) -->
          <div class="mobile-only-links" style="background: rgba(255, 215, 0, 0.05); border-radius: 8px; padding-bottom: 1rem; border: 1px solid rgba(255, 215, 0, 0.2);">
             <div class="nav-divider" style="color: var(--color-yellow); font-size: 1rem; border-bottom: 1px solid rgba(255,215,0,0.2); margin-bottom: 0.5rem; padding-bottom: 0.5rem; text-align: center;">Gestione Admin</div>
             <a href="/admin/seasons" data-link class="nav-link">Stagioni</a>
             <a href="/admin/groups" data-link class="nav-link">Gironi</a>
             <a href="/admin/teams" data-link class="nav-link">Squadre</a>
             <a href="/admin/players" data-link class="nav-link">Giocatori</a>
             <a href="/admin/matches" data-link class="nav-link">Partite</a>
          </div>
        ` : ''}

        <!-- Mobile User Controls -->
        ${currentProfile ? `
          <div class="mobile-user-controls">
            <div class="nav-divider" style="text-align: center; margin-top: 1rem;">Profilo (${currentProfile.first_name})</div>
            <button class="nav-link" id="mobile-logout-btn" style="color: #ff4444; font-weight: 700; text-transform: uppercase;">Logout</button>
          </div>
        ` : ''}
      </div>
      
      <!-- Desktop User Controls (Hidden on Mobile via CSS) -->
      <div class="navbar-user desktop-user-controls">
        ${currentProfile ? `
          <div class="user-info">
            ${currentProfile.profile_image_url ? `
              <img src="${currentProfile.profile_image_url}" alt="Profile" class="user-avatar">
            ` : `
              <div class="user-avatar-placeholder">${currentProfile.first_name[0]}${currentProfile.last_name[0]}</div>
            `}
            <span class="user-name">${currentProfile.first_name} ${currentProfile.last_name}</span>
            ${isAdmin() ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-user">User</span>'}
            <button class="btn-logout" id="logout-btn">Logout</button>
            <button class="btn-logout" id="reset-btn" style="background: #dc2626; margin-left: 0.5rem;">RESET</button>
          </div>
        ` : ''}
      </div>
      
      <button class="navbar-toggle" id="mobile-menu-toggle">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  `;

  nav.innerHTML = navHTML;

  // Add event listeners
  const logoutBtn = nav.querySelector('#logout-btn');
  const mobileLogoutBtn = nav.querySelector('#mobile-logout-btn');

  const handleLogout = async () => {
    await signOut();
  };

  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

  // Reset button logic
  const resetBtn = nav.querySelector('#reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      localStorage.clear();
      sessionStorage.clear();
      await signOut();
      window.location.reload();
    });
  }

  // Mobile menu toggle
  const mobileToggle = nav.querySelector('#mobile-menu-toggle');
  const navMenu = nav.querySelector('.navbar-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  // Close mobile menu when any nav link is clicked
  const allNavLinks = nav.querySelectorAll('[data-link]');
  allNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu) {
        navMenu.classList.remove('active');
      }
    });
  });

  return nav;
}
