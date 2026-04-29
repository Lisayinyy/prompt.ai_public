-- ============================================================
-- v12.1: delete_user_fact RPC
-- 让用户能从 Memory Panel UI 上删除单条不准确的 fact
-- 用 RPC 而非裸 DELETE 是为了:
--   1) 单一 round-trip + 显式 boolean 返回
--   2) 未来加 audit log 时一处修改
--   3) RLS 已经保护了,这里再加一道 auth.uid() 校验
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_fact(p_fact_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.user_facts
  WHERE id = p_fact_id
    AND user_id = auth.uid();  -- 双保险:RLS + 显式校验

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_fact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_fact(uuid) TO authenticated;
