// =================================================================
//                      STATE & CONFIGURATION
// =================================================================

const TABLE_CONTAINER_ID = 'import-jobs-table-area';
const GET_DATAIMPORT_FROM_INTEGRATE = 'GetDataImport';
const GET_DATAIMPORT_FROM_DB = 'GetDataImportFromDBbyUpn';
const IMPORT_REQUEST_API_ID = 'GetAssistProjectsFilteredByUpn'; 
const SUBMIT_IMPORT_API_ID = 'RequestDataImportByAssistProjectID';
const UPDATE_IMPORT_REQUEST = 'UpdateDataImportRequest';

// Modal Element IDs
const MODAL_ID = 'import-modal';
const OPEN_MODAL_BTN_ID = 'request-import-btn';
const CLOSE_MODAL_BTN_ID = 'modal-close-btn';
const IMPORT_FORM_ID = 'import-form';
const DROPDOWN_ID = 'import-type';
const SUBMIT_MODAL_BTN_ID = 'modal-submit-btn';

// State for pagination
let currentPage = 1;
let totalPages = 1;
const rowsPerPage = 5;

// This will store all the jobs after the initial fetch
let allJobs = [];
let isDropdownPopulated = false;

// Mapping from Status to Status display (used for filtering)
const statusIdToNameMap = {};
statusIdToNameMap[-2] = 'Failed';
statusIdToNameMap[-1] = 'Working';
statusIdToNameMap[0] = 'Awaiting Submission';
statusIdToNameMap[1] = 'Pending Approval';
statusIdToNameMap[2] = 'Approved';
statusIdToNameMap[3] = 'Rejected';
statusIdToNameMap[4] = 'Finalised';

// Configuration for each status tab
const configMap = {
    'Failed': { showActions: false },
    'Working': { showActions: false },
    'Awaiting Submission': { showActions: true },
    'Pending Approval': { showActions: false },
    'Approved': { showActions: false },
    'Rejected': { showActions: false },
    'Finalised': { showActions: false },
};

// Search input
const searchInput = document.getElementById('searchImports'); 

// =================================================================
//                      UTILITY FUNCTIONS
// =================================================================
/**
 * Displays a temporary "toast" notification on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of toast ('success', 'error', 'info').
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.style.cssText = 'margin-bottom:10px;padding:12px 16px;border-radius:6px;color:#fff;display:flex;align-items:center;min-width:250px;max-width:360px;opacity:0;transition:opacity .25s ease,transform .25s ease;';

    let bgColor = '#2196F3'; // info default
    if (type === 'success') bgColor = '#1AABA3';
    if (type === 'error') bgColor = '#f44336';
    if (type === 'warning') bgColor = '#ff9800';
    toast.style.backgroundColor = bgColor;

    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';
    textWrap.textContent = message;
    toast.appendChild(textWrap);

    // Add close button for error toasts (persistent)
    if (type === 'error') {
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = 'background:transparent;border:none;color:#fff;font-size:18px;margin-left:12px;cursor:pointer;';
        closeBtn.onclick = () => {
            if (toast.parentNode) toast.remove();
        };
        toast.appendChild(closeBtn);
    }

    container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });

    // Auto-dismiss for non-error toasts
    const dismissDuration = (typeof duration === 'number') ? duration : 5000;
    if (type !== 'error') {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 250);
            }
        }, dismissDuration);
    }

    return toast;
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-top-right';
    container.style.cssText = 'position: fixed; top: 12px; right: 12px; z-index: 9999;';
    document.body.appendChild(container);
    return container;
}


function safeParseJson(response) {
    return typeof response === 'string' ? JSON.parse(response) : response;
}

function formatDate(inputDate) {
    if (!inputDate) return 'N/A';
    const date = new Date(inputDate);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Returns appropriate CSS classes for status chips based on status
 */
