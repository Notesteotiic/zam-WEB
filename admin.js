import { listBookings } from './api.js';
import { getSession, installNav, setDisabled, showError } from './app.js';

installNav();

const elBookings = document.getElementById('bookings');
const elError = document.getElementById('error');
const elRefresh = document.getElementById('refresh');

function ensureAdmin() {
  const session = getSession();
  const isAdmin = !!session && (session.role === 'admin' || session.email === 'admin@gmail.com');
  if (!isAdmin) {
    window.location.href = './login.html';
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusPill(status) {
  const label = String(status || '').toUpperCase();
  let cls = 'pill';
  if (status === 'completed') cls += ' good';
  else if (status === 'active') cls += ' warn';
  else cls += ' bad';
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function renderBookingCard(b) {
  const div = document.createElement('div');
  div.className = 'car';

  const carLabel = b.car
    ? `${b.car.name}${b.car.brand ? ` (${b.car.brand})` : ''}`
    : 'No car linked';
  const userLabel = b.user?.username
    ? `${b.user.username} · ${b.user.email}`
    : b.user?.email || 'Unknown user';

  const when = b.bookingTime ? new Date(b.bookingTime).toLocaleString() : '';
  const statusHtml = statusPill(b.status || 'pending');

  div.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
          <div style="min-width:0;">
            <p class="car-title">${escapeHtml(b.name || 'Booking')}</p>
            <p class="car-meta">${escapeHtml(userLabel)}</p>
            <p class="car-meta">${escapeHtml(carLabel)}</p>
          </div>
          ${statusHtml}
        </div>
        <div style="margin-top: 8px; font-size: 13px; color: var(--muted);">
          ${escapeHtml(when)}
        </div>
        ${b.location ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(b.location)}</div>` : ''}
      </div>
    </div>
  `;

  return div;
}

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  setDisabled('refresh', true);
  showError('error', '');

  try {
    const rows = await listBookings();
    const list = Array.isArray(rows) ? rows : [];

    if (elBookings) {
      elBookings.innerHTML = '';
      if (list.length === 0) {
        const n = document.createElement('div');
        n.className = 'notice';
        n.textContent = 'No confirmed bookings yet.';
        elBookings.appendChild(n);
      } else {
        for (const b of list) elBookings.appendChild(renderBookingCard(b));
      }
    }
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to load bookings');
  } finally {
    loading = false;
    setDisabled('refresh', false);
  }
}

ensureAdmin();
load();
elRefresh?.addEventListener('click', load);
