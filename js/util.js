// Small helpers shared by the app. Everything is shown in India time.
export const TZ = 'Asia/Kolkata';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 'YYYY-MM-DD' for a moment, in India time
export function istDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}
// Start of an India-time day as a Date
export function dayStart(dateStr) { return new Date(dateStr + 'T00:00:00+05:30'); }
export function addDays(dateStr, n) {
  const d = dayStart(dateStr); d.setUTCDate(d.getUTCDate() + n); return istDate(d);
}
export function dayRange(dateStr, days = 1) {
  return { from: dayStart(dateStr).toISOString(), to: dayStart(addDays(dateStr, days)).toISOString() };
}

const fmt = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...opts });
export const fmtTime = (ts) => fmt({ hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(ts)).toUpperCase();
export const fmtDow = (ts) => fmt({ weekday: 'short' }).format(new Date(ts));
export const fmtDayNum = (ts) => fmt({ day: 'numeric' }).format(new Date(ts));
export const fmtDayMonth = (ts) => fmt({ day: 'numeric', month: 'short' }).format(new Date(ts));
export const fmtLongDay = (ts) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ts));
export const fmtShortDay = (ts) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ts));
export const fmtDateOnly = (dateStr) => dateStr ? fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(dayStart(dateStr)) : '';
export const fmtDayFromStr = (dateStr) => fmtShortDay(dayStart(dateStr));

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export const KINDS = { polo: 'Polo', riding: 'Riding', jumping: 'Jumping' };
export const KIND_SECTIONS = { polo: 'Polo lease packages', riding: 'Riding training', jumping: 'Jumping lease packages' };
// Club hours: mornings 6–9 am, evenings 4–6 pm
export const CLUB_SLOTS = ['06:00', '07:00', '08:00', '16:00', '17:00'];
export function gstTotal(price, pct) { return Math.round(Number(price || 0) * (1 + Number(pct || 0) / 100)); }
export const kindLabel = (k) => KINDS[k] || k;

export function greeting() {
  const h = Number(fmt({ hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }

// Indian numbers → WhatsApp/phone friendly digits
export function phoneDigits(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return d;
}
export function waLink(phone, text) {
  const d = phoneDigits(phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text || '')}` : '';
}
export function upiLink({ upiId, payee, amount, note }) {
  if (!upiId) return '';
  const p = new URLSearchParams({ pa: upiId, pn: payee || '', am: String(amount || ''), cu: 'INR', tn: (note || '').slice(0, 40) });
  return 'upi://pay?' + p.toString().replace(/\+/g, '%20');
}

export function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Something went wrong.');
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/User already registered/i.test(m)) return 'An account with this email already exists. Sign in instead.';
  if (/Password should be at least/i.test(m)) return 'Use a password of at least 6 characters.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No connection. Check your internet and try again.';
  if (/rate limit/i.test(m)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/duplicate key|bookings_one_live_per_rider/i.test(m)) return 'That rider is already booked on this session.';
  return m;
}

export const icons = {
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
  book: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  packages: '<path d="M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  rides: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  staff: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
export const icon = (name, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