function getStatusChipColor(status) {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
        case 'failed':
            return 'bg-red-100 text-red-800';
        case 'working':
            return 'bg-purple-100 text-purple-800';
        case 'awaiting submission':
            return 'bg-yellow-100 text-yellow-800';
        case 'pending approval':
            return 'bg-blue-100 text-blue-800';
        case 'approved':
        case 'finalised':
            return 'bg-green-100 text-green-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Handles the submit action for import jobs
 */
async function submitImportJob(jobId, jobName) {
    try {
        const confirmed = confirm(`Are you sure you want to submit the import job "${jobName}"?`);
        if (!confirmed) return;

        showToast('Submitting import job...', 'info');
        
        // API call to submit the job
        const params = { jobId: jobId };
        const response = await window.loomeApi.runApiRequest(UPDATE_IMPORT_REQUEST, params);
        
        // Parse and validate the response
        const parsedResponse = safeParseJson(response);
        console.log('Submit import job response:', parsedResponse);
        
        // Check if the submission was successful
        if (parsedResponse && (parsedResponse.success || parsedResponse.Success || parsedResponse.status === 'success')) {
            showToast(`Import job "${jobName}" submitted successfully!`, 'success');
            
            // Refresh the data after a short delay
            setTimeout(() => {
                initializePage();
            }, 1000);
        } else {
            // Handle cases where the API call succeeded but the operation failed
            const errorMessage = parsedResponse?.message || parsedResponse?.Message || 'Submission failed';
            showToast(`Failed to submit import job: ${errorMessage}`, 'error');
        }
        
    } catch (error) {
        console.error('Error submitting import job:', error);
        showToast('Failed to submit import job. Please try again.', 'error');
    }
}

// =================================================================
//                      MODAL & FORM FUNCTIONS
// =================================================================

async function populateAssistProjectsDropdown() { 
    const dropdown = document.getElementById(DROPDOWN_ID);
    if (!dropdown) return;

    dropdown.disabled = true;
    dropdown.innerHTML = '<option value="">Loading...</option>';

    try {
        const response = await window.loomeApi.runApiRequest(IMPORT_REQUEST_API_ID, {});
        const data = safeParseJson(response);
        const assistProjects = data.Results;

        dropdown.innerHTML = '<option value="">Select source Assist Project...</option>';

        if (assistProjects && assistProjects.length > 0) {
            assistProjects.forEach(type => {
                const option = document.createElement('option');
                option.value = type.AssistProjectID;
                option.textContent = type.Name;

                // Store extra data on the option element
                option.dataset.name = type.Name; 
                option.dataset.tenantsId = type.LoomeAssistTenantsID;

                
                dropdown.appendChild(option);
            });
            isDropdownPopulated = true; 
        } else {
            dropdown.innerHTML = '<option value="">No Assist Project found.</option>';
        }
    } catch (error) {
        console.error("Failed to populate dropdown:", error);
        dropdown.innerHTML = '<option value="">Error loading options.</option>';
    } finally {
        dropdown.disabled = false;
    }
}

/**
 * Opens the modal dialog and populates dropdown if needed.
 */
function openModal() { // MODIFIED: To reset form state on open
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
        modal.classList.remove('hidden');

        // Reset form to its initial state
        document.getElementById(DROPDOWN_ID).selectedIndex = 0;
        document.getElementById(SUBMIT_MODAL_BTN_ID).disabled = true;

        if (!isDropdownPopulated) {
            populateAssistProjectsDropdown();
        }
    }
}

function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
        modal.classList.add('hidden');
    }
}


// =================================================================
//                      RENDERING FUNCTIONS
// =================================================================

