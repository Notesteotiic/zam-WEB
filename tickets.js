import { createTicket, listTicketsForUser } from './api.js';
import { getEmailOrGuest, getSession, installNav, parseQuery, readFileAsDataUrl, setDisabled, showError } from './app.js';

installNav();

const q = parseQuery();
const carId = q.carId ? String(q.carId) : null;

const elContext = document.getElementById('contextText');
const elLicenseField = document.getElementById('licenseField');
const elEmailNote = document.getElementById('emailNote');

const elSubject = document.getElementById('subject');
const elDescription = document.getElementById('description');
const elLicense = document.getElementById('license');
const elSubmit = document.getElementById('submit');
const elRefresh = document.getElementById('refresh');
const elTickets = document.getElementById('tickets');

const email = getEmailOrGuest();
const session = getSession();
const emailLabel = session?.email ? session.email : 'Guest';
if (elEmailNote) elEmailNote.textContent = `Tickets are loaded for: ${emailLabel}`;

if (elContext) {
  if (carId) {
    elContext.textContent = 'This ticket will be linked to the selected car. Driver\'s license image is required.';
  } else {
    elContext.textContent = 'Tip: include preferred dates, pickup/dropoff location, and any requirements.';
  }
}

if (elLicenseField) elLicenseField.hidden = !carId;

let submitting = false;

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTicketCard(t) {
  const div = document.createElement('a');
  div.className = 'car';
  div.href = `./ticket.html?id=${encodeURIComponent(t.id)}`;

  const statusLabel = String(t.status || '').toUpperCase();
  const statusClass = t.status === 'accepted' ? 'good' : t.status === 'open' ? 'warn' : 'bad';

  div.innerHTML = `
    <div class="car-inner">
      <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
        <div style="min-width:0;">
          <p class="car-title">${escapeHtml(t.subject)}</p>
          <p class="car-meta">${escapeHtml(t.description)}</p>
        </div>
        <span class="pill ${statusClass}">${statusLabel}</span>
      </div>
      <div style="display:flex; justify-content: space-between; align-items:flex-end;">
        <div class="pill">${escapeHtml(new Date(t.createdAt).toLocaleString())}</div>
        <span class="btn secondary">Open</span>
      </div>
    </div>
  `;

  return div;
}

async function loadTickets() {
  if (!elTickets) return;
  elTickets.innerHTML = '';

  try {
    const rows = await listTicketsForUser(email);
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      const p = document.createElement('div');
      p.className = 'notice';
      p.textContent = 'You have no tickets yet.';
      elTickets.appendChild(p);
      return;
    }

    for (const t of list) elTickets.appendChild(renderTicketCard(t));
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to load tickets';
    const p = document.createElement('div');
    p.className = 'error';
    p.textContent = msg;
    elTickets.appendChild(p);
  }
}

function setSubmitting(next) {
  submitting = next;
  setDisabled('submit', submitting);
  setDisabled('refresh', submitting);
  if (elSubmit) elSubmit.textContent = submitting ? 'Please wait...' : 'Submit ticket';
}

async function handleSubmit() {
  if (submitting) return;

  const subject = (elSubject?.value ?? '').trim();
  const description = (elDescription?.value ?? '').trim();

  if (!subject || !description) {
    showError('error', 'Please add a short subject and describe your request.');
    return;
  }

  let licenseImageUrl = null;
  if (carId) {
    const file = elLicense && elLicense.files && elLicense.files[0] ? elLicense.files[0] : null;
    if (!file) {
      showError('error', "Driver's license image is required for car-linked tickets.");
      return;
    }
    try {
      licenseImageUrl = await readFileAsDataUrl(file);
    } catch (e) {
      showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to read image');
      return;
    }
  }

  setSubmitting(true);
  showError('error', '');

  try {
    await createTicket(subject, description, email, carId, licenseImageUrl);
    if (elSubject) elSubject.value = '';
    if (elDescription) elDescription.value = '';
    if (elLicense) elLicense.value = '';
    await loadTickets();
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to create ticket');
  } finally {
    setSubmitting(false);
  }
}

elSubmit?.addEventListener('click', handleSubmit);
elRefresh?.addEventListener('click', loadTickets);

loadTickets();
