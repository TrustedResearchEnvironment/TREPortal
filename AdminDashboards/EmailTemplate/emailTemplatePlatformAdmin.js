// Define the single container ID for the table
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_REQUEST_ID = 'GetEmailTemplates';
const API_UPDATE_EMAIL_TEMPLATE = 'UpdateEmailTemplate';

// --- STATE MANAGEMENT ---
// These variables need to be accessible by multiple functions.
let currentPage = 1;
let rowsPerPage = 5; // Default, will be updated by API response
let tableConfig = {}; // Will hold your headers configuration
const searchInput = document.getElementById('searchRequests');

/**
 * Renders pagination controls.
 * (This function NO LONGER adds event listeners).
 */
// function renderPagination(containerId, totalItems, itemsPerPage, currentPage) {
//     const container = document.getElementById(containerId);
//     if (!container) return;

//     const totalPages = Math.ceil(totalItems / itemsPerPage);
//     container.innerHTML = ''; // Clear old controls

//     if (totalPages <= 1) {
//         return; // No need for pagination.
//     }

//     // --- Previous Button ---
//     const prevDisabled = currentPage === 1;
//     let paginationHTML = `
//         <button data-page="${currentPage - 1}" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 ${prevDisabled ? 'opacity-50 cursor-not-allowed' : ''}" ${prevDisabled ? 'disabled' : ''}>
//             Previous
//         </button>
//     `;

//     // --- Page Number Buttons ---
//     paginationHTML += '<div class="flex items-center gap-2">';
//     for (let i = 1; i <= totalPages; i++) {
//         const isActive = i === currentPage;
//         paginationHTML += `
//             <button data-page="${i}" class="px-4 py-2 text-sm font-medium ${isActive ? 'text-white bg-blue-600' : 'text-gray-700 bg-white'} border border-gray-300 rounded-lg hover:bg-gray-100">
//                 ${i}
//             </button>
//         `;
//     }
//     paginationHTML += '</div>';

//     // --- Next Button ---
//     const nextDisabled = currentPage === totalPages;
//     paginationHTML += `
//         <button data-page="${currentPage + 1}" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 ${nextDisabled ? 'opacity-50 cursor-not-allowed' : ''}" ${nextDisabled ? 'disabled' : ''}>
//             Next
//         </button>
//     `;

//     container.innerHTML = paginationHTML;
// }

/**
 * Displays a temporary "toast" notification on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of toast ('success', 'error', 'info').
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container') || (function(){
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.style.cssText = 'position: fixed; top: 12px; right: 12px; z-index: 9999; display: flex; flex-direction: column; gap:10px;';
        document.body.appendChild(c);
        return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.style.cssText = 'margin-bottom:0;padding:12px 16px;border-radius:6px;color:#fff;display:flex;align-items:center;min-width:250px;max-width:420px;opacity:0;transform:translateY(-6px);transition:opacity .2s ease,transform .2s ease;';

    let bg = '#2196F3';
    if (type === 'success') bg = '#1AABA3';
    if (type === 'error') bg = '#f44336';
    if (type === 'warning') bg = '#ff9800';
    toast.style.backgroundColor = bg;

    const text = document.createElement('div');
    text.style.flex = '1';
    text.textContent = message;
    toast.appendChild(text);

    if (type === 'error') {
        const btn = document.createElement('button');
        btn.innerHTML = '&times;';
        btn.style.cssText = 'background:transparent;border:none;color:#fff;font-size:18px;margin-left:12px;cursor:pointer;';
        btn.onclick = () => { if (toast.parentNode) toast.remove(); };
        toast.appendChild(btn);
    }

    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });

    if (type !== 'error') {
        const t = (typeof duration === 'number') ? duration : 5000;
        setTimeout(() => { if (toast.parentNode) { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 200); } }, t);
    }

    return toast;
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
        // You might need to pass params differently, e.g., runApiRequest(10, apiParams)
        const response = await window.loomeApi.runApiRequest(API_REQUEST_ID, apiParams);

        
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
 * Updates the UI and renders the correct table, optionally filtering the data.
 */
// function updateTable(config, data, tableContainerId, currentPage, rowsPerPage, searchTerm = '') {

//     const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();
//     const filteredData = lowerCaseSearchTerm
//         ? data.filter(item => 
//             Object.values(item).some(value =>
//                 String(value).toLowerCase().includes(lowerCaseSearchTerm)
//             )
//         )
//         : data;

//     // --- 3. PAGINATION LOGIC (NEW!) ---
//     // Calculate the slice of data for the current page
//     const startIndex = (currentPage - 1) * rowsPerPage;
//     const endIndex = startIndex + rowsPerPage;
//     const paginatedData = filteredData.slice(startIndex, endIndex);

//     // --- 4. RENDER TABLE AND PAGINATION ---
//     // Render the table with ONLY the data for the current page
//     renderTable(tableContainerId, config.headers, paginatedData);
    
//     //renderPagination('pagination-controls', filteredData.length, rowsPerPage, currentPage);
// }

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
        
        // const emailTemplates = [
        //   {
        //     "EmailTemplateID": 1,
        //     "EmailTemplateType": "RequestApproval",
        //     "EmailTemplateSubject": "TRE – Data Access Request pending approval",
        //     "EmailTemplateText": "<p>Hi,</p><p>You are listed as one of the approvers for a data set that is available on the <a href='https://test-app.loomesoftware.com/icl---uat-tenant'>TRE Platform</a>.</p><p>A request is pending on your approval.</p><p>The request includes this information:</p>",
        //     "ModifiedDate": "2022-07-04 02:38:30.697"
        //   },
        //   {
        //     "EmailTemplateID": 2,
        //     "EmailTemplateType": "RequestApproved",
        //     "EmailTemplateSubject": "TRE – Your Data Access Request has been approved",
        //     "EmailTemplateText": "<p>Hi,</p><p>Your data access request has been successfully approved!</p>",
        //     "ModifiedDate": "2022-07-04 02:38:30.700"
        //   },
        //   {
        //     "EmailTemplateID": 3,
        //     "EmailTemplateType": "RequestRejected",
        //     "EmailTemplateSubject": "TRE – Your Data Access Request has not been approved",
        //     "EmailTemplateText": "<p>Hi,</p><p>Your data access request was not approved. Please review the following information and reach out to the Data Custodian of the data set or to the TRE Data Manager with any questions.</p>",
        //     "ModifiedDate": "2022-07-04 02:38:30.703"
        //   },
        //   {
        //     "EmailTemplateID": 4,
        //     "EmailTemplateType": "RequestEscalated",
        //     "EmailTemplateSubject": "TRE - Escalated Data Access Request pending approval",
        //     "EmailTemplateText": "<p>Hi,</p><p>The following data access request is escalated as it has been pending for over 48 hours.</p><p>The pending request includes this information:</p>",
        //     "ModifiedDate": "2022-07-29 05:53:11.687"
        //   }
        // ];
        
        // // const response = await window.loomeApi.runApiRequest(10);
        // // const parsedResponse = safeParseJson(response);
        // // const dataSet = parsedResponse.Results;
        // let currentPage = 1; //parsedResponse.CurrentPage;
        // const rowsPerPage = 5;//parsedResponse.PageSize; 
        // // console.log(dataSet)
        
        
        
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
        // searchInput.addEventListener('input', () => {
        //     console.log('Typing event detected!');
        //     currentPage = 1;
        //     const searchTerm = searchInput.value;

        //     updateTable(tableConfig, data, TABLE_CONTAINER_ID, currentPage, rowsPerPage, searchTerm);
        // });
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

renderPlatformAdminEmailTemplatesPage()
