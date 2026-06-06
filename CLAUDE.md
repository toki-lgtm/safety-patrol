# 🛡️ 安全パトロール月次点検アプリ - 進捗メモ

**作成日**: 2026年6月6日  
**状態**: 開発中（基本構造完成、機能実装中）

---

## 📊 プロジェクト状況

### ✅ 実装完了

#### フロントエンド（React + Vite）
- **ポータル認証統合**: ポータルから user パラメータでユーザー情報を自動引き継ぎ
- **ダッシュボード**: タブナビゲーション（点検一覧 / 新規点検）
- **マスター管理画面**: 現場・スタッフ・対象区分の CRUD
  - 追加、編集、削除機能実装
  - テーブル形式での一覧表示

#### バックエンド（Node.js Express）
- **ポータル API** (`portal-api-hhlx.onrender.com`)
- **エンドポイント**:
  - `/api/inspections` - 点検 CRUD
  - `/api/masters/projects` - 現場マスタ CRUD
  - `/api/masters/staff` - スタッフマスタ CRUD
  - `/api/masters/inspection-items` - 対象区分 CRUD
  - `/api/auth/google` - Google OAuth
  - `/api/apps` - アプリリスト

#### デプロイ
- **フロントエンド**: Vercel (`https://safety-patrol-nine.vercel.app`)
- **バックエンド API**: Render (`https://portal-api-hhlx.onrender.com`)
- **ポータル**: Vercel (`https://portal-app-beryl.vercel.app`)

---

## ❌ 残りのタスク

### 🎯 優先度 1: Supabase セットアップ

**必要な SQL を実行**:

```sql
-- スタッフマスタ
CREATE TABLE IF NOT EXISTS staff_master (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 現場マスタ
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  manager_id TEXT REFERENCES staff_master(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 対象区分マスタ
CREATE TABLE IF NOT EXISTS inspection_master (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 安全点検（メイン）
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id TEXT NOT NULL UNIQUE,
  project_id TEXT REFERENCES projects(id),
  inspector_id TEXT REFERENCES staff_master(id),
  inspection_date DATE NOT NULL,
  categories TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  comments TEXT,
  report_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 安全点検詳細
CREATE TABLE IF NOT EXISTS inspection_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES inspection_master(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  result TEXT NOT NULL, -- '合' or '不合'
  issue_content TEXT,
  issue_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_inspections_project_id ON inspections(project_id);
CREATE INDEX idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX idx_inspections_inspection_date ON inspections(inspection_date);
CREATE INDEX idx_inspection_details_inspection_id ON inspection_details(inspection_id);
```

### 🎯 優先度 2: マスターデータ投入

Excel ファイルから以下をインポート:
- **職員マスタ** (S001～S007)
- **現場マスタ** (P001～P009)
- **対象区分マスタ** (M001～M014+)
- **コメント対策マスタ** (C0001～C0014+)

**参照ファイル**:
- Google Sheets: https://docs.google.com/spreadsheets/d/1JxH3_iO0ZRpcLES9MByfIpdl_zIKoGb_q6CJ_i8GeWc/edit?pli=1
- Excel: `D:\01.claude code\04.アプリ\01.安全パトロール\安全点検 (1).xlsx`

### 🎯 優先度 3: UI/UX 改善

- [ ] 点検フォームを AppSheet 版に合わせる
  - ドロップダウン（現場、検査員、作業形態）
  - 複数選択チェック（対象区分）
  - コメント入力
- [ ] 詳細ビュー実装（タブ形式）
  - 点検項目タブ
  - 評価タブ
  - 指摘内容タブ
  - 指摘写真タブ
- [ ] 指摘内容・写真アップロード機能

### 🎯 優先度 4: 追加機能

- [ ] PDF エクスポート
- [ ] メール通知（承認申請時）
- [ ] 承認ワークフロー UI

---

## 🔧 ファイル構成

```
D:\01.claude code\04.アプリ\01.安全パトロール\
├── app/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.jsx (マスター管理画面への切り替え実装)
│   │   │   ├── main.jsx
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.jsx (点検管理)
│   │   │   │   ├── MastersPage.jsx (マスター管理)
│   │   │   │   └── LoginPage.jsx (削除済み - ポータル認証使用)
│   │   │   ├── components/
│   │   │   │   ├── InspectionForm.jsx
│   │   │   │   └── InspectionList.jsx
│   │   │   └── index.css
│   │   ├── .env.production (API_URL ハードコード)
│   │   └── vite.config.js (port: 5174)
│   └── backend/ (削除予定 - ポータル API に統一)
├── migrations/
│   └── 001_create_tables.sql
└── 安全点検 (1).xlsx (マスターデータソース)
```

---

## 🚀 デプロイ方法

```bash
# 安全パトロール アプリ
cd D:\01.claude code\04.アプリ\01.安全パトロール
git add -A
git commit -m "feat: 説明"
git push origin main
# → Vercel 自動デプロイ

# ポータル API
cd D:\01.claude code\04.アプリ\04.portal-api
git add -A
git commit -m "feat: 説明"
git push origin main
# → Render 自動デプロイ
```

---

## 📌 重要な設定

### API URL
- **本番**: `https://portal-api-hhlx.onrender.com`
- **開発**: `http://localhost:3000`
- **設定場所**: DashboardPage.jsx / MastersPage.jsx の `getApiUrl()` 関数

### 環境変数（Vercel）
```
VITE_API_URL=https://portal-api-hhlx.onrender.com
VITE_PORTAL_URL=https://portal-app-beryl.vercel.app
```

---

## 🔍 次のステップ

1. **Supabase SQL を実行** ← 最優先
2. マスターデータを投入
3. `https://safety-patrol-nine.vercel.app/` の⚙️マスター管理でテスト
4. フロントエンド UI を AppSheet 仕様に合わせる
5. 本番テスト

---

## 📚 参考リンク

- **AppSheet テンプレート**: https://www.appsheet.com/template/AppDef?appName=%E5%AE%89%E5%85%A8%E7%82%B9%E6%A4%9C-590742690
- **Google Sheets**: https://docs.google.com/spreadsheets/d/1JxH3_iO0ZRpcLES9MByfIpdl_zIKoGb_q6CJ_i8GeWc/
- **Supabase**: https://app.supabase.com

---

**最終更新**: 2026年6月6日 15:50
**ステータス**: ✅ 基本機能完成 → 🔄 データベース連携中
