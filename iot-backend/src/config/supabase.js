const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

/**
 * Supabase Client Initialization
 * 
 * This client uses the service role key for admin operations.
 * Service role key bypasses RLS (Row Level Security) policies.
 * 
 * IMPORTANT: Only use this in backend/server-side code
 * NEVER expose service role key in frontend or mobile apps
 * 
 * For client-side: Use anon key with RLS enabled
 * For server-side: Use service role key (which we use here)
 */

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    // Don't persist auth session in backend
    persistSession: false,
    // Don't auto-refresh tokens
    autoRefreshToken: false,
  },
});

module.exports = { supabase };
