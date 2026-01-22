import { getCar } from './api.js';
import { installNav, parseQuery, setHtml, setText, showError } from './app.js';

installNav();

const q = parseQuery();
const id = q.id;

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function init() {
  showError('error', '');

  if (!id) {
    showError('error', 'Missing car id');
    setText('carName', 'Car not found');
    return;
  }

  try {
    const car = await getCar(id);
    document.title = `ZAM Rentals - ${car.name}`;

    const img = document.getElementById('carImg');
    if (img) {
      const src = car.imageUrl && String(car.imageUrl).trim() ? String(car.imageUrl).trim() : './LOGO.png';
      img.src = src;
      img.onerror = () => {
        img.onerror = null;
        img.src = './LOGO.png';
      };
    }

    setText('carName', car.name);
    setText('carType', car.type);
    setHtml('brand', escapeHtml(car.brand ?? '—'));
    setHtml('seats', escapeHtml(String(car.seats)));
    setHtml('price', escapeHtml(`₱${Number(car.pricePerDay)} / day`));

    const pill = document.getElementById('availabilityPill');
    if (pill) {
      pill.className = `pill ${car.isAvailable ? 'good' : 'bad'}`;
      pill.textContent = car.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
    }

    const link = document.getElementById('bookingLink');
    if (link) link.href = `./booking.html?carId=${encodeURIComponent(id)}`;
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to load car');
    setText('carName', 'Car not found');
  }
}

init();
