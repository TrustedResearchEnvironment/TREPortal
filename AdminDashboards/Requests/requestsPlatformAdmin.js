// =================================================================
//                      STATE & CONFIGURATION
// =================================================================
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_ALL_REQUEST = 'GetAllRequests';
const API_APPROVE_REQUEST = 'ApproveRequestID';
const API_REJECT_REQUEST = 'RejectRequestID';

// We will store all fetched data here
let allRequests = []; 
let currentPage = 1;
const rowsPerPage = 5; // You can control page size here

// Helper function to get search input (handles lazy DOM lookup for testing)
function getSearchInput() {
    return document.getElementById('searchRequests');
}

// Mapping from Status ID to Status Name
const statusIdToNameMap = { 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected' };

// Configuration for each status tab
const configMap = {
    'Pending Approval': { showActions: true },
    'Approved': { showActions: true },
    'Rejected': { showActions: true },
    'Finalised': { showActions: true },
};

// =================================================================
//                      UTILITY & MODAL FUNCTIONS
// =================================================================
function ViewRequest(request) {
    // Get the modal's body element
    const modalBody = document.getElementById('viewRequestModalBody');
    console.log("IN VIEW REQ")
    // Populate the modal body with the provided HTML content (your markup)
    modalBody.innerHTML = `
        <form>
            <div class="form-group">
            <label for="Name" class="control-label">Request Name</label>
            <input id="Name" class="form-control" disabled="true" value="${request.name}">
        </div>
            <div class="form-group">
                <label for="ProjectID" class="control-label">Assist Project</label>
                <select id="ProjectID" disabled="true" class="form-control selectpicker valid">
                    <option value="-1">Assist Project 1</option>
                </select>
            </div>
            <div class="form-group">
                <label for="ScheduleRefresh" class="control-label">Scheduled Refresh</label>
                <select id="ScheduleRefresh" disabled="true" class="form-control selectpicker valid">
                    <option value="No Refresh">No Refresh</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                </select>
            </div>
            <div class="row">
                <label for="ScheduleRefresh" class="control-label">Filter's for this Data Set</label>
                <div class="table-responsive">
                    <table class="table table-condensed table-striped">
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Filter Type</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Example of empty table body; data can be populated later -->
                            <tr>
                                <td colspan="3">No filters available.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </form>
    `;

}

function ViewDataSet(request) {
    // Get the modal elements
    const modalBody = document.getElementById('viewDatasetModalBody');
    //const modalTitle = document.getElementById('viewDatasetModalLabel');

    // Set the title dynamically based on datasetID (example usage; modify as needed)
    //modalTitle.textContent = `Details for Dataset ID: ${datasetID}`;

    // Populate the modal body with the provided complex HTML content
    modalBody.innerHTML = `
        <form>
            <div class="form-group">
                <label for="Description" class="control-label">Description</label>
                <textarea rows="2" id="Name" disabled="true" class="form-control valid"></textarea>
            </div>
            <div class="form-group">
                <label for="Approvers" class="control-label">Owner</label>
                <input id="Approvers" disabled="true" class="form-control valid">
            </div>
            <div class="form-group">
                <label for="Approvers" class="control-label">Approvers</label>
                <input id="Approvers" disabled="true" class="form-control valid" value="${request.approvers}">
            </div>
            
            <div class="form-group">
                <label for="DataSetType" class="form-check-label">Data Source</label>
                <select disabled="true" class="form-control selectpicker valid">
                    <option value="1">BIS Data (pilot test)</option>
                    <option value="4">Barwon Health DB Source View 1</option>
                    <option value="25">Source Mock SQL Data for Testing</option>
                </select>
            </div>
            <div class="form-group">
                <div class="form-check">
                    <input id="Active" disabled="true" type="checkbox" class="form-check-input valid">
                    <label for="Active" class="form-check-label">Active</label>
                </div>
            </div>
            <br>
            <h6>Data Set Fields</h6>
            <div class="table-responsive">
                <table class="table table-condensed table-striped">
                    <tbody>
                        <tr>
                            <td>Table Name <input type="text" hidden="true"></td>
                            <td width="70%">
                                <select disabled="true" class="form-control selectpicker valid">
                                    <option value="7">dbo.vw_emergency_attendances</option>
                                    <option value="8">dbo.vw_inpatient_admissions_university_hospital_geelong</option>
                                    <option value="9">dbo.vw_link_emergency_attendances_inpatient_admissions</option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <br>
            <h6>Meta Data</h6>
            <div class="table-responsive">
                <table class="table table-condensed table-striped">
                    <tbody>
                        <tr>
                            <td>Tag <input type="text" hidden="true"></td>
                            <td width="70%">
                                <input id="Name" disabled="true" class="form-control valid">
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <br>
            <h6>Columns</h6>
            <div class="container-fluid">
                <div class="d-flex align-items-center justify-content-between">
                    <!-- Section for Attendance Number -->
                    <div class="flex-grow-1">
                        <h6 style="color: orange;">[attendance_number] (varchar)</h6>
                        <input type="text" hidden="true">
                    </div>
                
                    <!-- Section for Checkboxes -->
                    <div class="d-flex">
                        <div class="form-check me-3">
                            <input id="Redact" disabled="true" type="checkbox" class="form-check-input">
                            <label for="Redact" class="form-check-label">Redact</label>
                        </div>
                        <div class="form-check me-3">
                            <input id="Tokenise" disabled="true" type="checkbox" class="form-check-input">
                            <label for="Tokenise" class="form-check-label">Tokenise</label>
                        </div>
                        <div class="form-check">
                            <input id="IsFilter" disabled="true" type="checkbox" class="form-check-input">
                            <label for="IsFilter" class="form-check-label">IsFilter</label>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="form-group col-md-6">
                        <label for="LogicalColumnName">Logical Name</label>
                        <input id="LogicalColumnName" disabled="true" class="form-control valid">
                    </div>
                    <div class="form-group col-md-6">
                        <label for="ExampleValue">Example Value</label>
                        <input id="ExampleValue" disabled="true" class="form-control valid">
                    </div>
                </div>
                <div class="row">
                    <div class="form-group col-md-12">
                        <label for="BusinessDescription">Business Description</label>
                        <input id="BusinessDescription" disabled="true" class="form-control valid">
                    </div>
                </div>
                <br>
            </div>
        </form>
    `;

}

function ApproveRequest(request) {
            // Get the modal elements
            const modalBody = document.getElementById('approveRequestModalBody');
            const modalTitle = document.getElementById('approveRequestModalLabel');

            // Update the modal title dynamically based on requestID
            modalTitle.textContent = `Approve Request: ${request.name}`;

            // Populate the modal body with the dynamic content
            modalBody.innerHTML = `
                <div class="col-md-12">
                    <form>
                        <div class="form-group">
                            <label for="ApprovalMessage" class="control-label">Approval Note</label>
                            <textarea id="ApprovalMessage" rows="5" placeholder="Note to the Researcher if approved" class="form-control valid"></textarea>
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-accent">Approve</button>
                            <button type="button" class="btn btn-default" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </form>
                </div>
            `;
}

function RejectRequest(request) {
            // Get the modal elements
            const modalBody = document.getElementById('rejectRequestModalBody');
            const modalTitle = document.getElementById('rejectRequestModalLabel');

            // Update the modal title dynamically based on requestID
            modalTitle.textContent = `Reject Request: ${request.name}`;

            // Populate the modal body with the dynamic content
            modalBody.innerHTML = `
                <div class="col-md-12">
                    <form>
                        <div class="form-group">
                            <label for="RequestMessage" class="control-label">Rejection Note</label>
                            <textarea id="RequestMessage" rows="5" placeholder="Note to the Researcher if rejected" class="form-control valid"></textarea>
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-accent">Reject</button>
                            <button type="button" class="btn btn-default" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </form>
                </div>
            `;
}

/**
 * Safely parses a response that might be a JSON string or an object.
 * @param {string | object} response The API response.
 * @returns {object}
 */
function safeParseJson(response) {
    return typeof response === 'string' ? JSON.parse(response) : response;
}

/**
* Renders a compact and functional set of pagination controls.
* Includes First, Previous, Next, Last buttons and a page input field.
*/
function renderPagination(containerId, totalItems, itemsPerPage, currentPage) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Pagination container with ID "${containerId}" not found.`);
        return;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    container.innerHTML = ''; // Clear old controls

    if (totalPages <= 1) {
        return; // No need for pagination.
    }

    // --- Determine button states ---
    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage === totalPages;
    const commonButtonClasses = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100";
    const disabledClasses = "opacity-50 cursor-not-allowed";

    // --- Build the HTML string ---
    let paginationHTML = `
        <div class="flex items-center gap-2">
            <!-- First Page Button -->
            <button data-page="1" 
                    class="${commonButtonClasses} ${isFirstPage ? disabledClasses : ''}" 
                    ${isFirstPage ? 'disabled' : ''}>
                First
            </button>
            <!-- Previous Page Button -->
            <button data-page="${currentPage - 1}" 
                    class="${commonButtonClasses} ${isFirstPage ? disabledClasses : ''}" 
                    ${isFirstPage ? 'disabled' : ''}>
                Previous
            </button>
        </div>

        <!-- Page number input and display -->
        <div class="flex items-center gap-2 text-sm text-gray-700">
            <span>Page</span>
            <input type="number" 
                   id="page-input" 
                   class="w-16 text-center border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                   value="${currentPage}" 
                   min="1" 
                   max="${totalPages}" 
                   aria-label="Current page">
            <span>of ${totalPages}</span>
        </div>

        <div class="flex items-center gap-2">
            <!-- Next Page Button -->
            <button data-page="${currentPage + 1}" 
                    class="${commonButtonClasses} ${isLastPage ? disabledClasses : ''}" 
                    ${isLastPage ? 'disabled' : ''}>
                Next
            </button>
            <!-- Last Page Button -->
            <button data-page="${totalPages}" 
                    class="${commonButtonClasses} ${isLastPage ? disabledClasses : ''}" 
                    ${isLastPage ? 'disabled' : ''}>
                Last
            </button>
        </div>
    `;

    container.innerHTML = paginationHTML;
}

function formatDate(inputDate) {
    // Log what the function receives
    console.log(`formatDate received:`, inputDate, `(type: ${typeof inputDate})`);

    if (!inputDate) {
        // This will be triggered if inputDate is null, undefined, or an empty string ""
        return 'N/A'; 
    }

    const date = new Date(inputDate);
    
    if (isNaN(date.getTime())) {
        // This will be triggered if the date string is invalid, e.g., "hello world"
        console.warn(`Could not parse invalid date:`, inputDate);
        return 'N/A';
    }
    
    const formattingOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    // The only way this returns undefined is if the function exits before this line.
    return date.toLocaleDateString('en-US', formattingOptions);
}


// =================================================================
//                      API & RENDERING FUNCTIONS
// =================================================================


/**
 * Renders a data table with dynamic headers and actions.
 */
function renderTable(containerId, data, config, selectedStatus) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'w-full divide-y divide-gray-200';

    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    const headerRow = document.createElement('tr');
    
    // Define headers based on the selected status
    const headers = ['Project', 'Name', 'Data Set', 'Requested On', 'Requested By'];
    if (selectedStatus === 'Pending Approval') headers.push('Approvers');
    else if (selectedStatus === 'Approved') { headers.push('Approved by'); headers.push('Approved on'); }
    else if (selectedStatus === 'Rejected') { headers.push('Rejected by'); headers.push('Rejected on'); }
    else if (selectedStatus === 'Finalised') { headers.push('Approved by'); headers.push('Approved on'); headers.push('Finalised on'); }
    // if (config.showActions) headers.push('Actions');

    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';
    
    if (data.length === 0) {
        const colSpan = headers.length;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-6 py-4 text-center text-sm text-gray-500">No requests found.</td></tr>`;
    } else {
        data.forEach(item => {
            const row = document.createElement('tr');
            const tdClasses = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';
            
            let statusSpecificCols = '';
            switch (item.status) {
                case 'Pending Approval': statusSpecificCols = `<td class="${tdClasses}">${item.Approvers || 'N/A'}</td>`; break;
                case 'Rejected': statusSpecificCols = `<td class="${tdClasses}">${item.RejectedBy || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.RejectedDate)}</td>`; break;
                case 'Approved': statusSpecificCols = `<td class="${tdClasses}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td>`; break;
                case 'Finalised': statusSpecificCols = `<td class="${tdClasses}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td><td class="${tdClasses}">${formatDate(item.FinalisedDate)}</td>`; break;
            }

            const actionButtons = `
                <div class="btn-group pull-right">
                    <button class="btn btn-accent action-view-request" title="View Request" data-bs-toggle="modal" data-bs-target="#viewRequestModal"><i class="fa fa-eye"></i></button>
                    <button class="btn btn-accent action-view-dataset" title="View Data Set" data-bs-toggle="modal" data-bs-target="#viewDatasetModal"><i class="fa fa-clone"></i></button>
                    <button class="btn btn-accent action-approve" title="Approve Request" data-bs-toggle="modal" data-bs-target="#approveRequestModal"><i class="fa fa-thumbs-up"></i></button>
                    <button class="btn btn-accent action-reject" title="Reject Request" data-bs-toggle="modal" data-bs-target="#rejectRequestModal"><i class="fa fa-thumbs-down"></i></button>
                </div>`;
            
            row.innerHTML = `
                <td class="${tdClasses}">${item.ProjectID}</td>
                <td class="${tdClasses}">${item.Name}</td>
                <td class="${tdClasses}">Data Set ${item.DataSetID}</td>
                <td class="${tdClasses}">${formatDate(item.CreateDate)}</td>
                <td class="${tdClasses}">${item.CreateUser}</td>
                ${statusSpecificCols}
            `;
            // ${config.showActions ? `<td class="${tdClasses}">${actionButtons}</td>` : ''}
            tbody.appendChild(row);

            // Add event listeners for the action buttons in this row
            // row.querySelector('.action-view-request')?.addEventListener('click', () => ViewRequest(item));
            // row.querySelector('.action-view-dataset')?.addEventListener('click', () => ViewDataSet(item));
            // row.querySelector('.action-approve')?.addEventListener('click', () => ApproveRequest(item));
            // row.querySelector('.action-reject')?.addEventListener('click', () => RejectRequest(item));
        });
    }
    table.appendChild(tbody);
    container.appendChild(table);
}



