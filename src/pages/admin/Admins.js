import { supabase, isAdmin } from '../../lib/supabaseClient.js';
import { navigateTo } from '../../application.js';

export async function renderAdminAdminsPage() {
  if (!isAdmin()) {
    navigateTo('/');
    return document.createElement('div');
  }

  const page = document.createElement('div');
  page.className = 'admin-admins-page container mt-xl';

  page.innerHTML = `
    <h1 class="text-center mb-xl">Gestione Amministratori</h1>
    
    <div class="card mb-lg">
      <h3 class="mb-md">Lista Utenti</h3>
      <div class="input-group">
        <input type="text" id="user-search" placeholder="Cerca utente per nome o email..." class="mb-md">
      </div>
      
      <div class="table-responsive" style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%;">
        <table class="w-100" style="width: 100%; min-width: 600px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--color-yellow);">
              <th class="text-left p-sm" style="white-space: nowrap;">Utente</th>
              <th class="text-left p-sm">Email</th>
              <th class="text-center p-sm">Ruolo</th>
              <th class="text-right p-sm" style="white-space: nowrap;">Azioni</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="4" class="text-center p-md">Caricamento...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Fetch users
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('first_name');

  if (error) {
    page.querySelector('#users-table-body').innerHTML = `<tr><td colspan="4" class="text-center p-md text-red">Errore: ${error.message}</td></tr>`;
    return page;
  }

  const renderUsers = (users) => {
    const tbody = page.querySelector('#users-table-body');
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center p-md">Nessun utente trovato</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(user => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td class="p-sm" style="min-width: 150px;">
          <div style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
            ${user.profile_image_url ?
        `<img src="${user.profile_image_url}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">` :
        `<div style="width: 30px; height: 30px; border-radius: 50%; background: var(--color-yellow); color: black; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${user.first_name[0]}</div>`
      }
            <span style="overflow: hidden; text-overflow: ellipsis;">${user.first_name} ${user.last_name}</span>
          </div>
        </td>
        <td class="p-sm" style="opacity: 0.8; word-break: break-all; min-width: 150px;">${user.email || 'N/A'}</td>
        <td class="text-center p-sm" style="white-space: nowrap;">
          <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">
            ${user.role === 'admin' ? 'ADMIN' : 'USER'}
          </span>
        </td>
        <td class="text-right p-sm" style="white-space: nowrap; min-width: 140px;">
          <button class="btn btn-sm role-toggle-btn" 
            data-user-id="${user.id}" 
            data-current-role="${user.role}"
            style="font-size: 0.8rem; padding: 0.4rem 0.6rem; border: 1px solid var(--color-yellow); background: transparent; color: var(--color-yellow); cursor: pointer; white-space: nowrap;">
            ${user.role === 'admin' ? 'Rimuovi Admin' : 'Promuovi Admin'}
          </button>
        </td>
      </tr>
    `).join('');

    // Add event listeners
    tbody.querySelectorAll('.role-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.userId;
        const currentRole = e.target.dataset.currentRole;
        const newRole = currentRole === 'admin' ? 'user' : 'admin';

        if (confirm(`Sei sicuro di voler cambiare il ruolo di questo utente in ${newRole.toUpperCase()}?`)) {
          try {
            const { error } = await supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', userId);

            if (error) throw error;

            // Refresh list
            const updatedUsers = profiles.map(p => {
              if (p.id === userId) return { ...p, role: newRole };
              return p;
            });
            renderUsers(updatedUsers);
          } catch (err) {
            alert('Errore: ' + err.message);
          }
        }
      });
    });
  };

  renderUsers(profiles);

  // Search functionality
  const searchInput = page.querySelector('#user-search');
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = profiles.filter(user =>
      user.first_name.toLowerCase().includes(term) ||
      user.last_name.toLowerCase().includes(term) ||
      (user.email && user.email.toLowerCase().includes(term))
    );
    renderUsers(filtered);
  });

  return page;
}
