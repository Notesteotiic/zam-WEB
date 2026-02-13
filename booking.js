import { createClientBooking, getCar } from "./api.js";
import {
    getSession,
    installNav,
    parseQuery,
    setDisabled,
    setText,
    showError,
} from "./app.js";

installNav();

const EMAILJS_SERVICE_ID = "service_iqoar4k";
const EMAILJS_TEMPLATE_ID = "template_omm0nwm";
const EMAILJS_PUBLIC_KEY = "j-LTZ397WX72OXqR0";

try {
  if (
    typeof window !== "undefined" &&
    window.emailjs &&
    typeof window.emailjs.init === "function"
  ) {
    window.emailjs.init(EMAILJS_PUBLIC_KEY);
  }
} catch {}

const q = parseQuery();
const LAST_CAR_ID_KEY = "zam_last_car_id_v1";

function getCarIdFromQuery(query) {
  const candidates = [
    query?.carId,
    query?.carid,
    query?.id,
    query?.car,
    query?.car_id,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return candidates.length > 0 ? candidates[0] : null;
}

let carId = getCarIdFromQuery(q);
if (!carId) {
  try {
    const stored = localStorage.getItem(LAST_CAR_ID_KEY);
    carId = stored ? String(stored).trim() : null;
  } catch {}
}
if (carId) {
  try {
    localStorage.setItem(LAST_CAR_ID_KEY, carId);
  } catch {}
}

const elPickupDate = document.getElementById("pickupDate");
const elDropoffDate = document.getElementById("dropoffDate");
const elRentalSummary = document.getElementById("rentalSummary");
const elSubmit = document.getElementById("submit");
const elSuccess = document.getElementById("success");
const elConfirmLink = document.getElementById("confirmLink");
const elConfirmBooking = document.getElementById("confirmBooking");
const elMyBookingsWrap = document.getElementById("myBookingsWrap");
const LAST_VOUCHER_TOKEN_KEY = "zam_last_voucher_token_v1";

let currentCar = null;
let submitting = false;

function manilaTodayIso() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
      .toISOString()
      .slice(0, 10);
  }
}

function addDays(isoDate, days) {
  const v = String(isoDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const [yy, mm, dd] = v.split("-").map((x) => parseInt(x, 10));
  if (!yy || !mm || !dd) return "";
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function enhanceDateInput(el) {
  if (!el) return;
  el.setAttribute("inputmode", "none");
  el.setAttribute("autocomplete", "off");
  el.addEventListener("paste", (e) => e.preventDefault());
  el.addEventListener("keydown", (e) => {
    const allowKeys = new Set([
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ]);
    if (allowKeys.has(e.key)) return;
    if (e.key === "Backspace" || e.key === "Delete") return e.preventDefault();
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
      e.preventDefault();
  });
  const open = () => {
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {}
    }
  };
  el.addEventListener("focus", open);
  el.addEventListener("click", open);
}

function formatPeso(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₱0";
  const rounded = Math.round(n);
  return `₱${rounded.toLocaleString()}`;
}

function formatPricePerDay(car) {
  if (!car) return "";
  const price = Number(car.pricePerDay || 0);
  if (!Number.isFinite(price) || price <= 0) return "";
  return `${formatPeso(price)} / day`;
}

function computeRentalDays(pickup, dropoff) {
  if (!pickup || !dropoff) return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickup)) return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dropoff)) return 0;
  const [pY, pM, pD] = pickup.split("-").map((x) => parseInt(x, 10));
  const [dY, dM, dD] = dropoff.split("-").map((x) => parseInt(x, 10));
  const startMs = Date.UTC(pY, pM - 1, pD);
  const endMs = Date.UTC(dY, dM - 1, dD);
  const diffMs = endMs - startMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function updateSummary() {
  if (!elRentalSummary || !elPickupDate || !elDropoffDate) return;
  const pickup = elPickupDate.value;
  const dropoff = elDropoffDate.value;
  const days = computeRentalDays(pickup, dropoff);
  if (!currentCar || !pickup || !dropoff || days <= 0) {
    elRentalSummary.textContent =
      "Select valid pickup and drop-off dates to see days and estimated price.";
    return;
  }
  const pricePerDay = Number(currentCar.pricePerDay || 0);
  const perDay = Number.isFinite(pricePerDay) ? pricePerDay : 0;
  const total = days * perDay;
  elRentalSummary.innerHTML = `
    <div style="display:flex; justify-content: space-between; gap: 12px;">
      <span>${days} day(s)</span>
      <span style="font-weight: 900;">${formatPeso(total)}</span>
    </div>
    <div style="margin-top: 6px; font-size: 12px; color: var(--muted);">
      ${formatPeso(perDay)} / day
    </div>
  `;
}

