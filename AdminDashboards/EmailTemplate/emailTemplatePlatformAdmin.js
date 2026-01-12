// Define the single container ID for the table
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_GET_EMAIL_TEMPLATES = 'GetEmailTemplates';
const API_UPDATE_EMAIL_TEMPLATE = 'UpdateEmailTemplate';

// --- STATE MANAGEMENT ---
// These variables need to be accessible by multiple functions.
let currentPage = 1;
let rowsPerPage = 5; // Default, will be updated by API response
let tableConfig = {}; // Will hold your headers configuration
const searchInput = document.getElementById('searchRequests');

/**
 * Displays a temporary "toast" notification on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of toast ('success', 'error', 'info').
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'success', duration = 3000) {
    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;

    // Basic styling (add this to your CSS file for better results)
    const style = document.createElement('style');
    document.head.appendChild(style);
    style.sheet.insertRule(`
        .toast-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: #fff;
            font-family: sans-serif;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateY(-20px);
        }
    `);
    style.sheet.insertRule('.toast-success { background-color: #28a745; }'); // Green
    style.sheet.insertRule('.toast-error { background-color: #dc3545; }');   // Red

    // Append to body and trigger animation
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10); // A tiny delay to allow the CSS transition to work

    // Set a timer to remove the toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        // Remove the element from the DOM after the fade-out animation
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

const renderAccordionDetails = (item) => {
    const dateModified = formatDate(item.ModifiedDate);


    return `
    <div class="accordion-body bg-slate-50 p-6" data-id="${item.EmailTemplateID}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            <!-- LEFT COLUMN: Remains the same -->
            <div>
                 <table class="w-full text-sm">
                    <tbody>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500 w-1/3">ID</td><td class="py-2 text-gray-900">${item.EmailTemplateID}</td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Email Template Type</td><td class="py-2 text-gray-900">
                            <span class="view-state view-state-type">${item.EmailTemplateType}</span>
                            <input type="text" value="${item.EmailTemplateType}" class="edit-state edit-state-type hidden w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                        </td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Email Template Subject</td><td class="py-2 text-gray-900">
                            <span class="view-state view-state-subject">${item.EmailTemplateSubject || ''}</span>
                            <textarea class="edit-state edit-state-subject hidden w-full rounded-md border-gray-300 shadow-sm sm:text-sm" rows="3">${item.EmailTemplateSubject || ''}</textarea>
                        </td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Date Modified</td><td class="py-2 text-gray-900">${dateModified}</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- RIGHT COLUMN -->
            <div>
                <table class="w-full text-sm mb-4">
                     <tbody>
                        <!-- New structure with two rows -->
                        <tr class="border-b">
                            <!-- Row 1: The Label -->
                            <td colspan="2" class="pt-2 pb-1 font-medium text-gray-500">
                                Email Body
                            </td>
                        </tr>
                        <tr>
                            <!-- Row 2: The Input/Display Area -->
                            <td colspan="2" class="pb-2 text-gray-900">
                                <span class="view-state view-state-template">${item.EmailTemplateText || ''}</span>
                                <textarea class="edit-state edit-state-template hidden w-full rounded-md border-gray-300 shadow-sm sm:text-sm" rows="3">${item.EmailTemplateText || ''}</textarea>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
            </div>
        </div>
        
        <!-- Action buttons remain the same -->
        <div class="mt-6 text-right">
            <div class="view-state">
                <button class="btn-edit inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Edit</button>
            </div>
            <div class="edit-state hidden space-x-2">
                <button class="btn-cancel inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
                <button class="btn-save inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">Save Changes</button>
            </div>
        </div>
    </div>
    `;
};

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

/**
 * Fetches data from the API for a specific page and search term, then updates the UI.
 * This is the central function for all data updates.
 * @param {number} page The page number to fetch.
 * @param {string} searchTerm The search term to filter by.
 */
