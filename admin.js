import {
    addTicketMessage,
    createCar,
    deleteBooking,
    deleteCar,
    endBookingEarly,
    getTicketById,
    listBookingHistory,
    listBookings,
    listCancelledBookings,
    listCars,
    listSupportTicketsForAdmin,
    listUnconfirmedBookings,
    updateBooking,
    updateCar,
} from "./api.js";
import {
    formatDateTime,
    getSession,
    installNav,
    setDisabled,
    showError,
} from "./app.js";

installNav();

const elBookings = document.getElementById("bookings");
const elError = document.getElementById("error");
const elRefresh = document.getElementById("refresh");
const elView = document.getElementById("view");
const elQ = document.getElementById("q");
const elViewTitle = document.getElementById("viewTitle");
const elLastUpdated = document.getElementById("lastUpdated");
const elNavViewButtons = Array.from(
  document.querySelectorAll("[data-nav-view]"),
);

function isValidView(v) {
  return [
    "confirmed",
    "pending",
    "history",
    "cancelled",
    "cars",
    "support",
  ].includes(String(v || ""));
}

function setView(nextView) {
  if (!elView || !("value" in elView)) return;
  const v = isValidView(nextView) ? String(nextView) : "confirmed";
  elView.value = v;
  try {
    localStorage.setItem("admin_view", v);
  } catch {}
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

function initViewFromUrlOrStorage() {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("view");
    if (fromUrl && isValidView(fromUrl)) {
      setView(fromUrl);
      return;
    }
  } catch {}
  try {
    const fromStorage = localStorage.getItem("admin_view");
    if (fromStorage && isValidView(fromStorage)) {
      setView(fromStorage);
    }
  } catch {}
}

function ensureAdmin() {
  const session = getSession();
  const isAdmin = !!session && session.role === "admin";
  if (!isAdmin) {
    window.location.href = `./login.html?next=${encodeURIComponent("./admin.html")}`;
  }
}

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function viewTitle(view) {
  if (view === "pending") return "Pending requests";
  if (view === "history") return "Booking history";
  if (view === "cancelled") return "Cancelled bookings";
  if (view === "cars") return "Cars";
  if (view === "support") return "Support";
  return "Confirmed applications";
}

function emptyMessage(view) {
  if (view === "pending") return "No pending booking requests.";
  if (view === "history") return "No completed bookings yet.";
  if (view === "cancelled") return "No cancelled bookings yet.";
  if (view === "cars") return "No cars found.";
  if (view === "support") return "No support chats found.";
  return "No confirmed bookings yet.";
}

function normalize(s) {
  return String(s ?? "").toLowerCase();
}

function matchesQuery(b, q, view) {
  const needle = normalize(q).trim();
  if (!needle) return true;
  const parts =
    view === "cars"
      ? [b?.id, b?.name, b?.type, b?.brand, b?.accent, b?.imageUrl].map((x) =>
          normalize(x),
        )
      : view === "support"
        ? [b?.subject, b?.description, b?.status, b?.createdBy, b?.id].map(
            (x) => normalize(x),
          )
        : [
            b?.name,
            b?.status,
            b?.kind,
            b?.location,
            b?.driverEmail,
            b?.driverGivenNames,
            b?.driverSurname,
            b?.car?.name,
            b?.car?.brand,
          ].map((x) => normalize(x));
  return parts.some((p) => p.includes(needle));
}

