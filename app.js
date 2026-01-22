const SESSION_KEY = 'zam_session_v1';
const GUEST_EMAIL = 'guest@zamcarandtransportservices.io';

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    if (!('email' in s) || typeof s.email !== 'string' || !s.email) return null;
    return {
      email: s.email,
      username: typeof s.username === 'string' ? s.username : null,
      role: typeof s.role === 'string' ? s.role : null,
    };
  } catch {
    return null;
  }
}

export function setSession(account) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    email: account.email,
    username: account.username ?? null,
    role: account.role ?? null,
  }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getEmailOrGuest() {
  return getSession()?.email ?? GUEST_EMAIL;
}

export function getUsernameOrFallback() {
  return getSession()?.username ?? 'You';
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export function parseQuery() {
  const params = new URLSearchParams(window.location.search);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

export function setHidden(id, hidden) {
  const el = document.getElementById(id);
  if (el) el.hidden = !!hidden;
}

export function setDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (el) el.disabled = !!disabled;
}

export function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.hidden = !message;
}

export function installNav() {
  const authLink = document.getElementById('navAuthLink');
  const logoutBtn = document.getElementById('navLogoutBtn');
  const me = document.getElementById('navMe');
  const adminLink = document.getElementById('navAdminLink');

  const session = getSession();

  if (me) {
    if (session?.email) {
      me.textContent = session.email;
    } else {
      me.textContent = 'Guest';
    }
  }

  if (authLink) {
    authLink.hidden = !!session;
  }

  if (adminLink) {
    const isAdmin = !!session && (session.role === 'admin' || session.email === 'admin@gmail.com');
    adminLink.hidden = !isAdmin;
  }

  if (logoutBtn) {
    logoutBtn.hidden = !session;
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = './login.html';
    });
  }
}

export async function readFileAsDataUrl(file) {
  if (!file) return null;
  const MAX_BYTES = 9 * 1024 * 1024;
  if (file.size > MAX_BYTES) throw new Error('Image too large. Please pick a smaller file.');

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('Unable to read file'));
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}
