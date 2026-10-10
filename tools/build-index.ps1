# Scans reports/<sector>/*.html and writes data/reports.js
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$reportsDir = Join-Path $root 'reports'
$outFile = Join-Path $root 'data\reports.js'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Get-Meta([string]$html, [string]$name) {
  $m = [regex]::Match($html, '<meta\s+name="' + $name + '"\s+content="([^"]*)"', 'IgnoreCase')
  if ($m.Success) { return [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value).Trim() }
  return ''
}

$sectors = @()
foreach ($dir in Get-ChildItem -LiteralPath $reportsDir -Directory | Where-Object { $_.Name -notlike '_*' }) {
  $desc = ''
  $group = 'sector'
  $cfg = Join-Path $dir.FullName '_sector.json'
  if (Test-Path -LiteralPath $cfg) {
    $conf = [IO.File]::ReadAllText($cfg, $utf8) | ConvertFrom-Json
    if ($conf.desc) { $desc = $conf.desc }
    if ($conf.group) { $group = $conf.group }
  }

  $reports = @()
  foreach ($f in Get-ChildItem -LiteralPath $dir.FullName -Filter *.html -File) {
    $html = [IO.File]::ReadAllText($f.FullName, $utf8)
    $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)

    $m = [regex]::Match($base, '^(\d{4})(\d{2})(\d{2})_?(.*)$')
    if ($m.Success) {
      $date = '{0}-{1}-{2}' -f $m.Groups[1].Value, $m.Groups[2].Value, $m.Groups[3].Value
      $topic = $m.Groups[4].Value
    } else {
      $date = $f.LastWriteTime.ToString('yyyy-MM-dd')
      $topic = $base
    }

    $t = [regex]::Match($html, '<title>([\s\S]*?)</title>', 'IgnoreCase')
    $title = if ($t.Success) { [System.Net.WebUtility]::HtmlDecode($t.Groups[1].Value).Trim() } else { $topic }
    $title = [regex]::Replace($title, '\s*[|\u00b7]\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}\s*$', '')

    $reports += [pscustomobject]@{
      title   = $title
      date    = $date
      type    = Get-Meta $html 'report-type'
      file    = 'reports/' + $dir.Name + '/' + $f.Name
      summary = Get-Meta $html 'description'
    }
  }
  if ($reports.Count -eq 0) { continue }

  $reports = @($reports | Sort-Object -Property date -Descending)
  $sectors += [pscustomobject]@{
    name    = $dir.Name
    group   = $group
    desc    = $desc
    latest  = $reports[0].date
    reports = $reports
  }
}

$sectors = @($sectors | Sort-Object -Property latest -Descending)
$json = ConvertTo-Json -InputObject $sectors -Depth 5
[IO.File]::WriteAllText($outFile, "window.SECTORS = $json;`n", $utf8)

$total = ($sectors | ForEach-Object { $_.reports.Count } | Measure-Object -Sum).Sum
Write-Host "OK: $($sectors.Count) sectors, $total reports -> data\reports.js"
