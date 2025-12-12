import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are available
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured. Auth and sync features will be disabled.');
    console.warn('📝 Create .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable.');
}

// Create client with dummy values if not configured to prevent crashes
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
        auth: {
            persistSession: isSupabaseConfigured,
            autoRefreshToken: isSupabaseConfigured,
            detectSessionInUrl: isSupabaseConfigured
        }
    }
);