// =================================================================
//                     PRIMARY RENDER FUNCTION
// =================================================================

async function getCounts(status) {
    const apiParams = {
        "page": currentPage,
        "pageSize": rowsPerPage,
        "search": '',
        "statusId": parseInt(Object.keys(statusIdToNameMap).find(key => statusIdToNameMap[key] === status))
    }
    
    console.log(apiParams)
    const response = await window.loomeApi.runApiRequest(API_ALL_REQUEST, apiParams);
    const parsedResponse = safeParseJson(response);

    return parsedResponse.RowCount;
}

/**
 * Main function to orchestrate all rendering based on the current state.
 * It filters, paginates, and renders the table and controls.
 */
async function renderUI() {
    const activeChip = document.querySelector('.chip.active');
    if (!activeChip) return; // Don't render if no chip is active
    
    const selectedStatus = activeChip.dataset.status;
    const searchInput = getSearchInput();
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // --- 1. FETCH ALL DATA ONCE ---
    // We call the API without pagination params, assuming it returns all records.
    // If your API requires pagination, you'd need to fetch all pages in a loop here.
    const apiParams = {
        "page": currentPage,
        "pageSize": rowsPerPage,
        "search": searchTerm,
        "statusId": parseInt(Object.keys(statusIdToNameMap).find(key => statusIdToNameMap[key] === selectedStatus))
    }
    
    console.log(apiParams)
    const response = await window.loomeApi.runApiRequest(API_ALL_REQUEST, apiParams);
    const parsedResponse = safeParseJson(response)
    const rawData = parsedResponse.Results;
    const totalItems = parsedResponse.RowCount;
    console.log(rawData)

    // --- 2. PREPARE THE MASTER DATA ARRAY ---
    // Transform the raw data just once into the format our UI needs.
    allRequests = rawData.map(item => ({
        ...item,
        status: statusIdToNameMap[item.StatusID] || 'Unknown'
    }));
    console.log(allRequests)

    // --- Render the components ---
    const configForTable = configMap[selectedStatus];
    renderTable(TABLE_CONTAINER_ID, allRequests, configForTable, selectedStatus);
    renderPagination('pagination-controls', totalItems, rowsPerPage, currentPage);
}

