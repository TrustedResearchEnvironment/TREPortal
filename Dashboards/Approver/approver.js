// =================================================================
//                      STATE & CONFIGURATION
// =================================================================
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_ALL_REQUESTLISTS = 'GetRequestList';
const API_APPROVE_REQUEST = 'ApproveRequestID';
const API_REJECT_REQUEST = 'RejectRequestID';
const API_GET_REQUEST_DETAILS = 'GetRequestID';
const API_GET_DATASET_DETAILS = 'GetDataSetID';
const API_GET_ALL_ASSIST_PROJECTS = 'GetAllAssistProjects';

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
    'Approved': { showActions: false },
    'Rejected': { showActions: false },
    'Finalised': { showActions: false },
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


    // Update the modal title dynamically
    modalTitle.textContent = `Approve Request: ${request.Name}`;

    // Populate the modal body with the dynamic content
    modalBody.innerHTML = `
        <div class="col-md-12">
            <div class="alert alert-warning">
                <i class="fa fa-exclamation-triangle"></i> 
                Please confirm the approval of the request:<br>
                <strong>${request.Name}</strong>
            </div>
            <div class="form-group mt-3 d-flex justify-content-center">
                <button id="confirmApprovalBtn" class="btn btn-success px-3 py-1">
                    <i class="fa fa-thumbs-up mr-2"></i>
                    Approve
                </button>
            </div>
        </div>
    `;


    // Add event listener for the confirm approval button
    const confirmBtn = document.getElementById('confirmApprovalBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            console.log('Approve button clicked for request:', request.RequestID);
            // Call the API to approve the request
            approveRequestFromAPI(request.RequestID);
        });
    }
}

async function approveRequestFromAPI(requestId) {
    let loadingToast = null;
    
    try {
        console.log('Approving request ID:', requestId);
        
        // Show loading state
        loadingToast = showToast('Approving request...', 'info');
        console.log('Loading toast shown:', loadingToast);
        
        const response = await window.loomeApi.runApiRequest(API_APPROVE_REQUEST, {
            "id": requestId,
        });
        
        // Log the response to console
        console.log('Approve request API response:', response);
        
        // Hide the modal
        try {
            const approveModal = bootstrap.Modal.getInstance(document.getElementById('approveRequestModal'));
            if (approveModal) {
                approveModal.hide();
                console.log('Approve modal hidden');
            } else {
                console.log('Approve modal not found or already hidden');
            }
        } catch (modalError) {
            console.error('Error hiding modal:', modalError);
        }
        
        // Hide loading toast
        if (loadingToast) {
            hideToast(loadingToast);
            console.log('Loading toast hidden');
        }
        
        // Show success message
        const successToast = showToast('Success', 'success');
        console.log('Success toast shown:', successToast);
        
        // Update chip counts
        await refreshAllChipCounts();
        
        // Refresh the UI
        console.log('Refreshing UI');
        setTimeout(() => {
            renderUI();
        }, 100);
        
    } catch (error) {
        console.error("Error request:", error);
        
        // Hide loading toast
        if (loadingToast) {
            hideToast(loadingToast);
            console.log('Loading toast hidden after error');
        }
        
        // Show error message
        const errorToast = showToast('Please try again.', 'error');
        console.log('Error toast shown:', errorToast);
    }
}

// New function to update chip counts
async function refreshAllChipCounts() {
    const chipsContainer = document.getElementById('status-chips-container');
    for (const chip of chipsContainer.querySelectorAll('.chip')) {
        const status = chip.dataset.status;
        const count = await getCounts(status);
        chip.querySelector('.chip-count').textContent = count;
    }
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
            <div class="alert alert-warning">
                <i class="fa fa-exclamation-triangle"></i> 
                Please confirm the Rejection of the request:<br>
                <strong>${request.Name}</strong>
            </div>
            <div class="form-group mt-3 d-flex justify-content-center">
                <button id="confirmRejectBtn" class="btn btn-danger px-3 py-1">
                    <i class="fa fa-thumbs-down mr-2"></i>
                    Reject
                </button>
            </div>
        </div>
    `;

    // Add event listener for the confirm reject button
    const confirmBtn = document.getElementById('confirmRejectBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            console.log('Reject button clicked for request:', request.RequestID);
            // Call the API to reject the request
            rejectRequestFromAPI(request.RequestID);
        });
    }
}

async function rejectRequestFromAPI(requestId) {
    let loadingToast = null;
    
    try {
        console.log('Rejecting request ID:', requestId);
        
        // Show loading state
        loadingToast = showToast('Rejecting request...', 'info');
        
        const response = await window.loomeApi.runApiRequest(API_REJECT_REQUEST, {
            "id": requestId,
        });
        
        // Hide loading toast
        if (loadingToast) {
            hideToast(loadingToast);
        }
        
        // Hide the modal
        try {
            const rejectModal = bootstrap.Modal.getInstance(document.getElementById('rejectRequestModal'));
            if (rejectModal) {
                rejectModal.hide();
                console.log('Reject modal hidden');
            } else {
                console.log('Reject modal not found or already hidden');
            }
        } catch (modalError) {
            console.error('Error hiding modal:', modalError);
        }
        
        // Show success message
        const successToast = showToast('Request Rejected', 'success');
        
        // Update chip counts
        await refreshAllChipCounts();
        
        // Refresh the UI
        setTimeout(() => {
            renderUI();
        }, 100);
        
    } catch (error) {
        console.error("Error rejecting request:", error);
        
        // Hide loading toast
        if (loadingToast) {
            hideToast(loadingToast);
        }
        
        // Show error message
        const errorToast = showToast('Please try again.', 'error');
    }
}


// Toast notification functions
function showToast(message, type = 'info') {
    console.log(`Showing toast: ${message} (${type})`);
    
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    
    // Add styling based on type
    let backgroundColor, textColor;
    switch(type) {
        case 'success':
            backgroundColor = '#4caf50';
            textColor = 'white';
            break;
        case 'error':
            backgroundColor = '#f44336';
            textColor = 'white';
            break;
        case 'info':
        default:
            backgroundColor = '#2196F3';
            textColor = 'white';
    }
    
    // Apply styles directly
    toast.style.cssText = `
        margin-bottom: 10px;
        padding: 15px 20px;
        border-radius: 4px;
        color: ${textColor};
        background-color: ${backgroundColor};
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        min-width: 250px;
        max-width: 350px;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="flex-grow: 1;">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger reflow to ensure transition works
    void toast.offsetWidth;
    
    // Make visible
    toast.style.opacity = '1';
    
    // Auto-hide after 3 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 500); //Fade out transition for 500 milliseconds
        }, 5000); // Display duration of 5 seconds
    }
    
    console.log('Toast created and appended to container');
    return toast;
}

