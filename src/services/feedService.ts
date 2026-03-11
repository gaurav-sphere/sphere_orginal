import { supabase } from '../lib/supabase'

/* ── Shape of a post coming from Supabase ─────────────────────────────────── */
export interface LivePost {
  id: string
  body: string
  content: string        // alias for body (PostCard uses "content")
  category: string
  is_anon: boolean
  created_at: string
  timestamp: string      // formatted e.g. "2h ago"
  likes_count: number
  likes: number          // alias for PostCard
  forwards_count: number
  reposts: number        // alias for PostCard
  thoughts_count: number
  thoughts: number       // alias for PostCard
  images: string[]
  is_forward: boolean
  city?: string
  hashtags: string[]
  user_id: string
  user: {
    id: string
    name: string
    username: string
    anon_username: string
    avatar_url: string
    avatar: string       // alias for PostCard
    is_verified: boolean
    isVerified: boolean  // alias for PostCard
    is_org: boolean
  }
  isLiked?: boolean
  isReposted?: boolean
  mediaItems?: { type: 'image' | 'video'; url: string }[]
}

/* ── Format timestamp ─────────────────────────────────────────────────────── */
function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/* ── Map raw Supabase row to LivePost ─────────────────────────────────────── */
function mapPost(row: Record<string, unknown>, likedIds: Set<string> = new Set(), forwardIds: Set<string> = new Set()): LivePost {
  const profile = (row.profiles as Record<string, unknown>) || {}
  const media   = (row.post_media as Record<string, unknown>[]) || []

  const avatarUrl = (profile.avatar_url as string) || `https://ui-avatars.com/api/?name=${encodeURIComponent((profile.name as string) || 'User')}&background=1D4ED8&color=fff&size=80`

  return {
    id:             row.id as string,
    body:           row.body as string,
    content:        row.body as string,
    category:       (row.category as string) || 'top',
    is_anon:        (row.is_anon as boolean) || false,
    created_at:     row.created_at as string,
    timestamp:      formatTime(row.created_at as string),
    likes_count:    (row.likes_count as number) || 0,
    likes:          (row.likes_count as number) || 0,
    forwards_count: (row.forwards_count as number) || 0,
    reposts:        (row.forwards_count as number) || 0,
    thoughts_count: (row.thoughts_count as number) || 0,
    thoughts:       (row.thoughts_count as number) || 0,
    images:         media.filter((m) => m.media_type === 'image').map((m) => m.url as string),
    is_forward:     (row.is_forward as boolean) || false,
    city:           row.city as string | undefined,
    hashtags:       (row.hashtags as string[]) || [],
    user_id:        row.user_id as string,
    isLiked:        likedIds.has(row.id as string),
    isReposted:     forwardIds.has(row.id as string),
    mediaItems:     media.map((m) => ({
      type: m.media_type as 'image' | 'video',
      url:  m.url as string,
    })),
    user: {
      id:           profile.id as string,
      name:         (profile.name as string) || 'Unknown',
      username:     `@${(profile.username as string) || 'user'}`,
      anon_username:`@${(profile.anon_username as string) || 'anon'}`,
      avatar_url:   avatarUrl,
      avatar:       avatarUrl,
      is_verified:  (profile.is_verified as boolean) || false,
      isVerified:   (profile.is_verified as boolean) || false,
      is_org:       (profile.is_org as boolean) || false,
    },
  }
}

