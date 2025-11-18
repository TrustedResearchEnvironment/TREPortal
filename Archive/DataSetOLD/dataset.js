// =================================================================
//                      STATE & CONFIGURATION
// =================================================================
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_REQUEST_ID = 15;

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
        
        const response = await window.loomeApi.runApiRequest(23, {
            "id": requestId,
            "upn": getCurrentUserUpn()
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
        
        const response = await window.loomeApi.runApiRequest(24, {
            "id": requestId,
            "upn": getCurrentUserUpn(),
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
        // Get current user's UPN
        const upn = getCurrentUserUpn(); // You'll need to implement this function
        
        // Call the API
        const response = await window.loomeApi.runApiRequest(8, {
            "RequestID": requestID,
            "upn": upn
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
        // Get current user's UPN
        const upn = getCurrentUserUpn(); // You'll need to implement this function
        
        // Call the API
        const response = await window.loomeApi.runApiRequest(6, {
            "DataSetID": datasetID,
            "upn": upn
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
        // Get current user's UPN or use the hardcoded one
        const upn = getCurrentUserUpn() || 'migueltestupn';
        
        // Fetch projects data
        const response = await window.loomeApi.runApiRequest(9, { upn });
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

/**
 * Gets the current user's UPN
 * @returns {string} - The user's UPN
 */
function getCurrentUserUpn() {
    return "o.dean@deakin.edu.au";
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
    const headers = ['Request ID', 'Request Name', 'Requested On'];
    if (selectedStatus === 'Pending Approval') headers.push('Approvers');
    else if (selectedStatus === 'Approved') { headers.push('Approved by'); headers.push('Approved on'); }
    else if (selectedStatus === 'Rejected') { headers.push('Rejected by'); headers.push('Rejected on'); }
    else if (selectedStatus === 'Finalised') { headers.push('Approved on'); headers.push('Approved by'); headers.push('Finalised on'); }
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
                        
                        // Then try fetching dataset details
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
        "upn": getCurrentUserUpn()
    }
    
    console.log(apiParams)
    const response = await window.loomeApi.runApiRequest(API_REQUEST_ID, apiParams);
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
    }
}

// Start the application
renderApproversPage();
