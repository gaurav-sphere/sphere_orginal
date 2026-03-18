import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Sphere] Supabase env vars not set — running in demo mode')
}

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseKey  || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken:    true,
      persistSession:      true,
      detectSessionInUrl:  true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

export type SupabaseClient = typeof supabase

/* ─── Storage helpers ─────────────────────────────────────────────────────── */

/** Upload a file to a Supabase storage bucket.
 *  Returns the public URL on success, throws on error.
 */
export async function uploadFile(
  bucket: 'avatars' | 'banners' | 'posts' | 'stories',
  userId: string,
  file: File,
  fileName?: string
): Promise<string> {
  const ext  = file.name.split('.').pop()
  const name = fileName ?? `${Date.now()}.${ext}`
  const path = `${userId}/${name}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Delete a file from storage */
export async function deleteFile(
  bucket: 'avatars' | 'banners' | 'posts' | 'stories',
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

/* ─── Anon PIN helpers (via Postgres RPC — no edge functions needed) ────── */
/*
  IMPORTANT: These functions now use Postgres RPC functions defined in
  SPHERE_FIXES.sql. Run that file in Supabase SQL Editor first.

  Previously used edge functions (/functions/v1/set-anon-pin and
  /functions/v1/verify-anon-pin) which caused "Failed to fetch" errors
  when not deployed. RPC functions run inside the DB — always available.
*/

/**
 * Verify user's anonymous PIN.
 * Uses Postgres RPC function `verify_anon_pin` with bcrypt via pgcrypto.
 * Returns { success, locked, attempts_left, message? }
 */
export async function verifyAnonPin(pin: string): Promise<{
  success: boolean
  locked: boolean
  attempts_left: number
  message?: string
}> {
  const { data, error } = await supabase.rpc('verify_anon_pin', {
    input_pin: pin,
  })

  if (error) {
    console.error('[verifyAnonPin] RPC error:', error)
    throw new Error(error.message || 'PIN verification failed')
  }

  // data is already the jsonb object returned by the function
  return data as { success: boolean; locked: boolean; attempts_left: number; message?: string }
}

/**
 * Set or change anon PIN.
 * Uses Postgres RPC function `set_anon_pin` with bcrypt via pgcrypto.
 * - First time: call setAnonPin(newPin)
 * - Change:     call setAnonPin(newPin, currentPin)
 */
export async function setAnonPin(pin: string, currentPin?: string): Promise<void> {
  const { data, error } = await supabase.rpc('set_anon_pin', {
    new_pin:     pin,
    current_pin: currentPin ?? null,
  })

  if (error) {
    console.error('[setAnonPin] RPC error:', error)
    throw new Error(error.message || 'Failed to set PIN')
  }

  // The RPC returns { success: bool, error?: string }
  const result = data as { success: boolean; error?: string }
  if (!result.success) {
    throw new Error(result.error || 'Failed to set PIN')
  }
}

/* ─── Realtime subscription helpers ──────────────────────────────────────── */

/** Subscribe to new messages in a conversation */
export function subscribeToMessages(
  conversationId: string,
  callback: (message: Record<string, unknown>) => void
) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe()
}

/** Subscribe to new notifications for the current user */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Record<string, unknown>) => void
) {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe()
}
