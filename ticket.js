import { addTicketMessage, getTicketById, updateTicketStatus } from './api.js';
import { formatDateTime, getSession, getUsernameOrFallback, installNav, parseQuery, setDisabled, setHidden, setText, showError } from './app.js';

installNav();

const q = parseQuery();
const id = q.id;

const elMessages = document.getElementById('messages');
const elText = document.getElementById('text');
const elSend = document.getElementById('sendBtn');
const elClose = document.getElementById('closeBtn');

let busy = false;
let ticket = null;
let interval = null;

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setBusy(next) {
  busy = next;
  setDisabled('sendBtn', busy);
  setDisabled('closeBtn', busy);
}

function render() {
  if (!ticket) return;

  setText('subject', ticket.subject);
  setText('description', ticket.description);

  const statusPill = document.getElementById('statusPill');
  if (statusPill) {
    const cls = ticket.status === 'accepted' ? 'good' : ticket.status === 'open' ? 'warn' : 'bad';
    statusPill.className = `pill ${cls}`;
    statusPill.textContent = String(ticket.status).toUpperCase();
  }

  const carMeta = document.getElementById('carMeta');
  if (carMeta) {
    if (ticket.car) {
      carMeta.textContent = `Car: ${ticket.car.name}${ticket.car.brand ? ` (${ticket.car.brand})` : ''}`;
    } else {
      carMeta.textContent = '';
    }
  }

  const isClosed = ticket.status === 'closed';
  const isAccepted = ticket.status === 'accepted';
  const isOpen = ticket.status === 'open';
  setHidden('closedNote', !isClosed);
  setHidden('acceptNote', true);
  setHidden('composer', isClosed);

  if (elClose) elClose.hidden = isClosed;

  if (!elMessages) return;
  elMessages.innerHTML = '';

  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const session = getSession();
  const isAdmin = !!session && session.role === 'admin';
  const myName = getUsernameOrFallback();

  if (messages.length === 0) {
    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = 'No messages yet.';
    elMessages.appendChild(n);
    return;
  }

  for (const m of messages) {
    const div = document.createElement('div');
    div.className = `message ${m.author === 'client' ? 'client' : 'admin'}`;
    const authorLabel = isAdmin
      ? m.author === 'admin'
        ? 'You'
        : ticket.createdBy || 'Client'
      : m.author === 'client'
        ? 'You'
        : 'Admin';
    div.innerHTML = `
      <div class="meta">${escapeHtml(authorLabel)} • ${escapeHtml(formatDateTime(m.createdAt))}</div>
      <div class="text">${escapeHtml(m.text)}</div>
    `;
    elMessages.appendChild(div);
  }
}

async function load() {
  if (!id) {
    showError('error', 'Missing ticket id');
    setText('subject', 'Ticket not found');
    return;
  }

  try {
    const t = await getTicketById(id);
    ticket = t;
    if (!ticket) {
      showError('error', 'Ticket not found');
      setText('subject', 'Ticket not found');
      return;
    }
    render();
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to load ticket');
  }
}

async function handleSend() {
  if (busy) return;
  if (!ticket || ticket.status === 'closed') return;

  const text = (elText?.value ?? '').trim();
  if (!text) return;

  const session = getSession();
  const author = !!session && session.role === 'admin' ? 'admin' : 'client';

  setBusy(true);
  showError('error', '');

  try {
    await addTicketMessage(ticket.id, author, text);
    if (elText) elText.value = '';
    await load();
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Send failed');
  } finally {
    setBusy(false);
  }
}

async function handleClose() {
  if (busy) return;
  if (!ticket || ticket.status === 'closed') return;

  const ok = window.confirm('Close ticket? You will not be able to send more messages after closing.');
  if (!ok) return;

  setBusy(true);
  showError('error', '');

  try {
    await updateTicketStatus(ticket.id, 'closed');
    await load();
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Close failed');
  } finally {
    setBusy(false);
  }
}

elSend?.addEventListener('click', handleSend);
elClose?.addEventListener('click', handleClose);

load();
interval = window.setInterval(load, 3000);
window.addEventListener('beforeunload', () => {
  if (interval) window.clearInterval(interval);
});
