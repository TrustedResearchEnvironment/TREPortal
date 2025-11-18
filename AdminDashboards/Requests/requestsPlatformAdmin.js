// =================================================================
//                      STATE & CONFIGURATION
// =================================================================
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_REQUEST_ID = 'GetAllRequests';
const API_APPROVE_REQUEST = 'ApproveRequestID';
const API_REJECT_REQUEST = 'RejectRequestID';

// We will store all fetched data here
let allRequests = []; 
let currentPage = 1;
const rowsPerPage = 5; // You can control page size here
const searchInput = document.getElementById('searchRequests');

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
 * Renders pagination controls.
 * (This function NO LONGER adds event listeners).
 */
function renderPagination(containerId, totalItems, itemsPerPage, currentPage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    container.innerHTML = ''; // Clear old controls

    if (totalPages <= 1) {
        return; // No need for pagination.
    }

    // --- Previous Button ---
    const prevDisabled = currentPage === 1;
    let paginationHTML = `
        <button data-page="${currentPage - 1}" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 ${prevDisabled ? 'opacity-50 cursor-not-allowed' : ''}" ${prevDisabled ? 'disabled' : ''}>
            Previous
        </button>
    `;

    // --- Page Number Buttons ---
    paginationHTML += '<div class="flex items-center gap-2">';
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        paginationHTML += `
            <button data-page="${i}" class="px-4 py-2 text-sm font-medium ${isActive ? 'text-white bg-blue-600' : 'text-gray-700 bg-white'} border border-gray-300 rounded-lg hover:bg-gray-100">
                ${i}
            </button>
        `;
    }
    paginationHTML += '</div>';

    // --- Next Button ---
    const nextDisabled = currentPage === totalPages;
    paginationHTML += `
        <button data-page="${currentPage + 1}" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 ${nextDisabled ? 'opacity-50 cursor-not-allowed' : ''}" ${nextDisabled ? 'disabled' : ''}>
            Next
        </button>
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
    const response = await window.loomeApi.runApiRequest(API_REQUEST_ID, apiParams);
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
    const searchTerm = searchInput.value.toLowerCase();

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
    const response = await window.loomeApi.runApiRequest(API_REQUEST_ID, apiParams);
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
        const chipsContainer = document.getElementById('status-chips-container');
        for (const chip of chipsContainer.querySelectorAll('.chip')) {
            const status = chip.dataset.status;
            console.log(status)
            // Await the asynchronous getCounts function for each chip
            const count = await getCounts(status);
            chip.querySelector('.chip-count').textContent = count;
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
        searchInput.addEventListener('input', () => {
            currentPage = 1; // Reset to page 1 when searching
            renderUI(); // Re-render everything
        });

        // Listener for pagination buttons
        document.getElementById('pagination-controls').addEventListener('click', (event) => {
            const button = event.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            
            currentPage = parseInt(button.dataset.page, 10);
            renderUI(); // Re-render everything
        });

        // --- 5. INITIAL PAGE RENDER ---
        // Programmatically click the first chip to trigger the initial render.
        document.querySelector('.chip[data-status="Pending Approval"]').click();

    } catch (error) {
        console.error("Error setting up the page:", error);
        // ... your error handling ...
    }
}

// Start the application
renderMyRequestsPage();
