# ポータルアプリ - Claude Code ガイド

## プロジェクト概要
- **名称**: 社内ポータル
- **企業**: 中原建設
- **従業員数**: 約50人
- **スタック**: React（Vite）+ Node.js + Supabase
- **目的**: 各種社内アプリケーションへのアクセスをまとめたポータル

## ディレクトリ構成
```
./app
  ├── frontend/     React + Vite + Tailwind
  ├── backend/      Node.js（Express）
  └── migrations/   SQL スキーマ（将来）
./render.yaml      Render デプロイ設定
./README.md        セットアップガイド
```

## セットアップ
```bash
# バックエンド
cd app/backend
npm install
cp .env.example .env  # Supabase 認証情報を設定
npm run dev

# フロントエンド（別ターミナル）
cd ../frontend
npm install
cp .env.example .env  # Google OAuth 認証情報を設定
npm run dev
```

## あなたの指示方法

以下のように指示してください：
- 「ダッシュボードに〜機能を追加して」
- 「Google OAuth 認証を実装して」
- 「ユーザー管理画面を追加して」
- 「〜アプリのリンクを追加して」

技術的な細部は Claude が判断します。

## Claude の自動実行範囲

✅ ファイル編集・作成  
✅ コンポーネント実装  
✅ API エンドポイント追加  
✅ 認証ロジック実装  
✅ バグ修正  
✅ デプロイ設定

## 重要な設計原則

1. **バグの隔離**
   - 各アプリが独立している
   - ポータルのバグが他のアプリに波及しない

2. **複数アプリ間の連携**
   - ポータルのユーザー情報を各アプリが参照
   - API 経由で疎結合

3. **Google Workspace の活用**
   - OAuth は Google Workspace アカウントで統一
   - ユーザー管理も Workspace 連携（将来）

## 完成度チェック

機能実装後、以下を確認：
- ✅ ローカル（npm run dev）で動作確認
- ✅ バグなし
- ✅ UI/UX が直感的

## デプロイフロー

```
ローカル開発
    ↓
GitHub push
    ↓
Render（バックエンド）自動デプロイ
    ↓
Vercel（フロントエンド）自動デプロイ
    ↓
本番環境で利用可能
```

完了時は日本語で簡潔に報告します。
