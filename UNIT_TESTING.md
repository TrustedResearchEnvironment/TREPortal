# Unit Testing Guide for TRE Portal

This document explains how to run and understand the unit tests in the TRE Portal project. It's written for developers who may be new to unit testing.

---

## Table of Contents

1. [What is Unit Testing?](#what-is-unit-testing)
2. [Why We Write Unit Tests](#why-we-write-unit-tests)
3. [Prerequisites](#prerequisites)
4. [How to Run Tests](#how-to-run-tests)
5. [Understanding Test Output](#understanding-test-output)
6. [Test Files Summary](#test-files-summary)
7. [Detailed File Documentation](#detailed-file-documentation)
8. [Writing New Tests](#writing-new-tests)
9. [Troubleshooting](#troubleshooting)

---

## What is Unit Testing?

**Unit testing** is a software testing method where individual "units" of code (usually functions) are tested in isolation to ensure they work correctly.

Think of it like quality control in a factory:
- Before assembling a car, you test each part (engine, brakes, lights) separately
- If a part fails testing, you fix it before it causes problems in the assembled car
- Unit tests do the same thing for code — test each function individually

### Example

```javascript
// This is a simple function
function add(a, b) {
    return a + b;
}

// This is a unit test for that function
test('add should return 5 when adding 2 and 3', () => {
    expect(add(2, 3)).toBe(5);
});
```

---

## Why We Write Unit Tests

| Benefit | Description |
|---------|-------------|
| **Catch Bugs Early** | Find problems before they reach production |
| **Safe Refactoring** | Change code confidently knowing tests will catch breaks |
| **Documentation** | Tests show how functions should be used |
| **Regression Prevention** | Ensure old bugs don't come back |
| **Code Quality** | Writing testable code often leads to better design |

---

## Prerequisites

Before running tests, ensure you have:

1. **Node.js** installed (version 12 or higher)
2. **npm** (comes with Node.js)
3. Project dependencies installed

### Installing Dependencies

Open a terminal in the project root folder and run:

```bash
npm install
```

This installs Jest (our testing framework) and other required packages.

---

## How to Run Tests

### Run All Tests

```bash
npm test
```

This runs all 614 tests across all 8 test files.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

This keeps tests running and automatically re-runs them when you save changes to files. Very useful during development!

**Watch Mode Controls:**
- Press `a` to run all tests
- Press `f` to run only failed tests
- Press `q` to quit watch mode

### Run Tests with Coverage Report

```bash
npm run test:coverage
```

This shows you what percentage of your code is covered by tests. A coverage report will be generated in the `coverage/` folder.

### Run Tests for a Specific File

```bash
npm test -- --testPathPattern="filename"
```

**Examples:**

```bash
# Test only the approver module
npm test -- --testPathPattern="approver"

# Test only the userrequests module
npm test -- --testPathPattern="userrequests"

# Test only data source related files
npm test -- --testPathPattern="dataSource"
```

---

## Understanding Test Output

When you run `npm test`, you'll see output like this:

```
 PASS  AdminDashboards/DataSource/dataSourcePlatformAdmin.js
 PASS  AdminDashboards/DataSourceTypes/dataSouceTypesPlatformAdmin.js
 PASS  AdminDashboards/EmailTemplate/emailTemplatePlatformAdmin.js
 PASS  AdminDashboards/MetaData/metaDataPlatformAdmin.js
 PASS  AdminDashboards/Requests/requestsPlatformAdmin.js
 PASS  Dashboards/Approver/approver.js
 PASS  AdminDashboards/ManageDataSets/manageDataSets.js
 PASS  Dashboards/UserRequests/userrequests.js

Test Suites: 8 passed, 8 total
Tests:       614 passed, 614 total
Snapshots:   0 total
Time:        3.739 s
```

### What Each Line Means

| Output | Meaning |
|--------|---------|
| `PASS` | All tests in that file passed ✅ |
| `FAIL` | One or more tests in that file failed ❌ |
| `Test Suites: 8 passed` | 8 files with tests were run |
| `Tests: 614 passed` | 614 individual test cases passed |
| `Time: 3.739 s` | Total time to run all tests |

### When a Test Fails

Failed tests show detailed information:

```
 FAIL  Dashboards/UserRequests/userrequests.js
  ● userrequests.js › formatDate › should format valid date

    expect(received).toBe(expected)

    Expected: "January 10, 2025"
    Received: "January 9, 2025"

      at Object.<anonymous> (userrequests.js:1847:35)
```

This tells you:
- **Which test failed**: `formatDate › should format valid date`
- **What was expected**: `"January 10, 2025"`
- **What was actually returned**: `"January 9, 2025"`
- **Where to look**: Line 1847 in userrequests.js

---

## Test Files Summary

| File | Location | Tests | Description |
|------|----------|-------|-------------|
| **dataSourcePlatformAdmin.js** | `AdminDashboards/DataSource/` | 38 | Data source management admin page |
| **dataSouceTypesPlatformAdmin.js** | `AdminDashboards/DataSourceTypes/` | 40 | Data source types admin page |
| **emailTemplatePlatformAdmin.js** | `AdminDashboards/EmailTemplate/` | 55 | Email template management |
| **manageDataSets.js** | `AdminDashboards/ManageDataSets/` | 127 | Dataset creation and management |
| **metaDataPlatformAdmin.js** | `AdminDashboards/MetaData/` | 77 | Metadata configuration admin |
| **requestsPlatformAdmin.js** | `AdminDashboards/Requests/` | 75 | Platform admin requests view |
| **approver.js** | `Dashboards/Approver/` | 91 | Request approval/rejection workflow |
| **userrequests.js** | `Dashboards/UserRequests/` | 111 | User requests dashboard |
| **TOTAL** | — | **614** | — |

---

## Detailed File Documentation

### 1. dataSourcePlatformAdmin.js (38 tests)

**Purpose:** Manages data sources in the platform admin interface.

**What's Tested:**
- `safeParseJson` - Parsing API responses
- `formatDate` - Date formatting for display
- `renderPagination` - Pagination controls rendering
- `renderTable` - Table rendering with data
- `getDataSourceFormData` - Form data extraction
- `showToast` - Toast notification display

**APIs Mocked:**
- `GetDataSource`
- `UpdateDataSource`
- `GetDatabaseConnection`
- `GetDataSourceTypes`

---

### 2. dataSouceTypesPlatformAdmin.js (40 tests)

**Purpose:** Manages data source types (Database, Folder, REDCap, etc.).

**What's Tested:**
- `safeParseJson` - JSON parsing
- `formatDate` - Date formatting
- `renderPagination` - Pagination UI
- `renderTable` - Table display
- `getDataSrcTypeFormData` - Form data gathering
- `AddDataSrcType` - Modal population

**APIs Mocked:**
- `GetDataSourceTypes`
- `AddMetaData`
- `UpdateMetaData`

---

### 3. emailTemplatePlatformAdmin.js (55 tests)

**Purpose:** Manages email templates for notifications.

**What's Tested:**
- `safeParseJson` - Response parsing
- `formatDate` - Date display
- `renderPagination` - Page navigation
- `renderTable` - Template listing
- `renderAccordionDetails` - Expandable details view
- `showToast` - User notifications

**APIs Mocked:**
- `GetEmailTemplates`
- `UpdateEmailTemplate`

---

### 4. manageDataSets.js (127 tests)

**Purpose:** Create and manage datasets with SQL or Folder data sources.

**What's Tested:**
- `safeParseJson` - JSON handling
- `showToast` - Notifications
- `fetchSQLDataSetColumns` - Column data fetching
- `displayColumnsTable` - Column display
- `renderPagination` - Pagination
- `gatherFormData` - Complex form data collection
- `formatSQLColumnsFromSchema` - Schema formatting
- `loadColumnsData` - Data loading workflow
- `createDataSet` - Dataset creation API
- `updateDataSet` - Dataset update API

**APIs Mocked:**
- `GetColumnsDataByDataSetID`
- `GetLoomeDataSourceFolders`
- `GetLoomeDataSourceTablesByDataSourceID`
- `CreateDataSet`
- `UpdateDataSet`

---

### 5. metaDataPlatformAdmin.js (77 tests)

**Purpose:** Manages metadata fields for datasets.

**What's Tested:**
- `safeParseJson` - Response parsing
- `formatDate` - Date formatting
- `renderPagination` - Page controls
- `renderTable` - Metadata table display
- `getMetaDataFormData` - Form extraction
- `AddMetaData` - Add modal functionality
- `fetchAndRenderPage` - Data fetching and rendering

**APIs Mocked:**
- `GetMetaData`
- `AddMetaData`
- `UpdateMetaData`

---

### 6. requestsPlatformAdmin.js (75 tests)

**Purpose:** Platform admin view of all requests across the system.

**What's Tested:**
- `safeParseJson` - JSON parsing
- `formatDate` - Date display
- `renderPagination` - Pagination controls
- `renderTable` - Request table with status columns
- `ViewRequest` - Request details modal
- `ViewDataSet` - Dataset details modal
- `ApproveRequest` / `RejectRequest` - Action modals
- `getCounts` - Status counts for chips

**APIs Mocked:**
- `GetRequests`
- `ApproveRequestID`
- `RejectRequestID`
- `GetRequestID`
- `GetDataSetID`

---

### 7. approver.js (91 tests)

**Purpose:** Approver dashboard for reviewing and acting on requests.

**What's Tested:**
- `safeParseJson` - Response handling
- `formatDate` - Date formatting
- `renderPagination` - Page navigation
- `renderTable` - Request listing with actions
- `showToast` / `hideToast` - Notifications
- `fetchRequestDetails` / `fetchDatasetDetails` - API calls
- `getProjectsMapping` - Project data caching
- `displayCombinedDetails` - Combined view rendering
- `approveRequestFromAPI` / `rejectRequestFromAPI` - Actions
- `getCounts` / `refreshAllChipCounts` - Status tracking

**APIs Mocked:**
- `GetRequestList`
- `ApproveRequestID`
- `RejectRequestID`
- `GetRequestID`
- `GetDataSetID`
- `GetAllAssistProjects`

---

### 8. userrequests.js (111 tests)

**Purpose:** User-facing dashboard for viewing their own requests.

**What's Tested:**
- `safeParseJson` - JSON parsing
- `formatDate` - Date display
- `getDataSourceName` - Data source name lookup
- `formatFieldsForAccordion` - Field formatting
- `showToast` / `hideToast` / `createToastContainer` - Notifications
- `fetchRequestDetails` / `fetchDatasetDetails` - Data fetching
- `getProjectsMapping` - Project caching
- `displayRequestDetails` / `displayDatasetDetails` / `displayCombinedDetails` - Display functions
- `renderPagination` / `renderTable` / `renderUI` - UI rendering
- `ViewRequest` / `ViewDataSet` / `DeleteRequest` - Modal functions
- `deleteRequestFromAPI` - Delete functionality
- `getCounts` / `refreshAllChipCounts` - Status tracking

**APIs Mocked:**
- `GetRequests`
- `DeleteRequestID`
- `GetRequestID`
- `GetDataSetID`
- `GetAssistProjectsFilteredByUpn`

---

## Writing New Tests

### Test Structure

Tests in this project follow this pattern:

```javascript
describe('Function or Module Name', () => {
    
    beforeEach(() => {
        // Setup: runs before each test
        // Reset DOM, mocks, etc.
    });

    afterEach(() => {
        // Cleanup: runs after each test
    });

    test('should do something specific', () => {
        // Arrange: set up test data
        const input = 'test data';
        
        // Act: call the function
        const result = myFunction(input);
        
        // Assert: check the result
        expect(result).toBe('expected output');
    });
});
```

### Common Assertions

```javascript
// Equality
expect(value).toBe(5);              // Strict equality (===)
expect(value).toEqual({ a: 1 });    // Deep equality for objects

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(10);

// Strings
expect(string).toContain('substring');
expect(string).toMatch(/regex/);

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Exceptions
expect(() => badFunction()).toThrow();
expect(() => badFunction()).toThrow('error message');

// Async
await expect(asyncFunction()).resolves.toBe(value);
await expect(asyncFunction()).rejects.toThrow();
```

### Mocking the API

All files mock the `window.loomeApi.runApiRequest` function:

```javascript
beforeEach(() => {
    // Setup mock API
    mockApiRequest = jest.fn();
    window.loomeApi = { runApiRequest: mockApiRequest };
});

test('should fetch data', async () => {
    // Configure mock to return specific data
    mockApiRequest.mockResolvedValue({
        Results: [{ id: 1, name: 'Test' }],
        RowCount: 1
    });

    // Call function that uses the API
    const result = await fetchData();

    // Verify API was called correctly
    expect(mockApiRequest).toHaveBeenCalledWith('GetData', { page: 1 });
});
```

---

## Troubleshooting

### Tests Won't Run

**Problem:** `npm test` shows an error

**Solutions:**
1. Run `npm install` to ensure dependencies are installed
2. Check Node.js version: `node --version` (should be 12+)
3. Delete `node_modules` and run `npm install` again

### Tests Fail Unexpectedly

**Problem:** Tests were passing but now fail

**Solutions:**
1. Check if you modified any shared code
2. Run `npm test -- --clearCache` to clear Jest cache
3. Check for console errors in test output

### "Cannot find module" Error

**Problem:** Jest can't find a module

**Solutions:**
1. Ensure the file exists at the specified path
2. Check for typos in import statements
3. Run `npm install` if it's a package

### Tests Are Slow

**Problem:** Tests take too long to run

**Solutions:**
1. Use `npm test -- --testPathPattern="filename"` to run specific tests
2. Use watch mode: `npm run test:watch`
3. Press `f` in watch mode to only run failed tests

---

## Quick Reference Card

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm test -- --testPathPattern="name"` | Run tests matching pattern |
| `npm test -- --clearCache` | Clear Jest cache |
| `npm test -- --verbose` | Show detailed test output |

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)
- [Testing JavaScript](https://testingjavascript.com/)

---

*Last Updated: January 12, 2026*
*Total Tests: 614 across 8 files*
