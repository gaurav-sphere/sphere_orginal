import { supabase } from '../lib/supabase'

/* ══════════════════════════════════════════════════════════════
   feedService.ts
   All DB operations use correct table/column names from schema.
   Toggle functions use upsert to prevent duplicate rows which
   caused double-counting when called more than once.
══════════════════════════════════════════════════════════════ */

export interface LivePost {
  id:             string
  body:           string
  content:        string
  category:       string
  is_anon:        boolean
  created_at:     string
  timestamp:      string
  likes_count:    number
  likes:          number
  forwards_count: number
  reposts:        number
  thoughts_count: number
  thoughts:       number
  images:         string[]
  is_forward:     boolean
  forward_of?:    string | null
  forward_comment?: string | null
  originalPost?:  LivePost | null
  city?:          string
  hashtags:       string[]
  user_id:        string
  comments_off:   boolean
  is_pinned:      boolean
  user: {
    id:           string
    name:         string
    username:     string
    anon_username:string
    avatar_url:   string
    avatar:       string
    is_verified:  boolean
    isVerified:   boolean
    is_org:       boolean
  }
  isLiked?:       boolean
  isReposted?:    boolean
  mediaItems?:    { type: 'image' | 'video'; url: string; width?: number; height?: number }[]
}

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

function mapPost(
  row: Record<string, unknown>,
  likedIds:   Set<string> = new Set(),
  forwardIds: Set<string> = new Set(),
): LivePost {
  const profile = (row.profiles as Record<string, unknown>) || {}
  const media   = (row.post_media as Record<string, unknown>[]) || []
  const avatarUrl = (profile.avatar_url as string)
    || `https://ui-avatars.com/api/?name=${encodeURIComponent((profile.name as string) || 'User')}&background=1D4ED8&color=fff&size=80`

  return {
    id:              row.id as string,
    body:            row.body as string,
    content:         row.body as string,
    category:        (row.category as string) || 'top',
    is_anon:         (row.is_anon as boolean) || false,
    created_at:      row.created_at as string,
    timestamp:       formatTime(row.created_at as string),
    likes_count:     (row.likes_count as number)    || 0,
    likes:           (row.likes_count as number)    || 0,
    forwards_count:  (row.forwards_count as number) || 0,
    reposts:         (row.forwards_count as number) || 0,
    thoughts_count:  (row.thoughts_count as number) || 0,
    thoughts:        (row.thoughts_count as number) || 0,
    images:          media.filter(m => m.media_type === 'image').map(m => m.url as string),
    is_forward:      (row.is_forward as boolean)    || false,
    forward_of:      (row.forward_of as string)     || null,
    forward_comment: (row.forward_comment as string)|| null,
    originalPost:    null,
    city:            row.city as string | undefined,
    hashtags:        (row.hashtags as string[])     || [],
    user_id:         row.user_id as string,
    comments_off:    (row.comments_off as boolean)  || false,
    is_pinned:       (row.is_pinned as boolean)     || false,
    isLiked:         likedIds.has(row.id as string),
    isReposted:      forwardIds.has(row.id as string),
    mediaItems:      media.map(m => ({
      type:   m.media_type as 'image' | 'video',
      url:    m.url    as string,
      width:  m.width  as number | undefined,
      height: m.height as number | undefined,
    })),
    user: {
      id:            profile.id as string,
      name:          (profile.name as string)              || 'Unknown',
      username:      `@${(profile.username as string)      || 'user'}`,
      anon_username: `@${(profile.anon_username as string) || 'anon'}`,
      avatar_url:    avatarUrl,
      avatar:        avatarUrl,
      is_verified:   (profile.is_verified as boolean)      || false,
      isVerified:    (profile.is_verified as boolean)      || false,
      is_org:        (profile.is_org as boolean)           || false,
    },
  }
}

const POST_SELECT = `
  id, body, category, is_anon, created_at,
  likes_count, forwards_count, thoughts_count,
  is_forward, forward_of, forward_comment,
  city, hashtags, user_id, comments_off, is_pinned,
  profiles!posts_user_id_fkey (
    id, name, username, anon_username, avatar_url, is_verified, is_org
  ),
  post_media (url, media_type, width, height, position)
`

