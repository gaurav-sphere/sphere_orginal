import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface SphereProfile {
  id: string
  username: string
  anon_username: string
  name: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  location?: string
  website_url?: string
  website_label?: string
  gender?: string
  dob?: string
  language?: string[]
  email?: string
  is_verified: boolean
  is_private: boolean
  is_org: boolean
  org_verified?: boolean
  org_category?: string
  org_website?: string
  org_description?: string
  followers_count: number
  following_count: number
  posts_count: number
  anon_pin_set: boolean
  joined_at: string
  updated_at?: string
}

interface AuthContextValue {
  user:            User | null
  session:         Session | null
  profile:         SphereProfile | null
  loading:         boolean
  isOrg:           boolean
  signIn:          (emailOrUsername: string, password: string) => Promise<{ error: Error | null }>
  signUp:          (data: SignUpData) => Promise<{ error: Error | null }>
  signOut:         () => Promise<void>
  refreshProfile:  () => Promise<void>
  saveLanguages:   (langs: string[]) => Promise<void>
  unlockAccount:   (username: string, email: string) => Promise<{ ok: boolean; requiresAdmin: boolean }>
}

export interface SignUpData {
  email:             string
  password:          string
  name:              string
  username:          string
  anon_username?:    string
  anon_pin?:         string
  gender?:           string
  dob?:              string
  language?:         string[]
  country?:          string
  phone?:            string | null
  location?:         string
  interests?:        string[]
  is_org?:           boolean
  org_category?:     string
  org_description?:  string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<SphereProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (data) setProfile(data as SphereProfile)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  /* ══════════════════════════════════════════════════════════════
     SIGN IN
     — supports email or username
     — enforces lockout: 5 failures → 24h lock, 3× → permanent
  ══════════════════════════════════════════════════════════════ */
  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    const input   = emailOrUsername.trim()
    const isEmail = input.includes('@') && !input.startsWith('@') && input.indexOf('@') > 0
    const handle  = input.replace(/^@/, '') // case-sensitive — no toLowerCase

    // 1. Look up profile (always needed for lockout tracking)
    let profileRow: { id: string; email: string } | null = null

