# 安全パトロール 点検データ アーカイバ

クラウド(Supabase)のストレージ容量を節約するため、**一定期間より古い点検の写真・PDF を
共有ドライブ(G:)へ移動し、クラウドから削除**する仕組みです。点検記録（日付・現場・指摘内容など）は
アプリに残るので、過去の点検も一覧・検索できます。

## 動作概要

- **対象**: 点検日が **6ヶ月**より古い点検（`archive_inspections.py` の `RETENTION_MONTHS` で変更可）
- **削除するもの**: 写真・PDF（容量を食うファイル）だけ
- **残すもの**: 点検記録そのもの（アプリ上は「アーカイブ済み（ドライブ保存）」表示）
- **保存先**: `G:\共有ドライブ\社内システム\01.アプリ\01.安全点検\アーカイブ\{年}\{点検日_現場_点検ID}\`
  - `report.pdf`（あれば） / `写真\…` / `record.json`（記録の完全コピー）
  - 一覧台帳: `…\01.安全点検\アーカイブ\_アーカイブ台帳.csv`

## 安全設計

- **コピー＆サイズ検証に成功した後でのみクラウドを削除**します（先に消すことはしません）
- 既にアーカイブ済みのものはスキップ（何度実行しても安全）
- `--dry-run` で「何が対象か」だけ確認できます（コピー・削除なし）
- 1件ずつ処理し、失敗した点検は一切削除しません

## セットアップ（初回のみ）

1. PowerShell で次を実行（フォルダ作成＋月次タスク登録）:
   ```powershell
   cd "D:\01.claude code\04.アプリ\01.安全パトロール\archiver"
   .\setup_scheduled_task.ps1
   ```
2. **サービスロールキーを1回だけ配置**（このファイルだけ手動）:
   - 保存先: `C:\ProgramData\SafetyPatrolArchiver\service_role_key.txt`
   - 値: Supabase ダッシュボード → Project Settings → API → **service_role** キー
     （Render の環境変数 `SUPABASE_SERVICE_ROLE_KEY` と同じ値）
   - ※ このキーは管理者権限相当。リポジトリ外(ProgramData)に置き、共有しないこと。

これで **毎月1日 19:00** に自動実行されます（PCが起動しG:が同期されている状態で動作）。

## 手動操作

```powershell
# 対象の確認だけ（削除しない）
python "D:\01.claude code\04.アプリ\01.安全パトロール\archiver\archive_inspections.py" --dry-run

# 今すぐ実行
schtasks /Run /TN "SafetyPatrol Archive"

# 期間を一時変更して実行（例: 3ヶ月より古い）
python "…\archive_inspections.py" --months 3
```

## ログ

- `C:\ProgramData\SafetyPatrolArchiver\logs\archive_YYYY-MM.log`
