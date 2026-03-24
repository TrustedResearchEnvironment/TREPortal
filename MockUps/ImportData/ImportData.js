// =================================================================
//                      STATE & CONFIGURATION
// =================================================================

const TABLE_CONTAINER_ID = 'import-jobs-table-area';
const API_REQUEST_ID = 'GetDataImport';
const IMPORT_REQUEST_API_ID = 'GetAssistProjectsFilteredByUpn'; 
const SUBMIT_IMPORT_API_ID = 'RequestDataImportByAssistProjectID';

// Modal Element IDs
const MODAL_ID = 'import-modal';
const OPEN_MODAL_BTN_ID = 'request-import-btn';
const CLOSE_MODAL_BTN_ID = 'modal-close-btn';
const IMPORT_FORM_ID = 'import-form';
const DROPDOWN_ID = 'import-type';
const SUBMIT_MODAL_BTN_ID = 'modal-submit-btn'; // ADDED: ID for submit button

// State for pagination
let currentPage = 1;
const rowsPerPage = 5;

// This will store all the jobs after the initial fetch
let allJobs = [];
let isDropdownPopulated = false; 

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

function renderTable(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No import requests found.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    const headerRow = document.createElement('tr');
    // const headers = ['Job Name', 'Created By', 'Date Created', 'Status'];
    const headers = ['Job Name', 'Date Created', 'Status'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.jobName || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${formatDate(item.dateCreated)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.lastExecution.status ?? 'In progress'}</td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function renderPagination(containerId, totalItems, itemsPerPage, currentPage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
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
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const jobsForCurrentPage = allJobs.slice(startIndex, endIndex);

    renderTable(TABLE_CONTAINER_ID, jobsForCurrentPage);
    renderPagination('pagination-controls', allJobs.length, rowsPerPage, currentPage);
}

// =================================================================
//                      INITIALIZATION
// =================================================================

async function initializePage() {
    const container = document.getElementById(TABLE_CONTAINER_ID);
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500">Loading Requests...</p>';

    try {
        const initialResponse = await window.loomeApi.runApiRequest(API_REQUEST_ID, { page: 1, pageSize: 1 });
        const initialData = safeParseJson(initialResponse);
        const totalJobs = initialData.RowCount;
        allJobs = []; // Clear previous data

        if (totalJobs > 0) {
            const allDataResponse = await window.loomeApi.runApiRequest(API_REQUEST_ID, { page: 1, pageSize: totalJobs });
            const allData = safeParseJson(allDataResponse);
            // allJobs = allData.Results;
            // Populate allJobs and sort by `dateCreated` descending (most recent first)
            allJobs = (allData.Results || []).slice();
            allJobs.sort((a, b) => {
                const ta = a && a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                const tb = b && b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                return tb - ta; // newest first
            });
        }
        
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
    document.getElementById('pagination-controls').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) return;
        
        currentPage = parseInt(button.dataset.page, 10);
        renderUI();
    });

    // NEW: Add listener for page input field
    document.getElementById('pagination-controls').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.id === 'page-input') {
            const inputElement = event.target;
            const totalPages = Math.ceil(allJobs.length / rowsPerPage);
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

    const openBtn = document.getElementById(OPEN_MODAL_BTN_ID);
    const closeBtn = document.getElementById(CLOSE_MODAL_BTN_ID);
    const modal = document.getElementById(MODAL_ID);
    const form = document.getElementById(IMPORT_FORM_ID);
    const dropdown = document.getElementById(DROPDOWN_ID); // ADDED
    const submitButton = document.getElementById(SUBMIT_MODAL_BTN_ID); // ADDED

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // ADDED: Event listener for the dropdown to enable/disable the submit button
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
            // const selectedAssistProjectID = dropdown.value;

            // Get the full selected option element to access its data attributes
            const selectedOption = dropdown.options[dropdown.selectedIndex];
            
            // Check if a valid option is selected
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
                // const params = { "LoomeAssistProjectID": parseInt(selectedAssistProjectID, 10) };

                const params = { 
                "LoomeAssistProjectID": parseInt(selectedAssistProjectID, 10),
                "LoomeAssistName": selectedName,
                "LoomeAssistTenantsID": selectedTenantsID
                };

                console.log('Submitting import request with params:', params);
                await window.loomeApi.runApiRequest(SUBMIT_IMPORT_API_ID, params);
                showToast('Import request submitted successfully!', "success");
                closeModal();
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
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Start the application once the document is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializePage();
});