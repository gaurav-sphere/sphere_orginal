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

/* ─── Edge Function helpers ───────────────────────────────────────────────── */

/** Verify user's anonymous PIN against server-side bcrypt hash.
 *  Returns { success, locked, attempts_left }
 */
export async function verifyAnonPin(pin: string): Promise<{
  success: boolean
  locked: boolean
  attempts_left: number
  message?: string
}> {
  const session = await supabase.auth.getSession()
  const token   = session.data.session?.access_token

  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${supabaseUrl}/functions/v1/verify-anon-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ pin }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'PIN verification failed')
  }

  return res.json()
}

/** Set or change anon PIN */
export async function setAnonPin(pin: string, currentPin?: string): Promise<void> {
  const session = await supabase.auth.getSession()
  const token   = session.data.session?.access_token

  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${supabaseUrl}/functions/v1/set-anon-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ pin, current_pin: currentPin }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to set PIN')
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
