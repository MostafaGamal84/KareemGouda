param(
    [string]$LocalDir = 'publish\production',
    [string]$FtpHost = 'GOUDAPREP.somee.com',
    [string]$RemoteRoot = '/www.GOUDAPREP.somee.com',
    [string]$CredentialTarget = 'Codex_GOUDAPREP_FTP'
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $LocalDir))
if (-not $sourceDir.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Deployment source must stay inside the repository.'
}
if (-not (Test-Path -LiteralPath (Join-Path $sourceDir 'API.dll'))) {
    throw "API.dll was not found in $sourceDir. Build the production package first."
}
if (-not (Test-Path -LiteralPath (Join-Path $sourceDir 'wwwroot\index.html'))) {
    throw "wwwroot\index.html was not found in $sourceDir. Build the production package first."
}
if ($RemoteRoot -notmatch '^/www\.[A-Za-z0-9.-]+$') {
    throw 'The remote root must be an explicit Somee website folder.'
}

if (-not ('NativeCredentialStore' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class NativeCredentialStore
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL
    {
        public UInt32 Flags;
        public UInt32 Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr credentialPtr);
}
'@
}

function Get-StoredCredential([string]$Target) {
    $credentialPtr = [IntPtr]::Zero
    if (-not [NativeCredentialStore]::CredRead($Target, 1, 0, [ref]$credentialPtr)) {
        throw "Windows Credential Manager entry '$Target' was not found."
    }

    try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
            $credentialPtr,
            [type][NativeCredentialStore+CREDENTIAL]
        )
        $username = [Runtime.InteropServices.Marshal]::PtrToStringUni($credential.UserName)
        $password = if ($credential.CredentialBlobSize -gt 0) {
            [Runtime.InteropServices.Marshal]::PtrToStringUni(
                $credential.CredentialBlob,
                [int]($credential.CredentialBlobSize / 2)
            )
        } else { '' }
        return [System.Net.NetworkCredential]::new($username, $password)
    }
    finally {
        [NativeCredentialStore]::CredFree($credentialPtr)
    }
}

function New-FtpRequest([string]$RemotePath, [string]$Method) {
    $path = ($RemotePath -replace '\\', '/').TrimStart('/')
    $uri = [Uri]("ftp://$FtpHost/$path")
    $request = [System.Net.FtpWebRequest]::Create($uri)
    $request.Method = $Method
    $request.Credentials = $script:ftpCredential
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $request.Timeout = 180000
    $request.ReadWriteTimeout = 180000
    return $request
}

function Invoke-FtpRequest([System.Net.FtpWebRequest]$Request) {
    $response = $Request.GetResponse()
    try { return $response.StatusDescription.Trim() }
    finally { $response.Close() }
}

function Ensure-RemoteDirectory([string]$RemotePath) {
    try {
        $request = New-FtpRequest $RemotePath ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
        [void](Invoke-FtpRequest $request)
    }
    catch [System.Net.WebException] {
        $response = $_.Exception.Response -as [System.Net.FtpWebResponse]
        if (-not $response -or [int]$response.StatusCode -notin 550, 521) { throw }
        $response.Close()
    }
}

function Send-Bytes([string]$RemotePath, [byte[]]$Bytes) {
    $request = New-FtpRequest $RemotePath ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $request.ContentLength = $Bytes.Length
    $stream = $request.GetRequestStream()
    try { $stream.Write($Bytes, 0, $Bytes.Length) }
    finally { $stream.Close() }
    [void](Invoke-FtpRequest $request)
}

function Send-File([string]$LocalPath, [string]$RemotePath) {
    $fileInfo = Get-Item -LiteralPath $LocalPath
    $request = New-FtpRequest $RemotePath ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $request.ContentLength = $fileInfo.Length
    $input = [System.IO.File]::OpenRead($fileInfo.FullName)
    $output = $request.GetRequestStream()
    try { $input.CopyTo($output) }
    finally {
        $input.Close()
        $output.Close()
    }
    [void](Invoke-FtpRequest $request)
}

