# 修复 .env 文件编码问题
# 将文件转换为 UTF-8 (无 BOM) 编码

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "环境变量文件编码修复工具" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 设置控制台编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 定义要修复的文件列表
$files = @(
    ".env.local",
    ".env.example",
    "env.template",
    "env.minimal",
    "env.network-template"
)

$fixed = 0
$skipped = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "[处理] $file" -ForegroundColor Yellow
        
        try {
            # 读取文件内容（尝试多种编码）
            $content = $null
            
            # 先尝试 UTF-8
            try {
                $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
            } catch {
                # 如果失败，尝试默认编码
                try {
                    $content = Get-Content -Path $file -Raw -Encoding Default
                } catch {
                    Write-Host "  ✗ 无法读取文件" -ForegroundColor Red
                    $skipped++
                    continue
                }
            }
            
            # 使用 UTF-8 (无 BOM) 重新保存
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
            
            Write-Host "  ✓ 已修复为 UTF-8 (无 BOM)" -ForegroundColor Green
            $fixed++
            
        } catch {
            Write-Host "  ✗ 处理失败: $($_.Exception.Message)" -ForegroundColor Red
            $skipped++
        }
    } else {
        Write-Host "[跳过] $file (文件不存在)" -ForegroundColor Gray
        $skipped++
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "修复完成!" -ForegroundColor Green
Write-Host "  已修复: $fixed 个文件" -ForegroundColor Green
Write-Host "  已跳过: $skipped 个文件" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示: 使用支持 UTF-8 的编辑器（如 VS Code）打开文件验证" -ForegroundColor Cyan
Write-Host ""

# 验证 .env.local 文件
if (Test-Path ".env.local") {
    Write-Host "预览 .env.local 文件 (前 10 行):" -ForegroundColor Cyan
    Write-Host "-------------------------------------" -ForegroundColor Gray
    Get-Content .env.local -Encoding UTF8 -TotalCount 10
    Write-Host "-------------------------------------" -ForegroundColor Gray
}

Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

