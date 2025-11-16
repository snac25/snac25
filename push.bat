@echo off
echo ====================================
echo GitHub에 푸시하기
echo ====================================
echo.

git add .
echo.

set /p message="커밋 메시지를 입력하세요: "
git commit -m "%message%"
echo.

git push
echo.

echo ====================================
echo 푸시 완료!
echo ====================================
pause

