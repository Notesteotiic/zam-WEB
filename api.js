const DEFAULT_API_BASE_URL = 'https://zam-app.vercel.app';

export function getApiBaseUrl() {
  const fromGlobal = typeof window !== 'undefined' ? window.API_BASE_URL : undefined;
  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('API_BASE_URL') : null;
  const base = (fromGlobal || fromStorage || DEFAULT_API_BASE_URL).trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

const REQUEST_TIMEOUT_MS = 20000;

async function request(path, init = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeout);
    const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
    if (name === 'AbortError') throw new Error(`Request timed out (${REQUEST_TIMEOUT_MS}ms). URL: ${url}`);
    throw new Error(`Network error. URL: ${url}`);
  }

  clearTimeout(timeout);

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? data.error : null;
    throw new Error(message || `Request failed (${res.status})`);
  }

  if (text && data === null) throw new Error('Unexpected server response');
  return data;
}

export async function apiGet(path) {
  return request(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path) {
  return request(path, { method: 'DELETE' });
}

export async function createClientBooking(body) {
  return apiPost('/bookings/client', body);
}

export async function listBookings() {
  return apiGet('/admin/bookings');
}

export async function updateBooking(id, body) {
  return apiPatch(`/admin/bookings/${encodeURIComponent(id)}`, body);
}

export async function listUnconfirmedBookings() {
  return apiGet('/admin/bookings/unconfirmed');
}

export async function listBookingHistory() {
  return apiGet('/admin/bookings/history');
}

export async function deleteBooking(id) {
  return apiDelete(`/admin/bookings/${encodeURIComponent(id)}`);
}

export async function confirmBookingVoucher(token) {
  return apiPost('/bookings/confirm', { token });
}

export async function apiPatch(path, body) {
  return request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function listCars() {
  return apiGet('/cars');
}

export async function listFeaturedCars() {
  return apiGet('/cars?featured=true');
}

export async function getCar(id) {
  return apiGet(`/cars/${encodeURIComponent(id)}`);
}

export async function listBrands() {
  return apiGet('/brands');
}

export async function signup(email, password, username) {
  return apiPost('/auth/signup', { email, password, username });
}

export async function login(email, password) {
  return apiPost('/auth/login', { email, password });
}

export async function createTicket(subject, description, createdBy, carId, licenseImageUrl) {
  return apiPost('/tickets', {
    subject,
    description,
    createdBy,
    carId: carId ?? null,
    licenseImageUrl: licenseImageUrl ?? null,
  });
}

export async function listTicketsForUser(email) {
  return apiGet(`/tickets?createdBy=${encodeURIComponent(email)}`);
}

export async function getTicketById(id) {
  return apiGet(`/tickets/${encodeURIComponent(id)}`);
}

export async function updateTicketStatus(id, status) {
  return apiPatch(`/tickets/${encodeURIComponent(id)}/status`, { status });
}

export async function addTicketMessage(id, author, text) {
  return apiPost(`/tickets/${encodeURIComponent(id)}/messages`, { author, text });
}
