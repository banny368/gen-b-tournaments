/**
 * Gen B Tournaments — Authentication Module
 * ==========================================
 * Handles all Supabase Auth flows and DOM-level form binding.
 *
 * Depends on (must be loaded in order):
 *   1. config.js
 *   2. supabase.js   (exposes window.GenBSupabase & helpers)
 *   3. utils.js      (exposes showToast, withButtonLoading, showFieldError, etc.)
 */

'use strict';

// ─── Guard dependencies ───────────────────────────────────────────────────────
if (typeof GenBSupabase === 'undefined') {
  throw new Error('[GenB] supabase.js must be loaded before auth.js');
}
if (typeof GenBUtils === 'undefined') {
  throw new Error('[GenB] utils.js must be loaded before auth.js');
}

const _auth    = GenBSupabase.auth;
const _db      = GenBSupabase.db;

// ─── Sign In ──────────────────────────────────────────────────────────────────

/**
 * Signs in a user with email and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, session: object }|null>}
 */
async function signIn(email, password) {
  try {
    const { data, error } = await _auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Track login event
    if (typeof trackEvent === 'function') {
      trackEvent('user_login', { method: 'email' });
    }

    return data;
  } catch (err) {
    console.error('[GenB] signIn error:', err);
    throw err;
  }
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

/**
 * Creates a new Supabase auth user, inserts a profile row, and handles referrals.
 *
 * @param {string} email
 * @param {string} password
 * @param {{ username: string, referralCode?: string, displayName?: string }} userData
 * @returns {Promise<{ user: object, session: object }|null>}
 */
async function signUp(email, password, userData = {}) {
  const { username, referralCode, displayName } = userData;

  try {
    // 1. Create auth user
    const { data: authData, error: signUpError } = await _auth.signUp({
      email,
      password,
      options: {
        data: {
          username:     username || '',
          display_name: displayName || username || '',
        },
      },
    });

    if (signUpError) throw signUpError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('User ID missing after sign-up');

    // 2. Generate referral code for the new user
    const newReferralCode = (typeof generateReferralCode === 'function')
      ? generateReferralCode(username)
      : `${(username || 'USER').toUpperCase().slice(0, 6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 3. Insert profile row
    const { error: profileError } = await _db
      .from('profiles')
      .upsert({
        id:            userId,
        email,
        username:      username || null,
        display_name:  displayName || username || null,
        referral_code: newReferralCode,
        referred_by:   null,       // will be updated below if referral is valid
        role:          'user',
        wallet_balance: 0,
        xp:            0,
        created_at:    new Date().toISOString(),
      });

    if (profileError) {
      console.error('[GenB] signUp — profile insert error:', profileError);
      // Non-fatal: user can still log in, profile can be re-created
    }

    // 4. Process referral code
    if (referralCode && referralCode.trim()) {
      await _processReferral(userId, referralCode.trim());
    }

    // 5. Track event
    if (typeof trackEvent === 'function') {
      trackEvent('user_signup', { method: 'email', has_referral: !!referralCode });
    }

    return authData;
  } catch (err) {
    console.error('[GenB] signUp error:', err);
    throw err;
  }
}

/**
 * Processes a referral code during registration.
 * Awards the referral bonus to the referrer.
 *
 * @param {string} newUserId      - New user's profile ID.
 * @param {string} referralCode   - The code the new user entered.
 * @private
 */
async function _processReferral(newUserId, referralCode) {
  try {
    // Find referrer
    const { data: referrer, error } = await _db
      .from('profiles')
      .select('id, wallet_balance, referral_code')
      .eq('referral_code', referralCode)
      .single();

    if (error || !referrer || referrer.id === newUserId) {
      console.warn('[GenB] Referral code not found or self-referral:', referralCode);
      return;
    }

    const bonus = (typeof GENBCONFIG !== 'undefined' && GENBCONFIG.wallet.referralBonus) || 10;

    // Credit referrer
    await _db
      .from('profiles')
      .update({ wallet_balance: (referrer.wallet_balance || 0) + bonus })
      .eq('id', referrer.id);

    // Update new user's referred_by
    await _db
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', newUserId);

    // Log transaction for referrer
    await _db
      .from('transactions')
      .insert({
        user_id:     referrer.id,
        type:        'referral_bonus',
        amount:      bonus,
        status:      'completed',
        description: `Referral bonus for inviting a new user`,
        created_at:  new Date().toISOString(),
      });

    console.log(`[GenB] Referral processed — ₹${bonus} awarded to ${referrer.id}`);
  } catch (err) {
    console.error('[GenB] _processReferral error:', err);
    // Non-fatal
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

/**
 * Signs out the current user and redirects to the login page.
 *
 * @param {string} [redirectTo='/login.html']
 * @returns {Promise<void>}
 */
async function signOut(redirectTo = '/login.html') {
  try {
    await _auth.signOut();
    sessionStorage.removeItem('genb_redirect_after_login');
    localStorage.removeItem('genb_auth_session');
  } catch (err) {
    console.error('[GenB] signOut error:', err);
  } finally {
    window.location.href = redirectTo;
  }
}

// ─── Password Management ──────────────────────────────────────────────────────

/**
 * Sends a password reset email.
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
async function resetPassword(email) {
  try {
    const { error } = await _auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });
    if (error) throw error;
  } catch (err) {
    console.error('[GenB] resetPassword error:', err);
    throw err;
  }
}

/**
 * Updates the currently signed-in user's password.
 * Should be called from the password-reset callback page.
 *
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
async function updatePassword(newPassword) {
  try {
    const { error } = await _auth.updateUser({ password: newPassword });
    if (error) throw error;
  } catch (err) {
    console.error('[GenB] updatePassword error:', err);
    throw err;
  }
}

// ─── Session & Auth State ─────────────────────────────────────────────────────

/**
 * Returns the current session, or null if not authenticated.
 *
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
async function getSession() {
  try {
    const { data: { session }, error } = await _auth.getSession();
    if (error) throw error;
    return session;
  } catch (err) {
    console.error('[GenB] getSession error:', err);
    return null;
  }
}

/**
 * Registers an auth state change listener.
 *
 * @param {function({ event: string, session: object }): void} callback
 * @returns {{ data: { subscription: object } }} - Call subscription.unsubscribe() to clean up.
 */
function onAuthStateChange(callback) {
  return _auth.onAuthStateChange((event, session) => {
    callback({ event, session });
  });
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Initiates Google OAuth sign-in via Supabase.
 * Redirects the browser to Google's consent screen.
 *
 * @returns {Promise<void>}
 */
async function handleGoogleOAuth() {
  try {
    const { error } = await _auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback.html`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (error) throw error;
  } catch (err) {
    console.error('[GenB] handleGoogleOAuth error:', err);
    throw err;
  }
}

// ─── Form Validation ──────────────────────────────────────────────────────────

/**
 * Validates a login form. Returns an error message string or null if valid.
 *
 * @param {{ email: string, password: string }} fields
 * @returns {string|null}
 */
function _validateLoginForm({ email, password }) {
  if (!email || !email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

/**
 * Validates a sign-up form. Returns an error message string or null if valid.
 *
 * @param {{ email: string, password: string, confirmPassword: string, username: string }} fields
 * @returns {string|null}
 */
function _validateSignUpForm({ email, password, confirmPassword, username }) {
  if (!username || !username.trim()) return 'Username is required.';
  if (username.trim().length < 3) return 'Username must be at least 3 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) return 'Username can only contain letters, numbers, and underscores.';
  if (!email || !email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (confirmPassword !== undefined && password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

// ─── DOM Form Binding ─────────────────────────────────────────────────────────

/**
 * Binds the login form at #loginForm.
 * Expects fields: #loginEmail, #loginPassword
 * Optional: #googleLoginBtn
 */
function _bindLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const emailInput    = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const errorEl       = document.getElementById('loginError');
  const submitBtn     = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    // Clear previous errors
    if (errorEl) errorEl.textContent = '';
    if (typeof showFieldError === 'function') {
      showFieldError('loginEmail', '');
      showFieldError('loginPassword', '');
    }

    const validationError = _validateLoginForm({ email, password });
    if (validationError) {
      if (errorEl) errorEl.textContent = validationError;
      else showToast?.(validationError, 'error');
      return;
    }

    const promise = (async () => {
      const data = await signIn(email, password);

      showToast?.(`Welcome back!`, 'success');

      // Redirect
      const intended = sessionStorage.getItem('genb_redirect_after_login');
      sessionStorage.removeItem('genb_redirect_after_login');
      window.location.href = intended || '/index.html';
    })();

    try {
      if (typeof withButtonLoading === 'function' && submitBtn) {
        await withButtonLoading(submitBtn, promise, 'Signing in…');
      } else {
        await promise;
      }
    } catch (err) {
      const msg = _friendlyAuthError(err.message || err.error_description || 'Login failed.');
      if (errorEl) errorEl.textContent = msg;
      else showToast?.(msg, 'error');
    }
  });

  // Google OAuth button
  const googleBtn = document.getElementById('googleLoginBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        await handleGoogleOAuth();
      } catch (err) {
        showToast?.('Google sign-in failed. Please try again.', 'error');
      }
    });
  }

  // Toggle password visibility
  _bindPasswordToggle('loginPassword', 'toggleLoginPassword');
}

