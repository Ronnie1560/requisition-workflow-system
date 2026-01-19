#!/usr/bin/env pwsh
# Development Server Startup Script (PowerShell)
# Ensures only the multi-tenant client runs, not the old prototype

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Requisition Workflow - Dev Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to kill process on a specific port
function Kill-ProcessOnPort {
    param([int]$Port)

    Write-Host "Checking for processes on port $Port..." -ForegroundColor Yellow

    $connections = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"

    if ($connections) {
        foreach ($connection in $connections) {
            $parts = $connection.ToString() -split '\s+' | Where-Object { $_ -ne '' }
            $processId = $parts[-1]

            if ($processId -and $processId -match '^\d+$') {
                try {
                    Write-Host "  Killing process PID $processId on port $Port..." -ForegroundColor Red
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "  OK: Killed process $processId" -ForegroundColor Green
                } catch {
                    Write-Host "  Warning: Could not kill process $processId (may require admin)" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "  OK: No processes found on port $Port" -ForegroundColor Green
    }
}

# Kill old prototype server (port 3000)
Write-Host ""
Write-Host "Step 1: Stopping old prototype server..." -ForegroundColor Cyan
Kill-ProcessOnPort -Port 3000

# Kill any stuck client dev server (port 5173)
Write-Host ""
Write-Host "Step 2: Stopping any stuck dev servers..." -ForegroundColor Cyan
Kill-ProcessOnPort -Port 5173

# Wait a moment for ports to free up
Start-Sleep -Seconds 2

# Start the correct client dev server
Write-Host ""
Write-Host "Step 3: Starting multi-tenant client dev server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Change to client directory and start dev server
Set-Location -Path (Join-Path $PSScriptRoot "client")

Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "Starting Vite dev server on http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Run npm dev
npm run dev
