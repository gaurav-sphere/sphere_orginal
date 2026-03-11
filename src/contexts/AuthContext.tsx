import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

/* ── Types ─────────────────────────────────────────────────────────────────── */
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
  is_org?:           boolean
  org_category?:     string
  org_description?:  string
}

/* ── Context ────────────────────────────────────────────────────────────────── */
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
      .single()
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
      else { setProfile(null) }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  /* ── SIGN IN — accepts email OR username (with or without @) ── */
  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    const input = emailOrUsername.trim()

    // If it's clearly an email (has @ not at start), use directly
    const isEmail = input.includes('@') && !input.startsWith('@') && input.indexOf('@') > 0

    if (isEmail) {
      const { error } = await supabase.auth.signInWithPassword({ email: input, password })
      return { error: error ?? null }
    }

    // It's a username — strip leading @ and look up the email from profiles
    const handle = input.replace(/^@/, '').toLowerCase()

    // profiles table stores email (added in trigger)
    const { data: profileRow, error: lookupErr } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', handle)
      .maybeSingle()

    if (lookupErr || !profileRow) {
      return { error: new Error('No account found with that username. Please check and try again.') }
    }

    // Get the email from auth.users via our edge function workaround
    // Since we can't directly query auth.users, we try signing in with a stored email
    // The email is embedded in user metadata during signup
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', profileRow.id)
      .single()

    if (!userData) {
      return { error: new Error('Account not found. Please try logging in with your email.') }
    }

    // Use Supabase's get user by ID to find email — via admin API (only available server-side)
    // Workaround: we stored email in profile metadata during signup
    // Try direct sign-in with the username as identifier (will fail, so we need the email lookup)
    // The REAL fix: store email in profiles table (added in SQL fix below)
    const { data: emailRow } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', profileRow.id)
      .maybeSingle()

    const emailToUse = (emailRow as { email?: string } | null)?.email

    if (!emailToUse) {
      return {
        error: new Error(
          'Username login requires your email to be stored. Please log in with your email address instead.'
        ),
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password })
    return { error: error ?? null }
  }, [])

  /* ── SIGN UP — saves ALL fields including gender, dob, language, anon_pin ── */
  const signUp = useCallback(async (data: SignUpData) => {
    const cleanEmail    = data.email.trim().toLowerCase()
    const cleanUsername = data.username.trim().toLowerCase().replace(/^@/, '')

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
          org_category:     data.org_category ?? null,
          org_description:  data.org_description ?? null,
          email:            cleanEmail,        // stored so username login works
        },
      },
    })

    if (authError) return { error: authError }

    // 2. Directly upsert profile with ALL fields (belt + suspenders approach)
    //    The DB trigger may not capture all fields — this ensures they're saved
    if (authData.user) {
      const now = new Date().toISOString()
      await supabase.from('profiles').upsert({
        id:               authData.user.id,
        name:             data.name.trim(),
        username:         cleanUsername,
        anon_username:    data.anon_username?.trim() ?? `anon_${cleanUsername}`,
        gender:           data.gender ?? null,
        dob:              data.dob ?? null,
        language:         data.language ?? ['en'],
        email:            cleanEmail,
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
    }

    // 3. Set anon PIN via Edge Function (if provided and session available)
    if (data.anon_pin && authData.session) {
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
        // Non-fatal — user can set PIN later from Settings > Anon PIN
        console.warn('[Sphere] Could not set anon PIN during signup — user can set it later.')
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

  /* Save language preferences to profile */
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
      signIn, signUp, signOut, refreshProfile, saveLanguages,
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
