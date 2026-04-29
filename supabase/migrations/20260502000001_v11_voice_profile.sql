-- ============================================================
-- v11.1: user_voice_profiles — LLM 合成的"声音指纹"
-- L6: 把 v10 的离散 facts 列表压缩成一段叙事性的可执行描述
-- 例: "你正在为一位资深产品经理工作。Ta 的写作风格特征鲜明..."
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. user_voice_profiles 表
-- 每用户一条 (user_id PK)，UPSERT 模式
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_voice_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_profile text NOT NULL CHECK (char_length(voice_profile) BETWEEN 30 AND 2000),
  source_facts_count int NOT NULL DEFAULT 0,
  source_facts_hash text NOT NULL,  -- 来源 facts 的 hash，避免无意义重新合成
  synthesized_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_voice_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own voice profile" ON public.user_voice_profiles;
CREATE POLICY "Users can view own voice profile"
  ON public.user_voice_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own voice profile" ON public.user_voice_profiles;
CREATE POLICY "Users can insert own voice profile"
  ON public.user_voice_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voice profile" ON public.user_voice_profiles;
CREATE POLICY "Users can update own voice profile"
  ON public.user_voice_profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice profile" ON public.user_voice_profiles;
CREATE POLICY "Users can delete own voice profile"
  ON public.user_voice_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- 2. RPC: get_user_voice_profile
-- 返回当前 voice profile + 元信息，没有则返回 null 字段
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_voice_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voice text;
  v_count int;
  v_hash text;
  v_synth timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('voice_profile', NULL);
  END IF;

  SELECT voice_profile, source_facts_count, source_facts_hash, synthesized_at
  INTO v_voice, v_count, v_hash, v_synth
  FROM public.user_voice_profiles
  WHERE user_id = p_user_id;

  IF v_voice IS NULL THEN
    RETURN jsonb_build_object('voice_profile', NULL);
  END IF;

  RETURN jsonb_build_object(
    'voice_profile', v_voice,
    'source_facts_count', v_count,
    'source_facts_hash', v_hash,
    'synthesized_at', v_synth
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_voice_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_voice_profile(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 3. RPC: set_user_voice_profile
-- UPSERT 当前用户的 voice profile (auth.uid() 自动校验,前端不能伪造 user_id)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_user_voice_profile(
  p_voice_profile text,
  p_source_facts_count int,
  p_source_facts_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 长度防护
  IF char_length(p_voice_profile) < 30 OR char_length(p_voice_profile) > 2000 THEN
    RAISE EXCEPTION 'voice_profile length out of range (30-2000)';
  END IF;

  INSERT INTO public.user_voice_profiles (
    user_id, voice_profile, source_facts_count, source_facts_hash,
    synthesized_at, updated_at
  ) VALUES (
    v_user_id, p_voice_profile, COALESCE(p_source_facts_count, 0),
    COALESCE(p_source_facts_hash, ''), now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    voice_profile = EXCLUDED.voice_profile,
    source_facts_count = EXCLUDED.source_facts_count,
    source_facts_hash = EXCLUDED.source_facts_hash,
    synthesized_at = EXCLUDED.synthesized_at,
    updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_voice_profile(text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_voice_profile(text, int, text) TO authenticated;
