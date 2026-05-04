-- ============================================================
-- v30: Prompt Templates — 把好用的 prompt 存成模板,未来一键复用
-- 自动检测 {{var}} 占位符,使用模板时填空即得最终 prompt
-- ============================================================

-- 1. prompt_templates 表
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  template_text text NOT NULL CHECK (char_length(template_text) BETWEEN 5 AND 8000),
  variables text[] NOT NULL DEFAULT '{}',
  source_prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  use_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prompt_templates_user_idx
  ON public.prompt_templates (user_id, use_count DESC, updated_at DESC);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates" ON public.prompt_templates;
CREATE POLICY "Users can view own templates" ON public.prompt_templates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own templates" ON public.prompt_templates;
CREATE POLICY "Users can insert own templates" ON public.prompt_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own templates" ON public.prompt_templates;
CREATE POLICY "Users can update own templates" ON public.prompt_templates FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own templates" ON public.prompt_templates;
CREATE POLICY "Users can delete own templates" ON public.prompt_templates FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- 辅助函数: 从 template_text 提取所有 {{var}} 占位符
-- 返回唯一变量名数组
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._extract_template_variables(p_text text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_matches text[];
BEGIN
  SELECT array_agg(DISTINCT m[1])
  INTO v_matches
  FROM regexp_matches(COALESCE(p_text, ''), '\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}', 'g') AS m;
  RETURN COALESCE(v_matches, '{}');
END;
$$;

-- ───────────────────────────────────────────────────────────
-- RPC: save_prompt_as_template
-- 从已有 prompt 创建模板 (优先用 optimized_text,fallback original_text)
-- 自动提取 {{var}} 变量
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_prompt_as_template(
  p_prompt_id uuid,
  p_name text,
  p_use_optimized boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_text text;
  v_template_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  -- 拿 prompt 内容 (校验 ownership)
  SELECT
    CASE WHEN p_use_optimized AND p.optimized_text IS NOT NULL THEN p.optimized_text
    ELSE p.original_text END
  INTO v_text
  FROM public.prompts p
  WHERE p.id = p_prompt_id AND p.user_id = v_user_id;

  IF v_text IS NULL THEN
    RAISE EXCEPTION 'Prompt not found or no text';
  END IF;

  INSERT INTO public.prompt_templates (
    user_id, name, template_text, variables, source_prompt_id
  ) VALUES (
    v_user_id,
    LEFT(p_name, 100),
    v_text,
    public._extract_template_variables(v_text),
    p_prompt_id
  )
  RETURNING id INTO v_template_id;

  RETURN v_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_prompt_as_template(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_prompt_as_template(uuid, text, boolean) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- RPC: save_template_direct (从输入文本直接建模板,不依赖某条 prompt)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_template_direct(
  p_name text,
  p_template_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.prompt_templates (
    user_id, name, template_text, variables
  ) VALUES (
    v_user_id,
    LEFT(p_name, 100),
    p_template_text,
    public._extract_template_variables(p_template_text)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_template_direct(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_template_direct(text, text) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- RPC: list_user_templates
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_user_templates(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  template_text text,
  variables text[],
  use_count int,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RETURN; END IF;

  RETURN QUERY
  SELECT t.id, t.name, t.template_text, t.variables, t.use_count, t.created_at, t.updated_at
  FROM public.prompt_templates t
  WHERE t.user_id = p_user_id
  ORDER BY t.use_count DESC, t.updated_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_user_templates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_templates(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- RPC: increment_template_use
-- 用户使用一次模板时调用,use_count++ + updated_at = now()
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_template_use(p_template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_updated int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  UPDATE public.prompt_templates
  SET use_count = use_count + 1, updated_at = now()
  WHERE id = p_template_id AND user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_template_use(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_template_use(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- RPC: delete_template
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_template(p_template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_deleted int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  DELETE FROM public.prompt_templates WHERE id = p_template_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_template(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_template(uuid) TO authenticated;
