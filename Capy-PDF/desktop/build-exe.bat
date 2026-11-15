@echo off
if /i not "%~1"=="run" (
  cmd /k call "%~f0" run
  exit /b
)
chcp 65001 >nul
cd /d "%~dp0"
if not exist "package.json" (echo 請先把整個 ZIP 解壓縮，再到 desktop 資料夾執行 build-exe.bat。& pause & exit /b 1)
echo ==== Capy PDF 建立安裝檔 ====
where npm >nul 2>nul || (echo 找不到 Node.js，請先到 https://nodejs.org 安裝 LTS 版本後再執行。& pause & exit /b 1)

echo [1/3] 安裝打包工具（第一次需要幾分鐘）...
call npm install || (echo 安裝失敗，請檢查網路後再試。& pause & exit /b 1)

echo [2/3] 準備 Windows 簽章元件...
set "WCS=%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0"
set "WCS7Z=%TEMP%\winCodeSign-2.6.0.7z"
if exist "%WCS%\rcedit-x64.exe" goto wcs_ok
if not exist "%WCS%" mkdir "%WCS%"
curl.exe -L -s -o "%WCS7Z%" https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z
if not exist "%WCS7Z%" goto wcs_fail
rem 壓縮檔內有兩個 Mac 用的連結檔，Windows 無權建立，略過即可（不影響 Windows 打包）
"node_modules\7zip-bin\win\x64\7za.exe" x -y -bd "%WCS7Z%" "-o%WCS%" >nul 2>nul
del "%WCS7Z%" >nul 2>nul
if exist "%WCS%\rcedit-x64.exe" goto wcs_ok
:wcs_fail
echo 簽章元件準備失敗。請改用以下任一方式後重新執行：
echo   1. 開啟 Windows「設定 → 系統 → 開發人員專用」，打開「開發人員模式」
echo   2. 或在 build-exe.bat 上按右鍵 →「以系統管理員身分執行」
pause & exit /b 1
:wcs_ok
echo     完成

echo [3/3] 產生安裝檔...
call npm run dist || (echo 打包失敗，請把上方訊息貼給 Claude。& pause & exit /b 1)
echo.
echo 完成！安裝檔在 dist 資料夾：
dir /b dist\*.exe
start "" "%~dp0dist"
pause
