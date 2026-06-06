
-- 用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 扩展 profiles 表（如果已存在则修改，如果不存在则创建）
-- 先创建 profiles 表
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  role public.user_role DEFAULT 'user',
  openid text,
  username text,
  avatar_url text,
  nickname text,
  created_at timestamptz DEFAULT now()
);

-- 同步新用户触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, role, openid, username, avatar_url, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    'user'::public.user_role,
    (NEW.raw_user_meta_data->>'openid')::text,
    (NEW.raw_user_meta_data->>'username')::text,
    (NEW.raw_user_meta_data->>'avatar_url')::text,
    (NEW.raw_user_meta_data->>'nickname')::text
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    openid = EXCLUDED.openid,
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    nickname = EXCLUDED.nickname;
  RETURN NEW;
END;
$$;

-- 创建触发器（如果不存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 标记点表
CREATE TABLE IF NOT EXISTS public.markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 标记点照片表
CREATE TABLE IF NOT EXISTS public.marker_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id uuid NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 标记点关联表（故事线）
CREATE TABLE IF NOT EXISTS public.marker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_marker_id uuid NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  to_marker_id uuid NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_marker_id, to_marker_id)
);

-- 创建存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('marker-photos', 'marker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 启用 Realtime
alter publication supabase_realtime add table public.markers;
alter publication supabase_realtime add table public.marker_photos;
alter publication supabase_realtime add table public.marker_connections;

-- RLS 启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_connections ENABLE ROW LEVEL SECURITY;

-- profiles 策略
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 公开读取 profiles 的 nickname 和 avatar_url
CREATE VIEW public.public_profiles AS
  SELECT id, nickname, avatar_url, username FROM public.profiles;

-- markers 策略：所有人可读，创建者可写
CREATE POLICY "markers_select_all" ON public.markers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "markers_insert_own" ON public.markers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "markers_update_own" ON public.markers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "markers_delete_own" ON public.markers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- marker_photos 策略：所有人可读，关联marker的创建者可写
CREATE POLICY "marker_photos_select_all" ON public.marker_photos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "marker_photos_insert_own" ON public.marker_photos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.markers WHERE id = marker_id AND user_id = auth.uid())
  );

CREATE POLICY "marker_photos_delete_own" ON public.marker_photos
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.markers WHERE id = marker_id AND user_id = auth.uid())
  );

-- marker_connections 策略：所有人可读，from_marker的创建者可写
CREATE POLICY "marker_connections_select_all" ON public.marker_connections
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "marker_connections_insert_own" ON public.marker_connections
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.markers WHERE id = from_marker_id AND user_id = auth.uid())
  );

CREATE POLICY "marker_connections_delete_own" ON public.marker_connections
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.markers WHERE id = from_marker_id AND user_id = auth.uid())
  );

-- storage 策略
CREATE POLICY "marker_photos_storage_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'marker-photos');

CREATE POLICY "marker_photos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marker-photos');
