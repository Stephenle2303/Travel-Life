[CmdletBinding()]
param(
    [string]$DockerExe = 'docker',
    [switch]$FullSuite,
    [switch]$SchedulerSuite,
    [string[]]$DraftMigration = @(),
    [string[]]$AdditionalFixture = @()
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($SchedulerSuite -and ($FullSuite -or $DraftMigration.Count -gt 0 -or $AdditionalFixture.Count -gt 0)) {
    throw 'SchedulerSuite owns its synthetic fixture list; do not combine with other suites.'
}
if ($SchedulerSuite) {
    $AdditionalFixture = @(
        'supabase/tests/private-history-scheduler-setup.sql',
        '_bmad-output/implementation-artifacts/m6-m7-cleanup-scheduler-draft.sql',
        'supabase/tests/private-history-scheduler-negative.sql',
        'supabase/tests/private-history-scheduler-assert.sql'
    )
}
if ($FullSuite) {
    if ($DraftMigration.Count -gt 0 -or $AdditionalFixture.Count -gt 0) {
        throw 'FullSuite owns the ordered draft and fixture list; do not combine it with custom SQL lists.'
    }
    # The ordered drafts are now consolidated in the M6/M7 migration and are
    # applied through the migration list below; never apply both copies.
    $AdditionalFixture = @(
        'supabase/tests/private-history-media-selection.sql',
        'supabase/tests/private-history-media-selection-scale.sql',
        'supabase/tests/private-history-media-selection-privacy-shapes.sql',
        'supabase/tests/private-history-account-controls.sql',
        'supabase/tests/private-history-continuity.sql',
        'supabase/tests/private-history-source-impact.sql',
        'supabase/tests/private-history-account-deletion.sql',
        'supabase/tests/private-history-corrections.sql',
        'supabase/tests/private-history-media-abandon.sql',
        'supabase/tests/private-history-legacy.sql'
        'supabase/tests/private-history-replay-fragments.sql'
        'supabase/tests/private-history-replay-scale.sql'
        'supabase/tests/private-history-large-metadata.sql'
        'supabase/tests/private-history-finalization-budget.sql'
        'supabase/tests/private-history-checkpoint.sql'
    )
}
# Official postgres:17-alpine image, downloaded and verified on 2026-10-28.
$image = 'postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
$testIdentity = [Guid]::NewGuid().ToString('N')
$containerName = "travel-life-sql-$testIdentity"
$containerId = $null

function Resolve-TestSql([string]$Path) {
    $resolved = (Resolve-Path -LiteralPath (Join-Path $projectRoot $Path)).Path
    $relative = [IO.Path]::GetRelativePath($projectRoot, $resolved)
    if ($relative -eq '..' -or $relative.StartsWith("..$([IO.Path]::DirectorySeparatorChar)") -or [IO.Path]::IsPathRooted($relative) -or [IO.Path]::GetExtension($resolved) -ne '.sql') {
        throw 'Test SQL must be a known .sql file inside this checkout.'
    }
    return $resolved
}

function Invoke-TestSql([string]$Path) {
    $output = Get-Content -Raw -LiteralPath $Path | & $DockerExe exec -i $containerId psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A 2>&1
    if ($LASTEXITCODE -ne 0) {
        # All admitted files are synthetic test sources; show SQL diagnostics only
        # on failure, never credentials or Docker environment inspection.
        Write-Output $output
        throw "SQL verification failed: $(Split-Path -Leaf $Path)"
    }
    $output | Where-Object { "$_".StartsWith('PASS:') } | Write-Output
}

# Resolve every input before starting a process or changing the test database.
$bootstrap = Resolve-TestSql 'supabase/tests/local-bootstrap.sql'
$migrations = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'supabase/migrations') -File | Where-Object Name -Match '_m[67]_' | Sort-Object Name | ForEach-Object FullName)
$drafts = @($DraftMigration | ForEach-Object { Resolve-TestSql $_ })
$fixtures = @('supabase/tests/private-history-account.sql', 'supabase/tests/private-history-aggregate.sql', 'supabase/tests/private-history-source-retention.sql', 'supabase/tests/private-history-media.sql') + $AdditionalFixture
$fixturePaths = @($fixtures | ForEach-Object { Resolve-TestSql $_ })
$dockerCommand = Get-Command $DockerExe -ErrorAction Stop
$DockerExe = $dockerCommand.Source
# The desktop credential helper lives beside docker.exe on per-user installs.
$env:PATH = (Split-Path -Parent $DockerExe) + [IO.Path]::PathSeparator + $env:PATH

try {
    $started = & $DockerExe run --detach --rm --network none --label "travel-life-test=$testIdentity" --name $containerName -e POSTGRES_HOST_AUTH_METHOD=trust $image
    if ($LASTEXITCODE -ne 0 -or "$started" -notmatch '^[a-f0-9]{64}$') { throw 'Could not start the isolated PostgreSQL test container.' }
    $containerId = "$started".Trim()
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & $DockerExe exec $containerId pg_isready -U postgres *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'The isolated PostgreSQL test server did not become ready.' }
    Invoke-TestSql $bootstrap
    foreach ($migration in $migrations + $drafts) { Invoke-TestSql $migration }
    foreach ($fixture in $fixturePaths) {
        Invoke-TestSql $fixture
        Write-Output "PASS: $(Split-Path -Leaf $fixture)"
    }
    Write-Output "PASS: $($fixturePaths.Count) local PostgreSQL rollback fixture files (synthetic Auth/Storage contracts)."
}
finally {
    if ($containerId) {
        $ownerLabel = & $DockerExe inspect --format '{{index .Config.Labels "travel-life-test"}}' $containerId
        if ($LASTEXITCODE -eq 0 -and "$ownerLabel".Trim() -eq $testIdentity) {
            & $DockerExe stop --timeout 5 $containerId | Out-Null
            if ($LASTEXITCODE -ne 0) { Write-Warning "Could not stop the owned test container $containerId." }
        }
        else { Write-Warning 'Skipped container cleanup because its ownership label could not be verified.' }
    }
}