function Send-FileWithRetry([string]$LocalPath, [string]$RemotePath) {
    $attempts = 5
    for ($attempt = 1; $attempt -le $attempts; $attempt++) {
        try {
            Send-File $LocalPath $RemotePath
            return
        }
        catch {
            if ($attempt -eq $attempts) {
                throw "Failed to upload '$RemotePath' after $attempts attempts: $($_.Exception.Message)"
            }
            Start-Sleep -Seconds (2 * $attempt)
        }
    }
}

function Remove-RemoteFile([string]$RemotePath) {
    try {
        $request = New-FtpRequest $RemotePath ([System.Net.WebRequestMethods+Ftp]::DeleteFile)
        [void](Invoke-FtpRequest $request)
    }
    catch [System.Net.WebException] {
        $response = $_.Exception.Response -as [System.Net.FtpWebResponse]
        if (-not $response -or [int]$response.StatusCode -ne 550) { throw }
        $response.Close()
    }
}

function Get-RelativeDeployPath([string]$FullPath) {
    $prefix = $sourceDir.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $FullPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the deployment source: $FullPath"
    }
    return $FullPath.Substring($prefix.Length) -replace '\\', '/'
}

function ConvertTo-CurlConfigValue([string]$Value) {
    return $Value.Replace('\', '\\').Replace('"', '\"')
}

function Invoke-CurlFtp([string[]]$ConfigLines) {
    $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processInfo.FileName = 'curl.exe'
    $processInfo.Arguments = '--config -'
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.RedirectStandardInput = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true

    $process = [System.Diagnostics.Process]::Start($processInfo)
    $credentialValue = ConvertTo-CurlConfigValue "$($script:ftpCredential.UserName):$($script:ftpCredential.Password)"
    $baseConfig = @(
        'silent',
        'show-error',
        'fail',
        'ftp-pasv',
        'retry = 5',
        'retry-delay = 3',
        'retry-all-errors',
        'connect-timeout = 30',
        'max-time = 300',
        "user = `"$credentialValue`""
    )
    foreach ($line in ($baseConfig + $ConfigLines)) {
        $process.StandardInput.WriteLine($line)
    }
    $process.StandardInput.Close()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
        throw "curl FTP failed (exit $($process.ExitCode)): $stderr"
    }
    return $stdout
}

function Send-CurlFile([string]$LocalPath, [string]$RemotePath) {
    $localValue = ConvertTo-CurlConfigValue (($LocalPath -replace '\\', '/'))
    $urlValue = ConvertTo-CurlConfigValue ("ftp://$FtpHost/" + $RemotePath.TrimStart('/'))
    [void](Invoke-CurlFtp @(
        'ftp-create-dirs',
        "upload-file = `"$localValue`"",
        "url = `"$urlValue`""
    ))
}

function Remove-CurlRemoteFile([string]$RemotePath) {
    $urlValue = ConvertTo-CurlConfigValue "ftp://$FtpHost/"
    $deleteValue = ConvertTo-CurlConfigValue ("DELE " + $RemotePath.TrimStart('/'))
    [void](Invoke-CurlFtp @(
        'no-body',
        "quote = `"$deleteValue`"",
        "url = `"$urlValue`""
    ))
}

$script:ftpCredential = Get-StoredCredential $CredentialTarget
$pythonScript = Join-Path $PSScriptRoot 'deploy_somee_ftp.py'
$maintenanceFile = Join-Path $PSScriptRoot 'app_offline.htm'
$env:GOUDAPREP_FTP_USER = $script:ftpCredential.UserName
$env:GOUDAPREP_FTP_PASSWORD = $script:ftpCredential.Password
try {
    & python $pythonScript --source $sourceDir --host $FtpHost --remote-root $RemoteRoot --maintenance-file $maintenanceFile
    if ($LASTEXITCODE -ne 0) { throw "Python FTP deployment failed with exit code $LASTEXITCODE." }
}
finally {
    Remove-Item Env:GOUDAPREP_FTP_USER -ErrorAction SilentlyContinue
    Remove-Item Env:GOUDAPREP_FTP_PASSWORD -ErrorAction SilentlyContinue
}
