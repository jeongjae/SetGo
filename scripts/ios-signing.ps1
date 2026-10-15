param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('request', 'package', 'register')]
    [string]$Action,
    [string]$EmailAddress,
    [string]$CertificatePath,
    [string]$P12Path,
    [string]$ProfilePath,
    [string]$ApiKeyPath,
    [string]$ApiKeyId,
    [string]$IssuerId,
    [string]$Repository = 'jeongjae/SetGo',
    [string]$OpenSSLPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$signingDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) '.ios-signing'
$privateKey = Join-Path $signingDirectory 'distribution.key'
$requestPath = Join-Path $signingDirectory 'distribution.certSigningRequest'
$defaultP12 = Join-Path $signingDirectory 'distribution.p12'

function Find-OpenSSL {
    if ($OpenSSLPath) {
        return (Get-Item -LiteralPath $OpenSSLPath).FullName
    }
    $command = Get-Command openssl -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $gitOpenSSL = Join-Path $env:ProgramFiles 'Git\usr\bin\openssl.exe'
    if (Test-Path -LiteralPath $gitOpenSSL) { return $gitOpenSSL }
    throw 'OpenSSL was not found. Install Git for Windows or supply -OpenSSLPath.'
}

function Read-SigningPassword {
    if (Test-Path Env:SETGO_SIGNING_PASSWORD) {
        throw 'SETGO_SIGNING_PASSWORD is already set. Clear it before using this helper.'
    }
    $secret = Read-Host 'Signing password (hidden; keep it for the next steps)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try {
        $env:SETGO_SIGNING_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secret.Dispose()
    }
    if ([string]::IsNullOrWhiteSpace($env:SETGO_SIGNING_PASSWORD)) {
        Remove-Item Env:SETGO_SIGNING_PASSWORD -ErrorAction SilentlyContinue
        throw 'Use a non-empty signing password.'
    }
}

function Assert-File([string]$Path, [string]$Description) {
    if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description file is missing. Supply the local file path."
    }
}

function Set-RepositorySecret([string]$Name, [string]$Value) {
    # Send the value through stdin, without putting it in shell history or arguments.
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = (Get-Command gh -ErrorAction Stop).Source
    $startInfo.Arguments = "secret set $Name --repo $Repository"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::Start($startInfo)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
        $process.StandardInput.Close()
        $null = $process.StandardOutput.ReadToEnd()
        $message = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw "Could not set ${Name}: $message" }
        Write-Host "Registered secret: $Name"
    }
    finally { $process.Dispose() }
}

if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
    throw 'Repository must look like owner/repository.'
}
$openssl = Find-OpenSSL

switch ($Action) {
    'request' {
        if (-not $EmailAddress) { $EmailAddress = Read-Host 'Apple Developer email address' }
        if ($EmailAddress -notmatch '^[^/\s@]+@[^/\s@]+\.[^/\s@]+$') {
            throw 'Enter a valid email address without slashes.'
        }
        if ((Test-Path -LiteralPath $privateKey) -or (Test-Path -LiteralPath $requestPath)) {
            throw 'A signing key or request already exists in .ios-signing. Keep the existing key; this helper will not overwrite it.'
        }
        New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
        Read-SigningPassword
        try {
            & $openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -aes-256-cbc `
                -pass env:SETGO_SIGNING_PASSWORD -out $privateKey
            if ($LASTEXITCODE -ne 0) { throw 'Private key generation failed.' }
            & $openssl req -new -sha256 -key $privateKey -passin env:SETGO_SIGNING_PASSWORD `
                -out $requestPath -subj "/CN=SetGo GitHub Actions/emailAddress=$EmailAddress"
            if ($LASTEXITCODE -ne 0) { throw 'Certificate request generation failed.' }
        }
        finally { Remove-Item Env:SETGO_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
        Write-Host "Upload this request to Apple Developer: $requestPath"
        Write-Host 'Keep distribution.key and its password. See docs/github-actions-testflight.md for the next steps.'
    }
    'package' {
        Assert-File $privateKey 'Signing private key'
        Assert-File $CertificatePath 'Downloaded Apple Distribution certificate (.cer)'
        if (Test-Path -LiteralPath $defaultP12) { throw 'distribution.p12 already exists; it will not be overwritten.' }
        $pemPath = Join-Path $signingDirectory 'distribution.pem'
        & $openssl x509 -inform DER -in $CertificatePath -out $pemPath
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the DER .cer downloaded from Apple.' }
        Read-SigningPassword
        try {
            $keyPublic = & $openssl pkey -in $privateKey -passin env:SETGO_SIGNING_PASSWORD -pubout
            if ($LASTEXITCODE -ne 0) { throw 'Could not unlock the private key. Check its password.' }
            $certificatePublic = & $openssl x509 -in $pemPath -pubkey -noout
            if ($LASTEXITCODE -ne 0) { throw 'Could not read the certificate public key.' }
            if (($keyPublic -join "`n") -ne ($certificatePublic -join "`n")) {
                throw 'This certificate does not match this computer''s request. Download the certificate created with distribution.certSigningRequest.'
            }
            & $openssl pkcs12 -export -inkey $privateKey -in $pemPath -name 'SetGo Distribution' `
                -passin env:SETGO_SIGNING_PASSWORD -passout env:SETGO_SIGNING_PASSWORD -out $defaultP12
            if ($LASTEXITCODE -ne 0) { throw 'Could not create the .p12.' }
        }
        finally { Remove-Item Env:SETGO_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
        Write-Host "Created $defaultP12"
    }
    'register' {
        if (-not $P12Path) { $P12Path = $defaultP12 }
        Assert-File $P12Path 'Apple Distribution .p12'
        Assert-File $ProfilePath 'App Store Connect provisioning profile'
        Assert-File $ApiKeyPath 'App Store Connect API .p8 key'
        if ($ApiKeyId -notmatch '^[A-Z0-9]{10}$') { throw 'Supply the 10-character API Key ID with -ApiKeyId.' }
        $issuerGuid = [guid]::Empty
        if (-not [guid]::TryParse($IssuerId, [ref]$issuerGuid)) { throw 'Supply the API Issuer ID with -IssuerId.' }
        & gh auth status
        if ($LASTEXITCODE -ne 0) { throw 'Sign in to GitHub first using gh auth login.' }
        & $openssl pkey -in $ApiKeyPath -noout
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the API private key.' }
        Read-SigningPassword
        try {
            & $openssl pkcs12 -in $P12Path -passin env:SETGO_SIGNING_PASSWORD -noout
            if ($LASTEXITCODE -ne 0) { throw 'Could not unlock the .p12. Check its password.' }
            Set-RepositorySecret 'IOS_DISTRIBUTION_P12_BASE64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $P12Path).Path)))
            Set-RepositorySecret 'IOS_DISTRIBUTION_P12_PASSWORD' $env:SETGO_SIGNING_PASSWORD
            Set-RepositorySecret 'IOS_PROVISION_PROFILE_BASE64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ProfilePath).Path)))
            Set-RepositorySecret 'APP_STORE_CONNECT_API_KEY_P8' ([IO.File]::ReadAllText((Resolve-Path -LiteralPath $ApiKeyPath).Path))
            Set-RepositorySecret 'APP_STORE_CONNECT_API_KEY_ID' $ApiKeyId
            Set-RepositorySecret 'APP_STORE_CONNECT_ISSUER_ID' $issuerGuid.ToString()
        }
        finally { Remove-Item Env:SETGO_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
        Write-Host 'All six repository secrets are registered. Run iOS TestFlight Release with a new build number.'
    }
}
