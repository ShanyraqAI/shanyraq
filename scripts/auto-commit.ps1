param([int]$IntervalSeconds = 0)

$ErrorActionPreference = "Continue"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

function Sync-Once {
    $status = git status --porcelain
    if (-not $status) { return }

    git add -A
    git commit -m "Auto-save: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] commit failed"
        return
    }

    git -c rebase.autoStash=true pull --rebase origin main | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] pull failed, push skipped"
        return
    }

    git push origin main | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] committed & pushed"
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] push failed"
    }
}

if ($IntervalSeconds -gt 0) {
    Write-Host "Auto-commit watcher started (every $IntervalSeconds sec). Ctrl+C to stop."
    while ($true) {
        Sync-Once
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Sync-Once
}
