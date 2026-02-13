const SUPABASE_URL_KEY = "SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "SUPABASE_ANON_KEY";

const DEFAULT_SUPABASE_URL = "https://htswomrthebukiimygir.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c3dvbXJ0aGVidWtpaW15Z2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1OTM5MzQsImV4cCI6MjA4MzE2OTkzNH0.aqRBv-qdHeeoEexXTprwHKdauYfyBQSuuWGMu-zmrWo";

function getSupabaseConfig() {
  const fromGlobalUrl =
    typeof window !== "undefined" ? window.SUPABASE_URL : undefined;
  const fromGlobalKey =
    typeof window !== "undefined" ? window.SUPABASE_ANON_KEY : undefined;
  const fromStorageUrl =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(SUPABASE_URL_KEY)
      : null;
  const fromStorageKey =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(SUPABASE_ANON_KEY_KEY)
      : null;

  const url = String(
    fromGlobalUrl || fromStorageUrl || DEFAULT_SUPABASE_URL || "",
  ).trim();
  const anonKey = String(
    fromGlobalKey || fromStorageKey || DEFAULT_SUPABASE_ANON_KEY || "",
  ).trim();

  return {
    url: url.endsWith("/") ? url.slice(0, -1) : url,
    anonKey,
  };
}

let supabasePromise = null;

async function getSupabase() {
  if (supabasePromise) return await supabasePromise;

  supabasePromise = (async () => {
    const cfg = getSupabaseConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error(
        "Supabase is not configured. Set localStorage SUPABASE_URL and SUPABASE_ANON_KEY (or window.SUPABASE_URL / window.SUPABASE_ANON_KEY).",
      );
    }

    const mod =
      await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
    if (!mod || typeof mod.createClient !== "function")
      throw new Error("Unable to load Supabase client");

    return mod.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  })();

  return await supabasePromise;
}

function toIsoDateOnly(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

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

function mapCar(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    brand: row.brand,
    seats: row.seats,
    pricePerDay: row.price_per_day,
    accent: row.accent,
    isFeatured: row.is_featured,
    isAvailable: row.is_available,
    imageUrl: row.image_url,
  };
}

function mapTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by_email,
    carId: row.car_id ?? null,
    licenseImageUrl: row.license_image_url ?? null,
    car: row.car ? mapCar(row.car) : null,
    messages: Array.isArray(row.messages)
      ? row.messages.map((m) => ({
          id: m.id,
          author: m.author,
          text: m.text,
          createdAt: m.created_at,
        }))
      : [],
  };
}

function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    kind: row.kind,
    location: row.location,
    createdAt: row.created_at || null,
    bookingTime: row.created_at || row.confirmed_at || null,
    confirmedAt: row.confirmed_at || null,
    cancelledAt: row.cancelled_at || null,
    cancellationFee: row.cancellation_fee ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    endedAt: row.ended_at || null,
    billedDays: row.billed_days ?? null,
    billedTotal: row.billed_total ?? null,
    endedReason: row.ended_reason ?? null,
    voucherToken: row.voucher_token || null,
    pickupDate: row.pickup_date || null,
    dropoffDate: row.dropoff_date || null,
    totalPrice: row.total_price ?? null,
    driverGivenNames: row.driver_given_names ?? null,
    driverSurname: row.driver_surname ?? null,
    driverAge: row.driver_age ?? null,
    driverEmail: row.driver_email ?? null,
    driverMobile: row.driver_mobile ?? null,
    driverLicenceCountryRegion: row.driver_licence_country_region ?? null,
    carId: row.car_id ?? null,
    carName: row.car_name ?? null,
    car: row.car ? mapCar(row.car) : null,
  };
}

