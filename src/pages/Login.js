import { supabase } from '../lib/supabaseClient.js';
import { navigateTo } from '../application.js';

export function renderLoginPage() {
  const page = document.createElement('div');
  page.className = 'login-page';

  page.innerHTML = `
    <div class="auth-container">
      <div class="auth-card glass-card">
        <div class="auth-header text-center">
          <img src="/assets/logo_final.png" alt="3vs3 Ischitella" class="logo-blended">
          <p class="mt-sm text-white">Accedi al tuo account</p>
        </div>
        
        <form id="login-form" class="auth-form mt-lg">
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="tua@email.com" required>
          </div>
          
          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="••••••••" required>
          </div>
          
          <div id="error-message" class="error-message hidden"></div>
          
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-md);">
            Accedi
          </button>
        </form>
        
        <div class="auth-footer text-center mt-lg">
          <p class="text-white">Non hai un account?</p>
          <a href="/register" data-link class="text-yellow" style="font-weight: 700; text-decoration: none;">
            Registrati ora
          </a>
        </div>
      </div>
    </div>
  `;

  // Add form submit handler
  const form = page.querySelector('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value;
    const password = form.password.value;
    const errorDiv = page.querySelector('#error-message');

    try {
      errorDiv.classList.add('hidden');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Redirect to home page
      navigateTo('/');
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
    }
  });

  return page;
}