/**
 * Binds the signup form at #signupForm.
 * Expects fields: #signupEmail, #signupPassword, #signupConfirmPassword, #signupUsername
 * Optional: #signupReferralCode
 */
function _bindSignupForm() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  const usernameInput  = document.getElementById('signupUsername');
  const emailInput     = document.getElementById('signupEmail');
  const passwordInput  = document.getElementById('signupPassword');
  const confirmInput   = document.getElementById('signupConfirmPassword');
  const referralInput  = document.getElementById('signupReferralCode');
  const errorEl        = document.getElementById('signupError');
  const submitBtn      = form.querySelector('[type="submit"]');

  // Pre-fill referral code from URL ?ref=CODE
  const urlParams = new URLSearchParams(window.location.search);
  const refParam  = urlParams.get('ref');
  if (refParam && referralInput) {
    referralInput.value = refParam;
    referralInput.readOnly = true;
  }

  // Password strength indicator
  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      _updatePasswordStrength(passwordInput.value);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username       = usernameInput?.value?.trim() || '';
    const email          = emailInput?.value?.trim() || '';
    const password       = passwordInput?.value || '';
    const confirmPassword = confirmInput?.value || '';
    const referralCode   = referralInput?.value?.trim() || '';

    // Clear errors
    if (errorEl) errorEl.textContent = '';

    const validationError = _validateSignUpForm({ email, password, confirmPassword, username });
    if (validationError) {
      if (errorEl) errorEl.textContent = validationError;
      else showToast?.(validationError, 'error');
      return;
    }

    const promise = (async () => {
      await signUp(email, password, { username, referralCode });
      showToast?.('Account created! Please check your email to verify.', 'success', 5000);

      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/login.html?registered=1';
      }, 2000);
    })();

    try {
      if (typeof withButtonLoading === 'function' && submitBtn) {
        await withButtonLoading(submitBtn, promise, 'Creating account…');
      } else {
        await promise;
      }
    } catch (err) {
      const msg = _friendlyAuthError(err.message || 'Sign up failed.');
      if (errorEl) errorEl.textContent = msg;
      else showToast?.(msg, 'error');
    }
  });

  // Google OAuth button
  const googleBtn = document.getElementById('googleSignupBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        await handleGoogleOAuth();
      } catch {
        showToast?.('Google sign-in failed. Please try again.', 'error');
      }
    });
  }

  _bindPasswordToggle('signupPassword', 'toggleSignupPassword');
  _bindPasswordToggle('signupConfirmPassword', 'toggleConfirmPassword');
}

