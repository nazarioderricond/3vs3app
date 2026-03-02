import { supabase, uploadFile, currentUser, signOut } from '../lib/supabaseClient.js';
import { navigateTo } from '../application.js';

export function renderRegisterPage() {
  const page = document.createElement('div');
  page.className = 'register-page';

  page.innerHTML = `
    <div class="auth-container">
      <div class="auth-card glass-card">
        <div class="auth-header text-center">
          <img src="/assets/logo_final.png" alt="3vs3 Ischitella" class="logo-blended">
          <p class="mt-sm text-white">Crea il tuo account</p>
        </div>
        
        <form id="register-form" class="auth-form mt-lg">
          <!-- Profile Image Upload -->
          <div class="input-group">
            <label>Immagine Profilo</label>
            <div class="image-upload-container">
              <div class="image-preview" id="image-preview">
                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <input type="file" id="profile-image" accept="image/*" class="file-input">
              <label for="profile-image" class="file-label btn btn-secondary">
                Scegli Immagine
              </label>
            </div>
          </div>
          
          <div class="input-group">
            <label for="first-name">Nome *</label>
            <input type="text" id="first-name" name="first-name" required>
          </div>
          
          <div class="input-group">
            <label for="last-name">Cognome *</label>
            <input type="text" id="last-name" name="last-name" required>
          </div>
          
          <div class="input-group">
            <label for="email">Email *</label>
            <input type="email" id="email" name="email" required>
          </div>
          
          <div class="input-group">
            <label for="phone">Telefono</label>
            <input type="tel" id="phone" name="phone" placeholder="+39 123 456 7890">
          </div>
          
          <div class="input-group">
            <label for="birthdate">Data di Nascita *</label>
            <input type="date" id="birthdate" name="birthdate" required>
          </div>
          
          <div class="input-group">
            <label for="password">Password *</label>
            <input type="password" id="password" name="password" minlength="6" required>
          </div>
          
          <div class="input-group">
            <label for="confirm-password">Conferma Password *</label>
            <input type="password" id="confirm-password" name="confirm-password" minlength="6" required>
          </div>
          
          <div id="error-message" class="error-message hidden"></div>
          
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-md);">
            Registrati
          </button>
        </form>
        
        <div class="auth-footer text-center mt-lg">
          <p class="text-white">Hai già un account?</p>
          <a href="/login" data-link class="text-yellow" style="font-weight: 700; text-decoration: none;">
            Accedi
          </a>
        </div>
      </div>
    </div>

  `;

  // Image preview handler
  const fileInput = page.querySelector('#profile-image');
  const imagePreview = page.querySelector('#image-preview');

  // Pre-fill if already logged in (Zombie session recovery)
  if (currentUser) {
    const emailInput = page.querySelector('#email');
    const passwordInput = page.querySelector('#password');
    const confirmPasswordInput = page.querySelector('#confirm-password');
    const submitBtn = page.querySelector('button[type="submit"]');
    const headerText = page.querySelector('.auth-header p');

    if (emailInput) {
      emailInput.value = currentUser.email;
      emailInput.disabled = true;
    }

    // Password not needed for profile completion
    if (passwordInput && confirmPasswordInput) {
      passwordInput.parentElement.style.display = 'none';
      confirmPasswordInput.parentElement.style.display = 'none';
      passwordInput.required = false;
      confirmPasswordInput.required = false;
      // Set dummy values to pass HTML validation
      passwordInput.value = 'dummy123';
      confirmPasswordInput.value = 'dummy123';
    }

    if (submitBtn) submitBtn.textContent = 'Completa Profilo';
    if (headerText) headerText.textContent = 'Completa il tuo profilo';
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Form submit handler
  const form = page.querySelector('#register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      firstName: form['first-name'].value,
      lastName: form['last-name'].value,
      email: form.email.value,
      phone: form.phone.value,
      birthdate: form.birthdate.value,
      password: form.password.value,
      confirmPassword: form['confirm-password'].value,
    };

    const errorDiv = page.querySelector('#error-message');
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      errorDiv.classList.add('hidden');

      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Le password non corrispondono');
      }

      // Disable submit button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrazione in corso...';

      // 1. Sign up user (only if not already logged in)
      let userId = null;

      if (currentUser) {
        userId = currentUser.id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              phone: formData.phone,
              birthdate: formData.birthdate
            }
          }
        });

        if (authError) throw authError;
        userId = authData.user.id;
      }

      // 2. Upload profile image if exists
      let profileImageUrl = null;
      const fileInput = page.querySelector('#profile-image');
      if (fileInput.files.length > 0) {
        try {
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${userId}.${fileExt}`;
          profileImageUrl = await uploadFile('profile-images', file, fileName);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          // Continue without image
        }
      }

      // 3. Create/Update profile using RPC (bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_profile_for_user', {
        p_id: userId,
        p_email: formData.email,
        p_first_name: formData.firstName,
        p_last_name: formData.lastName,
        p_phone: formData.phone,
        p_birthdate: formData.birthdate,
        p_profile_image_url: profileImageUrl
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw new Error('Errore nella creazione del profilo: ' + rpcError.message);
      }

      if (rpcData && rpcData.status === 'error') {
        throw new Error('Errore database: ' + rpcData.message);
      }

      // Success - Show modal (append to body to ensure overlay)
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content glass-card text-center">
          <div class="success-icon mb-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h3 class="text-white mb-sm">Registrazione Completata!</h3>
          <p class="text-white mb-lg">Il tuo account è stato creato con successo. Ora puoi accedere.</p>
          <button id="success-btn" class="btn btn-primary">Vai al Login</button>
        </div>
      `;

      document.body.appendChild(modal);

      // Handle click
      const successBtn = modal.querySelector('#success-btn');
      successBtn.addEventListener('click', async () => {
        document.body.removeChild(modal); // Cleanup
        await signOut();
        navigateTo('/login');
      });
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Registrati';
    }
  });

  return page;
}
