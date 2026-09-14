[CmdletBinding()]
param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $projectRoot

function Assert-Success([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed. Production was not deployed."
  }
}

Write-Host "`n[1/7] Checking repository..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath ".git")) {
  throw "Run this command from the Shanyraq Git repository."
}
if (-not (Test-Path -LiteralPath ".vercel\project.json")) {
  throw "The Vercel project is not linked. Run 'npx vercel link' once, then retry."
}

$branch = (git branch --show-current).Trim()
Assert-Success "Reading the Git branch"
if ($branch -ne "main") {
  throw "Production deploys are allowed only from main. Current branch: $branch"
}

$conflicts = @(git diff --name-only --diff-filter=U)
Assert-Success "Checking merge conflicts"
if ($conflicts.Count -gt 0) {
  throw "Resolve merge conflicts before deploying: $($conflicts -join ', ')"
}

Write-Host "`n[2/7] Checking Vercel login..." -ForegroundColor Cyan
npx --yes vercel whoami
Assert-Success "Vercel authentication"

Write-Host "`n[3/7] Running lint..." -ForegroundColor Cyan
npm run lint
Assert-Success "Lint"

Write-Host "`n[4/7] Building the production application..." -ForegroundColor Cyan
npm run build
Assert-Success "Production build"

Write-Host "`n[5/7] Creating a Git commit..." -ForegroundColor Cyan
git add -A
Assert-Success "Staging changes"

$forbiddenFiles = @(git diff --cached --name-only | Where-Object {
  $_ -match '(^|/)\.env($|\.)' -or $_ -match '(^|/)output/'
})
Assert-Success "Checking staged files"
if ($forbiddenFiles.Count -gt 0) {
  throw "Secret or generated files are staged and the deploy was stopped: $($forbiddenFiles -join ', ')"
}

$stagedFiles = @(git diff --cached --name-only)
Assert-Success "Reading staged changes"
if ($stagedFiles.Count -gt 0) {
  if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "deploy: production update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  }
  git commit -m $Message
  Assert-Success "Creating the Git commit"
} else {
  Write-Host "No new local changes; using the current commit." -ForegroundColor DarkGray
}

Write-Host "`n[6/7] Applying pending migrations to the production database..." -ForegroundColor Cyan
npx --yes vercel env run -e production -- npx prisma migrate deploy
Assert-Success "Production database migration"

Write-Host "`n[7/7] Pushing main to GitHub..." -ForegroundColor Cyan
git push origin main
Assert-Success "Git push"

$commit = (git rev-parse --short HEAD).Trim()
Assert-Success "Reading the deployed commit"
Write-Host "`nDone. Commit $commit was pushed to main." -ForegroundColor Green
Write-Host "Vercel will now build and publish the production deployment from GitHub." -ForegroundColor Green
Write-Host "Open the project's Deployments page in Vercel and wait for the Ready status."
