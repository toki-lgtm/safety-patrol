# 安全パトロール アーカイバ セットアップ
# - ProgramData フォルダ作成（キー/ログ置き場）
# - 月次スケジュールタスク登録（毎月1日 19:00）
# 実行: PowerShell で  .\setup_scheduled_task.ps1
# ※ サービスロールキーの配置だけは手動（このスクリプトは鍵を持ちません）

$ErrorActionPreference = "Stop"

$KeyDir   = "C:\ProgramData\SafetyPatrolArchiver"
$KeyFile  = Join-Path $KeyDir "service_role_key.txt"
$LogDir   = Join-Path $KeyDir "logs"
$Script   = Join-Path $PSScriptRoot "archive_inspections.py"
$TaskName = "SafetyPatrol アーカイブ"

# 1) フォルダ作成
New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Host "✅ フォルダ準備: $KeyDir"

# 2) Python(pythonw) 実体を解決（Storeエイリアスではなく実体を優先）
$pyCandidates = @(
  "$env:LOCALAPPDATA\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\pythonw3.13.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python313\pythonw.exe"
)
$Pythonw = $pyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Pythonw) {
  $cmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue
  if ($cmd) { $Pythonw = $cmd.Source }
}
if (-not $Pythonw) { throw "pythonw.exe が見つかりません。Python をインストールしてください。" }
Write-Host "✅ Python: $Pythonw"

# 3) 月次タスク登録（毎月1日 19:00 / 現在ユーザー / 制限権限）
$action  = "`"$Pythonw`" `"$Script`""
schtasks /Create /TN "$TaskName" /TR "$action" /SC MONTHLY /D 1 /ST 19:00 /RL LIMITED /F | Out-Null
Write-Host "✅ スケジュールタスク登録: 「$TaskName」 毎月1日 19:00"

# 4) 鍵の確認
if (Test-Path $KeyFile) {
  Write-Host "✅ サービスロールキー検出済み: $KeyFile"
} else {
  Write-Host ""
  Write-Host "⚠️ 次の1ステップだけ手動で必要です（1回のみ）:" -ForegroundColor Yellow
  Write-Host "   Supabase の service_role キーを次のファイルに保存してください:"
  Write-Host "   $KeyFile"
  Write-Host "   取得元: Supabase ダッシュボード → Project Settings → API → service_role"
  Write-Host "   （Render の環境変数 SUPABASE_SERVICE_ROLE_KEY と同じ値）"
}

Write-Host ""
Write-Host "▶ 動作確認（削除しません）:  python `"$Script`" --dry-run"
Write-Host "▶ 今すぐ手動実行        :  schtasks /Run /TN `"$TaskName`""
