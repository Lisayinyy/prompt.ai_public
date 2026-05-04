-- ============================================================
-- v33-β: 模板编辑 — 加 update_template RPC
-- 让模板真正可维护:改名 + 改 text + 自动重抽变量
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_template(
  p_template_id uuid,
  p_name text DEFAULT NULL,
  p_template_text text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_updated int;
  v_new_vars text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  -- 至少要更新一个字段
  IF p_name IS NULL AND p_template_text IS NULL THEN RETURN false; END IF;

  -- 校验长度
  IF p_name IS NOT NULL AND (char_length(p_name) < 1 OR char_length(p_name) > 100) THEN
    RAISE EXCEPTION 'Template name must be 1-100 chars';
  END IF;
  IF p_template_text IS NOT NULL AND (char_length(p_template_text) < 5 OR char_length(p_template_text) > 8000) THEN
    RAISE EXCEPTION 'Template text must be 5-8000 chars';
  END IF;

  -- 如果改了 text,自动重抽变量
  IF p_template_text IS NOT NULL THEN
    v_new_vars := public._extract_template_variables(p_template_text);
    UPDATE public.prompt_templates
    SET template_text = p_template_text,
        variables = v_new_vars,
        name = COALESCE(LEFT(p_name, 100), name),
        updated_at = now()
    WHERE id = p_template_id AND user_id = v_user_id;
  ELSE
    -- 只改名
    UPDATE public.prompt_templates
    SET name = LEFT(p_name, 100),
        updated_at = now()
    WHERE id = p_template_id AND user_id = v_user_id;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.update_template(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_template(uuid, text, text) TO authenticated;