function hideToast(toast) {
    if (toast && toast.parentNode) {
        console.log('Hiding toast');
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
                console.log('Toast removed');
            }
        }, 300); // Wait for fade out
    } else {
        console.log('Toast not found or already removed');
    }
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-top-right';
    container.style.cssText = 'position: fixed; top: 12px; right: 12px; z-index: 9999;';
    document.body.appendChild(container);
    return container;
}


/**
 * Fetches request details from the API
 * @param {string|number} requestID - The ID of the request
 * @returns {Promise<object>} - The request details
 */
async function fetchRequestDetails(requestID) {
    try {
        
        // Call the API
        const response = await window.loomeApi.runApiRequest(API_GET_REQUEST_DETAILS, {
            "RequestID": requestID,
        });
        
        // Parse the response
        return safeParseJson(response);
    } catch (error) {
        console.error(`Error fetching request details for ID ${requestID}:`, error);
        throw error;
    }
}

/**
 * Fetches dataset details from the API
 * @param {string|number} datasetID - The ID of the dataset
 * @returns {Promise<object>} - The dataset details
 */
async function fetchDatasetDetails(datasetID) {
    try {
        
        // Call the API
        const response = await window.loomeApi.runApiRequest(API_GET_DATASET_DETAILS, {
            "DataSetID": datasetID,
        });
        
        // Parse the response
        return safeParseJson(response);
    } catch (error) {
        console.error(`Error fetching dataset details for ID ${datasetID}:`, error);
        throw error;
    }
}

// Global variable to store project data
let projectsCache = null;

async function getProjectsMapping() {
    // Return cache if already loaded
    if (projectsCache) {
        return projectsCache;
    }
    
    try {
        
        // Fetch projects data
        const response = await window.loomeApi.runApiRequest(API_GET_ALL_ASSIST_PROJECTS);
        const data = safeParseJson(response);
        
        // Create a mapping from project ID to project name
        const mapping = {};
        if (data && data.Results && Array.isArray(data.Results)) {
            data.Results.forEach(project => {
                mapping[project.AssistProjectID] = {
                    name: project.Name,
                    description: project.Description
                };
            });
        }
        
        // Cache the mapping
        projectsCache = mapping;
        return mapping;
        
    } catch (error) {
        console.error("Error fetching projects:", error);
        return {}; // Return empty object in case of error
    }
}


/**
 * Displays combined request and dataset details in a single container
 * @param {HTMLElement} container - The container element
 * @param {object} requestDetails - The request details
 * @param {object} datasetDetails - The dataset details
 */
