import { listTicketsForUser } from './api.js';
import { getEmailOrGuest, getSession, installNav, setDisabled, showError } from './app.js';

installNav();

const elRefresh = document.getElementById('refresh');
const elList = document.getElementById('list');
const elEmailNote = document.getElementById('emailNote');

const email = getEmailOrGuest();
const session = getSession();
const emailLabel = session?.email ? session.email : 'Guest';
if (elEmailNote) elEmailNote.textContent = `Showing tickets for: ${emailLabel}`;

let busy = false;
let interval = null;

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusClass(status) {
  if (status === 'accepted') return 'good';
  if (status === 'open') return 'warn';
  return 'bad';
}

function renderTicketRow(t) {
  const div = document.createElement('a');
  div.className = 'car';
  div.href = `./ticket.html?id=${encodeURIComponent(t.id)}`;

  const cls = statusClass(t.status);
  const statusLabel = String(t.status || '').toUpperCase();

  div.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
          <div style="min-width:0;">
            <p class="car-title">${escapeHtml(t.subject)}</p>
            <p class="car-meta">${escapeHtml(t.description)}</p>
          </div>
          <span class="pill ${cls}">${statusLabel}</span>
        </div>
        <div style="display:flex; justify-content: space-between; align-items:flex-end; gap: 10px;">
          <span class="pill">${escapeHtml(new Date(t.createdAt).toLocaleString())}</span>
          <span class="btn secondary">Open chat</span>
        </div>
      </div>
    </div>
  `;

  return div;
}

async function load() {
  if (busy) return;
  busy = true;
  setDisabled('refresh', true);
  showError('error', '');

  try {
    const rows = await listTicketsForUser(email);
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((t) => t.status === 'open' || t.status === 'accepted');

    if (elList) {
      elList.innerHTML = '';

      if (active.length === 0) {
        const n = document.createElement('div');
        n.className = 'notice';
        n.textContent = 'No active tickets yet.';
        elList.appendChild(n);
      } else {
        for (const t of active) elList.appendChild(renderTicketRow(t));
      }
    }
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to load messages');
  } finally {
    busy = false;
    setDisabled('refresh', false);
  }
}

elRefresh?.addEventListener('click', load);

load();
interval = window.setInterval(load, 3000);
window.addEventListener('beforeunload', () => {
  if (interval) window.clearInterval(interval);
});
