import { BRAND_ART_LINES } from "../brandArt";

export function psInstallerTemplate(compiledStatuslineScript: string): string {
  const safe = compiledStatuslineScript.replace(/'@/g, "'@_X");

  const psArtArray = BRAND_ART_LINES
    .map((line) => "    '" + line.replace(/'/g, "''") + "'")
    .join(",\n");

  const part1 = String.raw`# statusline.sh installer (PowerShell)
$ErrorActionPreference = 'Stop'

$BrandArt = @(
` + psArtArray + String.raw`
)

function Show-Banner($color, $msg) {
  Write-Host ''
  foreach ($line in $BrandArt) { Write-Host $line -ForegroundColor $color }
  Write-Host ''
  Write-Host ('  ' + $msg) -ForegroundColor $color
  Write-Host ''
}

$ClaudeDir = Join-Path $env:USERPROFILE '.claude'
if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Path $ClaudeDir | Out-Null }
$SL = Join-Path $ClaudeDir 'statusline.ps1'

$script = @'
`;
  const part2 = String.raw`
'@

[IO.File]::WriteAllText($SL, $script, (New-Object System.Text.UTF8Encoding $false))

$Settings = Join-Path $ClaudeDir 'settings.json'
if (-not (Test-Path $Settings)) {
  [IO.File]::WriteAllText($Settings, '{}', (New-Object System.Text.UTF8Encoding $false))
}
$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
Copy-Item -Path $Settings -Destination ($Settings + ".bak.$stamp") -Force

function Invoke-SelfHeal($errMsg) {
  if ($env:STATUSLINE_SELFHEAL -eq '1' -and (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "STATUSLINE_SELFHEAL=1 - invoking 'claude' to repair settings.json"
    $bytes = [IO.File]::ReadAllBytes($Settings)
    $take = [Math]::Min(4096, $bytes.Length)
    $snippet = [Text.Encoding]::UTF8.GetString($bytes, 0, $take)
    $nl = [Environment]::NewLine
    $prompt = 'Fix my settings.json at ' + $Settings + ' so it has a top-level statusLine={type:"command",command:"' + $SL + '"} while preserving every other key. Current contents:' + $nl + $snippet + $nl + 'Error: ' + $errMsg
    try { & claude -p $prompt } catch { Write-Warning ($_ | Out-String) }
    return $true
  }
  Write-Host ''
  Write-Warning ('Could not merge settings.json automatically: ' + $errMsg)
  Write-Host 'Set $env:STATUSLINE_SELFHEAL=''1'' and ensure ''claude'' is on PATH to auto-repair.'
  Write-Host ('Your previous settings.json is backed up at ' + $Settings + '.bak.*')
  return $false
}

$runner = (Get-Command pwsh -ErrorAction SilentlyContinue)
if ($runner) {
  $cmd = 'pwsh -NoProfile -File "' + $SL + '"'
} else {
  $cmd = 'powershell.exe -NoProfile -File "' + $SL + '"'
}

try {
  $raw = [IO.File]::ReadAllText($Settings)
  if ([string]::IsNullOrWhiteSpace($raw)) { $raw = '{}' }
  $obj = $raw | ConvertFrom-Json
  if ($null -eq $obj) { $obj = [pscustomobject]@{} }

  $newStatus = [pscustomobject]@{ type = 'command'; command = $cmd }
  if ($obj.PSObject.Properties.Match('statusLine').Count -gt 0) {
    $obj.statusLine = $newStatus
  } else {
    $obj | Add-Member -MemberType NoteProperty -Name 'statusLine' -Value $newStatus -Force
  }

  $out = $obj | ConvertTo-Json -Depth 50
  [IO.File]::WriteAllText($Settings, $out, (New-Object System.Text.UTF8Encoding $false))
} catch {
  $healed = Invoke-SelfHeal $_.Exception.Message
  if ($healed) {
    Show-Banner 'Yellow' 'installed with errors - restart Claude Code to verify'
    exit 0
  }
  Show-Banner 'Red' 'error: install failed'
  exit 1
}

Show-Banner 'Green' 'installed successfully - restart Claude Code to see it'
exit 0
`;
  return part1 + safe + part2;
}