async function displayCombinedDetails(container, requestDetails, datasetDetails) {
    // Check if we have valid details
    if ((!requestDetails || Object.keys(requestDetails).length === 0) && 
        (!datasetDetails || Object.keys(datasetDetails).length === 0)) {
        container.innerHTML = '<p class="text-center text-red-500">No details available</p>';
        return;
    }
    
    // Show loading state
    container.innerHTML = '<p class="text-center">Loading details...</p>';
    
    try {
        // Get project mapping for request details
        const projectsMapping = await getProjectsMapping();
        const projectInfo = requestDetails && requestDetails.ProjectID ? 
            (projectsMapping[requestDetails.ProjectID] || { name: 'Unknown Project', description: '' }) : 
            { name: 'Unknown Project', description: '' };
        
        // Start building HTML
        let html = `
            <div class="grid grid-cols-1 gap-5">
                <!-- Request Information -->
                <div>
                    <div class="space-y-3">
                       
                        <!-- Dataset Information -->
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Requested Dataset</span>
                            <span class="text-sm text-gray-500">${datasetDetails.Name || 'N/A'}</span>
                        </div>

                        ${datasetDetails.Description ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Dataset Description</span>
                            <span class="text-sm text-gray-500">${datasetDetails.Description}</span>
                        </div>` : ''}
                        
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Data Source ID</span>
                            <span class="text-sm text-gray-500">${datasetDetails.DataSource || datasetDetails.DataSourceID || 'N/A'}</span>
                        </div>

                        <!-- Project Information -->
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Target Project Name</span>
                            <span class="text-sm text-gray-500">${projectInfo.name}</span>
                        </div>
                        
                        ${projectInfo.description ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Project Description</span>
                            <span class="text-sm text-gray-500">${projectInfo.description}</span>
                        </div>` : ''}

                    </div>
                </div>
            </div>
        `;
        
        // Update the container
        container.innerHTML = html;
        
    } catch (error) {
        console.error("Error displaying combined details:", error);
        container.innerHTML = `
            <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                <p class="text-center text-red-500 mb-2">Error loading details</p>
                <p class="text-sm">${error.message || 'Unknown error'}</p>
            </div>
        `;
    }
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
    
    // Add a column for the chevron
    const chevronHeader = document.createElement('th');
    chevronHeader.className = 'w-10 px-6 py-3';
    headerRow.appendChild(chevronHeader);
    
    // Define headers based on the selected status
    const headers = ['Request ID', 'Request Name', 'Requested On', 'Requested By'];
    if (selectedStatus === 'Pending Approval') headers.push('Approvers');
    else if (selectedStatus === 'Approved') { headers.push('Approved by'); headers.push('Approved on'); }
    else if (selectedStatus === 'Rejected') { headers.push('Rejected by'); headers.push('Rejected on'); }
    else if (selectedStatus === 'Finalised') { headers.push('Approved by'); headers.push('Approved on'); headers.push('Finalised on'); }
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
        const colSpan = headers.length + 1; // +1 for chevron column
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-6 py-4 text-center text-sm text-gray-500">No requests found.</td></tr>`;
    } else {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.classList.add('cursor-pointer', 'hover:bg-gray-50'); // Add visual indication this row is clickable
            const tdClasses = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';
            
            let statusSpecificCols = '';
            switch (item.status) {
                case 'Pending Approval': statusSpecificCols = `<td class="${tdClasses}">${item.Approvers || 'N/A'}</td>`; break;
                case 'Rejected': statusSpecificCols = `<td class="${tdClasses}">${item.RejectedBy || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.RejectedDate)}</td>`; break;
                case 'Approved': statusSpecificCols = `<td class="${tdClasses}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td>`; break;
                case 'Finalised': statusSpecificCols = `<td class="${tdClasses}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td><td class="${tdClasses}">${formatDate(item.FinalisedDate)}</td>`; break;
            }
            
            row.innerHTML = `
                <td class="${tdClasses} text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 chevron-icon transition-transform inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </td>
                <td class="${tdClasses}">${item.RequestID}</td>
                <td class="${tdClasses}">${item.Name}</td>
                <td class="${tdClasses}">${formatDate(item.CreateDate)}</td>
                <td class="${tdClasses}">${item.CreateUser}</td>
                ${statusSpecificCols}
            `;
            
            // Create accordion row
            const accordionRow = document.createElement('tr');
            accordionRow.classList.add('hidden', 'accordion-row');
            if (selectedStatus === 'Pending Approval') {
            accordionRow.innerHTML = `
                <td colspan="${headers.length + 1}" class="p-0"> <!-- +1 for chevron column -->
                    <div class="bg-gray-50 p-4 m-2 rounded">
                        <div class="grid grid-cols-1 gap-4">
                            <div class="flex justify-end mb-1">
                                <div class="btn-group">                                  
                                    <button class="btn btn-success action-approve px-3 py-1 mr-2" data-bs-toggle="modal" data-bs-target="#approveRequestModal">
                                        <i class="fa fa-thumbs-up mr-2"></i>
                                        Approve
                                    </button>
                                    <button class="btn btn-danger action-reject px-3 py-1" data-bs-toggle="modal" data-bs-target="#rejectRequestModal">
                                        <i class="fa fa-thumbs-down mr-2"></i>
                                        Reject
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Combined Information Card -->
                            <div class="bg-white p-5 rounded-md shadow-sm">
                                <div id="combined-details-${item.RequestID}" class="combined-content">
                                    <p class="text-center text-gray-500">Loading details...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            `;
            } else {
                accordionRow.innerHTML = `
                    <td colspan="${headers.length + 1}" class="p-0"> <!-- +1 for chevron column -->
                        <div class="bg-gray-50 p-4 m-2 rounded">
                            <div class="grid grid-cols-1 gap-4">                               
                                <!-- Combined Information Card -->
                                <div class="bg-white p-5 rounded-md shadow-sm">
                                    <div id="combined-details-${item.RequestID}" class="combined-content">
                                        <p class="text-center text-gray-500">Loading details...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                `;
            }            
            // Add click event to toggle accordion
            row.addEventListener('click', async () => {
                console.log('Row clicked:', item.RequestID);
                // Toggle the accordion visibility
                accordionRow.classList.toggle('hidden');
                
                // Toggle chevron rotation
                const chevron = row.querySelector('.chevron-icon');
                if (chevron) {
                    chevron.classList.toggle('rotate-180');
                }
                
                // Only fetch data if the accordion is becoming visible
                if (!accordionRow.classList.contains('hidden')) {
                    const combinedDetailsContainer = accordionRow.querySelector(`#combined-details-${item.RequestID}`);
                    
                    // Show loading indicator
                    combinedDetailsContainer.innerHTML = '<p class="text-center">Loading details...</p>';
                    
                    try {
                        console.log(`Fetching details for RequestID: ${item.RequestID}, DataSetID: ${item.DataSetID}`);
                        
                        // Try fetching request details first
                        let requestDetails;
                        try {
                            console.log('Fetching request details...');
                            requestDetails = await fetchRequestDetails(item.RequestID);
                            console.log('Request details received:', requestDetails);
                        } catch (requestError) {
                            console.error('Error fetching request details:', requestError);
                            requestDetails = null;
                        }
                        
                        // Then try fetching dataset detailsTa
                        let datasetDetails;
                        try {
                            console.log('Fetching dataset details...');
                            datasetDetails = await fetchDatasetDetails(item.DataSetID);
                            console.log('Dataset details received:', datasetDetails);
                        } catch (datasetError) {
                            console.error('Error fetching dataset details:', datasetError);
                            datasetDetails = null;
                        }
                        
                        // Check if we have at least one set of details
                        if (!requestDetails && !datasetDetails) {
                            throw new Error('Failed to fetch both request and dataset details');
                        }
                        
                        // Display whatever details we have
                        console.log('Displaying combined details');
                        displayCombinedDetails(combinedDetailsContainer, requestDetails, datasetDetails);
                        
                    } catch (error) {
                        console.error("Error loading details:", error);
                        combinedDetailsContainer.innerHTML = `
                            <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                                <p class="text-center text-red-500 mb-2">Error loading details</p>
                                <p class="text-sm">${error.message || 'Unknown error'}</p>
                                <button class="mt-2 px-3 py-1 bg-white border border-gray-300 rounded text-sm retry-btn">
                                    Retry
                                </button>
                            </div>
                        `;
                        
                        // Add retry button functionality
                        combinedDetailsContainer.querySelector('.retry-btn')?.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            combinedDetailsContainer.innerHTML = '<p class="text-center">Loading details...</p>';
                            try {
                                const retryRequestDetails = await fetchRequestDetails(item.RequestID);
                                const retryDatasetDetails = await fetchDatasetDetails(item.DataSetID);
                                displayCombinedDetails(combinedDetailsContainer, retryRequestDetails, retryDatasetDetails);
                            } catch (retryError) {
                                combinedDetailsContainer.innerHTML = `
                                    <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                                        <p class="text-red-600">Failed to load details</p>
                                        <p class="text-sm text-red-500 mt-1">${retryError.message || 'Unknown error'}</p>
                                    </div>
                                `;
                            }
                        });
                    }
                }
            });
            
            tbody.appendChild(row);
            tbody.appendChild(accordionRow);
            
            // Only add event listeners for the action buttons if they exist (Pending Approval status = 1)
            if (item.StatusID === 'Pending Approval') {
                console.log(`Status ID: ${item.StatusID}`);
            }
            // if (item.StatusID === 'Pending Approval') {
            accordionRow.querySelector('.action-approve')?.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event from bubbling up to row
                ApproveRequest(item);
            });
            
            accordionRow.querySelector('.action-reject')?.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event from bubbling up to row
                RejectRequest(item);
            });
            // }
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
        "statusId": parseInt(Object.keys(statusIdToNameMap).find(key => statusIdToNameMap[key] === status)),
    }
    
    console.log(apiParams)
    const response = await window.loomeApi.runApiRequest(API_ALL_REQUESTLISTS, apiParams);
    const parsedResponse = safeParseJson(response);
    const rawData = parsedResponse.Results;

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
    const response = await window.loomeApi.runApiRequest(API_ALL_REQUESTLISTS, apiParams);
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
async function renderApproversPage() {
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
    }
}

