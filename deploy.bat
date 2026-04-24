@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo   Vercel 배포 시작
echo ========================================
echo.

:: Git 초기화 (이미 있으면 건너뜀)
if not exist ".git" (
    git init
    git remote add origin https://github.com/qqjfroddl/deeptact-proposals.git
    echo [완료] Git 초기화
) else (
    echo [확인] Git 이미 설정됨
)

:: 전체 파일 추가 + 커밋 + 푸시
git add -A
git commit -m "프로필/제안서 업데이트 %date%"
git push -f origin main

echo.
echo ========================================
echo   배포 완료! Vercel에 자동 반영됩니다.
echo ========================================
echo.
pause
