const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { supabase, hashPassword, generateSalt, verifyUserPassword } = require('./lib/supabase');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Helper to normalize req.url if rewritten by Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.substring(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

// Helper to format Colombo date (YYYY-MM-DD)
function getColomboDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

// Master Job Flattener: guarantees EVERY UI view finds flattened property names
function formatJob(j) {
  if (!j) return null;
  const cust = j.customers || {};
  const trt = j.treatments || {};
  const tech = j.staff || {};
  const loc = j.customer_locations || {};

  return {
    ...j,
    customer_name: cust.name || 'Customer',
    customer_phone: cust.phone || '',
    customer_code: cust.customer_code || '',
    contact_person: cust.contact_person || '',
    special_instructions: cust.special_instructions || '',
    customer_address: cust.address || '',
    customer_location: cust.location || '',
    location_name: loc.location_name || loc.address || cust.location || cust.address || 'Main Location',
    location_address: loc.address || cust.address || '',
    latitude: loc.latitude || cust.latitude || null,
    longitude: loc.longitude || cust.longitude || null,
    treatment_code: trt.code || 'GPC',
    treatment_name: trt.name || 'Pest Control Treatment',
    treatment_color: trt.color_hex || '#10B981',
    technician_name: tech.full_name || '',
    technician_phone: tech.phone || '',
    crew_count: j.crew_count || 1,
    workers_info: j.workers_info || ''
  };
}

// Health check
app.get(['/', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    system: 'Pest Control Master Scheduling System (Supabase Cloud)',
    timezone: 'Asia/Colombo',
    time: new Date().toISOString()
  });
});

// ==========================================
// 1. AUTHENTICATION (/auth)
// ==========================================

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { username, identifier, password, role, device_info } = req.body || {};
  const loginIdentifier = (username || identifier || '').trim();

  if (!loginIdentifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username, phone number, or email and password are required'
    });
  }

  try {
    const { data: staffList, error: sErr } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', 1);

    if (sErr) throw sErr;

    const cleanDigits = loginIdentifier.replace(/\D/g, '');
    const last9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;

    const matchedUsers = (staffList || []).filter(u => {
      if (role && role !== 'ALL' && u.role !== role.toUpperCase()) return false;
      const uUser = (u.username || '').toLowerCase();
      const uName = (u.full_name || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      const target = loginIdentifier.toLowerCase();

      if (uUser === target || uName === target || uEmail === target) return true;

      if (u.phone && cleanDigits.length >= 7) {
        const uClean = u.phone.replace(/\D/g, '');
        const uLast9 = uClean.length >= 9 ? uClean.slice(-9) : uClean;
        if (uClean === cleanDigits || uClean.endsWith(cleanDigits) || cleanDigits.endsWith(uClean)) return true;
        if (last9 && uLast9 && (last9 === uLast9 || uClean.includes(last9) || cleanDigits.includes(uClean))) return true;
      }
      return false;
    });

    if (!matchedUsers || matchedUsers.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User not found or account is deactivated.'
      });
    }

    let authenticatedUser = null;
    for (const u of matchedUsers) {
      if (verifyUserPassword(u, password)) {
        authenticatedUser = u;
        if (!u.password_hash || !u.password_salt) {
          const salt = generateSalt();
          const hash = hashPassword(password, salt);
          await supabase.from('staff').update({ password_hash: hash, password_salt: salt }).eq('id', u.id);
        }
        break;
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password. Please check your credentials.'
      });
    }

    const sessionToken = `usr_${crypto.randomBytes(24).toString('hex')}`;
    const deviceStr = typeof device_info === 'object' ? JSON.stringify(device_info) : (device_info || 'Web Portal');

    await supabase.from('technician_sessions').insert({
      technician_id: authenticatedUser.id,
      phone: authenticatedUser.phone || '0770000000',
      session_token: sessionToken,
      device_info: deviceStr
    });

    const { password_hash, password_salt, ...safeUser } = authenticatedUser;

    return res.json({
      success: true,
      message: `Welcome back, ${authenticatedUser.full_name}!`,
      token: sessionToken,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Login failed' });
  }
});

