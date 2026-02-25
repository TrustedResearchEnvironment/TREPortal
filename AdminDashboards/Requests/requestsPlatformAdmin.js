// =================================================================
//                      STATE & CONFIGURATION
// =================================================================
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_REQUEST_ID = 'GetAllRequests';
const API_APPROVE_REQUEST = 'ApproveRequestID';
const API_REJECT_REQUEST = 'RejectRequestID';
const API_GET_REQUEST_DETAILS = 'GetRequestID';
const API_GET_DATASET_DETAILS = 'GetDataSetID';
const API_GET_ALL_ASSIST_PROJECTS = 'GetAllAssistProjects';

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
// Global variable to store project data
let projectsCache = null;

async function getProjectsMapping() {
    // Return cache if already loaded
    if (projectsCache) {
        return projectsCache;
    }
    
    try {
        
        // Fetch projects data
        const initialParams = { "page": 1, "page_size": 100, "search": '' };
        const data = await getFromAPI(API_GET_ALL_ASSIST_PROJECTS, initialParams);
        console.log("Projects data fetched:", data);
        // Create a mapping from project ID to project name
        const mapping = {};
        if (data ) {
            data.forEach(project => {
                mapping[project.AssistProjectID] = {
                    name: project.Name,
                    description: project.Description
                };
            });
        }
        console.log("Projects mapping created:", mapping);
        // Cache the mapping
        projectsCache = mapping;
        return mapping;
        
    } catch (error) {
        console.error("Error fetching projects:", error);
        return {}; // Return empty object in case of error
    }
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
            <div class="grid grid-cols-2 gap-5">
                <div>
                    <div class="space-y-3">
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

                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Target Project Name</span>
                            <span class="text-sm text-gray-500">${projectInfo.name}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="space-y-3">
                        ${requestDetails.Purpose ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Purpose</span>
                            <span class="text-sm text-gray-500">${requestDetails.Purpose}</span>
                        </div>` : ''}

                        ${requestDetails.ApprovalMessage ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Approval Message</span>
                            <span class="text-sm text-gray-500">${requestDetails.ApprovalMessage}</span>
                        </div>` : ''}

                        ${requestDetails.RejectionMessage ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Rejection Message</span>
                            <span class="text-sm text-gray-500">${requestDetails.RejectionMessage}</span>
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
        searchInput.addEventListener('input', () => {
            currentPage = 1; // Reset to page 1 when searching
            renderUI(); // Re-render everything
        });

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

// Start the application
renderMyRequestsPage();
