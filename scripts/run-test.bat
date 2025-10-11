@echo off
echo 🎯 并发测试脚本
echo ==================

echo.
echo 选择测试类型:
echo 1. 快速测试 (使用模拟数据)
echo 2. 真实测试 (使用真实音频URL)
echo 3. 完整测试 (详细报告)
echo.

set /p choice=请输入选择 (1-3): 

if "%choice%"=="1" (
    echo.
    echo 🚀 启动快速测试...
    node quick-test.js
) else if "%choice%"=="2" (
    echo.
    echo 🚀 启动真实测试...
    node real-test.js
) else if "%choice%"=="3" (
    echo.
    echo 🚀 启动完整测试...
    node test-concurrency.js
) else (
    echo ❌ 无效选择，请重新运行脚本
    pause
    exit /b 1
)

echo.
echo 测试完成！按任意键退出...
pause
