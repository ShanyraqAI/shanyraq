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

Write-Host "This legacy command now performs preflight only. It never migrates, commits or pushes." -ForegroundColor Yellow
Write-Host "`n[1/4] Checking repository..." -ForegroundColor Cyan
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

$dirty = @(git status --porcelain)
Assert-Success "Checking working tree"
if ($dirty.Count -gt 0) { throw "Preflight requires a clean, reviewed commit. Commit changes separately first." }

Write-Host "`n[2/4] Checking Vercel login..." -ForegroundColor Cyan
npx --yes vercel whoami
Assert-Success "Vercel authentication"

Write-Host "`n[3/4] Running lint..." -ForegroundColor Cyan
npm run lint
Assert-Success "Lint"

Write-Host "`n[4/4] Building the production application..." -ForegroundColor Cyan
npm run build
Assert-Success "Production build"

$commit = (git rev-parse HEAD).Trim()
Assert-Success "Reading the reviewed commit"
Write-Host "`nPreflight passed for commit $commit. No migration, push or deployment was performed." -ForegroundColor Green
Write-Host "Before production: build a Ready immutable deployment of this exact commit against staging, verify migrations on a disposable PostgreSQL database and confirm a tested backup."
Write-Host "Then use the explicit db:migrate:release command in the protected release environment and promote the already-built deployment without rebuilding."
Write-Host "See docs/reliability-and-release.md. Do not use git push as a migration/deploy orchestrator."
