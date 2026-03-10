-- ═══════════════════════════════════════════════════════════════
-- SPHERE FIX v3 — Run in Supabase SQL Editor
-- Fixes: hashtag insert crash, trending function return type
-- ═══════════════════════════════════════════════════════════════

-- 1. Add hashtags column if it doesn't exist
alter table public.posts
  add column if not exists hashtags text[] default '{}';

-- 2. Fix trending hashtags function (drop first to avoid return type conflict)
drop function if exists public.get_trending_hashtags(integer);
drop function if exists public.get_trending_hashtags(int);

create function public.get_trending_hashtags(limit_n int default 10)
returns table (tag text, posts_count bigint)
language sql stable as $$
  select
    unnest(hashtags)::text as tag,
    count(*)::bigint       as posts_count
  from public.posts
  where
    deleted_at is null
    and hashtags is not null
    and array_length(hashtags, 1) > 0
  group by 1
  order by 2 desc
  limit limit_n;
$$;

-- 3. Also ensure other commonly missing columns
alter table public.posts
  add column if not exists deleted_at  timestamptz,
  add column if not exists city        text,
  add column if not exists is_forward  boolean default false,
  add column if not exists likes_count    int default 0,
  add column if not exists forwards_count int default 0,
  add column if not exists thoughts_count int default 0,
  add column if not exists is_anon     boolean default false;

alter table public.profiles
  add column if not exists gender      text,
  add column if not exists dob         date,
  add column if not exists bio         text,
  add column if not exists location    text,
  add column if not exists website_url  text,
  add column if not exists website_label text,
  add column if not exists banner_url  text,
  add column if not exists is_verified boolean default false,
  add column if not exists is_private  boolean default false,
  add column if not exists is_org      boolean default false,
  add column if not exists followers_count int default 0,
  add column if not exists following_count int default 0,
  add column if not exists posts_count    int default 0,
  add column if not exists anon_pin_set   boolean default false;

select 'All fixes applied ✅' as status;