function renderCarCreateCard() {
  const div = document.createElement("div");
  div.className = "car";
  div.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <p class="car-title">Add car</p>
        <div class="controls" style="margin-top: 12px;">
          <div class="field" style="grid-column: span 6;">
            <div class="label">Name</div>
            <input class="input" data-field="name" placeholder="e.g. Toyota Vios" />
          </div>
          <div class="field" style="grid-column: span 6;">
            <div class="label">Type</div>
            <input class="input" data-field="type" placeholder="e.g. Sedan" />
          </div>
          <div class="field" style="grid-column: span 6;">
            <div class="label">Brand</div>
            <input class="input" data-field="brand" placeholder="e.g. Toyota" />
          </div>
          <div class="field" style="grid-column: span 3;">
            <div class="label">Seats</div>
            <input class="input" data-field="seats" type="number" min="1" step="1" placeholder="4" />
          </div>
          <div class="field" style="grid-column: span 3;">
            <div class="label">Price / day</div>
            <input class="input" data-field="pricePerDay" type="number" min="0" step="1" placeholder="1500" />
          </div>
          <div class="field" style="grid-column: span 6;">
            <div class="label">Accent</div>
            <input class="input" data-field="accent" placeholder="e.g. blue" />
          </div>
          <div class="field" style="grid-column: span 6;">
            <div class="label">Picture</div>
            <input class="input" data-field="imageUrl" type="hidden" value="" />
            <input class="input" data-field="imageFile" type="file" accept="image/*" />
            <img data-role="imagePreview" alt="Car preview" hidden style="margin-top: 10px; width: 100%; max-height: 210px; object-fit: cover; border-radius: 14px; border: 1px solid var(--border);" />
          </div>
          <div class="field" style="grid-column: span 6;">
            <label class="pill" style="display:flex; gap: 8px; align-items:center;">
              <input data-field="isFeatured" type="checkbox" />
              Featured
            </label>
          </div>
          <div class="field" style="grid-column: span 6;">
            <label class="pill" style="display:flex; gap: 8px; align-items:center;">
              <input data-field="isAvailable" type="checkbox" checked />
              Available
            </label>
          </div>
          <div class="field" style="grid-column: span 12;">
            <button class="btn" type="button" data-action="create">Create car</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const createFile = div.querySelector('[data-field="imageFile"]');
  const createImageUrl = div.querySelector('[data-field="imageUrl"]');
  const createPreview = div.querySelector('[data-role="imagePreview"]');
  createFile?.addEventListener("change", async () => {
    try {
      const file =
        createFile.files && createFile.files[0] ? createFile.files[0] : null;
      if (!file) return;
      const url = await readFileAsDataUrl(file);
      if (createImageUrl) createImageUrl.value = url;
      if (createPreview) {
        createPreview.src = url;
        createPreview.hidden = false;
      }
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Unable to read image",
      );
    }
  });

  div
    .querySelector('[data-action="create"]')
    ?.addEventListener("click", async () => {
      const get = (k) => div.querySelector(`[data-field="${k}"]`);
      const payload = {
        name: String(get("name")?.value ?? "").trim(),
        type: String(get("type")?.value ?? "").trim(),
        brand: String(get("brand")?.value ?? "").trim(),
        seats: Number(get("seats")?.value ?? ""),
        pricePerDay: Number(get("pricePerDay")?.value ?? ""),
        accent: String(get("accent")?.value ?? "").trim(),
        imageUrl: String(get("imageUrl")?.value ?? "").trim(),
        isFeatured: !!get("isFeatured")?.checked,
        isAvailable: !!get("isAvailable")?.checked,
      };
      const ok = window.confirm(
        `Create this car?\n\n${payload.name || "New car"}`,
      );
      if (!ok) return;
      try {
        await createCar(payload);
        await load();
      } catch (err) {
        showError(
          "error",
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "Create failed",
        );
      }
    });

  return div;
}

