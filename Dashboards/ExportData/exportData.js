// =================================================================
//                      STATE & CONFIGURATION
// =================================================================

const TABLE_CONTAINER_ID = 'export-jobs-table-area';
const API_REQUEST_ID = 'GetDataExport';
const EXPORT_REQUEST_API_ID = 'GetAssistProjectsFilteredByUpn'; 
const SUBMIT_EXPORT_API_ID = 'RequestDataExportByAssistProjectID';

// Modal Element IDs
const MODAL_ID = 'export-modal';
const OPEN_MODAL_BTN_ID = 'request-export-btn';
const CLOSE_MODAL_BTN_ID = 'modal-close-btn';
const EXPORT_FORM_ID = 'export-form';
const DROPDOWN_ID = 'export-type';
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
        const response = await window.loomeApi.runApiRequest(EXPORT_REQUEST_API_ID, {});
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
        container.innerHTML = '<p class="text-center text-gray-500">No export requests found.</p>';
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
            allJobs = allData.Results;
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
                alert(`Please enter a page number between 1 and ${totalPages}.`);
                inputElement.value = currentPage;
            }
        }
    });

    const openBtn = document.getElementById(OPEN_MODAL_BTN_ID);
    const closeBtn = document.getElementById(CLOSE_MODAL_BTN_ID);
    const modal = document.getElementById(MODAL_ID);
    const form = document.getElementById(EXPORT_FORM_ID);
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
                alert('Please select an Assist Project.');
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

                console.log('Submitting export request with params:', params);
                await window.loomeApi.runApiRequest(SUBMIT_EXPORT_API_ID, params);
                alert('Export request submitted successfully!');
                closeModal();
                await initializePage(); 
            } catch (error) {
                console.error('Failed to submit export request:', error);
                alert('An error occurred while submitting the request. Please try again.');
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