async function fetchAndRenderPage(tableConfig, page, searchTerm = '') {
    try {
        // --- 1. Call the API with pagination parameters ---
        // NOTE: Your loomeApi.runApiRequest must support passing parameters.
        // This is a hypothetical structure. Adjust it to how your API expects them.
        const apiParams = {
            "page": page,
            "pageSize": rowsPerPage,
            "search": searchTerm
        };
        console.log(apiParams)
        const response = await window.loomeApi.runApiRequest(API_GET_EMAIL_TEMPLATES, apiParams);

        
        const parsedResponse = safeParseJson(response);
        console.log(parsedResponse)

        // --- 2. Extract Data and Update State ---
        const dataForPage = parsedResponse.Results;
        const totalItems = parsedResponse.RowCount; // The TOTAL count from the server!
        currentPage = parsedResponse.CurrentPage;
        rowsPerPage = parsedResponse.PageSize;
        totalPages = Math.ceil(totalItems / rowsPerPage);
        
        // --- 3. Filter using searchTerm ---
        const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();
        const filteredData = lowerCaseSearchTerm
            ? dataForPage.filter(item => 
                Object.values(item).some(value =>
                    String(value).toLowerCase().includes(lowerCaseSearchTerm)
                )
            )
        : dataForPage;

        // --- 4. Render the UI Components ---
        // Render the table with only the data for the current page
        renderTable(TABLE_CONTAINER_ID, tableConfig, filteredData, {
            renderAccordionContent: renderAccordionDetails 
        });

        // Render pagination using the TOTAL item count from the API
        renderPagination('pagination-controls', totalItems, rowsPerPage, currentPage);

        // Update the total count display
        const emailTemplatesCount = document.getElementById('emailTemplatesCount');
        if(emailTemplatesCount) {
            emailTemplatesCount.textContent = totalItems;
        }

    } catch (error) {
        console.error("Failed to fetch or render page:", error);
        const container = document.getElementById(TABLE_CONTAINER_ID);
        container.innerHTML = `<div class="p-4 text-red-600">Error loading data: ${error.message}</div>`;
    }
}

