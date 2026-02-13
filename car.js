import { getCar } from "./api.js";
import { installNav, parseQuery, setHtml, setText, showError } from "./app.js";

installNav();

const q = parseQuery();
const LAST_CAR_ID_KEY = "zam_last_car_id_v1";

function getCarIdFromQuery(query) {
  const candidates = [
    query?.id,
    query?.carId,
    query?.carid,
    query?.car,
    query?.car_id,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return candidates.length > 0 ? candidates[0] : null;
}

let id = getCarIdFromQuery(q);
if (!id) {
  try {
    const stored = localStorage.getItem(LAST_CAR_ID_KEY);
    id = stored ? String(stored).trim() : null;
  } catch {}
}
if (id) {
  try {
    localStorage.setItem(LAST_CAR_ID_KEY, String(id));
  } catch {}
}

function formatPeso(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₱0";
  const rounded = Math.round(n);
  return `₱${rounded.toLocaleString()}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function init() {
  showError("error", "");

  if (!id) {
    showError("error", "Missing car id");
    setText("carName", "Car not found");
    return;
  }

  try {
    const car = await getCar(id);
    document.title = `ZAM Rentals - ${car.name}`;

    const img = document.getElementById("carImg");
    if (img) {
      const src =
        car.imageUrl && String(car.imageUrl).trim()
          ? String(car.imageUrl).trim()
          : "./LOGO.png";
      img.src = src;
      img.onerror = () => {
        img.onerror = null;
        img.src = "./LOGO.png";
      };
    }

    setText("carName", car.name);
    setText("carType", car.type);
    setHtml("brand", escapeHtml(car.brand ?? "—"));
    setHtml("seats", escapeHtml(String(car.seats)));
    setHtml("price", escapeHtml(`${formatPeso(car.pricePerDay)} / day`));

    const pill = document.getElementById("availabilityPill");
    if (pill) {
      pill.className = `pill ${car.isAvailable ? "good" : "bad"}`;
      pill.textContent = car.isAvailable ? "AVAILABLE" : "UNAVAILABLE";
    }

    const link = document.getElementById("bookingLink");
    if (link) {
      if (car.isAvailable) {
        link.href = `./booking.html?carId=${encodeURIComponent(id)}`;
        link.textContent = "Book this car";
        link.classList.remove("secondary");
      } else {
        link.href = "#";
        link.textContent = "Unavailable";
        link.classList.add("secondary");
        link.addEventListener("click", (e) => e.preventDefault());
      }
    }
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to load car",
    );
    setText("carName", "Car not found");
  }
}

init();
