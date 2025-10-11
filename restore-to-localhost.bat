@echo off
chcp 65001 >nul
echo ========================================
echo 恢复为仅本机访问模式
echo ========================================
echo.

if exist .env.local.backup (
    echo 正在恢复原配置...
    copy /Y .env.local.backup .env.local
    echo [✓] 已恢复为原配置
    echo.
    echo 现在配置为：
    echo   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
    echo   NEXT_PUBLIC_SITE_URL=http://localhost:3001
    echo.
    echo 请重启开发服务器：npm run dev
) else (
    echo [错误] 未找到备份文件 .env.local.backup
    echo.
    echo 请手动编辑 .env.local，将：
    echo   NEXT_PUBLIC_SUPABASE_URL=http://192.168.x.x:54341
    echo 改为：
    echo   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
    echo.
    echo   NEXT_PUBLIC_SITE_URL=http://192.168.x.x:3000
    echo 改为：
    echo   NEXT_PUBLIC_SITE_URL=http://localhost:3001
)

echo.
pause

