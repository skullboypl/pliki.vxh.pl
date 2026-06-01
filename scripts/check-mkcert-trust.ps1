$ErrorActionPreference = 'Stop'
$rootPath = Join-Path (& mkcert -CAROOT) 'rootCA.pem'
$root = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($rootPath)
$fileThumb = $root.Thumbprint

Write-Output "FILE_THUMB=$fileThumb"

$anyMatch = $false
$locations = @(
  [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser,
  [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine
)

foreach ($loc in $locations) {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    [System.Security.Cryptography.X509Certificates.StoreName]::Root,
    $loc
  )
  $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
  try {
    foreach ($c in $store.Certificates) {
      if ($c.Subject -like '*mkcert development CA*') {
        Write-Output "STORE=$loc"
        Write-Output "STORE_THUMB=$($c.Thumbprint)"
        if ($c.Thumbprint -eq $fileThumb) { $anyMatch = $true }
      }
    }
  } finally {
    $store.Close()
  }
}

Write-Output "ANY_MATCH=$anyMatch"
if (-not $anyMatch) { exit 1 }
exit 0
