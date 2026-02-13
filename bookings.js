import {
  cancelMyBooking,
  listMyBookings,
  rescheduleMyBooking,
} from "./api.js";
import { getSession, installNav, setDisabled, showError } from "./app.js";

installNav();

const elList = document.getElementById("list");
const elRefresh = document.getElementById("refresh");
const elLastUpdated = document.getElementById("lastUpdated");
const elStats = document.getElementById("stats");
const elStatusFilter = document.getElementById("statusFilter");
const elQ = document.getElementById("q");

let busy = false;
let allBookings = [];

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusPill(status) {
  const label = String(status || "").toUpperCase();
  let cls = "pill";
  if (status === "completed") cls += " good";
  else if (status === "active" || status === "confirmed") cls += " warn";
  else cls += " bad";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function todayIso() {
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

function canCancelBooking(b) {
  const status = b?.status || "pending";
  if (status === "cancelled" || status === "completed") return false;
  if (!["pending", "confirmed", "active"].includes(status)) return false;

  if (status === "active") return true;

  const pickupDate = b?.pickupDate ? String(b.pickupDate) : "";
  if (!pickupDate) return true;

  return pickupDate >= todayIso();
}

function canRescheduleBooking(b) {
  const status = b?.status || "pending";
  if (!["pending", "confirmed"].includes(status)) return false;
  const pickupDate = b?.pickupDate ? String(b.pickupDate) : "";
  if (!pickupDate) return true;
  return pickupDate >= todayIso();
}

function voucherUrlFor(b) {
  const token = b?.voucherToken ? String(b.voucherToken) : "";
  if (!token) return "";
  return new URL(
    `./voucher.html?token=${encodeURIComponent(token)}`,
    window.location.href,
  ).toString();
}

function stepperHtml(b) {
  const status = b?.status || "pending";
  const labels = [
    "Requested",
    "Confirmed",
    "Active",
    status === "cancelled" ? "Cancelled" : "Completed",
  ];

  const isConfirmed =
    !!b?.confirmedAt || ["confirmed", "active", "completed"].includes(status);
  const isActive = ["active", "completed"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  const steps = [
    { label: labels[0], done: true, active: status === "pending" },
    { label: labels[1], done: isConfirmed, active: status === "confirmed" },
    { label: labels[2], done: isActive, active: status === "active" },
    {
      label: labels[3],
      done: isCompleted,
      active: isCompleted || isCancelled,
      cancelled: isCancelled,
    },
  ];

  return `
    <div class="stepper">
      ${steps
        .map((s) => {
          const cls = [
            "step",
            s.done ? "done" : "",
            s.active ? "active" : "",
            s.cancelled ? "cancelled" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
            <div class="${cls}">
              <div class="step-dot"></div>
              <div>${escapeHtml(s.label)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function formatMoneyPeso(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  return `₱${rounded.toLocaleString()}`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function renderBookingCard(b, email) {
  const div = document.createElement("div");
  div.className = "car";

  const carLabel = b?.car
    ? `${b.car.name}${b.car.brand ? ` (${b.car.brand})` : ""}`
    : b?.carName
      ? String(b.carName)
      : "No car linked";

  const pickup = b?.pickupDate ? String(b.pickupDate) : "";
  const dropoff = b?.dropoffDate ? String(b.dropoffDate) : "";
  const dateLabel =
    pickup && dropoff
      ? `Trip: ${pickup} → ${dropoff}`
      : pickup
        ? `Pickup: ${pickup}`
        : "";

  const status = b?.status || "pending";
  const statusHtml = statusPill(status);
  const canCancel = canCancelBooking(b);
  const canReschedule = canRescheduleBooking(b);

  const kindLabel = b?.kind ? String(b.kind).toUpperCase() : "";
  const locationLabel = b?.location ? String(b.location) : "";
  const cancelledAtLabel = b?.cancelledAt
    ? `Cancelled: ${new Date(String(b.cancelledAt)).toLocaleString()}`
    : "";
  const cancellationFeeLabel =
    b?.status === "cancelled"
      ? `Cancellation bill: ${escapeHtml(formatMoneyPeso(Number(b?.cancellationFee || 0)))}`
      : "";
  const endedAtLabel = b?.endedAt
    ? `Ended: ${new Date(String(b.endedAt)).toLocaleString()}`
    : "";
  const billedTotalLabel =
    b?.status === "completed" && typeof b?.billedTotal === "number"
      ? `Bill to date: ${escapeHtml(formatMoneyPeso(Number(b?.billedTotal || 0)))}`
      : "";

  div.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
          <div style="min-width:0;">
            <p class="car-title">${escapeHtml(carLabel)}</p>
            <p class="car-meta">${escapeHtml(email)}</p>
            ${dateLabel ? `<p class="car-meta">${escapeHtml(dateLabel)}</p>` : ""}
            ${kindLabel ? `<p class="car-meta">${escapeHtml(kindLabel)}${locationLabel ? ` • ${escapeHtml(locationLabel)}` : ""}</p>` : locationLabel ? `<p class="car-meta">${escapeHtml(locationLabel)}</p>` : ""}
            ${typeof b?.totalPrice === "number" && Number.isFinite(b.totalPrice) ? `<p class="car-meta">Estimated total: ${escapeHtml(formatMoneyPeso(b.totalPrice))}</p>` : ""}
            ${cancelledAtLabel ? `<p class="car-meta">${escapeHtml(cancelledAtLabel)}</p>` : ""}
            ${cancellationFeeLabel ? `<p class="car-meta">${cancellationFeeLabel}</p>` : ""}
            ${endedAtLabel ? `<p class="car-meta">${escapeHtml(endedAtLabel)}</p>` : ""}
            ${billedTotalLabel ? `<p class="car-meta">${billedTotalLabel}</p>` : ""}
          </div>
          ${statusHtml}
        </div>

        ${stepperHtml(b)}

        <div style="margin-top: 12px; display:flex; gap: 10px; flex-wrap: wrap;">
          ${
            canReschedule
              ? `<button class="btn secondary" type="button" data-action="edit">Reschedule</button>`
              : ""
          }
          ${
            canCancel
              ? `<button class="btn secondary" type="button" data-action="cancel">Revoke booking</button>`
              : ""
          }
        </div>

        <div class="inline-form hidden" data-form="edit">
          <div class="controls">
            <div class="field" style="grid-column: span 4;">
              <div class="label">Service type</div>
              <select class="input" data-field="kind">
                <option value="pickup">Pickup</option>
                <option value="dropoff">Drop-off</option>
              </select>
            </div>
            <div class="field" style="grid-column: span 8;">
              <div class="label">Location (optional)</div>
              <input class="input" data-field="location" placeholder="e.g. Dumaguete City" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <div class="label">Pickup date</div>
              <input class="input" data-field="pickupDate" type="date" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <div class="label">Drop-off date</div>
              <input class="input" data-field="dropoffDate" type="date" />
            </div>
          </div>
          <div style="display:flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn secondary" type="button" data-action="save">Save changes</button>
            <button class="btn secondary" type="button" data-action="close">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = div.querySelector('[data-form="edit"]');
  const btnEdit = div.querySelector('[data-action="edit"]');
  const btnClose = div.querySelector('[data-action="close"]');
  const btnSave = div.querySelector('[data-action="save"]');

  btnEdit?.addEventListener("click", () => {
    if (!form) return;
    form.classList.toggle("hidden");
    const kindEl = form.querySelector('[data-field="kind"]');
    const locationEl = form.querySelector('[data-field="location"]');
    const pickupEl = form.querySelector('[data-field="pickupDate"]');
    const dropoffEl = form.querySelector('[data-field="dropoffDate"]');
    if (kindEl && "value" in kindEl) kindEl.value = b?.kind || "pickup";
    if (locationEl && "value" in locationEl)
      locationEl.value = b?.location || "";
    if (pickupEl && "value" in pickupEl) pickupEl.value = b?.pickupDate || "";
    if (dropoffEl && "value" in dropoffEl)
      dropoffEl.value = b?.dropoffDate || "";
    const min = todayIso();
    if (pickupEl) pickupEl.min = min;
    if (dropoffEl) dropoffEl.min = addDays(pickupEl?.value || min, 1) || min;
    enhanceDateInput(pickupEl);
    enhanceDateInput(dropoffEl);
    if (pickupEl && dropoffEl) {
      pickupEl.onchange = () => {
        const nextMin = addDays(pickupEl.value, 1);
        if (nextMin) dropoffEl.min = nextMin;
        if (
          dropoffEl.value &&
          pickupEl.value &&
          dropoffEl.value <= pickupEl.value
        )
          dropoffEl.value = "";
      };
    }
  });

  btnClose?.addEventListener("click", () => {
    if (!form) return;
    form.classList.add("hidden");
  });

  btnSave?.addEventListener("click", async () => {
    if (!form) return;
    const pickupEl = form.querySelector('[data-field="pickupDate"]');
    const dropoffEl = form.querySelector('[data-field="dropoffDate"]');
    const kindEl = form.querySelector('[data-field="kind"]');
    const locationEl = form.querySelector('[data-field="location"]');

    const pickupDate =
      pickupEl && "value" in pickupEl ? String(pickupEl.value) : "";
    const dropoffDate =
      dropoffEl && "value" in dropoffEl ? String(dropoffEl.value) : "";
    const kind = kindEl && "value" in kindEl ? String(kindEl.value) : "pickup";
    const location =
      locationEl && "value" in locationEl
        ? String(locationEl.value).trim()
        : "";

    try {
      await rescheduleMyBooking(String(b.id), email, {
        pickupDate,
        dropoffDate,
        kind,
        location,
      });
      await load();
    } catch (e) {
      showError(
        "error",
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Reschedule failed",
      );
    }
  });

  div
    .querySelector('[data-action="cancel"]')
    ?.addEventListener("click", async () => {
      const ok = window.confirm(
        "Revoke this booking?\n\nIf it already started, your bill will be based on days used so far.",
      );
      if (!ok) return;
      try {
        await cancelMyBooking(String(b.id), email);
        await load();
      } catch (e) {
        showError(
          "error",
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "Cancel failed",
        );
      }
    });

  return div;
}

function renderStats(bookings) {
  if (!elStats) return;
  elStats.innerHTML = "";
  const list = Array.isArray(bookings) ? bookings : [];
  const total = list.length;
  const counts = {
    pending: 0,
    confirmed: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const b of list) {
    const s = b?.status || "pending";
    if (s in counts) counts[s] += 1;
  }

  const card = document.createElement("div");
  card.className = "stats-card";
  const metrics = [
    { key: "pending", label: "Pending", value: counts.pending },
    { key: "confirmed", label: "Confirmed", value: counts.confirmed },
    { key: "active", label: "Active", value: counts.active },
    { key: "completed", label: "Completed", value: counts.completed },
    { key: "cancelled", label: "Cancelled", value: counts.cancelled },
  ];

  card.innerHTML = `
    <div class="stats-metric">
      <div style="font-weight:900; color: var(--text);">Overview</div>
      <div>${escapeHtml(String(total))} total</div>
    </div>
    <div class="stats-row">
      ${metrics
        .map((m) => {
          const pct = total > 0 ? Math.round((m.value / total) * 100) : 0;
          return `
            <div>
              <div class="stats-metric">
                <span>${escapeHtml(m.label)}</span>
                <span>${escapeHtml(String(m.value))}</span>
              </div>
              <div class="bar">
                <div class="bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
  elStats.appendChild(card);
}

function applyFilters() {
  const status =
    elStatusFilter && "value" in elStatusFilter
      ? String(elStatusFilter.value)
      : "all";
  const q = elQ && "value" in elQ ? normalizeText(elQ.value) : "";

  let list = Array.isArray(allBookings) ? [...allBookings] : [];

  if (status !== "all")
    list = list.filter((b) => (b?.status || "pending") === status);
  if (q) {
    list = list.filter((b) => {
      const carName = b?.car?.name || b?.carName || "";
      const hay = normalizeText(
        [
          carName,
          b?.car?.brand || "",
          b?.status || "",
          b?.pickupDate || "",
          b?.dropoffDate || "",
          b?.location || "",
          b?.kind || "",
        ].join(" "),
      );
      return hay.includes(q);
    });
  }

  renderStats(allBookings);

  if (elList) {
    elList.innerHTML = "";
    if (list.length === 0) {
      const n = document.createElement("div");
      n.className = "notice";
      n.textContent = "No bookings match your filters.";
      elList.appendChild(n);
    } else {
      const session = getSession();
      const email = session?.email || "";
      for (const b of list) elList.appendChild(renderBookingCard(b, email));
    }
  }
}

async function load() {
  if (busy) return;
  const session = getSession();
  if (!session?.email) {
    window.location.href = `./login.html?next=${encodeURIComponent("./bookings.html")}`;
    return;
  }

  busy = true;
  setDisabled("refresh", true);
  showError("error", "");

  try {
    const rows = await listMyBookings(session.email);
    allBookings = Array.isArray(rows) ? rows : [];
    applyFilters();

    if (elLastUpdated) {
      elLastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
    }
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to load bookings",
    );
  } finally {
    busy = false;
    setDisabled("refresh", false);
  }
}

elRefresh?.addEventListener("click", load);
elStatusFilter?.addEventListener("change", () => applyFilters());
elQ?.addEventListener("input", () => applyFilters());
load();
