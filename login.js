import { login as apiLogin, signup as apiSignup } from './api.js';
import { getSession, installNav, setDisabled, setSession, showError } from './app.js';

installNav();

const elSignupFields = document.getElementById('signupFields');
const elEmail = document.getElementById('email');
const elPassword = document.getElementById('password');
const elSubmit = document.getElementById('submit');
const elToggle = document.getElementById('toggle');
const elModeKicker = document.getElementById('modeKicker');
const elModeTitle = document.getElementById('modeTitle');

if (getSession()) {
  window.location.href = './index.html';
}

let mode = 'login';
let submitting = false;

function updateMode() {
  const isSignup = mode === 'signup';
  if (elSignupFields) {
    elSignupFields.innerHTML = isSignup
      ? `
        <div class="field" style="grid-column: span 12;">
          <div class="label">Username</div>
          <input id="username" class="input" placeholder="Your name" autocomplete="username" />
        </div>
      `
      : '';
  }
  if (elPassword) elPassword.autocomplete = isSignup ? 'new-password' : 'current-password';
  if (elSubmit) elSubmit.textContent = isSignup ? 'Create account' : 'Log in';
  if (elToggle) elToggle.textContent = isSignup ? 'Have an account already? Log in' : "Don't have an account? Create one";
  if (elModeKicker) elModeKicker.textContent = isSignup ? 'Signup' : 'Login';
  if (elModeTitle) elModeTitle.textContent = isSignup ? 'Create account' : 'Log in';
  showError('error', '');
}

function setSubmitting(next) {
  submitting = next;
  setDisabled('submit', submitting);
  setDisabled('toggle', submitting);
  if (elSubmit) elSubmit.textContent = submitting ? 'Please wait...' : (mode === 'signup' ? 'Create account' : 'Log in');
}

async function handleSubmit() {
  if (submitting) return;

  const email = (elEmail?.value ?? '').trim();
  const password = elPassword?.value ?? '';
  const elUsername = document.getElementById('username');
  const username = (elUsername?.value ?? '').trim();

  if (!email || !password) {
    showError('error', 'Please enter both email and password.');
    return;
  }

  setSubmitting(true);
  showError('error', '');

  try {
    if (mode === 'signup') {
      if (!username) {
        showError('error', 'Please enter a username.');
        return;
      }
      await apiSignup(email, password, username);
      mode = 'login';
      updateMode();
      showError('error', 'Account created. You can now log in.');
      return;
    }

    const account = await apiLogin(email, password);
    if (!account || !account.email) {
      showError('error', 'Login failed.');
      return;
    }

    if (account.role === 'admin' || account.email === 'admin@gmail.com') {
      setSession(account);
      window.location.href = './admin.html';
      return;
    }

    setSession(account);
    window.location.href = './index.html';
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Login failed');
  } finally {
    setSubmitting(false);
  }
}

elSubmit?.addEventListener('click', handleSubmit);
elToggle?.addEventListener('click', () => {
  if (submitting) return;
  mode = mode === 'login' ? 'signup' : 'login';
  updateMode();
});

updateMode();