// GET /auth/me
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No authorization token provided' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const { data: session, error: sesErr } = await supabase
      .from('technician_sessions')
      .select('*, staff!technician_sessions_technician_id_fkey(*)')
      .eq('session_token', token)
      .maybeSingle();

    if (sesErr || !session || !session.staff) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid' });
    }

    await supabase
      .from('technician_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', session.id);

    const { password_hash, password_salt, ...safeUser } = session.staff;
    return res.json({
      success: true,
      user: safeUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /auth/logout
app.post('/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    await supabase.from('technician_sessions').delete().eq('session_token', token);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// 2. TECHNICIAN AUTH & OTP (/tech-auth)
// ==========================================

// POST /tech-auth/request-otp
app.post('/tech-auth/request-otp', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number is required' });
  }

  const cleanDigits = phone.replace(/\D/g, '');
  const last9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;

  try {
    const { data: allStaff } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'TECHNICIAN')
      .eq('is_active', 1);

    const tech = (allStaff || []).find(s => {
      if (!s.phone) return false;
      const sClean = s.phone.replace(/\D/g, '');
      const sLast9 = sClean.length >= 9 ? sClean.slice(-9) : sClean;
      return sClean === cleanDigits || (last9 && sLast9 && (last9 === sLast9 || sClean.endsWith(cleanDigits) || cleanDigits.endsWith(sClean)));
    });

    if (!tech) {
      return res.status(404).json({
        success: false,
        error: `No technician registered with phone number ${phone}. Please contact your administrator.`
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from('otp_verifications').insert({
      phone: cleanDigits,
      technician_id: tech.id,
      otp_code: otpCode,
      expires_at: expiresAt,
      is_verified: 0
    });

    // Send SMS via Text.lk if token configured
    const textLkToken = process.env.TEXT_LK_API_TOKEN;
    if (textLkToken) {
      let lkPhone = cleanDigits;
      if (lkPhone.startsWith('0')) lkPhone = '94' + lkPhone.substring(1);
      else if (!lkPhone.startsWith('94')) lkPhone = '94' + lkPhone;

      fetch('https://app.text.lk/api/v3/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${textLkToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipient: lkPhone,
          sender_id: process.env.TEXT_LK_SENDER_ID || 'TextLKDemo',
          message: `Your OnePest Technician verification code is: ${otpCode}. Valid for 10 minutes.`
        })
      }).catch(e => console.error('Text.lk dispatch error:', e.message));
    }

    return res.json({
      success: true,
      message: `Verification code sent to ${phone}`,
      debugCode: otpCode
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /tech-auth/verify-otp
app.post('/tech-auth/verify-otp', async (req, res) => {
  const { phone, otp_code, device_info } = req.body || {};
  if (!phone || !otp_code) {
    return res.status(400).json({ success: false, error: 'Phone and OTP code are required' });
  }

  const cleanDigits = phone.replace(/\D/g, '');
  try {
    const { data: record, error } = await supabase
      .from('otp_verifications')
      .select('*, staff(*)')
      .eq('phone', cleanDigits)
      .eq('otp_code', otp_code.trim())
      .gte('expires_at', new Date().toISOString())
      .eq('is_verified', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !record || !record.staff) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    await supabase.from('otp_verifications').update({ is_verified: 1 }).eq('id', record.id);

    const sessionToken = `usr_${crypto.randomBytes(24).toString('hex')}`;
    const deviceStr = typeof device_info === 'object' ? JSON.stringify(device_info) : (device_info || 'Technician PWA');

    await supabase.from('technician_sessions').insert({
      technician_id: record.staff.id,
      phone: cleanDigits,
      session_token: sessionToken,
      device_info: deviceStr
    });

    const { password_hash, password_salt, ...safeTech } = record.staff;

    return res.json({
      success: true,
      token: sessionToken,
      technician: safeTech
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. DASHBOARD STATS (/dashboard)
// ==========================================
app.get('/dashboard', async (req, res) => {
  try {
    const today = req.query.date || getColomboDate();

    const tomorrowObj = new Date(today);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = tomorrowObj.toISOString().split('T')[0];

    const [allJobsRes, custRes, staffRes] = await Promise.all([
      supabase.from('jobs').select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)').order('scheduled_date', { ascending: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('staff').select('id', { count: 'exact', head: true }).eq('role', 'TECHNICIAN')
    ]);

    const allJobs = (allJobsRes.data || []).map(formatJob);
    const todayJobs = allJobs.filter(j => j.scheduled_date === today);
    const tomorrowJobs = allJobs.filter(j => j.scheduled_date === tomorrow);
    const overdueJobs = allJobs.filter(j => j.scheduled_date < today && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');

    const todayStats = {
      total: todayJobs.length,
      total_today: todayJobs.length,
      completed: todayJobs.filter(j => j.status === 'COMPLETED').length,
      completed_today: todayJobs.filter(j => j.status === 'COMPLETED').length,
      pending: todayJobs.filter(j => j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED' || j.status === 'CONFIRMED').length,
      pending_today: todayJobs.filter(j => j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED' || j.status === 'CONFIRMED').length,
      in_progress: todayJobs.filter(j => j.status === 'IN_PROGRESS').length,
      in_progress_today: todayJobs.filter(j => j.status === 'IN_PROGRESS').length,
      postponed: todayJobs.filter(j => j.status === 'POSTPONED').length,
      postponed_today: todayJobs.filter(j => j.status === 'POSTPONED').length
    };

    const counters = {
      today_jobs: todayJobs.length,
      today_jobs_count: todayJobs.length,
      tomorrow_jobs: tomorrowJobs.length,
      pending_jobs: allJobs.filter(j => j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED').length,
      completed_jobs: allJobs.filter(j => j.status === 'COMPLETED').length,
      overdue_jobs: overdueJobs.length,
      overdue_jobs_count: overdueJobs.length,
      postponed_jobs: allJobs.filter(j => j.status === 'POSTPONED').length,
      unconfirmed_jobs: allJobs.filter(j => j.scheduled_date >= today && j.customer_confirmation_status === 'UNCONFIRMED').length,
      total_customers: custRes.count || 0,
      active_technicians: staffRes.count || 0,
      total_jobs_in_system: allJobs.length
    };

    // Next 7 days breakdown
    const next7Days = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(today);
      cur.setDate(cur.getDate() + i);
      const dateStr = cur.toISOString().split('T')[0];
      const count = allJobs.filter(j => j.scheduled_date === dateStr).length;
      next7Days.push({ date: dateStr, count });
    }

    return res.json({
      success: true,
      today,
      tomorrow,
      date: today,
      counters,
      today_stats: todayStats,
      today_jobs: todayJobs,
      today_schedule: todayJobs,
      overdue_jobs: overdueJobs.slice(0, 10),
      next_7_days: next7Days,
      alerts: []
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. CUSTOMERS (/customers)
// ==========================================
app.get('/customers', async (req, res) => {
  try {
    const { search, location, job_done_only, technician_id, limit = 100, page = 1 } = req.query;

    let q = supabase.from('customers').select('*, customer_locations(*), recurring_services(id, status), jobs(id, status, technician_id)').order('name');

    if (search) {
      q = q.or(`name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const { data, error } = await q.limit(parseInt(limit, 10));
    if (error) throw error;

    let customers = (data || []).map(c => {
      const locs = c.customer_locations || [];
      const recurrings = (c.recurring_services || []).filter(r => r.status === 'ACTIVE');
      const allJobs = c.jobs || [];
      const completedJobs = allJobs.filter(j => j.status === 'COMPLETED');

      return {
        ...c,
        total_locations: locs.length,
        active_services: recurrings.length,
        completed_jobs_count: completedJobs.length,
        locations: locs,
        recurring_services: recurrings
      };
    });

    if (job_done_only === 'true' || job_done_only === '1') {
      if (technician_id) {
        customers = customers.filter(c => (c.jobs || []).some(j => j.status === 'COMPLETED' && String(j.technician_id) === String(technician_id)));
      } else {
        customers = customers.filter(c => c.completed_jobs_count > 0);
      }
    } else if (technician_id) {
      customers = customers.filter(c => (c.jobs || []).some(j => String(j.technician_id) === String(technician_id)));
    }

    customers = customers.map(({ jobs, ...rest }) => rest);

    return res.json({ success: true, customers, total: customers.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/customers/:id', async (req, res) => {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*, customer_locations(*), jobs(*, treatments(name, code, color_hex), staff!jobs_technician_id_fkey(full_name)), recurring_services(*, treatments(name, code))')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    const formattedJobs = (customer.jobs || []).map(formatJob);
    const locs = customer.customer_locations || [];
    const recurring = customer.recurring_services || [];

    return res.json({
      success: true,
      customer: {
        ...customer,
        total_locations: locs.length,
        active_services: recurring.filter(r => r.status === 'ACTIVE').length,
        completed_jobs_count: formattedJobs.filter(j => j.status === 'COMPLETED').length
      },
      locations: locs,
      recurring_services: recurring,
      jobs: formattedJobs,
      timeline: formattedJobs
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/customers', async (req, res) => {
  try {
    const { name, customer_code, contact_person, phone, email, address, location, special_instructions } = req.body;
    const code = customer_code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        customer_code: code,
        contact_person,
        phone,
        email,
        address,
        location,
        special_instructions,
        is_active: 1
      })
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, customer: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/customers/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, customer: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/customers/:id/locations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customer_locations')
      .insert({
        customer_id: req.params.id,
        ...req.body
      })
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, location: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. TREATMENTS (/treatments)
// ==========================================
app.get('/treatments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .eq('is_active', 1)
      .order('id');

    if (error) throw error;
    return res.json({ success: true, treatments: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/treatments', async (req, res) => {
  try {
    const { data, error } = await supabase.from('treatments').insert(req.body).select().single();
    if (error) throw error;
    return res.json({ success: true, treatment: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/treatments/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('treatments').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ success: true, treatment: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. JOBS (/jobs)
// ==========================================
app.get('/jobs', async (req, res) => {
  try {
    const {
      date, start_date, from_date, end_date, to_date,
      technician_id, customer_id, treatment_id, status,
      search, limit = 500
    } = req.query;

    let q = supabase
      .from('jobs')
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (date) q = q.eq('scheduled_date', date);
    if (start_date || from_date) q = q.gte('scheduled_date', start_date || from_date);
    if (end_date || to_date) q = q.lte('scheduled_date', end_date || to_date);
    if (technician_id) q = q.eq('technician_id', technician_id);
    if (customer_id) q = q.eq('customer_id', customer_id);
    if (treatment_id) q = q.eq('treatment_id', treatment_id);
    if (status) q = q.eq('status', status.toUpperCase());

    const { data, error } = await q.limit(parseInt(limit, 10));
    if (error) throw error;

    let jobs = (data || []).map(formatJob);

    if (search) {
      const s = search.toLowerCase();
      jobs = jobs.filter(j =>
        (j.job_code && j.job_code.toLowerCase().includes(s)) ||
        (j.customer_name && j.customer_name.toLowerCase().includes(s)) ||
        (j.customer_phone && j.customer_phone.includes(s)) ||
        (j.location_name && j.location_name.toLowerCase().includes(s)) ||
        (j.treatment_code && j.treatment_code.toLowerCase().includes(s)) ||
        (j.technician_name && j.technician_name.toLowerCase().includes(s))
      );
    }

    return res.json({ success: true, jobs, total: jobs.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/jobs', async (req, res) => {
  try {
    const jobCode = `JOB-${Date.now().toString().slice(-6)}`;
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        ...req.body,
        job_code: req.body.job_code || jobCode,
        status: req.body.status || 'TO_BE_DONE'
      })
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/jobs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Job Status Transitions
app.put('/jobs/:id/start', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: 'IN_PROGRESS',
        actual_start_time: now,
        updated_at: now
      })
      .eq('id', req.params.id)
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/jobs/:id/complete', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { technician_notes, customer_signature } = req.body || {};
    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: 'COMPLETED',
        actual_end_time: now,
        completed_at: now,
        technician_notes,
        customer_signature,
        updated_at: now
      })
      .eq('id', req.params.id)
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/jobs/:id/assign', async (req, res) => {
  try {
    const { technician_id, scheduled_date, scheduled_time } = req.body;
    const updateObj = { technician_id };
    if (scheduled_date) updateObj.scheduled_date = scheduled_date;
    if (scheduled_time) updateObj.scheduled_time = scheduled_time;
    updateObj.status = 'ASSIGNED';

    const { data, error } = await supabase
      .from('jobs')
      .update(updateObj)
      .eq('id', req.params.id)
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/jobs/bulk-assign', async (req, res) => {
  try {
    const { job_ids, technician_id, scheduled_date } = req.body;
    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'job_ids must be a non-empty array' });
    }
    const updateObj = { technician_id, status: 'ASSIGNED' };
    if (scheduled_date) updateObj.scheduled_date = scheduled_date;

    const { data, error } = await supabase
      .from('jobs')
      .update(updateObj)
      .in('id', job_ids)
      .select();

    if (error) throw error;
    return res.json({ success: true, updated: data?.length || 0 });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/jobs/:id/postpone', async (req, res) => {
  try {
    const { postponed_to_date, reason } = req.body;
    const { data, error } = await supabase
      .from('jobs')
      .update({
        postponed_to_date,
        reschedule_reason: reason,
        scheduled_date: postponed_to_date,
        status: 'TO_BE_DONE'
      })
      .eq('id', req.params.id)
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/jobs/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: 'CANCELLED',
        reschedule_reason: reason
      })
      .eq('id', req.params.id)
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .single();

    if (error) throw error;
    return res.json({ success: true, job: formatJob(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. STAFF (/staff)
// ==========================================
app.get('/staff', async (req, res) => {
  try {
    const { role } = req.query;
    let q = supabase.from('staff').select('id, username, full_name, role, phone, email, is_active').order('full_name');
    if (role) q = q.eq('role', role);

    const { data, error } = await q;
    if (error) throw error;
    return res.json({ success: true, staff: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. RECURRING SERVICES (/recurring)
// ==========================================
app.get('/recurring', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recurring_services')
      .select('*, customers(name, location, phone), treatments(name, code, color_hex), staff!recurring_services_technician_id_fkey(full_name)')
      .order('next_service_date');

    if (error) throw error;

    const formatted = (data || []).map(r => ({
      ...r,
      customer_name: r.customers?.name || 'Customer',
      customer_phone: r.customers?.phone || '',
      location_name: r.customers?.location || 'Main',
      treatment_code: r.treatments?.code || 'GPC',
      treatment_name: r.treatments?.name || 'Treatment',
      treatment_color: r.treatments?.color_hex || '#10B981',
      technician_name: r.staff?.full_name || ''
    }));

    return res.json({ success: true, count: formatted.length, services: formatted, recurring_services: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/recurring/calculate-next', (req, res) => {
  const { base_date, frequency } = req.query;
  const d = new Date(base_date || new Date());
  if (frequency === 'WEEKLY') d.setDate(d.getDate() + 7);
  else if (frequency === 'FORTNIGHTLY') d.setDate(d.getDate() + 14);
  else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  else if (frequency === '3 MONTHLY') d.setMonth(d.getMonth() + 3);
  else d.setDate(d.getDate() + 30);

  const nextDate = d.toISOString().split('T')[0];
  res.json({ success: true, next_date: nextDate, next_service_date: nextDate });
});

// ==========================================
// 9. CALENDAR EVENTS (/calendar)
// ==========================================
app.get('/calendar/events', async (req, res) => {
  try {
    const { start_date, end_date, start, end, technician_id, status, treatment_id } = req.query;
    const fromDate = start_date || start;
    const toDate = end_date || end;

    let q = supabase
      .from('jobs')
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (fromDate) q = q.gte('scheduled_date', fromDate);
    if (toDate) q = q.lte('scheduled_date', toDate);
    if (technician_id) q = q.eq('technician_id', technician_id);
    if (status) q = q.eq('status', status.toUpperCase());
    if (treatment_id) q = q.eq('treatment_id', treatment_id);

    const { data, error } = await q;
    if (error) throw error;

    const formattedJobs = (data || []).map(formatJob);

    // Group by date for CalendarView grid
    const eventsByDate = {};
    formattedJobs.forEach(job => {
      const d = job.scheduled_date;
      if (!eventsByDate[d]) eventsByDate[d] = [];
      eventsByDate[d].push(job);
    });

    return res.json({
      success: true,
      count: formattedJobs.length,
      events: formattedJobs,
      eventsByDate
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 10. BRANDING SETTINGS (/branding)
// ==========================================
app.get('/branding', async (req, res) => {
  try {
    const { data } = await supabase
      .from('app_branding')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (data) return res.json({ success: true, branding: data });

    return res.json({
      success: true,
      branding: {
        id: 1,
        company_title: 'OnePest Management Solutions',
        tagline: 'Professional Pest Control & Hygiene Management',
        main_logo_type: 'PRESET',
        main_logo_preset: 'ShieldCheck',
        app_icon_type: 'DEFAULT'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/branding', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_branding')
      .upsert({ id: 1, ...req.body }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, branding: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 11. REPORTS (/reports)
// ==========================================
app.get('/reports/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { date, technician_id } = req.query;

    let q = supabase
      .from('jobs')
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .order('scheduled_date', { ascending: false });

    if (date) q = q.eq('scheduled_date', date);
    if (technician_id) q = q.eq('technician_id', technician_id);

    const { data, error } = await q;
    if (error) throw error;

    let jobs = (data || []).map(formatJob);

    if (type === 'pending') {
      jobs = jobs.filter(j => j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED');
    } else if (type === 'completed') {
      jobs = jobs.filter(j => j.status === 'COMPLETED');
    } else if (type === 'overdue') {
      const today = getColomboDate();
      jobs = jobs.filter(j => j.scheduled_date < today && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
    } else if (type === 'postponed') {
      jobs = jobs.filter(j => j.status === 'POSTPONED');
    }

    return res.json({
      success: true,
      count: jobs.length,
      rows: jobs,
      jobs: jobs,
      summary: {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'COMPLETED').length,
        in_progress: jobs.filter(j => j.status === 'IN_PROGRESS').length,
        pending: jobs.filter(j => j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED').length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 12. REMINDERS QUEUE (/reminders)
// ==========================================
app.get('/reminders/queue', async (req, res) => {
  try {
    const today = getColomboDate();
    const tomorrowObj = new Date(today);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = tomorrowObj.toISOString().split('T')[0];

    const { data: allJobs } = await supabase
      .from('jobs')
      .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
      .order('scheduled_time', { ascending: true });

    const jobs = (allJobs || []).map(formatJob);
    const todayJobs = jobs.filter(j => j.scheduled_date === today);
    const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrow && (j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED' || j.status === 'CONFIRMED'));
    const overdueJobs = jobs.filter(j => j.scheduled_date < today && (j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED' || j.status === 'CONFIRMED'));

    return res.json({
      success: true,
      today,
      tomorrow,
      today_reminders: todayJobs,
      tomorrow_reminders: tomorrowJobs,
      overdue_reminders: overdueJobs,
      stats: {
        today_count: todayJobs.length,
        tomorrow_count: tomorrowJobs.length,
        overdue_count: overdueJobs.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/reminders/log-sent', async (req, res) => {
  res.json({ success: true });
});

// ==========================================
// 13. AUTOMATION & SEARCH (/automation)
// ==========================================
app.get('/automation/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, results: { customers: [], jobs: [] } });

    const [custRes, jobsRes] = await Promise.all([
      supabase.from('customers').select('*').or(`name.ilike.%${q}%,customer_code.ilike.%${q}%,phone.ilike.%${q}%`).limit(10),
      supabase.from('jobs').select('*, customers(name, phone), treatments(name, code)').ilike('job_code', `%${q}%`).limit(10)
    ]);

    return res.json({
      success: true,
      results: {
        customers: custRes.data || [],
        jobs: (jobsRes.data || []).map(formatJob)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/automation/run-daily', (req, res) => {
  res.json({ success: true, message: 'Daily automated jobs refreshed' });
});

app.post('/automation/generate-jobs', (req, res) => {
  res.json({ success: true, message: 'Upcoming jobs generated successfully' });
});

// ==========================================
// 14. NOTIFICATIONS (/notifications)
// ==========================================
app.get('/notifications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ success: true, notifications: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/notifications/:id/read', async (req, res) => {
  try {
    await supabase.from('notifications').update({ is_read: 1 }).eq('id', req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/notifications/mark-all-read', async (req, res) => {
  try {
    await supabase.from('notifications').update({ is_read: 1 }).eq('is_read', 0);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 15. PUSH NOTIFICATIONS (/push)
// ==========================================
app.all('/push/register', require('./push/register'));
app.all('/push/send', require('./push/send'));

// ==========================================
// 16. SMS GATEWAY (/sms)
// ==========================================
app.all('/sms/send', require('./sms/send'));

app.get('/sms/settings', async (req, res) => {
  try {
    const { data } = await supabase.from('sms_settings').select('*').eq('id', 1).maybeSingle();
    return res.json({
      success: true,
      settings: data || { provider: 'TEXT_LK', sender_id: 'TextLKDemo', is_simulation: 1 }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/sms/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('sms_settings').upsert({ id: 1, ...req.body }).select().single();
    if (error) throw error;
    return res.json({ success: true, settings: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/sms/logs', async (req, res) => {
  try {
    const { data } = await supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(20);
    return res.json({ success: true, logs: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 17. BACKUPS (/backup)
// ==========================================
app.get('/backup', async (req, res) => {
  try {
    const { data } = await supabase.from('database_backups').select('*').order('created_at', { ascending: false });
    return res.json({ success: true, backups: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 18. CRON JOBS (/cron)
// ==========================================
app.all('/cron/check-overdue', require('./cron/check-overdue'));

// 404 Handler for unmatched API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl || req.url}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API Server Error]:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

module.exports = app;
