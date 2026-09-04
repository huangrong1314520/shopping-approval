-- 朋友购物审批站 - 旧数据状态校正
-- 在 Supabase Dashboard → SQL Editor 中粘贴运行
-- 按多数决规则重新计算所有记录的状态

-- 修复逻辑：通过人数 > 驳回人数 = approved，驳回人数 > 通过人数 = rejected，相等 = pending
UPDATE requests
SET status = sub.new_status,
    decided_at = CASE
        WHEN sub.new_status = 'pending' THEN NULL
        WHEN decided_at IS NULL THEN NOW()
        ELSE decided_at
    END
FROM (
    SELECT
        r.id,
        r.status as old_status,
        CASE
            WHEN (
                SELECT COUNT(*) FROM jsonb_array_elements(r.votes) AS v
                WHERE v->>'decision' = 'approved'
            ) > (
                SELECT COUNT(*) FROM jsonb_array_elements(r.votes) AS v
                WHERE v->>'decision' = 'rejected'
            ) THEN 'approved'
            WHEN (
                SELECT COUNT(*) FROM jsonb_array_elements(r.votes) AS v
                WHERE v->>'decision' = 'rejected'
            ) > (
                SELECT COUNT(*) FROM jsonb_array_elements(r.votes) AS v
                WHERE v->>'decision' = 'approved'
            ) THEN 'rejected'
            ELSE 'pending'
        END as new_status
    FROM requests r
    WHERE r.votes IS NOT NULL AND jsonb_array_length(r.votes) > 0
) AS sub
WHERE requests.id = sub.id
  AND requests.status != sub.new_status;
