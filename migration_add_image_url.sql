-- 朋友购物审批站 - 申请图片字段迁移
-- 在 Supabase Dashboard → SQL Editor 中粘贴运行
-- 给 requests 表增加 image_url 字段，用于存储申请时上传的图片

ALTER TABLE requests ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