function setSubmitting(next) {
  submitting = next;
  setDisabled("submit", submitting);
  if (elSubmit)
    elSubmit.textContent = submitting ? "Please wait..." : "Request booking";
}

function isValidEmail(email) {
  const v = String(email || "").trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function clearConfirmLink() {
  if (!elConfirmLink) return;
  elConfirmLink.hidden = true;
  elConfirmLink.textContent = "";
}

function setConfirmLink(url) {
  if (!elConfirmLink) return;
  elConfirmLink.hidden = false;
  elConfirmLink.textContent = "";
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = "Open voucher";
  a.className = "btn secondary";
  elConfirmLink.appendChild(a);
}

function validateForm({ showMessage = false } = {}) {
  const pickupDate =
    elPickupDate && elPickupDate.value ? elPickupDate.value : "";
  const dropoffDate =
    elDropoffDate && elDropoffDate.value ? elDropoffDate.value : "";
  const days = computeRentalDays(pickupDate, dropoffDate);

  const elKind = document.getElementById("kind");
  const elLocation = document.getElementById("location");
  const kind =
    elKind && "value" in elKind && elKind.value
      ? String(elKind.value)
      : "pickup";
  const location =
    elLocation && "value" in elLocation ? String(elLocation.value).trim() : "";

  const elGivenNames = document.getElementById("driverGivenNames");
  const elSurname = document.getElementById("driverSurname");
  const elAge = document.getElementById("driverAge");
  const elEmail = document.getElementById("driverEmail");
  const elMobile = document.getElementById("driverMobile");
  const elLicence = document.getElementById("driverLicenceCountryRegion");

  const driverGivenNames =
    elGivenNames && elGivenNames.value ? elGivenNames.value.trim() : "";
  const driverSurname =
    elSurname && elSurname.value ? elSurname.value.trim() : "";
  const driverAge = elAge && elAge.value ? parseInt(elAge.value, 10) : 0;
  const driverEmail = elEmail && elEmail.value ? elEmail.value.trim() : "";
  const driverEmailNorm = driverEmail ? driverEmail.toLowerCase() : "";
  const driverMobile = elMobile && elMobile.value ? elMobile.value.trim() : "";
  const driverLicenceCountryRegion =
    elLicence && elLicence.value ? elLicence.value.trim() : "";

  const checked = !!(
    elConfirmBooking &&
    "checked" in elConfirmBooking &&
    elConfirmBooking.checked
  );
  const carOk = !!currentCar && !!carId;
  const availabilityOk = !currentCar || !!currentCar.isAvailable;

  const todayStr = manilaTodayIso();

  let msg = "";
  if (!carOk) msg = "Car information is missing. Please go back and try again.";
  else if (!availabilityOk)
    msg = "This car is currently unavailable and cannot be booked.";
  else if (pickupDate && pickupDate < todayStr)
    msg = "Pickup date cannot be in the past.";
  else if (pickupDate && dropoffDate && dropoffDate <= pickupDate)
    msg = "Drop-off date must be after pickup date.";
  else if (!pickupDate || !dropoffDate || days <= 0)
    msg = "Please choose a valid pickup and drop-off date.";
  else if (days > 30)
    msg = "Bookings are limited to 30 days. Please adjust your dates.";
  else if (!driverGivenNames || !driverSurname)
    msg = "Please enter the driver's given names and surname.";
  else if (!driverEmailNorm || !isValidEmail(driverEmailNorm))
    msg = "Please enter a valid driver email address.";
  else if (!Number.isFinite(driverAge) || driverAge < 18)
    msg = "Driver must be at least 18 years old.";
  else if (!driverMobile) msg = "Please enter a mobile number.";
  else if (!driverLicenceCountryRegion)
    msg = "Please enter the licence country/region.";
  else if (!checked) msg = "Please confirm the details are correct.";

  const ok = !msg;

  if (!submitting) {
    setDisabled("submit", !ok);
    if (elSubmit) elSubmit.textContent = "Request booking";
  }

  if (showMessage) showError("error", msg);
  return {
    ok,
    values: {
      kind,
      location,
      pickupDate,
      dropoffDate,
      days,
      driverGivenNames,
      driverSurname,
      driverAge: Number.isFinite(driverAge) ? driverAge : 0,
      driverEmail: driverEmailNorm,
      driverMobile,
      driverLicenceCountryRegion,
    },
  };
}

async function init() {
  showError("error", "");

  if (!carId) {
    showError("error", "Missing car id");
    setText("carName", "Car not found");
    return;
  }

  const session = getSession();
  if (!session?.email) {
    window.location.href = `./login.html?next=${encodeURIComponent(
      `./booking.html?carId=${encodeURIComponent(String(carId))}`,
    )}`;
    return;
  }

  try {
    const car = await getCar(carId);
    currentCar = car;
    document.title = `ZAM Rentals - Book ${car.name}`;
    setText("carName", car.name);
    const metaParts = [];
    if (car.brand) metaParts.push(car.brand);
    if (car.type) metaParts.push(car.type);
    const priceLabel = formatPricePerDay(car);
    if (priceLabel) metaParts.push(priceLabel);
    const meta = metaParts.join(" · ");
    const elCarMeta = document.getElementById("carMeta");
    if (elCarMeta) elCarMeta.textContent = meta;

    const elTripNotice = document.getElementById("tripNotice");
    if (elTripNotice) {
      elTripNotice.textContent = car.isAvailable
        ? "Choose your pickup and drop-off dates."
        : "This car is currently unavailable.";
    }
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to load car",
    );
    setText("carName", "Car not found");
    return;
  }

  const elEmail = document.getElementById("driverEmail");
  if (session && session.email && elEmail && !elEmail.value) {
    elEmail.value = session.email;
  }

  const todayStr = manilaTodayIso();
  if (elPickupDate && !elPickupDate.min) elPickupDate.min = todayStr;
  if (elDropoffDate && !elDropoffDate.min)
    elDropoffDate.min = addDays(todayStr, 1);

  enhanceDateInput(elPickupDate);
  enhanceDateInput(elDropoffDate);

  updateSummary();
  validateForm();
}

