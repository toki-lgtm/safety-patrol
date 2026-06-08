-- ============================================================
-- 003: 指摘是正フロー（是正写真アップロード → 検査官承認）
-- 実行先: Supabase（SQL Editor で実行）
-- 作成日: 2026-06-08
-- 前提: inspection_details は作成済み（portal-api 003_inspection_flow.sql）
-- ============================================================

-- 指摘項目ごとの是正状態。
--   correction_status: 良の項目は NULL。指摘ありは pending→submitted→approved（または rejected）。
--     pending   = 是正待ち（作業所長の対応待ち）
--     submitted = 是正写真提出済み・検査官の承認待ち
--     approved  = 承認済み（クローズ）
--     rejected  = 差し戻し（再対応依頼）→ 再提出で submitted へ
ALTER TABLE inspection_details
  ADD COLUMN IF NOT EXISTS correction_status      TEXT,
  ADD COLUMN IF NOT EXISTS correction_image_urls  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS correction_comment     TEXT,
  ADD COLUMN IF NOT EXISTS corrected_at           TIMESTAMP,
  ADD COLUMN IF NOT EXISTS corrected_by           TEXT,
  ADD COLUMN IF NOT EXISTS approved_at            TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by            TEXT,
  ADD COLUMN IF NOT EXISTS reject_reason          TEXT;

-- 既存の「指摘あり」項目を「是正待ち(pending)」に初期化（良の項目は NULL のまま）
UPDATE inspection_details
   SET correction_status = 'pending'
 WHERE result = '指摘あり'
   AND correction_status IS NULL;

-- 是正状況での絞り込み用インデックス
CREATE INDEX IF NOT EXISTS idx_inspection_details_correction_status
  ON inspection_details(correction_status);
