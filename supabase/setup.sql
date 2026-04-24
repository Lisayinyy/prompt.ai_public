-- ============================================================
-- prompt.ai 数据库初始化
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 用户资料表（扩展 Supabase Auth 的用户信息）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Prompt 优化历史表
CREATE TABLE public.prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  optimized_text TEXT,
  diagnosis TEXT,
  platform TEXT,              -- 用户在哪个 AI 网站（chatgpt/kimi/claude...）
  task_type TEXT,              -- 任务类型（coding/writing/analysis...）
  tone TEXT,                   -- 语气（专业/日常/学术...）
  score_clarity INTEGER,       -- 清晰度评分
  score_specificity INTEGER,   -- 具体性评分
  score_structure INTEGER,     -- 结构性评分
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 索引（加速查询）
CREATE INDEX idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX idx_prompts_created_at ON public.prompts(created_at DESC);
CREATE INDEX idx_prompts_task_type ON public.prompts(task_type);

-- 4. 启用行级安全策略（RLS）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略：用户只能看自己的数据
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own prompts"
  ON public.prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON public.prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts"
  ON public.prompts FOR DELETE
  USING (auth.uid() = user_id);

-- 6. 自动创建 profile（用户注册时触发）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Waitlist 表（Landing Page 收集等待名单邮箱）
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'hero',   -- 来源区域（hero / cta）
  lang TEXT DEFAULT 'en',       -- 语言（en / zh）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);

-- 启用 RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 允许任何人插入（landing page 访客，无需登录）
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- 只有 service_role 可以查询（保护用户邮箱隐私）
CREATE POLICY "Service role can view waitlist"
  ON public.waitlist FOR SELECT
  TO service_role
  USING (true);
