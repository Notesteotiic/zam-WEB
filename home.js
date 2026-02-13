import { listBrands, listCars, listFeaturedCars } from "./api.js";
import { installNav, showError } from "./app.js";

installNav();

const elFeatured = document.getElementById("featured");
const elCars = document.getElementById("cars");
const elBrand = document.getElementById("brand");
const elQ = document.getElementById("q");
const elSort = document.getElementById("sort");

let cars = [];
let featuredCars = [];
let brandOptions = ["All"];

function formatPeso(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₱0";
  const rounded = Math.round(n);
  return `₱${rounded.toLocaleString()}`;
}

function dedupeCarsById(rows) {
  const out = [];
  const seen = new Set();
  for (const c of Array.isArray(rows) ? rows : []) {
    const id = c && typeof c === "object" && "id" in c ? String(c.id) : "";
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

function renderCarCard(car) {
  const availabilityClass = car.isAvailable ? "good" : "bad";
  const availabilityLabel = car.isAvailable ? "AVAILABLE" : "UNAVAILABLE";
  const imgSrc =
    car.imageUrl && String(car.imageUrl).trim()
      ? String(car.imageUrl).trim()
      : "./HEROcorolla.jpg";
  const seats = Number(car.seats);
  const seatsLabel = Number.isFinite(seats) ? `${seats} seats` : "— seats";

  const div = document.createElement("a");
  div.className = "car";
  div.href = `./car.html?id=${encodeURIComponent(car.id)}`;
  div.addEventListener("click", () => {
    try {
      localStorage.setItem("zam_last_car_id_v1", String(car.id));
    } catch {}
  });
  div.innerHTML = `
    <div class="car-inner">
      <div class="car-media">
        <img class="car-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(car.name)}" onerror="this.onerror=null;this.src='./LOGO.png';" />
        <div class="car-badges">
          <span class="pill ${availabilityClass}">${availabilityLabel}</span>
          <span class="pill" style="border-color: rgba(249,115,22,0.35);">${escapeHtml(formatPeso(car.pricePerDay))} / day</span>
        </div>
      </div>
      <div class="car-body">
        <div style="min-width:0;">
          <p class="car-title">${escapeHtml(car.name)}</p>
          <p class="car-meta">${escapeHtml(car.type)} • ${escapeHtml(car.brand ?? "—")} • ${escapeHtml(seatsLabel)}</p>
        </div>
        <div style="display:flex; justify-content: space-between; align-items:flex-end; gap: 10px;">
          <span class="pill">Tap for details</span>
          <span class="btn secondary">View</span>
        </div>
      </div>
    </div>
  `;
  return div;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyFilters(rows) {
  const q = (elQ?.value ?? "").trim().toLowerCase();
  const brand = elBrand?.value ?? "All";
  const sort = elSort?.value ?? "high";

  return rows
    .filter((c) => {
      if (brand === "All") return true;
      return (
        String(c.brand ?? "").toLowerCase() === String(brand).toLowerCase()
      );
    })
    .filter((c) => {
      if (!q) return true;
      const hay = `${c.name} ${c.type} ${c.brand ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice()
    .sort((a, b) =>
      sort === "low"
        ? a.pricePerDay - b.pricePerDay
        : b.pricePerDay - a.pricePerDay,
    );
}

function render() {
  if (!elCars || !elFeatured) return;
  elCars.innerHTML = "";
  elFeatured.innerHTML = "";

  const filteredAll = applyFilters(cars);
  const filteredFeatured = applyFilters(featuredCars);

  for (const c of filteredFeatured) elFeatured.appendChild(renderCarCard(c));
  for (const c of filteredAll) elCars.appendChild(renderCarCard(c));
}

function renderBrandOptions() {
  if (!elBrand) return;
  elBrand.innerHTML = "";
  for (const b of brandOptions) {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    elBrand.appendChild(opt);
  }
}

async function init() {
  showError("error", "");
  try {
    const [all, featured, brands] = await Promise.all([
      listCars(),
      listFeaturedCars(),
      listBrands(),
    ]);

    const featuredDeduped = dedupeCarsById(featured);
    const featuredIds = new Set(featuredDeduped.map((c) => String(c.id)));
    const allDeduped = dedupeCarsById(all).filter(
      (c) => !featuredIds.has(String(c.id)),
    );

    cars = allDeduped;
    featuredCars = featuredDeduped;
    brandOptions = [
      "All",
      ...(Array.isArray(brands) ? brands.map((b) => b.name) : []),
    ];

    renderBrandOptions();
    render();
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to load cars",
    );
  }
}

elQ?.addEventListener("input", render);
elBrand?.addEventListener("change", render);
elSort?.addEventListener("change", render);

init();