/**
 * Binds the forgot-password form at #forgotForm.
 * Expects field: #forgotEmail
 */
function _bindForgotForm() {
  const form = document.getElementById('forgotForm');
  if (!form) return;

  const emailInput = document.getElementById('forgotEmail');
  const errorEl    = document.getElementById('forgotError');
  const successEl  = document.getElementById('forgotSuccess');
  const submitBtn  = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput?.value?.trim() || '';
    if (errorEl)   errorEl.textContent   = '';
    if (successEl) successEl.textContent = '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errorEl) errorEl.textContent = 'Enter a valid email address.';
      return;
    }

    const promise = (async () => {
      await resetPassword(email);
      if (successEl) successEl.textContent = 'Check your email for a password reset link.';
      showToast?.('Password reset email sent!', 'success');
      if (emailInput) emailInput.value = '';
    })();

    try {
      if (typeof withButtonLoading === 'function' && submitBtn) {
        await withButtonLoading(submitBtn, promise, 'Sending…');
      } else {
        await promise;
      }
    } catch (err) {
      const msg = _friendlyAuthError(err.message || 'Failed to send reset email.');
      if (errorEl) errorEl.textContent = msg;
    }
  });
}

/**
 * Binds the reset-password form at #resetPasswordForm.
 * Expects field: #newPassword, #confirmNewPassword
 */
