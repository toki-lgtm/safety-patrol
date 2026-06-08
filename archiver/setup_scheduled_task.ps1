# Safety Patrol Archiver - setup
# - Creates ProgramData folder (for service-role key and logs)
# - Registers a monthly scheduled task (day 1, 19:00) via Register-ScheduledTask -Xml
#   (XML avoids schtasks quoting issues with spaced paths)
# Run in PowerShell:  .\setup_scheduled_task.ps1
# NOTE: ASCII-only on purpose (PS 5.1 misreads UTF-8-no-BOM Japanese as Shift-JIS).
# NOTE: This script does NOT contain the service-role key; place it manually (see README).

$ErrorActionPreference = "Stop"

$KeyDir   = "C:\ProgramData\SafetyPatrolArchiver"
$KeyFile  = Join-Path $KeyDir "service_role_key.txt"
$LogDir   = Join-Path $KeyDir "logs"
$Script   = Join-Path $PSScriptRoot "archive_inspections.py"
$TaskName = "SafetyPatrol Archive"

# 1) Folders
New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Host "[OK] folder ready: $KeyDir"

# 2) Resolve pythonw (prefer real exe, not Store alias)
$pyCandidates = @(
  "$env:LOCALAPPDATA\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\pythonw3.13.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python313\pythonw.exe"
)
$Pythonw = $pyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Pythonw) {
  $cmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue
  if ($cmd) { $Pythonw = $cmd.Source }
}
if (-not $Pythonw) { throw "pythonw.exe not found. Please install Python." }
Write-Host "[OK] python: $Pythonw"

# 3) Build task XML (monthly, day 1, 19:00) and register
$xmlEsc = { param($s) $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' }
$cmdXml = & $xmlEsc $Pythonw
$argXml = & $xmlEsc ("`"$Script`"")

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Safety Patrol: archive old inspection photos/PDFs to shared drive and delete from cloud.</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T19:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>1</Day></DaysOfMonth>
        <Months>
          <January/><February/><March/><April/><May/><June/>
          <July/><August/><September/><October/><November/><December/>
        </Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$cmdXml</Command>
      <Arguments>$argXml</Arguments>
    </Exec>
  </Actions>
</Task>
"@

Register-ScheduledTask -TaskName $TaskName -Xml $xml -Force | Out-Null
Write-Host "[OK] scheduled task '$TaskName' registered (monthly, day 1, 19:00)"

# 4) Key check
if (Test-Path $KeyFile) {
  Write-Host "[OK] service-role key found: $KeyFile"
} else {
  Write-Host ""
  Write-Host "[ACTION NEEDED - one time] Save the Supabase service_role key to:" -ForegroundColor Yellow
  Write-Host "   $KeyFile"
  Write-Host "   From: Supabase dashboard -> Project Settings -> API -> service_role"
  Write-Host "   (same value as Render env var SUPABASE_SERVICE_ROLE_KEY)"
}

Write-Host ""
Write-Host "Dry run (no delete):  python `"$Script`" --dry-run"
Write-Host "Run now           :  schtasks /Run /TN `"$TaskName`""
