# GitHub에 푸시하는 PowerShell 스크립트

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "GitHub에 푸시하기" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 변경사항 추가
git add .
Write-Host "변경사항이 스테이징되었습니다." -ForegroundColor Green
Write-Host ""

# 커밋 메시지 입력
$message = Read-Host "커밋 메시지를 입력하세요"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

# 커밋
git commit -m $message
Write-Host ""

# 푸시
git push
Write-Host ""

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "푸시 완료!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan

