
-- markers 表添加公开/私密字段
ALTER TABLE public.markers
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- 点赞表
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  marker_id uuid NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, marker_id)
);

-- 收藏表
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  marker_id uuid NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, marker_id)
);

-- 启用 Realtime
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.favorites;

-- 点赞表 RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_all" ON public.likes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "likes_insert_own" ON public.likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own" ON public.likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 收藏表 RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_all" ON public.favorites
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "favorites_insert_own" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own" ON public.favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 创建头像存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- avatars 存储策略
CREATE POLICY "avatars_storage_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

CREATE POLICY "avatars_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
