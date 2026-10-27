param([switch]$Install)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
if ($Install) {
    $scriptPath = Join-Path $PSScriptRoot 'schedule-pm.ps1'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}"' -f $scriptPath) -WorkingDirectory $projectPath
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)
    $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
    Register-ScheduledTask -TaskName 'AGE-CMMS-PM' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Create due CMMS preventive maintenance jobs every five minutes while this Windows user is signed in.' | Select-Object TaskName,State
    exit
}
$logPath = Join-Path $projectPath '.pm-worker.log'
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $nodePath
$startInfo.Arguments = '--import tsx scripts/pm-worker.ts'
$startInfo.WorkingDirectory = $projectPath
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$process = [System.Diagnostics.Process]::Start($startInfo)
$outputTask = $process.StandardOutput.ReadToEndAsync()
$errorTask = $process.StandardError.ReadToEndAsync()
if (-not $process.WaitForExit(180000)) { $process.Kill(); throw 'PM worker exceeded three minutes' }
$log = '{0} exit={1}{2}{3}{4}' -f (Get-Date -Format o),$process.ExitCode,[Environment]::NewLine,$outputTask.Result,$errorTask.Result
Set-Content -LiteralPath $logPath -Value $log -Encoding UTF8
exit $process.ExitCode
