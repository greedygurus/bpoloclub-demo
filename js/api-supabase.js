// Live data layer: talks to your Supabase project.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SESSION_COLS = 'id,starts_at,duration_min,kind,level,coach,capacity,cancelled,note';

export function createApi(url, key) {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  async function q(p) {
    const { data, error } = await p;
    if (error) { const e = new Error(error.message); e.hint = error.hint; e.code = error.code; throw e; }
    return data;
  }
  let uid = null;

  return {
    mode: 'live',

    // ---- Auth
    async getSession() { const { data } = await sb.auth.getSession(); uid = data.session?.user?.id || null; return data.session; },
    onAuth(cb) { sb.auth.onAuthStateChange((event, session) => { uid = session?.user?.id || null; cb(event, session); }); },
    signIn: (email, password) => q(sb.auth.signInWithPassword({ email, password })),
    signUp: (email, password, full_name, phone) => q(sb.auth.signUp({ email, password, options: { data: { full_name, phone } } })),
    signOut: () => sb.auth.signOut(),
    resetPassword: (email) => q(sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })),
    updatePassword: (password) => q(sb.auth.updateUser({ password })),

    // ---- Shared
    settings: () => q(sb.from('settings').select('*').eq('id', 1).single()),
    updateSettings: (patch) => q(sb.from('settings').update(patch).eq('id', 1)),
    me: () => q(sb.from('profiles').select('*').eq('id', uid).single()),
    updateMe: (patch) => q(sb.from('profiles').update(patch).eq('id', uid)),
    packages: () => q(sb.from('packages').select('*').order('sort').order('price_inr')),
    savePackage: (p) => p.id ? q(sb.from('packages').update(strip(p)).eq('id', p.id)) : q(sb.from('packages').insert(strip(p))),
    horses: () => q(sb.from('horses').select('*').order('name')),
    saveHorse: (h) => h.id ? q(sb.from('horses').update(strip(h)).eq('id', h.id)) : q(sb.from('horses').insert(strip(h))),
    closures: (fromDay, toDay) => q(sb.from('closures').select('*').gte('day', fromDay).lt('day', toDay).order('day')),
    slots: (from, to) => q(sb.rpc('session_slots', { p_from: from, p_to: to })),

    // ---- Member
    myRiders: () => q(sb.from('riders').select('*').eq('account_id', uid).order('created_at')),
    saveRider: (r) => r.id
      ? q(sb.from('riders').update(strip(r)).eq('id', r.id))
      : q(sb.from('riders').insert({ ...strip(r), account_id: uid })),
    myBalances: () => q(sb.from('membership_balances').select('*').eq('account_id', uid).order('requested_at', { ascending: false })),
    myBookings: () => q(sb.from('bookings')
      .select(`id,status,coach_note,session_id,rider_id,created_at,sessions(${SESSION_COLS}),riders(name),horses(name)`)
      .eq('account_id', uid).order('created_at', { ascending: false }).limit(300)),
    myWaitlist: () => q(sb.from('waitlist').select('session_id,rider_id').eq('account_id', uid)),
    joinWaitlist: (session_id, rider_id) => q(sb.from('waitlist').insert({ session_id, rider_id, account_id: uid })),
    leaveWaitlist: (session_id, rider_id) => q(sb.from('waitlist').delete().eq('session_id', session_id).eq('rider_id', rider_id)),
    book: (sessionId, riderId) => q(sb.rpc('book_session', { p_session: sessionId, p_rider: riderId })),
    cancel: (bookingId) => q(sb.rpc('cancel_booking', { p_booking: bookingId })),
    requestPackage: (packageId, method, ref) => q(sb.rpc('request_package', { p_package: packageId, p_method: method, p_ref: ref })),

    // ---- Staff
    daySessions: (from, to) => q(sb.from('sessions').select(SESSION_COLS).gte('starts_at', from).lt('starts_at', to).order('starts_at')),
    dayBookings: (from, to) => q(sb.from('bookings')
      .select('id,status,coach_note,session_id,rider_id,account_id,horse_id,sessions!inner(starts_at),riders(name,level,weight_kg),profiles(full_name,phone)')
      .gte('sessions.starts_at', from).lt('sessions.starts_at', to).neq('status', 'cancelled')),
    dayWaitlist: (from, to) => q(sb.from('waitlist')
      .select('session_id,rider_id,created_at,sessions!inner(starts_at),riders(name),profiles(full_name,phone)')
      .gte('sessions.starts_at', from).lt('sessions.starts_at', to).order('created_at')),
    updateBooking: (id, patch) => q(sb.from('bookings').update(patch).eq('id', id)),
    allRiders: () => q(sb.from('riders').select('id,name,level,account_id,profiles(full_name)').eq('active', true).order('name')),
    members: () => q(sb.from('profiles').select('*').order('full_name')),
    allBalances: () => q(sb.from('membership_balances').select('*').in('status', ['active', 'pending']).order('requested_at', { ascending: false })),
    riderCounts: () => q(sb.from('riders').select('account_id').eq('active', true)),
    pending: () => q(sb.from('membership_balances').select('*').eq('status', 'pending').order('requested_at')),
    approve: (id, start) => q(sb.rpc('approve_membership', { p_membership: id, p_start: start || null })),
    reject: (id, note) => q(sb.rpc('reject_membership', { p_membership: id, p_note: note || '' })),
    addMembership: (account, pkg, method, ref, start) => q(sb.rpc('add_membership', { p_account: account, p_package: pkg, p_method: method, p_ref: ref || '', p_start: start || null })),
    setRole: (id, role) => q(sb.from('profiles').update({ role }).eq('id', id)),
    createSessions: (a) => q(sb.rpc('create_sessions', {
      p_from: a.from, p_to: a.to, p_weekdays: a.weekdays, p_time: a.time, p_kind: a.kind,
      p_level: a.level, p_coach: a.coach, p_capacity: a.capacity, p_duration: a.duration })),
    cancelSession: (id) => q(sb.rpc('cancel_session', { p_session: id })),
    addClosure: (day, reason) => q(sb.rpc('add_closure', { p_day: day, p_reason: reason })),
    removeClosure: (day) => q(sb.from('closures').delete().eq('day', day)),
  };
}

function strip(o) { const c = { ...o }; delete c.id; return c; }
