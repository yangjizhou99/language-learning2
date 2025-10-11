@echo off
chcp 65001 >nul
echo ========================================
echo 将现有配置转换为局域网访问模式
echo ========================================
echo.
echo 此脚本会修改 .env.local 中的 URL
echo 将 127.0.0.1 和 localhost 改为局域网 IP
echo 其他配置（API keys等）保持不变
echo.

REM 检查 .env.local 是否存在
if not exist .env.local (
    echo [错误] .env.local 文件不存在！
    pause
    exit /b 1
)

echo [步骤 1/4] 获取局域网 IP...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    set IP=%%a
)
set IP=%IP: =%
echo [✓] 当前局域网 IP: %IP%
echo.

echo [步骤 2/4] 备份当前配置...
copy .env.local .env.local.backup
echo [✓] 已备份到 .env.local.backup
echo.

echo [步骤 3/4] 修改配置文件...
REM 使用 PowerShell 进行替换
powershell -Command "(Get-Content .env.local) -replace 'http://127.0.0.1:54341', 'http://%IP%:54341' | Set-Content .env.local.temp"
powershell -Command "(Get-Content .env.local.temp) -replace 'http://localhost:3001', 'http://%IP%:3000' | Set-Content .env.local"
del .env.local.temp
echo [✓] 已更新 URL 配置
echo.

echo [步骤 4/4] 配置防火墙规则...
echo 如果弹出 UAC 提示，请点击"是"
powershell -Command "Start-Process powershell -ArgumentList '-Command', 'netsh advfirewall firewall add rule name=\"Next.js Dev Server\" dir=in action=allow protocol=TCP localport=3000; netsh advfirewall firewall add rule name=\"Supabase API Gateway\" dir=in action=allow protocol=TCP localport=54341; Write-Host \"防火墙规则已添加\"; pause' -Verb RunAs"
echo [✓] 完成
echo.

echo ========================================
echo 配置更新完成！
echo ========================================
echo.
echo 修改内容：
echo   http://127.0.0.1:54341 → http://%IP%:54341
echo   http://localhost:3001 → http://%IP%:3000
echo.
echo 其他配置（API keys等）保持不变
echo.
echo 如果需要恢复原配置：
echo   copy .env.local.backup .env.local
echo.
echo 访问地址：
echo   电脑: http://%IP%:3000
echo   iPad: http://%IP%:3000
echo.
echo 现在重启开发服务器：npm run dev
echo.

pause

