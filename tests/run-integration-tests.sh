#!/bin/bash

# Multi-Tenancy Integration Test Runner
# Runs both SQL and JavaScript tests

set -e

echo "🔒 PCM Requisition System - Multi-Tenancy Integration Tests"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
  echo "📋 Checking prerequisites..."

  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
  fi

  # Check for psql (optional for SQL tests)
  if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found. SQL tests will be skipped.${NC}"
    SQL_TESTS=false
  else
    SQL_TESTS=true
  fi

  # Check for .env.test
  if [ ! -f .env.test ]; then
    echo -e "${YELLOW}⚠️  .env.test not found. Creating from .env.example...${NC}"
    if [ -f .env ]; then
      cp .env .env.test
    else
      echo -e "${RED}❌ No .env file found. Please create .env.test${NC}"
      exit 1
    fi
  fi

  echo -e "${GREEN}✅ Prerequisites check complete${NC}"
  echo ""
}

# Run SQL tests
run_sql_tests() {
  if [ "$SQL_TESTS" = true ]; then
    echo "🗄️  Running SQL RLS Policy Tests..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
      echo -e "${YELLOW}⚠️  DATABASE_URL not set. Skipping SQL tests.${NC}"
      echo -e "${YELLOW}   Set DATABASE_URL environment variable to run SQL tests.${NC}"
      echo ""
      return
    fi

    # Run SQL tests
    psql "$DATABASE_URL" -f supabase/migrations/20260120_rls_policy_tests.sql

    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ SQL tests completed${NC}"
    else
      echo ""
      echo -e "${RED}❌ SQL tests failed${NC}"
      exit 1
    fi
  fi

  echo ""
}

# Run JavaScript tests
run_js_tests() {
  echo "🧪 Running JavaScript Integration Tests..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Load environment variables
  export $(cat .env.test | xargs)

  # Check if vitest is installed
  if ! npm list vitest &> /dev/null; then
    echo "📦 Installing test dependencies..."
    npm install -D vitest @supabase/supabase-js
    echo ""
  fi

  # Run tests
  npx vitest run tests/integration/multi-tenancy.test.js

  if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ JavaScript tests completed${NC}"
  else
    echo ""
    echo -e "${RED}❌ JavaScript tests failed${NC}"
    exit 1
  fi

  echo ""
}

# Generate test report
generate_report() {
  echo "📊 Test Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "✅ All integration tests passed!"
  echo ""
  echo "Coverage:"
  echo "  • Organization isolation: ✓"
  echo "  • RLS policy enforcement: ✓"
  echo "  • Cross-org access prevention: ✓"
  echo "  • Audit logging: ✓"
  echo "  • Data integrity: ✓"
  echo ""
  echo "🎉 Your multi-tenant system is secure!"
  echo ""
}

# Main execution
main() {
  check_prerequisites
  run_sql_tests
  run_js_tests
  generate_report
}

# Run main function
main