// =================================================================
//                      INITIALIZATION
// =================================================================

/**
 * Main function to initialize the page, fetch all data, and set up listeners.
 */
async function renderMyRequestsPage() {
    try {

        // --- 3. UPDATE ALL CHIP COUNTS ONCE ---
        // This is the logic you wanted. It calculates counts from the unfiltered master array.
        let totalRequests = 0;
        const chipsContainer = document.getElementById('status-chips-container');
        for (const chip of chipsContainer.querySelectorAll('.chip')) {
            const status = chip.dataset.status;
            console.log(status)
            // Await the asynchronous getCounts function for each chip
            const count = await getCounts(status);
            chip.querySelector('.chip-count').textContent = count;
            totalRequests += Number(count);
        }

        // Update the total count in the header
        const requestsCountEl = document.getElementById('requestsCount');
        if (requestsCountEl) {
            requestsCountEl.textContent = totalRequests;
        }

        // --- 4. SETUP EVENT LISTENERS ---
        
        // Listener for status chip clicks
        chipsContainer.addEventListener('click', (event) => {
            const clickedChip = event.target.closest('.chip');
            if (!clickedChip) return;

            chipsContainer.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
            clickedChip.classList.add('active');
            
            currentPage = 1; // Reset to page 1 when changing tabs
            renderUI(); // Re-render everything
        });

        // Listener for the search input
        const searchInput = getSearchInput();
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                currentPage = 1; // Reset to page 1 when searching
                renderUI(); // Re-render everything
            });
        }

        // Listener for pagination buttons
        const paginationContainer = document.getElementById('pagination-controls');
        paginationContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            
            currentPage = parseInt(button.dataset.page, 10);
            renderUI(); // Re-render everything
        });

        // --- ADD THIS NEW LISTENER for the page input box ---
        paginationContainer.addEventListener('keydown', (event) => {
            // Only act if the user pressed Enter and the target is our input
            if (event.key === 'Enter' && event.target.id === 'page-input') {
                const newPage = parseInt(event.target.value, 10);
                if (!isNaN(newPage) && newPage > 0) {
                    currentPage = newPage;
                    renderUI();
                }
            }
        });

        // --- 5. INITIAL PAGE RENDER ---
        // Programmatically click the first chip to trigger the initial render.
        document.querySelector('.chip[data-status="Pending Approval"]').click();

    } catch (error) {
        console.error("Error setting up the page:", error);
        // ... your error handling ...
    }
}