async function fetchUserInteractions(userId?: string) {
  if (!userId) return { likedIds: new Set<string>(), forwardIds: new Set<string>() }
  const [likedRes, forwardRes] = await Promise.all([
    supabase.from('post_praises').select('post_id').eq('user_id', userId),
    supabase.from('post_forwards').select('post_id').eq('user_id', userId),
  ])
  return {
    likedIds:   new Set((likedRes.data  || []).map((r: any) => r.post_id as string)),
    forwardIds: new Set((forwardRes.data || []).map((r: any) => r.post_id as string)),
  }
}

async function hydrateOriginalPosts(posts: LivePost[]): Promise<LivePost[]> {
  const ids = posts.filter(p => p.is_forward && p.forward_of).map(p => p.forward_of as string)
  if (ids.length === 0) return posts
  const { data } = await supabase.from('posts').select(POST_SELECT).in('id', ids).is('deleted_at', null)
  if (!data) return posts
  const map: Record<string, LivePost> = {}
  data.forEach((row: any) => { map[row.id] = mapPost(row as Record<string, unknown>) })
  return posts.map(p => p.is_forward && p.forward_of && map[p.forward_of] ? { ...p, originalPost: map[p.forward_of] } : p)
}

/* ══════════════════════════════════════════════════════════════
   FETCH
══════════════════════════════════════════════════════════════ */
export async function fetchFeedPosts(
  category: string = 'top',
  page:     number = 0,
  pageSize: number = 15,
  userId?:  string
): Promise<LivePost[]> {
  const { likedIds, forwardIds } = await fetchUserInteractions(userId)
  let query = supabase.from('posts').select(POST_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  if (category !== 'top') query = query.eq('category', category)
  const { data, error } = await query
  if (error) { console.error('[feedService] fetchFeedPosts:', error); return [] }
  const posts = (data || []).map(row => mapPost(row as Record<string, unknown>, likedIds, forwardIds))
  return hydrateOriginalPosts(posts)
}

export async function fetchPostById(postId: string, userId?: string): Promise<LivePost | null> {
  const [postRes, { likedIds, forwardIds }] = await Promise.all([
    supabase.from('posts').select(POST_SELECT).eq('id', postId).is('deleted_at', null).single(),
    fetchUserInteractions(userId),
  ])
  if (postRes.error || !postRes.data) return null
  const post = mapPost(postRes.data as Record<string, unknown>, likedIds, forwardIds)
  const [hydrated] = await hydrateOriginalPosts([post])
  return hydrated
}

/* ══════════════════════════════════════════════════════════════
   THOUGHTS
══════════════════════════════════════════════════════════════ */
export interface LiveThought {
  id:         string; body: string; content: string
  is_anon:    boolean; created_at: string; timestamp: string
  likes_count:number;  likes: number; parent_id: string | null
  replies:    LiveThought[]
  user:       { id: string; name: string; username: string; avatar: string; isVerified: boolean }
  isLiked?:   boolean
}

export async function fetchThoughts(postId: string, userId?: string): Promise<LiveThought[]> {
  const { data, error } = await supabase
    .from('thoughts')
    .select(`id, body, is_anon, created_at, likes_count, parent_id, user_id,
      profiles!thoughts_user_id_fkey (id, name, username, avatar_url, is_verified)`)
    .eq('post_id', postId).is('deleted_at', null).order('created_at', { ascending: true })
  if (error) { console.error('[feedService] fetchThoughts:', error); return [] }

  let likedIds = new Set<string>()
  if (userId && data?.length) {
    const ids = data.map((r: any) => r.id)
    const { data: praised } = await supabase.from('thought_praises')
      .select('thought_id').eq('user_id', userId).in('thought_id', ids)
    likedIds = new Set((praised || []).map((r: any) => r.thought_id as string))
  }

  const mapT = (row: Record<string, unknown>): LiveThought => {
    const p   = (row.profiles as Record<string, unknown>) || {}
    const av  = (p.avatar_url as string)
      || `https://ui-avatars.com/api/?name=${encodeURIComponent((p.name as string) || 'User')}&background=1D4ED8&color=fff&size=80`
    return {
      id: row.id as string, body: row.body as string, content: row.body as string,
      is_anon: (row.is_anon as boolean) || false,
      created_at: row.created_at as string, timestamp: formatTime(row.created_at as string),
      likes_count: (row.likes_count as number) || 0, likes: (row.likes_count as number) || 0,
      parent_id: (row.parent_id as string) || null, replies: [],
      isLiked: likedIds.has(row.id as string),
      user: { id: p.id as string, name: (p.name as string) || 'Unknown',
        username: `@${(p.username as string) || 'user'}`, avatar: av,
        isVerified: (p.is_verified as boolean) || false },
    }
  }

  const all   = (data || []).map(r => mapT(r as Record<string, unknown>))
  const byId: Record<string, LiveThought> = {}
  all.forEach(t => { byId[t.id] = t })
  const top: LiveThought[] = []
  all.forEach(t => { if (t.parent_id && byId[t.parent_id]) byId[t.parent_id].replies.push(t); else top.push(t) })
  return top
}

/* ══════════════════════════════════════════════════════════════
   TOGGLE ACTIONS
   Using upsert with ignoreDuplicates to prevent double-counting.
   The DB trigger handles incrementing/decrementing likes_count.
   If no trigger exists, counts won't update — run sphere_triggers.sql.
══════════════════════════════════════════════════════════════ */

/* Praise a quote — table: post_praises (user_id, post_id) */
export async function togglePraise(
  postId: string, userId: string, currentlyLiked: boolean
): Promise<void> {
  if (currentlyLiked) {
    /* Remove praise */
    await supabase.from('post_praises').delete()
      .eq('user_id', userId).eq('post_id', postId)
  } else {
    /* Add praise — upsert prevents duplicate if called twice */
    await supabase.from('post_praises')
      .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
  }
}

/* Forward a quote — table: post_forwards (user_id, post_id) */
export async function toggleForward(
  postId: string, userId: string, currentlyForwarded: boolean
): Promise<void> {
  if (currentlyForwarded) {
    await supabase.from('post_forwards').delete()
      .eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('post_forwards')
      .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
  }
}

/* Bookmark — table: bookmarks (user_id, post_id) */
export async function toggleBookmark(
  postId: string, userId: string, currentlyBookmarked: boolean
): Promise<void> {
  if (currentlyBookmarked) {
    await supabase.from('bookmarks').delete()
      .eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('bookmarks')
      .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
  }
}

/* Add thought */
export async function addThought(
  postId: string, userId: string, body: string, parentId?: string
): Promise<LiveThought | null> {
  const { data, error } = await supabase.from('thoughts')
    .insert({ post_id: postId, user_id: userId, body, parent_id: parentId || null })
    .select(`id, body, is_anon, created_at, likes_count, parent_id, user_id,
      profiles!thoughts_user_id_fkey (id, name, username, avatar_url, is_verified)`)
    .single()
  if (error) { console.error('[feedService] addThought:', error); return null }
  const p = (data.profiles as Record<string, unknown>) || {}
  return {
    id: data.id, body: data.body, content: data.body,
    is_anon: data.is_anon || false,
    created_at: data.created_at, timestamp: 'just now',
    likes_count: 0, likes: 0,
    parent_id: data.parent_id || null, replies: [], isLiked: false,
    user: { id: p.id as string, name: (p.name as string) || 'You',
      username: `@${(p.username as string) || 'user'}`,
      avatar: (p.avatar_url as string) || '', isVerified: (p.is_verified as boolean) || false },
  }
}

/* Praise a thought — table: thought_praises (user_id, thought_id) */
export async function toggleThoughtPraise(
  thoughtId: string, userId: string, currentlyLiked: boolean
): Promise<void> {
  if (currentlyLiked) {
    await supabase.from('thought_praises').delete()
      .eq('user_id', userId).eq('thought_id', thoughtId)
  } else {
    await supabase.from('thought_praises')
      .upsert({ user_id: userId, thought_id: thoughtId }, { onConflict: 'user_id,thought_id', ignoreDuplicates: true })
  }
}

/* Delete quote (soft delete) */
export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId).eq('user_id', userId)
  if (error) console.error('[feedService] deletePost:', error)
  return !error
}

/* Block user — table: blocks (blocker_id, blocked_id) */
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await supabase.from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
  return !error
}

export async function fetchTrendingHashtags(limit = 10): Promise<{ tag: string; posts_count: number }[]> {
  const { data } = await supabase.rpc('get_trending_hashtags', { limit_n: limit })
  return data || []
}
