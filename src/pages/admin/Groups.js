import { supabase, isAdmin } from '../../lib/supabaseClient.js';
import { navigateTo } from '../../application.js';
import { TOURNAMENT_CATEGORIES } from '../../lib/constants.js';

export async function renderAdminGroupsPage() {
    if (!isAdmin()) {
        navigateTo('/');
        return document.createElement('div');
    }

    const page = document.createElement('div');
    page.className = 'admin-groups-page container mt-xl';

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
        <p class="mt-md">Crea una stagione prima di gestire i gironi.</p>
        <a href="/admin/seasons" data-link class="btn btn-primary mt-md">Gestione Stagioni</a>
      </div>
    `;
        return page;
    }

    // Get existing groups
    const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .eq('season_id', currentSeason.id)
        .order('name');

    page.innerHTML = `
    <h1 class="text-center mb-xl">Gestione Gironi - Stagione ${currentSeason.year}</h1>
    
    <div class="admin-actions mb-lg">
      <button class="btn btn-primary" id="new-group-btn">
        ➕ Nuovo Girone
      </button>
    </div>
    
    <div id="group-form" class="glass-card mb-lg hidden">
      <h3 class="mb-md">Aggiungi Girone</h3>
      
      <form id="create-group-form">
        <div class="input-group">
          <label for="group-name">Nome Girone *</label>
          <input type="text" id="group-name" name="group-name" placeholder="Es. Girone A" required>
        </div>
        
        <div class="input-group">
          <label for="group-category">Categoria *</label>
          <select id="group-category" name="group-category" required>
            <option value="">Seleziona categoria...</option>
            ${TOURNAMENT_CATEGORIES.map(cat => `
              <option value="${cat}">${cat}</option>
            `).join('')}
          </select>
        </div>
        
        <div id="form-error" class="error-message hidden"></div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Aggiungi Girone</button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">Annulla</button>
        </div>
      </form>
    </div>
    
    <div class="groups-list">
      ${TOURNAMENT_CATEGORIES.map(category => {
        const categoryGroups = groups ? groups.filter(g => g.category === category) : [];
        if (categoryGroups.length === 0) return '';

        return `
          <div class="category-section mb-xl">
            <h2 class="text-yellow mb-md">${category}</h2>
            <div class="grid grid-3">
              ${categoryGroups.map(group => `
                <div class="card">
                  <h3 class="text-center">${group.name}</h3>
                  <div class="text-center mt-sm text-muted">
                    ${group.category}
                  </div>
                  <div class="group-actions mt-md text-center">
                    <button class="btn btn-danger delete-group-btn" data-group-id="${group.id}" title="Elimina Girone">
                      🗑️ Elimina
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
    }).join('')}
      
      ${(!groups || groups.length === 0) ? '<p class="text-center">Nessun girone creato.</p>' : ''}
    </div>
  `;

    // Toggle form visibility
    const newGroupBtn = page.querySelector('#new-group-btn');
    const groupForm = page.querySelector('#group-form');
    const cancelBtn = page.querySelector('#cancel-btn');

    newGroupBtn.addEventListener('click', () => {
        groupForm.classList.toggle('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        groupForm.classList.add('hidden');
    });

    // Handle group creation
    const form = page.querySelector('#create-group-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const groupName = form['group-name'].value;
        const category = form['group-category'].value;
        const errorDiv = page.querySelector('#form-error');

        try {
            errorDiv.classList.add('hidden');

            const { error } = await supabase
                .from('groups')
                .insert({
                    season_id: currentSeason.id,
                    name: groupName,
                    category: category
                });

            if (error) throw error;

            // Re-render page
            const newPage = await renderAdminGroupsPage();
            page.replaceWith(newPage);
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    });

    // Handle group deletion
    const deleteBtns = page.querySelectorAll('.delete-group-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Sei sicuro di voler eliminare questo girone? Verranno eliminate anche le associazioni con le squadre.')) {
                return;
            }

            const groupId = e.target.closest('button').dataset.groupId;

            try {
                const { error } = await supabase
                    .from('groups')
                    .delete()
                    .eq('id', groupId);

                if (error) throw error;

                const newPage = await renderAdminGroupsPage();
                page.replaceWith(newPage);
            } catch (error) {
                alert('Errore durante l\'eliminazione: ' + error.message);
            }
        });
    });

    return page;
}