// Only run in browser environment, not during Jest testing
if (typeof jest === 'undefined') {
    renderMyRequestsPage();
}

// ============================================================================
// MODULE EXPORTS (for Node.js/Jest testing)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Constants
        TABLE_CONTAINER_ID,
        API_ALL_REQUEST,
        API_APPROVE_REQUEST,
        API_REJECT_REQUEST,
        statusIdToNameMap,
        configMap,
        rowsPerPage,
        // Functions
        safeParseJson,
        formatDate,
        renderPagination,
        renderTable,
        ViewRequest,
        ViewDataSet,
        ApproveRequest,
        RejectRequest,
        getCounts,
        renderUI,
        // State accessors for testing
        get currentPage() { return currentPage; },
        set currentPage(val) { currentPage = val; },
        get allRequests() { return allRequests; },
        set allRequests(val) { allRequests = val; }
    };
}

// ============================================================================
// UNIT TESTS
// ============================================================================
if (typeof describe === 'function') {
    const mod = typeof module !== 'undefined' && module.exports ? module.exports : {};

    describe('requestsPlatformAdmin.js', () => {
        let mockApiResponse;
        let originalLoomeApi;

        beforeEach(() => {
            // Reset state
            mod.currentPage = 1;
            mod.allRequests = [];

            // Setup DOM
            document.body.innerHTML = `
                <div id="requests-table-area"></div>
                <div id="pagination-controls"></div>
                <div id="requestsCount"></div>
                <input id="searchRequests" type="text" />
                <div id="status-chips-container">
                    <div class="chip active" data-status="Pending Approval">
                        <span class="chip-count">0</span>
                    </div>
                    <div class="chip" data-status="Approved">
                        <span class="chip-count">0</span>
                    </div>
                    <div class="chip" data-status="Rejected">
                        <span class="chip-count">0</span>
                    </div>
                    <div class="chip" data-status="Finalised">
                        <span class="chip-count">0</span>
                    </div>
                </div>
                <div id="viewRequestModalBody"></div>
                <div id="viewDatasetModalBody"></div>
                <div id="approveRequestModalBody"></div>
                <div id="approveRequestModalLabel"></div>
                <div id="rejectRequestModalBody"></div>
                <div id="rejectRequestModalLabel"></div>
            `;

            // Mock console methods
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});

            // Store original API and setup mock
            originalLoomeApi = window.loomeApi;
            mockApiResponse = null;
            window.loomeApi = {
                runApiRequest: jest.fn((apiId, params) => Promise.resolve(mockApiResponse))
            };
        });

        afterEach(() => {
            window.loomeApi = originalLoomeApi;
            jest.restoreAllMocks();
        });

        // =====================================================================
        // Constants Tests
        // =====================================================================
        describe('Constants', () => {
            test('TABLE_CONTAINER_ID should be requests-table-area', () => {
                expect(mod.TABLE_CONTAINER_ID).toBe('requests-table-area');
            });

            test('API_ALL_REQUEST should be GetAllRequests', () => {
                expect(mod.API_ALL_REQUEST).toBe('GetAllRequests');
            });

            test('API_APPROVE_REQUEST should be ApproveRequestID', () => {
                expect(mod.API_APPROVE_REQUEST).toBe('ApproveRequestID');
            });

            test('API_REJECT_REQUEST should be RejectRequestID', () => {
                expect(mod.API_REJECT_REQUEST).toBe('RejectRequestID');
            });

            test('rowsPerPage should be 5', () => {
                expect(mod.rowsPerPage).toBe(5);
            });

            test('statusIdToNameMap should have correct mappings', () => {
                expect(mod.statusIdToNameMap[1]).toBe('Pending Approval');
                expect(mod.statusIdToNameMap[2]).toBe('Approved');
                expect(mod.statusIdToNameMap[3]).toBe('Finalised');
                expect(mod.statusIdToNameMap[4]).toBe('Rejected');
            });

            test('configMap should have showActions for all statuses', () => {
                expect(mod.configMap['Pending Approval'].showActions).toBe(true);
                expect(mod.configMap['Approved'].showActions).toBe(true);
                expect(mod.configMap['Rejected'].showActions).toBe(true);
                expect(mod.configMap['Finalised'].showActions).toBe(true);
            });
        });

        // =====================================================================
        // safeParseJson Tests
        // =====================================================================
        describe('safeParseJson', () => {
            test('should parse JSON string to object', () => {
                const jsonString = '{"name":"test","value":123}';
                const result = mod.safeParseJson(jsonString);
                expect(result).toEqual({ name: 'test', value: 123 });
            });

            test('should return object as-is if already an object', () => {
                const obj = { name: 'test', value: 123 };
                const result = mod.safeParseJson(obj);
                expect(result).toBe(obj);
            });

            test('should parse JSON array string', () => {
                const jsonString = '[{"id":1},{"id":2}]';
                const result = mod.safeParseJson(jsonString);
                expect(result).toEqual([{ id: 1 }, { id: 2 }]);
            });

            test('should handle paginated response string', () => {
                const paginatedStr = '{"Results":[{"RequestID":1}],"CurrentPage":1,"PageCount":3,"RowCount":25}';
                const result = mod.safeParseJson(paginatedStr);
                expect(result.Results).toEqual([{ RequestID: 1 }]);
                expect(result.RowCount).toBe(25);
            });

            test('should return array as-is if already an array', () => {
                const arr = [{ id: 1 }];
                const result = mod.safeParseJson(arr);
                expect(result).toBe(arr);
            });
        });

        // =====================================================================
        // formatDate Tests
        // =====================================================================
        describe('formatDate', () => {
            test('should format valid date string', () => {
                const result = mod.formatDate('2024-06-15T10:30:00');
                expect(result).toBe('June 15, 2024');
            });

            test('should format ISO date string', () => {
                const result = mod.formatDate('2023-12-25');
                expect(result).toBe('December 25, 2023');
            });

            test('should return N/A for null input', () => {
                const result = mod.formatDate(null);
                expect(result).toBe('N/A');
            });

            test('should return N/A for undefined input', () => {
                const result = mod.formatDate(undefined);
                expect(result).toBe('N/A');
            });

            test('should return N/A for empty string', () => {
                const result = mod.formatDate('');
                expect(result).toBe('N/A');
            });

            test('should return N/A for invalid date string', () => {
                const result = mod.formatDate('not-a-date');
                expect(result).toBe('N/A');
            });

            test('should handle Date object', () => {
                const date = new Date('2024-01-01');
                const result = mod.formatDate(date);
                expect(result).toBe('January 1, 2024');
            });
        });

        // =====================================================================
        // renderPagination Tests
        // =====================================================================
        describe('renderPagination', () => {
            test('should render pagination controls correctly', () => {
                mod.renderPagination('pagination-controls', 50, 5, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toContain('First');
                expect(container.innerHTML).toContain('Previous');
                expect(container.innerHTML).toContain('Next');
                expect(container.innerHTML).toContain('Last');
            });

            test('should show correct total pages', () => {
                mod.renderPagination('pagination-controls', 50, 5, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toContain('of 10');
            });

            test('should disable First and Previous buttons on first page', () => {
                mod.renderPagination('pagination-controls', 50, 5, 1);
                const buttons = document.querySelectorAll('button[data-page]');
                const firstBtn = buttons[0];
                const prevBtn = buttons[1];
                expect(firstBtn.disabled).toBe(true);
                expect(prevBtn.disabled).toBe(true);
            });

            test('should disable Next and Last buttons on last page', () => {
                mod.renderPagination('pagination-controls', 50, 5, 10);
                const buttons = document.querySelectorAll('button[data-page]');
                const nextBtn = buttons[2];
                const lastBtn = buttons[3];
                expect(nextBtn.disabled).toBe(true);
                expect(lastBtn.disabled).toBe(true);
            });

            test('should not render pagination for single page', () => {
                mod.renderPagination('pagination-controls', 3, 5, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toBe('');
            });

            test('should set correct value in page input', () => {
                mod.renderPagination('pagination-controls', 50, 5, 3);
                const input = document.getElementById('page-input');
                expect(input.value).toBe('3');
            });

            test('should set correct min and max on page input', () => {
                mod.renderPagination('pagination-controls', 50, 5, 3);
                const input = document.getElementById('page-input');
                expect(input.min).toBe('1');
                expect(input.max).toBe('10');
            });

            test('should handle empty container gracefully', () => {
                expect(() => mod.renderPagination('nonexistent', 50, 5, 1)).not.toThrow();
            });

            test('should enable all buttons on middle page', () => {
                mod.renderPagination('pagination-controls', 50, 5, 5);
                const buttons = document.querySelectorAll('button[data-page]');
                buttons.forEach(btn => {
                    expect(btn.disabled).toBe(false);
                });
            });
        });

        // =====================================================================
        // ViewRequest Tests
        // =====================================================================
        describe('ViewRequest', () => {
            test('should populate modal body with request form', () => {
                const request = { name: 'Test Request' };
                mod.ViewRequest(request);
                const modalBody = document.getElementById('viewRequestModalBody');
                expect(modalBody.innerHTML).toContain('Request Name');
                expect(modalBody.innerHTML).toContain('Test Request');
            });

            test('should include Assist Project dropdown', () => {
                const request = { name: 'Test' };
                mod.ViewRequest(request);
                const modalBody = document.getElementById('viewRequestModalBody');
                expect(modalBody.innerHTML).toContain('Assist Project');
                expect(modalBody.innerHTML).toContain('ProjectID');
            });

            test('should include Scheduled Refresh dropdown', () => {
                const request = { name: 'Test' };
                mod.ViewRequest(request);
                const modalBody = document.getElementById('viewRequestModalBody');
                expect(modalBody.innerHTML).toContain('Scheduled Refresh');
                expect(modalBody.innerHTML).toContain('No Refresh');
                expect(modalBody.innerHTML).toContain('Daily');
                expect(modalBody.innerHTML).toContain('Weekly');
                expect(modalBody.innerHTML).toContain('Monthly');
            });

            test('should include filters table', () => {
                const request = { name: 'Test' };
                mod.ViewRequest(request);
                const modalBody = document.getElementById('viewRequestModalBody');
                expect(modalBody.innerHTML).toContain('Filter');
                expect(modalBody.innerHTML).toContain('Column');
                expect(modalBody.innerHTML).toContain('Filter Type');
                expect(modalBody.innerHTML).toContain('Value');
            });
        });

        // =====================================================================
        // ViewDataSet Tests
        // =====================================================================
        describe('ViewDataSet', () => {
            test('should populate modal body with dataset form', () => {
                const request = { approvers: 'approver@test.com' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Description');
                expect(modalBody.innerHTML).toContain('approver@test.com');
            });

            test('should include Owner field', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Owner');
            });

            test('should include Approvers field', () => {
                const request = { approvers: 'admin@test.com' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Approvers');
                expect(modalBody.innerHTML).toContain('admin@test.com');
            });

            test('should include Data Source dropdown', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Data Source');
                expect(modalBody.innerHTML).toContain('BIS Data');
            });

            test('should include Active checkbox', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Active');
            });

            test('should include Data Set Fields section', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Data Set Fields');
                expect(modalBody.innerHTML).toContain('Table Name');
            });

            test('should include Meta Data section', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Meta Data');
                expect(modalBody.innerHTML).toContain('Tag');
            });

            test('should include Columns section with checkboxes', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Columns');
                expect(modalBody.innerHTML).toContain('Redact');
                expect(modalBody.innerHTML).toContain('Tokenise');
                expect(modalBody.innerHTML).toContain('IsFilter');
            });
        });

        // =====================================================================
        // ApproveRequest Tests
        // =====================================================================
        describe('ApproveRequest', () => {
            test('should set modal title with request name', () => {
                const request = { name: 'Data Access Request' };
                mod.ApproveRequest(request);
                const title = document.getElementById('approveRequestModalLabel');
                expect(title.textContent).toBe('Approve Request: Data Access Request');
            });

            test('should populate modal body with approval form', () => {
                const request = { name: 'Test' };
                mod.ApproveRequest(request);
                const modalBody = document.getElementById('approveRequestModalBody');
                expect(modalBody.innerHTML).toContain('Approval Note');
                expect(modalBody.innerHTML).toContain('ApprovalMessage');
            });

            test('should include Approve button', () => {
                const request = { name: 'Test' };
                mod.ApproveRequest(request);
                const modalBody = document.getElementById('approveRequestModalBody');
                expect(modalBody.innerHTML).toContain('Approve');
                expect(modalBody.innerHTML).toContain('type="submit"');
            });

            test('should include Cancel button', () => {
                const request = { name: 'Test' };
                mod.ApproveRequest(request);
                const modalBody = document.getElementById('approveRequestModalBody');
                expect(modalBody.innerHTML).toContain('Cancel');
                expect(modalBody.innerHTML).toContain('data-bs-dismiss="modal"');
            });

            test('should include textarea for approval note', () => {
                const request = { name: 'Test' };
                mod.ApproveRequest(request);
                const modalBody = document.getElementById('approveRequestModalBody');
                expect(modalBody.innerHTML).toContain('textarea');
                expect(modalBody.innerHTML).toContain('Note to the Researcher if approved');
            });
        });

        // =====================================================================
        // RejectRequest Tests
        // =====================================================================
        describe('RejectRequest', () => {
            test('should set modal title with request name', () => {
                const request = { name: 'Data Access Request' };
                mod.RejectRequest(request);
                const title = document.getElementById('rejectRequestModalLabel');
                expect(title.textContent).toBe('Reject Request: Data Access Request');
            });

            test('should populate modal body with rejection form', () => {
                const request = { name: 'Test' };
                mod.RejectRequest(request);
                const modalBody = document.getElementById('rejectRequestModalBody');
                expect(modalBody.innerHTML).toContain('Rejection Note');
                expect(modalBody.innerHTML).toContain('RequestMessage');
            });

            test('should include Reject button', () => {
                const request = { name: 'Test' };
                mod.RejectRequest(request);
                const modalBody = document.getElementById('rejectRequestModalBody');
                expect(modalBody.innerHTML).toContain('Reject');
                expect(modalBody.innerHTML).toContain('type="submit"');
            });

            test('should include Cancel button', () => {
                const request = { name: 'Test' };
                mod.RejectRequest(request);
                const modalBody = document.getElementById('rejectRequestModalBody');
                expect(modalBody.innerHTML).toContain('Cancel');
                expect(modalBody.innerHTML).toContain('data-bs-dismiss="modal"');
            });

            test('should include textarea for rejection note', () => {
                const request = { name: 'Test' };
                mod.RejectRequest(request);
                const modalBody = document.getElementById('rejectRequestModalBody');
                expect(modalBody.innerHTML).toContain('textarea');
                expect(modalBody.innerHTML).toContain('Note to the Researcher if rejected');
            });
        });

        // =====================================================================
        // renderTable Tests
        // =====================================================================
        describe('renderTable', () => {
            const config = { showActions: true };

            test('should render table with headers for Pending Approval', () => {
                mod.renderTable('requests-table-area', [], config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('Project');
                expect(container.innerHTML).toContain('Name');
                expect(container.innerHTML).toContain('Data Set');
                expect(container.innerHTML).toContain('Requested On');
                expect(container.innerHTML).toContain('Requested By');
                expect(container.innerHTML).toContain('Approvers');
            });

            test('should render table with headers for Approved status', () => {
                mod.renderTable('requests-table-area', [], config, 'Approved');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('Approved by');
                expect(container.innerHTML).toContain('Approved on');
            });

            test('should render table with headers for Rejected status', () => {
                mod.renderTable('requests-table-area', [], config, 'Rejected');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('Rejected by');
                expect(container.innerHTML).toContain('Rejected on');
            });

            test('should render table with headers for Finalised status', () => {
                mod.renderTable('requests-table-area', [], config, 'Finalised');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('Approved by');
                expect(container.innerHTML).toContain('Approved on');
                expect(container.innerHTML).toContain('Finalised on');
            });

            test('should show no requests message when data is empty', () => {
                mod.renderTable('requests-table-area', [], config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('No requests found');
            });

            test('should render data rows correctly', () => {
                const data = [{
                    ProjectID: 'PROJ001',
                    Name: 'Test Request',
                    DataSetID: 5,
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Pending Approval',
                    Approvers: 'admin@test.com'
                }];
                mod.renderTable('requests-table-area', data, config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('PROJ001');
                expect(container.innerHTML).toContain('Test Request');
                expect(container.innerHTML).toContain('Data Set 5');
                expect(container.innerHTML).toContain('user@test.com');
                expect(container.innerHTML).toContain('admin@test.com');
            });

            test('should render Approved status columns correctly', () => {
                const data = [{
                    ProjectID: 'PROJ001',
                    Name: 'Test',
                    DataSetID: 1,
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Approved',
                    CurrentlyApproved: 'approver@test.com',
                    ApprovedDate: '2024-06-16'
                }];
                mod.renderTable('requests-table-area', data, config, 'Approved');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('approver@test.com');
                expect(container.innerHTML).toContain('June 16, 2024');
            });

            test('should render Rejected status columns correctly', () => {
                const data = [{
                    ProjectID: 'PROJ001',
                    Name: 'Test',
                    DataSetID: 1,
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Rejected',
                    RejectedBy: 'admin@test.com',
                    RejectedDate: '2024-06-17'
                }];
                mod.renderTable('requests-table-area', data, config, 'Rejected');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('admin@test.com');
                expect(container.innerHTML).toContain('June 17, 2024');
            });

            test('should render Finalised status columns correctly', () => {
                const data = [{
                    ProjectID: 'PROJ001',
                    Name: 'Test',
                    DataSetID: 1,
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Finalised',
                    CurrentlyApproved: 'approver@test.com',
                    ApprovedDate: '2024-06-16',
                    FinalisedDate: '2024-06-18'
                }];
                mod.renderTable('requests-table-area', data, config, 'Finalised');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('approver@test.com');
                expect(container.innerHTML).toContain('June 16, 2024');
                expect(container.innerHTML).toContain('June 18, 2024');
            });

            test('should handle N/A for missing Approvers', () => {
                const data = [{
                    ProjectID: 'PROJ001',
                    Name: 'Test',
                    DataSetID: 1,
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Pending Approval',
                    Approvers: null
                }];
                mod.renderTable('requests-table-area', data, config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('N/A');
            });
        });

        // =====================================================================
        // getCounts Tests
        // =====================================================================
        describe('getCounts', () => {
            test('should call API with correct parameters for Pending Approval', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 15,
                    CurrentPage: 1,
                    PageSize: 5
                });

                const count = await mod.getCounts('Pending Approval');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetAllRequests',
                    expect.objectContaining({
                        statusId: 1
                    })
                );
                expect(count).toBe(15);
            });

            test('should call API with correct statusId for Approved', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 10
                });

                await mod.getCounts('Approved');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetAllRequests',
                    expect.objectContaining({
                        statusId: 2
                    })
                );
            });

            test('should call API with correct statusId for Finalised', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 5
                });

                await mod.getCounts('Finalised');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetAllRequests',
                    expect.objectContaining({
                        statusId: 3
                    })
                );
            });

            test('should call API with correct statusId for Rejected', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 3
                });

                await mod.getCounts('Rejected');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetAllRequests',
                    expect.objectContaining({
                        statusId: 4
                    })
                );
            });

            test('should return RowCount from response', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 42
                });

                const count = await mod.getCounts('Pending Approval');
                expect(count).toBe(42);
            });
        });

        // =====================================================================
        // renderUI Tests
        // =====================================================================
        describe('renderUI', () => {
            test('should call API with correct parameters', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 0,
                    CurrentPage: 1,
                    PageSize: 5
                });

                await mod.renderUI();

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetAllRequests',
                    expect.objectContaining({
                        page: 1,
                        pageSize: 5,
                        statusId: 1
                    })
                );
            });

            test('should render table with fetched data', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{
                        RequestID: 1,
                        Name: 'API Request',
                        ProjectID: 'PROJ001',
                        DataSetID: 5,
                        CreateDate: '2024-06-15',
                        CreateUser: 'user@test.com',
                        StatusID: 1,
                        Approvers: 'admin@test.com'
                    }],
                    RowCount: 1,
                    CurrentPage: 1,
                    PageSize: 5
                });

                await mod.renderUI();

                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('API Request');
                expect(container.innerHTML).toContain('PROJ001');
            });

            test('should transform StatusID to status name', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{
                        RequestID: 1,
                        Name: 'Test',
                        ProjectID: 'P1',
                        DataSetID: 1,
                        CreateDate: '2024-06-15',
                        CreateUser: 'user@test.com',
                        StatusID: 2,
                        CurrentlyApproved: 'approver@test.com',
                        ApprovedDate: '2024-06-16'
                    }],
                    RowCount: 1
                });

                // Set active chip to Approved
                document.querySelector('.chip.active').classList.remove('active');
                document.querySelector('.chip[data-status="Approved"]').classList.add('active');

                await mod.renderUI();

                expect(mod.allRequests[0].status).toBe('Approved');
            });

            test('should not render if no active chip', async () => {
                document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));

                await mod.renderUI();

                expect(window.loomeApi.runApiRequest).not.toHaveBeenCalled();
            });

            test('should render pagination with total items', async () => {
                mockApiResponse = JSON.stringify({
                    Results: Array(5).fill({
                        RequestID: 1,
                        Name: 'Test',
                        ProjectID: 'P1',
                        DataSetID: 1,
                        CreateDate: '2024-06-15',
                        CreateUser: 'user@test.com',
                        StatusID: 1
                    }),
                    RowCount: 25,
                    CurrentPage: 1,
                    PageSize: 5
                });

                await mod.renderUI();

                const paginationContainer = document.getElementById('pagination-controls');
                expect(paginationContainer.innerHTML).toContain('of 5');
            });
        });

        // =====================================================================
        // State Management Tests
        // =====================================================================
        describe('State Management', () => {
            test('should allow setting and getting currentPage', () => {
                mod.currentPage = 5;
                expect(mod.currentPage).toBe(5);
            });

            test('should allow setting and getting allRequests', () => {
                mod.allRequests = [{ id: 1 }, { id: 2 }];
                expect(mod.allRequests).toEqual([{ id: 1 }, { id: 2 }]);
            });

            test('currentPage should default to 1', () => {
                mod.currentPage = 1;
                expect(mod.currentPage).toBe(1);
            });
        });

        // =====================================================================
        // Integration Tests
        // =====================================================================
        describe('Integration Tests', () => {
            test('should handle full request lifecycle rendering', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [
                        {
                            RequestID: 1,
                            Name: 'Pending Request',
                            ProjectID: 'PROJ001',
                            DataSetID: 5,
                            CreateDate: '2024-06-15T10:00:00',
                            CreateUser: 'researcher@test.com',
                            StatusID: 1,
                            Approvers: 'admin@test.com',
                            CurrentlyApproved: null,
                            RejectedBy: null
                        }
                    ],
                    RowCount: 1,
                    CurrentPage: 1,
                    PageSize: 5
                });

                await mod.renderUI();

                const container = document.getElementById('requests-table-area');
                expect(container.querySelector('table')).toBeTruthy();
                expect(container.innerHTML).toContain('Pending Request');
                expect(container.innerHTML).toContain('researcher@test.com');
                expect(container.innerHTML).toContain('admin@test.com');
            });

            test('should correctly format all dates in table', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{
                        RequestID: 1,
                        Name: 'Test',
                        ProjectID: 'P1',
                        DataSetID: 1,
                        CreateDate: '2024-01-15',
                        CreateUser: 'user@test.com',
                        StatusID: 3,
                        CurrentlyApproved: 'approver@test.com',
                        ApprovedDate: '2024-01-16',
                        FinalisedDate: '2024-01-17'
                    }],
                    RowCount: 1
                });

                document.querySelector('.chip.active').classList.remove('active');
                document.querySelector('.chip[data-status="Finalised"]').classList.add('active');

                await mod.renderUI();

                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('January 15, 2024');
                expect(container.innerHTML).toContain('January 16, 2024');
                expect(container.innerHTML).toContain('January 17, 2024');
            });
        });

    }); // End describe('requestsPlatformAdmin.js')
} // End if (typeof describe === 'function')