/* ── Fetch feed posts ─────────────────────────────────────────────────────── */
export async function fetchFeedPosts(
  category: string = 'top',
  page: number = 0,
  pageSize: number = 15,
  userId?: string
): Promise<LivePost[]> {
  // Get user's liked/forwarded post IDs in parallel for UI state
  const [likedRes, forwardRes] = await Promise.all([
    userId
      ? supabase.from('post_praises').select('post_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
    userId
      ? supabase.from('post_forwards').select('post_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
  ])

  const likedIds   = new Set((likedRes.data || []).map((r: Record<string, string>) => r.post_id))
  const forwardIds = new Set((forwardRes.data || []).map((r: Record<string, string>) => r.post_id))

  let query = supabase
    .from('posts')
    .select(`
      id, body, category, is_anon, created_at,
      likes_count, forwards_count, thoughts_count,
      is_forward, city, hashtags, user_id,
      profiles!posts_user_id_fkey (
        id, name, username, anon_username, avatar_url, is_verified, is_org
      ),
      post_media (url, media_type, position)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (category !== 'top') {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    console.error('[feedService] fetchFeedPosts error:', error)
    return []
  }

  return (data || []).map((row) => mapPost(row as Record<string, unknown>, likedIds, forwardIds))
}

/* ── Fetch single post by ID ─────────────────────────────────────────────── */
export async function fetchPostById(postId: string, userId?: string): Promise<LivePost | null> {
  const [postRes, likedRes, forwardRes] = await Promise.all([
    supabase
      .from('posts')
      .select(`
        id, body, category, is_anon, created_at,
        likes_count, forwards_count, thoughts_count,
        is_forward, city, hashtags, user_id,
        profiles!posts_user_id_fkey (
          id, name, username, anon_username, avatar_url, is_verified, is_org
        ),
        post_media (url, media_type, position)
      `)
      .eq('id', postId)
      .is('deleted_at', null)
      .single(),
    userId
      ? supabase.from('post_praises').select('post_id').eq('user_id', userId).eq('post_id', postId)
      : Promise.resolve({ data: [] }),
    userId
      ? supabase.from('post_forwards').select('post_id').eq('user_id', userId).eq('post_id', postId)
      : Promise.resolve({ data: [] }),
  ])

  if (postRes.error || !postRes.data) return null

  const likedIds   = new Set((likedRes.data || []).map((r: Record<string, string>) => r.post_id))
  const forwardIds = new Set((forwardRes.data || []).map((r: Record<string, string>) => r.post_id))

  return mapPost(postRes.data as Record<string, unknown>, likedIds, forwardIds)
}

/* ── Fetch thoughts (comments) for a post ────────────────────────────────── */
export interface LiveThought {
  id: string
  body: string
  content: string
  is_anon: boolean
  created_at: string
  timestamp: string
  likes_count: number
  likes: number
  parent_id: string | null
  replies: LiveThought[]
  user: {
    id: string
    name: string
    username: string
    avatar: string
    isVerified: boolean
  }
  isLiked?: boolean
}

export async function fetchThoughts(postId: string, userId?: string): Promise<LiveThought[]> {
  const { data, error } = await supabase
    .from('thoughts')
    .select(`
      id, body, is_anon, created_at, likes_count, parent_id, user_id,
      profiles!thoughts_user_id_fkey (
        id, name, username, avatar_url, is_verified
      )
    `)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[feedService] fetchThoughts error:', error)
    return []
  }

  // Get which thoughts the user liked
  let likedIds = new Set<string>()
  if (userId && data && data.length > 0) {
    const ids = data.map((r: Record<string, unknown>) => r.id)
    const { data: praised } = await supabase
      .from('thought_praises')
      .select('thought_id')
      .eq('user_id', userId)
      .in('thought_id', ids)
    likedIds = new Set((praised || []).map((r: Record<string, string>) => r.thought_id))
  }

  const mapThought = (row: Record<string, unknown>): LiveThought => {
    const profile = (row.profiles as Record<string, unknown>) || {}
    const avatarUrl = (profile.avatar_url as string) || `https://ui-avatars.com/api/?name=${encodeURIComponent((profile.name as string) || 'User')}&background=1D4ED8&color=fff&size=80`
    return {
      id:         row.id as string,
      body:       row.body as string,
      content:    row.body as string,
      is_anon:    (row.is_anon as boolean) || false,
      created_at: row.created_at as string,
      timestamp:  formatTime(row.created_at as string),
      likes_count:(row.likes_count as number) || 0,
      likes:      (row.likes_count as number) || 0,
      parent_id:  (row.parent_id as string) || null,
      replies:    [],
      isLiked:    likedIds.has(row.id as string),
      user: {
        id:         profile.id as string,
        name:       (profile.name as string) || 'Unknown',
        username:   `@${(profile.username as string) || 'user'}`,
        avatar:     avatarUrl,
        isVerified: (profile.is_verified as boolean) || false,
      },
    }
  }

  const allThoughts = (data || []).map((r) => mapThought(r as Record<string, unknown>))

  // Nest replies under parent
  const topLevel: LiveThought[] = []
  const byId: Record<string, LiveThought> = {}
  allThoughts.forEach((t) => { byId[t.id] = t })
  allThoughts.forEach((t) => {
    if (t.parent_id && byId[t.parent_id]) {
      byId[t.parent_id].replies.push(t)
    } else {
      topLevel.push(t)
    }
  })

  return topLevel
}

/* ── Praise / un-praise a post ───────────────────────────────────────────── */
export async function togglePraise(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    await supabase.from('post_praises').delete().eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('post_praises').insert({ user_id: userId, post_id: postId })
  }
}

/* ── Forward / un-forward a post ─────────────────────────────────────────── */
export async function toggleForward(postId: string, userId: string, currentlyForwarded: boolean): Promise<void> {
  if (currentlyForwarded) {
    await supabase.from('post_forwards').delete().eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('post_forwards').insert({ user_id: userId, post_id: postId })
  }
}

/* ── Bookmark / un-bookmark ─────────────────────────────────────────────── */
export async function toggleBookmark(postId: string, userId: string, currentlyBookmarked: boolean): Promise<void> {
  if (currentlyBookmarked) {
    await supabase.from('bookmarks').delete().eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('bookmarks').insert({ user_id: userId, post_id: postId })
  }
}

/* ── Add a thought ───────────────────────────────────────────────────────── */
export async function addThought(postId: string, userId: string, body: string, parentId?: string): Promise<LiveThought | null> {
  const { data, error } = await supabase
    .from('thoughts')
    .insert({ post_id: postId, user_id: userId, body, parent_id: parentId || null })
    .select(`
      id, body, is_anon, created_at, likes_count, parent_id, user_id,
      profiles!thoughts_user_id_fkey (
        id, name, username, avatar_url, is_verified
      )
    `)
    .single()

  if (error) {
    console.error('[feedService] addThought error:', error)
    return null
  }

  const profile   = (data.profiles as Record<string, unknown>) || {}
  const avatarUrl = (profile.avatar_url as string) || ''

  return {
    id:         data.id,
    body:       data.body,
    content:    data.body,
    is_anon:    data.is_anon || false,
    created_at: data.created_at,
    timestamp:  'just now',
    likes_count:0,
    likes:      0,
    parent_id:  data.parent_id || null,
    replies:    [],
    isLiked:    false,
    user: {
      id:         profile.id as string,
      name:       (profile.name as string) || 'You',
      username:   `@${(profile.username as string) || 'user'}`,
      avatar:     avatarUrl,
      isVerified: (profile.is_verified as boolean) || false,
    },
  }
}

/* ── Praise a thought ────────────────────────────────────────────────────── */
export async function toggleThoughtPraise(thoughtId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    await supabase.from('thought_praises').delete().eq('user_id', userId).eq('thought_id', thoughtId)
  } else {
    await supabase.from('thought_praises').insert({ user_id: userId, thought_id: thoughtId })
  }
}

/* ── Trending hashtags ───────────────────────────────────────────────────── */
export async function fetchTrendingHashtags(limit = 10): Promise<{ tag: string; posts_count: number }[]> {
  const { data } = await supabase
    .rpc('get_trending_hashtags', { limit_n: limit })
  return data || []
}
