// Define the single container ID for the table
const TABLE_CONTAINER_ID = 'requests-table-area';
const API_DATASOURCE_ID = 'GetDataSource';
const API_UPDATE_DATASOURCE_ID = 'UpdateDataSource';
const API_DBCONNECTION_ID = 'GetDatabaseConnection';

const API_DATASOURCETYPE_ID = 'GetDataSourceTypes';
const API__DATASOURCE_FIELDVALUE_ID = 'GetDataSourceFieldValues';
const API__DATASOURCE_FOLDER_ID = 'GetFolderConnection';
const API_ADD_DATASOURCE_ID = 'AddDataSource';

// --- STATE MANAGEMENT ---
// These variables need to be accessible by multiple functions.
let currentPage = 1;
let rowsPerPage = 5; // Default, will be updated by API response
let totalPages = 1;
let tableConfig = {}; // Will hold your headers configuration
let displayValue = '';
const searchInput = document.getElementById('searchRequests');

let dataSourceTypeMap = new Map();
let dbConnectionMap = new Map();
let folderConnectionMap = new Map();

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

/**
 * Fetches all DB connections and creates a lookup map.
 * @returns {Promise<Map<number, string>>} A promise that resolves to a Map where the
 * key is the ConnectionId and the value is the ConnectionName.
 */
async function createDbConnectionMap() {
    try {
        const response = await window.loomeApi.runApiRequest(API_DBCONNECTION_ID, {});
        const connections = safeParseJson(response);

        if (!connections || connections.length === 0) {
            return new Map(); // Return an empty map if no data
        }

        // Use reduce() to transform the array into a Map
        const connectionMap = connections.reduce((map, item) => {
            if (item.ConnectionID && item.ConnectionName) {
                map.set(item.ConnectionID, item.ConnectionName);
            }
            return map;
        }, new Map());

        return connectionMap;

    } catch (error) {
        console.error("Failed to create DB connection map:", error);
        return new Map(); // Return empty map on failure
    }
}



// Miguel
/**
 * Fetches all Folder connections and creates a lookup map.
 * @returns {Promise<Map<number, string>>} A promise that resolves to a Map where the
 * key is the ConnectionId and the value is the ConnectionName.
 */
async function createFolderConnectionMap() {
    try {
        const response = await window.loomeApi.runApiRequest(API__DATASOURCE_FOLDER_ID, {});
        const connections = safeParseJson(response);

        if (!connections || connections.length === 0) {
            return new Map(); // Return an empty map if no data
        }

        // Use reduce() to transform the array into a Map
        const connectionMap = connections.reduce((map, item) => {
            if (item.ConnectionID && item.ConnectionName) {
                map.set(item.ConnectionID, item.ConnectionName);
            }
            return map;
        }, new Map());

        return connectionMap;

    } catch (error) {
        console.error("Failed to create Folder connection map:", error);
        return new Map(); // Return empty map on failure
    }
}

/**
 * Gathers all data from the "Add Data Source" modal form.
 * It handles both static fields and dynamically generated fields.
 *
 * @param {HTMLElement} formElement - The <form> element to read data from.
 * @returns {object | null} An object containing the structured form data, or null if the form is not found.
 */
function getDataSourceFormData(formElement) {
    if (!formElement) {
        console.error("Form element not provided to getDataSourceFormData.");
        return null;
    }

    // --- 1. Get values from the STATIC fields ---
    // We use .value for text inputs/textareas and .checked for checkboxes.
    const name = formElement.querySelector('#dataSourceName').value;
    const description = formElement.querySelector('#dataSourceDescription').value;
    const isActive = formElement.querySelector('#dataSourceActive').checked;
    
    // For the <select>, we get the value of the selected <option>.
    const dataSourceTypeID = formElement.querySelector('#dataSourceType').value;

    // --- 2. Get values from the DYNAMICALLY generated fields ---
    // Initialize an empty object to hold the key-value pairs.
    const fields = {};

    // Find the input with the class 'dynamic-field'.
    const dynamicFieldInput = formElement.querySelector('.dynamic-field');
    const fieldName = dynamicFieldInput.name;
    const fieldValue = dynamicFieldInput.value;


    // --- 3. Combine everything into a final payload object ---
    // This structure is designed to match your Pydantic "Create" model.
    const formData = {
        "name": name,
        "description": description,
        "isActive": isActive,
        "dataSourceTypeID": dataSourceTypeID,//parseInt(dataSourceTypeID, 10), // Convert the string value to an integer
        "fieldName": fieldName,
        "fieldValue": fieldValue
    };

    return formData;
}

