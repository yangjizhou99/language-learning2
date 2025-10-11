# 修复 .env.local 文件的脚本
$content = Get-Content .env.local.backup -Raw
$content = $content -replace 'http://127\.0\.0\.1:54341', 'http://192.168.31.25:54341'
$content = $content -replace 'http://localhost:3001', 'http://192.168.31.25:3000'
[System.IO.File]::WriteAllText("$PWD\.env.local", $content, [System.Text.Encoding]::UTF8)
Write-Host "修复完成！"

