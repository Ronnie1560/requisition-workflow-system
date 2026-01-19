#!/bin/bash
# Development Server Startup Script (Bash for Git Bash/WSL)
# Ensures only the multi-tenant client runs, not the old prototype

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Requisition Workflow - Dev Server${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Function to kill process on a specific port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Checking for processes on port $port...${NC}"

    # Find PIDs listening on the port
    local pids=$(netstat -ano 2>/dev/null | grep ":$port " | grep "LISTENING" | awk '{print $5}' | sort -u)

    if [ -z "$pids" ]; then
        echo -e "  ${GREEN}✓ No processes found on port $port${NC}"
    else
        for pid in $pids; do
            if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                echo -e "  ${RED}Killing process PID $pid on port $port...${NC}"
                taskkill //PID "$pid" //F > /dev/null 2>&1 || echo -e "  ${YELLOW}⚠ Could not kill process $pid${NC}"
                echo -e "  ${GREEN}✓ Killed process $pid${NC}"
            fi
        done
    fi
}

# Kill old prototype server (port 3000)
echo ""
echo -e "${CYAN}Step 1: Stopping old prototype server...${NC}"
kill_port 3000

# Kill any stuck client dev server (port 5173)
echo ""
echo -e "${CYAN}Step 2: Stopping any stuck dev servers...${NC}"
kill_port 5173

# Wait a moment for ports to free up
echo ""
echo -e "${GRAY}Waiting for ports to free up...${NC}"
sleep 2

# Start the correct client dev server
echo ""
echo -e "${CYAN}Step 3: Starting multi-tenant client dev server...${NC}"
echo ""
echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change to client directory
cd "$SCRIPT_DIR/client"

echo -e "${GRAY}📁 Working directory: $(pwd)${NC}"
echo -e "${GREEN}🚀 Starting Vite dev server on http://localhost:5173${NC}"
echo ""
echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run npm dev
npm run dev