// Only run in browser environment, not during Jest testing
if (typeof jest === 'undefined') {
    renderApproversPage();
}

// ============================================================================
// MODULE EXPORTS (for Node.js/Jest testing)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Constants
        TABLE_CONTAINER_ID,
        API_ALL_REQUESTLISTS,
        API_APPROVE_REQUEST,
        API_REJECT_REQUEST,
        API_GET_REQUEST_DETAILS,
        API_GET_DATASET_DETAILS,
        API_GET_ALL_ASSIST_PROJECTS,
        statusIdToNameMap,
        configMap,
        rowsPerPage,
        // Functions
        getSearchInput,
        safeParseJson,
        formatDate,
        renderPagination,
        renderTable,
        ViewRequest,
        ViewDataSet,
        ApproveRequest,
        RejectRequest,
        showToast,
        hideToast,
        createToastContainer,
        fetchRequestDetails,
        fetchDatasetDetails,
        getProjectsMapping,
        displayCombinedDetails,
        getCounts,
        renderUI,
        refreshAllChipCounts,
        approveRequestFromAPI,
        rejectRequestFromAPI,
        // State accessors for testing
        get currentPage() { return currentPage; },
        set currentPage(val) { currentPage = val; },
        get allRequests() { return allRequests; },
        set allRequests(val) { allRequests = val; },
        get projectsCache() { return projectsCache; },
        set projectsCache(val) { projectsCache = val; }
    };
}