function AddDataSource(typeNamesList, allFields) {
    // Get the modal's body element
    const modalBody = document.getElementById('addDatasourceModalBody');
    console.log("IN add data source")

    // This can now support multiple fields per type if needed.
    const typeIdToFieldIdMap = {
        1: [1], // 3], // Database type -> "Database Connection" and "Table Name"
        2: [4],// 5], // REDCap API type -> "API URL" and "API Key"
        3: [2]     // Folder type -> "UNC Path"
    };

    // Generate the HTML string for the <option> elements.
    // We use map() to transform each name in the list into an <option> tag.
    // The `index` is used to create a simple value (1, 2, 3, etc.).
    const optionsHtml = typeNamesList.map((typeName, index) => {
        // In a real app, you'd likely use an ID from your data source type object
        // for the value, but index + 1 works for this example.
        return `<option value="${index + 1}">${typeName}</option>`;
    }).join(''); // .join('') concatenates all the strings in the array into one big string.


    // Populate the modal body with the provided HTML content (your markup)
    modalBody.innerHTML = `
                <form id="addDataSourceForm">
                  <div class="mb-3">
                    <label for="dataSourceName" class="form-label">Name</label>
                    <input type="text" class="form-control" id="dataSourceName" placeholder="Name for this Data Source" required>
                  </div>
                  
                  <div class="mb-3">
                    <label for="dataSourceDescription" class="form-label">Description</label>
                    <textarea class="form-control" id="dataSourceDescription" rows="2" placeholder="Description of this Data Source"></textarea>
                  </div>

                  <div class="mb-3">
                      <label for="dataSourceType" class="form-label">Data Source Type</label>
                      <select class="form-select" id="dataSourceType" required>
                          <option value="" selected disabled>Select a Type...</option>
                          ${optionsHtml}
                      </select>
                  </div>

                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" value="" id="dataSourceActive" checked>
                    <label class="form-check-label" for="dataSourceActive">Active</label>
                  </div>

                  <hr>
                  
                  <h6 class="mb-3">Data Source Fields</h6>
                  <div id="dataSourceFieldsContainer">
                    <p class="text-muted">Please select a Data Source Type to see the required fields.</p>
                  </div>
                </form>
              </div>
              
            
            
    `;

    // --- 4. FIND the elements we need to work with ---
    const typeSelect = modalBody.querySelector('#dataSourceType');
    const fieldsContainer = modalBody.querySelector('#dataSourceFieldsContainer');

    // --- 5. CREATE the event handler function ---
    const handleTypeChange = async (event) => {
        const selectedTypeId = parseInt(event.target.value);
        const fieldsContainer = document.querySelector('#dataSourceFieldsContainer');

        // Special handling for Database type (ID = 1)
        if (selectedTypeId === 1) {
            try {
                // MIGUEL TO BE UPDATED
                const response = await window.loomeApi.runApiRequest(API_DBCONNECTION_ID);
                const connections = safeParseJson(response);
                
                // Store ConnectionId in a data attribute that we can access later
                const dropdownHtml = `
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th style="width: 40%;">Name</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Database Connection</td>
                                <td class="relative">
                                    <select class="form-control form-control-sm dynamic-field appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full" 
                                            name="Database Connection">
                                        <option value="" class="text-gray-500">Select a connection...</option>
                                        ${connections.map(conn => `
                                            <option value="${conn.ConnectionID}" 
                                                    data-connection-id="${conn.ConnectionID}">
                                                ${conn.ConnectionName}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                `;
                
                fieldsContainer.innerHTML = dropdownHtml;
                
                // Add change event listener to store the ConnectionId
                const select = fieldsContainer.querySelector('select');
                select.addEventListener('change', (e) => {
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const connectionId = selectedOption.dataset.connectionId;
                    // Store the ConnectionId for later use
                    window.selectedConnectionId = connectionId; // You can access this globally
                });

            } catch (error) {
                console.error('Failed to fetch database connections:', error);
                fieldsContainer.innerHTML = '<p class="text-danger">Error loading database connections</p>';
            }
            return;
        }
        // Special handling for Folder type (ID = 3)
        else if (selectedTypeId === 3) {
            try {
                const response = await window.loomeApi.runApiRequest(API__DATASOURCE_FOLDER_ID);
                const folders = safeParseJson(response);

                // MIGUEL: Change ConnectionID and ConnectionName to FolderID and FolderName later
                const dropdownHtml = `
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th style="width: 40%;">Name</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Folder Connection</td>
                                <td class="relative">
                                    <select class="form-control form-control-sm dynamic-field appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full" 
                                            name="Folder Connection">
                                        <option value="" class="text-gray-500">Select a connection...</option>
                                        ${folders.map(folder => `
                                            <option value="${folder.ConnectionID}">${folder.ConnectionName}</option>
                                        `).join('')}
                                    </select>
                                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                `;

                fieldsContainer.innerHTML = dropdownHtml;
            } catch (error) {
                console.error('Failed to fetch folders:', error);
                fieldsContainer.innerHTML = '<p class="text-danger">Error loading folders.</p>';
            }
            return;
        }
        // Original code for other types
        const requiredFieldIds = typeIdToFieldIdMap[selectedTypeId] || [];

        if (requiredFieldIds.length > 0) {
            // Find the full field objects that match the required IDs
            const fieldsToRender = allFields.filter(field => requiredFieldIds.includes(field.FieldID));
            
            // Generate the HTML for the table rows
            const fieldRowsHtml = fieldsToRender.map(field => `
                <tr>
                    <td>${field.Name}</td>
                    <td>
                        <input type="text" 
                               class="form-control form-control-sm dynamic-field" 
                               data-field-id="${field.FieldID}"
                               name="${field.Name}" 
                               placeholder="Enter value for ${field.Name}">
                    </td>
                </tr>
            `).join('');

            // Inject the full table structure into the container
            fieldsContainer.innerHTML = `
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th style="width: 40%;">Name</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fieldRowsHtml}
                    </tbody>
                </table>
            `;
        } else {
            // If no fields are required, show the placeholder text
            fieldsContainer.innerHTML = '<p class="text-muted">Please select a Data Source Type to see the required fields.</p>';
        }
    };

    // --- 6. ATTACH the event listener to the dropdown ---
    typeSelect.addEventListener('change', handleTypeChange);

    
    
}

/**
 * Fetches ALL DataSourceTypes from the paginated API.
 * This is a self-contained function that returns the results.
 * @param {number} [pageSize=100] - The number of items per page.
 * @returns {Promise<Array>} A promise that resolves to an array of all data source types.
 */
async function getAllDataSourceTypes(pageSize = 100) {
    
    let allResults = []; // Use a local variable to store results

    try {
        // --- 1. Initial request ---
        const initialParams = { "page": 1, "pageSize": pageSize, "search": '' };
        const initialResponse = await window.loomeApi.runApiRequest(API_DATASOURCETYPE_ID, initialParams);
        const parsedInitial = safeParseJson(initialResponse);

        if (!parsedInitial || parsedInitial.RowCount === 0) {
            console.log("No data source types found.");
            return []; // Return an empty array if there's no data
        }

        allResults = parsedInitial.Results;
        const totalPages = parsedInitial.PageCount;

        // If only one page, we're done
        if (totalPages <= 1) {
            return allResults;
        }

        // --- 2. Loop for remaining pages ---
        for (let page = 2; page <= totalPages; page++) {
            console.log(`Fetching page ${page} of ${totalPages}...`);
            const params = { "page": page, "pageSize": pageSize, "search": '' };
            // FIXED BUG: Use the correct API ID in the loop
            const response = await window.loomeApi.runApiRequest(API_DATASOURCETYPE_ID, params);
            const parsed = safeParseJson(response);
            if (parsed && parsed.Results) {
                allResults = allResults.concat(parsed.Results);
            }
        }
        
        console.log(`Successfully fetched a total of ${allResults.length} data source types.`);
        return allResults;

    } catch (error) {
        console.error("An error occurred while fetching data source types:", error);
        return []; // Return empty array on failure
    }
}

/**
 * Fetches all data source types and creates a lookup map.
 * @returns {Promise<Map<number, string>>} A promise that resolves to a Map where the
 *          key is the DataSourceTypeIID and the value is the Name.
 */
async function createDataSourceTypeMap(allTypesArray) {

    if (!allTypesArray || allTypesArray.length === 0) {
        return new Map(); // Return an empty map if no data
    }

    // 2. Use reduce() to transform the array into a Map
    const typeMap = allTypesArray.reduce((map, item) => {
        // For each item in the array, add an entry to our map
        // The key is item.DataSourceTypeIID, the value is item.Name
        if (item.DataSourceTypeID && item.Name) {
            map.set(item.DataSourceTypeID, item.Name);
        }
        return map; // Return the map for the next iteration
    }, new Map()); // The 'new Map()' is the initial value for our accumulator

    return typeMap;
}

/**
 * A generic helper function to make API requests using window.loomeApi.
 * It handles the try/catch block, API call, and JSON parsing.
 *
 * @param {number} apiId - The ID of the API endpoint to call.
 * @param {object} [params={}] - The parameters object to send with the request.
 * @param {string} [context='data'] - A descriptive string for logging errors, e.g., "data source types".
 * @returns {Promise<object|Array|null>} A promise that resolves to the parsed JSON response, or null on failure.
 */
async function fetchApiData(apiId, params = {}, context = 'data') {
    try {
        const response = await window.loomeApi.runApiRequest(apiId, params);
        const parsedResponse = safeParseJson(response);
        
        // It's good practice to check if the parsing itself failed
        if (parsedResponse === null) {
            console.error(`Failed to parse JSON response when fetching ${context}.`);
            return null;
        }
        
        return parsedResponse;
    } catch (error) {
        console.error(`An error occurred while fetching ${context}:`, error);
        return null; // Return null to clearly indicate that the request failed
    }
}



/**
 * Fetches a specific field value by its own ID.
 * @param {number} fieldID - The ID of the field.
 * @returns {Promise<object|null>} A promise resolving to a single field value object, or null on failure.
 */
async function getAllFields(fieldID) {
    // Call the generic helper
    return fetchApiData(API__DATASOURCE_FIELDVALUE_ID, {});
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
        const response = await window.loomeApi.runApiRequest(API_DATASOURCE_ID, apiParams);

        
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

        const processedData = filteredData.map(item => ({
            ...item,
            displayRefreshedDate: item.isRefreshed === true 
                ? formatDate(item.RefreshedDate) 
                : "Not Refreshed Yet"
        }));

        // --- 4. Render the UI Components ---
        // Render the table with only the data for the current page
        renderTable(TABLE_CONTAINER_ID, tableConfig, processedData, {
            renderAccordionContent: renderAccordionDetails 
        });

        // Render pagination using the TOTAL item count from the API
        renderPagination('pagination-controls', totalItems, rowsPerPage, currentPage);

        // Update the total count display
        const dataSourceCount = document.getElementById('dataSourceCount');
        if(dataSourceCount) {
            dataSourceCount.textContent = totalItems;
        }

    } catch (error) {
        console.error("Failed to fetch or render page:", error);
        const container = document.getElementById(TABLE_CONTAINER_ID);
        container.innerHTML = `<div class="p-4 text-red-600">Error loading data: ${error.message}</div>`;
    }
}



const renderAccordionDetails = (item) => {
    const dataSourceType = dataSourceTypeMap.get(item.DataSourceTypeID);
    const dateModified = formatDate(item.ModifiedDate);
    // const dateRefreshed = formatDate(item.RefreshedDate);


    // --- NEW: Logic to build the fields table HTML ---
    let fieldsTableHtml = '';

    
    
    // Check if item.Fields exists and is not an empty object
    if (item.Fields && Object.keys(item.Fields).length > 0) {
        // Use Object.entries to iterate over key-value pairs
        const fieldRows = Object.entries(item.Fields).map(([key, value]) => {
            displayValue = value; // Default display value

            // For overriding key display names
            let displayKey = key;

            // Check if the current field is Database Connection
            if (key === 'Database Connection') {
                // Look up the name from our map. Use parseInt because the ID might be a string.
                // If not found, fall back to showing the original value (the ID).
                displayValue = dbConnectionMap.get(parseInt(value)) || value;
            } else if (key === 'Folder Connection') {
                // Look up the name from our map. Use parseInt because the ID might be a string.
                // If not found, fall back to showing the original value (the ID).
                
                displayValue = folderConnectionMap.get(parseInt(value)) || value;

                // instead of Folder Name in the Name column, use 'Folder Connection'
                displayKey = 'Folder Connection';
            }
            

            return `
                <tr>
                    <td class="p-2 border-t">${displayKey}</td>
                    <td class="p-2 border-t">
                        <span id="dbConnValue" data-field-name="${displayKey}">${displayValue || ''}</span>
                        
                    </td>
                </tr>
            `;
        }).join(''); // Join the array of HTML strings into one string
        //<input type="text" value="${value || ''}" class="edit-state edit-state-field hidden w-full rounded-md border-gray-300 shadow-sm sm:text-sm" data-field-name="${key}">
        fieldsTableHtml = `
            <table class="w-full text-sm bg-white rounded shadow-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-2 text-left font-medium text-gray-500 w-1/3">Name</th>
                        <th class="p-2 text-left font-medium text-gray-500">Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${fieldRows}
                </tbody>
            </table>
        `;
    } else {
        fieldsTableHtml = `<div class="text-center text-sm text-gray-500 p-4">No data source fields found.</div>`;
    }
    // --- END of new logic ---

    return `
    <div class="accordion-body bg-slate-50 p-6" data-id="${item.DataSourceID}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            <!-- LEFT COLUMN: Remains the same -->
            <div>
                 <table class="w-full text-sm">
                    <tbody>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500 w-1/3">ID</td><td class="py-2 text-gray-900">${item.DataSourceID}</td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Name</td><td class="py-2 text-gray-900">
                            <span class="view-state view-state-name">${item.Name}</span>
                            <input type="text" value="${item.Name}" class="edit-state edit-state-name hidden w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                        </td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Description</td><td class="py-2 text-gray-900">
                            <span class="view-state view-state-description">${item.Description || ''}</span>
                            <textarea class="edit-state edit-state-description hidden w-full rounded-md border-gray-300 shadow-sm sm:text-sm" rows="3">${item.Description || ''}</textarea>
                        </td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Active</td><td class="py-2 text-gray-900">
                            <span class="view-state view-state-isactive">${item.IsActive ? 'Yes' : 'No'}</span>
                            <div class="edit-state hidden flex items-center">
                                <input class="edit-state-isactive h-4 w-4 rounded border-gray-300 text-indigo-600" type="checkbox" ${item.IsActive ? 'checked' : ''}>
                                <label class="ml-2 block text-sm text-gray-900">Is Active</label>
                            </div>
                        </td></tr>
                    </tbody>
                </table>
            </div>

            <!-- RIGHT COLUMN -->
            <div>
                <table class="w-full text-sm mb-4">
                     <tbody>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500 w-1/3">Type</td><td class="py-2 text-gray-900">${dataSourceType || 'N/A'}</td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Date Modified</td><td class="py-2 text-gray-900">${dateModified}</td></tr>
                        <tr class="border-b"><td class="py-2 font-medium text-gray-500">Date Refreshed</td><td class="py-2 text-gray-900">${item.displayRefreshedDate}</td></tr>
                    </tbody>
                </table>
                <h4 class="text-sm font-semibold text-gray-600 mt-6 mb-2">Data Source Fields</h4>
                
                <!-- The placeholder is GONE, replaced by the generated HTML -->
                <div class="data-source-fields-container">
                    ${fieldsTableHtml}
                </div>
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


// This is the simplified renderTable function.
// All the async logic in the event listener has been removed.

function renderTable(containerId, tableConfig, data, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found.`);
        return;
    }
    const headers = tableConfig.headers;
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
                const accordionId = `accordion-content-${item.DataSourceId || index}`;
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
                const accordionId = `accordion-content-${item.DataSourceId || index}`;
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
                const dataSourceId = accordionBody.dataset.id; // Using .dataset.id

                // Show a "saving..." state for better UX
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;

                try {
                    // --- 1. Gather Data from the Form ---
                    // Use document.querySelector to find elements within the accordionBody
                    const updatedName = accordionBody.querySelector('.edit-state-name').value;
                    const updatedDescription = accordionBody.querySelector('.edit-state-description').value;
                    const updatedIsActive = accordionBody.querySelector('.edit-state-isactive').checked;

                    // Gather all dynamic field values into a dictionary
                    //const updatedFields = {};
                    // const dynamicFieldInput = accordionBody.querySelector('.edit-state-field');
                    // const fieldName = dynamicFieldInput.dataset.fieldName;
                    // const fieldValue = dynamicFieldInput.value;
                    // accordionBody.querySelectorAll('.edit-state-field').forEach(input => {
                    //     const fieldName = input.dataset.fieldName; // using .dataset
                    //     const fieldValue = input.value;
                    //     updatedFields[fieldName] = fieldValue;
                    // });
                    // const dbConnSpan = document.getElementById('dbConnValue'); // Replace with the actual I
                    // let fieldValue = null;
                    // if (dbConnSpan) {
                        
                    //     fieldValue = dbConnSpan.textContent;
                    //     console.log("The value of 'Database Connection' is:", fieldValue);
                            
                    // }

                    // --- 2. Send Request to the Endpoint using fetch ---
                    const dbConnSpan = document.getElementById('dbConnValue');
                    const connType = dbConnSpan.dataset.fieldName;
                    
                    let updateParams = {}
                    if (connType == 'Database Connection') {
                        updateParams = {
                            "data_source_id": dataSourceId ,
                            "description":  updatedDescription,
                            "isActive":  updatedIsActive,
                            "name":  updatedName,
                            "fieldName": "Database Connection",
                            "fieldValue": displayValue
                        };
                    } else if (connType == 'Folder Connection') {
                        updateParams = {
                            "data_source_id": dataSourceId ,
                            "description":  updatedDescription,
                            "isActive":  updatedIsActive,
                            "name":  updatedName,
                            "fieldName": "Folder Connection",
                            "fieldValue": displayValue
                        };
                    }
                    

                    
                    const updatedDataSource = await window.loomeApi.runApiRequest(API_UPDATE_DATASOURCE_ID, updateParams);

                    // --- 3. Handle the Server's Response ---
                    if (!updatedDataSource) {
                        // Handle cases where the API might return an empty or null response on success
                        throw new Error("API call succeeded but returned no data.");
                    }
                    console.log(updatedDataSource)
                    showToast('Data Source updated successfully!\nPlease wait while the data refreshes.', 'success');

                    // --- 4. Update the UI with the New Data ---
                    accordionBody.querySelector('.view-state-name').textContent = updatedDataSource.Name;
                    accordionBody.querySelector('.view-state-description').textContent = updatedDataSource.Description;
                    accordionBody.querySelector('.view-state-isactive').textContent = updatedDataSource.IsActive ? 'Yes' : 'No';

                    // Update the dynamic fields
                    for (const [fieldName, fieldValue] of Object.entries(updatedDataSource.Fields)) {
                        const fieldSpan = accordionBody.querySelector(`.view-state-field[data-field-name="${fieldName}"]`);
                        if (fieldSpan) {
                            fieldSpan.textContent = fieldValue;
                        }
                    }

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
//     renderTable(tableContainerId, config, paginatedData, {
//         renderAccordionContent: renderAccordionDetails 
//     });
    
//     renderPagination('pagination-controls', filteredData.length, rowsPerPage, currentPage);
// }

/**
 * Safely parses a response that might be a JSON string or an object.
 * @param {string | object} response The API response.
 * @returns {object}
 */
function safeParseJson(response) {
    return typeof response === 'string' ? JSON.parse(response) : response;
}


async function renderPlatformAdminDataSourcePage() {
    // --- 1. Define the table configuration ---
    // (Moved outside the try block so it's accessible to fetchAndRenderPage)
    // 1. Await the results from your fetching function
    const allTypesArray = await getAllDataSourceTypes();
    dataSourceTypeMap = await createDataSourceTypeMap(allTypesArray);
    dbConnectionMap = await createDbConnectionMap();

    folderConnectionMap = await createFolderConnectionMap();

    const typeNamesList = allTypesArray.map(item => item.Name);

    const fields = await getAllFields();
    console.log('Fields:');
    console.log(fields);

    const tableConfig = {
                headers: [
                    { label: "Type", key: "DataSourceTypeID", className: "break-words", widthClass: "w-1/12", 
                        render: (value) => dataSourceTypeMap.get(value)
                        
                    },
                    { label: "Name", key: "Name", className: "break-words", widthClass: "w-3/12" },
                    { label: "Description", key: "Description", className: "break-words", widthClass: "w-6/12" },
                    // { label: "Refreshed Date", key: "RefreshedDate", render: (value) => formatDate(value) },
                    { label: "Refreshed Date", key: "displayRefreshedDate"},
                    // { 
                    //     label: "Refreshed Date", 
                    //     key: "RefreshedDate",
                    //     // Check the 'isRefreshed' property from the entire 'row' object
                    //     render: (value, row) => row.isRefreshed === 1 ? formatDate(value) : "Not Refreshed Yet"
                    // },
                    {
                        label: "Active",
                        key: "IsActive",
                        render: (value) => value ? 'Yes' : 'No'
                    },
                    { key: 'Details', label: '', widthClass: 'w-12', 
                      render: () => `<div class="flex justify-end"><svg class="chevron-icon h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg></div>`
                    }
                    
                    
                ]
            };
        

    // --- 2. Set up Event Listeners ---
    const searchInput = document.getElementById('searchRequests');
    const paginationContainer = document.getElementById('pagination-controls');

    // The search input now calls fetchAndRenderPage
    searchInput.addEventListener('input', () => {
        fetchAndRenderPage(tableConfig, 1, searchInput.value);
    });

    // Your existing click listener for pagination buttons
    paginationContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) return;
        
        const newPage = parseInt(button.dataset.page, 10);
        fetchAndRenderPage(tableConfig, newPage, searchInput.value);
    });

    // --- ADD THIS NEW LISTENER for the page input box ---
    paginationContainer.addEventListener('keydown', (event) => {
        // Only act if the user pressed Enter and the target is our input
        if (event.key === 'Enter' && event.target.id === 'page-input') {
            const inputElement = event.target;
            const newPage = parseInt(inputElement.value, 10);

            // Validate the input
            if (newPage >= 1 && newPage <= totalPages) {
                fetchAndRenderPage(tableConfig, newPage, searchInput.value);
            } else {
                // If invalid, show a message and reset the input to the current page
                alert(`Please enter a page number between 1 and ${totalPages}.`);
                inputElement.value = currentPage; 
            }
        }
    });


    const addDataSrcButton = document.querySelector('#addDatasourceBtn');;
    if (addDataSrcButton) {
        addDataSrcButton.addEventListener('click', () => {
            AddDataSource(typeNamesList, fields);
        });
    }
    
    // --- 7. Listener for Adding a Data Source
    // First, get a reference to the modal and the save button
    const saveButton = document.getElementById('modal-save-add-datasrc-button');
    const addDataSrcElement = document.getElementById('addDatasourceModal');

    const handleSaveClick = async () => {
        // Get the modal instance at the time of clicking (not during page load)
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addDatasourceModal'));
        
        const form = document.getElementById('addDataSourceForm');
        
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            console.log("Form is invalid. Aborting save.");
            return;
        }

        const payload = getDataSourceFormData(form);
        console.log("Data gathered from form:", payload);
        
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Saving...
        `;

        try {
            
            const response = await window.loomeApi.runApiRequest(API_ADD_DATASOURCE_ID, payload);
            console.log("RESPONSE: ", response)
            
            showToast('Data Source added successfully!\nPlease wait while the data refreshes.', 'success');
            
            // This should now work!
            modalInstance.hide();
            
            // Optional: Refresh the table to show the new item
            await fetchAndRenderPage(tableConfig, 1, '');
            
        } catch (error) {
            console.error("API call failed:", error);
            showToast(`Error: ${error.message || 'Failed to save data.'}`, 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Save';
        }
    };

    // --- 6. Add the event listener ---
    // This tells the browser: "When a 'click' happens on 'saveButton', run the 'handleSaveClick' function."
    saveButton.addEventListener('click', handleSaveClick);

    

    // --- 3. Initial Page Load ---
    // Make the first call to fetch page 1 with no search term.
    await fetchAndRenderPage(tableConfig, 1, '');
}

// --- EXPORT FOR TESTING (Node.js environment only) ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        safeParseJson,
        showToast,
        createDbConnectionMap,
        createFolderConnectionMap,
        getDataSourceFormData,
        AddDataSource,
        getAllDataSourceTypes,
        createDataSourceTypeMap,
        fetchApiData,
        getAllFields,
        renderPagination,
        fetchAndRenderPage,
        renderAccordionDetails,
        renderTable,
        formatDate,
        renderPlatformAdminDataSourcePage
    };
}

// --- AUTO-EXECUTE ONLY IN BROWSER ---
if (typeof window !== 'undefined' && typeof module === 'undefined') {
    renderPlatformAdminDataSourcePage();
}

// =============================================================================
// UNIT TESTS (Jest - only run in Node.js test environment)
// =============================================================================
if (typeof describe !== 'undefined') {

    // --- Suppress console output during tests for cleaner output ---
    let originalConsole;
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

    // --- MOCK DATA based on API Response Structures ---
    const mockGetDataSourceResponse = {
        CurrentPage: 1,
        PageCount: 2,
        PageSize: 5,
        RowCount: 10,
        FirstRowOnPage: 1,
        LastRowOnPage: 5,
        Results: [
            {
                DataSourceTypeID: 1,
                DataSourceID: 101,
                Name: "Test Database Source",
                Description: "A test database connection",
                isRefreshed: true,
                ModifiedDate: "2026-01-11T10:18:13.931Z",
                IsActive: true,
                RefreshedDate: "2026-01-10T08:00:00.000Z",
                Fields: {
                    "Database Connection": "5"
                }
            },
            {
                DataSourceTypeID: 3,
                DataSourceID: 102,
                Name: "Test Folder Source",
                Description: "A test folder connection",
                isRefreshed: false,
                ModifiedDate: "2026-01-05T12:00:00.000Z",
                IsActive: false,
                RefreshedDate: null,
                Fields: {
                    "Folder Connection": "10"
                }
            }
        ]
    };

    const mockGetDataSourceTypesResponse = {
        CurrentPage: 1,
        PageCount: 1,
        PageSize: 100,
        RowCount: 3,
        FirstRowOnPage: 1,
        LastRowOnPage: 3,
        Results: [
            { DataSourceTypeID: 1, Name: "Database", Description: "Database connection", IsActive: true, ModifiedDate: "2026-01-01T00:00:00Z" },
            { DataSourceTypeID: 2, Name: "REDCap API", Description: "REDCap API connection", IsActive: true, ModifiedDate: "2026-01-01T00:00:00Z" },
            { DataSourceTypeID: 3, Name: "Folder", Description: "Folder connection", IsActive: true, ModifiedDate: "2026-01-01T00:00:00Z" }
        ]
    };

    const mockGetDatabaseConnectionResponse = [
        { ConnectionID: 1, ConnectionName: "Production DB" },
        { ConnectionID: 2, ConnectionName: "Staging DB" },
        { ConnectionID: 5, ConnectionName: "Test DB" }
    ];

    const mockGetFolderConnectionResponse = [
        { ConnectionID: 10, ConnectionName: "Shared Drive" },
        { ConnectionID: 11, ConnectionName: "Archive Folder" }
    ];

    // --- TEST SUITE: safeParseJson ---
    describe('safeParseJson', () => {
        test('should return the same object when input is already an object', () => {
            const input = { key: 'value', number: 42 };
            const result = safeParseJson(input);
            expect(result).toEqual(input);
            expect(result).toBe(input); // Same reference
        });

        test('should parse a valid JSON string into an object', () => {
            const input = '{"key": "value", "number": 42}';
            const result = safeParseJson(input);
            expect(result).toEqual({ key: 'value', number: 42 });
        });

        test('should parse a JSON array string', () => {
            const input = '[1, 2, 3]';
            const result = safeParseJson(input);
            expect(result).toEqual([1, 2, 3]);
        });

        test('should throw an error for invalid JSON string', () => {
            const input = 'not valid json';
            expect(() => safeParseJson(input)).toThrow(SyntaxError);
        });

        test('should handle empty object string', () => {
            const result = safeParseJson('{}');
            expect(result).toEqual({});
        });

        test('should handle API response structure (GetDataSource)', () => {
            const jsonString = JSON.stringify(mockGetDataSourceResponse);
            const result = safeParseJson(jsonString);
            expect(result.CurrentPage).toBe(1);
            expect(result.Results).toHaveLength(2);
            expect(result.Results[0].Name).toBe("Test Database Source");
        });
    });

    // --- TEST SUITE: formatDate ---
    describe('formatDate', () => {
        test('should format a valid ISO date string', () => {
            const result = formatDate("2026-01-11T10:18:13.931Z");
            expect(result).toBe("January 11, 2026");
        });

        test('should format a date without time component', () => {
            const result = formatDate("2025-12-25");
            expect(result).toBe("December 25, 2025");
        });

        test('should return "N/A" for null input', () => {
            const result = formatDate(null);
            expect(result).toBe('N/A');
        });

        test('should return "N/A" for undefined input', () => {
            const result = formatDate(undefined);
            expect(result).toBe('N/A');
        });

        test('should return "N/A" for empty string input', () => {
            const result = formatDate('');
            expect(result).toBe('N/A');
        });

        test('should return "N/A" for invalid date string', () => {
            const result = formatDate('not a date');
            expect(result).toBe('N/A');
        });

        test('should return "N/A" for gibberish input', () => {
            const result = formatDate('hello world');
            expect(result).toBe('N/A');
        });

        test('should handle RefreshedDate from API response', () => {
            const apiItem = mockGetDataSourceResponse.Results[0];
            const result = formatDate(apiItem.RefreshedDate);
            expect(result).toBe("January 10, 2026");
        });

        test('should handle null RefreshedDate from API response', () => {
            const apiItem = mockGetDataSourceResponse.Results[1];
            const result = formatDate(apiItem.RefreshedDate);
            expect(result).toBe('N/A');
        });
    });

    // --- TEST SUITE: createDataSourceTypeMap ---
    describe('createDataSourceTypeMap', () => {
        test('should create a Map from valid data source types array', async () => {
            const typesArray = mockGetDataSourceTypesResponse.Results;
            const result = await createDataSourceTypeMap(typesArray);
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(3);
            expect(result.get(1)).toBe("Database");
            expect(result.get(2)).toBe("REDCap API");
            expect(result.get(3)).toBe("Folder");
        });

        test('should return empty Map for null input', async () => {
            const result = await createDataSourceTypeMap(null);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should return empty Map for undefined input', async () => {
            const result = await createDataSourceTypeMap(undefined);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should return empty Map for empty array', async () => {
            const result = await createDataSourceTypeMap([]);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should skip items without DataSourceTypeID', async () => {
            const typesArray = [
                { DataSourceTypeID: 1, Name: "Database" },
                { Name: "Invalid - No ID" }, // Missing DataSourceTypeID
                { DataSourceTypeID: 3, Name: "Folder" }
            ];
            const result = await createDataSourceTypeMap(typesArray);
            expect(result.size).toBe(2);
            expect(result.has(2)).toBe(false);
        });

        test('should skip items without Name', async () => {
            const typesArray = [
                { DataSourceTypeID: 1, Name: "Database" },
                { DataSourceTypeID: 2 }, // Missing Name
            ];
            const result = await createDataSourceTypeMap(typesArray);
            expect(result.size).toBe(1);
            expect(result.get(1)).toBe("Database");
        });
    });

    // --- TEST SUITE: createDbConnectionMap ---
    describe('createDbConnectionMap', () => {
        beforeEach(() => {
            // In jsdom, window is the global object itself
            window.loomeApi = {
                runApiRequest: jest.fn()
            };
        });

        afterEach(() => {
            // Clean up
            delete window.loomeApi;
        });

        test('should create a Map from API response', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetDatabaseConnectionResponse);
            
            const result = await createDbConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(3);
            expect(result.get(1)).toBe("Production DB");
            expect(result.get(2)).toBe("Staging DB");
            expect(result.get(5)).toBe("Test DB");
        });

        test('should create Map from JSON string response', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(
                JSON.stringify(mockGetDatabaseConnectionResponse)
            );
            
            const result = await createDbConnectionMap();
            
            expect(result.size).toBe(3);
            expect(result.get(1)).toBe("Production DB");
        });

        test('should return empty Map when API returns empty array', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue([]);
            
            const result = await createDbConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should return empty Map when API returns null', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(null);
            
            const result = await createDbConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should return empty Map on API error', async () => {
            window.loomeApi.runApiRequest.mockRejectedValue(new Error('Network error'));
            
            const result = await createDbConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should skip items with missing ConnectionID', async () => {
            const partialData = [
                { ConnectionID: 1, ConnectionName: "DB1" },
                { ConnectionName: "Invalid DB" }, // Missing ConnectionID
            ];
            window.loomeApi.runApiRequest.mockResolvedValue(partialData);
            
            const result = await createDbConnectionMap();
            
            expect(result.size).toBe(1);
        });
    });

    // --- TEST SUITE: createFolderConnectionMap ---
    describe('createFolderConnectionMap', () => {

        beforeEach(() => {
            window.loomeApi = {
                runApiRequest: jest.fn()
            };
        });

        afterEach(() => {
            delete window.loomeApi;
        });

        test('should create a Map from API response', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetFolderConnectionResponse);
            
            const result = await createFolderConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2);
            expect(result.get(10)).toBe("Shared Drive");
            expect(result.get(11)).toBe("Archive Folder");
        });

        test('should return empty Map when API returns empty array', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue([]);
            
            const result = await createFolderConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        test('should return empty Map on API error', async () => {
            window.loomeApi.runApiRequest.mockRejectedValue(new Error('API failure'));
            
            const result = await createFolderConnectionMap();
            
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });
    });

    // --- TEST SUITE: getAllDataSourceTypes ---
    describe('getAllDataSourceTypes', () => {

        beforeEach(() => {
            window.loomeApi = {
                runApiRequest: jest.fn()
            };
        });

        afterEach(() => {
            delete window.loomeApi;
        });

        test('should return all data source types from single page', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetDataSourceTypesResponse);
            
            const result = await getAllDataSourceTypes();
            
            expect(result).toHaveLength(3);
            expect(result[0].Name).toBe("Database");
            expect(result[1].Name).toBe("REDCap API");
            expect(result[2].Name).toBe("Folder");
        });

        test('should handle multi-page responses', async () => {
            const page1Response = {
                CurrentPage: 1,
                PageCount: 2,
                PageSize: 2,
                RowCount: 3,
                Results: [
                    { DataSourceTypeID: 1, Name: "Database" },
                    { DataSourceTypeID: 2, Name: "REDCap API" }
                ]
            };
            const page2Response = {
                CurrentPage: 2,
                PageCount: 2,
                PageSize: 2,
                RowCount: 3,
                Results: [
                    { DataSourceTypeID: 3, Name: "Folder" }
                ]
            };

            window.loomeApi.runApiRequest
                .mockResolvedValueOnce(page1Response)
                .mockResolvedValueOnce(page2Response);
            
            const result = await getAllDataSourceTypes(2);
            
            expect(result).toHaveLength(3);
            expect(window.loomeApi.runApiRequest).toHaveBeenCalledTimes(2);
        });

        test('should return empty array when RowCount is 0', async () => {
            const emptyResponse = {
                CurrentPage: 1,
                PageCount: 0,
                PageSize: 100,
                RowCount: 0,
                Results: []
            };
            window.loomeApi.runApiRequest.mockResolvedValue(emptyResponse);
            
            const result = await getAllDataSourceTypes();
            
            expect(result).toEqual([]);
        });

        test('should return empty array on API error', async () => {
            window.loomeApi.runApiRequest.mockRejectedValue(new Error('Network error'));
            
            const result = await getAllDataSourceTypes();
            
            expect(result).toEqual([]);
        });
    });

    // --- TEST SUITE: fetchApiData ---
    describe('fetchApiData', () => {

        beforeEach(() => {
            window.loomeApi = {
                runApiRequest: jest.fn()
            };
        });

        afterEach(() => {
            delete window.loomeApi;
        });

        test('should return parsed data on successful API call', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(mockGetDataSourceResponse);
            
            const result = await fetchApiData('GetDataSource', { page: 1 }, 'data sources');
            
            expect(result).toEqual(mockGetDataSourceResponse);
            expect(result.Results).toHaveLength(2);
        });

        test('should parse JSON string response', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue(
                JSON.stringify(mockGetDatabaseConnectionResponse)
            );
            
            const result = await fetchApiData('GetDatabaseConnection', {}, 'connections');
            
            expect(result).toEqual(mockGetDatabaseConnectionResponse);
        });

        test('should return null on API error', async () => {
            window.loomeApi.runApiRequest.mockRejectedValue(new Error('API failure'));
            
            const result = await fetchApiData('GetDataSource', {}, 'data sources');
            
            expect(result).toBeNull();
        });

        test('should pass correct parameters to API', async () => {
            window.loomeApi.runApiRequest.mockResolvedValue({});
            const params = { page: 2, pageSize: 10, search: 'test' };
            
            await fetchApiData('GetDataSource', params, 'data sources');
            
            expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith('GetDataSource', params);
        });
    });

} // End of test block