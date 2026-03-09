import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

/* ── Cookie helpers ────────────────────────────────────────────────────────── */
function setCookie(key: string, value: string, days: number) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${key}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`
}
function getCookie(key: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
function delCookie(key: string) {
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

/* ── Types ─────────────────────────────────────────────────────────────────── */
export interface GuestLocation { city: string; state: string; country: string; country_code: string; source: 'gps'|'ip'|'language'|'fallback' }
export interface InterestWeight  { tag: string; weight: number }

interface GuestContextValue {
  guestId:            string
  location:           GuestLocation | null
  interests:          InterestWeight[]
  visitCount:         number
  locationPermission: 'granted'|'denied'|'pending'|'skipped'
  cookieConsent:      'accepted'|'essential'|'pending'
  visitedPostIds:     string[]
  requestLocation:    () => Promise<void>
  skipLocation:       () => void
  trackEvent:         (event: GuestEvent) => void
  markPostSeen:       (id: string) => void
  acceptCookies:      () => void
  essentialCookies:   () => void
  clearGuestData:     () => void
  getTopInterests:    () => InterestWeight[]
}

interface GuestEvent {
  type: 'post_open'|'hashtag_click'|'category_select'|'post_scroll'|'quick_scroll'|'blocked_action'|'search'
  tag?: string
  category?: string
}

const INTEREST_CATEGORIES = ['technology','cricket','bollywood','science','politics','music','travel','food','gaming','finance','fitness','art','environment','education','fashion','sports','city','entertainment','world']
const SIGNAL_WEIGHTS: Record<GuestEvent['type'], number> = {
  hashtag_click: 0.9, post_open: 0.8, blocked_action: 0.6,
  category_select: 0.7, post_scroll: 0.5, search: 0.8,
  quick_scroll: -0.1,
}

/* ── Gradient helper — deterministic from text ── */
export function getStatusGradient(text: string): number {
  let sum = 0
  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i)
  return sum % 12
}

/* ── Context ────────────────────────────────────────────────────────────────── */
const GuestContext = createContext<GuestContextValue | null>(null)

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [guestId]            = useState(() => getCookie('sphere_guest_id') || crypto.randomUUID())
  const [location, setLocation] = useState<GuestLocation | null>(null)
  const [interests, setInterests] = useState<InterestWeight[]>([])
  const [visitCount, setVisitCount] = useState(1)
  const [locationPermission, setLocationPermission] = useState<GuestContextValue['locationPermission']>('pending')
  const [cookieConsent, setCookieConsent] = useState<GuestContextValue['cookieConsent']>('pending')
  const [visitedPostIds, setVisitedPostIds] = useState<string[]>([])

  /* init from cookies */
  useEffect(() => {
    const consent = getCookie('sphere_consent') as GuestContextValue['cookieConsent'] | null
    if (consent) setCookieConsent(consent)

    const perm = getCookie('sphere_location_permission') as GuestContextValue['locationPermission'] | null
    if (perm) setLocationPermission(perm)

    const loc = getCookie('sphere_location')
    if (loc) { try { setLocation(JSON.parse(loc)) } catch {} }

    const ints = getCookie('sphere_interests')
    if (ints) { try { setInterests(JSON.parse(ints)) } catch {} }

    const vc = parseInt(getCookie('sphere_visit_count') || '0', 10) + 1
    setVisitCount(vc)
    setCookie('sphere_visit_count', String(vc), 365)
    setCookie('sphere_guest_id', guestId, 365)
    if (!getCookie('sphere_first_visit')) setCookie('sphere_first_visit', new Date().toISOString(), 365)

    const seen = getCookie('sphere_visited_posts')
    if (seen) { try { setVisitedPostIds(JSON.parse(seen)) } catch {} }
  }, [guestId])

  /* request GPS location */
  const requestLocation = useCallback(async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: 3600000 })
      )
      // In production: POST to Edge Function /resolve-location
      // For now: store approximate location
      const loc: GuestLocation = { city: 'Your City', state: '', country: 'India', country_code: 'IN', source: 'gps' }
      setLocation(loc)
      setLocationPermission('granted')
      setCookie('sphere_location', JSON.stringify(loc), 30)
      setCookie('sphere_location_permission', 'granted', 365)
    } catch {
      // fallback to IP
      const loc: GuestLocation = { city: '', state: '', country: 'India', country_code: 'IN', source: 'ip' }
      setLocation(loc)
      setLocationPermission('denied')
      setCookie('sphere_location', JSON.stringify(loc), 30)
      setCookie('sphere_location_permission', 'denied', 365)
    }
  }, [])

  const skipLocation = useCallback(() => {
    setLocationPermission('skipped')
    setCookie('sphere_location_permission', 'skipped', 365)
  }, [])

  /* track interest signal */
  const trackEvent = useCallback((event: GuestEvent) => {
    const delta = SIGNAL_WEIGHTS[event.type] ?? 0
    if (delta === 0) return

    const tag = event.tag?.replace('#','').toLowerCase() || event.category?.toLowerCase() || ''
    if (!tag) return

    setInterests(prev => {
      const existing = prev.find(i => i.tag === tag)
      let updated: InterestWeight[]
      if (existing) {
        updated = prev.map(i => i.tag === tag
          ? { ...i, weight: Math.min(1.0, Math.max(0, i.weight + delta)) }
          : i
        )
      } else if (delta > 0) {
        updated = [...prev, { tag, weight: Math.min(1.0, delta) }]
      } else {
        return prev
      }
      // keep top 20, sort by weight
      const sorted = updated.sort((a,b) => b.weight - a.weight).slice(0, 20)
      setCookie('sphere_interests', JSON.stringify(sorted), 90)
      return sorted
    })
  }, [])

  const markPostSeen = useCallback((id: string) => {
    setVisitedPostIds(prev => {
      const next = [id, ...prev.filter(p => p !== id)].slice(0, 200)
      setCookie('sphere_visited_posts', JSON.stringify(next), 30)
      return next
    })
  }, [])

  const acceptCookies = useCallback(() => {
    setCookieConsent('accepted')
    setCookie('sphere_consent', 'accepted', 365)
  }, [])

  const essentialCookies = useCallback(() => {
    setCookieConsent('essential')
    setCookie('sphere_consent', 'essential', 365)
  }, [])

  const clearGuestData = useCallback(() => {
    ['sphere_guest_id','sphere_location','sphere_interests','sphere_visited_posts',
     'sphere_visit_count','sphere_consent','sphere_location_permission','sphere_lang',
     'sphere_first_visit','sphere_categories','sphere_hashtags'].forEach(delCookie)
    setLocation(null); setInterests([]); setVisitedPostIds([])
  }, [])

  const getTopInterests = useCallback(() =>
    interests.filter(i => i.weight >= 0.2).slice(0, 5), [interests])

  return (
    <GuestContext.Provider value={{
      guestId, location, interests, visitCount,
      locationPermission, cookieConsent, visitedPostIds,
      requestLocation, skipLocation, trackEvent,
      markPostSeen, acceptCookies, essentialCookies,
      clearGuestData, getTopInterests,
    }}>
      {children}
    </GuestContext.Provider>
  )
}

export function useGuest() {
  const ctx = useContext(GuestContext)
  if (!ctx) throw new Error('useGuest must be inside GuestProvider')
  return ctx
}
