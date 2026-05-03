-- ============================================================
-- v25.1: Projects — 跨 AI 平台 prompt 项目组织
-- 让用户能把散落在 22 平台的 prompt 按"项目"归类
-- 类比: Notion 的 workspace / project
-- ============================================================

-- 1. projects 表
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  color text CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_idx ON public.projects (user_id, updated_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- 2. prompt_projects 关联表 (一个 prompt 一个项目;直接给 prompts 加 project_id 列也行,
--    用关联表是为了将来能扩展成多对多 / tagging)
ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prompts_project_idx ON public.prompts (project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prompts_user_unassigned_idx ON public.prompts (user_id, created_at DESC) WHERE project_id IS NULL;

-- ───────────────────────────────────────────────────────────
-- 3. RPC: create_project(name, description?, color?) → uuid
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_project(
  p_name text,
  p_description text DEFAULT NULL,
  p_color text DEFAULT NULL
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

  INSERT INTO public.projects (user_id, name, description, color)
  VALUES (v_user_id, p_name, NULLIF(p_description, ''), NULLIF(p_color, ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project(text, text, text) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 4. RPC: list_user_projects(user_id)
--    返回项目列表 + 每个项目的 prompt count / last_activity / top platforms
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_user_projects(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  color text,
  created_at timestamptz,
  updated_at timestamptz,
  prompt_count bigint,
  last_activity timestamptz,
  top_platforms text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.color,
    p.created_at,
    p.updated_at,
    COALESCE(stats.cnt, 0) AS prompt_count,
    stats.last_activity,
    stats.top_platforms
  FROM public.projects p
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::bigint AS cnt,
      MAX(pr.created_at) AS last_activity,
      ARRAY(
        SELECT pr2.platform FROM public.prompts pr2
        WHERE pr2.project_id = p.id AND pr2.platform IS NOT NULL
        GROUP BY pr2.platform ORDER BY COUNT(*) DESC LIMIT 3
      ) AS top_platforms
    FROM public.prompts pr WHERE pr.project_id = p.id
  ) stats ON true
  WHERE p.user_id = p_user_id
  ORDER BY COALESCE(stats.last_activity, p.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_user_projects(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_projects(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 5. RPC: assign_prompt_to_project(prompt_id, project_id?)
--    project_id NULL 表示移出 (变成"未归类")
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_prompt_to_project(
  p_prompt_id uuid,
  p_project_id uuid DEFAULT NULL
)
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

  -- 校验 project 也属于该用户 (防越权)
  IF p_project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Project not found or not owned';
    END IF;
  END IF;

  UPDATE public.prompts SET project_id = p_project_id
  WHERE id = p_prompt_id AND user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 触发 project 的 updated_at 更新 (作为 last_modified)
  IF p_project_id IS NOT NULL THEN
    UPDATE public.projects SET updated_at = now() WHERE id = p_project_id;
  END IF;

  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_prompt_to_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_prompt_to_project(uuid, uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 6. RPC: delete_project(project_id)
--    只删项目本身,prompts 的 project_id 通过 ON DELETE SET NULL 自动变 null
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_project(p_project_id uuid)
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

  DELETE FROM public.projects WHERE id = p_project_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 7. RPC: get_project_prompts(project_id, limit?)
--    返回项目下所有 prompts (按时间倒序)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_project_prompts(
  p_project_id uuid,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  original_text text,
  optimized_text text,
  platform text,
  task_type text,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- 校验 project 属于本人
  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = v_user_id
  ) THEN
    RETURN;
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 100; END IF;
  IF p_limit > 200 THEN p_limit := 200; END IF;

  RETURN QUERY
  SELECT
    p.id, p.original_text, p.optimized_text, p.platform,
    p.task_type, p.source, p.created_at
  FROM public.prompts p
  WHERE p.project_id = p_project_id AND p.user_id = v_user_id
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_prompts(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_prompts(uuid, int) TO authenticated;
