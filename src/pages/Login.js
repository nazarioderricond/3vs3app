import { supabase } from '../lib/supabaseClient.js';
import { navigateTo } from '../application.js';

export function renderLoginPage() {
  const page = document.createElement('div');
  page.className = 'login-page';

  page.innerHTML = `
    <div class="auth-container">
      <div class="auth-card glass-card">
        <div class="auth-header text-center">
          <div style="position: relative; display: inline-block;">
            <img src="/assets/logo_final.png" alt="3vs3 Ischitella" class="logo-blended">
            <span class="badge-beta" style="position: absolute; bottom: -5px; right: -5px; transform: translate(20%, 20%); z-index: 10;">Beta</span>
          </div>
          <p class="mt-sm text-white">Accedi al tuo account</p>
        </div>

        <!-- LOGIN FORM -->
        <form id="login-form" class="auth-form mt-lg">
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="tua@email.com" required>
          </div>
          
          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="••••••••" required>
          </div>
          
          <div style="text-align: right; margin-top: -0.25rem; margin-bottom: 0.75rem;">
            <button type="button" id="forgot-password-btn" style="
              background: none;
              border: none;
              color: var(--color-yellow, #ffd700);
              font-size: 0.85rem;
              cursor: pointer;
              padding: 0;
              text-decoration: underline;
              opacity: 0.85;
            ">Password dimenticata?</button>
          </div>

          <div id="login-error" class="error-message hidden"></div>
          
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-md);">
            Accedi
          </button>
        </form>

        <!-- RECUPERO PASSWORD FORM (nascosto di default) -->
        <div id="forgot-password-section" class="auth-form mt-lg" style="display: none;">
          <div style="text-align: center; margin-bottom: 1rem;">
            <p class="text-white" style="font-size: 0.95rem; line-height: 1.5;">
              Inserisci la tua email e ti invieremo un link per reimpostare la password.
            </p>
          </div>

          <div class="input-group">
            <label for="reset-email">Email</label>
            <input type="email" id="reset-email" placeholder="tua@email.com">
          </div>

          <div id="reset-error" class="error-message hidden"></div>
          <div id="reset-success" class="hidden" style="
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.4);
            color: #86efac;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            font-size: 0.9rem;
            text-align: center;
            margin-bottom: 0.5rem;
          ">
            ✅ Email inviata! Controlla la tua casella di posta.
          </div>

          <button type="button" id="send-reset-btn" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-md);">
            Invia link di recupero
          </button>

          <div style="text-align: center; margin-top: 1rem;">
            <button type="button" id="back-to-login-btn" style="
              background: none;
              border: none;
              color: rgba(255,255,255,0.6);
              font-size: 0.85rem;
              cursor: pointer;
              padding: 0;
              text-decoration: underline;
            ">← Torna al login</button>
          </div>
        </div>

        <div class="auth-footer text-center mt-lg" id="register-footer">
          <p class="text-white">Non hai un account?</p>
          <a href="/register" data-link class="text-yellow" style="font-weight: 700; text-decoration: none;">
            Registrati ora
          </a>
        </div>
      </div>
    </div>
  `;

  // ── Login form submit ────────────────────────────────────────────────────────
  const loginForm = page.querySelector('#login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginForm.email.value;
    const password = loginForm.password.value;
    const errorDiv = page.querySelector('#login-error');

    try {
      errorDiv.classList.add('hidden');

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      navigateTo('/');
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
    }
  });

  // ── Toggle: mostra recupero password ────────────────────────────────────────
  const forgotBtn = page.querySelector('#forgot-password-btn');
  const forgotSection = page.querySelector('#forgot-password-section');
  const registerFooter = page.querySelector('#register-footer');

  forgotBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    forgotSection.style.display = 'block';
    registerFooter.style.display = 'none';
  });

  // ── Toggle: torna al login ───────────────────────────────────────────────────
  const backToLoginBtn = page.querySelector('#back-to-login-btn');
  backToLoginBtn.addEventListener('click', () => {
    forgotSection.style.display = 'none';
    loginForm.style.display = 'block';
    registerFooter.style.display = 'block';
    // Reset feedback
    page.querySelector('#reset-error').classList.add('hidden');
    page.querySelector('#reset-success').classList.add('hidden');
    page.querySelector('#reset-email').value = '';
  });

  // ── Invia email di recupero ──────────────────────────────────────────────────
  const sendResetBtn = page.querySelector('#send-reset-btn');
  sendResetBtn.addEventListener('click', async () => {
    const emailInput = page.querySelector('#reset-email');
    const resetError = page.querySelector('#reset-error');
    const resetSuccess = page.querySelector('#reset-success');

    const email = emailInput.value.trim();

    resetError.classList.add('hidden');
    resetSuccess.classList.add('hidden');

    if (!email) {
      resetError.textContent = 'Inserisci un indirizzo email valido.';
      resetError.classList.remove('hidden');
      return;
    }

    sendResetBtn.disabled = true;
    sendResetBtn.textContent = 'Invio in corso...';

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      resetSuccess.classList.remove('hidden');
      sendResetBtn.textContent = 'Email inviata';
    } catch (error) {
      resetError.textContent = error.message;
      resetError.classList.remove('hidden');
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = 'Invia link di recupero';
    }
  });

  return page;
}
