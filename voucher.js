import { confirmBookingVoucher } from "./api.js";
import { installNav, parseQuery, showError } from "./app.js";

installNav();

const elStatus = document.getElementById("statusText");
const LAST_VOUCHER_TOKEN_KEY = "zam_last_voucher_token_v1";

function setStatus(message) {
  if (elStatus) elStatus.textContent = message;
}

function getTokenFromUrl() {
  const q = parseQuery();
  const candidates = [q.token, q.voucherToken, q.voucher, q.t]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  if (candidates.length > 0) return candidates[0];

  const hash =
    typeof window !== "undefined" ? String(window.location.hash || "") : "";
  if (hash.startsWith("#")) {
    const hashParams = new URLSearchParams(hash.slice(1));
    const hv =
      hashParams.get("token") ||
      hashParams.get("voucherToken") ||
      hashParams.get("voucher");
    if (hv) return String(hv).trim();
  }

  try {
    const path =
      typeof window !== "undefined" ? String(window.location.pathname || "") : "";
    const parts = path
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts.length > 0 ? parts[parts.length - 1] : "";
    if (last && last !== "voucher" && last !== "voucher.html") return last;
  } catch {}

  try {
    const raw = localStorage.getItem(LAST_VOUCHER_TOKEN_KEY);
    const v = raw ? String(raw).trim() : "";
    if (v) return v;
  } catch {}

  return "";
}

async function main() {
  const token = getTokenFromUrl();

  if (!token) {
    setStatus("This voucher link is invalid.");
    showError("error", "Missing voucher token in the URL.");
    return;
  }

  setStatus("Confirming your voucher, please wait...");
  showError("error", "");

  try {
    const result = await confirmBookingVoucher(token);
    if (result.alreadyConfirmed) {
      setStatus(
        "This voucher was already confirmed. Your booking is active with ZAM.",
      );
    } else {
      setStatus(
        "Voucher accepted. Your booking has been confirmed and sent to ZAM.",
      );
    }
    try {
      localStorage.removeItem(LAST_VOUCHER_TOKEN_KEY);
    } catch {}
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : "Unable to confirm voucher.";
    setStatus("There was a problem confirming this voucher.");
    showError("error", msg);
  }
}

main();