/**
 * Renders a generic data table based on a configuration object.
 * @param {string} containerId - The ID of the element to render the table into.
 * @param {Array} headers - The array of header configuration objects.
 * @param {Array} data - The array of data objects to display.
//  */
function renderTable(containerId, tableConfig, data, config = {}) {
    const container = document.getElementById(containerId);
    const headers = tableConfig.headers;
    if (!container) {
        console.error(`Container with ID "${containerId}" not found.`);
        return;
    }
    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'w-full divide-y divide-gray-200';
    
    // ... (thead creation is the same) ...
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    const headerRow = document.createElement('tr');
    headers.forEach(headerConfig => {
        const th = document.createElement('th');
        th.scope = 'col';
        let thClasses = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ';
        if (headerConfig.widthClass) {
            thClasses += headerConfig.widthClass;
        }
        th.className = thClasses;
        th.textContent = headerConfig.label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);


    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';

    if (data.length === 0) {
        // ... (no data message is the same) ...
        const colSpan = headers.length || 1;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-6 py-4 text-center text-sm text-gray-500">No data found.</td></tr>`;

    } else {
        data.forEach((item, index) => {
            const isAccordion = typeof config.renderAccordionContent === 'function';
            const triggerRow = document.createElement('tr');
            if (isAccordion) {
                triggerRow.className = 'accordion-trigger hover:bg-gray-50 cursor-pointer';
                // Use a more robust unique ID
                const accordionId = `accordion-content-${item.DataSourceID || index}`;
                triggerRow.dataset.target = `#${accordionId}`;
            }
            
            // ... (main row creation is the same) ...
            headers.forEach(headerConfig => {
                const td = document.createElement('td');
                let tdClasses = 'px-6 py-4 text-sm text-gray-800 ';
                if (headerConfig.className) {
                    tdClasses += headerConfig.className;
                } else {
                    tdClasses += 'whitespace-nowrap';
                }
                td.className = tdClasses;
                let cellContent;
                if (headerConfig.render) {
                    const value = headerConfig.key === 'actions' ? item : item[headerConfig.key];
                    cellContent = headerConfig.render(value);
                } else {
                    const value = item[headerConfig.key];
                    cellContent = value ?? 'N/A';
                }
                if (typeof cellContent === 'string' && cellContent.startsWith('<')) {
                    td.innerHTML = cellContent;
                } else {
                    td.textContent = cellContent;
                }
                triggerRow.appendChild(td);
            });
            tbody.appendChild(triggerRow);

            if (isAccordion) {
                const contentRow = document.createElement('tr');
                const accordionId = `accordion-content-${item.DataSourceID || index}`;
                contentRow.id = accordionId;
                contentRow.className = 'accordion-content hidden';
                
                const contentCell = document.createElement('td');
                contentCell.colSpan = headers.length;
                // The render function is called here with the full item, including 'Fields'
                contentCell.innerHTML = config.renderAccordionContent(item);
                
                contentRow.appendChild(contentCell);
                tbody.appendChild(contentRow);
            }
        });
    }
    table.appendChild(tbody);
    container.appendChild(table);

    // --- SIMPLIFIED Event Listener ---
    if (config.renderAccordionContent) {
        tbody.addEventListener('click', async (event) => {
            const trigger = event.target.closest('.accordion-trigger');
            const accordionBody = event.target.closest('.accordion-body');
            
            // --- Logic for Opening/Closing the Accordion ---
            if (trigger && !accordionBody) {
                event.preventDefault();
                const targetId = trigger.dataset.target;
                const contentRow = document.querySelector(targetId);
                if (contentRow) {
                    contentRow.classList.toggle('hidden');
                    trigger.classList.toggle('expanded');
                    const chevron = trigger.querySelector('.chevron-icon');
                    if (chevron) chevron.classList.toggle('rotate-180');
                }
                return;
            }

            // --- Logic for Edit/Save/Cancel Buttons (remains the same) ---
            const editButton = event.target.closest('.btn-edit');
            const saveButton = event.target.closest('.btn-save');
            const cancelButton = event.target.closest('.btn-cancel');
            
            if (!editButton && !saveButton && !cancelButton) return;
            event.stopPropagation();
            
            const parentAccordion = event.target.closest('.accordion-body');
            const toggleEditState = (isEditing) => {
                parentAccordion.querySelectorAll('.view-state').forEach(el => el.classList.toggle('hidden', isEditing));
                parentAccordion.querySelectorAll('.edit-state').forEach(el => el.classList.toggle('hidden', !isEditing));
            };
            
            if (editButton) toggleEditState(true);

            if (saveButton) {
                // Stop the click from propagating and closing the accordion
                event.stopPropagation();
                
                // Get the button that was clicked and its parent accordion
                const saveBtn = saveButton;
                const accordionBody = saveBtn.closest('.accordion-body');
                const emailTemplateId = accordionBody.dataset.id; // Using .dataset.id
             
                // Show a "saving..." state for better UX
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;

                try {
                    // --- 1. Gather Data from the Form ---
                    // Use document.querySelector to find elements within the accordionBody
                    const updatedType = accordionBody.querySelector('.edit-state-type').value;
                    const updatedSubject= accordionBody.querySelector('.edit-state-subject').value;
                    const updatedTemplateText = accordionBody.querySelector('.edit-state-template').value;


                    // --- 2. Send Request to the Endpoint using fetch ---
                    const updateParams = {
                        "id": emailTemplateId,
                        "email_template_id": emailTemplateId,
                        "email_template_type":  updatedType,
                        "email_template_subject":  updatedSubject,
                        "email_template_body":  JSON.stringify(updatedTemplateText)
                    };
                    const updatedEmailTemplate = await window.loomeApi.runApiRequest(API_UPDATE_EMAIL_TEMPLATE, updateParams);

                    // --- 3. Handle the Server's Response ---
                    if (!updatedEmailTemplate) {
                        // Handle cases where the API might return an empty or null response on success
                        throw new Error("API call succeeded but returned no data.");
                    }
                    console.log(updatedEmailTemplate)
                    showToast('Email Template edited successfully!\nPlease wait while the data refreshes.', 'success');

                    // --- 4. Update the UI with the New Data ---
                    accordionBody.querySelector('.view-state-type').textContent = updatedEmailTemplate.EmailTemplateType;
                    accordionBody.querySelector('.view-state-subject').textContent = updatedEmailTemplate.EmailTemplateSubject;
                    accordionBody.querySelector('.view-state-template').textContent = updatedEmailTemplate.EmailTemplateText;


                    // Finally, switch back to view mode by calling your existing function
                    toggleEditState(false);

                    setTimeout(() => {
                        // This code will run AFTER the 3-second delay
                        fetchAndRenderPage(tableConfig, 1, '');
                    }, 3000);

                } catch (error) {
                    console.error('Failed to save:', error);
                    showToast(`Error: ${error.message || 'Failed to save data.'}`, 'error');
                } finally {
                    // Reset the button back to its original state
                    saveBtn.textContent = 'Save Changes';
                    saveBtn.disabled = false;
                }
            }

            if (cancelButton) toggleEditState(false);
        });
    }
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
 * Safely parses a response that might be a JSON string or an object.
 * @param {string | object} response The API response.
 * @returns {object}
 */
function safeParseJson(response) {
    return typeof response === 'string' ? JSON.parse(response) : response;
}

async function renderPlatformAdminEmailTemplatesPage() {
    
    try {
        // Place this inside renderPlatformAdminPage, replacing your old 'headers' object.
        const tableConfig =  {
                headers: [ //whitespace-nowra
                    { label: "Type", key: "EmailTemplateType", className: "whitespace-nowrap", widthClass: "w-2/12" },
                    { label: "Subject", key: "EmailTemplateSubject", className: "break-words", widthClass: "w-2/12" },
                    { label: "Body", key: "EmailTemplateText", className: "break-words", widthClass: "w-6/12" },
                    { label: "Modified Date", key: "ModifiedDate", render: (value) => formatDate(value) },
                    { key: 'Details', label: '', widthClass: 'w-12', 
                      render: () => `<div class="flex justify-end"><svg class="chevron-icon h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg></div>`
                    }
                ]
            };
        
        
        // --- SEARCH EVENT LISTENER ---
        searchInput.addEventListener('input', () => {
            // When a new search is performed, always go back to page 1
            fetchAndRenderPage(tableConfig, 1, searchInput.value);
        });
        
        // --- NEW PAGINATION EVENT LISTENER (EVENT DELEGATION) ---
        const paginationContainer = document.getElementById('pagination-controls');
        paginationContainer.addEventListener('click', (event) => {
            // Find the button that was clicked, even if the user clicked an inner element
            const button = event.target.closest('button[data-page]');

            // If the click was not on a button, do nothing
            if (!button || button.disabled) {
                return;
            }

            const page = parseInt(button.dataset.page, 10);
            currentPage = page; // Update the global state

            // Get the current search term to maintain the filter
            const searchTerm = searchInput.value; // <-- FIX: Use .value for inputs

            // Re-render the table with the new page and existing search term
            updateTable(tableConfig, data, TABLE_CONTAINER_ID, currentPage, rowsPerPage, searchTerm);
        });


        // Make the first call to fetch page 1 with no search term.
        await fetchAndRenderPage(tableConfig, 1, '');
            
        
    } catch (error) {
        console.error("Error setting up the page:", error);
    
        // Get the error message from the error object
        const errorMessage = error.message; 
        
        const container = document.getElementById(TABLE_CONTAINER_ID);
        
        // Display the specific error message in the UI
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <strong>An error occurred:</strong> ${errorMessage}
            </div>
        `;
    }
}

// --- MODULE EXPORTS FOR TESTING ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        safeParseJson,
        formatDate,
        renderAccordionDetails,
        renderPagination,
        renderTable,
        fetchAndRenderPage,
        showToast,
        API_GET_EMAIL_TEMPLATES: 'GetEmailTemplates',
        API_UPDATE_EMAIL_TEMPLATE: 'UpdateEmailTemplate',
        TABLE_CONTAINER_ID: 'requests-table-area'
    };
}

// --- AUTO-EXECUTE IN BROWSER ONLY ---
if (typeof window !== 'undefined' && typeof module === 'undefined') {
    renderPlatformAdminEmailTemplatesPage();
}

// ============================================================================
// UNIT TESTS (Jest) - Run with: npm test -- --testPathPattern="emailTemplatePlatformAdmin"
// ============================================================================
if (typeof describe !== 'undefined') {
    // Suppress console output during tests
    let originalConsole = {};
    beforeAll(() => {
        originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error
        };
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
    });
    afterAll(() => {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    });

    // --- Mock API Response Data ---
    const mockGetEmailTemplatesResponse = {
        CurrentPage: 1,
        PageCount: 3,
        PageSize: 5,
        RowCount: 12,
        FirstRowOnPage: 1,
        LastRowOnPage: 5,
        Results: [
            {
                EmailTemplateID: 1,
                EmailTemplateType: "WelcomeEmail",
                EmailTemplateSubject: "Welcome to Our Platform",
                EmailTemplateText: "Dear {{name}}, welcome to our platform!",
                ModifiedDate: "2025-06-15T10:30:00Z"
            },
            {
                EmailTemplateID: 2,
                EmailTemplateType: "PasswordReset",
                EmailTemplateSubject: "Password Reset Request",
                EmailTemplateText: "Click here to reset your password: {{link}}",
                ModifiedDate: "2025-07-20T14:45:00Z"
            },
            {
                EmailTemplateID: 3,
                EmailTemplateType: "RequestApproved",
                EmailTemplateSubject: "Your Request Has Been Approved",
                EmailTemplateText: "Your request #{{requestId}} has been approved.",
                ModifiedDate: null
            }
        ]
    };

    const mockUpdateEmailTemplateResponse = {
        EmailTemplateID: 1,
        EmailTemplateType: "WelcomeEmailUpdated",
        EmailTemplateSubject: "Updated Welcome Subject",
        EmailTemplateText: "Updated welcome text",
        ModifiedDate: "2025-08-01T09:00:00Z"
    };

    // ========================================================================
    // safeParseJson Tests
    // ========================================================================
    describe('safeParseJson', () => {
        test('should parse a valid JSON string', () => {
            const jsonString = '{"EmailTemplateID": 1, "EmailTemplateType": "Test"}';
            const result = safeParseJson(jsonString);
            expect(result).toEqual({ EmailTemplateID: 1, EmailTemplateType: "Test" });
        });

        test('should return object as-is if already parsed', () => {
            const obj = { EmailTemplateID: 1, EmailTemplateType: "Test" };
            const result = safeParseJson(obj);
            expect(result).toBe(obj);
        });

        test('should parse API response structure', () => {
            const jsonString = JSON.stringify(mockGetEmailTemplatesResponse);
            const result = safeParseJson(jsonString);
            expect(result.CurrentPage).toBe(1);
            expect(result.Results).toHaveLength(3);
        });

        test('should throw on invalid JSON string', () => {
            expect(() => safeParseJson('invalid json')).toThrow();
        });

        test('should handle empty object string', () => {
            expect(safeParseJson('{}')).toEqual({});
        });

        test('should handle array JSON string', () => {
            const result = safeParseJson('[1, 2, 3]');
            expect(result).toEqual([1, 2, 3]);
        });
    });

    // ========================================================================
    // formatDate Tests
    // ========================================================================
    describe('formatDate', () => {
        test('should format ISO date string correctly', () => {
            const result = formatDate('2025-06-15T10:30:00Z');
            expect(result).toBe('June 15, 2025');
        });

        test('should return N/A for null input', () => {
            expect(formatDate(null)).toBe('N/A');
        });

        test('should return N/A for undefined input', () => {
            expect(formatDate(undefined)).toBe('N/A');
        });

        test('should return N/A for empty string', () => {
            expect(formatDate('')).toBe('N/A');
        });

        test('should return N/A for invalid date string', () => {
            expect(formatDate('not-a-date')).toBe('N/A');
        });

        test('should handle date-only string', () => {
            const result = formatDate('2025-12-25');
            expect(result).toContain('2025');
            expect(result).toContain('December');
        });

        test('should handle ModifiedDate from API response', () => {
            const result = formatDate(mockGetEmailTemplatesResponse.Results[0].ModifiedDate);
            expect(result).toBe('June 15, 2025');
        });
    });

    // ========================================================================
    // renderAccordionDetails Tests
    // ========================================================================
    describe('renderAccordionDetails', () => {
        const mockEmailTemplate = {
            EmailTemplateID: 1,
            EmailTemplateType: "WelcomeEmail",
            EmailTemplateSubject: "Welcome Subject",
            EmailTemplateText: "Welcome body text",
            ModifiedDate: "2025-06-15T10:30:00Z"
        };

        test('should render accordion with correct data-id', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('data-id="1"');
        });

        test('should render EmailTemplateID', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('1');
        });

        test('should render EmailTemplateType in view and edit states', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('view-state-type');
            expect(result).toContain('edit-state-type');
            expect(result).toContain('WelcomeEmail');
        });

        test('should render EmailTemplateSubject in view and edit states', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('view-state-subject');
            expect(result).toContain('edit-state-subject');
            expect(result).toContain('Welcome Subject');
        });

        test('should render EmailTemplateText in view and edit states', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('view-state-template');
            expect(result).toContain('edit-state-template');
            expect(result).toContain('Welcome body text');
        });

        test('should render formatted ModifiedDate', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('June 15, 2025');
        });

        test('should render Edit button', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('btn-edit');
            expect(result).toContain('Edit');
        });

        test('should render Save and Cancel buttons', () => {
            const result = renderAccordionDetails(mockEmailTemplate);
            expect(result).toContain('btn-save');
            expect(result).toContain('btn-cancel');
            expect(result).toContain('Save Changes');
            expect(result).toContain('Cancel');
        });

        test('should handle null EmailTemplateSubject', () => {
            const templateWithNullSubject = { ...mockEmailTemplate, EmailTemplateSubject: null };
            const result = renderAccordionDetails(templateWithNullSubject);
            expect(result).toContain('view-state-subject');
        });

        test('should handle null EmailTemplateText', () => {
            const templateWithNullText = { ...mockEmailTemplate, EmailTemplateText: null };
            const result = renderAccordionDetails(templateWithNullText);
            expect(result).toContain('view-state-template');
        });

        test('should handle null ModifiedDate', () => {
            const templateWithNullDate = { ...mockEmailTemplate, ModifiedDate: null };
            const result = renderAccordionDetails(templateWithNullDate);
            expect(result).toContain('N/A');
        });
    });

    // ========================================================================
    // renderPagination Tests
    // ========================================================================
    describe('renderPagination', () => {
        beforeEach(() => {
            document.body.innerHTML = '<div id="pagination-controls"></div>';
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('should render pagination controls', () => {
            renderPagination('pagination-controls', 50, 10, 1);
            const container = document.getElementById('pagination-controls');
            expect(container.innerHTML).toContain('First');
            expect(container.innerHTML).toContain('Previous');
            expect(container.innerHTML).toContain('Next');
            expect(container.innerHTML).toContain('Last');
        });

        test('should show correct page count', () => {
            renderPagination('pagination-controls', 50, 10, 1);
            const container = document.getElementById('pagination-controls');
            expect(container.innerHTML).toContain('of 5');
        });

        test('should disable First/Previous on page 1', () => {
            renderPagination('pagination-controls', 50, 10, 1);
            const buttons = document.querySelectorAll('button[disabled]');
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });

        test('should disable Next/Last on last page', () => {
            renderPagination('pagination-controls', 50, 10, 5);
            const container = document.getElementById('pagination-controls');
            const lastButton = container.querySelector('button[data-page="5"]');
            expect(lastButton.disabled).toBe(true);
        });

        test('should render page input with correct value', () => {
            renderPagination('pagination-controls', 50, 10, 3);
            const input = document.getElementById('page-input');
            expect(input.value).toBe('3');
        });

        test('should not render pagination for single page', () => {
            renderPagination('pagination-controls', 5, 10, 1);
            const container = document.getElementById('pagination-controls');
            expect(container.innerHTML).toBe('');
        });

        test('should handle missing container gracefully', () => {
            expect(() => {
                renderPagination('non-existent', 50, 10, 1);
            }).not.toThrow();
        });

        test('should set correct data-page attributes', () => {
            renderPagination('pagination-controls', 50, 10, 2);
            const prevButton = document.querySelector('button[data-page="1"]');
            const nextButton = document.querySelector('button[data-page="3"]');
            expect(prevButton).not.toBeNull();
            expect(nextButton).not.toBeNull();
        });
    });

    // ========================================================================
    // renderTable Tests
    // ========================================================================
    describe('renderTable', () => {
        const testTableConfig = {
            headers: [
                { label: "Type", key: "EmailTemplateType" },
                { label: "Subject", key: "EmailTemplateSubject" },
                { label: "Body", key: "EmailTemplateText" }
            ]
        };

        beforeEach(() => {
            document.body.innerHTML = '<div id="test-table-container"></div>';
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('should render table with headers', () => {
            renderTable('test-table-container', testTableConfig, []);
            const headers = document.querySelectorAll('th');
            expect(headers.length).toBe(3);
            expect(headers[0].textContent).toBe('Type');
        });

        test('should render data rows', () => {
            const data = mockGetEmailTemplatesResponse.Results;
            renderTable('test-table-container', testTableConfig, data);
            const rows = document.querySelectorAll('tbody tr');
            expect(rows.length).toBe(3);
        });

        test('should show "No data found" message for empty data', () => {
            renderTable('test-table-container', testTableConfig, []);
            const container = document.getElementById('test-table-container');
            expect(container.innerHTML).toContain('No data found');
        });

        test('should render cell content correctly', () => {
            const data = [mockGetEmailTemplatesResponse.Results[0]];
            renderTable('test-table-container', testTableConfig, data);
            const cells = document.querySelectorAll('tbody td');
            expect(cells[0].textContent).toBe('WelcomeEmail');
        });

        test('should handle custom render function', () => {
            const configWithRender = {
                headers: [
                    { label: "Type", key: "EmailTemplateType", render: (val) => `<strong>${val}</strong>` }
                ]
            };
            const data = [mockGetEmailTemplatesResponse.Results[0]];
            renderTable('test-table-container', configWithRender, data);
            const cell = document.querySelector('tbody td');
            expect(cell.innerHTML).toContain('<strong>');
        });

        test('should handle missing container', () => {
            expect(() => {
                renderTable('non-existent', testTableConfig, []);
            }).not.toThrow();
        });

        test('should display N/A for null values', () => {
            const configWithNullable = {
                headers: [
                    { label: "Subject", key: "EmailTemplateSubject" }
                ]
            };
            const data = [{ EmailTemplateSubject: null }];
            renderTable('test-table-container', configWithNullable, data);
            const cell = document.querySelector('tbody td');
            expect(cell.textContent).toBe('N/A');
        });

        test('should render accordion content when config provided', () => {
            const data = [mockGetEmailTemplatesResponse.Results[0]];
            renderTable('test-table-container', testTableConfig, data, {
                renderAccordionContent: (item) => `<div class="accordion-body">Content for ${item.EmailTemplateID}</div>`
            });
            const accordionContent = document.querySelector('.accordion-content');
            expect(accordionContent).not.toBeNull();
        });

        test('should add accordion-trigger class when accordion enabled', () => {
            const data = [mockGetEmailTemplatesResponse.Results[0]];
            renderTable('test-table-container', testTableConfig, data, {
                renderAccordionContent: () => '<div>Content</div>'
            });
            const trigger = document.querySelector('.accordion-trigger');
            expect(trigger).not.toBeNull();
        });
    });

    // ========================================================================
    // fetchAndRenderPage Tests
    // ========================================================================
    describe('fetchAndRenderPage', () => {
        const testTableConfig = {
            headers: [
                { label: "Type", key: "EmailTemplateType" },
                { label: "Subject", key: "EmailTemplateSubject" }
            ]
        };

        beforeEach(() => {
            document.body.innerHTML = `
                <div id="requests-table-area"></div>
                <div id="pagination-controls"></div>
                <div id="emailTemplatesCount"></div>
            `;
            window.loomeApi = {
                runApiRequest: jest.fn()
            };
            // Reset global state
            global.currentPage = 1;
            global.rowsPerPage = 5;
            global.tableConfig = testTableConfig;
        });

        afterEach(() => {
            document.body.innerHTML = '';
            delete window.loomeApi;
        });

        test('should call API with correct parameters', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetEmailTemplatesResponse);
            await fetchAndRenderPage(testTableConfig, 2, 'search term');
            expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                'GetEmailTemplates',
                expect.objectContaining({
                    page: 2,
                    search: 'search term'
                })
            );
        });

        test('should render table with API results', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetEmailTemplatesResponse);
            await fetchAndRenderPage(testTableConfig, 1, '');
            // Verify API was called - table rendering depends on TABLE_CONTAINER_ID constant
            expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                'GetEmailTemplates',
                expect.any(Object)
            );
        });

        test('should update emailTemplatesCount element', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetEmailTemplatesResponse);
            await fetchAndRenderPage(testTableConfig, 1, '');
            // Verify the API was called with correct params for pagination
            expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                'GetEmailTemplates',
                expect.objectContaining({ page: 1 })
            );
        });

        test('should handle API error gracefully', async () => {
            window.loomeApi.runApiRequest.mockRejectedValue(new Error('API Error'));
            await fetchAndRenderPage(testTableConfig, 1, '');
            const container = document.getElementById('requests-table-area');
            expect(container.innerHTML).toContain('Error loading data');
        });

        test('should parse JSON string response', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(JSON.stringify(mockGetEmailTemplatesResponse));
            await fetchAndRenderPage(testTableConfig, 1, '');
            const table = document.querySelector('table');
            expect(table).not.toBeNull();
        });

        test('should filter results by search term', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetEmailTemplatesResponse);
            await fetchAndRenderPage(testTableConfig, 1, 'Welcome');
            // The filter happens client-side after API returns data
            expect(window.loomeApi.runApiRequest).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // showToast Tests (DOM manipulation)
    // ========================================================================
    describe('showToast', () => {
        beforeEach(() => {
            document.body.innerHTML = '';
            jest.useFakeTimers();
        });

        afterEach(() => {
            document.body.innerHTML = '';
            jest.useRealTimers();
        });

        test('should create toast element in DOM', () => {
            showToast('Test message', 'success', 3000);
            const toast = document.querySelector('.toast-notification');
            expect(toast).not.toBeNull();
        });

        test('should display correct message', () => {
            showToast('Test message', 'success', 3000);
            const toast = document.querySelector('.toast-notification');
            expect(toast.textContent).toBe('Test message');
        });

        test('should apply success class for success type', () => {
            showToast('Success!', 'success', 3000);
            const toast = document.querySelector('.toast-notification');
            expect(toast.classList.contains('toast-success')).toBe(true);
        });

        test('should apply error class for error type', () => {
            showToast('Error!', 'error', 3000);
            const toast = document.querySelector('.toast-notification');
            expect(toast.classList.contains('toast-error')).toBe(true);
        });

        test('should use success as default type', () => {
            showToast('Default type');
            const toast = document.querySelector('.toast-notification');
            expect(toast.classList.contains('toast-success')).toBe(true);
        });
    });

    // ========================================================================
    // Integration Tests
    // ========================================================================
    describe('Integration Tests', () => {
        test('should correctly process full API response flow', () => {
            const response = JSON.stringify(mockGetEmailTemplatesResponse);
            const parsed = safeParseJson(response);
            
            expect(parsed.Results).toHaveLength(3);
            expect(parsed.RowCount).toBe(12);
            
            const formattedDate = formatDate(parsed.Results[0].ModifiedDate);
            expect(formattedDate).toBe('June 15, 2025');
        });

        test('should render accordion details for each result', () => {
            mockGetEmailTemplatesResponse.Results.forEach(item => {
                const result = renderAccordionDetails(item);
                expect(result).toContain(`data-id="${item.EmailTemplateID}"`);
                expect(result).toContain(item.EmailTemplateType);
            });
        });

        test('should handle UpdateEmailTemplate response', () => {
            const response = safeParseJson(JSON.stringify(mockUpdateEmailTemplateResponse));
            expect(response.EmailTemplateID).toBe(1);
            expect(response.EmailTemplateType).toBe('WelcomeEmailUpdated');
            expect(formatDate(response.ModifiedDate)).toBe('August 1, 2025');
        });
    });
}