// ============================================================================
// UNIT TESTS
// ============================================================================
if (typeof describe === 'function') {
    const mod = typeof module !== 'undefined' && module.exports ? module.exports : {};

    describe('approver.js', () => {
        let mockApiResponse;
        let originalLoomeApi;

        beforeEach(() => {
            // Reset state
            mod.currentPage = 1;
            mod.allRequests = [];
            mod.projectsCache = null;

            // Setup DOM
            document.body.innerHTML = `
                <div id="requests-table-area"></div>
                <div id="pagination-controls"></div>
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
                <div id="toast-container"></div>
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

            // Mock bootstrap
            global.bootstrap = {
                Modal: {
                    getInstance: jest.fn(() => ({ hide: jest.fn() }))
                }
            };
        });

        afterEach(() => {
            window.loomeApi = originalLoomeApi;
            delete global.bootstrap;
            jest.restoreAllMocks();
        });

        // =====================================================================
        // Constants Tests
        // =====================================================================
        describe('Constants', () => {
            test('TABLE_CONTAINER_ID should be requests-table-area', () => {
                expect(mod.TABLE_CONTAINER_ID).toBe('requests-table-area');
            });

            test('API_ALL_REQUESTLISTS should be GetRequestList', () => {
                expect(mod.API_ALL_REQUESTLISTS).toBe('GetRequestList');
            });

            test('API_APPROVE_REQUEST should be ApproveRequestID', () => {
                expect(mod.API_APPROVE_REQUEST).toBe('ApproveRequestID');
            });

            test('API_REJECT_REQUEST should be RejectRequestID', () => {
                expect(mod.API_REJECT_REQUEST).toBe('RejectRequestID');
            });

            test('API_GET_REQUEST_DETAILS should be GetRequestID', () => {
                expect(mod.API_GET_REQUEST_DETAILS).toBe('GetRequestID');
            });

            test('API_GET_DATASET_DETAILS should be GetDataSetID', () => {
                expect(mod.API_GET_DATASET_DETAILS).toBe('GetDataSetID');
            });

            test('API_GET_ALL_ASSIST_PROJECTS should be GetAllAssistProjects', () => {
                expect(mod.API_GET_ALL_ASSIST_PROJECTS).toBe('GetAllAssistProjects');
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

            test('configMap should have correct showActions settings', () => {
                expect(mod.configMap['Pending Approval'].showActions).toBe(true);
                expect(mod.configMap['Approved'].showActions).toBe(false);
                expect(mod.configMap['Rejected'].showActions).toBe(false);
                expect(mod.configMap['Finalised'].showActions).toBe(false);
            });
        });

        // =====================================================================
        // getSearchInput Tests
        // =====================================================================
        describe('getSearchInput', () => {
            test('should return search input element', () => {
                const input = mod.getSearchInput();
                expect(input).toBeTruthy();
                expect(input.id).toBe('searchRequests');
            });

            test('should return null if element does not exist', () => {
                document.body.innerHTML = '';
                const input = mod.getSearchInput();
                expect(input).toBeNull();
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
                const paginatedStr = '{"Results":[{"RequestID":1}],"CurrentPage":1,"RowCount":25}';
                const result = mod.safeParseJson(paginatedStr);
                expect(result.Results).toEqual([{ RequestID: 1 }]);
                expect(result.RowCount).toBe(25);
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
        });

        // =====================================================================
        // renderPagination Tests
        // =====================================================================
        describe('renderPagination', () => {
            test('should render pagination controls', () => {
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
                expect(buttons[0].disabled).toBe(true);
                expect(buttons[1].disabled).toBe(true);
            });

            test('should disable Next and Last buttons on last page', () => {
                mod.renderPagination('pagination-controls', 50, 5, 10);
                const buttons = document.querySelectorAll('button[data-page]');
                expect(buttons[2].disabled).toBe(true);
                expect(buttons[3].disabled).toBe(true);
            });

            test('should not render pagination for single page', () => {
                mod.renderPagination('pagination-controls', 3, 5, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toBe('');
            });

            test('should handle missing container gracefully', () => {
                expect(() => mod.renderPagination('nonexistent', 50, 5, 1)).not.toThrow();
            });
        });

        // =====================================================================
        // Toast Functions Tests
        // =====================================================================
        describe('Toast Functions', () => {
            describe('showToast', () => {
                test('should create toast element with message', () => {
                    const toast = mod.showToast('Test message', 'info');
                    expect(toast).toBeTruthy();
                    expect(toast.innerHTML).toContain('Test message');
                });

                test('should apply info styling by default', () => {
                    const toast = mod.showToast('Info message');
                    expect(toast.style.backgroundColor).toBe('rgb(33, 150, 243)');
                });

                test('should apply success styling', () => {
                    const toast = mod.showToast('Success message', 'success');
                    expect(toast.style.backgroundColor).toBe('rgb(76, 175, 80)');
                });

                test('should apply error styling', () => {
                    const toast = mod.showToast('Error message', 'error');
                    expect(toast.style.backgroundColor).toBe('rgb(244, 67, 54)');
                });

                test('should append toast to container', () => {
                    mod.showToast('Test', 'info');
                    const container = document.getElementById('toast-container');
                    expect(container.children.length).toBeGreaterThan(0);
                });
            });

            describe('hideToast', () => {
                test('should set opacity to 0', () => {
                    const toast = mod.showToast('Test', 'info');
                    mod.hideToast(toast);
                    expect(toast.style.opacity).toBe('0');
                });

                test('should handle null toast gracefully', () => {
                    expect(() => mod.hideToast(null)).not.toThrow();
                });

                test('should handle already removed toast', () => {
                    const toast = mod.showToast('Test', 'info');
                    toast.remove();
                    expect(() => mod.hideToast(toast)).not.toThrow();
                });
            });

            describe('createToastContainer', () => {
                test('should create container with correct id', () => {
                    document.getElementById('toast-container').remove();
                    const container = mod.createToastContainer();
                    expect(container.id).toBe('toast-container');
                });

                test('should apply correct positioning styles', () => {
                    document.getElementById('toast-container').remove();
                    const container = mod.createToastContainer();
                    expect(container.style.position).toBe('fixed');
                    expect(container.style.top).toBe('12px');
                    expect(container.style.right).toBe('12px');
                });

                test('should append container to body', () => {
                    document.getElementById('toast-container').remove();
                    mod.createToastContainer();
                    expect(document.getElementById('toast-container')).toBeTruthy();
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
            });

            test('should include Scheduled Refresh options', () => {
                const request = { name: 'Test' };
                mod.ViewRequest(request);
                const modalBody = document.getElementById('viewRequestModalBody');
                expect(modalBody.innerHTML).toContain('No Refresh');
                expect(modalBody.innerHTML).toContain('Daily');
                expect(modalBody.innerHTML).toContain('Weekly');
                expect(modalBody.innerHTML).toContain('Monthly');
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

            test('should include Data Set Fields section', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Data Set Fields');
            });

            test('should include Meta Data section', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Meta Data');
            });

            test('should include Columns section', () => {
                const request = { approvers: 'test' };
                mod.ViewDataSet(request);
                const modalBody = document.getElementById('viewDatasetModalBody');
                expect(modalBody.innerHTML).toContain('Columns');
                expect(modalBody.innerHTML).toContain('Redact');
                expect(modalBody.innerHTML).toContain('Tokenise');
            });
        });

        // =====================================================================
        // ApproveRequest Tests
        // =====================================================================
        describe('ApproveRequest', () => {
            test('should set modal title with request name', () => {
                const request = { Name: 'Data Access Request', RequestID: 1 };
                mod.ApproveRequest(request);
                const title = document.getElementById('approveRequestModalLabel');
                expect(title.textContent).toBe('Approve Request: Data Access Request');
            });

            test('should populate modal body with confirmation', () => {
                const request = { Name: 'Test Request', RequestID: 1 };
                mod.ApproveRequest(request);
                const modalBody = document.getElementById('approveRequestModalBody');
                expect(modalBody.innerHTML).toContain('Please confirm the approval');
                expect(modalBody.innerHTML).toContain('Test Request');
            });

            test('should include Approve button', () => {
                const request = { Name: 'Test', RequestID: 1 };
                mod.ApproveRequest(request);
                const modalBody = document.getElementById('approveRequestModalBody');
                expect(modalBody.innerHTML).toContain('Approve');
                expect(modalBody.innerHTML).toContain('confirmApprovalBtn');
            });

            test('should add click event listener to confirm button', () => {
                const request = { Name: 'Test', RequestID: 1 };
                mod.ApproveRequest(request);
                const confirmBtn = document.getElementById('confirmApprovalBtn');
                expect(confirmBtn).toBeTruthy();
            });
        });

        // =====================================================================
        // RejectRequest Tests
        // =====================================================================
        describe('RejectRequest', () => {
            test('should set modal title with request name', () => {
                const request = { name: 'Data Access Request', Name: 'Data Access Request', RequestID: 1 };
                mod.RejectRequest(request);
                const title = document.getElementById('rejectRequestModalLabel');
                expect(title.textContent).toBe('Reject Request: Data Access Request');
            });

            test('should populate modal body with rejection confirmation', () => {
                const request = { name: 'Test', Name: 'Test Request', RequestID: 1 };
                mod.RejectRequest(request);
                const modalBody = document.getElementById('rejectRequestModalBody');
                expect(modalBody.innerHTML).toContain('Please confirm the Rejection');
                expect(modalBody.innerHTML).toContain('Test Request');
            });

            test('should include Reject button', () => {
                const request = { name: 'Test', Name: 'Test', RequestID: 1 };
                mod.RejectRequest(request);
                const modalBody = document.getElementById('rejectRequestModalBody');
                expect(modalBody.innerHTML).toContain('Reject');
                expect(modalBody.innerHTML).toContain('confirmRejectBtn');
            });
        });

        // =====================================================================
        // fetchRequestDetails Tests
        // =====================================================================
        describe('fetchRequestDetails', () => {
            test('should call API with correct parameters', async () => {
                mockApiResponse = JSON.stringify({
                    RequestID: 1,
                    Name: 'Test Request',
                    StatusID: 1
                });

                await mod.fetchRequestDetails(1);

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetRequestID',
                    { RequestID: 1 }
                );
            });

            test('should return parsed response', async () => {
                mockApiResponse = JSON.stringify({
                    RequestID: 1,
                    Name: 'Test Request',
                    Description: 'Test description',
                    StatusID: 1,
                    ProjectID: 10,
                    DataSetID: 5
                });

                const result = await mod.fetchRequestDetails(1);

                expect(result.RequestID).toBe(1);
                expect(result.Name).toBe('Test Request');
                expect(result.ProjectID).toBe(10);
            });

            test('should throw error on API failure', async () => {
                window.loomeApi.runApiRequest = jest.fn(() => Promise.reject(new Error('API Error')));

                await expect(mod.fetchRequestDetails(1)).rejects.toThrow('API Error');
            });
        });

        // =====================================================================
        // fetchDatasetDetails Tests
        // =====================================================================
        describe('fetchDatasetDetails', () => {
            test('should call API with correct parameters', async () => {
                mockApiResponse = JSON.stringify({
                    DataSetID: 5,
                    Name: 'Test Dataset'
                });

                await mod.fetchDatasetDetails(5);

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetDataSetID',
                    { DataSetID: 5 }
                );
            });

            test('should return parsed response', async () => {
                mockApiResponse = JSON.stringify({
                    DataSetID: 5,
                    Name: 'Test Dataset',
                    Description: 'Dataset description',
                    DataSourceID: 10,
                    IsActive: true,
                    Approvers: 'admin@test.com'
                });

                const result = await mod.fetchDatasetDetails(5);

                expect(result.DataSetID).toBe(5);
                expect(result.Name).toBe('Test Dataset');
                expect(result.DataSourceID).toBe(10);
            });
        });

        // =====================================================================
        // getProjectsMapping Tests
        // =====================================================================
        describe('getProjectsMapping', () => {
            test('should call API for projects', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [
                        { AssistProjectID: 1, Name: 'Project 1', Description: 'Desc 1' },
                        { AssistProjectID: 2, Name: 'Project 2', Description: 'Desc 2' }
                    ]
                });

                await mod.getProjectsMapping();

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith('GetAllAssistProjects');
            });

            test('should return mapping from project ID to name and description', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [
                        { AssistProjectID: 1, Name: 'Project 1', Description: 'Desc 1' },
                        { AssistProjectID: 2, Name: 'Project 2', Description: 'Desc 2' }
                    ]
                });

                const mapping = await mod.getProjectsMapping();

                expect(mapping[1]).toEqual({ name: 'Project 1', description: 'Desc 1' });
                expect(mapping[2]).toEqual({ name: 'Project 2', description: 'Desc 2' });
            });

            test('should cache results', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [
                        { AssistProjectID: 1, Name: 'Project 1', Description: 'Desc 1' }
                    ]
                });

                await mod.getProjectsMapping();
                await mod.getProjectsMapping();

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledTimes(1);
            });

            test('should return empty object on error', async () => {
                window.loomeApi.runApiRequest = jest.fn(() => Promise.reject(new Error('API Error')));
                mod.projectsCache = null;

                const result = await mod.getProjectsMapping();

                expect(result).toEqual({});
            });
        });

        // =====================================================================
        // displayCombinedDetails Tests
        // =====================================================================
        describe('displayCombinedDetails', () => {
            test('should show no details message when both details are empty', async () => {
                const container = document.createElement('div');
                await mod.displayCombinedDetails(container, {}, {});
                expect(container.innerHTML).toContain('No details available');
            });

            test('should display dataset name', async () => {
                mod.projectsCache = { 1: { name: 'Project 1', description: 'Desc' } };
                const container = document.createElement('div');
                const requestDetails = { ProjectID: 1 };
                const datasetDetails = { Name: 'Test Dataset', DataSourceID: 10 };

                await mod.displayCombinedDetails(container, requestDetails, datasetDetails);

                expect(container.innerHTML).toContain('Test Dataset');
            });

            test('should display project name from mapping', async () => {
                mod.projectsCache = { 1: { name: 'My Project', description: 'Project description' } };
                const container = document.createElement('div');
                const requestDetails = { ProjectID: 1 };
                const datasetDetails = { Name: 'Dataset', DataSourceID: 10 };

                await mod.displayCombinedDetails(container, requestDetails, datasetDetails);

                expect(container.innerHTML).toContain('My Project');
            });

            test('should display Unknown Project for missing project', async () => {
                mod.projectsCache = {};
                const container = document.createElement('div');
                const requestDetails = { ProjectID: 999 };
                const datasetDetails = { Name: 'Dataset', DataSourceID: 10 };

                await mod.displayCombinedDetails(container, requestDetails, datasetDetails);

                expect(container.innerHTML).toContain('Unknown Project');
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
                expect(container.innerHTML).toContain('Request ID');
                expect(container.innerHTML).toContain('Request Name');
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
                expect(container.innerHTML).toContain('Finalised on');
            });

            test('should show no requests message when data is empty', () => {
                mod.renderTable('requests-table-area', [], config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('No requests found');
            });

            test('should render data rows correctly', () => {
                const data = [{
                    RequestID: 1,
                    Name: 'Test Request',
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Pending Approval',
                    StatusID: 1,
                    Approvers: 'admin@test.com',
                    DataSetID: 5
                }];
                mod.renderTable('requests-table-area', data, config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('Test Request');
                expect(container.innerHTML).toContain('user@test.com');
                expect(container.innerHTML).toContain('admin@test.com');
            });

            test('should include chevron icon for expandable rows', () => {
                const data = [{
                    RequestID: 1,
                    Name: 'Test',
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Pending Approval',
                    StatusID: 1,
                    Approvers: 'admin@test.com',
                    DataSetID: 5
                }];
                mod.renderTable('requests-table-area', data, config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('chevron-icon');
            });

            test('should include action buttons for Pending Approval', () => {
                const data = [{
                    RequestID: 1,
                    Name: 'Test',
                    CreateDate: '2024-06-15',
                    CreateUser: 'user@test.com',
                    status: 'Pending Approval',
                    StatusID: 1,
                    Approvers: 'admin@test.com',
                    DataSetID: 5
                }];
                mod.renderTable('requests-table-area', data, config, 'Pending Approval');
                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('action-approve');
                expect(container.innerHTML).toContain('action-reject');
            });
        });

        // =====================================================================
        // getCounts Tests
        // =====================================================================
        describe('getCounts', () => {
            test('should call API with correct parameters for Pending Approval', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 15
                });

                const count = await mod.getCounts('Pending Approval');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetRequestList',
                    expect.objectContaining({
                        statusId: 1
                    })
                );
                expect(count).toBe(15);
            });

            test('should call API with correct statusId for Approved', async () => {
                mockApiResponse = JSON.stringify({ Results: [], RowCount: 10 });

                await mod.getCounts('Approved');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetRequestList',
                    expect.objectContaining({ statusId: 2 })
                );
            });

            test('should call API with correct statusId for Finalised', async () => {
                mockApiResponse = JSON.stringify({ Results: [], RowCount: 5 });

                await mod.getCounts('Finalised');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetRequestList',
                    expect.objectContaining({ statusId: 3 })
                );
            });

            test('should call API with correct statusId for Rejected', async () => {
                mockApiResponse = JSON.stringify({ Results: [], RowCount: 3 });

                await mod.getCounts('Rejected');

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetRequestList',
                    expect.objectContaining({ statusId: 4 })
                );
            });
        });

        // =====================================================================
        // renderUI Tests
        // =====================================================================
        describe('renderUI', () => {
            test('should call API with correct parameters', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [],
                    RowCount: 0
                });

                await mod.renderUI();

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetRequestList',
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
                        CreateDate: '2024-06-15',
                        CreateUser: 'user@test.com',
                        StatusID: 1,
                        Approvers: 'admin@test.com',
                        DataSetID: 5
                    }],
                    RowCount: 1
                });

                await mod.renderUI();

                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('API Request');
            });

            test('should not render if no active chip', async () => {
                document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));

                await mod.renderUI();

                expect(window.loomeApi.runApiRequest).not.toHaveBeenCalled();
            });

            test('should transform StatusID to status name', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{
                        RequestID: 1,
                        Name: 'Test',
                        CreateDate: '2024-06-15',
                        CreateUser: 'user@test.com',
                        StatusID: 1,
                        Approvers: 'admin',
                        DataSetID: 5
                    }],
                    RowCount: 1
                });

                await mod.renderUI();

                expect(mod.allRequests[0].status).toBe('Pending Approval');
            });
        });

        // =====================================================================
        // approveRequestFromAPI Tests
        // =====================================================================
        describe('approveRequestFromAPI', () => {
            beforeEach(() => {
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            test('should call API with request ID', async () => {
                mockApiResponse = JSON.stringify({
                    RequestID: 1,
                    StatusID: 2
                });

                const promise = mod.approveRequestFromAPI(1);
                await promise;

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'ApproveRequestID',
                    { id: 1 }
                );
            });

            test('should show loading toast', async () => {
                mockApiResponse = JSON.stringify({ RequestID: 1 });

                await mod.approveRequestFromAPI(1);

                const container = document.getElementById('toast-container');
                expect(container.innerHTML).toContain('Approving request');
            });
        });

        // =====================================================================
        // rejectRequestFromAPI Tests
        // =====================================================================
        describe('rejectRequestFromAPI', () => {
            beforeEach(() => {
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            test('should call API with request ID', async () => {
                mockApiResponse = JSON.stringify({
                    RequestID: 1,
                    StatusID: 4
                });

                await mod.rejectRequestFromAPI(1);

                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'RejectRequestID',
                    { id: 1 }
                );
            });

            test('should show loading toast', async () => {
                mockApiResponse = JSON.stringify({ RequestID: 1 });

                await mod.rejectRequestFromAPI(1);

                const container = document.getElementById('toast-container');
                expect(container.innerHTML).toContain('Rejecting request');
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

            test('should allow setting and getting projectsCache', () => {
                mod.projectsCache = { 1: { name: 'Test' } };
                expect(mod.projectsCache).toEqual({ 1: { name: 'Test' } });
            });
        });

        // =====================================================================
        // Integration Tests
        // =====================================================================
        describe('Integration Tests', () => {
            test('should handle full approval flow rendering', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [
                        {
                            RequestID: 1,
                            Name: 'Pending Request',
                            CreateDate: '2024-06-15T10:00:00',
                            CreateUser: 'researcher@test.com',
                            StatusID: 1,
                            Approvers: 'admin@test.com',
                            DataSetID: 5
                        }
                    ],
                    RowCount: 1
                });

                await mod.renderUI();

                const container = document.getElementById('requests-table-area');
                expect(container.querySelector('table')).toBeTruthy();
                expect(container.innerHTML).toContain('Pending Request');
                expect(container.innerHTML).toContain('researcher@test.com');
            });

            test('should format dates correctly in rendered table', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{
                        RequestID: 1,
                        Name: 'Test',
                        CreateDate: '2024-01-15',
                        CreateUser: 'user@test.com',
                        StatusID: 2,
                        CurrentlyApproved: 'approver@test.com',
                        ApprovedDate: '2024-01-16',
                        DataSetID: 5
                    }],
                    RowCount: 1
                });

                document.querySelector('.chip.active').classList.remove('active');
                document.querySelector('.chip[data-status="Approved"]').classList.add('active');

                await mod.renderUI();

                const container = document.getElementById('requests-table-area');
                expect(container.innerHTML).toContain('January 15, 2024');
                expect(container.innerHTML).toContain('January 16, 2024');
            });
        });

    }); // End describe('approver.js')
} // End if (typeof describe === 'function')