function renderTable(containerId, data, config, selectedStatus, searchTerm = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    if (!data || data.length === 0) {
        const message = searchTerm.trim() ? 
            'No import jobs found. Please review your search term.' : 
            'No import jobs found.';
        container.innerHTML = `<p class="text-center text-gray-500">${message}</p>`;
        return;
    }

    const table = document.createElement('table');
    table.className = 'w-full divide-y divide-gray-200';
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    const headerRow = document.createElement('tr');
    
    // Add a column for the chevron
    const chevronTh = document.createElement('th');
    chevronTh.className = 'w-10 px-6 py-3';
    chevronTh.innerHTML = '';
    headerRow.appendChild(chevronTh);
    
    // Define headers - only include Status for Awaiting Submission filter
    const headers = ['Import Request Name', 'Date Created'];
    if (selectedStatus === 'Awaiting Submission') {
        headers.push('Status');
    }
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
    
    data.forEach((item, index) => {
        const statusId = item.StatusID ?? 0;
        const itemStatus = statusIdToNameMap[statusId] !== undefined ? statusIdToNameMap[statusId] : (statusIdToNameMap[String(statusId)] || 'Awaiting Submission');
        
        // Main row
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 cursor-pointer';
        row.innerHTML = `
            <td class="w-10 px-6 py-4">
                <button class="toggle-details flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600" data-item-index="${index}">
                    <svg class="w-4 h-4 transition-transform duration-200 transform chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.ImportRequestName || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${formatDate(item.CreateDate)}</td>
            ${selectedStatus === 'Awaiting Submission' ? `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusChipColor(itemStatus)}">
                        ${itemStatus}
                    </span>
                </td>
            ` : ''}
        `;
        tbody.appendChild(row);

        // Accordion details row (initially hidden)
        const detailRow = document.createElement('tr');
        detailRow.className = 'details-row hidden';
        detailRow.innerHTML = `
            <td colspan="4" class="px-6 py-0">
                <div class="border-l-4 border-blue-200 bg-gray-50 p-4">
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="font-medium text-gray-600">Job Name:</span>
                                <span class="ml-2 text-gray-800">${item.JobName || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${itemStatus === 'Awaiting Submission'  && config.showActions ? `
                        <div class="mt-4 flex justify-end">
                            <button onclick="submitImportJob('${item.ImportRequestID}', '${item.ImportRequestName}')" 
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                Submit Import
                            </button>
                        </div>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(detailRow);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);

    // Add click event listeners for accordion toggles
    const toggleButtons = container.querySelectorAll('.toggle-details');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const row = this.closest('tr');
            const detailRow = row.nextElementSibling;
            const chevronIcon = this.querySelector('.chevron-icon');
            
            // Toggle visibility
            if (detailRow.classList.contains('hidden')) {
                detailRow.classList.remove('hidden');
                chevronIcon.style.transform = 'rotate(90deg)';
            } else {
                detailRow.classList.add('hidden');
                chevronIcon.style.transform = 'rotate(0deg)';
            }
        });
    });
}

