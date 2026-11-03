#!/bin/bash
# Comprehensive test runner with HTML coverage and test reports
# Usage: ./run_tests.sh [options]
#   -v, --verbose    : Verbose test output
#   -k EXPRESSION    : Run tests matching expression
#   -m MARKER        : Run tests with specific marker
#   --update-snapshots : Update snapshot files

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_DIR="Testing"
COVERAGE_DIR="htmlcov"
REPORTS_DIR="test_reports"
REPORT_FILE="${REPORTS_DIR}/test_report_${TIMESTAMP}.html"
JUNIT_FILE="${REPORTS_DIR}/junit_${TIMESTAMP}.xml"
LOG_FILE="${REPORTS_DIR}/test_log_${TIMESTAMP}.txt"

# Default options
VERBOSE=""
SNAPSHOT_UPDATE=""
TEST_PATTERN=""
MARKER=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="-v -s"
            shift
            ;;
        --update-snapshots)
            SNAPSHOT_UPDATE="--snapshot-update"
            shift
            ;;
        -k)
            TEST_PATTERN="-k $2"
            shift 2
            ;;
        -m)
            MARKER="-m $2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "  -v, --verbose         : Verbose test output"
            echo "  --update-snapshots    : Update snapshot files"
            echo "  -k EXPRESSION         : Run tests matching expression"
            echo "  -m MARKER             : Run tests with specific marker"
            echo "  -h, --help            : Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Create reports directory if it doesn't exist
mkdir -p "${REPORTS_DIR}"

# Print header
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}         ${GREEN}TrustAPI Test Suite Runner${NC}                          ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Timestamp:${NC} ${TIMESTAMP}"
echo -e "${YELLOW}Test Directory:${NC} ${TEST_DIR}"
echo -e "${YELLOW}Coverage Report:${NC} ${COVERAGE_DIR}/index.html"
echo -e "${YELLOW}Test Report:${NC} ${REPORT_FILE}"
echo -e "${YELLOW}Log File:${NC} ${LOG_FILE}"
echo ""

# Check if pytest is installed
if ! python3 -m pytest --version &> /dev/null; then
    echo -e "${RED}Error: pytest is not installed${NC}"
    echo "Install with: python3 -m pip install pytest pytest-cov pytest-html pytest-json-report"
    exit 1
fi

echo -e "${BLUE}Using pytest from: $(python3 -m pytest --version)${NC}"
echo ""

# Clean old coverage data
echo -e "${BLUE}Cleaning old coverage data...${NC}"
rm -rf .coverage
rm -rf .pytest_cache
echo ""

# Run tests with coverage
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                    ${GREEN}Running Tests${NC}                              ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Build pytest command
PYTEST_CMD="python3 -m pytest ${TEST_DIR} \
    --cov=app \
    --cov=PortalLib \
    --cov=models \
    --cov-report=html:${COVERAGE_DIR} \
    --cov-report=term-missing \
    --cov-report=json:${REPORTS_DIR}/coverage_${TIMESTAMP}.json \
    --html=${REPORT_FILE} \
    --self-contained-html \
    --junitxml=${JUNIT_FILE} \
    --json-report \
    --json-report-file=${REPORTS_DIR}/report_${TIMESTAMP}.json \
    ${VERBOSE} \
    ${SNAPSHOT_UPDATE} \
    ${TEST_PATTERN} \
    ${MARKER} \
    | tee ${LOG_FILE}"

echo -e "${YELLOW}Command:${NC} ${PYTEST_CMD}"
echo ""

