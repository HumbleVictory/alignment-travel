# recover_from_code_txt.ps1
# Splits code.txt that contains blocks like:
# global.css:
# ...content...
# app/page:
# ...content...
#
# Fix: only treat headings that start with approved roots
# (prevents junk files like "Let" / "Then")

$src = Join-Path (Get-Location) "code.txt"
if (!(Test-Path $src)) {
  throw "Cannot find code.txt in $(Get-Location). Put code.txt in your project root."
}

$text = Get-Content -Raw -Encoding UTF8 $src
if ($null -eq $text -or $text.Length -eq 0) {
  throw "code.txt is empty or could not be read. Check file size and encoding."
}

# Heading must be EXACTLY one of these roots:
# global.css:
# app/...
# components/...
# lib/...
# data/...
# docs/...
$headingRegex = '(?m)^(?<name>(global\.css|app\/[A-Za-z0-9_./-]+|components\/[A-Za-z0-9_./-]+|lib\/[A-Za-z0-9_./-]+|data\/[A-Za-z0-9_./-]+|docs\/[A-Za-z0-9_./-]+)):\s*$'
$matches = [regex]::Matches($text, $headingRegex)

if ($matches.Count -eq 0) {
  throw "No valid headings found. Expected lines like 'app/page:' or 'components/CityModal:'"
}

function To-RealPath([string]$name) {
  if ($name -eq "global.css") { return "app\globals.css" }

  if ($name.StartsWith("app/")) { return ($name -replace '/', '\') + ".tsx" }
  if ($name.StartsWith("components/")) { return ($name -replace '/', '\') + ".tsx" }
  if ($name.StartsWith("lib/")) { return ($name -replace '/', '\') + ".ts" }
  if ($name.StartsWith("data/")) { return ($name -replace '/', '\') + ".ts" }

  if ($name.StartsWith("docs/")) {
    # Default docs to markdown
    return ($name -replace '/', '\') + ".md"
  }

  return ($name -replace '/', '\')
}

$written = New-Object System.Collections.Generic.List[string]

for ($i = 0; $i -lt $matches.Count; $i++) {
  $m = $matches[$i]
  $name = $m.Groups["name"].Value

  $start = $m.Index + $m.Length
  $end = if ($i -lt ($matches.Count - 1)) { $matches[$i + 1].Index } else { $text.Length }

  $body = $text.Substring($start, $end - $start)
  $body = $body.TrimStart("`r","`n")

  $outPath = To-RealPath $name
  $dir = Split-Path $outPath -Parent
  if ($dir -and !(Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  Set-Content -Path $outPath -Value $body -Encoding UTF8
  $written.Add($outPath) | Out-Null
}

# Unicode-safe output (avoid weird checkmark glyphs in older PS)
"OK - Wrote files:"
$written | ForEach-Object { " - $_" }