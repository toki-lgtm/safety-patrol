# 📧 点検報告PDF メール送信機能 セットアップ手順

**作成日**: 2026-06-08
**対象**: 安全パトロール月次点検アプリ

点検報告PDFを、現場の**作業所長へメール送信**する機能を追加しました。
**CC** には社員管理で「レポートCC対象」に設定した社員が自動で入ります。

---

## 🔧 あなたの作業（3ステップ）

### ① Supabase に列を追加（SQL実行）

Supabase 管理画面 → SQL Editor で、以下を実行してください。
（ファイル: `migrations/002_add_report_email.sql` と同内容）

```sql
ALTER TABLE staff_master
  ADD COLUMN IF NOT EXISTS report_cc boolean DEFAULT false;

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS report_sent_at timestamptz;
```

### ② Render（portal-api）に環境変数を設定

Render のダッシュボード → portal-api サービス → **Environment** に以下を追加：

| キー | 値 |
|---|---|
| `SMTP_HOST` | `nakahara131.co.jp` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `system_noreply@nakahara131.co.jp` |
| `SMTP_PASS` | （`system_noreply` アカウントのパスワード） |
| `MAIL_FROM` | `system_noreply@nakahara131.co.jp` |
| `MAIL_FROM_NAME` | `中原建設社内システム` |

> ⚠️ `SMTP_PASS` はコードや Git には絶対に保存しないでください。Render の環境変数にのみ入力します。

### ③ デプロイ

```bash
# バックエンド（portal-api）
cd D:\01.claude code\04.アプリ\04.portal-api
git add -A
git commit -m "feat: 点検報告PDFのメール送信機能（作業所長宛・CC社員フラグ）"
git push origin main   # → Render が自動デプロイ

# フロントエンド（安全パトロール）
cd D:\01.claude code\04.アプリ\01.安全パトロール
git add -A
git commit -m "feat: メール送信ボタン・社員CCフラグUI追加"
git push origin main   # → Vercel が自動デプロイ
```

---

## ✅ 使い方・動作確認

1. **社員管理 → 👤社員** で、CCに入れたい社員を編集し「📧 レポートメールのCCに追加」にチェック → 保存
2. 各**現場マスタ**に「作業所長（manager）」が設定され、その社員にメールアドレスが登録されていることを確認
3. 点検の **PDFを生成**（既存どおり）
4. **点検一覧** または **点検詳細** に表示される「📧 メール送信」ボタンを押す
5. 確認ダイアログ → OK で送信。送信後は宛先・CCがダイアログ表示され、「📧 再送信」に変わります

---

## 📋 仕様まとめ

| 項目 | 内容 |
|---|---|
| 宛先(To) | 点検の作業所長（`manager_id` の社員メール） |
| CC | 社員管理で `report_cc = true` の社員全員 |
| 送信元 | `system_noreply@nakahara131.co.jp`（中原建設社内システム） |
| 添付 | 保存済み点検報告PDF |
| 件名 | `【安全パトロール点検報告】○○現場 YYYY/MM/DD` |
| 本文 | 作業所長宛の定型文＋点検概要（点検日・現場・指摘件数） |
| 送信権限 | 管理者 または 担当検査官（PDF発行と同条件） |
| ボタン表示 | PDF生成・保存済みの点検のみ |
| 再送信 | 可能（送信日時を更新） |

### 送信できないケース（エラー表示）
- PDFが未生成 → 「先にPDFを生成・保存してください」
- 作業所長が未設定 → 「この点検に作業所長が設定されていません」
- 作業所長のメール未登録 → 「作業所長のメールアドレスが未登録です。社員管理で登録してください。」

---

## 🛠 トラブルシュート

- **送信できない/認証エラー**: `SMTP_USER` がメールアドレス全体（`system_noreply@nakahara131.co.jp`）か、`SMTP_PASS` が正しいか確認。
- **接続できない**: bizmw の送信ポートは `587`。社内設定が「暗号化なし」のため、コードは STARTTLS を必須にしていません（対応時のみ使用）。
- **CCが入らない**: 対象社員の「📧 レポートCC対象」チェックと**メールアドレス登録**を確認。
- **メールが届かない**: 迷惑メールフォルダ、および作業所長のメールアドレスのスペル誤りを確認。

---

## 🔩 変更ファイル

**バックエンド**（`04.portal-api`）
- `server.js`: nodemailer 追加、SMTP初期化、`POST /api/inspections/:id/send-report`、スタッフAPIに `report_cc`
- `package.json`: `nodemailer` 依存追加
- `.env.example`: SMTP変数の見本追記

**フロントエンド**（`01.安全パトロール/app/frontend`）
- `pages/MastersPage.jsx`: 社員のCCフラグ（チェックボックス・一覧バッジ）
- `pages/DashboardPage.jsx`: メール送信ハンドラ
- `components/InspectionList.jsx`: 一覧に「📧 メール送信」ボタン
- `components/InspectionDetail.jsx`: 詳細に「📧 メール送信」ボタン・送信日時表示

**DB**
- `migrations/002_add_report_email.sql`
