-- ============================================================
-- 002: 点検報告PDFのメール送信機能 追加マイグレーション
-- 実行先: Supabase（SQL Editor で実行）
-- 作成日: 2026-06-08
-- ============================================================

-- staff_master: レポートメールの CC 対象フラグ
--   true にすると、点検報告PDFのメール送信時に常にCCへ入る（宛先Toは各現場の作業所長）。
ALTER TABLE staff_master
  ADD COLUMN IF NOT EXISTS report_cc boolean DEFAULT false;

-- inspections: レポートメール送信日時
--   送信が完了した時刻を記録（フロントの「送信済み／再送信」表示に使用）。
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS report_sent_at timestamptz;