async function handleSubmit() {
  if (submitting) return;
  showError("error", "");
  clearConfirmLink();
  if (elSuccess) {
    elSuccess.hidden = true;
    elSuccess.textContent = "";
  }

  const session = getSession();
  if (!session?.email) {
    window.location.href = `./login.html?next=${encodeURIComponent(
      `./booking.html?carId=${encodeURIComponent(String(carId))}`,
    )}`;
    return;
  }

  const validation = validateForm({ showMessage: true });
  if (!validation.ok || !currentCar || !carId) return;

  const pricePerDay = Number(currentCar.pricePerDay || 0);
  const totalPrice =
    validation.values.days * (Number.isFinite(pricePerDay) ? pricePerDay : 0);

  setSubmitting(true);
  try {
    const body = {
      carId,
      carName: currentCar.name,
      kind: validation.values.kind,
      location: validation.values.location || null,
      pickupDate: validation.values.pickupDate,
      dropoffDate: validation.values.dropoffDate,
      totalPrice,
      createdByEmail: session.email,
      driverGivenNames: validation.values.driverGivenNames,
      driverSurname: validation.values.driverSurname,
      driverAge: validation.values.driverAge,
      driverEmail: validation.values.driverEmail,
      driverMobile: validation.values.driverMobile,
      driverLicenceCountryRegion: validation.values.driverLicenceCountryRegion,
    };

    const result = await createClientBooking(body);

    // Try to send voucher email via EmailJS (same structure as mobile app)
    let emailSent = false;
    let confirmUrl = "";
    try {
      const voucherToken =
        result && typeof result === "object" && "voucherToken" in result
          ? result.voucherToken
          : null;
      if (voucherToken) {
        const driverName =
          `${validation.values.driverGivenNames} ${validation.values.driverSurname}`.trim() ||
          "Guest";
        confirmUrl = new URL(
          `./voucher.html?token=${encodeURIComponent(voucherToken)}`,
          window.location.href,
        ).toString();
        try {
          localStorage.setItem(LAST_VOUCHER_TOKEN_KEY, String(voucherToken));
        } catch {}

        const templateParams = {
          to_email: validation.values.driverEmail,
          driver_name: driverName,
          car_name: currentCar.name,
          pickup_date: validation.values.pickupDate,
          dropoff_date: validation.values.dropoffDate,
          total_price: formatPeso(totalPrice),
          voucher_token: voucherToken,
          voucherToken,
          token: voucherToken,
          confirm_url: confirmUrl,
          confirmUrl,
          confirm_link: confirmUrl,
          confirmLink: confirmUrl,
          voucher_link: confirmUrl,
          voucherLink: confirmUrl,
          confirmation_url: confirmUrl,
          confirmationUrl: confirmUrl,
          confirmation_link: confirmUrl,
          confirmationLink: confirmUrl,
          voucher_url: confirmUrl,
          voucherUrl: confirmUrl,
          url: confirmUrl,
          link: confirmUrl,
        };

        if (
          typeof window !== "undefined" &&
          window.emailjs &&
          typeof window.emailjs.send === "function"
        ) {
          await window.emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            EMAILJS_PUBLIC_KEY,
          );
          emailSent = true;
        }
      }
    } catch (e) {
      // Non-fatal: booking is created even if email fails
      const msg =
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "EmailJS failed";
      showError(
        "error",
        `Booking was created, but the voucher email failed to send (${msg}). Do not submit again. Please check your email spam folder or contact ZAM.`,
      );
    }

    if (elSuccess) {
      elSuccess.hidden = false;
      const hasVoucher =
        result &&
        typeof result === "object" &&
        "voucherToken" in result &&
        result.voucherToken;
      elSuccess.textContent = hasVoucher
        ? emailSent
          ? "Booking request sent. Check your email for a voucher link to confirm your booking. You can also track it in My bookings."
          : "Booking request sent. Check your email for a voucher link to confirm your booking. You can also track it in My bookings."
        : "Booking request sent. You can track it in My bookings.";
      clearConfirmLink();
    }
    if (elMyBookingsWrap) elMyBookingsWrap.hidden = false;
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to create booking",
    );
  } finally {
    setSubmitting(false);
    validateForm();
  }
}

