import { addTicketMessage, getOrCreateSupportTicket, getTicketById } from "./api.js";
import {
  formatDateTime,
  getSession,
  getUsernameOrFallback,
  installNav,
  setDisabled,
  setHidden,
  setText,
  showError,
} from "./app.js";

installNav();

const elMessages = document.getElementById("messages");
const elText = document.getElementById("text");
const elSend = document.getElementById("sendBtn");

let busy = false;
let ticketId = null;
let interval = null;

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setBusy(next) {
  busy = next;
  setDisabled("sendBtn", busy);
}

function render(ticket) {
  if (!ticketId || !elMessages) return;
  elMessages.innerHTML = "";

  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const session = getSession();
  const isAdmin = !!session && session.role === "admin";
  const myName = getUsernameOrFallback();

  if (messages.length === 0) {
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = "No messages yet. Say hi to start the chat.";
    elMessages.appendChild(n);
    return;
  }

  for (const m of messages) {
    const div = document.createElement("div");
    div.className = `message ${m.author === "client" ? "client" : "admin"}`;
    const authorLabel = isAdmin
      ? m.author === "admin"
        ? "You"
        : ticket.createdBy || "Client"
      : m.author === "client"
        ? myName || "You"
        : "Admin";
    div.innerHTML = `
      <div class="meta">${escapeHtml(authorLabel)} • ${escapeHtml(formatDateTime(m.createdAt))}</div>
      <div class="text">${escapeHtml(m.text)}</div>
    `;
    elMessages.appendChild(div);
  }
}

async function load() {
  const session = getSession();
  if (!session?.email) {
    setHidden("composer", true);
    setHidden("loginNote", false);
    showError("error", "");
    return;
  }

  try {
    setHidden("loginNote", true);
    const t = await getOrCreateSupportTicket(session.email);
    ticketId = t?.id ?? null;
    if (!ticketId) throw new Error("Unable to start support chat");
    const full = await getTicketById(ticketId);
    render(full);
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to load support chat",
    );
  }
}

async function handleSend() {
  if (busy) return;
  if (!ticketId) return;

  const text = (elText?.value ?? "").trim();
  if (!text) return;

  const session = getSession();
  const author = !!session && session.role === "admin" ? "admin" : "client";

  setBusy(true);
  showError("error", "");

  try {
    await addTicketMessage(ticketId, author, text);
    if (elText) elText.value = "";
    await load();
  } catch (e) {
    showError(
      "error",
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Send failed",
    );
  } finally {
    setBusy(false);
  }
}

elSend?.addEventListener("click", handleSend);

load();
interval = window.setInterval(load, 3000);
window.addEventListener("beforeunload", () => {
  if (interval) window.clearInterval(interval);
});
