-- ============================================================
-- v33-η: 清除示例数据 RPC
-- 配套 v32-B 的"加载示例数据" — 一键删干净
-- 仅删 source='demo' 的 prompts + 名称含"示例"的 projects/templates
-- ============================================================

CREATE OR REPLACE FUNCTION public.clear_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_prompts_deleted int := 0;
  v_projects_deleted int := 0;
  v_templates_deleted int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- 1) 删 demo prompts (source = 'demo')
  WITH del AS (
    DELETE FROM public.prompts
    WHERE user_id = v_user_id AND source = 'demo'
    RETURNING 1
  )
  SELECT count(*)::int INTO v_prompts_deleted FROM del;

  -- 2) 删名称以"示例"开头的项目 (cascade 会删 prompts 关联,但已经删过)
  WITH del AS (
    DELETE FROM public.projects
    WHERE user_id = v_user_id AND name LIKE '示例%'
    RETURNING 1
  )
  SELECT count(*)::int INTO v_projects_deleted FROM del;

  -- 3) 删名称以"示例"开头的模板
  WITH del AS (
    DELETE FROM public.prompt_templates
    WHERE user_id = v_user_id AND name LIKE '示例%'
    RETURNING 1
  )
  SELECT count(*)::int INTO v_templates_deleted FROM del;

  RETURN jsonb_build_object(
    'ok', true,
    'prompts_deleted', v_prompts_deleted,
    'projects_deleted', v_projects_deleted,
    'templates_deleted', v_templates_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clear_demo_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_demo_data() TO authenticated;
