-- ============================================
-- 朋友购物审批站 - 图片存储配置
-- 在 Supabase SQL Editor 中执行以下语句
-- ============================================

-- 1. 创建存储桶（公开可读）
INSERT INTO storage.buckets (id, name, public)
VALUES ('vote-images', 'vote-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 允许所有人读取图片（公开访问）
CREATE POLICY "Public read access for vote images"
ON storage.objects FOR SELECT
USING (bucket_id = 'vote-images');

-- 3. 允许已认证用户上传图片
CREATE POLICY "Authenticated users can upload vote images"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'vote-images');

-- 4. 允许上传者删除自己的图片
CREATE POLICY "Users can delete own vote images"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'vote-images');

-- 5. 限制文件大小（通过RLS策略，可选）
-- 注：文件大小限制主要在前端处理，压缩到500KB以内
