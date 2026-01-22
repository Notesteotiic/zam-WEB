import { confirmBookingVoucher } from './api.js';
import { installNav, parseQuery, showError } from './app.js';

installNav();

const elStatus = document.getElementById('statusText');

function setStatus(message) {
  if (elStatus) elStatus.textContent = message;
}

async function main() {
  const q = parseQuery();
  const token = q.token ? String(q.token) : '';

  if (!token) {
    setStatus('This voucher link is invalid.');
    showError('error', 'Missing voucher token in the URL.');
    return;
  }

  setStatus('Confirming your voucher, please wait...');
  showError('error', '');

  try {
    const result = await confirmBookingVoucher(token);
    if (result.alreadyConfirmed) {
      setStatus('This voucher was already confirmed. Your booking is active with ZAM.');
    } else {
      setStatus('Voucher accepted. Your booking has been confirmed and sent to ZAM.');
    }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to confirm voucher.';
    setStatus('There was a problem confirming this voucher.');
    showError('error', msg);
  }
}

main();
