@echo off
chcp 65001 >nul
echo ========================================
echo 配置局域网访问环境
echo ========================================
echo.
echo 此脚本将配置电脑和 iPad 同时测试的环境
echo.
pause

echo.
echo [步骤 1/5] 复制环境变量配置...
if exist .env.local (
    echo [警告] .env.local 已存在
    echo 是否覆盖? (按任意键继续，Ctrl+C 取消)
    pause >nul
)
copy /Y env.network-template .env.local
echo [✓] 完成
echo.

echo [步骤 2/5] 添加防火墙规则 (需要管理员权限)...
echo 如果弹出 UAC 提示，请点击"是"
powershell -Command "Start-Process powershell -ArgumentList '-Command', 'netsh advfirewall firewall add rule name=\"Next.js Dev Server\" dir=in action=allow protocol=TCP localport=3000; netsh advfirewall firewall add rule name=\"Supabase API Gateway\" dir=in action=allow protocol=TCP localport=54341; netsh advfirewall firewall add rule name=\"Supabase Studio\" dir=in action=allow protocol=TCP localport=54342; Write-Host \"防火墙规则已添加\"; pause' -Verb RunAs"
echo [✓] 完成
echo.

echo [步骤 3/5] 检查 Supabase 服务...
docker ps --filter "name=supabase_kong" --format "{{.Status}}" | findstr "Up" >nul
if %errorlevel% == 0 (
    echo [✓] Supabase 服务正在运行
) else (
    echo [!] Supabase 服务未运行，是否启动? (按任意键继续，Ctrl+C 跳过)
    pause >nul
    echo 启动 Supabase...
    supabase start
)
echo.

echo [步骤 4/5] 获取局域网 IP...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    set IP=%%a
)
set IP=%IP: =%
echo [✓] 当前局域网 IP: %IP%
echo.

echo [步骤 5/5] 更新配置文件中的 IP 地址...
if not "%IP%"=="192.168.31.25" (
    echo [提示] 检测到 IP 地址与配置不同
    echo 当前 IP: %IP%
    echo 配置中的 IP: 192.168.31.25
    echo.
    echo 请手动编辑 .env.local 文件，将所有 192.168.31.25 替换为 %IP%
    echo.
    echo 按任意键用记事本打开 .env.local...
    pause >nul
    notepad .env.local
) else (
    echo [✓] IP 地址匹配
)
echo.

echo ========================================
echo 配置完成！
echo ========================================
echo.
echo [重要] 请确保已在 .env.local 中填入正确的 API Key:
echo   - OPENROUTER_API_KEY 或
echo   - DEEPSEEK_API_KEY 或
echo   - OPENAI_API_KEY
echo.
echo 访问地址:
echo   电脑: http://%IP%:3000
echo   iPad: http://%IP%:3000 (在同一WiFi下)
echo.
echo Supabase 管理面板:
echo   http://localhost:54342
echo.
echo 按任意键检查配置...
pause >nul
call check-network-setup.bat

