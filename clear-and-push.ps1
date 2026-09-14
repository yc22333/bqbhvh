# Clear GitHub repo and re-upload
# Right-click -> "Run with PowerShell"

$gitPath = "E:\1.电脑软件\5.后台软件\4.Git\bin"
$env:Path = "$gitPath;$env:PATH"
$env:GIT_SSH = ""

# Proxy (uncomment if needed)
# $env:HTTP_PROXY = "http://127.0.0.1:7890"
# $env:HTTPS_PROXY = "http://127.0.0.1:7890"

$repo = "https://github.com/yc22333/bqbhvh.git"
$dir = "E:\2.储存位置\4.搭建的网站\5.0.2比奇堡报价单"

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  Clear GitHub Repo and Re-upload" -ForegroundColor Yellow
Write-Host "  yc22333/bqbhvh" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# Check git
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "ERROR: git not found at $gitPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $dir

Write-Host "[1/6] Delete old .git..." -ForegroundColor Cyan
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git" -ErrorAction Stop
}
Write-Host "OK" -ForegroundColor Green

Write-Host ""
Write-Host "[2/6] git init..." -ForegroundColor Cyan
git init
Write-Host "OK" -ForegroundColor Green

Write-Host ""
Write-Host "[3/6] git add..." -ForegroundColor Cyan
git add .
Write-Host "OK" -ForegroundColor Green

Write-Host ""
Write-Host "[4/6] git commit..." -ForegroundColor Cyan
git commit -m "first commit"
git branch -m master main 2>$null
Write-Host "OK" -ForegroundColor Green

Write-Host ""
Write-Host "[5/6] set remote..." -ForegroundColor Cyan
git remote add origin $repo 2>$null
git remote set-url origin $repo
Write-Host "OK" -ForegroundColor Green

Write-Host ""
Write-Host "[6/6] git push --force ..." -ForegroundColor Cyan
Write-Host "NOTE: If connection fails, please turn on VPN first." -ForegroundColor Yellow
Write-Host ""
git push -u origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "PUSH FAILED" -ForegroundColor Red
    Write-Host "Possible reasons:" -ForegroundColor Red
    Write-Host "1. Network blocked (need VPN)" -ForegroundColor Red
    Write-Host "2. No write permission" -ForegroundColor Red
    Write-Host "3. Need token: https://github.com/settings/tokens" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=========== ALL DONE ============" -ForegroundColor Green
Read-Host "Press Enter to exit"