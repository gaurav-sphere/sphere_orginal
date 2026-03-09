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
  is_verified: boolean
  is_private: boolean
  is_org: boolean
  org_verified?: boolean
  org_category?: string
  followers_count: number
  following_count: number
  posts_count: number
  anon_pin_set: boolean
  joined_at: string
}

interface AuthContextValue {
  user:        User | null
  session:     Session | null
  profile:     SphereProfile | null
  loading:     boolean
  isOrg:       boolean
  signIn:      (emailOrUsername: string, password: string) => Promise<{ error: Error | null }>
  signUp:      (data: SignUpData) => Promise<{ error: Error | null }>
  signOut:     () => Promise<void>
  refreshProfile: () => Promise<void>
}

interface SignUpData {
  email:        string
  password:     string
  name:         string
  username:     string
  anon_username?: string
  anon_pin?:    string
  gender?:      string
  dob?:         string
  is_org?:      boolean
  org_category?: string
  org_description?: string
}

/* ── Context ────────────────────────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<SphereProfile | null>(null)
  const [loading, setLoading] = useState(true)

  /* fetch profile from Supabase */
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data as SphereProfile)
  }, [])

  /* init — restore session */
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

  /* sign in — accepts email OR @username */
  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    let email = emailOrUsername
    // if it looks like a username (no @domain), resolve to email
    if (!emailOrUsername.includes('@') || emailOrUsername.startsWith('@')) {
      const handle = emailOrUsername.replace(/^@/, '')
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', handle)
        .single()
      if (!data) return { error: new Error('Username not found') }
      // we stored email in auth — get it via edge fn (for now use placeholder)
      email = emailOrUsername // fallback: let Supabase try
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ?? null }
  }, [])

  /* sign up */
  const signUp = useCallback(async (data: SignUpData) => {
    const { error } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        data: {
          name:             data.name,
          username:         data.username,
          anon_username:    data.anon_username ?? null,
          anon_pin:         data.anon_pin ?? null,  // handled server-side — hashed in DB trigger
          gender:           data.gender ?? null,
          dob:              data.dob ?? null,
          is_org:           data.is_org ?? false,
          org_category:     data.org_category ?? null,
          org_description:  data.org_description ?? null,
        },
      },
    })
    return { error: error ?? null }
  }, [])

  /* sign out */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      isOrg: profile?.is_org ?? false,
      signIn, signUp, signOut, refreshProfile,
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