function renderPagination(containerId, totalItems, itemsPerPage, currentPage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    totalPages = Math.ceil(totalItems / itemsPerPage);
    container.innerHTML = '';

    if (totalPages <= 1) return;

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
                   class="w-16 text-center border border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
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

function renderUI() {
    const activeChip = document.querySelector('.chip.active');
    const selectedStatus = activeChip ? activeChip.dataset.status : 'Awaiting Submission';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const config = configMap[selectedStatus];

    // Filter allJobs by selected status
    let filteredJobs = allJobs.filter(job => {
        const statusId = job.lastExecution?.statusId ?? 0;
        const jobStatus = statusIdToNameMap[statusId] || 'Awaiting Submission';
        
        if (selectedStatus === 'Awaiting Submission') {
            return jobStatus === 'Failed' || jobStatus === 'Working' || jobStatus === 'Awaiting Submission';
        }
        return jobStatus === selectedStatus;
    });

    // Apply pagination
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const jobsForCurrentPage = filteredJobs.slice(startIndex, endIndex);

    renderTable(TABLE_CONTAINER_ID, jobsForCurrentPage, config, selectedStatus, searchTerm);
    renderPagination('pagination-controls', filteredJobs.length, rowsPerPage, currentPage);
}

// =================================================================
//                      API & COUNTING FUNCTIONS
// =================================================================

async function getCounts(status) {
    // Count jobs by status from the full allJobs array
    // "Awaiting Submission" includes Working (-1), Failed (-2), and Awaiting Submission (0)
    const count = allJobs.filter(job => {
        const statusId = job.lastExecution?.statusId ?? 0;
        const jobStatus = statusIdToNameMap[statusId] || 'Awaiting Submission';
        
        if (status === 'Awaiting Submission') {
            return jobStatus === 'Failed' || jobStatus === 'Working' || jobStatus === 'Awaiting Submission';
        }
        return jobStatus === status;
    }).length;
    return count;
}

async function refreshAllChipCounts() {
    const chipsContainer = document.getElementById('status-chips-container');
    if (!chipsContainer) return;
    
    for (const chip of chipsContainer.querySelectorAll('.chip')) {
        const status = chip.dataset.status;
        const count = await getCounts(status);
        const countSpan = chip.querySelector('.chip-count');
        if (countSpan) {
            countSpan.textContent = count;
        }
    }
}

// =================================================================
//                      INITIALIZATION
// =================================================================

async function initializePage() {
    const container = document.getElementById(TABLE_CONTAINER_ID);
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500">Loading Import Jobs...</p>';

    try {
        const initialResponse = await window.loomeApi.runApiRequest(GET_DATAIMPORT_FROM_DB, { page: 1, pageSize: 1, search: '' });
        const initialData = safeParseJson(initialResponse);
        const totalJobs = initialData.RowCount;
        allJobs = []; // Clear previous data

        if (totalJobs > 0) {
            const allDataResponse = await window.loomeApi.runApiRequest(GET_DATAIMPORT_FROM_DB, { page: 1, pageSize: totalJobs, search: ''   });
            const allData = safeParseJson(allDataResponse);
            // Populate allJobs and sort by dateCreated descending (most recent first)
            allJobs = (allData.Results || []).slice();
            allJobs.sort((a, b) => {
                const ta = a && a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                const tb = b && b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                return tb - ta; // newest first
            });
        }
        
        // Update chip counts
        await refreshAllChipCounts();
        
        // Render initial UI
        renderUI();

    } catch (error) {
        console.error("Error initializing page:", error);
        container.innerHTML = `<p class="text-center text-red-500">Failed to load data.</p>`;
    }
}

// =================================================================
//                      EVENT LISTENERS
// =================================================================

function setupEventListeners() {
    // Status chip filtering
    const chipsContainer = document.getElementById('status-chips-container');
    if (chipsContainer) {
        chipsContainer.addEventListener('click', (event) => {
            const clickedChip = event.target.closest('.chip');
            if (!clickedChip) return;

            // Remove active class from all chips and add to clicked chip
            chipsContainer.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
            clickedChip.classList.add('active');
            
            // Reset to first page and render
            currentPage = 1;
            renderUI();
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1; // Reset to first page on search
            renderUI();
        });
    }

    // Pagination button clicks
    document.getElementById('pagination-controls').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) return;
        
        currentPage = parseInt(button.dataset.page, 10);
        renderUI();
    });

    // Pagination page input
    document.getElementById('pagination-controls').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.id === 'page-input') {
            const inputElement = event.target;
            const newPage = parseInt(inputElement.value, 10);

            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                renderUI();
            } else {
                showToast(`Please enter a page number between 1 and ${totalPages}.`, "error");
                inputElement.value = currentPage;
            }
        }
    });

    // Modal event listeners
    const openBtn = document.getElementById(OPEN_MODAL_BTN_ID);
    const closeBtn = document.getElementById(CLOSE_MODAL_BTN_ID);
    const modal = document.getElementById(MODAL_ID);
    const form = document.getElementById(IMPORT_FORM_ID);
    const dropdown = document.getElementById(DROPDOWN_ID);
    const submitButton = document.getElementById(SUBMIT_MODAL_BTN_ID);

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (dropdown && submitButton) {
        dropdown.addEventListener('change', () => {
            submitButton.disabled = !dropdown.value;
        });
    }
    
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const importNameInput = document.getElementById('import-request-name');
            const importName = importNameInput ? importNameInput.value.trim() : '';
            
            if (!importName) {
                showToast('Please enter an Import Request Name.');
                return;
            }

            const selectedOption = dropdown.options[dropdown.selectedIndex];
            
            if (!selectedOption || !selectedOption.value) {
                showToast('Please select an Assist Project.');
                return;
            }

            const selectedAssistProjectID = selectedOption.value;
            const selectedName = selectedOption.dataset.name;
            const selectedTenantsID = selectedOption.dataset.tenantsId;

            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';

            try {
                const params = { 
                    "ImportRequestName": importName,
                    "LoomeAssistProjectID": parseInt(selectedAssistProjectID, 10),
                    "LoomeAssistName": selectedName,
                    "LoomeAssistTenantsID": selectedTenantsID
                };

                console.log('Submitting import request with params:', params);
                await window.loomeApi.runApiRequest(SUBMIT_IMPORT_API_ID, params);
                showToast('Import request submitted successfully! Refreshing page in 5 seconds...', "success");
                closeModal();
                // Wait a moment before refreshing to allow backend processing to start
                await new Promise(resolve => setTimeout(resolve, 5000));
                await initializePage(); 
            } catch (error) {
                console.error('Failed to submit import request:', error);
                showToast('An error occurred while submitting the request. Please try again.', "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Request';
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Start the application once the document is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializePage();
});