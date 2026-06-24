# SDLC 2500-Cycle Batch Loop
# Watches batch-state.json; emits wake when currentBatch advances or status changes.
$statePath = Join-Path $PSScriptRoot ".." ".cursor" "cycles" "batch-state.json"
$lastBatch = -1
$lastCompleted = -1

while ($true) {
  Start-Sleep -Seconds 120
  if (Test-Path $statePath) {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $batch = [int]$state.currentBatch
    $completed = [int]$state.completedCycles
    if ($batch -ne $lastBatch -or $completed -ne $lastCompleted) {
      $payload = @{
        prompt = "Continue 2500-cycle SDLC program. Read .cursor/cycles/BATCH-CONTINUATION.md and batch-state.json. Run next batch (cycles $($state.nextCycleStart)-$($state.nextCycleEnd)) via sdlc-orchestrator. Auto-approve, auto-push. Stop only if completedCycles >= 2500 or ESCALATED."
        batch = $batch
        completedCycles = $completed
      } | ConvertTo-Json -Compress
      Write-Output "AGENT_LOOP_WAKE_SDLC2500 $payload"
      $lastBatch = $batch
      $lastCompleted = $completed
    }
  }
}
