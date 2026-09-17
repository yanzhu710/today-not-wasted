Add-Type -AssemblyName System.Drawing

$srcDir = "C:\Users\1\Doubao\chats\2026-09-17\new-chat\today_project\assets\badges\source"
$outDir = "C:\Users\1\Doubao\chats\2026-09-17\new-chat\today_project\assets\badges"

$cols = 5
$rows = 4
$outSize = 256

# 用实际测量的坐标：
# 第一张图：第1个中心(190,170)，dx=250, dy=200
# 第三张图：第1个中心(190,175)，dx=250, dy=220
# 取平均：dx=250, dy=210
$startX = 190
$startY = 172
$dx = 225
$dy = 220
$cutSize = 200  # 切200x200的区域

$seriesFiles = @("series1.png", "series2.png", "series3.png", "series4.png", "series5.png", "series6.png")

$badgeNum = 1

foreach ($sf in $seriesFiles) {
    $img = [System.Drawing.Image]::FromFile((Join-Path $srcDir $sf))

    for ($row = 0; $row -lt $rows; $row++) {
        for ($col = 0; $col -lt $cols; $col++) {
            $centerX = $startX + $col * $dx
            $centerY = $startY + $row * $dy

            $x = [int]($centerX - $cutSize / 2)
            $y = [int]($centerY - $cutSize / 2)

            $bmp = New-Object System.Drawing.Bitmap($outSize, $outSize)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.Clear([System.Drawing.Color]::White)

            $destRect = New-Object System.Drawing.Rectangle(0, 0, $outSize, $outSize)
            $srcRect = New-Object System.Drawing.Rectangle($x, $y, $cutSize, $cutSize)
            $g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

            $id = "A{0:D3}" -f $badgeNum
            $outPath = Join-Path $outDir "$id.png"
            $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

            $g.Dispose()
            $bmp.Dispose()
            $badgeNum++
        }
    }
    $img.Dispose()
}

Write-Host "Done! Total badges: $($badgeNum - 1)"