function _bindResetPasswordForm() {
  const form = document.getElementById('resetPasswordForm');
  if (!form) return;

  const newPassInput     = document.getElementById('newPassword');
  const confirmPassInput = document.getElementById('confirmNewPassword');
  const errorEl          = document.getElementById('resetError');
  const submitBtn        = form.querySelector('[type="submit"]');

  // Supabase sends the token as a hash fragment — detect session
  _auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // User is in password recovery mode; allow form submission
      console.log('[GenB] Password recovery session active');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPass     = newPassInput?.value || '';
    const confirmPass = confirmPassInput?.value || '';

    if (errorEl) errorEl.textContent = '';

    if (newPass.length < 8) {
      if (errorEl) errorEl.textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (newPass !== confirmPass) {
      if (errorEl) errorEl.textContent = 'Passwords do not match.';
      return;
    }

    const promise = (async () => {
      await updatePassword(newPass);
      showToast?.('Password updated successfully!', 'success');
      setTimeout(() => { window.location.href = '/login.html'; }, 1500);
    })();

    try {
      if (typeof withButtonLoading === 'function' && submitBtn) {
        await withButtonLoading(submitBtn, promise, 'Updating…');
      } else {
        await promise;
      }
    } catch (err) {
      const msg = _friendlyAuthError(err.message || 'Failed to update password.');
      if (errorEl) errorEl.textContent = msg;
    }
  });

  _bindPasswordToggle('newPassword', 'toggleNewPassword');
  _bindPasswordToggle('confirmNewPassword', 'toggleConfirmNewPassword');
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

/**
 * Toggles password visibility for an input field.
 *
 * @param {string} inputId  - ID of the password input.
 * @param {string} toggleId - ID of the toggle button/icon.
 * @private
 */
function _bindPasswordToggle(inputId, toggleId) {
  const input  = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;

  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type       = isPassword ? 'text' : 'password';
    toggle.innerHTML = isPassword
      ? '<i data-lucide="eye-off" style="width:16px;height:16px"></i>'
      : '<i data-lucide="eye" style="width:16px;height:16px"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
}

/**
 * Updates a password strength indicator (#passwordStrength).
 *
 * @param {string} password
 * @private
 */
function _updatePasswordStrength(password) {
  const el = document.getElementById('passwordStrength');
  if (!el) return;

  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Too weak',  color: '#ff2d78', width: '20%' },
    { label: 'Weak',      color: '#ff6b35', width: '40%' },
    { label: 'Fair',      color: '#ffd700', width: '60%' },
    { label: 'Strong',    color: '#00ff88', width: '80%' },
    { label: 'Very strong', color: '#00d4ff', width: '100%' },
  ];

  const lvl  = levels[Math.max(0, score - 1)] || levels[0];
  const bar  = el.querySelector('.strength-bar') || el;
  const text = el.querySelector('.strength-text');

  bar.style.width      = lvl.width;
  bar.style.background = lvl.color;
  if (text) text.textContent = lvl.label;
}

/**
 * Converts raw Supabase/GoTrue error messages into user-friendly strings.
 *
 * @param {string} message
 * @returns {string}
 * @private
 */
function _friendlyAuthError(message) {
  const map = {
    'Invalid login credentials':              'Incorrect email or password. Please try again.',
    'Email not confirmed':                    'Please verify your email before signing in.',
    'User already registered':                'An account with this email already exists.',
    'Password should be at least 6 characters': 'Password must be at least 8 characters.',
    'Unable to validate email address':       'Enter a valid email address.',
    'Email rate limit exceeded':              'Too many attempts. Please wait and try again.',
    'For security purposes':                  'Too many requests. Please wait a minute.',
  };

  for (const [key, friendly] of Object.entries(map)) {
    if (message.includes(key)) return friendly;
  }

  return message || 'Something went wrong. Please try again.';
}

// ─── Auto-bind on DOM ready ───────────────────────────────────────────────────

function _initAuthForms() {
  _bindLoginForm();
  _bindSignupForm();
  _bindForgotForm();
  _bindResetPasswordForm();

  // Handle sign-out buttons
  document.querySelectorAll('[data-action="signout"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  });

  // Show success message on login page if just registered
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('registered') === '1') {
    const el = document.getElementById('loginSuccess');
    if (el) el.textContent = 'Account created! Please check your email to verify, then sign in.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initAuthForms);
} else {
  _initAuthForms();
}

// ─── Expose globally ──────────────────────────────────────────────────────────
window.GenBAuth = {
  signIn,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  getSession,
  onAuthStateChange,
  handleGoogleOAuth,
};

window.signIn            = signIn;
window.signUp            = signUp;
window.signOut           = signOut;
window.resetPassword     = resetPassword;
window.updatePassword    = updatePassword;
window.getSession        = getSession;
window.onAuthStateChange = onAuthStateChange;
window.handleGoogleOAuth = handleGoogleOAuth;

console.log('[GenB] auth.js loaded ✓');