if (elPickupDate)
  elPickupDate.addEventListener("change", () => {
    if (elDropoffDate && elPickupDate.value) {
      const minDropoff = addDays(elPickupDate.value, 1);
      if (minDropoff) elDropoffDate.min = minDropoff;
      if (!elDropoffDate.value || elDropoffDate.value <= elPickupDate.value)
        elDropoffDate.value = "";
    }
    updateSummary();
    validateForm();
  });
if (elDropoffDate)
  elDropoffDate.addEventListener("change", () => {
    updateSummary();
    validateForm();
  });
document
  .getElementById("driverGivenNames")
  ?.addEventListener("input", () => validateForm());
document
  .getElementById("driverSurname")
  ?.addEventListener("input", () => validateForm());
document
  .getElementById("driverAge")
  ?.addEventListener("input", () => validateForm());
document
  .getElementById("driverEmail")
  ?.addEventListener("input", () => validateForm());
document
  .getElementById("driverMobile")
  ?.addEventListener("input", () => validateForm());
document
  .getElementById("driverLicenceCountryRegion")
  ?.addEventListener("input", () => validateForm());
document
  .getElementById("kind")
  ?.addEventListener("change", () => validateForm());
document
  .getElementById("location")
  ?.addEventListener("input", () => validateForm());
elConfirmBooking?.addEventListener("change", () => validateForm());
elSubmit?.addEventListener("click", handleSubmit);

init();
