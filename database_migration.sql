-- =====================================================
-- 朋友购物审批站 - 数据库加固脚本
-- 使用方法：在 Supabase Dashboard → SQL Editor 中执行
-- =====================================================

-- 1. 为 requests 表添加 version 字段（乐观锁，防止投票冲突丢票）
--    已有数据默认 version = 0
ALTER TABLE requests ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0 NOT NULL;

-- 2. 成员昵称唯一索引（防止重名注册）
CREATE UNIQUE INDEX IF NOT EXISTS members_name_idx ON members (name);

-- 3. 常用查询索引（提升性能）
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status);
CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);
CREATE INDEX IF NOT EXISTS requests_applicant_id_idx ON requests (applicant_id);
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_request_id_idx ON favorites (request_id);

-- 4. 价格必须为正数
ALTER TABLE requests ADD CONSTRAINT check_price_positive CHECK (price >= 0);

-- 5. 状态值约束
ALTER TABLE requests ADD CONSTRAINT check_status_valid CHECK (status IN ('pending', 'approved', 'rejected'));

-- 6. PIN 码长度约束（4位数字）
ALTER TABLE members ADD CONSTRAINT check_pin_format CHECK (char_length(pin) = 4 AND pin ~ '^[0-9]{4}$');

-- 7. 昵称长度约束
ALTER TABLE members ADD CONSTRAINT check_name_length CHECK (char_length(name) BETWEEN 1 AND 10);

-- =====================================================
-- 可选：开启 RLS（行级安全）更严格的保护
-- 注意：开启后需要配置策略，否则前端会无法读写数据
-- 建议暂时不要开启，等熟悉了 Supabase RLS 再说
-- =====================================================
-- ALTER TABLE members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 验证：执行以下查询确认约束已生效
-- =====================================================
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'members'::regclass;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'requests'::regclass;
-- SELECT indexname FROM pg_indexes WHERE tablename = 'members';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'requests';
