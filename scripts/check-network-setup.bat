@echo off
chcp 65001 >nul
echo ========================================
echo 局域网测试环境检查工具
echo ========================================
echo.

echo [1] 当前电脑局域网 IP 地址
echo ----------------------------------------
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    echo %%a
)
echo.

echo [2] Next.js 开发服务器配置
echo ----------------------------------------
echo 检查 package.json 中的 dev 命令...
findstr "\"dev\"" package.json
echo.

echo [3] Supabase 容器状态
echo ----------------------------------------
docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [4] 防火墙规则检查
echo ----------------------------------------
netsh advfirewall firewall show rule name="Next.js Dev Server" 2>nul | findstr "规则名" || echo [!] 未找到 Next.js Dev Server 规则
netsh advfirewall firewall show rule name="Supabase API Gateway" 2>nul | findstr "规则名" || echo [!] 未找到 Supabase API Gateway 规则
echo.

echo [5] 环境变量配置
echo ----------------------------------------
if exist .env.local (
    echo [✓] .env.local 文件存在
    findstr "NEXT_PUBLIC_SUPABASE_URL" .env.local
) else (
    echo [X] .env.local 文件不存在，请创建！
)
echo.

echo ========================================
echo 访问地址
echo ========================================
echo 电脑访问: http://192.168.31.25:3000
echo iPad访问: http://192.168.31.25:3000
echo Supabase Studio: http://localhost:54342
echo ========================================
echo.

pause

