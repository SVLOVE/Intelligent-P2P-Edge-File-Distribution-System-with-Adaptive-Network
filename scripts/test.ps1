# Run all Phase 1 verification tests
Write-Host "Running Backend Tests (pytest)..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\..\backend"
.\.venv\Scripts\python.exe -m pytest app/tests -v
$backendExit = $LASTEXITCODE

Write-Host "`nRunning Frontend Tests (vitest)..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\..\frontend"
npm run test
$frontendExit = $LASTEXITCODE

Write-Host "`nRunning Frontend Typecheck..." -ForegroundColor Cyan
npm run typecheck
$typecheckExit = $LASTEXITCODE

Set-Location -Path "$PSScriptRoot\.."

if ($backendExit -eq 0 -and $frontendExit -eq 0 -and $typecheckExit -eq 0) {
    Write-Host "`nAll Phase 1 tests and checks passed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nValidation checks failed!" -ForegroundColor Red
    exit 1
}
