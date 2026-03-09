import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Sphere] Supabase env vars not set — running in mock/demo mode')
}

export const supabase = createClient(
  supabaseUrl  || 'https://xhyizcnlsjzjjolqwoyt.supabase.co',
  
  supabaseKey  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeWl6Y25sc2p6ampvbHF3b3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU3MDQsImV4cCI6MjA4ODY0MTcwNH0.7DbBk7KZG63P47MnmXBxt1nRDrXgzWM7_yeM5bjEWvk',
  
  {
    auth: {
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: true,
    },
  }
)

export type SupabaseClient = typeof supabase
