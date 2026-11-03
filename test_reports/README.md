# Test Reports

This directory contains test execution reports and coverage data.

## Generated Files

Each test run creates timestamped files:

- `test_report_YYYYMMDD_HHMMSS.html` - HTML test report with detailed results
- `junit_YYYYMMDD_HHMMSS.xml` - JUnit XML format for CI/CD integration
- `coverage_YYYYMMDD_HHMMSS.json` - JSON coverage data
- `report_YYYYMMDD_HHMMSS.json` - JSON test results
- `test_log_YYYYMMDD_HHMMSS.txt` - Complete console output
- `latest_reports.html` - Quick access page to all latest reports

## Cleanup Policy

The test runner automatically keeps only the last 10 reports of each type to manage disk space.

## Usage

View `latest_reports.html` in a browser for easy access to all report types.
