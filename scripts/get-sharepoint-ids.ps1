# PowerShell Script zum Abrufen von SharePoint Site ID und Drive ID

Write-Host "SharePoint ID Finder" -ForegroundColor Cyan
Write-Host ""

# Lade .env Datei
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
    Write-Host ".env Datei geladen" -ForegroundColor Green
} else {
    Write-Host ".env Datei nicht gefunden" -ForegroundColor Red
    exit 1
}

$tenantId = $env:MICROSOFT_TENANT_ID
$clientId = $env:MICROSOFT_CLIENT_ID
$clientSecret = $env:MICROSOFT_CLIENT_SECRET

if (-not $tenantId -or -not $clientId -or -not $clientSecret) {
    Write-Host "Fehler: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID und MICROSOFT_CLIENT_SECRET muessen gesetzt sein" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Hostname: 28yxf4.sharepoint.com" -ForegroundColor Yellow
Write-Host "Site Path: /sites/K3Drive" -ForegroundColor Yellow
Write-Host ""

# Hole Access Token
Write-Host "Authentifizierung..." -ForegroundColor Cyan
$tokenUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token"

$body = @{
    client_id     = $clientId
    client_secret = $clientSecret
    scope         = "https://graph.microsoft.com/.default"
    grant_type    = "client_credentials"
}

try {
    $tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType "application/x-www-form-urlencoded"
    $accessToken = $tokenResponse.access_token
    Write-Host "Access Token erhalten" -ForegroundColor Green
} catch {
    Write-Host "Fehler beim Abrufen des Access Tokens:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Moegliche Loesungen:" -ForegroundColor Yellow
    Write-Host "1. Gehe zu https://portal.azure.com -> App Registrations" -ForegroundColor White
    Write-Host "2. Waehle deine App aus" -ForegroundColor White
    Write-Host "3. Gehe zu API permissions" -ForegroundColor White
    Write-Host "4. Fuege Sites.Read.All (Application permission) hinzu" -ForegroundColor White
    Write-Host "5. Klicke auf Grant admin consent" -ForegroundColor White
    exit 1
}

# Hole Site ID
Write-Host ""
Write-Host "Rufe Site-Informationen ab..." -ForegroundColor Cyan
$siteUrl = "https://graph.microsoft.com/v1.0/sites/28yxf4.sharepoint.com:/sites/K3Drive"

$headers = @{
    Authorization = "Bearer $accessToken"
}

try {
    $siteResponse = Invoke-RestMethod -Method Get -Uri $siteUrl -Headers $headers
    $siteId = $siteResponse.id
    Write-Host "Site ID gefunden: $siteId" -ForegroundColor Green
} catch {
    Write-Host "Fehler beim Abrufen der Site ID:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

# Hole Drive ID
Write-Host ""
Write-Host "Rufe Drive-Informationen ab..." -ForegroundColor Cyan
$drivesUrl = "https://graph.microsoft.com/v1.0/sites/$siteId/drives"

try {
    $drivesResponse = Invoke-RestMethod -Method Get -Uri $drivesUrl -Headers $headers
    $drives = $drivesResponse.value
    
    Write-Host ""
    Write-Host "$($drives.Count) Drive(s) gefunden:" -ForegroundColor Green
    
    $i = 1
    foreach ($drive in $drives) {
        Write-Host ""
        Write-Host "$i. $($drive.name)" -ForegroundColor White
        Write-Host "   ID: $($drive.id)" -ForegroundColor Gray
        Write-Host "   Type: $($drive.driveType)" -ForegroundColor Gray
        $i++
    }
    
    $driveId = $drives[0].id
    
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Green
    Write-Host "ERFOLGREICH! Fuege diese Werte zu deinen Vercel Environment Variables hinzu:" -ForegroundColor Green
    Write-Host ("=" * 80) -ForegroundColor Green
    Write-Host ""
    Write-Host "SHAREPOINT_SITE_ID=$siteId" -ForegroundColor Yellow
    Write-Host "SHAREPOINT_DRIVE_ID=$driveId" -ForegroundColor Yellow
    Write-Host 'ONEDRIVE_FOLDER_PATH=/Documents/Main/Images/OnlyFans & Fansly Downloads/K3NOX' -ForegroundColor Yellow
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Green
    
} catch {
    Write-Host "Fehler beim Abrufen der Drive ID:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}