function renderCarCard(c) {
  const div = document.createElement("div");
  div.className = "car";

  const featured = c.isFeatured ? "FEATURED" : "STANDARD";
  const availability = c.isAvailable ? "AVAILABLE" : "UNAVAILABLE";
  const availabilityCls = c.isAvailable ? "good" : "bad";
  const imageHtml = c.imageUrl
    ? `<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name || "Car")}" style="width: 86px; height: 64px; object-fit: cover; border-radius: 14px; border: 1px solid var(--border);" />`
    : "";

  div.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
          <div style="display:flex; gap: 12px; min-width: 0; align-items:flex-start;">
            ${imageHtml}
            <div style="min-width:0;">
              <p class="car-title">${escapeHtml(c.name || "Car")}</p>
              <p class="car-meta">${escapeHtml(`${c.type || "—"}${c.brand ? ` · ${c.brand}` : ""}`)}</p>
              <p class="car-meta">${escapeHtml(`Seats: ${c.seats ?? "—"} · ₱${Math.round(Number(c.pricePerDay || 0)).toLocaleString()} / day`)}</p>
            </div>
          </div>
          <div style="display:flex; gap: 8px; align-items:center; flex-wrap: wrap; justify-content:flex-end;">
            <span class="pill">${escapeHtml(featured)}</span>
            <span class="pill ${availabilityCls}">${escapeHtml(availability)}</span>
          </div>
        </div>

        <div style="margin-top: 12px; display:flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn secondary" type="button" data-action="toggle">Edit</button>
          <button class="btn secondary" type="button" data-action="delete">Delete</button>
        </div>

        <div data-section="edit" hidden style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
          <div class="controls">
            <div class="field" style="grid-column: span 6;">
              <div class="label">Name</div>
              <input class="input" data-field="name" value="${escapeHtml(c.name ?? "")}" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <div class="label">Type</div>
              <input class="input" data-field="type" value="${escapeHtml(c.type ?? "")}" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <div class="label">Brand</div>
              <input class="input" data-field="brand" value="${escapeHtml(c.brand ?? "")}" />
            </div>
            <div class="field" style="grid-column: span 3;">
              <div class="label">Seats</div>
              <input class="input" data-field="seats" type="number" min="1" step="1" value="${escapeHtml(String(c.seats ?? 4))}" />
            </div>
            <div class="field" style="grid-column: span 3;">
              <div class="label">Price / day</div>
              <input class="input" data-field="pricePerDay" type="number" min="0" step="1" value="${escapeHtml(String(c.pricePerDay ?? 0))}" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <div class="label">Accent</div>
              <input class="input" data-field="accent" value="${escapeHtml(c.accent ?? "")}" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <div class="label">Picture</div>
              <input class="input" data-field="imageUrl" type="hidden" value="${escapeHtml(c.imageUrl ?? "")}" />
              <input class="input" data-field="imageFile" type="file" accept="image/*" />
              <img data-role="imagePreview" alt="Car preview" ${c.imageUrl ? "" : "hidden"} src="${escapeHtml(c.imageUrl ?? "")}" style="margin-top: 10px; width: 100%; max-height: 210px; object-fit: cover; border-radius: 14px; border: 1px solid var(--border);" />
            </div>
            <div class="field" style="grid-column: span 6;">
              <label class="pill" style="display:flex; gap: 8px; align-items:center;">
                <input data-field="isFeatured" type="checkbox" ${c.isFeatured ? "checked" : ""} />
                Featured
              </label>
            </div>
            <div class="field" style="grid-column: span 6;">
              <label class="pill" style="display:flex; gap: 8px; align-items:center;">
                <input data-field="isAvailable" type="checkbox" ${c.isAvailable ? "checked" : ""} />
                Available
              </label>
            </div>
            <div class="field" style="grid-column: span 12;">
              <button class="btn" type="button" data-action="save">Save changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const editSection = div.querySelector('[data-section="edit"]');
  div.querySelector('[data-action="toggle"]')?.addEventListener("click", () => {
    if (!editSection) return;
    editSection.hidden = !editSection.hidden;
  });

  const editFile = div.querySelector('[data-field="imageFile"]');
  const editImageUrl = div.querySelector('[data-field="imageUrl"]');
  const editPreview = div.querySelector('[data-role="imagePreview"]');
  editFile?.addEventListener("change", async () => {
    try {
      const file =
        editFile.files && editFile.files[0] ? editFile.files[0] : null;
      if (!file) return;
      const url = await readFileAsDataUrl(file);
      if (editImageUrl) editImageUrl.value = url;
      if (editPreview) {
        editPreview.src = url;
        editPreview.hidden = false;
      }
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Unable to read image",
      );
    }
  });

  div
    .querySelector('[data-action="save"]')
    ?.addEventListener("click", async () => {
      const get = (k) => div.querySelector(`[data-field="${k}"]`);
      const payload = {
        name: String(get("name")?.value ?? "").trim(),
        type: String(get("type")?.value ?? "").trim(),
        brand: String(get("brand")?.value ?? "").trim(),
        seats: Number(get("seats")?.value ?? ""),
        pricePerDay: Number(get("pricePerDay")?.value ?? ""),
        accent: String(get("accent")?.value ?? "").trim(),
        imageUrl: String(get("imageUrl")?.value ?? "").trim(),
        isFeatured: !!get("isFeatured")?.checked,
        isAvailable: !!get("isAvailable")?.checked,
      };
      const ok = window.confirm(
        `Save changes to this car?\n\n${c.name || "Car"}`,
      );
      if (!ok) return;
      try {
        await updateCar(String(c.id), payload);
        await load();
      } catch (err) {
        showError(
          "error",
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "Update failed",
        );
      }
    });

  div
    .querySelector('[data-action="delete"]')
    ?.addEventListener("click", async () => {
      const ok = window.confirm(
        `Delete this car?\n\n${c.name || "Car"}\n\nThis cannot be undone.`,
      );
      if (!ok) return;
      try {
        await deleteCar(String(c.id));
        await load();
      } catch (err) {
        showError(
          "error",
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "Delete failed",
        );
      }
    });

  return div;
}

