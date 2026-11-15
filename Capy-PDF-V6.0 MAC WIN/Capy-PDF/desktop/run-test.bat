@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>nul || (echo 找不到 Node.js，請先到 https://nodejs.org 安裝 LTS 版本。& pause & exit /b 1)
if not exist node_modules call npm install
rem 新版 npm 可能不會自動執行 Electron 的安裝腳本，這裡手動補上
if not exist "node_modules\electron\dist\electron.exe" node node_modules\electron\install.js
call npm start
