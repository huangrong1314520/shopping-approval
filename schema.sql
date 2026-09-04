-- 朋友购物审批站 - Supabase 数据库建表脚本（更新版）
-- 在 Supabase Dashboard → SQL Editor 中粘贴运行
-- ⚠️ 安全更新：只新增表，不删除已有表和数据

-- ===== 创建成员表 =====
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '🐱',
  is_applicant BOOLEAN DEFAULT TRUE,
  is_approver BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE,
  pin TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 创建申请表 =====
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_avatar TEXT,
  item TEXT NOT NULL,
  price NUMERIC NOT NULL,
  reason TEXT,
  link TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  votes JSONB DEFAULT '[]'::jsonb,
  approver_id TEXT,
  approver_name TEXT,
  approver_avatar TEXT,
  comment TEXT,
  image_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- 如果表已存在，补加 image_url 字段（不删除已有数据）
ALTER TABLE requests ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- ===== 创建收藏表（新增） =====
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 启用行级安全 =====
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- ===== 创建宽松访问策略（应用有自己的PIN认证） =====
CREATE POLICY IF NOT EXISTS "allow_all_members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_requests" ON requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_favorites" ON favorites FOR ALL USING (true) WITH CHECK (true);

-- ===== 启用实时订阅 =====
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
ALTER PUBLICATION supabase_realtime ADD TABLE favorites;

-- ===== 插入管理员 =====
INSERT INTO members (id, name, avatar, is_applicant, is_approver, is_admin, pin)
VALUES ('m1', '桔梗', '🌸', true, true, true, '1234')
ON CONFLICT (id) DO NOTHING;
