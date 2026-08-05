import { supabase } from '../lib/supabaseClient.js';
import { navigateTo } from '../application.js';

export function renderResetPasswordPage() {
  const page = document.createElement('div');
  page.className = 'login-page';

  page.innerHTML = `
    <div class="auth-container">
      <div class="auth-card glass-card">
        <div class="auth-header text-center">
          <div style="position: relative; display: inline-block;">
            <img src="/assets/logo_final.png" alt="3vs3 Ischitella" class="logo-blended">
          </div>
          <p class="mt-sm text-white">Imposta una nuova password</p>
        </div>

        <div id="reset-content" class="auth-form mt-lg">
          <!-- Stato: loading (verifica token) -->
          <div id="state-loading" style="text-align: center; padding: 2rem 0; color: rgba(255,255,255,0.6);">
            Verifica del link in corso...
          </div>

          <!-- Stato: form nuova password -->
          <div id="state-form" style="display: none;">
            <div class="input-group">
              <label for="new-password">Nuova password</label>
              <input type="password" id="new-password" placeholder="Minimo 6 caratteri" minlength="6">
            </div>
            <div class="input-group" style="margin-top: 0.75rem;">
              <label for="confirm-password">Conferma password</label>
              <input type="password" id="confirm-password" placeholder="Ripeti la password">
            </div>

            <div id="form-error" class="error-message hidden"></div>

            <button type="button" id="update-password-btn" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-md);">
              Aggiorna password
            </button>
          </div>

          <!-- Stato: successo -->
          <div id="state-success" style="display: none; text-align: center; padding: 1rem 0;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
            <p class="text-white" style="font-size: 1rem; margin-bottom: 1.5rem;">
              Password aggiornata con successo!
            </p>
            <button type="button" id="go-home-btn" class="btn btn-primary" style="width: 100%;">
              Vai alla Home
            </button>
          </div>

          <!-- Stato: link non valido / scaduto -->
          <div id="state-invalid" style="display: none; text-align: center; padding: 1rem 0;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <p class="text-white" style="font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
              Il link non è valido o è scaduto.<br>Richiedi un nuovo link di recupero.
            </p>
            <a href="/login" data-link class="btn btn-primary" style="display: inline-block; width: 100%; text-align: center; text-decoration: none;">
              Torna al login
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Gestione stati ───────────────────────────────────────────────────────────
  const stateLoading = page.querySelector('#state-loading');
  const stateForm    = page.querySelector('#state-form');
  const stateSuccess = page.querySelector('#state-success');
  const stateInvalid = page.querySelector('#state-invalid');

  function showState(state) {
    stateLoading.style.display = 'none';
    stateForm.style.display    = 'none';
    stateSuccess.style.display = 'none';
    stateInvalid.style.display = 'none';
    state.style.display = 'block';
  }

  // ── Verifica sessione di recovery ────────────────────────────────────────────
  // Supabase inietta il token nell'URL come fragment (#access_token=...) o query param
  // onAuthStateChange lo intercetta con evento PASSWORD_RECOVERY
  async function checkRecoverySession() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // Utente autenticato tramite link di recovery → mostra il form
      showState(stateForm);
    } else {
      // Nessuna sessione valida → link scaduto o non valido
      showState(stateInvalid);
    }
  }

  // Ascolta l'evento PASSWORD_RECOVERY prima di controllare la sessione
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showState(stateForm);
    }
  });

  checkRecoverySession();

  // ── Aggiorna la password ─────────────────────────────────────────────────────
  const updateBtn = page.querySelector('#update-password-btn');
  updateBtn.addEventListener('click', async () => {
    const newPassword     = page.querySelector('#new-password').value;
    const confirmPassword = page.querySelector('#confirm-password').value;
    const formError       = page.querySelector('#form-error');

    formError.classList.add('hidden');

    if (!newPassword || newPassword.length < 6) {
      formError.textContent = 'La password deve essere di almeno 6 caratteri.';
      formError.classList.remove('hidden');
      return;
    }

    if (newPassword !== confirmPassword) {
      formError.textContent = 'Le password non coincidono.';
      formError.classList.remove('hidden');
      return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = 'Aggiornamento in corso...';

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showState(stateSuccess);
    } catch (error) {
      formError.textContent = error.message;
      formError.classList.remove('hidden');
      updateBtn.disabled = false;
      updateBtn.textContent = 'Aggiorna password';
    }
  });

  // ── Vai alla home dopo successo ──────────────────────────────────────────────
  const goHomeBtn = page.querySelector('#go-home-btn');
  goHomeBtn.addEventListener('click', () => navigateTo('/'));

  return page;
}