    if (isEmail) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', input.toLowerCase())
        .maybeSingle()
      profileRow = data
    } else {
      // Block anon username login first
      const { data: anonCheck } = await supabase
        .from('profiles').select('id').eq('anon_username', handle).maybeSingle()
      if (anonCheck) {
        return { error: new Error('Anonymous username cannot be used for login. Please use your regular username.') }
      }
      const { data } = await supabase
        .from('profiles').select('id, email').eq('username', handle).maybeSingle()
      profileRow = data
    }

    if (!profileRow) {
      return { error: new Error('No account found. Check your email or username and try again.') }
    }

    // 2. Check lockout status
    const { data: attempt, error: attemptErr } = await supabase
      .from('login_attempts').select('*').eq('profile_id', profileRow.id).maybeSingle()

    // If table doesn't exist yet (SQL not run), attemptErr will be set — degrade gracefully
    const trackingAvailable = !attemptErr

    if (trackingAvailable) {
      if (attempt?.permanently_locked) {
        return { error: new Error('PERMANENTLY_LOCKED') }
      }

      if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
        const minsLeft = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60000)
        const hrsLeft  = Math.ceil(minsLeft / 60)
        return { error: new Error(`LOCKED:${hrsLeft}`) }
      }

      // If a previous 24h lock has expired, reset failed_count but keep lockout_days
      if (attempt?.locked_until && new Date(attempt.locked_until) <= new Date()) {
        await supabase
          .from('login_attempts')
          .update({ failed_count: 0, locked_until: null })
          .eq('profile_id', profileRow.id)
        // Also reset in local variable so counter starts from 0
        if (attempt) attempt.failed_count = 0
      }
    }

    // 3. Attempt auth
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profileRow.email,
      password,
    })

    if (!authError) {
      // Success — reset counter
      if (trackingAvailable) {
        if (attempt) {
          // Row exists — update it
          await supabase.from('login_attempts')
            .update({ failed_count: 0, locked_until: null, last_attempt: new Date().toISOString() })
            .eq('profile_id', profileRow.id)
        } else {
          // No row yet — insert a fresh one
          await supabase.from('login_attempts').insert({
            profile_id: profileRow.id, failed_count: 0,
            lockout_days: 0, permanently_locked: false,
            requires_admin: false, last_attempt: new Date().toISOString(),
          })
        }
      }
      return { error: null }
    }

    // 4. Wrong password — record + maybe lock
    if (!trackingAvailable) {
      // Tracking table not set up — just return generic wrong password
      return { error: new Error('Incorrect password. Please try again.') }
    }

    const prevCount = attempt?.failed_count ?? 0
    const prevDays  = attempt?.lockout_days ?? 0
    const newCount  = prevCount + 1

    const payload = {
      profile_id:         profileRow.id,
      failed_count:       newCount,
      lockout_days:       prevDays,
      locked_until:       null as string | null,
      permanently_locked: false,
      requires_admin:     false,
      last_attempt:       new Date().toISOString(),
    }

    if (newCount >= 5) {
      const newDays           = prevDays + 1
      payload.locked_until    = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      payload.lockout_days    = newDays
      payload.permanently_locked = newDays >= 3
    }

    // Use INSERT on first failure, UPDATE on subsequent (avoids upsert conflict resolution issues)
    if (attempt) {
      await supabase.from('login_attempts').update(payload).eq('profile_id', profileRow.id)
    } else {
      await supabase.from('login_attempts').insert(payload)
    }

    if (payload.permanently_locked) return { error: new Error('PERMANENTLY_LOCKED') }
    if (payload.locked_until)       return { error: new Error('LOCKED:24') }

    const remaining = 5 - newCount
    return { error: new Error(`WRONG_PASSWORD:${remaining}`) }
  }, [])

  /* ══════════════════════════════════════════════════════════════
     SELF-SERVICE ACCOUNT UNLOCK
     — user provides username + email
     — if both match: clear lock
     — if mismatch: set requires_admin = true
  ══════════════════════════════════════════════════════════════ */
  const unlockAccount = useCallback(async (username: string, email: string) => {
    const u = username.trim().toLowerCase().replace(/^@/, '')
    const e = email.trim().toLowerCase()

    // Find profile matching both username AND email exactly
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('username', u)
      .eq('email', e)
      .maybeSingle()

    if (!profile) {
      // Mismatch — mark as needs admin
      const { data: attemptRow } = await supabase
        .from('login_attempts')
        .select('id, profile_id')
        .eq('profile_id',
          // try to find by username alone to mark it
          (await supabase.from('profiles').select('id').eq('username', u).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
        )
        .maybeSingle()

      if (attemptRow) {
        await supabase
          .from('login_attempts')
          .update({ requires_admin: true })
          .eq('profile_id', attemptRow.profile_id)
      }
      return { ok: false, requiresAdmin: true }
    }

    // Match — clear the lock
    await supabase
      .from('login_attempts')
      .update({
        failed_count:       0,
        locked_until:       null,
        permanently_locked: false,
        requires_admin:     false,
        last_attempt:       new Date().toISOString(),
      })
      .eq('profile_id', profile.id)

    return { ok: true, requiresAdmin: false }
  }, [])

  /* ══════════════════════════════════════════════════════════════
     SIGN UP
     — Option B: 1 account per email — hard block if email exists
  ══════════════════════════════════════════════════════════════ */
  const signUp = useCallback(async (data: SignUpData) => {
    const cleanEmail    = data.email.trim().toLowerCase()
    const cleanUsername = data.username.trim().toLowerCase().replace(/^@/, '')
    const now           = new Date().toISOString()

    // Pre-check: block if email already in profiles (Option B)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existing) {
      return { error: new Error('EMAIL_TAKEN') }
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    cleanEmail,
      password: data.password,
      options: {
        data: {
          name:             data.name.trim(),
          username:         cleanUsername,
          anon_username:    data.anon_username?.trim() ?? null,
          gender:           data.gender ?? null,
          dob:              data.dob ?? null,
          language:         data.language ?? ['en'],
          is_org:           data.is_org ?? false,
          email:            cleanEmail,
          country:          data.country ?? null,
          phone:            data.phone ?? null,
          location:         data.location ?? null,
          interests:        data.interests || [],
          org_category:     data.org_category ?? null,
          org_description:  data.org_description ?? null,
        },
      },
    })

    if (authError) {
      // Supabase already registered = email exists in Auth but not profiles
      if (authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already been registered')) {
        return { error: new Error('EMAIL_TAKEN') }
      }
      return { error: authError }
    }

    const userId = authData?.user?.id
    if (!userId) {
      // Email confirmation required — profile will be created by trigger
      return { error: null }
    }

    // 2. Upsert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id:               userId,
        name:             data.name.trim(),
        username:         cleanUsername,
        anon_username:    data.anon_username?.trim() ?? `anon_${cleanUsername.slice(0, 8)}`,
        email:            cleanEmail,
        gender:           data.gender ?? null,
        dob:              data.dob ?? null,
        language:         data.language ?? ['en'],
        country:          data.country ?? null,
        phone:            data.phone ?? null,
        location:         data.location ?? null,
        interests:        data.interests || [],
        is_verified:      false,
        is_private:       false,
        is_org:           data.is_org ?? false,
        org_category:     data.org_category ?? null,
        org_description:  data.org_description ?? null,
        followers_count:  0,
        following_count:  0,
        posts_count:      0,
        anon_pin_set:     false,
        joined_at:        now,
        updated_at:       now,
      }, { onConflict: 'id' })

    if (profileError) {
      console.warn('[Sphere] Profile upsert warning:', profileError.message)
      await supabase
        .from('profiles')
        .update({
          name:         data.name.trim(),
          email:        cleanEmail,
          gender:       data.gender ?? null,
          dob:          data.dob ?? null,
          language:     data.language ?? ['en'],
          country:      data.country ?? null,
          phone:        data.phone ?? null,
          location:     data.location ?? null,
          interests:    data.interests || [],
          updated_at:   now,
        })
        .eq('id', userId)
    }

    // 3. Set anon PIN via Edge Function (optional)
    if (data.anon_pin && authData?.session) {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-anon-pin`
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`,
          },
          body: JSON.stringify({ pin: data.anon_pin }),
        })
      } catch {
        console.warn('[Sphere] Could not set anon PIN — can be set later in Settings.')
      }
    }

    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  const saveLanguages = useCallback(async (langs: string[]) => {
    if (!user?.id) return
    await supabase
      .from('profiles')
      .update({ language: langs, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    await fetchProfile(user.id)
  }, [user, fetchProfile])

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      isOrg: profile?.is_org ?? false,
      signIn, signUp, signOut, refreshProfile, saveLanguages, unlockAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