function ticketStatusPill(status) {
  const label = String(status || "").toUpperCase();
  const cls =
    status === "accepted" ? "good" : status === "open" ? "warn" : "bad";
  return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
}

let supportSelectedId = null;
let supportSelectedEmail = null;
let supportInterval = null;

function clearSupportInterval() {
  if (supportInterval) window.clearInterval(supportInterval);
  supportInterval = null;
}

function renderSupportThreadRow(t) {
  const a = document.createElement("a");
  a.className = "car";
  a.href = "#";
  a.style.cursor = "pointer";

  const email = t?.createdBy ? String(t.createdBy) : "Unknown";
  const when = t?.createdAt ? formatDateTime(t.createdAt) : "";
  const selected =
    supportSelectedId && String(t?.id) === String(supportSelectedId);
  if (selected) a.style.borderColor = "rgba(249, 115, 22, 0.8)";

  a.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
          <div style="min-width:0;">
            <p class="car-title">${escapeHtml(email)}</p>
            <p class="car-meta">${escapeHtml("Support chat")}</p>
          </div>
          <span class="pill">CHAT</span>
        </div>
        <div style="display:flex; justify-content: space-between; align-items:flex-end; gap: 10px;">
          <span class="pill">${escapeHtml(when)}</span>
          <span class="btn secondary">Open</span>
        </div>
      </div>
    </div>
  `;

  a.addEventListener("click", (e) => {
    e.preventDefault();
    supportSelectedId = t?.id ?? null;
    supportSelectedEmail = t?.createdBy ?? null;
    load();
  });

  return a;
}

async function loadSupportConversation(ticketId, elHeader, elMessages) {
  if (!ticketId) return;
  const t = await getTicketById(String(ticketId));
  const email = supportSelectedEmail || t?.createdBy || "Client";

  if (elHeader) {
    elHeader.textContent = `Chat with: ${email}`;
  }

  if (!elMessages) return;
  elMessages.innerHTML = "";

  const messages = Array.isArray(t?.messages) ? t.messages : [];
  if (messages.length === 0) {
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = "No messages yet.";
    elMessages.appendChild(n);
    return;
  }

  for (const m of messages) {
    const div = document.createElement("div");
    div.className = `message ${m.author === "client" ? "client" : "admin"}`;
    const authorLabel = m.author === "admin" ? "You" : email;
    div.innerHTML = `
      <div class="meta">${escapeHtml(authorLabel)} • ${escapeHtml(formatDateTime(m.createdAt))}</div>
      <div class="text">${escapeHtml(m.text)}</div>
    `;
    elMessages.appendChild(div);
  }
}

function renderBookingCard(b, view) {
  const div = document.createElement("div");
  div.className = "car";

  const carLabel = b.car
    ? `${b.car.name}${b.car.brand ? ` (${b.car.brand})` : ""}`
    : b.carName
      ? String(b.carName)
      : "No car linked";
  const driverName =
    `${b.driverGivenNames || ""} ${b.driverSurname || ""}`.trim();
  const userLabel = driverName
    ? `${driverName} · ${b.driverEmail || "No email"}`
    : b.driverEmail || "Unknown customer";

  const when = b.bookingTime ? new Date(b.bookingTime).toLocaleString() : "";
  const statusHtml = statusPill(b.status || "pending");
  const status = b.status || "pending";
  const trip =
    b?.pickupDate && b?.dropoffDate
      ? `Trip: ${b.pickupDate} → ${b.dropoffDate}`
      : b?.pickupDate
        ? `Pickup: ${b.pickupDate}`
        : "";
  const total =
    typeof b?.totalPrice === "number" && Number.isFinite(b.totalPrice)
      ? `Estimated total: ₱${Math.round(b.totalPrice).toLocaleString()}`
      : "";
  const cancelledAt =
    b?.cancelledAt && status === "cancelled"
      ? `Cancelled: ${new Date(String(b.cancelledAt)).toLocaleString()}`
      : "";
  const cancellationBill =
    status === "cancelled"
      ? `Cancellation bill: ₱${Math.round(Number(b?.cancellationFee || 0)).toLocaleString()}`
      : "";
  const endedAt =
    b?.endedAt && status === "completed"
      ? `Ended: ${new Date(String(b.endedAt)).toLocaleString()}`
      : "";
  const billedTotal =
    status === "completed" && typeof b?.billedTotal === "number"
      ? `Bill to date: ₱${Math.round(Number(b?.billedTotal || 0)).toLocaleString()}`
      : "";

  const canConfirm = view === "pending" && status === "pending";
  const canSetActive = status === "confirmed";
  const canSetCompleted = status === "active";
  const canCancel = status !== "cancelled" && status !== "completed";
  const canEndEarly = status === "active";
  const canDelete = (() => {
    if (status === "active" || status === "completed") return false;
    const pickup = b?.pickupDate ? String(b.pickupDate) : "";
    if (!pickup) return true;
    return pickup > todayIso();
  })();
  const activeLabel = "Set Active";

  div.innerHTML = `
    <div class="car-inner">
      <div class="car-body">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 10px;">
          <div style="min-width:0;">
            <p class="car-title">${escapeHtml(b.name || "Booking")}</p>
            <p class="car-meta">${escapeHtml(userLabel)}</p>
            <p class="car-meta">${escapeHtml(carLabel)}</p>
          </div>
          ${statusHtml}
        </div>
        <div style="margin-top: 8px; font-size: 13px; color: var(--muted);">
          ${escapeHtml(when)}
        </div>
        ${trip ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(trip)}</div>` : ""}
        ${total ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(total)}</div>` : ""}
        ${cancelledAt ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(cancelledAt)}</div>` : ""}
        ${cancellationBill ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(cancellationBill)}</div>` : ""}
        ${endedAt ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(endedAt)}</div>` : ""}
        ${billedTotal ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(billedTotal)}</div>` : ""}
        ${b.location ? `<div style="margin-top: 6px; font-size: 13px; color: var(--muted);">${escapeHtml(b.location)}</div>` : ""}

        <div style="margin-top: 12px; display:flex; gap: 10px; flex-wrap: wrap;">
          ${canConfirm ? `<button class="btn secondary" type="button" data-action="confirm">Mark Confirmed</button>` : ""}
          ${canSetActive ? `<button class="btn secondary" type="button" data-action="active">${escapeHtml(activeLabel)}</button>` : ""}
          ${canSetCompleted ? `<button class="btn secondary" type="button" data-action="completed">Mark Completed</button>` : ""}
          ${canEndEarly ? `<button class="btn secondary" type="button" data-action="end">End early (bill to date)</button>` : ""}
          ${canCancel ? `<button class="btn secondary" type="button" data-action="cancel">Cancel</button>` : ""}
          ${canDelete ? `<button class="btn secondary" type="button" data-action="delete">Delete</button>` : ""}
        </div>
      </div>
    </div>
  `;

  const btnConfirm = div.querySelector('[data-action="confirm"]');
  const btnActive = div.querySelector('[data-action="active"]');
  const btnCompleted = div.querySelector('[data-action="completed"]');
  const btnEnd = div.querySelector('[data-action="end"]');
  const btnCancel = div.querySelector('[data-action="cancel"]');
  const btnDelete = div.querySelector('[data-action="delete"]');

  btnConfirm?.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = window.confirm(
      `Mark this booking as CONFIRMED?\n\n${b.name || "Booking"}`,
    );
    if (!ok) return;
    try {
      await updateBooking(String(b.id), {
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
      });
      await load();
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Update failed",
      );
    }
  });

  btnActive?.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = window.confirm(
      `Set this booking to ACTIVE?\n\n${b.name || "Booking"}`,
    );
    if (!ok) return;
    try {
      await updateBooking(String(b.id), { status: "active" });
      await load();
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Update failed",
      );
    }
  });

  btnCompleted?.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = window.confirm(
      `Mark this booking as COMPLETED?\n\n${b.name || "Booking"}`,
    );
    if (!ok) return;
    try {
      await updateBooking(String(b.id), { status: "completed" });
      await load();
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Update failed",
      );
    }
  });

  btnEnd?.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = window.confirm(
      `End this ACTIVE booking early?\n\n${b.name || "Booking"}\n\nThis will calculate the bill based on days already used.`,
    );
    if (!ok) return;
    try {
      await endBookingEarly(String(b.id));
      await load();
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "End booking failed",
      );
    }
  });

  btnCancel?.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = window.confirm(`Cancel this booking?\n\n${b.name || "Booking"}`);
    if (!ok) return;
    try {
      await updateBooking(String(b.id), { status: "cancelled" });
      await load();
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Update failed",
      );
    }
  });

  btnDelete?.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = window.confirm(
      `Delete this booking?\n\n${b.name || "Booking"}\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    try {
      await deleteBooking(String(b.id));
      await load();
    } catch (err) {
      showError(
        "error",
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Delete failed",
      );
    }
  });

  return div;
}

