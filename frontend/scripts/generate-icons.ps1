$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sizes = @(192, 512)

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)

  $rect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(0x11,0x18,0x27),
    [System.Drawing.Color]::FromArgb(0x0e,0xa5,0xe9),
    45
  )
  $g.FillRectangle($brush, $rect)

  $fontSize = [float]($s * 0.5)
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $g.SmoothingMode = 'AntiAlias'
  $g.DrawString('T', $font, [System.Drawing.Brushes]::White, ($s/2), ($s/2), $sf)

  $outDir = Resolve-Path 'public'
  $outPath = Join-Path $outDir "icon-$s.png"
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $outPath"
}