function makeVoucherToken() {
  if (
    typeof crypto !== "undefined" &&
    crypto &&
    typeof crypto.randomUUID === "function"
  )
    return crypto.randomUUID();
  return `v_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function daysBetweenIsoDatesInclusive(startIso, endIso) {
  const s = toIsoDateOnly(startIso);
  const e = toIsoDateOnly(endIso);
  if (!s || !e) return null;
  const [sY, sM, sD] = s.split("-").map((x) => parseInt(x, 10));
  const [eY, eM, eD] = e.split("-").map((x) => parseInt(x, 10));
  const startMs = Date.UTC(sY, sM - 1, sD);
  const endMs = Date.UTC(eY, eM - 1, eD);
  const diffMs = endMs - startMs;
  if (!Number.isFinite(diffMs)) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? days : null;
}

export async function logout() {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return;
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

export async function signup(email, password, username) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, role: "client" } },
  });
  if (error) throw new Error(error.message || "Signup failed");
  return {
    email: data?.user?.email || email,
    username,
    role: "client",
  };
}

export async function login(email, password) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message || "Login failed");
  const u = data?.user || null;
  const meta =
    u && u.user_metadata && typeof u.user_metadata === "object"
      ? u.user_metadata
      : {};
  const roleFromMeta = typeof meta.role === "string" ? meta.role : null;
  const usernameFromMeta =
    typeof meta.username === "string" ? meta.username : null;
  const resolvedEmail = u?.email || email;
  const resolvedRole =
    resolvedEmail === "admin@gmail.com" ? "admin" : roleFromMeta;
  return {
    email: resolvedEmail,
    username: usernameFromMeta,
    role: resolvedRole,
  };
}

export async function listCars() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message || "Unable to load cars");
  return (Array.isArray(data) ? data : []).map(mapCar);
}

export async function listFeaturedCars() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("is_featured", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message || "Unable to load cars");
  return (Array.isArray(data) ? data : []).map(mapCar);
}

export async function getCar(id) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to load car");
  if (!data) throw new Error("Car not found");
  return mapCar(data);
}

export async function createCar(input) {
  const supabase = await getSupabase();
  const payload = {
    name: String(input?.name ?? "").trim(),
    type: String(input?.type ?? "").trim(),
    brand:
      input?.brand == null || String(input.brand).trim() === ""
        ? null
        : String(input.brand).trim(),
    seats: Number.isFinite(Number(input?.seats))
      ? Math.max(1, Math.round(Number(input.seats)))
      : 4,
    price_per_day: Number.isFinite(Number(input?.pricePerDay))
      ? Math.max(0, Math.round(Number(input.pricePerDay)))
      : 0,
    accent:
      input?.accent == null || String(input.accent).trim() === ""
        ? null
        : String(input.accent).trim(),
    is_featured: !!input?.isFeatured,
    is_available: input?.isAvailable == null ? true : !!input.isAvailable,
    image_url:
      input?.imageUrl == null || String(input.imageUrl).trim() === ""
        ? null
        : String(input.imageUrl).trim(),
  };

  if (!payload.name) throw new Error("Missing car name");
  if (!payload.type) throw new Error("Missing car type");
  if (!payload.price_per_day)
    throw new Error("Missing or invalid price per day");

  const { data, error } = await supabase
    .from("cars")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to create car");
  return mapCar(data);
}

export async function updateCar(id, input) {
  const supabase = await getSupabase();
  const carId = String(id ?? "").trim();
  if (!carId) throw new Error("Missing car id");

  const patch = {};
  if ("name" in (input ?? {})) patch.name = String(input?.name ?? "").trim();
  if ("type" in (input ?? {})) patch.type = String(input?.type ?? "").trim();
  if ("brand" in (input ?? {}))
    patch.brand =
      input?.brand == null || String(input.brand).trim() === ""
        ? null
        : String(input.brand).trim();
  if ("seats" in (input ?? {}))
    patch.seats = Number.isFinite(Number(input?.seats))
      ? Math.max(1, Math.round(Number(input.seats)))
      : 4;
  if ("pricePerDay" in (input ?? {}))
    patch.price_per_day = Number.isFinite(Number(input?.pricePerDay))
      ? Math.max(0, Math.round(Number(input.pricePerDay)))
      : 0;
  if ("accent" in (input ?? {}))
    patch.accent =
      input?.accent == null || String(input.accent).trim() === ""
        ? null
        : String(input.accent).trim();
  if ("isFeatured" in (input ?? {})) patch.is_featured = !!input?.isFeatured;
  if ("isAvailable" in (input ?? {})) patch.is_available = !!input?.isAvailable;
  if ("imageUrl" in (input ?? {}))
    patch.image_url =
      input?.imageUrl == null || String(input.imageUrl).trim() === ""
        ? null
        : String(input.imageUrl).trim();

  if ("name" in patch && !patch.name) throw new Error("Missing car name");
  if ("type" in patch && !patch.type) throw new Error("Missing car type");
  if ("price_per_day" in patch && !patch.price_per_day)
    throw new Error("Missing or invalid price per day");

  const { data, error } = await supabase
    .from("cars")
    .update(patch)
    .eq("id", carId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to update car");
  return mapCar(data);
}

export async function deleteCar(id) {
  const supabase = await getSupabase();
  const carId = String(id ?? "").trim();
  if (!carId) throw new Error("Missing car id");
  const { error } = await supabase.from("cars").delete().eq("id", carId);
  if (error) throw new Error(error.message || "Unable to delete car");
  return { ok: true };
}

export async function listBrands() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("brands")
    .select("name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message || "Unable to load brands");
  return Array.isArray(data) ? data.map((r) => r.name) : [];
}

export async function createClientBooking(body) {
  const supabase = await getSupabase();

  const { data: carRow, error: carErr } = await supabase
    .from("cars")
    .select("id,is_available")
    .eq("id", body.carId)
    .maybeSingle();
  if (carErr) throw new Error(carErr.message || "Unable to validate car");
  if (!carRow) throw new Error("Car not found");
  if (carRow.is_available === false) throw new Error("This car is unavailable");

  const voucherToken = makeVoucherToken();
  const pickupDate = toIsoDateOnly(body.pickupDate);
  const dropoffDate = toIsoDateOnly(body.dropoffDate);
  if (!pickupDate || !dropoffDate)
    throw new Error("Please choose valid pickup and drop-off dates.");

  const todayStr = manilaTodayIso();
  if (pickupDate < todayStr)
    throw new Error("Pickup date cannot be in the past.");
  if (dropoffDate <= pickupDate)
    throw new Error("Drop-off date must be after pickup date.");

  const { data: conflicts, error: conflictsErr } = await supabase
    .from("bookings")
    .select("id,pickup_date,dropoff_date,status")
    .eq("car_id", body.carId)
    .in("status", ["confirmed", "active"])
    .lt("pickup_date", dropoffDate)
    .gt("dropoff_date", pickupDate);
  if (conflictsErr)
    throw new Error(conflictsErr.message || "Unable to validate booking dates");
  if (Array.isArray(conflicts) && conflicts.length > 0)
    throw new Error(
      "This car is already booked for those dates. Please choose different dates.",
    );

  const driverName =
    `${body.driverGivenNames || ""} ${body.driverSurname || ""}`
      .trim()
      .replace(/\s+/g, " ");
  const name = driverName
    ? `Booking for ${driverName}`
    : body.driverEmail
      ? `Booking for ${String(body.driverEmail)}`
      : "Booking request";

  const driverEmail =
    typeof body.driverEmail === "string" && body.driverEmail.trim()
      ? body.driverEmail.trim().toLowerCase()
      : null;
  const createdByEmail =
    typeof body.createdByEmail === "string" && body.createdByEmail.trim()
      ? body.createdByEmail.trim().toLowerCase()
      : driverEmail;

  const row = {
    name,
    car_id: body.carId,
    pickup_date: pickupDate,
    dropoff_date: dropoffDate,
    total_price: Number.isFinite(Number(body.totalPrice))
      ? Math.round(Number(body.totalPrice))
      : 0,
    driver_given_names: body.driverGivenNames ?? null,
    driver_surname: body.driverSurname ?? null,
    driver_age: Number.isFinite(Number(body.driverAge))
      ? Number(body.driverAge)
      : null,
    driver_email: driverEmail,
    driver_mobile: body.driverMobile ?? null,
    driver_licence_country_region: body.driverLicenceCountryRegion ?? null,
    created_by_email: createdByEmail,
    location: body.location ?? null,
    kind: body.kind ?? "pickup",
    status: "pending",
    voucher_token: voucherToken,
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert(row)
    .select("id,voucher_token")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to create booking");
  return {
    id: data?.id ?? null,
    voucherToken: data?.voucher_token ?? voucherToken,
  };
}

export async function confirmBookingVoucher(token) {
  const supabase = await getSupabase();

  const { data: existing, error: findErr } = await supabase
    .from("bookings")
    .select("id,confirmed_at,status,car_id,pickup_date,dropoff_date")
    .eq("voucher_token", token)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message || "Unable to confirm voucher");
  if (!existing) throw new Error("Voucher token not found");
  if (existing.confirmed_at) return { alreadyConfirmed: true };
  if (existing.status === "cancelled")
    throw new Error("This booking was cancelled and cannot be confirmed.");

  const carId = existing.car_id ? String(existing.car_id) : "";
  const pickupDate = existing.pickup_date ? String(existing.pickup_date) : "";
  const dropoffDate = existing.dropoff_date
    ? String(existing.dropoff_date)
    : "";
  if (carId && pickupDate && dropoffDate) {
    const { data: conflicts, error: conflictsErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("car_id", carId)
      .in("status", ["confirmed", "active"])
      .neq("id", existing.id)
      .lt("pickup_date", dropoffDate)
      .gt("dropoff_date", pickupDate);
    if (conflictsErr)
      throw new Error(conflictsErr.message || "Unable to confirm voucher");
    if (Array.isArray(conflicts) && conflicts.length > 0)
      throw new Error(
        "This car was already confirmed for those dates. Please create a new booking.",
      );
  }

  const nextStatus =
    existing.status === "pending" ? "confirmed" : existing.status;
  const { error: updErr } = await supabase
    .from("bookings")
    .update({ confirmed_at: new Date().toISOString(), status: nextStatus })
    .eq("id", existing.id);

  if (updErr) throw new Error(updErr.message || "Unable to confirm voucher");
  return { alreadyConfirmed: false };
}

export async function listMyBookings(email) {
  const supabase = await getSupabase();
  const v = String(email || "")
    .trim()
    .toLowerCase();
  if (!v) throw new Error("Missing email");

  const escaped = v.replaceAll('"', '""');
  const orFilter = `driver_email.ilike."${escaped}",created_by_email.ilike."${escaped}"`;

  let res = await supabase
    .from("bookings")
    .select("*, car:cars(*)")
    .or(orFilter)
    .order("created_at", { ascending: false });

  if (
    res.error &&
    String(res.error.message || "")
      .toLowerCase()
      .includes("created_by_email")
  ) {
    res = await supabase
      .from("bookings")
      .select("*, car:cars(*)")
      .or(`driver_email.ilike."${escaped}"`)
      .order("created_at", { ascending: false });
  }

  if (res.error)
    throw new Error(res.error.message || "Unable to load bookings");

  return (Array.isArray(res.data) ? res.data : []).map(mapBooking);
}

export async function cancelMyBooking(id, email) {
  const supabase = await getSupabase();
  const bookingId = String(id || "").trim();
  const v = String(email || "")
    .trim()
    .toLowerCase();
  if (!bookingId) throw new Error("Missing booking id");
  if (!v) throw new Error("Missing email");

  const escaped = v.replaceAll('"', '""');
  const orOwner = `driver_email.ilike."${escaped}",created_by_email.ilike."${escaped}"`;

  const { data: existing, error: findErr } = await supabase
    .from("bookings")
    .select(
      "id,status,pickup_date,driver_email,created_by_email,car_id,total_price,car:cars(price_per_day)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message || "Unable to cancel booking");
  if (!existing) throw new Error("Booking not found");
  const driverEmailNorm = String(existing.driver_email || "")
    .trim()
    .toLowerCase();
  const createdByNorm = String(existing.created_by_email || "")
    .trim()
    .toLowerCase();
  if (driverEmailNorm !== v && createdByNorm !== v)
    throw new Error("Not allowed");
  if (existing.status === "completed")
    throw new Error("Completed bookings cannot be cancelled");
  if (existing.status === "cancelled") return { alreadyCancelled: true };

  const pickupDate = existing.pickup_date ? String(existing.pickup_date) : "";
  const todayStr = manilaTodayIso();

  const shouldProrate =
    existing.status === "active" || (pickupDate && pickupDate <= todayStr);
  if (shouldProrate) {
    const usedDays = daysBetweenIsoDatesInclusive(pickupDate, todayStr);
    if (!usedDays)
      throw new Error("Unable to calculate bill. Missing pickup date.");

    const pricePerDay = Number(existing?.car?.price_per_day || 0);
    const billedTotal =
      Number.isFinite(pricePerDay) && pricePerDay > 0
        ? Math.round(usedDays * pricePerDay)
        : 0;

    const patch = {
      status: "completed",
      ended_at: new Date().toISOString(),
      billed_days: usedDays,
      billed_total: billedTotal,
      ended_reason: "client_revoked_after_start",
    };

    const { error: updErr } = await supabase
      .from("bookings")
      .update(patch)
      .eq("id", bookingId)
      .or(orOwner)
      .in("status", ["active", "confirmed", "pending"]);

    if (updErr) throw new Error(updErr.message || "Unable to revoke booking");

    if (existing.car_id) {
      const { error: carUpdErr } = await supabase
        .from("cars")
        .update({ is_available: true })
        .eq("id", existing.car_id);
      if (carUpdErr)
        throw new Error(
          carUpdErr.message || "Unable to update car availability",
        );
    }

    return { ok: true, billedDays: usedDays, billedTotal };
  }

  let cancellationFee = 0;
  if (pickupDate && pickupDate >= todayStr) cancellationFee = 0;

  const { error: updErr } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_fee: cancellationFee,
      cancellation_reason: "client_revoked",
    })
    .eq("id", bookingId)
    .or(orOwner)
    .in("status", ["pending", "confirmed", "active"]);

  if (updErr) throw new Error(updErr.message || "Unable to cancel booking");

  if (existing.car_id) {
    const { error: carUpdErr } = await supabase
      .from("cars")
      .update({ is_available: true })
      .eq("id", existing.car_id);
    if (carUpdErr)
      throw new Error(carUpdErr.message || "Unable to update car availability");
  }

  return { ok: true, cancellationFee };
}

export async function rescheduleMyBooking(id, email, body) {
  const supabase = await getSupabase();
  const bookingId = String(id || "").trim();
  const v = String(email || "")
    .trim()
    .toLowerCase();
  if (!bookingId) throw new Error("Missing booking id");
  if (!v) throw new Error("Missing email");

  const pickupDate = toIsoDateOnly(body?.pickupDate);
  const dropoffDate = toIsoDateOnly(body?.dropoffDate);
  if (!pickupDate || !dropoffDate)
    throw new Error("Please choose valid pickup and drop-off dates.");

  const todayStr = manilaTodayIso();
  if (pickupDate < todayStr)
    throw new Error("Pickup date cannot be in the past.");
  if (dropoffDate <= pickupDate)
    throw new Error("Drop-off date must be after pickup date.");

  const { data: existing, error: findErr } = await supabase
    .from("bookings")
    .select("id,status,car_id,driver_email,car:cars(price_per_day)")
    .eq("id", bookingId)
    .maybeSingle();

  if (findErr)
    throw new Error(findErr.message || "Unable to reschedule booking");
  if (!existing) throw new Error("Booking not found");
  if (
    String(existing.driver_email || "")
      .trim()
      .toLowerCase() !== v
  )
    throw new Error("Not allowed");
  if (!["pending", "confirmed"].includes(existing.status))
    throw new Error("Only pending or confirmed bookings can be rescheduled");

  const { data: conflicts, error: conflictsErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("car_id", existing.car_id)
    .in("status", ["confirmed", "active"])
    .neq("id", bookingId)
    .lt("pickup_date", dropoffDate)
    .gt("dropoff_date", pickupDate);

  if (conflictsErr)
    throw new Error(conflictsErr.message || "Unable to validate booking dates");
  if (Array.isArray(conflicts) && conflicts.length > 0)
    throw new Error(
      "This car is already booked for those dates. Please choose different dates.",
    );

  const pricePerDay = Number(existing?.car?.price_per_day || 0);
  const [pY, pM, pD] = pickupDate.split("-").map((x) => parseInt(x, 10));
  const [dY, dM, dD] = dropoffDate.split("-").map((x) => parseInt(x, 10));
  const startMs = Date.UTC(pY, pM - 1, pD);
  const endMs = Date.UTC(dY, dM - 1, dD);
  const diffMs = endMs - startMs;
  const days =
    Number.isFinite(diffMs) && diffMs > 0
      ? Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      : 0;
  const totalPrice =
    days > 0 && Number.isFinite(pricePerDay) && pricePerDay > 0
      ? Math.round(days * pricePerDay)
      : null;

  const patch = {
    pickup_date: pickupDate,
    dropoff_date: dropoffDate,
    kind: typeof body?.kind === "string" ? body.kind : undefined,
    location: typeof body?.location === "string" ? body.location : undefined,
    total_price: totalPrice ?? undefined,
  };

  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .ilike("driver_email", v)
    .select("*, car:cars(*)")
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to reschedule booking");
  return mapBooking(data);
}

export async function listBookings() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, car:cars(*)")
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load bookings");
  return (Array.isArray(data) ? data : []).map(mapBooking);
}

export async function listUnconfirmedBookings() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, car:cars(*)")
    .is("confirmed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load bookings");
  return (Array.isArray(data) ? data : []).map(mapBooking);
}

export async function listBookingHistory() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, car:cars(*)")
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load bookings");
  return (Array.isArray(data) ? data : []).map(mapBooking);
}

export async function listCancelledBookings() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, car:cars(*)")
    .eq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load bookings");
  return (Array.isArray(data) ? data : []).map(mapBooking);
}

export async function updateBooking(id, body) {
  const supabase = await getSupabase();
  const patch = {};
  if (body && typeof body === "object" && "status" in body)
    patch.status = body.status;
  if (body && typeof body === "object" && "confirmedAt" in body)
    patch.confirmed_at = body.confirmedAt;
  if (patch.status === "cancelled") {
    patch.cancelled_at = new Date().toISOString();
    patch.cancellation_fee = 0;
    patch.cancellation_reason = "admin_cancelled";
  }
  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id)
    .select("*, car:cars(*)")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to update booking");

  const nextStatus = patch.status;
  const carId = data?.car_id ?? null;
  if (nextStatus && carId) {
    const availability =
      nextStatus === "active"
        ? false
        : nextStatus === "completed" || nextStatus === "cancelled"
          ? true
          : null;

    if (typeof availability === "boolean") {
      const { error: carErr } = await supabase
        .from("cars")
        .update({ is_available: availability })
        .eq("id", carId);
      if (carErr)
        throw new Error(carErr.message || "Unable to update car availability");
    }
  }

  return mapBooking(data);
}

export async function deleteBooking(id) {
  const supabase = await getSupabase();
  const { data: existing, error: findErr } = await supabase
    .from("bookings")
    .select("id,car_id,status,pickup_date")
    .eq("id", id)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message || "Unable to delete booking");

  const pickupDate = existing?.pickup_date ? String(existing.pickup_date) : "";
  const todayStr = manilaTodayIso();
  if (pickupDate && pickupDate <= todayStr)
    throw new Error("Bookings can only be deleted before the pickup date.");
  if (existing?.status === "active")
    throw new Error("Active bookings must be ended early, not deleted.");

  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error(error.message || "Unable to delete booking");

  if (
    existing?.car_id &&
    (existing.status === "active" || existing.status === "confirmed")
  ) {
    const { error: carErr } = await supabase
      .from("cars")
      .update({ is_available: true })
      .eq("id", existing.car_id);
    if (carErr)
      throw new Error(carErr.message || "Unable to update car availability");
  }

  return { ok: true };
}

export async function deleteMyBooking(id, email) {
  void id;
  void email;
  throw new Error("Clients cannot delete bookings. Please revoke instead.");
}

export async function endMyActiveBooking(id, email) {
  const supabase = await getSupabase();
  const bookingId = String(id || "").trim();
  const v = String(email || "")
    .trim()
    .toLowerCase();
  if (!bookingId) throw new Error("Missing booking id");
  if (!v) throw new Error("Missing email");

  const escaped = v.replaceAll('"', '""');
  const orOwner = `driver_email.ilike."${escaped}",created_by_email.ilike."${escaped}"`;

  const { data: existing, error: findErr } = await supabase
    .from("bookings")
    .select(
      "id,status,pickup_date,driver_email,created_by_email,car_id,car:cars(price_per_day)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message || "Unable to end booking");
  if (!existing) throw new Error("Booking not found");
  const driverEmailNorm = String(existing.driver_email || "")
    .trim()
    .toLowerCase();
  const createdByNorm = String(existing.created_by_email || "")
    .trim()
    .toLowerCase();
  if (driverEmailNorm !== v && createdByNorm !== v)
    throw new Error("Not allowed");
  if (existing.status !== "active")
    throw new Error("Only active bookings can be ended early");

  const pickupDate = existing.pickup_date ? String(existing.pickup_date) : "";
  const todayStr = manilaTodayIso();
  const usedDays = daysBetweenIsoDatesInclusive(pickupDate, todayStr);
  if (!usedDays) throw new Error("Unable to calculate bill");

  const pricePerDay = Number(existing?.car?.price_per_day || 0);
  const billedTotal =
    Number.isFinite(pricePerDay) && pricePerDay > 0
      ? Math.round(usedDays * pricePerDay)
      : 0;

  const patch = {
    status: "completed",
    ended_at: new Date().toISOString(),
    billed_days: usedDays,
    billed_total: billedTotal,
    ended_reason: "client_end_early",
  };

  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .or(orOwner)
    .select("*, car:cars(*)")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to end booking");

  if (existing.car_id) {
    const { error: carErr } = await supabase
      .from("cars")
      .update({ is_available: true })
      .eq("id", existing.car_id);
    if (carErr)
      throw new Error(carErr.message || "Unable to update car availability");
  }

  return mapBooking(data);
}

export async function endBookingEarly(id) {
  const supabase = await getSupabase();
  const bookingId = String(id || "").trim();
  if (!bookingId) throw new Error("Missing booking id");

  const { data: existing, error: findErr } = await supabase
    .from("bookings")
    .select("id,status,pickup_date,car_id,car:cars(price_per_day)")
    .eq("id", bookingId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message || "Unable to end booking");
  if (!existing) throw new Error("Booking not found");
  if (existing.status !== "active")
    throw new Error("Only active bookings can be ended early");

  const pickupDate = existing.pickup_date ? String(existing.pickup_date) : "";
  const todayStr = manilaTodayIso();
  const usedDays = daysBetweenIsoDatesInclusive(pickupDate, todayStr);
  if (!usedDays) throw new Error("Unable to calculate bill");

  const pricePerDay = Number(existing?.car?.price_per_day || 0);
  const billedTotal =
    Number.isFinite(pricePerDay) && pricePerDay > 0
      ? Math.round(usedDays * pricePerDay)
      : 0;

  const patch = {
    status: "completed",
    ended_at: new Date().toISOString(),
    billed_days: usedDays,
    billed_total: billedTotal,
    ended_reason: "admin_end_early",
  };

  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .select("*, car:cars(*)")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to end booking");

  if (existing.car_id) {
    const { error: carErr } = await supabase
      .from("cars")
      .update({ is_available: true })
      .eq("id", existing.car_id);
    if (carErr)
      throw new Error(carErr.message || "Unable to update car availability");
  }

  return mapBooking(data);
}

export async function createTicket(
  subject,
  description,
  createdBy,
  carId,
  licenseImageUrl,
) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      subject,
      description,
      status: "accepted",
      created_by_email: createdBy,
      car_id: carId ?? null,
      license_image_url: licenseImageUrl ?? null,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to create ticket");
  return mapTicket(data);
}

export async function getOrCreateSupportTicket(email) {
  const supabase = await getSupabase();
  const createdBy = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!createdBy) throw new Error("Missing email");

  const { data: existing, error: existingErr } = await supabase
    .from("tickets")
    .select("*")
    .eq("created_by_email", createdBy)
    .eq("subject", "Support")
    .is("car_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingErr)
    throw new Error(existingErr.message || "Unable to load support chat");
  if (existing) return mapTicket(existing);

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      subject: "Support",
      description: "Support chat",
      status: "accepted",
      created_by_email: createdBy,
      car_id: null,
      license_image_url: null,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to create support chat");
  return mapTicket(data);
}

export async function listTicketsForUser(email) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("created_by_email", email)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load tickets");
  return (Array.isArray(data) ? data : []).map(mapTicket);
}

export async function listAllTickets() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load tickets");
  return (Array.isArray(data) ? data : []).map(mapTicket);
}

export async function listSupportTicketsForAdmin() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("subject", "Support")
    .is("car_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load support chats");
  return (Array.isArray(data) ? data : []).map(mapTicket);
}

export async function getTicketById(id) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("*, car:cars(*), messages:ticket_messages(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to load ticket");
  if (!data) throw new Error("Ticket not found");
  return mapTicket(data);
}

export async function updateTicketStatus(id, status) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to update ticket");
  return mapTicket(data);
}

export async function addTicketMessage(id, author, text) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: id, author, text })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to send message");
  return {
    id: data?.id ?? null,
    author: data?.author ?? author,
    text: data?.text ?? text,
    createdAt: data?.created_at ?? new Date().toISOString(),
  };
}