let loading = false;

async function loadRows(view) {
  if (view === "cars") return await listCars();
  if (view === "support") return await listSupportTicketsForAdmin();
  if (view === "pending") return await listUnconfirmedBookings();
  if (view === "history") return await listBookingHistory();
  if (view === "cancelled") return await listCancelledBookings();
  return await listBookings();
}

async function load() {
  if (loading) return;
  loading = true;
  setDisabled("refresh", true);
  showError("error", "");
  clearSupportInterval();

  try {
    const view =
      elView && "value" in elView ? String(elView.value) : "confirmed";
    if (elViewTitle) elViewTitle.textContent = viewTitle(view);

    const rows = await loadRows(view);
    const rawList = Array.isArray(rows) ? rows : [];
    const q = elQ && "value" in elQ ? String(elQ.value) : "";
    const list = rawList.filter((b) => matchesQuery(b, q, view));

    if (elBookings) {
      elBookings.innerHTML = "";
      if (view === "cars") {
        elBookings.appendChild(renderCarCreateCard());
        if (list.length === 0) {
          const n = document.createElement("div");
          n.className = "notice";
          n.textContent = emptyMessage(view);
          elBookings.appendChild(n);
        } else {
          for (const c of list) elBookings.appendChild(renderCarCard(c));
        }
      } else if (view === "support") {
        const wrap = document.createElement("div");
        wrap.className = "layout";
        wrap.style.gridColumn = "span 12";

        const left = document.createElement("div");
        left.className = "car";
        left.innerHTML = `
          <div class="car-inner">
            <div class="car-body">
              <div class="row" style="align-items:flex-end;">
                <div>
                  <div class="kicker">Support</div>
                  <h2 class="section-title">Chats</h2>
                </div>
              </div>
              <div data-role="threads" style="display:grid; gap: 10px; margin-top: 10px;"></div>
            </div>
          </div>
        `;

        const right = document.createElement("div");
        right.className = "car";
        right.innerHTML = `
          <div class="car-inner">
            <div class="car-body">
              <div class="row">
                <div>
                  <div class="kicker">Messages</div>
                  <h2 class="section-title" data-role="chatHeader">Select a chat</h2>
                </div>
              </div>
              <div data-role="messages" style="margin-top: 10px; display:grid; gap: 10px;"></div>
              <div style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px;">
                <div class="controls" data-role="composer">
                  <div class="field" style="grid-column: span 12;">
                    <div class="label">Message</div>
                    <textarea class="input" data-role="text" rows="3" placeholder="Type a message" style="resize: vertical;"></textarea>
                  </div>
                  <div class="field" style="grid-column: span 12;">
                    <button class="btn" type="button" data-role="send">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

        wrap.appendChild(left);
        wrap.appendChild(right);
        elBookings.appendChild(wrap);

        const elThreads = left.querySelector('[data-role="threads"]');
        const elChatHeader = right.querySelector('[data-role="chatHeader"]');
        const elMessages = right.querySelector('[data-role="messages"]');
        const elComposer = right.querySelector('[data-role="composer"]');
        const elText = right.querySelector('[data-role="text"]');
        const elSend = right.querySelector('[data-role="send"]');

        const threads = Array.isArray(list) ? list : [];
        if (!elThreads) return;

        elThreads.innerHTML = "";
        if (threads.length === 0) {
          const n = document.createElement("div");
          n.className = "notice";
          n.textContent = emptyMessage(view);
          elThreads.appendChild(n);
          if (elComposer) elComposer.hidden = true;
        } else {
          const stillExists = threads.some(
            (t) =>
              supportSelectedId && String(t?.id) === String(supportSelectedId),
          );
          if (!stillExists) {
            supportSelectedId = threads[0]?.id ?? null;
            supportSelectedEmail = threads[0]?.createdBy ?? null;
          }

          for (const t of threads)
            elThreads.appendChild(renderSupportThreadRow(t));

          let sending = false;
          const setSending = (next) => {
            sending = next;
            if (elSend) elSend.disabled = sending;
          };

          const send = async () => {
            if (sending) return;
            if (!supportSelectedId) return;
            const text = String(elText?.value ?? "").trim();
            if (!text) return;
            setSending(true);
            try {
              await addTicketMessage(String(supportSelectedId), "admin", text);
              if (elText) elText.value = "";
              await loadSupportConversation(
                supportSelectedId,
                elChatHeader,
                elMessages,
              );
            } catch (err) {
              showError(
                "error",
                err && typeof err === "object" && "message" in err
                  ? String(err.message)
                  : "Send failed",
              );
            } finally {
              setSending(false);
            }
          };

          elSend?.addEventListener("click", send);

          await loadSupportConversation(
            supportSelectedId,
            elChatHeader,
            elMessages,
          );
          supportInterval = window.setInterval(() => {
            loadSupportConversation(
              supportSelectedId,
              elChatHeader,
              elMessages,
            ).catch(() => {});
          }, 3000);
        }
      } else if (list.length === 0) {
        const n = document.createElement("div");
        n.className = "notice";
        n.textContent = emptyMessage(view);
        elBookings.appendChild(n);
      } else {
        for (const b of list)
          elBookings.appendChild(renderBookingCard(b, view));
      }
    }

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
    loading = false;
    setDisabled("refresh", false);
  }
}

ensureAdmin();
initViewFromUrlOrStorage();
for (const btn of elNavViewButtons) {
  btn.addEventListener("click", () => {
    const v = btn.getAttribute("data-nav-view");
    setView(v);
    load();
  });
}
load();
elRefresh?.addEventListener("click", load);
elView?.addEventListener("change", () => {
  const v = elView && "value" in elView ? String(elView.value) : "confirmed";
  setView(v);
  load();
});
elQ?.addEventListener("input", load);
