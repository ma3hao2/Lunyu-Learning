# 论语学习 App 自动截图脚本：启动 Electron 便携版 → 逐页导航 → 截屏
# 页面：首页 / 论语 / 笔记 / 我的（tabbar 底部四项，窗口 420x880）
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$exe = "D:\Software\lunyu-dist\论语学习-v1.0.0-windows-Portable.exe"
$outDir = "D:\Software\lunyu-miniapp\docs\copyright-assets\screenshots"
New-Item -ItemType Directory -Force $outDir | Out-Null

# 启动应用
$p = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 12  # 等待窗口加载

# 找到主窗口
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$proc = Get-Process | Where-Object { $_.MainWindowTitle -match '论语' } | Select-Object -First 1
if (-not $proc) { Write-Error "未找到应用窗口"; exit 1 }

[Win32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 2
$rect = New-Object Win32+RECT
[Win32]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
Write-Host "窗口: $($rect.Left),$($rect.Top) ${w}x${h}"

function Take-Shot($name) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
    $bmp.Save("$outDir\$name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "已截图: $name"
}

function Click-At($x, $y) {
    # 转换为屏幕绝对坐标
    $sx = $rect.Left + $x; $sy = $rect.Top + $y
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($sx, $sy)
    Start-Sleep -Milliseconds 400
    $mouseEvent = Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f, int dx, int dy, int d, int i);' -Name U32 -PassThru
    $mouseEvent::mouse_event(2, 0, 0, 0, 0); Start-Sleep -Milliseconds 120; $mouseEvent::mouse_event(4, 0, 0, 0, 0)
    Start-Sleep -Seconds 3  # 等待页面切换
}

# 1. 首页
Take-Shot "01-home"

# tabbar 位置：窗口底部（约 h-32），四项均分 420 宽 → 中心 x = 52, 157, 262, 367
$tabY = $h - 30

# 2. 论语页
Click-At 157 $tabY; Take-Shot "02-classics"

# 3. 点击第一章进入章句列表（列表第一项约在 y=200）
Click-At 210 200; Start-Sleep -Seconds 3; Take-Shot "03-chapter"

# 返回论语页（返回按钮在左上 y≈60）
Click-At 30 60; Start-Sleep -Seconds 2

# 4. 笔记页
Click-At 262 $tabY; Take-Shot "04-insights"

# 5. 我的页
Click-At 367 $tabY; Take-Shot "05-mine"

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.ProcessName -match '论语|LunYu' } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "完成，截图保存在 $outDir"
