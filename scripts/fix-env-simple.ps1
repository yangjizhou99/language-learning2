$lines = Get-Content .env.local.backup
$output = @()

foreach($line in $lines) {
    # 处理包含注释和URL在同一行的情况
    if($line -match '# 这些配置让你的应用默认连接本地数据库.*NEXT_PUBLIC_SUPABASE_URL=') {
        # 分割注释和URL
        $output += '# 这些配置让你的应用默认连接本地数据库，确保开发安全'
        $output += 'NEXT_PUBLIC_SUPABASE_URL=http://192.168.31.25:54341'
    }
    elseif($line -match '^NEXT_PUBLIC_SITE_URL=') {
        $output += 'NEXT_PUBLIC_SITE_URL=http://192.168.31.25:3000'
    }
    else {
        $output += $line
    }
}

$output | Set-Content .env.local -Encoding UTF8
Write-Host "Done!"