# Run the tests
if eval ${PYTEST_CMD}; then
    TEST_STATUS=0
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                   ${GREEN}Tests PASSED ✓${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
else
    TEST_STATUS=$?
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║${NC}                   ${RED}Tests FAILED ✗${NC}                             ${RED}║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""

# Generate coverage summary
if [ -f "${COVERAGE_DIR}/index.html" ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}                  ${GREEN}Coverage Summary${NC}                            ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Extract coverage percentage from coverage.json if available
    if [ -f "${REPORTS_DIR}/coverage_${TIMESTAMP}.json" ]; then
        TOTAL_COV=$(python3 -c "import json; data=json.load(open('${REPORTS_DIR}/coverage_${TIMESTAMP}.json')); print(f\"{data['totals']['percent_covered']:.2f}%\")" 2>/dev/null || echo "N/A")
        echo -e "${YELLOW}Total Coverage:${NC} ${TOTAL_COV}"
    fi
    
    echo -e "${YELLOW}HTML Report:${NC} file://${PWD}/${COVERAGE_DIR}/index.html"
    echo ""
fi

# Print test results summary
if [ -f "${REPORTS_DIR}/report_${TIMESTAMP}.json" ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}                   ${GREEN}Test Statistics${NC}                            ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    python3 << EOF
import json
with open('${REPORTS_DIR}/report_${TIMESTAMP}.json', 'r') as f:
    data = json.load(f)
    summary = data.get('summary', {})
    print(f"Total Tests:  {summary.get('total', 0)}")
    print(f"Passed:       {summary.get('passed', 0)} ✓")
    print(f"Failed:       {summary.get('failed', 0)} ✗")
    print(f"Skipped:      {summary.get('skipped', 0)} ⊘")
    print(f"Errors:       {summary.get('error', 0)} ⚠")
    print(f"Duration:     {data.get('duration', 0):.2f}s")
EOF
    echo ""
fi

# Print report locations
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                    ${GREEN}Report Files${NC}                               ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Coverage HTML:${NC}  file://${PWD}/${COVERAGE_DIR}/index.html"
echo -e "${YELLOW}Test HTML:${NC}      file://${PWD}/${REPORT_FILE}"
echo -e "${YELLOW}JUnit XML:${NC}      ${JUNIT_FILE}"
echo -e "${YELLOW}Coverage JSON:${NC}  ${REPORTS_DIR}/coverage_${TIMESTAMP}.json"
echo -e "${YELLOW}Test JSON:${NC}      ${REPORTS_DIR}/report_${TIMESTAMP}.json"
echo -e "${YELLOW}Test Log:${NC}       ${LOG_FILE}"
echo ""

# Generate quick links file
LINKS_FILE="${REPORTS_DIR}/latest_reports.html"
cat > ${LINKS_FILE} << EOF
<!DOCTYPE html>
<html>
<head>
    <title>TrustAPI Test Reports - ${TIMESTAMP}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        .report-section {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .report-section h2 {
            color: #34495e;
            margin-top: 0;
        }
        .report-link {
            display: block;
            padding: 15px;
            margin: 10px 0;
            background-color: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        }
        .report-link:hover {
            background-color: #2980b9;
        }
        .info {
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .timestamp {
            background-color: #ecf0f1;
            padding: 10px;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>🧪 TrustAPI Test Reports</h1>
    
    <div class="timestamp">
        <strong>Generated:</strong> ${TIMESTAMP}<br>
        <strong>Status:</strong> <span style="color: $([ ${TEST_STATUS} -eq 0 ] && echo 'green' || echo 'red')">$([ ${TEST_STATUS} -eq 0 ] && echo 'PASSED ✓' || echo 'FAILED ✗')</span>
    </div>

    <div class="report-section">
        <h2>📊 Coverage Reports</h2>
        <a href="../${COVERAGE_DIR}/index.html" class="report-link">
            📈 HTML Coverage Report
        </a>
        <p class="info">Detailed line-by-line coverage analysis with highlighted source code</p>
    </div>

    <div class="report-section">
        <h2>✅ Test Results</h2>
        <a href="./test_report_${TIMESTAMP}.html" class="report-link">
            📋 HTML Test Report
        </a>
        <p class="info">Comprehensive test results with pass/fail status and error details</p>
        
        <a href="./junit_${TIMESTAMP}.xml" class="report-link">
            🔧 JUnit XML Report
        </a>
        <p class="info">Machine-readable format for CI/CD integration</p>
    </div>

    <div class="report-section">
        <h2>📄 JSON Data</h2>
        <a href="./coverage_${TIMESTAMP}.json" class="report-link">
            📊 Coverage JSON
        </a>
        
        <a href="./report_${TIMESTAMP}.json" class="report-link">
            📝 Test Results JSON
        </a>
        <p class="info">Structured data for custom analysis and reporting</p>
    </div>

    <div class="report-section">
        <h2>📝 Logs</h2>
        <a href="./test_log_${TIMESTAMP}.txt" class="report-link">
            📄 Test Execution Log
        </a>
        <p class="info">Complete console output from test execution</p>
    </div>

    <hr style="margin: 40px 0; border: none; border-top: 2px solid #ecf0f1;">
    
    <div style="text-align: center; color: #95a5a6;">
        <p>Generated by TrustAPI Test Runner</p>
    </div>
</body>
</html>
EOF

echo -e "${GREEN}Quick Access:${NC}   file://${PWD}/${LINKS_FILE}"
echo ""

# Open reports in browser (optional, commented out by default)
# Uncomment to auto-open reports after test run
# xdg-open "${PWD}/${LINKS_FILE}" 2>/dev/null || open "${PWD}/${LINKS_FILE}" 2>/dev/null || true

# Clean up old reports (delete all except current)
echo -e "${BLUE}Cleaning up old reports...${NC}"
cd "${REPORTS_DIR}"
# Keep only the current reports (from this run)
ls -t test_report_*.html 2>/dev/null | tail -n +2 | xargs -r rm
ls -t junit_*.xml 2>/dev/null | tail -n +2 | xargs -r rm
ls -t coverage_*.json 2>/dev/null | tail -n +2 | xargs -r rm
ls -t report_*.json 2>/dev/null | tail -n +2 | xargs -r rm
ls -t test_log_*.txt 2>/dev/null | tail -n +2 | xargs -r rm
cd - > /dev/null

echo -e "${GREEN}Cleanup complete.${NC}"
echo ""

# Final summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                  ${GREEN}Test Run Complete${NC}                            ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

exit ${TEST_STATUS}
