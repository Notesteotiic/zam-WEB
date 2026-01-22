import { createClientBooking, getCar } from './api.js';
import { getSession, installNav, parseQuery, setDisabled, setText, showError } from './app.js';

installNav();

const EMAILJS_SERVICE_ID = 'service_iqoar4k';
const EMAILJS_TEMPLATE_ID = 'template_omm0nwm';
const EMAILJS_PUBLIC_KEY = 'j-LTZ397WX72OXqR0';

try {
  if (typeof window !== 'undefined' && window.emailjs && typeof window.emailjs.init === 'function') {
    window.emailjs.init(EMAILJS_PUBLIC_KEY);
  }
} catch {}

const q = parseQuery();
const carId = q.carId ? String(q.carId) : null;

const elPickupDate = document.getElementById('pickupDate');
const elDropoffDate = document.getElementById('dropoffDate');
const elRentalSummary = document.getElementById('rentalSummary');
const elSubmit = document.getElementById('submit');
const elSuccess = document.getElementById('success');

let currentCar = null;
let submitting = false;

function formatPricePerDay(car) {
  if (!car) return '';
  const price = Number(car.pricePerDay || 0);
  if (!Number.isFinite(price) || price <= 0) return '';
  return `₱${price} / day`;
}

function computeRentalDays(pickup, dropoff) {
  if (!pickup || !dropoff) return 0;
  const start = new Date(`${pickup}T00:00:00`);
  const end = new Date(`${dropoff}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function updateSummary() {
  if (!elRentalSummary || !elPickupDate || !elDropoffDate) return;
  const pickup = elPickupDate.value;
  const dropoff = elDropoffDate.value;
  const days = computeRentalDays(pickup, dropoff);
  if (!currentCar || !pickup || !dropoff || days <= 0) {
    elRentalSummary.textContent = 'Select valid pickup and drop-off dates to see days and estimated price.';
    return;
  }
  const pricePerDay = Number(currentCar.pricePerDay || 0);
  const total = days * (Number.isFinite(pricePerDay) ? pricePerDay : 0);
  elRentalSummary.textContent = `${days} day(s) · Estimated total: ₱${total}`;
}

function setSubmitting(next) {
  submitting = next;
  setDisabled('submit', submitting);
  if (elSubmit) elSubmit.textContent = submitting ? 'Please wait...' : 'Request booking';
}

async function init() {
  showError('error', '');

  if (!carId) {
    showError('error', 'Missing car id');
    setText('carName', 'Car not found');
    return;
  }

  try {
    const car = await getCar(carId);
    currentCar = car;
    document.title = `ZAM Rentals - Book ${car.name}`;
    setText('carName', car.name);
    const metaParts = [];
    if (car.brand) metaParts.push(car.brand);
    if (car.type) metaParts.push(car.type);
    const priceLabel = formatPricePerDay(car);
    if (priceLabel) metaParts.push(priceLabel);
    const meta = metaParts.join(' · ');
    const elCarMeta = document.getElementById('carMeta');
    if (elCarMeta) elCarMeta.textContent = meta;
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to load car');
    setText('carName', 'Car not found');
    return;
  }

  const session = getSession();
  const elEmail = document.getElementById('driverEmail');
  if (session && session.email && elEmail && !elEmail.value) {
    elEmail.value = session.email;
  }
}

async function handleSubmit() {
  if (submitting) return;
  showError('error', '');
  if (elSuccess) {
    elSuccess.hidden = true;
    elSuccess.textContent = '';
  }

  if (!currentCar || !carId) {
    showError('error', 'Car information is missing. Please go back and try again.');
    return;
  }

  const pickupDate = elPickupDate && elPickupDate.value ? elPickupDate.value : '';
  const dropoffDate = elDropoffDate && elDropoffDate.value ? elDropoffDate.value : '';
  const days = computeRentalDays(pickupDate, dropoffDate);
  if (!pickupDate || !dropoffDate || days <= 0) {
    showError('error', 'Please choose a valid pickup and drop-off date.');
    return;
  }

  const elGivenNames = document.getElementById('driverGivenNames');
  const elSurname = document.getElementById('driverSurname');
  const elAge = document.getElementById('driverAge');
  const elEmail = document.getElementById('driverEmail');
  const elMobile = document.getElementById('driverMobile');
  const elLicence = document.getElementById('driverLicenceCountryRegion');

  const driverGivenNames = elGivenNames && elGivenNames.value ? elGivenNames.value.trim() : '';
  const driverSurname = elSurname && elSurname.value ? elSurname.value.trim() : '';
  const driverAge = elAge && elAge.value ? parseInt(elAge.value, 10) : 0;
  const driverEmail = elEmail && elEmail.value ? elEmail.value.trim() : '';
  const driverMobile = elMobile && elMobile.value ? elMobile.value.trim() : '';
  const driverLicenceCountryRegion = elLicence && elLicence.value ? elLicence.value.trim() : '';

  if (!driverGivenNames || !driverSurname || !driverEmail) {
    showError('error', 'Please enter the driver\'s given names, surname, and email.');
    return;
  }

  const pricePerDay = Number(currentCar.pricePerDay || 0);
  const totalPrice = days * (Number.isFinite(pricePerDay) ? pricePerDay : 0);

  setSubmitting(true);
  try {
    const body = {
      carId,
      carName: currentCar.name,
      pickupDate,
      dropoffDate,
      totalPrice,
      driverGivenNames,
      driverSurname,
      driverAge: Number.isFinite(driverAge) ? driverAge : 0,
      driverEmail,
      driverMobile,
      driverLicenceCountryRegion,
    };

    const result = await createClientBooking(body);

    // Try to send voucher email via EmailJS (same structure as mobile app)
    let emailSent = false;
    let confirmUrl = '';
    try {
      const voucherToken = result && typeof result === 'object' && 'voucherToken' in result ? result.voucherToken : null;
      if (voucherToken) {
        const driverName = `${driverGivenNames} ${driverSurname}`.trim() || 'Guest';
        const origin = window.location.origin.replace(/\/$/, '');
        confirmUrl = `${origin}/voucher.html?token=${encodeURIComponent(voucherToken)}`;

        const templateParams = {
          to_email: driverEmail,
          driver_name: driverName,
          car_name: currentCar.name,
          pickup_date: pickupDate,
          dropoff_date: dropoffDate,
          total_price: `₱${totalPrice}`,
          voucher_token: voucherToken,
          confirm_url: confirmUrl,
        };

        if (typeof window !== 'undefined' && window.emailjs && typeof window.emailjs.send === 'function') {
          // IMPORTANT: replace 'YOUR_TEMPLATE_ID_HERE' with your real EmailJS template ID
          await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
          emailSent = true;
        }
      }
    } catch (e) {
      // Non-fatal: booking is created even if email fails
      console.error('Error sending booking voucher email via EmailJS', e);
      const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'EmailJS failed';
      if (confirmUrl) {
        showError('error', `Booking was created, but the voucher email failed to send (${msg}). Do not submit again. Use this link to confirm: ${confirmUrl}`);
      } else {
        showError('error', `Booking was created, but the voucher email failed to send (${msg}). Do not submit again.`);
      }
    }

    if (elSuccess) {
      elSuccess.hidden = false;
      const hasVoucher = result && typeof result === 'object' && 'voucherToken' in result && result.voucherToken;
      elSuccess.textContent = hasVoucher
        ? emailSent
          ? 'Booking request sent. Check your email shortly for a voucher link to confirm your booking.'
          : confirmUrl
            ? `Booking request sent, but the voucher email may not have been delivered. Do not submit again. Confirm using: ${confirmUrl}`
            : 'Booking request sent. Check your email shortly for a voucher link to confirm your booking.'
        : 'Booking request sent. We will email you with confirmation details.';
    }
  } catch (e) {
    showError('error', e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to create booking');
  } finally {
    setSubmitting(false);
  }
}

if (elPickupDate) elPickupDate.addEventListener('change', updateSummary);
if (elDropoffDate) elDropoffDate.addEventListener('change', updateSummary);
elSubmit?.addEventListener('click', handleSubmit);

init().then(() => {
  updateSummary();
});
