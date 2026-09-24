const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mabwkgcujnxiwlawpoph.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYndrZ2N1am54aXdsYXdwb3BoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE2NjQ1MiwiZXhwIjoyMTA1NzQyNDUyfQ.hGrrjJOqQBqGTxiIRmP-HMz_OyE4C2Gqh15G38IMaMI';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function verifyUserPassword(user, password) {
  if (!user) return false;
  if (!user.password_hash || !user.password_salt) {
    let defaultPass = 'tech123';
    if (user.role === 'ADMIN') defaultPass = 'admin123';
    else if (user.role === 'MANAGER') defaultPass = 'manager123';
    else if (user.role === 'SUPERVISOR') defaultPass = 'supervisor123';
    else if (user.role === 'SALESMAN') defaultPass = 'sales123';
    return password === defaultPass;
  }
  const computedHash = hashPassword(password, user.password_salt);
  return computedHash === user.password_hash;
}

module.exports = {
  supabase,
  hashPassword,
  generateSalt,
  verifyUserPassword
};
