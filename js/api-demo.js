// Demo data layer: runs entirely in the browser with example data.
// Used when config.js has no Supabase details yet. Nothing is saved.
import { istDate, addDays, dayStart } from './util.js';

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));
let seq = 1000;
const uuid = () => 'demo-' + (seq++);
function fail(message, hint) { const e = new Error(message); e.hint = hint; throw e; }

export function createDemoApi() {
  const today = istDate();
  const at = (day, hhmm) => new Date(day + 'T' + hhmm + ':00+05:30').toISOString();

  const P = (id, kind, name, description, rides, validity_days, price_inr, sort) => ({ id, kind, name, description, rides, validity_days, price_inr, active: true, sort });
  const db = {
    settings: {
      id: 1, club_name: 'The Billionaire Polo Club', tagline: 'Equestrian Academy',
      phone: '8096080961', phone2: '6301975499', whatsapp: '8096080961', email: 'billionairepoloclub@gmail.com',
      address: 'Shamshabad, near Bangalore ECIL, Hyderabad',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=Shamshabad%2C%20Hyderabad', upi_id: 'yourclub@upi', upi_payee: 'The Billionaire Polo Club',
      cancel_hours: 12, gst_percent: 18, notice: '',
      extras: 'Stable boarding (per month): Thoroughbred ₹50,000 · Warmblood ₹80,000. 24×7 hay for the horses.\nProfessional tournaments in polo and jumping, with prize money from the organisers.',
    },
    profiles: [
      { id: 'u-owner', full_name: 'Club Owner', phone: '8096080961', email: 'owner@example.com', role: 'admin' },
      { id: 'u-arjun', full_name: 'Arjun Rao', phone: '9000000001', email: 'arjun@example.com', role: 'member' },
      { id: 'u-priya', full_name: 'Priya Shah', phone: '9000000002', email: 'priya@example.com', role: 'member' },
      { id: 'u-karan', full_name: 'Karan Mehta', phone: '9000000003', email: 'karan@example.com', role: 'member' },
    ],
    riders: [
      { id: 'r-arjun', account_id: 'u-arjun', name: 'Arjun', level: 'Intermediate', discipline: 'Polo', weight_kg: 72, active: true },
      { id: 'r-meera', account_id: 'u-arjun', name: 'Meera', level: 'Beginner', discipline: 'Riding', weight_kg: 34, active: true },
      { id: 'r-priya', account_id: 'u-priya', name: 'Priya', level: 'Intermediate', discipline: 'Jumping', weight_kg: 58, active: true },
      { id: 'r-karan', account_id: 'u-karan', name: 'Karan', level: 'Beginner', discipline: 'Polo', weight_kg: 80, active: true },
    ],
    packages: [
      P('p-pl12', 'polo', '1 Year Polo Lease', 'Horse lease · 270 rides', 270, 365, 750000, 1),
      P('p-pl6', 'polo', '6 Months Polo Lease', 'Horse lease · 126 rides', 126, 180, 350000, 2),
      P('p-pl3', 'polo', '3 Months Polo Lease', 'Horse lease · 63 rides', 63, 90, 190000, 3),
      P('p-pl1', 'polo', '1 Month Polo Lease', 'Horse lease · 22 rides', 22, 30, 60000, 4),
      P('p-ps', 'polo', 'Polo Per Session', 'One polo session', 1, 30, 5500, 5),
      P('p-r1', 'riding', 'Riding 1 Month', '22 rides', 22, 30, 30000, 11),
      P('p-r3', 'riding', 'Riding 3 Months', '62 rides', 62, 90, 60000, 12),
      P('p-r6', 'riding', 'Riding 6 Months', '124 rides', 124, 180, 150000, 13),
      P('p-rs', 'riding', 'Per Session Training', '30 minutes', 1, 30, 3000, 14),
      P('p-ra', 'riding', 'Advance Session Training', '40 minutes', 1, 30, 4000, 15),
      P('p-jl12', 'jumping', '1 Year Jumping Lease', 'Horse lease · 270 rides', 270, 365, 650000, 21),
      P('p-jl6', 'jumping', '6 Months Jumping Lease', 'Horse lease · 126 rides', 126, 180, 320000, 22),
      P('p-jl3', 'jumping', '3 Months Jumping Lease', 'Horse lease · 63 rides', 63, 90, 150000, 23),
      P('p-jl1', 'jumping', '1 Month Jumping Lease', 'Horse lease · 22 rides', 22, 30, 60000, 24),
    ],
    memberships: [],
    horses: ['Sultan', 'Rani', 'Badal', 'Toofan', 'Moti', 'Heera', 'Chetak', 'Bijli'].map((n, i) => ({ id: 'h-' + i, name: n, daily_limit: 3, active: n !== 'Heera', notes: n === 'Heera' ? 'Vet check' : '' })),
    sessions: [],
    closures: [],
    bookings: [],
    waitlist: [],
  };

  const pkgOf = (id) => db.packages.find((p) => p.id === id);
  const mem = (id, account_id, pid, status, starts_on, extra = {}) => {
    const p = pkgOf(pid);
    return { id, account_id, package_id: p.id, package_name: p.name, kind: p.kind, rides_total: p.rides, validity_days: p.validity_days, price_inr: p.price_inr,
      status, starts_on, expires_on: starts_on ? addDays(starts_on, p.validity_days - 1) : null, payment_method: 'upi', payment_ref: '',
      requested_at: starts_on ? dayStart(starts_on).toISOString() : new Date(Date.now() - 3600e3).toISOString(), ...extra };
  };
  db.memberships.push(
    mem('m-arjun', 'u-arjun', 'p-pl1', 'active', addDays(today, -10), { payment_ref: 'UTR 4021' }),
    mem('m-meera', 'u-arjun', 'p-r1', 'active', addDays(today, -12)),
    mem('m-priya', 'u-priya', 'p-jl1', 'active', addDays(today, -26), { payment_method: 'cash' }),
    mem('m-karan', 'u-karan', 'p-pl1', 'pending', null, { payment_ref: 'UTR 88213' }),
  );

  // Club hours: mornings 6–9 am, evenings 4–6 pm. One session per discipline per hour.
  const SLOTS = ['06:00', '07:00', '08:00', '16:00', '17:00'];
  for (let i = -7; i <= 14; i++) {
    const d = addDays(today, i);
    for (const t of SLOTS) {
      for (const kind of ['polo', 'riding', 'jumping']) {
        db.sessions.push({ id: uuid(), starts_at: at(d, t), duration_min: kind === 'riding' ? 30 : 60, kind, level: 'All levels', coach: '', capacity: 6, cancelled: false, note: '' });
      }
    }
  }
  // Fill seats with example riders so seat counts look real
  const guest = { id: 'u-guests', full_name: 'Other members', phone: '', email: '', role: 'member' };
  db.profiles.push(guest);
  const guestRiders = ['Rohan', 'Aisha', 'Vikram', 'Tara', 'Dev', 'Nisha'].map((name, k) => {
    const r = { id: 'r-g' + k, account_id: 'u-guests', name, level: 'Beginner', discipline: 'Polo', weight_kg: null, active: true };
    db.riders.push(r); return r;
  });
  for (const kind of ['polo', 'riding', 'jumping']) {
    db.memberships.push({ id: 'm-guests-' + kind, account_id: 'u-guests', package_id: null, package_name: 'Example members', kind, rides_total: 99999, validity_days: 365, price_inr: 0, status: 'active', starts_on: addDays(today, -60), expires_on: addDays(today, 300), payment_method: 'cash', payment_ref: '', requested_at: new Date().toISOString() });
  }
  const past = (s) => new Date(s.starts_at) < new Date();
  db.sessions.forEach((s, i) => {
    const n = [3, 1, 5, 0, 2, 6, 4, 1, 2, 6, 0, 3][i % 12];
    for (let k = 0; k < Math.min(n, s.capacity); k++) {
      db.bookings.push({ id: uuid(), session_id: s.id, rider_id: guestRiders[k].id, account_id: 'u-guests', membership_id: 'm-guests-' + s.kind, status: past(s) ? 'attended' : 'booked', horse_id: s.kind === 'riding' ? null : db.horses[(k + i) % 8 === 5 ? 6 : (k + i) % 8].id, coach_note: '', created_at: new Date().toISOString() });
    }
  });

  // Arjun's family: history and next rides
  const mine = (dayOffset, hhmm, kind, rider, membership, status, note, horse) => {
    const s = db.sessions.find((x) => x.starts_at === at(addDays(today, dayOffset), hhmm) && x.kind === kind);
    if (!s) return;
    const g = db.bookings.find((b) => b.session_id === s.id && b.account_id === 'u-guests');
    if (g) db.bookings = db.bookings.filter((b) => b !== g);
    db.bookings.push({ id: uuid(), session_id: s.id, rider_id: rider, account_id: 'u-arjun', membership_id: membership, status, horse_id: horse, coach_note: note || '', created_at: new Date().toISOString() });
  };
  mine(-6, '07:00', 'polo', 'r-arjun', 'm-arjun', 'attended', 'Stick work on the wooden horse before the next ride.', 'h-1');
  mine(-4, '07:00', 'polo', 'r-arjun', 'm-arjun', 'attended', 'Good line to the ball. Ride off earlier.', 'h-2');
  mine(-2, '06:00', 'polo', 'r-arjun', 'm-arjun', 'attended', 'Much steadier seat at the canter. Next: near-side forehand swing.', 'h-0');
  mine(-2, '16:00', 'riding', 'r-meera', 'm-meera', 'attended', 'Lovely rising trot. Keep heels down.', 'h-4');
  mine(2, '07:00', 'polo', 'r-arjun', 'm-arjun', 'booked', '', 'h-0');
  mine(3, '16:00', 'riding', 'r-meera', 'm-meera', 'booked', '', null);
  const priya = db.sessions.find((s) => s.starts_at === at(addDays(today, 1), '06:00') && s.kind === 'jumping');
  if (priya) db.bookings.push({ id: uuid(), session_id: priya.id, rider_id: 'r-priya', account_id: 'u-priya', membership_id: 'm-priya', status: 'booked', horse_id: null, coach_note: '', created_at: new Date().toISOString() });

  let current = null;
  const authListeners = [];
  const isStaff = () => ['staff', 'admin'].includes(prof(current)?.role);
  const prof = (id) => db.profiles.find((p) => p.id === id);
  const live = (b) => b.status !== 'cancelled';
  const balance = (m) => { const used = db.bookings.filter((b) => b.membership_id === m.id && live(b)).length; return { ...m, rides_used: used, rides_left: m.rides_total - used }; };
  const sess = (id) => db.sessions.find((s) => s.id === id);
  const inRange = (ts, from, to) => ts >= from && ts < to;
  const emit = (ev) => authListeners.forEach((cb) => cb(ev, current ? { user: { id: current } } : null));

  async function book(sessionId, riderId) {
    await wait();
    const r = db.riders.find((x) => x.id === riderId && x.active);
    if (!r || (r.account_id !== current && !isStaff())) fail('That rider is not on your account.');
    const s = sess(sessionId);
    if (!s || s.cancelled) fail('This session is not available.');
    if (new Date(s.starts_at) <= new Date()) fail('This session has already started.');
    if (db.closures.some((c) => c.day === istDate(s.starts_at))) fail('The club is closed that day.');
    if (db.bookings.some((b) => b.session_id === s.id && b.rider_id === r.id && live(b))) fail(`${r.name} is already booked on this session.`);
    if (db.bookings.filter((b) => b.session_id === s.id && live(b)).length >= s.capacity) fail('Sorry, this session just filled up.');
    const day = istDate(s.starts_at);
    const m = db.memberships
      .filter((x) => x.account_id === r.account_id && x.status === 'active' && x.kind === s.kind && day >= x.starts_on && day <= x.expires_on)
      .sort((a, b) => a.expires_on.localeCompare(b.expires_on))
      .map(balance).find((x) => x.rides_left > 0);
    if (!m) fail(`You have no ${s.kind} rides left on a valid package for this date.`, 'no_rides');
    const id = uuid();
    db.bookings.push({ id, session_id: s.id, rider_id: r.id, account_id: r.account_id, membership_id: m.id, status: 'booked', horse_id: null, coach_note: '', created_at: new Date().toISOString() });
    db.waitlist = db.waitlist.filter((w) => !(w.session_id === s.id && w.rider_id === r.id));
    return id;
  }

  function cancelSessionNow(id) {
    const s = sess(id); if (s) s.cancelled = true;
    let n = 0;
    db.bookings.forEach((b) => { if (b.session_id === id && b.status === 'booked') { b.status = 'cancelled'; n++; } });
    db.waitlist = db.waitlist.filter((w) => w.session_id !== id);
    return n;
  }

  return {
    mode: 'demo',
    demoUsers: [{ id: 'u-arjun', label: 'Try as a member (Arjun)' }, { id: 'u-owner', label: 'Try as the club owner' }],
    async demoSignIn(id) { await wait(); current = id; emit('SIGNED_IN'); },

    async getSession() { return current ? { user: { id: current } } : null; },
    onAuth(cb) { authListeners.push(cb); },
    async signIn(email) { await wait(); const p = db.profiles.find((x) => x.email === String(email).toLowerCase()); current = p ? p.id : 'u-arjun'; emit('SIGNED_IN'); },
    async signUp(email, _pw, full_name, phone) {
      await wait();
      const id = uuid();
      db.profiles.push({ id, full_name, phone, email, role: 'member' });
      current = id; emit('SIGNED_IN'); return { session: { user: { id } } };
    },
    async signOut() { current = null; emit('SIGNED_OUT'); },
    async resetPassword() { await wait(); },
    async updatePassword() { await wait(); },

    async settings() { await wait(40); return clone(db.settings); },
    async updateSettings(p) { await wait(); Object.assign(db.settings, p); },
    async me() { await wait(40); return clone(prof(current)); },
    async updateMe(p) { await wait(); Object.assign(prof(current), { full_name: p.full_name, phone: p.phone }); },
    async packages() { await wait(40); return clone(db.packages.filter((p) => p.active || isStaff()).sort((a, b) => a.sort - b.sort || a.price_inr - b.price_inr)); },
    async savePackage(p) { await wait(); if (p.id) Object.assign(db.packages.find((x) => x.id === p.id), p); else db.packages.push({ ...p, id: uuid() }); },
    async horses() { await wait(40); return clone([...db.horses].sort((a, b) => a.name.localeCompare(b.name))); },
    async saveHorse(h) { await wait(); if (h.id) Object.assign(db.horses.find((x) => x.id === h.id), h); else db.horses.push({ ...h, id: uuid() }); },
    async closures(fromDay, toDay) { await wait(40); return clone(db.closures.filter((c) => c.day >= fromDay && c.day < toDay).sort((a, b) => a.day.localeCompare(b.day))); },
    async slots(from, to) {
      await wait(60);
      return clone(db.sessions.filter((s) => inRange(s.starts_at, from, to)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((s) => ({
        ...s, booked: db.bookings.filter((b) => b.session_id === s.id && live(b)).length,
        waitlisted: db.waitlist.filter((w) => w.session_id === s.id).length,
      })));
    },

    async myRiders() { await wait(40); return clone(db.riders.filter((r) => r.account_id === current)); },
    async saveRider(r) { await wait(); if (r.id) Object.assign(db.riders.find((x) => x.id === r.id), r); else db.riders.push({ active: true, ...r, id: uuid(), account_id: current }); },
    async myBalances() { await wait(40); return clone(db.memberships.filter((m) => m.account_id === current).map(balance).sort((a, b) => b.requested_at.localeCompare(a.requested_at))); },
    async myBookings() {
      await wait(60);
      return clone(db.bookings.filter((b) => b.account_id === current).map((b) => ({
        ...b, sessions: sess(b.session_id), riders: { name: db.riders.find((r) => r.id === b.rider_id)?.name },
        horses: b.horse_id ? { name: db.horses.find((h) => h.id === b.horse_id)?.name } : null,
      })));
    },
    async myWaitlist() { await wait(30); return clone(db.waitlist.filter((w) => w.account_id === current)); },
    async joinWaitlist(session_id, rider_id) { await wait(); db.waitlist.push({ session_id, rider_id, account_id: current, created_at: new Date().toISOString() }); },
    async leaveWaitlist(session_id, rider_id) { await wait(); db.waitlist = db.waitlist.filter((w) => !(w.session_id === session_id && w.rider_id === rider_id)); },
    book,
    async cancel(id) {
      await wait();
      const b = db.bookings.find((x) => x.id === id);
      if (!b || (b.account_id !== current && !isStaff())) fail('Booking not found.');
      if (b.status !== 'booked') fail('This booking can no longer be cancelled.');
      const hrs = db.settings.cancel_hours;
      if (!isStaff() && new Date(sess(b.session_id).starts_at) - Date.now() < hrs * 3600e3) fail(`Cancellations close ${hrs} hours before the ride. Please call the club.`);
      b.status = 'cancelled';
    },
    async requestPackage(pid, method, ref) {
      await wait();
      const p = db.packages.find((x) => x.id === pid && x.active); if (!p) fail('That package is no longer offered.');
      db.memberships.push({ id: uuid(), account_id: current, package_id: p.id, package_name: p.name, kind: p.kind, rides_total: p.rides, validity_days: p.validity_days, price_inr: p.price_inr, status: 'pending', starts_on: null, expires_on: null, payment_method: method, payment_ref: ref || '', requested_at: new Date().toISOString() });
    },

    async daySessions(from, to) { await wait(40); return clone(db.sessions.filter((s) => inRange(s.starts_at, from, to)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))); },
    async dayBookings(from, to) {
      await wait(60);
      return clone(db.bookings.filter((b) => live(b) && inRange(sess(b.session_id)?.starts_at || '', from, to)).map((b) => {
        const r = db.riders.find((x) => x.id === b.rider_id); const p = prof(b.account_id);
        return { ...b, sessions: { starts_at: sess(b.session_id).starts_at }, riders: { name: r?.name, level: r?.level, weight_kg: r?.weight_kg }, profiles: { full_name: p?.full_name, phone: p?.phone } };
      }));
    },
    async dayWaitlist(from, to) {
      await wait(30);
      return clone(db.waitlist.filter((w) => inRange(sess(w.session_id)?.starts_at || '', from, to)).map((w) => ({ ...w, riders: { name: db.riders.find((r) => r.id === w.rider_id)?.name }, profiles: { full_name: prof(w.account_id)?.full_name, phone: prof(w.account_id)?.phone } })));
    },
    async updateBooking(id, patch) { await wait(60); Object.assign(db.bookings.find((b) => b.id === id), patch); },
    async allRiders() { await wait(40); return clone(db.riders.filter((r) => r.active && r.account_id !== 'u-guests').map((r) => ({ ...r, profiles: { full_name: prof(r.account_id)?.full_name } }))); },
    async members() { await wait(40); return clone(db.profiles.filter((p) => p.id !== 'u-guests').sort((a, b) => a.full_name.localeCompare(b.full_name))); },
    async allBalances() { await wait(40); return clone(db.memberships.filter((m) => ['active', 'pending'].includes(m.status)).map(balance)); },
    async riderCounts() { await wait(30); return clone(db.riders.filter((r) => r.active).map((r) => ({ account_id: r.account_id }))); },
    async pending() { await wait(40); return clone(db.memberships.filter((m) => m.status === 'pending').map(balance)); },
    async approve(id, start) {
      await wait();
      const m = db.memberships.find((x) => x.id === id); if (!m || m.status !== 'pending') fail('This request is not pending.');
      const d = start || istDate(); Object.assign(m, { status: 'active', starts_on: d, expires_on: addDays(d, m.validity_days - 1) });
    },
    async reject(id, note) { await wait(); const m = db.memberships.find((x) => x.id === id); Object.assign(m, { status: 'rejected', note }); },
    async addMembership(account, pid, method, ref, start) {
      await wait();
      const p = db.packages.find((x) => x.id === pid); const d = start || istDate();
      db.memberships.push({ id: uuid(), account_id: account, package_id: p.id, package_name: p.name, kind: p.kind, rides_total: p.rides, validity_days: p.validity_days, price_inr: p.price_inr, status: 'active', starts_on: d, expires_on: addDays(d, p.validity_days - 1), payment_method: method, payment_ref: ref || '', requested_at: new Date().toISOString() });
    },
    async setRole(id, role) { await wait(); if (id === current) fail('You cannot change your own role.'); prof(id).role = role; },
    async createSessions(a) {
      await wait();
      let n = 0;
      for (let d = a.from; d <= a.to; d = addDays(d, 1)) {
        const iso = ((dayStart(d).getUTCDay() + 1) % 7) || 7; // dayStart is 18:30 UTC the previous day
        if (!a.weekdays.includes(iso) || db.closures.some((c) => c.day === d)) continue;
        const ts = new Date(d + 'T' + a.time + ':00+05:30').toISOString();
        if (db.sessions.some((s) => s.starts_at === ts && s.kind === a.kind && !s.cancelled)) continue;
        db.sessions.push({ id: uuid(), starts_at: ts, duration_min: a.duration || 60, kind: a.kind, level: a.level || 'All levels', coach: a.coach || '', capacity: a.capacity, cancelled: false, note: '' });
        n++;
      }
      return n;
    },
    async cancelSession(id) { await wait(); return cancelSessionNow(id); },
    async addClosure(day, reason) {
      await wait();
      db.closures = db.closures.filter((c) => c.day !== day); db.closures.push({ day, reason: reason || 'Club closed' });
      return db.sessions.filter((s) => istDate(s.starts_at) === day && !s.cancelled).reduce((n, s) => n + cancelSessionNow(s.id), 0);
    },
    async removeClosure(day) { await wait(); db.closures = db.closures.filter((c) => c.day !== day); },
  };
}
