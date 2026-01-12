// API Constants
const API_GET_COLUMNS_DATA = 'GetColumnsDataByDataSetID';
const API_GET_DATASOURCE_FOLDERS = 'GetLoomeDataSourceFolders';
const API_GET_DATASOURCE_TABLES = 'GetLoomeDataSourceTablesByDataSourceID';
const API_GET_DATASOURCE_TABLE_BY_ID = 'GetLoomeDataSourceTablesByTableId';
const API_GET_DATASET_FIELD_VALUE = 'GetDataSetFieldValuesByDataSetID';
const API_GET_DATASET_METADATA_VALUE = 'GetDataSetMetaDataValue';
const API_GET_DATASETS = 'GetDataSet';
const API_GET_DATASOURCES = 'GetDataSource';
const API_CREATE_DATASET = 'CreateDataSet';
const API_UPDATE_DATASET = 'UpdateDataSet';
const API_GET_DATASOURCE_SUBFOLDERS = 'GetLoomeDataSourceFirstSubFolders';
const API_GET_DATASOURCE_SUBFOLDERS_WITH_FILES = 'GetLoomeDataSourceSubFoldersWithFiles';
const API_GET_DATASET_FOLDERFILE = 'GetDataSetFolderFileByDataSetID';

const pageSize = 10;
let currentPage = 1;
let dataSourceTypeMap = new Map();
let allColumnsData = [];
let currentDataSourceTypeID = 0;
let currentDataSourceID = 0;

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

    // Basic styling
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
 * Fetches a specific page of columns for a given data set ID.
 * @param {string|number} data_set_id - The ID of the data set.
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<Object>} A promise that resolves with the paginated response object.
 */
async function fetchSQLDataSetColumns(data_set_id, page = 1) {
    // Add page and pageSize to the parameters sent to the API
    const params = {
        "data_set_id": data_set_id,
        "page": page,
        "pageSize": pageSize
    };

    // IMPORTANT: getFromAPI should return the single paginated object, not an array
    return getFromAPI(API_GET_COLUMNS_DATA, params);
}

/**
 * Populates the column table's tbody with data from a paginated response.
 * @param {Object|null} paginatedResponse - The full response object from the API.
 */
function displayColumnsTable(data, dataSetTypeId) {
    const tableBody = document.getElementById('dataSetColsBody');

    if (!data || data.length === 0) {
        const placeholderHtml = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    No columns to display. Select a Data Source and Table.
                </td>
            </tr>`;
        tableBody.innerHTML = placeholderHtml;
        return;
    }

    // --- DATA EXISTS ---
    let rowsHtml = '';
    if (dataSetTypeId == 1) { // Database type

        rowsHtml = data.map((col, index) => `
            <tr data-id="${col.DataSetColumnID || col.ColumnName || index}" data-column-name="${col.ColumnName}">
                <td>${col.ColumnName || ''}</td>
                <td class="editable-cell" data-field="LogicalColumnName">${col.LogicalColumnName || ''}</td>
                <td class="editable-cell" data-field="BusinessDescription">${col.BusinessDescription || ''}</td>
                <td class="editable-cell" data-field="ExampleValue">${col.ExampleValue || ''}</td>
                <td class="checkbox-cell">
                    <input class="form-check-input editable-checkbox" type="checkbox" data-field="Redact" ${col.Redact ? 'checked' : ''}>
                </td>
                <td class="checkbox-cell">
                    <input class="form-check-input editable-checkbox" type="checkbox" data-field="Tokenise" ${col.Tokenise ? 'checked' : ''}>
                </td>
            </tr>
        `).join('');

    } else if (dataSetTypeId == 3) { // Folder type   
        // 1. Group the data by FolderName
        const groupedByFolderName = new Map();

        data.forEach(item => {
            const folderName = item.FolderName || 'Unnamed Folder';
            if (!groupedByFolderName.has(folderName)) {
                groupedByFolderName.set(folderName, []);
            }
            groupedByFolderName.get(folderName).push(item);
        });

        groupedByFolderName.forEach((items, folderName) => {
            const rowspan = items.length;

            items.forEach((col, index) => {
                const fileExtension = col.FileType || col.FileExtensions ||'';
                const fileDescription = col.FileDescription || '';
                const isRedacted = col.Redact ? 1 : 0;  // Convert to 1/0
                const isTokenised = col.Tokenise ? 1 : 0;  // Convert to 1/0

                if (index === 0) {
                    rowsHtml += `
                        <tr data-id="${col.FolderName}-${col.FileType}" data-folder-name="${folderName}">
                            <td rowspan="${rowspan}">${folderName}</td>
                            <td data-field="FileType">${fileExtension}</td>
                            <td class="editable-cell" data-field="FileDescription">${fileDescription}</td>
                            <td class="checkbox-cell">
                                <input class="form-check-input editable-checkbox" type="checkbox" data-field="Redact" ${isRedacted === 1 ? 'checked' : ''}>
                            </td>
                            <td class="checkbox-cell">
                                <input class="form-check-input editable-checkbox" type="checkbox" data-field="Tokenise" ${isTokenised === 1 ? 'checked' : ''}>
                            </td>
                        </tr>
                    `;
                } else {
                    rowsHtml += `
                        <tr data-id="${col.FolderName}-${col.FileType}" data-folder-name="${folderName}">
                            <td data-field="FileType">${fileExtension}</td>
                            <td class="editable-cell" data-field="FileDescription">${fileDescription}</td>
                            <td class="checkbox-cell">
                                <input class="form-check-input editable-checkbox" type="checkbox" data-field="Redact" ${isRedacted === 1 ? 'checked' : ''}>
                            </td>
                            <td class="checkbox-cell">
                                <input class="form-check-input editable-checkbox" type="checkbox" data-field="Tokenise" ${isTokenised === 1 ? 'checked' : ''}>
                            </td>
                        </tr>
                    `;
                }
            });
        });
    }

    tableBody.innerHTML = rowsHtml;
}

/**
* Renders a compact and functional set of pagination controls.
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

    let paginationHTML = `
            <button data-page="1" 
                    class="${commonButtonClasses} ${isFirstPage ? disabledClasses : ''}" 
                    ${isFirstPage ? 'disabled' : ''}>
                First
            </button>
            <button data-page="${currentPage - 1}" 
                    class="${commonButtonClasses} ${isFirstPage ? disabledClasses : ''}" 
                    style="margin-right: 10px;"
                    ${isFirstPage ? 'disabled' : ''}>
                Previous
            </button>

        <span>Page</span>
            <input type="number" 
                   id="page-input" 
                   class="w-16 text-center border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                   value="${currentPage}" 
                   min="1" 
                   max="${totalPages}" 
                   aria-label="Current page">
            <span>of ${totalPages}</span>

            <button data-page="${currentPage + 1}" 
                    class="${commonButtonClasses} ${isLastPage ? disabledClasses : ''}"
                    style="margin-left: 10px;" 
                    ${isLastPage ? 'disabled' : ''}>
                Next
            </button>
            <button data-page="${totalPages}" 
                    class="${commonButtonClasses} ${isLastPage ? disabledClasses : ''}" 
                    ${isLastPage ? 'disabled' : ''}>
                Last
            </button>
    `;

    container.innerHTML = paginationHTML;
}

/**
 * A central function to handle page changes.
 */
function handlePageChange(newPage) {
    const totalPages = Math.ceil(allColumnsData.length / pageSize);

    // Validate the page number to ensure it's within bounds
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTablePage(currentDataSourceTypeID); 
    } else {
        const pageInput = document.getElementById('page-input');
        if (pageInput) {
            pageInput.value = currentPage;
        }
        console.warn(`Invalid page number entered: ${newPage}`);
    }
}

/////////////////////////
/**
 * Fetches the simple field value for a Folder data set.
 */
async function fetchDataSetFolderValue(data_set_id) {
    if (data_set_id === "new") {
        return {
            id: null,
            name: null
        };
    }

    const initialParams = { "data_set_id": data_set_id };
    const resultsArray = await getFromAPI(API_GET_DATASET_FIELD_VALUE, initialParams);
    
    if (!resultsArray || resultsArray.length === 0) {
        console.warn("API returned no data for data_set_id:", data_set_id);
        return { id: null, name: null }; // Return a default value
    }

    const result = resultsArray[0];
    console.log("Fetched Folder Value:", result.Value);

    return {
        id: null, // Folders don't have a separate ID, just the name
        name: result.Value
    };
}
/////////////////////////

// Data Set Field Table Rendering Functions

/**
 * Renders the row for selecting a Folder.
 */
async function renderFolderSelectorDataSetFields(tbody, dataSource, dataSetID) {
    tbody.innerHTML = `<tr><td>Folder Name</td><td>Loading folders...</td></tr>`;

    try {
        console.log("DataSource in Folder Selector:", dataSource);
        const folders = await fetchSubFolders(dataSource.DataSourceID);
        console.log("Fetched folders:", folders);

        // Await the result from your function
        const fetchedData = await fetchDataSetFolderValue(dataSetID);
        console.log("Fetched DataSet Field Value 2:", fetchedData);
        let folderId = fetchedData.id;
        let folderName = fetchedData.name;

        let rowHtml = '';
        if (dataSetID === "new" || !folderName) {
            const optionsHtml = folders.map(folder => `<option value="${folder.FolderName}">${folder.FolderName}</option>`).join('');
            rowHtml = `
            <tr>
                <td>Folder Name <input type="text" hidden="true"></td>
                <td width="70%">
                    <select id="tableNameSelector" class="form-control selectpicker bg-white">
                        <option value="-1">Select a Folder</option>
                        ${optionsHtml}
                    </select>
                    <div class="validation-message"></div>
                </td>
            </tr>`;
        } else {
            const filteredFolders = folders.filter(folder => folder.FolderName != folderName);
            const optionsHtml = filteredFolders
                .map(folder => `<option value="${folder.FolderName}" title="${folder.FolderName}">${folder.FolderName}</option>`)
                .join('');

            rowHtml = `
                <tr>
                    <td>Folder Name <input type="text" hidden="true"></td>
                    <td width="70%">
                        <select id="tableNameSelector" class="form-control selectpicker" style="background-color: #E9ECEF" disabled>
                            <option value="${folderName}" title="${folderName}" selected>${folderName}</option>
                            ${optionsHtml}
                        </select>
                        <div class="validation-message"></div>
                    </td>
                </tr>`;
        }

        tbody.innerHTML = rowHtml;

    } catch (error) {
        console.error("Failed to fetch folders:", error);
        tbody.innerHTML = `<tr><td>Folder Name</td><td class="text-danger">Error loading folders.</td></tr>`;
    }
}


async function fetchSubFolders(data_source_id) {
    const initialParams = { "data_source_id": data_source_id };
    return getFromAPI(API_GET_DATASOURCE_SUBFOLDERS, initialParams);
}


async function fetchSubFoldersWithFiles(subFolderName, currentDataSourceID) {
    const initialParams = { "sub_folder_name": subFolderName, "data_source_id": currentDataSourceID };
    const results = await getFromAPI(API_GET_DATASOURCE_SUBFOLDERS_WITH_FILES, initialParams);
    return results;
}

/**
 * Renders the row for the REDCap API Key.
 */
function renderRedcapApiKeyRowDataSetFields(tbody) {
    const rowHtml = `
        <tr>
            <td>REDCap API Key <input type="text" hidden="true"></td>
            <td width="70%">
                <div class="container">
                    <div class="row">
                        <div class="col">
                            <input id="redcapapi" type="password" class="form-control valid">
                            <div class="validation-message"></div>
                        </div>
                        <div class="col col-lg-3">
                            <button id="redcapRefreshBtn" class="btn btn-accent float-right" title="RedCap">Refresh</button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;

    tbody.innerHTML = rowHtml;

    // Optional: Add an event listener to the new button
    tbody.querySelector('#redcapRefreshBtn').addEventListener('click', () => {
        const apiKey = tbody.querySelector('#redcapapi').value;
        console.log(`Refresh button clicked! API Key: ${apiKey}`);
        showToast('Refresh clicked!');
    });
}

async function fetchLoomeDataSourceTablesByTableId(tableId) {
    const initialParams = { "table_id": tableId };
    return getFromAPI(API_GET_DATASOURCE_TABLE_BY_ID, initialParams)
}


async function fetchDataSetFieldValue(data_set_id) {

    if (data_set_id === "new") {
        return {
            id: null,
            name: null
        };
    }

    const initialParams = { "data_set_id": data_set_id }; 
   
    const resultsArray = await getFromAPI(API_GET_DATASET_FIELD_VALUE, initialParams);
    console.log("Fetched DataSet Field Value (as array):", resultsArray);
    if (!resultsArray || resultsArray.length === 0) {
        console.warn("API returned no data for data_set_id:", data_set_id);
        return { id: null, name: null }; // Return a default value
    }

    // --- KEY CHANGE: Get the first object from the array ---
    const result = resultsArray[0];
    console.log("Fetched DataSet Field Value 1:", result);
    console.log("Result FieldID:", result.FieldID);
    // If Field Value is a Table Name, the result is the ID of the table
    // Get the actual table name from another endpoint
    // Case 1: The value is a table ID, so we need to fetch the name
    if (result.FieldID == 3) { 
        console.log("FieldID indicates a table reference. Fetching table name...");
        const tableIdAsString = result.Value; // The value is a string, e.g., "9"

        // --- CONVERT TO INTEGER HERE ---
        const tableId = parseInt(tableIdAsString, 10);
        
        const tableInfo = await fetchLoomeDataSourceTablesByTableId(tableId);
        console.log("Fetched Table Info:", tableId, tableInfo[0]);
        // Return an object with BOTH the ID and the fetched name
        return {
            id: tableId,
            name: tableInfo[0].TableName
        };

    // Case 2: The value is just a simple value, not a reference to another table
    } else {
        console.log("FieldID indicates a direct value. Using value as-is.");
        // Return an object with the same shape for consistency.
        // The ID can be null as it doesn't apply, and the 'name' is the value itself.
        return {
            id: null,
            name: result.Value
        };
    }
}


/**
 * Renders the row for selecting a SQL table.
 */
async function renderSqlTableSelectorDataSetFields(tbody, dataSource, dataSetID) {
    // First, show a "Loading..." state
    tbody.innerHTML = `<tr><td>Table Name</td><td>Loading tables...</td></tr>`;

    try {
        const tables = await fetchSqlTables(dataSource.DataSourceID);
        console.log("Fetched tables:", tables);

        const fetchedData = await fetchDataSetFieldValue(dataSetID);
        console.log("Fetched DataSet Field Value 2:", fetchedData);
        let tableId = fetchedData.id;;
        let tableName = fetchedData.name;;

        let rowHtml = '';

        if (dataSetID === "new" || !tableId) {
            // Create the dropdown HTML with the fetched tables
            const optionsHtml = tables.map(table => `<option value="${table.Id}">${table.TableName}</option>`).join('');

            rowHtml = `
            <tr>
                <td>Table Name <input type="text" hidden="true"></td>
                <td width="70%">
                    <select id="tableNameSelector" class="form-control selectpicker bg-white">
                        <option value="-1">Select a Table</option>
                        ${optionsHtml}
                    </select>
                    <div class="validation-message"></div>
                </td>
            </tr>`;

        } else {
            const filteredTables = tables.filter(table => table.Id != tableId);
            const optionsHtml = filteredTables
                .map(table => `<option value="${table.Id}" title="${table.TableName}">${table.TableName}</option>`)
                .join('');

            rowHtml = `
                <tr>
                    <td>Table Name <input type="text" hidden="true"></td>
                    <td width="70%">
                        <select id="tableNameSelector" class="form-control selectpicker" style="background-color: #E9ECEF" disabled>
                            <option value="${tableId}" title="${tableName}" selected>${tableName}</option>
                            ${optionsHtml}
                        </select>
                        <div class="validation-message"></div>
                    </td>
                </tr>`;
        }

        tbody.innerHTML = rowHtml;

    } catch (error) {
        console.error("Failed to fetch SQL tables:", error);
        tbody.innerHTML = `<tr><td>Table Name</td><td class="text-danger">Error loading tables.</td></tr>`;
    }
}


async function fetchSqlTables(data_source_id) {
    const initialParams = { "data_source_id": data_source_id };
    return getFromAPI(API_GET_DATASOURCE_TABLES, initialParams)
}

/**
 * Dynamically updates the "Data Set Fields" table based on the selected data source type.
 */
async function updateDataSetFieldsTable(dataSource, dataSetID) {

    console.log("Updating fields for DataSource:", dataSource);

    const fieldsTable = document.getElementById('dataSetFieldsTable');
    const fieldsPlaceholder = document.getElementById('fieldsPlaceholder');
    const tbody = fieldsTable.querySelector('tbody');

    // Always start by clearing the current content
    tbody.innerHTML = '';

    // If there's no data source selected, show the placeholder and exit.
    if (!dataSource || !dataSource.DataSourceTypeID) {
        fieldsPlaceholder.style.display = 'block';
        fieldsTable.style.display = 'none';
        return;
    }

    // A valid data source is selected, so ensure the table is visible.
    fieldsPlaceholder.style.display = 'none';
    fieldsTable.style.display = 'table';

    console.log("DataSourceTypeID:", dataSource.DataSourceTypeID);

    // Use a switch to decide which content to render
    switch (dataSource.DataSourceTypeID) {
        case 1: // SQL Database Type
            await renderSqlTableSelectorDataSetFields(tbody, dataSource, dataSetID);
            break;

        case 2: // REDCap API Type
            renderRedcapApiKeyRowDataSetFields(tbody, dataSource);
            break;

        case 3: // Folder Type
            await renderFolderSelectorDataSetFields(tbody, dataSource, dataSetID);
            break;

        default:
            // If the type is unknown, revert to the placeholder state.
            console.warn(`Unknown DataSourceTypeID: ${dataSource.DataSourceTypeID}`);
            fieldsPlaceholder.style.display = 'block';
            fieldsTable.style.display = 'none';
            break;
    }

}
// End Data Set Field Table Rendering Functions

// MetaData Table Rendering Functions

/**
 * Fetches the metadata value for a given DataSetID and renders it in an input field.
 */
async function renderSqlTableSelectorMetaData(tbody, dataSetID) {
    // Step 1: Provide immediate feedback to the user with a loading state.
    tbody.innerHTML = `
        <tr>
            <td>Tag <input type="hidden"></td>
            <td width="70%">
                <input class="form-control" value="Loading..." disabled>
            </td>
        </tr>
    `;

    // A guard clause to handle cases where there's no ID to fetch.
    if (!dataSetID || dataSetID === "new") {
        tbody.innerHTML = `
            <tr>
                <td>Tag <input type="hidden" value="5"></td>
                <td width="70%">
                    <input id="metaDataTag" class="form-control valid" value="">
                </td>
            </tr>`;
        return;
    }

    try {
        // Step 2: AWAIT the data. The code will pause here until the API responds.
        const result = await getFromAPI(API_GET_DATASET_METADATA_VALUE, { "data_set_id": dataSetID });
        const tagValue = (result && result.length > 0) ? result[0].Value : '';

        // Let's assume the MetadataID for "Tag" is 5.
        const rowHtml = `
            <tr>
                <td>Tag <input type="hidden" value="5"></td>
                <td width="70%">
                    <input id="metaDataTag" class="form-control valid" value="${tagValue}">
                </td>
            </tr>
        `;
        tbody.innerHTML = rowHtml;

    } catch (error) {
        console.error("Failed to fetch metadata value:", error);
        tbody.innerHTML = `
            <tr>
                <td>Tag <input type="hidden" value="5"></td>
                <td width="70%">
                    <input class="form-control is-invalid" value="Error loading data" disabled>
                </td>
            </tr>
        `;
    }
}

/**
 * Renders two static rows with input fields for REDCap API metadata.
 */
function renderRedcapApiKeyRowMetaData(tbody, dataSource) {
    const rowHtml = `
        <tr>
            <td>Citations for related publications <input type="hidden" value="1"></td>
            <td width="70%">
                <input id="redcapCitations" class="form-control">
            </td>
        </tr>
        <tr>
            <td>ANZCTR URL <input type="hidden" value="2"></td>
            <td width="70%">
                <input id="redcapAnzctrUrl" class="form-control">
            </td>
        </tr>
    `;
    tbody.innerHTML = rowHtml;
}


/**
 * Hides the metadata table and shows the placeholder text.
 */
function renderFolderSelectorMetaData(tbody) {
    const metaDataTable = document.getElementById('metaDataTable');
    const metaDataPlaceholder = document.getElementById('metaDataPlaceholder');

    metaDataTable.style.display = 'none';
    metaDataPlaceholder.style.display = 'block';
    metaDataPlaceholder.textContent = 'No metadata fields for this data source type.';
}

function updateMetaDataTable(dataSource, dataSetID) {
    const metaDataTable = document.getElementById('metaDataTable');
    const metaDataPlaceholder = document.getElementById('metaDataPlaceholder');
    const tbody = metaDataTable.querySelector('tbody');

    // Clear any old data
    tbody.innerHTML = '';

    // If there's no data source selected, show the placeholder and exit.
    if (!dataSource || !dataSource.DataSourceTypeID) {
        metaDataPlaceholder.style.display = 'block';
        metaDataTable.style.display = 'none';
        return;
    }

    // A valid data source is selected, so ensure the table is visible.
    metaDataPlaceholder.style.display = 'none';
    metaDataTable.style.display = 'table';

    console.log("DataSourceTypeID:", dataSource.DataSourceTypeID);

    // Use a switch to decide which content to render
    switch (dataSource.DataSourceTypeID) {
        case 1: // SQL Database Type
            console.log("In Render SQL Metadata: ", dataSetID)
            renderSqlTableSelectorMetaData(tbody, dataSetID);
            break;

        case 2: // REDCap API Type
            renderRedcapApiKeyRowMetaData(tbody, dataSource);
            break;

        case 3: // Folder Type
            renderFolderSelectorMetaData(tbody, dataSource);
            break;

        default:
            // If the type is unknown, revert to the placeholder state.
            console.warn(`Unknown DataSourceTypeID: ${dataSource.DataSourceTypeID}`);
            metaDataPlaceholder.style.display = 'block';
            metaDataTable.style.display = 'none';
            break;
    }
}

// End MetaData Table Rendering Functions

/**
 * Safely parses a response that might be a JSON string or an object.
 */
function safeParseJson(response) {
    return typeof response === 'string' ? JSON.parse(response) : response;
}

async function getFromAPI(API_ID, initialParams) {
    let allResults = [];

    try {
        const initialResponse = await window.loomeApi.runApiRequest(API_ID, initialParams);
        const parsedInitial = safeParseJson(initialResponse);

        // Early exit if the response is null, undefined, etc.
        if (!parsedInitial) {
            console.log("API returned no data.");
            return [];
        }

        let allResults = []; // Initialize as an empty array for a clean state

        // --- DETECTION LOGIC ---
        if (parsedInitial.PageCount !== undefined && Array.isArray(parsedInitial.Results)) {

            // --- PAGINATED PATH ---
            console.log("Detected a paginated response.");

            allResults = parsedInitial.Results;
            const totalPages = parsedInitial.PageCount;

            if (totalPages > 1) {
                for (let page = 2; page <= totalPages; page++) {
                    console.log(`Fetching page ${page} of ${totalPages}...`);

                    // Construct params for the next page, preserving other initial params
                    const params = { ...initialParams, "page": page };
                    console.log(params)
                    const response = await window.loomeApi.runApiRequest(API_ID, params);
                    const parsed = safeParseJson(response);

                    if (parsed && parsed.Results) {
                        allResults = allResults.concat(parsed.Results);
                    }

                } // end for loop
            }

        } else {
            // --- NON-PAGINATED PATH ---
            console.log("Detected a non-paginated response.");

            if (Array.isArray(parsedInitial)) {
                allResults = parsedInitial;
            } else {
                allResults = [parsedInitial];
            }
        }

        console.log(`Finished fetching for API ID ${API_ID}. Total items: ${allResults.length}`);
        return allResults;

    } catch (error) {
        console.error("An error occurred while fetching data source types:", error);
        return [];
    }
}

async function getAllDataSets() {
    const initialParams = { "page": 1, "pageSize": 100, "search": '', activeStatus: 3 }; //Get both active and inactive Data Set
    return getFromAPI(API_GET_DATASETS, initialParams)
}

async function getAllDataSources() {
    const initialParams = { "page": 1, "pageSize": 100, "search": '' };
    return getFromAPI(API_GET_DATASOURCES, initialParams)
}

/**
 * Populates the dropdown with the list of existing data sources.
 */
function populateExistingDataSets(optgroup, allResults) {
    optgroup.innerHTML = '';
    allResults.sort((a, b) => a.Name.localeCompare(b.Name));

    allResults.forEach(ds => {
        const option = document.createElement('option');
        option.value = ds.DataSetID;
        option.textContent = ds.Name;
        optgroup.appendChild(option);
    });
}

function populateDataSourceOptions(selectElement, data, valueField, textField) {
    if (!selectElement || !Array.isArray(data)) return;
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        selectElement.appendChild(option);
    });
}

/**
 * Fetches the schema for a given table ID and formats it into a standard array of column objects.
 */
async function formatSQLColumnsFromSchema(tableId) {
    try {
        const tableDataArray = await fetchLoomeDataSourceTablesByTableId(tableId);

        if (!tableDataArray || tableDataArray.length === 0) {
            console.warn(`No schema data found for Table ID: ${tableId}`);
            return [];
        }

        const tableSchema = tableDataArray[0];
        const columnNames = (tableSchema.ColumnList || '').split(",").map(name => name.trim());
        const columnTypes = (tableSchema.ColumnTypes || '').split(",").map(type => type.trim());

        if (columnNames.length !== columnTypes.length) {
            console.error("Mismatch between the number of column names and column types.");
            return [];
        }

        const formattedColumns = columnNames.map((name, index) => ({
            "ColumnName": name,
            "ColumnType": columnTypes[index],
            "LogicalColumnName": '', 
            "BusinessDescription": '',
            "ExampleValue": '',
            "Tokenise": false,
            "TokenIdentifierType": 0,
            "Redact": false,
            "DisplayOrder": index + 1,
            "IsFilter": false,
        }));

        return formattedColumns;

    } catch (error) {
        console.error(`Error fetching or formatting schema for Table ID ${tableId}:`, error);
        return [];
    }
}


/**
 * The single function responsible for FETCHING data and populating the master `allColumnsData` array.
 * This is a "reset" action.
 */
async function loadColumnsData(dataSourceTypeId, currentDataSourceID) {
    const dataSetId = document.getElementById('dataSetSelection').value;
    let newColumnsData = []; // Default to an empty array

    if (dataSourceTypeId === 1) { // SQL Database Type
        // --- SCENARIO 1: Editing an EXISTING Data Set ---
        if (dataSetId && dataSetId !== 'new') {
            try {
                console.log(`FETCHING columns for existing Data Set ID: ${dataSetId}...`);
                newColumnsData = await fetchSQLDataSetColumns(dataSetId);

                console.log("newColumnsData:", newColumnsData)
            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
            }
        }
        // --- SCENARIO 2: Creating a NEW Data Set ---
        else if (dataSetId === 'new') {
            const tableNameSelector = document.getElementById('tableNameSelector');
            if (tableNameSelector && tableNameSelector.value && tableNameSelector.value !== '-1') {
                const tableId = tableNameSelector.value;
                console.log(`FETCHING schema for new Data Set from Table ID: ${tableId}...`);
                newColumnsData = await formatSQLColumnsFromSchema(tableId);
            }
        }
    } else if (dataSourceTypeId === 3) { // Folder Type
        newColumnsData = [];

        const mapFolderData = (item) => {
            return {
                ...item,
                FileType: item.FileType || item.FileExtensions || '',
                FileDescription: item.FileDescription || '',
                Redact: item.Redact || 0,
                Tokenise: item.Tokenise || 0
            };
        };
        if (dataSetId === 'new') {
            const tableNameSelector = document.getElementById('tableNameSelector');
            if (tableNameSelector && tableNameSelector.value && tableNameSelector.value !== '-1') {
                const subFolderName = tableNameSelector.value;

                const originalData = await fetchSubFoldersWithFiles(subFolderName, currentDataSourceID);
                console.log("Original NEW Folder Columns Data: ", originalData);
                // Apply the consistent mapping
                newColumnsData = originalData.map(mapFolderData);

                console.log("Mapped NEW Folder Columns Data: ", newColumnsData);
            }
        } else if (dataSetId && dataSetId !== 'new') {
            try {
                // 1. Fetch data for EXISTING set (SAVED data from DB)
                const fetchedData = await getFromAPI(API_GET_DATASET_FOLDERFILE, { "data_set_id": dataSetId });

                // 2. Apply the SAME consistent mapping
                newColumnsData = fetchedData.map(mapFolderData);

                console.log("Fetched and Mapped EXISTING (saved) folder columns:", newColumnsData);

            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
            }
        }
    }


    // --- CRITICAL: Update the master state ---
    allColumnsData = newColumnsData || [];
    currentPage = 1; // Always reset to the first page when data is reloaded

    // Finally, render the first page of the NEW data
    renderTablePage(dataSourceTypeId);
}

/**
 * Renders the UI based on the current state of `allColumnsData` and `currentPage`.
 * This function DOES NOT fetch data.
 */
function renderTablePage(dataSetTypeId) {
    // Calculate the slice of data for the current page
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    console.log(startIndex, endIndex)
    const pageData = allColumnsData.slice(startIndex, endIndex);
    console.log("pageData: ", pageData, allColumnsData)
    // Render the table with only the data for the current page
    displayColumnsTable(pageData, dataSetTypeId);

    console.log(allColumnsData.length, pageSize, currentPage)
    // Render the pagination controls based on the FULL dataset length
    renderPagination('pagination-controls', allColumnsData.length, pageSize, currentPage);
}

/**
 * Gathers all data from the form fields and tables into a structured object.
 * @returns {object} An object containing mainDetails and columns arrays.
 */
function gatherFormData(allColumnsData) {
    // --- Part A: Gather Main Form Details ---
    const mainDetails = {
        Name: document.getElementById('dataSetName').value,
        Description: document.getElementById('dataSetDescription').value,
        DataSourceID: parseInt(document.getElementById('dataSource').value, 10),
        Owner: document.getElementById('dataSetOwner').value,
        Approvers: document.getElementById('dataSetApprover').value,
        IsActive: document.getElementById('dataSetActive').checked
    };

    // --- Part B: Gather Dynamic Metadata (from dataSetFieldsTable and metaDataTable) ---
    // This is a generic way to scrape key-value metadata.
    const metaData = [];
    const dataSetFieldValues = [];
    const fieldsTableBody = document.getElementById('dataSetFieldsTable').querySelector('tbody');
    const metaTableBody = document.getElementById('metaDataTable').querySelector('tbody');

    // Helper to scrape a metadata and data set fields table
    const scrapeMetaTable = (tbody) => {
        tbody.querySelectorAll('tr').forEach(row => {
            const keyInput = row.querySelector('td:first-child input[type="hidden"]');
            const valueInput = row.querySelector('td:last-child input, td:last-child select');
            if (keyInput && valueInput) {
                metaData.push({ //MetaDataID being 1 is only for those with "Tag" as the Metadata
                    MetaDataID: 1, //parseInt(keyInput.value, 10),
                    Value: valueInput.value
                });
            }
        });
    };

    const scrapeFieldsTable = (tbody) => {
        // --- PATH 1: Check for the specific SQL Table Name selector first ---
        const tableNameSelector = tbody.querySelector('#tableNameSelector');
        if (tableNameSelector && tableNameSelector.value && tableNameSelector.value !== "-1") {
            if (currentDataSourceTypeID === 1) { // SQL Database
                // The FieldID for "Table Name" is 3.
                dataSetFieldValues.push({
                    FieldID: 3,
                    Value: tableNameSelector.value
                });
            } else if (currentDataSourceTypeID === 3) { // Folder
                dataSetFieldValues.push({
                    FieldID: 6,
                    Value: tableNameSelector.value
                });
            }
            return; // We're done with this table, so we can exit.
        }
    };

    // Scrape both tables if they exist
    if (fieldsTableBody) scrapeFieldsTable(fieldsTableBody);
    if (metaTableBody) scrapeMetaTable(metaTableBody);

    const columns = allColumnsData;

    if (currentDataSourceTypeID === 1) {
        return {
            ...mainDetails,
            DataSetMetaDataValues: metaData,
            DataSetFieldValues: dataSetFieldValues,
            DataSetColumns: columns,
            DataSetFolderFiles: []
        };
    } else if (currentDataSourceTypeID === 3) {
        console.log("Gathering form data for Folder type with columns:", columns);
        // Remove 'Id' since that ID is from LoomeDataSourceFolders 
        const columnsWithoutId = columns.map(({ Id, ...rest }) => rest);

        return {
            ...mainDetails,
            DataSetMetaDataValues: metaData,
            DataSetFieldValues: dataSetFieldValues,
            DataSetColumns: [],
            DataSetFolderFiles: columnsWithoutId
        };
    }

}

// --- API FUNCTIONS ---
// This calls a API that does the create for DataSet, DataSetColumns, DataSetMetaDataValues, and DataSetFieldValues
async function createDataSet(data) {
    const payload = {
        ...data, // Spread all properties from the original object
        OptOutMessage: "string",
        OptOutList: "string",
        OptOutColumn: "-1",
        DataSourceTypeID: currentDataSourceTypeID
    };

    console.log("Sending this payload to the API:", payload);

    try {
        // Send the new 'payload' object to the API instead of the original 'data'
        const response = await window.loomeApi.runApiRequest(API_CREATE_DATASET, { "payload": payload });
        if (!response) throw new Error("Failed to add dataset - no response from server");
        showToast('Dataset added successfully!');
        return response;
    } catch (error) {
        console.error("Error creating dataset:", error);
        throw error;
    }
}

async function updateDataSet(data_set_id, data) {
    const payload = {
        ...data,
        id: parseInt(data_set_id, 10),
        OptOutMessage: "string",
        OptOutList: "string",
        OptOutColumn: "-1",
        DataSourceTypeID: currentDataSourceTypeID
    };

    if (payload.DataSetFolderFiles && Array.isArray(payload.DataSetFolderFiles)) {
        // 1. Copy FileExtensions from FileType
        payload.DataSetFolderFiles = payload.DataSetFolderFiles.map(file => ({
            ...file,
            FileExtensions: file.FileType || ""
        }));

        // 2. Group by FolderName to build DataSetFolders
        const foldersMap = {};
        payload.DataSetFolderFiles.forEach(file => {
            const folderName = file.FolderName || "root";
            if (!foldersMap[folderName]) {
                foldersMap[folderName] = {
                    FolderName: folderName,
                    Description: "",
                    DataSetFolderFiles: []
                };
            }
            foldersMap[folderName].DataSetFolderFiles.push({
                FolderName: folderName,
                FileType: file.FileType,
                FileDescription: file.FileDescription,
                FileExtensions: file.FileExtensions,
                // TokeniseRule: "",
                Redact: file.Redact ? 1 : 0,
                Tokenise: file.Tokenise ? 1 : 0,
            });
        });

        payload.DataSetFolders = Object.values(foldersMap);
        delete payload.DataSetFolderFiles; // remove flat list
    }

    try {
        // Always include existing DataSetFieldValues so backend re-inserts them after its delete
        const fieldValues = await getFromAPI(API_GET_DATASET_FIELD_VALUE, { "data_set_id": data_set_id });
        payload.DataSetFieldValues = Array.isArray(fieldValues)
            ? fieldValues.map(fv => ({ FieldID: fv.FieldID, Value: fv.Value }))
            : [];

        // Do the same for DataSetMetaDataValues (prevents wipe-out on update)
        const metaValues = await getFromAPI(API_GET_DATASET_METADATA_VALUE, { "data_set_id": data_set_id });
        payload.DataSetMetaDataValues = Array.isArray(metaValues)
            ? metaValues.map(mv => ({ MetaDataID: mv.MetaDataID, Value: mv.Value }))
            : [];
    } catch (e) {
        console.warn("Failed to preload related values; sending empty arrays to avoid crashes.", e);
        payload.DataSetFieldValues = payload.DataSetFieldValues || [];
        payload.DataSetMetaDataValues = payload.DataSetMetaDataValues || [];
    }


    console.log("Sending this payload to the API:", payload);


    try {
        // Send the new 'payload' object to the API
        const response = await window.loomeApi.runApiRequest(
            API_UPDATE_DATASET,
            { id: data_set_id, payload }
        );

        if (!response) throw new Error("Failed to update dataset - no response from server");

        showToast('Dataset updated successfully!');
        return response;

    } catch (error) {
        console.error("Error updating dataset:", error);
        throw error;
    }
}

/**
 * Updates the header of a data table based on the specified data source type.
 * @param {number | string} dataSourceType - The ID of the data source type (e.g., 1 for Database, 3 for Folder).
 */
function updateTableHeader(dataSourceType) {
    const headersConfig = {
        1: ['Column Name', 'Logical Name', 'Business Description', 'Example Value', 'Redact', 'Deidentify'],
        3: ['Folder Name', 'File Type', 'File Description', 'Redact', 'Deidentify']
    };

    const tableHeaderRow = document.getElementById('dataSetColsHeader');
    if (!tableHeaderRow) {
        console.error("Error: Table header row with id 'data-table-header' not found.");
        return;
    }

    const headers = headersConfig[dataSourceType];
    if (!headers) {
        tableHeaderRow.innerHTML = '<th>Please select a data source type first.</th>';
        return;
    }

    const headerHtml = headers.map(headerText => `<th>${headerText}</th>`).join('');
    tableHeaderRow.innerHTML = headerHtml;
}

async function renderManageDataSourcePage() {

    const selectionDropdown = document.getElementById('dataSetSelection');
    const detailsContainer = document.getElementById('dataSetDetailsContainer');
    const optgroup = selectionDropdown.querySelector('optgroup');
    let dataSource = {};

    // Form input elements
    const nameInput = document.getElementById('dataSetName');
    const descriptionInput = document.getElementById('dataSetDescription');
    const dataSourceDrpDwn = document.getElementById('dataSource');
    const activeCheckbox = document.getElementById('dataSetActive');
    const owner = document.getElementById('dataSetOwner');
    const approver = document.getElementById('dataSetApprover');
    const dataSetFieldsTable = document.getElementById('dataSetFieldsTable');

    /**
     * Clears the form fields to their default state for creating a new entry.
     */
    function clearForm() {
        selectionDropdown.value = 'new';
        nameInput.value = '';
        descriptionInput.value = '';
        dataSourceDrpDwn.value = ''; // Resets dropdown to the "Select a Type..." option
        activeCheckbox.checked = true; // A sensible default
        owner.value = '';
        approver.value = '';
        console.log("Form cleared for new data source.");
    }

    /**
     * Fills the form fields with data from a given data source object.
     * @param {object} dataSet The data set object with details.
     */
    function populateForm(dataSet, dataSource) {
        if (!dataSet) return;
        nameInput.value = dataSet.Name;
        descriptionInput.value = dataSet.Description;
        dataSourceDrpDwn.value = dataSource.DataSourceID;
        activeCheckbox.checked = dataSet.IsActive;
        owner.value = dataSet.Owner;
        approver.value = dataSet.Approvers;

        console.log("Form populated with:", dataSet, dataSource);
    }


    async function updateFormForSelection(allDataSets, allDataSources) {
        const selectedId = selectionDropdown.value;

        if (selectedId === 'new') {

            nameInput.disabled = false;
            nameInput.readOnly = false;
            descriptionInput.disabled = false;
            dataSourceDrpDwn.disabled = false;


            clearForm();
            updateDataSetFieldsTable(null, null);
            updateMetaDataTable(null, null);
            // When creating a new set, there are no columns to show. Clear the table.
            displayColumnsTable(null);
        } else {
            // Don't let name and description be edited for existing sets
            // nameInput.disabled = true;
            // descriptionInput.disabled = true;
            nameInput.disabled = false;
            descriptionInput.disabled = false;
            dataSourceDrpDwn.disabled = true;

            const selectedDataSet = allDataSets.find(ds => ds.DataSetID == selectedId);
            if (!selectedDataSet) return;
            const dataSource = allDataSources.find(dsrc => dsrc.DataSourceID == selectedDataSet.DataSourceID);
            if (!dataSource) return;

            // 1. Populate the main form fields
            populateForm(selectedDataSet, dataSource);

            // set GLOBALS so loadColumnsData() knows the type/id
            currentDataSourceTypeID = dataSource.DataSourceTypeID;
            currentDataSourceID = dataSource.DataSourceID;

            // 2. Update the dynamic metadata tables on the left
            updateDataSetFieldsTable(dataSource, selectedId);
            updateMetaDataTable(dataSource, selectedId);

            // refresh header immediately
            updateTableHeader(currentDataSourceTypeID);
        }
    }


    // Add the 'async' keyword to the function that wraps this logic.
    // For example, if it's inside a DOMContentLoaded listener:
    document.addEventListener('DOMContentLoaded', async () => {

        try {
            // 1. Use 'await' to wait for the data to arrive.
            // The code will pause here until getAllDataSources() resolves.
            let allDataSets = await getAllDataSets();
            let allDataSources = await getAllDataSources();

            // 2. Now, allResults is the actual array of data.
            console.log('Data has arrived:', allDataSets);

            // 3. The rest of your code can now run in the correct order.
            populateExistingDataSets(optgroup, allDataSets);
            populateDataSourceOptions(dataSourceDrpDwn, allDataSources, 'DataSourceID', 'Name');

            // Create the Empty Columns Table
            updateFormForSelection(allDataSets, allDataSources);


            // // Listener for DATA SOURCE dropdown
            dataSourceDrpDwn.addEventListener('change', async () => {
                const selectedDataSourceId = dataSourceDrpDwn.value;
                const selectedDataSource = allDataSources.find(src => src.DataSourceID == selectedDataSourceId);
                const selectedDataSetID = selectionDropdown.value;
                currentDataSourceTypeID = selectedDataSource ? selectedDataSource.DataSourceTypeID : null;
                currentDataSourceID = selectedDataSource.DataSourceID;

                if (selectedDataSource) {
                    // First, update the metadata sections in the left column.
                    await updateDataSetFieldsTable(selectedDataSource, selectedDataSetID);
                    await updateMetaDataTable(selectedDataSource, selectedDataSetID);

                } else {
                    // If no source is selected, clear everything.
                    displayColumnsTable(null);
                    // You might also want to clear the metadata tables here.
                }

                await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
                updateTableHeader(selectedDataSource.DataSourceTypeID)


            });

            // Listener for TOP-LEVEL data set selection
            selectionDropdown.addEventListener('change', async () => {
                await updateFormForSelection(allDataSets, allDataSources);
                await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
            });

            // Listener for TABLE NAME dropdown
            dataSetFieldsTable.addEventListener('change', async (event) => {
                if (event.target.id === 'tableNameSelector') {
                    // Always load the FIRST page when the table changes
                    //await updateColumnsForTable(1);
                    console.log("Table Name Selector Changed");
                    await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
                    
                }
            });

            // --- "RENDER" EVENT LISTENER ---
            // This listener ONLY updates the view, it does not fetch data.

            const paginationControls = document.getElementById('pagination-controls');

            // This single listener handles all pagination interactions using event delegation.
            paginationControls.addEventListener('click', (event) => {
                // Check if a pagination button was clicked
                const target = event.target.closest('button[data-page]');
                if (target) {
                    event.preventDefault();
                    const page = parseInt(target.dataset.page, 10);
                    handlePageChange(page);
                }
            });

            paginationControls.addEventListener('keydown', (event) => {
                // Check if the Enter key was pressed in the input field
                const target = event.target;
                if (target.id === 'page-input' && event.key === 'Enter') {
                    event.preventDefault();
                    const page = parseInt(target.value, 10);
                    handlePageChange(page);
                }
            });


            // =================================================================
            //  EDITABLE TABLE LOGIC
            // =================================================================

            const dataSetColsTable = document.getElementById('dataSetColsTable');


            // Get a reference to the body of the columns table.
            const dataSetColsBody = document.getElementById('dataSetColsBody');

            // --- 1. The dblclick listener is now ONLY for creating the input ---
            dataSetColsBody.addEventListener('dblclick', (event) => {
                const cell = event.target.closest('td.editable-cell');
                if (!cell || cell.querySelector('input')) return;

                const originalText = cell.textContent.trim();
                cell.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control form-control-sm';
                input.value = originalText;
                cell.appendChild(input);
                input.focus();

                // The 'blur' event on the input will fire a 'change' event,
                // which is handled by the main listener below.
                input.addEventListener('blur', () => {
                    // Find the object and update it
                    const newValue = input.value.trim();
                    const field = cell.dataset.field;
                    updateInMemoryData(cell.closest('tr'), field, newValue);
                    // Revert the cell to plain text
                    cell.innerHTML = newValue;
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                    else if (e.key === 'Escape') cell.innerHTML = originalText;
                });
            });

            // --- 2. The change listener ONLY handles checkboxes now ---
            dataSetColsBody.addEventListener('change', (event) => {
                const target = event.target;
                if (target.classList.contains('editable-checkbox')) {
                    const field = target.dataset.field;
                    const value = target.checked ? 1 : 0;
                    updateInMemoryData(target.closest('tr'), field, value);
                }
            });


            // --- 3. A NEW helper function to keep the update logic DRY ---
            function updateInMemoryData(rowElement, field, value) {
                if (!rowElement || !field) {
                    console.error("Cannot update: missing row or field information.");
                    return;
                }
                
                const uniqueId = rowElement.dataset.id;
                if (!uniqueId) {
                    console.error("Cannot update: missing data-id on the row.");
                    return;
                }

                console.log(`Updating... ID: ${uniqueId}, Field: ${field}, New Value:`, value);

                const columnToUpdate = allColumnsData.find(col => {
                    // Match by DataSetColumnID (for existing datasets)
                    if (col.DataSetColumnID && col.DataSetColumnID == uniqueId) return true;
                    // Match by ColumnName (for new datasets)
                    if (col.ColumnName && col.ColumnName === uniqueId) return true;
                    // Match by FolderName-FileType (for folder type)
                    if (col.FolderName && col.FileType) {
                        const folderFileKey = `${col.FolderName}-${col.FileType}`;
                        if (folderFileKey === uniqueId) return true;
                    }
                    return false;
                });

                if (columnToUpdate) {
                    columnToUpdate[field] = value;
                    console.log("✓ Updated successfully. Object now:", columnToUpdate);
                    console.log("✓ Full allColumnsData:", allColumnsData);
                } else {
                    console.error("✗ Could not find matching object for uniqueId:", uniqueId);
                    console.error("Available objects:", allColumnsData.map(col => `${col.FolderName}-${col.FileType}`));
                }
            }



            // =================================================================
            //  SUBMIT DATASET DETAILS LOGIC
            // =================================================================

            const manageDataSetForm = document.getElementById('manageDataSetForm');
            const submitButton = document.getElementById('submit-button');

            /**
             * The main submit handler for the entire form.
             */
            manageDataSetForm.addEventListener('submit', async (event) => {
                // 1. Prevent the browser from reloading the page
                event.preventDefault();

                // 2. Provide immediate user feedback and prevent double-clicks
                const originalButtonText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Saving...';

                try {
                    // 3. Gather all data from the form into a structured object
                    const formData = gatherFormData(allColumnsData);
                    console.log("Form Data to Submit:", formData);
                    // --- Client-side validation (optional but recommended) ---
                    if (!formData.Name) {
                        showToast('Data Set Name is required.', 'info');
                        throw new Error('Validation failed: Name is required.');
                    }

                    // 4. Determine if this is a CREATE or UPDATE operation
                    const dataSetId = document.getElementById('dataSetSelection').value;

                    if (dataSetId === 'new') {
                        // --- CREATE (POST) LOGIC ---

                        // Create the main data set record first
                        console.log("Creating new Data Set with payload:", formData);
                        const newDataSet = await createDataSet(formData); // Assume this returns the new object with its ID
                        const newDataSetId = newDataSet.DataSetID;

                        showToast('Data Set created successfully!');

                    } else {
                        // --- UPDATE (PUT/PATCH) LOGIC ---
                        console.log(`Updating Data Set ID ${dataSetId} with payload:`, formData);

                        // Update the main data set record;
                        await updateDataSet(dataSetId, formData);

                        showToast('Data Set updated successfully!');
                    }

                    // Clear the forms
                    clearForm();
                    updateDataSetFieldsTable(null, null);
                    updateMetaDataTable(null, null);
                    displayColumnsTable(null);
                    populateExistingDataSets(optgroup, await getAllDataSets());


                } catch (error) {
                    console.error('An error occurred during submission:', error);
                    showToast('Failed to save the Data Set. Please check the console for details.', 'error');
                } finally {
                    // 5. ALWAYS re-enable the button and restore its text
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            });


        } catch (error) {
            console.error("Failed to fetch data sets:", error);
            // You could display an error message to the user here.
        }
    });

}

// Only run in browser environment, not during Jest testing
if (typeof jest === 'undefined') {
    renderManageDataSourcePage();
}

// ============================================================================
// MODULE EXPORTS (for Node.js/Jest testing)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // API Constants
        API_GET_COLUMNS_DATA,
        API_GET_DATASOURCE_FOLDERS,
        API_GET_DATASOURCE_TABLES,
        API_GET_DATASOURCE_TABLE_BY_ID,
        API_GET_DATASET_FIELD_VALUE,
        API_GET_DATASET_METADATA_VALUE,
        API_GET_DATASETS,
        API_GET_DATASOURCES,
        API_CREATE_DATASET,
        API_UPDATE_DATASET,
        API_GET_DATASOURCE_SUBFOLDERS,
        API_GET_DATASOURCE_SUBFOLDERS_WITH_FILES,
        API_GET_DATASET_FOLDERFILE,
        // Functions
        safeParseJson,
        showToast,
        renderPagination,
        handlePageChange,
        displayColumnsTable,
        populateExistingDataSets,
        populateDataSourceOptions,
        renderRedcapApiKeyRowMetaData,
        updateTableHeader,
        gatherFormData,
        createDataSet,
        updateDataSet,
        getFromAPI,
        getAllDataSets,
        getAllDataSources,
        fetchSQLDataSetColumns,
        fetchDataSetFieldValue,
        fetchDataSetFolderValue,
        fetchLoomeDataSourceTablesByTableId,
        formatSQLColumnsFromSchema,
        fetchSubFolders,
        fetchSubFoldersWithFiles,
        fetchSqlTables,
        renderTablePage,
        // State accessors for testing
        get pageSize() { return pageSize; },
        get currentPage() { return currentPage; },
        set currentPage(val) { currentPage = val; },
        get allColumnsData() { return allColumnsData; },
        set allColumnsData(val) { allColumnsData = val; },
        get currentDataSourceTypeID() { return currentDataSourceTypeID; },
        set currentDataSourceTypeID(val) { currentDataSourceTypeID = val; },
        get currentDataSourceID() { return currentDataSourceID; },
        set currentDataSourceID(val) { currentDataSourceID = val; }
    };
}

// ============================================================================
// UNIT TESTS
// ============================================================================
if (typeof describe === 'function') {
    const mod = typeof module !== 'undefined' && module.exports ? module.exports : {};

    describe('manageDataSets.js', () => {
        let mockApiResponse;
        let originalLoomeApi;

        beforeEach(() => {
            // Reset state
            mod.currentPage = 1;
            mod.allColumnsData = [];
            mod.currentDataSourceTypeID = 0;
            mod.currentDataSourceID = 0;

            // Setup DOM
            document.body.innerHTML = `
                <div id="pagination-controls"></div>
                <table id="dataSetColsTable">
                    <thead><tr id="dataSetColsHeader"></tr></thead>
                    <tbody id="dataSetColsBody"></tbody>
                </table>
                <select id="dataSetSelection">
                    <optgroup label="Existing Data Sets"></optgroup>
                </select>
                <input id="dataSetName" type="text" />
                <textarea id="dataSetDescription"></textarea>
                <select id="dataSource"><option value="">Select...</option></select>
                <input id="dataSetActive" type="checkbox" checked />
                <input id="dataSetOwner" type="text" />
                <input id="dataSetApprover" type="text" />
                <table id="dataSetFieldsTable"><tbody></tbody></table>
                <table id="metaDataTable"><tbody></tbody></table>
                <div id="fieldsPlaceholder"></div>
                <div id="metaDataPlaceholder"></div>
                <select id="tableNameSelector"><option value="-1">Select...</option></select>
            `;

            // Mock console methods
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});

            // Store original API
            originalLoomeApi = window.loomeApi;
            mockApiResponse = null;
            window.loomeApi = {
                runApiRequest: jest.fn((apiId, params) => Promise.resolve(mockApiResponse))
            };
        });

        afterEach(() => {
            window.loomeApi = originalLoomeApi;
            jest.restoreAllMocks();
        });

        // =====================================================================
        // API Constants Tests
        // =====================================================================
        describe('API Constants', () => {
            test('API_GET_COLUMNS_DATA should be GetColumnsDataByDataSetID', () => {
                expect(mod.API_GET_COLUMNS_DATA).toBe('GetColumnsDataByDataSetID');
            });

            test('API_GET_DATASOURCE_FOLDERS should be GetLoomeDataSourceFolders', () => {
                expect(mod.API_GET_DATASOURCE_FOLDERS).toBe('GetLoomeDataSourceFolders');
            });

            test('API_GET_DATASOURCE_TABLES should be GetLoomeDataSourceTablesByDataSourceID', () => {
                expect(mod.API_GET_DATASOURCE_TABLES).toBe('GetLoomeDataSourceTablesByDataSourceID');
            });

            test('API_GET_DATASOURCE_TABLE_BY_ID should be GetLoomeDataSourceTablesByTableId', () => {
                expect(mod.API_GET_DATASOURCE_TABLE_BY_ID).toBe('GetLoomeDataSourceTablesByTableId');
            });

            test('API_GET_DATASET_FIELD_VALUE should be GetDataSetFieldValuesByDataSetID', () => {
                expect(mod.API_GET_DATASET_FIELD_VALUE).toBe('GetDataSetFieldValuesByDataSetID');
            });

            test('API_GET_DATASET_METADATA_VALUE should be GetDataSetMetaDataValue', () => {
                expect(mod.API_GET_DATASET_METADATA_VALUE).toBe('GetDataSetMetaDataValue');
            });

            test('API_GET_DATASETS should be GetDataSet', () => {
                expect(mod.API_GET_DATASETS).toBe('GetDataSet');
            });

            test('API_GET_DATASOURCES should be GetDataSource', () => {
                expect(mod.API_GET_DATASOURCES).toBe('GetDataSource');
            });

            test('API_CREATE_DATASET should be CreateDataSet', () => {
                expect(mod.API_CREATE_DATASET).toBe('CreateDataSet');
            });

            test('API_UPDATE_DATASET should be UpdateDataSet', () => {
                expect(mod.API_UPDATE_DATASET).toBe('UpdateDataSet');
            });

            test('API_GET_DATASOURCE_SUBFOLDERS should be GetLoomeDataSourceFirstSubFolders', () => {
                expect(mod.API_GET_DATASOURCE_SUBFOLDERS).toBe('GetLoomeDataSourceFirstSubFolders');
            });

            test('API_GET_DATASOURCE_SUBFOLDERS_WITH_FILES should be GetLoomeDataSourceSubFoldersWithFiles', () => {
                expect(mod.API_GET_DATASOURCE_SUBFOLDERS_WITH_FILES).toBe('GetLoomeDataSourceSubFoldersWithFiles');
            });

            test('API_GET_DATASET_FOLDERFILE should be GetDataSetFolderFileByDataSetID', () => {
                expect(mod.API_GET_DATASET_FOLDERFILE).toBe('GetDataSetFolderFileByDataSetID');
            });

            test('pageSize should be 10', () => {
                expect(mod.pageSize).toBe(10);
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

            test('should return array as-is if already an array', () => {
                const arr = [{ id: 1 }, { id: 2 }];
                const result = mod.safeParseJson(arr);
                expect(result).toBe(arr);
            });

            test('should handle empty object string', () => {
                const result = mod.safeParseJson('{}');
                expect(result).toEqual({});
            });

            test('should handle paginated response string', () => {
                const paginatedStr = '{"Results":[{"id":1}],"PageCount":3,"TotalCount":25}';
                const result = mod.safeParseJson(paginatedStr);
                expect(result.Results).toEqual([{ id: 1 }]);
                expect(result.PageCount).toBe(3);
            });
        });

        // =====================================================================
        // showToast Tests
        // =====================================================================
        describe('showToast', () => {
            beforeEach(() => {
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            test('should create a toast element with success class by default', () => {
                mod.showToast('Test message');
                const toast = document.querySelector('.toast-notification');
                expect(toast).toBeTruthy();
                expect(toast.classList.contains('toast-success')).toBe(true);
                expect(toast.textContent).toBe('Test message');
            });

            test('should create a toast element with error class when type is error', () => {
                mod.showToast('Error message', 'error');
                const toast = document.querySelector('.toast-notification');
                expect(toast).toBeTruthy();
                expect(toast.classList.contains('toast-error')).toBe(true);
            });

            test('should create a toast element with info class when type is info', () => {
                mod.showToast('Info message', 'info');
                const toast = document.querySelector('.toast-notification');
                expect(toast.classList.contains('toast-info')).toBe(true);
            });

            test('should apply fade-in animation after short delay', () => {
                mod.showToast('Animated message');
                jest.advanceTimersByTime(15);
                const toast = document.querySelector('.toast-notification');
                expect(toast.style.opacity).toBe('1');
                expect(toast.style.transform).toBe('translateY(0)');
            });

            test('should start fade-out after duration', () => {
                mod.showToast('Timed message', 'success', 3000);
                jest.advanceTimersByTime(3015);
                const toast = document.querySelector('.toast-notification');
                expect(toast.style.opacity).toBe('0');
            });
        });

        // =====================================================================
        // renderPagination Tests
        // =====================================================================
        describe('renderPagination', () => {
            test('should render pagination controls correctly', () => {
                mod.renderPagination('pagination-controls', 50, 10, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toContain('First');
                expect(container.innerHTML).toContain('Previous');
                expect(container.innerHTML).toContain('Next');
                expect(container.innerHTML).toContain('Last');
            });

            test('should show correct total pages', () => {
                mod.renderPagination('pagination-controls', 50, 10, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toContain('of 5');
            });

            test('should disable First and Previous buttons on first page', () => {
                mod.renderPagination('pagination-controls', 50, 10, 1);
                const buttons = document.querySelectorAll('button[data-page]');
                const firstBtn = buttons[0];
                const prevBtn = buttons[1];
                expect(firstBtn.disabled).toBe(true);
                expect(prevBtn.disabled).toBe(true);
            });

            test('should disable Next and Last buttons on last page', () => {
                mod.renderPagination('pagination-controls', 50, 10, 5);
                const buttons = document.querySelectorAll('button[data-page]');
                const nextBtn = buttons[2];
                const lastBtn = buttons[3];
                expect(nextBtn.disabled).toBe(true);
                expect(lastBtn.disabled).toBe(true);
            });

            test('should not render pagination for single page', () => {
                mod.renderPagination('pagination-controls', 5, 10, 1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toBe('');
            });

            test('should set correct value in page input', () => {
                mod.renderPagination('pagination-controls', 50, 10, 3);
                const input = document.getElementById('page-input');
                expect(input.value).toBe('3');
            });

            test('should set correct min and max on page input', () => {
                mod.renderPagination('pagination-controls', 50, 10, 3);
                const input = document.getElementById('page-input');
                expect(input.min).toBe('1');
                expect(input.max).toBe('5');
            });

            test('should handle empty container gracefully', () => {
                expect(() => mod.renderPagination('nonexistent', 50, 10, 1)).not.toThrow();
            });

            test('should enable all buttons on middle page', () => {
                mod.renderPagination('pagination-controls', 50, 10, 3);
                const buttons = document.querySelectorAll('button[data-page]');
                buttons.forEach(btn => {
                    expect(btn.disabled).toBe(false);
                });
            });
        });

        // =====================================================================
        // handlePageChange Tests
        // =====================================================================
        describe('handlePageChange', () => {
            beforeEach(() => {
                mod.allColumnsData = Array(50).fill({}).map((_, i) => ({ id: i + 1 }));
                mod.currentDataSourceTypeID = 1;
            });

            test('should update currentPage for valid page number', () => {
                mod.handlePageChange(3);
                expect(mod.currentPage).toBe(3);
            });

            test('should not update currentPage for page less than 1', () => {
                mod.currentPage = 2;
                mod.handlePageChange(0);
                expect(mod.currentPage).toBe(2);
            });

            test('should not update currentPage for page greater than total pages', () => {
                mod.currentPage = 2;
                mod.handlePageChange(10);
                expect(mod.currentPage).toBe(2);
            });

            test('should accept page 1', () => {
                mod.currentPage = 3;
                mod.handlePageChange(1);
                expect(mod.currentPage).toBe(1);
            });

            test('should accept last page', () => {
                mod.handlePageChange(5);
                expect(mod.currentPage).toBe(5);
            });

            test('should reset page input to current page on invalid input', () => {
                mod.currentPage = 2;
                mod.renderPagination('pagination-controls', 50, 10, 2);
                mod.handlePageChange(100);
                const input = document.getElementById('page-input');
                expect(input.value).toBe('2');
            });
        });

        // =====================================================================
        // displayColumnsTable Tests
        // =====================================================================
        describe('displayColumnsTable', () => {
            test('should show placeholder when data is null', () => {
                mod.displayColumnsTable(null, 1);
                const tbody = document.getElementById('dataSetColsBody');
                expect(tbody.innerHTML).toContain('No columns to display');
            });

            test('should show placeholder when data is empty array', () => {
                mod.displayColumnsTable([], 1);
                const tbody = document.getElementById('dataSetColsBody');
                expect(tbody.innerHTML).toContain('No columns to display');
            });

            test('should render SQL database columns correctly (type 1)', () => {
                const sqlData = [
                    { DataSetColumnID: 1, ColumnName: 'id', LogicalColumnName: 'ID', BusinessDescription: 'Primary key', ExampleValue: '1', Redact: false, Tokenise: true },
                    { DataSetColumnID: 2, ColumnName: 'name', LogicalColumnName: 'Name', BusinessDescription: 'User name', ExampleValue: 'John', Redact: true, Tokenise: false }
                ];
                mod.displayColumnsTable(sqlData, 1);
                const tbody = document.getElementById('dataSetColsBody');
                expect(tbody.querySelectorAll('tr').length).toBe(2);
                expect(tbody.innerHTML).toContain('id');
                expect(tbody.innerHTML).toContain('name');
                expect(tbody.innerHTML).toContain('Primary key');
            });

            test('should render folder columns correctly (type 3)', () => {
                const folderData = [
                    { FolderName: 'Documents', FileType: 'pdf', FileDescription: 'PDF files', Redact: 1, Tokenise: 0 },
                    { FolderName: 'Documents', FileType: 'docx', FileDescription: 'Word files', Redact: 0, Tokenise: 1 }
                ];
                mod.displayColumnsTable(folderData, 3);
                const tbody = document.getElementById('dataSetColsBody');
                expect(tbody.innerHTML).toContain('Documents');
                expect(tbody.innerHTML).toContain('pdf');
                expect(tbody.innerHTML).toContain('docx');
            });

            test('should use rowspan for grouped folder items', () => {
                const folderData = [
                    { FolderName: 'Reports', FileType: 'pdf', FileDescription: 'PDF', Redact: 0, Tokenise: 0 },
                    { FolderName: 'Reports', FileType: 'xlsx', FileDescription: 'Excel', Redact: 0, Tokenise: 0 }
                ];
                mod.displayColumnsTable(folderData, 3);
                const tbody = document.getElementById('dataSetColsBody');
                expect(tbody.innerHTML).toContain('rowspan="2"');
            });

            test('should check Redact checkbox when Redact is true for SQL type', () => {
                const sqlData = [{ DataSetColumnID: 1, ColumnName: 'ssn', Redact: true, Tokenise: false }];
                mod.displayColumnsTable(sqlData, 1);
                const checkbox = document.querySelector('input[data-field="Redact"]');
                expect(checkbox.checked).toBe(true);
            });

            test('should check Tokenise checkbox when Tokenise is true for SQL type', () => {
                const sqlData = [{ DataSetColumnID: 1, ColumnName: 'email', Redact: false, Tokenise: true }];
                mod.displayColumnsTable(sqlData, 1);
                const checkbox = document.querySelector('input[data-field="Tokenise"]');
                expect(checkbox.checked).toBe(true);
            });

            test('should set data-id attribute on rows', () => {
                const sqlData = [{ DataSetColumnID: 123, ColumnName: 'test' }];
                mod.displayColumnsTable(sqlData, 1);
                const row = document.querySelector('tr[data-id="123"]');
                expect(row).toBeTruthy();
            });
        });

        // =====================================================================
        // populateExistingDataSets Tests
        // =====================================================================
        describe('populateExistingDataSets', () => {
            test('should populate optgroup with sorted data sets', () => {
                const optgroup = document.querySelector('#dataSetSelection optgroup');
                const dataSets = [
                    { DataSetID: 2, Name: 'Zebra Data' },
                    { DataSetID: 1, Name: 'Apple Data' },
                    { DataSetID: 3, Name: 'Mango Data' }
                ];
                mod.populateExistingDataSets(optgroup, dataSets);
                const options = optgroup.querySelectorAll('option');
                expect(options.length).toBe(3);
                expect(options[0].textContent).toBe('Apple Data');
                expect(options[1].textContent).toBe('Mango Data');
                expect(options[2].textContent).toBe('Zebra Data');
            });

            test('should set correct value attribute on options', () => {
                const optgroup = document.querySelector('#dataSetSelection optgroup');
                const dataSets = [{ DataSetID: 42, Name: 'Test Set' }];
                mod.populateExistingDataSets(optgroup, dataSets);
                const option = optgroup.querySelector('option');
                expect(option.value).toBe('42');
            });

            test('should clear existing options before populating', () => {
                const optgroup = document.querySelector('#dataSetSelection optgroup');
                optgroup.innerHTML = '<option value="old">Old Option</option>';
                mod.populateExistingDataSets(optgroup, [{ DataSetID: 1, Name: 'New' }]);
                expect(optgroup.querySelectorAll('option').length).toBe(1);
                expect(optgroup.innerHTML).not.toContain('Old Option');
            });

            test('should handle empty array', () => {
                const optgroup = document.querySelector('#dataSetSelection optgroup');
                mod.populateExistingDataSets(optgroup, []);
                expect(optgroup.querySelectorAll('option').length).toBe(0);
            });
        });

        // =====================================================================
        // populateDataSourceOptions Tests
        // =====================================================================
        describe('populateDataSourceOptions', () => {
            test('should populate select with data source options', () => {
                const select = document.getElementById('dataSource');
                const data = [
                    { DataSourceID: 1, Name: 'Source A' },
                    { DataSourceID: 2, Name: 'Source B' }
                ];
                mod.populateDataSourceOptions(select, data, 'DataSourceID', 'Name');
                expect(select.options.length).toBe(3); // 1 default + 2 data
                expect(select.options[1].value).toBe('1');
                expect(select.options[1].textContent).toBe('Source A');
            });

            test('should preserve first option (placeholder)', () => {
                const select = document.getElementById('dataSource');
                select.options[0].textContent = 'Select a source...';
                mod.populateDataSourceOptions(select, [{ id: 1, label: 'Test' }], 'id', 'label');
                expect(select.options[0].textContent).toBe('Select a source...');
            });

            test('should clear previous options except first', () => {
                const select = document.getElementById('dataSource');
                select.add(new Option('Old', 'old'));
                mod.populateDataSourceOptions(select, [{ id: 1, name: 'New' }], 'id', 'name');
                expect(select.options.length).toBe(2);
            });

            test('should handle null select element gracefully', () => {
                expect(() => mod.populateDataSourceOptions(null, [], 'id', 'name')).not.toThrow();
            });

            test('should handle non-array data gracefully', () => {
                const select = document.getElementById('dataSource');
                expect(() => mod.populateDataSourceOptions(select, null, 'id', 'name')).not.toThrow();
            });
        });

        // =====================================================================
        // renderRedcapApiKeyRowMetaData Tests
        // =====================================================================
        describe('renderRedcapApiKeyRowMetaData', () => {
            test('should render two input rows for REDCap metadata', () => {
                const tbody = document.querySelector('#metaDataTable tbody');
                mod.renderRedcapApiKeyRowMetaData(tbody, {});
                const rows = tbody.querySelectorAll('tr');
                expect(rows.length).toBe(2);
            });

            test('should include Citations input field', () => {
                const tbody = document.querySelector('#metaDataTable tbody');
                mod.renderRedcapApiKeyRowMetaData(tbody, {});
                expect(tbody.innerHTML).toContain('Citations for related publications');
                expect(tbody.querySelector('#redcapCitations')).toBeTruthy();
            });

            test('should include ANZCTR URL input field', () => {
                const tbody = document.querySelector('#metaDataTable tbody');
                mod.renderRedcapApiKeyRowMetaData(tbody, {});
                expect(tbody.innerHTML).toContain('ANZCTR URL');
                expect(tbody.querySelector('#redcapAnzctrUrl')).toBeTruthy();
            });

            test('should include hidden input with MetaDataID 1 for citations', () => {
                const tbody = document.querySelector('#metaDataTable tbody');
                mod.renderRedcapApiKeyRowMetaData(tbody, {});
                const hiddenInputs = tbody.querySelectorAll('input[type="hidden"]');
                expect(hiddenInputs[0].value).toBe('1');
            });

            test('should include hidden input with MetaDataID 2 for ANZCTR', () => {
                const tbody = document.querySelector('#metaDataTable tbody');
                mod.renderRedcapApiKeyRowMetaData(tbody, {});
                const hiddenInputs = tbody.querySelectorAll('input[type="hidden"]');
                expect(hiddenInputs[1].value).toBe('2');
            });
        });

        // =====================================================================
        // updateTableHeader Tests
        // =====================================================================
        describe('updateTableHeader', () => {
            test('should render SQL database headers for type 1', () => {
                mod.updateTableHeader(1);
                const header = document.getElementById('dataSetColsHeader');
                expect(header.innerHTML).toContain('Column Name');
                expect(header.innerHTML).toContain('Logical Name');
                expect(header.innerHTML).toContain('Business Description');
                expect(header.innerHTML).toContain('Example Value');
                expect(header.innerHTML).toContain('Redact');
                expect(header.innerHTML).toContain('Deidentify');
            });

            test('should render folder headers for type 3', () => {
                mod.updateTableHeader(3);
                const header = document.getElementById('dataSetColsHeader');
                expect(header.innerHTML).toContain('Folder Name');
                expect(header.innerHTML).toContain('File Type');
                expect(header.innerHTML).toContain('File Description');
                expect(header.innerHTML).toContain('Redact');
                expect(header.innerHTML).toContain('Deidentify');
            });

            test('should show message for unknown type', () => {
                mod.updateTableHeader(99);
                const header = document.getElementById('dataSetColsHeader');
                expect(header.innerHTML).toContain('Please select a data source type first');
            });

            test('should create correct number of th elements for SQL type', () => {
                mod.updateTableHeader(1);
                const ths = document.querySelectorAll('#dataSetColsHeader th');
                expect(ths.length).toBe(6);
            });

            test('should create correct number of th elements for folder type', () => {
                mod.updateTableHeader(3);
                const ths = document.querySelectorAll('#dataSetColsHeader th');
                expect(ths.length).toBe(5);
            });
        });

        // =====================================================================
        // gatherFormData Tests
        // =====================================================================
        describe('gatherFormData', () => {
            beforeEach(() => {
                document.getElementById('dataSetName').value = 'Test Dataset';
                document.getElementById('dataSetDescription').value = 'Test Description';
                document.getElementById('dataSource').innerHTML = '<option value="5">Source</option>';
                document.getElementById('dataSource').value = '5';
                document.getElementById('dataSetOwner').value = 'owner@test.com';
                document.getElementById('dataSetApprover').value = 'approver@test.com';
                document.getElementById('dataSetActive').checked = true;
            });

            test('should gather main form details correctly', () => {
                mod.currentDataSourceTypeID = 1;
                const result = mod.gatherFormData([]);
                expect(result.Name).toBe('Test Dataset');
                expect(result.Description).toBe('Test Description');
                expect(result.DataSourceID).toBe(5);
                expect(result.Owner).toBe('owner@test.com');
                expect(result.Approvers).toBe('approver@test.com');
                expect(result.IsActive).toBe(true);
            });

            test('should return DataSetColumns for SQL type (type 1)', () => {
                mod.currentDataSourceTypeID = 1;
                const columns = [{ ColumnName: 'id', ColumnType: 'int' }];
                const result = mod.gatherFormData(columns);
                expect(result.DataSetColumns).toEqual(columns);
                expect(result.DataSetFolderFiles).toEqual([]);
            });

            test('should return DataSetFolderFiles for folder type (type 3)', () => {
                mod.currentDataSourceTypeID = 3;
                const folderFiles = [{ Id: 1, FolderName: 'Docs', FileType: 'pdf' }];
                const result = mod.gatherFormData(folderFiles);
                expect(result.DataSetFolderFiles).toEqual([{ FolderName: 'Docs', FileType: 'pdf' }]);
                expect(result.DataSetColumns).toEqual([]);
            });

            test('should remove Id field from folder files', () => {
                mod.currentDataSourceTypeID = 3;
                const folderFiles = [{ Id: 999, FolderName: 'Test', FileType: 'txt' }];
                const result = mod.gatherFormData(folderFiles);
                expect(result.DataSetFolderFiles[0].Id).toBeUndefined();
            });

            test('should scrape metadata from metaDataTable', () => {
                mod.currentDataSourceTypeID = 1;
                const tbody = document.querySelector('#metaDataTable tbody');
                tbody.innerHTML = `
                    <tr>
                        <td>Tag <input type="hidden" value="5"></td>
                        <td><input id="metaDataTag" value="important"></td>
                    </tr>
                `;
                const result = mod.gatherFormData([]);
                expect(result.DataSetMetaDataValues).toContainEqual({ MetaDataID: 1, Value: 'important' });
            });

            test('should scrape SQL table field value', () => {
                mod.currentDataSourceTypeID = 1;
                const tbody = document.querySelector('#dataSetFieldsTable tbody');
                tbody.innerHTML = `
                    <tr>
                        <td>Table Name <input type="hidden"></td>
                        <td><select id="tableNameSelector"><option value="42" selected>Users</option></select></td>
                    </tr>
                `;
                const result = mod.gatherFormData([]);
                expect(result.DataSetFieldValues).toContainEqual({ FieldID: 3, Value: '42' });
            });

            test('should scrape folder field value', () => {
                mod.currentDataSourceTypeID = 3;
                const tbody = document.querySelector('#dataSetFieldsTable tbody');
                tbody.innerHTML = `
                    <tr>
                        <td>Folder Name <input type="hidden"></td>
                        <td><select id="tableNameSelector"><option value="MyFolder" selected>MyFolder</option></select></td>
                    </tr>
                `;
                const result = mod.gatherFormData([]);
                expect(result.DataSetFieldValues).toContainEqual({ FieldID: 6, Value: 'MyFolder' });
            });

            test('should handle unchecked IsActive', () => {
                document.getElementById('dataSetActive').checked = false;
                mod.currentDataSourceTypeID = 1;
                const result = mod.gatherFormData([]);
                expect(result.IsActive).toBe(false);
            });
        });

        // =====================================================================
        // getFromAPI Tests
        // =====================================================================
        describe('getFromAPI', () => {
            test('should return empty array when API returns null', async () => {
                mockApiResponse = null;
                const result = await mod.getFromAPI('TestAPI', {});
                expect(result).toEqual([]);
            });

            test('should handle paginated response', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{ id: 1 }, { id: 2 }],
                    PageCount: 1,
                    TotalCount: 2
                });
                const result = await mod.getFromAPI('TestAPI', {});
                expect(result).toEqual([{ id: 1 }, { id: 2 }]);
            });

            test('should fetch all pages for multi-page response', async () => {
                let callCount = 0;
                window.loomeApi.runApiRequest = jest.fn(() => {
                    callCount++;
                    if (callCount === 1) {
                        return Promise.resolve(JSON.stringify({
                            Results: [{ id: 1 }],
                            PageCount: 2
                        }));
                    } else {
                        return Promise.resolve(JSON.stringify({
                            Results: [{ id: 2 }],
                            PageCount: 2
                        }));
                    }
                });
                const result = await mod.getFromAPI('TestAPI', { page: 1 });
                expect(result).toEqual([{ id: 1 }, { id: 2 }]);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledTimes(2);
            });

            test('should handle non-paginated array response', async () => {
                mockApiResponse = [{ id: 1 }, { id: 2 }];
                const result = await mod.getFromAPI('TestAPI', {});
                expect(result).toEqual([{ id: 1 }, { id: 2 }]);
            });

            test('should wrap single object in array', async () => {
                mockApiResponse = { id: 1, name: 'Single Item' };
                const result = await mod.getFromAPI('TestAPI', {});
                expect(result).toEqual([{ id: 1, name: 'Single Item' }]);
            });

            test('should return empty array on error', async () => {
                window.loomeApi.runApiRequest = jest.fn(() => Promise.reject(new Error('API Error')));
                const result = await mod.getFromAPI('TestAPI', {});
                expect(result).toEqual([]);
            });

            test('should pass parameters to API', async () => {
                mockApiResponse = [];
                await mod.getFromAPI('TestAPI', { data_set_id: 123 });
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith('TestAPI', { data_set_id: 123 });
            });
        });

        // =====================================================================
        // getAllDataSets Tests
        // =====================================================================
        describe('getAllDataSets', () => {
            test('should call getFromAPI with correct parameters', async () => {
                mockApiResponse = JSON.stringify({ Results: [], PageCount: 1 });
                await mod.getAllDataSets();
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetDataSet',
                    expect.objectContaining({
                        page: 1,
                        pageSize: 100,
                        search: '',
                        activeStatus: 3
                    })
                );
            });

            test('should return data sets from API', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{ DataSetID: 1, Name: 'Test' }],
                    PageCount: 1
                });
                const result = await mod.getAllDataSets();
                expect(result).toEqual([{ DataSetID: 1, Name: 'Test' }]);
            });
        });

        // =====================================================================
        // getAllDataSources Tests
        // =====================================================================
        describe('getAllDataSources', () => {
            test('should call getFromAPI with correct parameters', async () => {
                mockApiResponse = JSON.stringify({ Results: [], PageCount: 1 });
                await mod.getAllDataSources();
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetDataSource',
                    expect.objectContaining({
                        page: 1,
                        pageSize: 100,
                        search: ''
                    })
                );
            });

            test('should return data sources from API', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{ DataSourceID: 1, Name: 'SQL Server' }],
                    PageCount: 1
                });
                const result = await mod.getAllDataSources();
                expect(result).toEqual([{ DataSourceID: 1, Name: 'SQL Server' }]);
            });
        });

        // =====================================================================
        // fetchSQLDataSetColumns Tests
        // =====================================================================
        describe('fetchSQLDataSetColumns', () => {
            test('should call API with data_set_id and pagination params', async () => {
                mockApiResponse = JSON.stringify({ Results: [], PageCount: 1 });
                await mod.fetchSQLDataSetColumns(123, 2);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetColumnsDataByDataSetID',
                    expect.objectContaining({
                        data_set_id: 123,
                        page: 2,
                        pageSize: 10
                    })
                );
            });

            test('should default to page 1', async () => {
                mockApiResponse = JSON.stringify({ Results: [], PageCount: 1 });
                await mod.fetchSQLDataSetColumns(123);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetColumnsDataByDataSetID',
                    expect.objectContaining({ page: 1 })
                );
            });

            test('should return columns data', async () => {
                mockApiResponse = JSON.stringify({
                    Results: [{ ColumnName: 'id', ColumnType: 'int' }],
                    PageCount: 1
                });
                const result = await mod.fetchSQLDataSetColumns(123);
                expect(result).toEqual([{ ColumnName: 'id', ColumnType: 'int' }]);
            });
        });

        // =====================================================================
        // fetchDataSetFieldValue Tests
        // =====================================================================
        describe('fetchDataSetFieldValue', () => {
            test('should return null values for new data set', async () => {
                const result = await mod.fetchDataSetFieldValue('new');
                expect(result).toEqual({ id: null, name: null });
            });

            test('should return null values when API returns empty', async () => {
                mockApiResponse = [];
                const result = await mod.fetchDataSetFieldValue(123);
                expect(result).toEqual({ id: null, name: null });
            });

            test('should fetch table name for FieldID 3', async () => {
                // First call returns field value
                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([{ FieldID: 3, Value: '42' }])
                    .mockResolvedValueOnce([{ Id: 42, TableName: 'Users' }]);
                
                const result = await mod.fetchDataSetFieldValue(123);
                expect(result).toEqual({ id: 42, name: 'Users' });
            });

            test('should return direct value for other FieldIDs', async () => {
                mockApiResponse = [{ FieldID: 6, Value: 'MyFolder' }];
                const result = await mod.fetchDataSetFieldValue(123);
                expect(result).toEqual({ id: null, name: 'MyFolder' });
            });
        });

        // =====================================================================
        // fetchDataSetFolderValue Tests
        // =====================================================================
        describe('fetchDataSetFolderValue', () => {
            test('should return null values for new data set', async () => {
                const result = await mod.fetchDataSetFolderValue('new');
                expect(result).toEqual({ id: null, name: null });
            });

            test('should return folder name from API', async () => {
                mockApiResponse = [{ FieldID: 6, Value: 'Documents' }];
                const result = await mod.fetchDataSetFolderValue(123);
                expect(result).toEqual({ id: null, name: 'Documents' });
            });

            test('should return null when API returns empty', async () => {
                mockApiResponse = [];
                const result = await mod.fetchDataSetFolderValue(123);
                expect(result).toEqual({ id: null, name: null });
            });
        });

        // =====================================================================
        // fetchLoomeDataSourceTablesByTableId Tests
        // =====================================================================
        describe('fetchLoomeDataSourceTablesByTableId', () => {
            test('should call API with table_id parameter', async () => {
                mockApiResponse = [];
                await mod.fetchLoomeDataSourceTablesByTableId(42);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetLoomeDataSourceTablesByTableId',
                    { table_id: 42 }
                );
            });

            test('should return table data', async () => {
                mockApiResponse = [{ Id: 42, TableName: 'Users', ColumnList: 'id,name' }];
                const result = await mod.fetchLoomeDataSourceTablesByTableId(42);
                expect(result).toEqual([{ Id: 42, TableName: 'Users', ColumnList: 'id,name' }]);
            });
        });

        // =====================================================================
        // formatSQLColumnsFromSchema Tests
        // =====================================================================
        describe('formatSQLColumnsFromSchema', () => {
            test('should format columns from schema correctly', async () => {
                mockApiResponse = [{
                    Id: 1,
                    TableName: 'Users',
                    ColumnList: 'id, name, email',
                    ColumnTypes: 'int, varchar, varchar'
                }];
                const result = await mod.formatSQLColumnsFromSchema(1);
                expect(result.length).toBe(3);
                expect(result[0]).toEqual(expect.objectContaining({
                    ColumnName: 'id',
                    ColumnType: 'int',
                    DisplayOrder: 1
                }));
            });

            test('should return empty array when no schema data', async () => {
                mockApiResponse = [];
                const result = await mod.formatSQLColumnsFromSchema(999);
                expect(result).toEqual([]);
            });

            test('should return empty array on column count mismatch', async () => {
                mockApiResponse = [{
                    ColumnList: 'id, name',
                    ColumnTypes: 'int'
                }];
                const result = await mod.formatSQLColumnsFromSchema(1);
                expect(result).toEqual([]);
            });

            test('should set default values for optional fields', async () => {
                mockApiResponse = [{
                    ColumnList: 'id',
                    ColumnTypes: 'int'
                }];
                const result = await mod.formatSQLColumnsFromSchema(1);
                expect(result[0].LogicalColumnName).toBe('');
                expect(result[0].BusinessDescription).toBe('');
                expect(result[0].Tokenise).toBe(false);
                expect(result[0].Redact).toBe(false);
            });

            test('should handle API error gracefully', async () => {
                window.loomeApi.runApiRequest = jest.fn(() => Promise.reject(new Error('API Error')));
                const result = await mod.formatSQLColumnsFromSchema(1);
                expect(result).toEqual([]);
            });
        });

        // =====================================================================
        // fetchSubFolders Tests
        // =====================================================================
        describe('fetchSubFolders', () => {
            test('should call API with data_source_id parameter', async () => {
                mockApiResponse = [];
                await mod.fetchSubFolders(5);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetLoomeDataSourceFirstSubFolders',
                    { data_source_id: 5 }
                );
            });

            test('should return subfolder list', async () => {
                mockApiResponse = [
                    { FolderName: 'Documents' },
                    { FolderName: 'Images' }
                ];
                const result = await mod.fetchSubFolders(5);
                expect(result).toEqual([
                    { FolderName: 'Documents' },
                    { FolderName: 'Images' }
                ]);
            });
        });

        // =====================================================================
        // fetchSubFoldersWithFiles Tests
        // =====================================================================
        describe('fetchSubFoldersWithFiles', () => {
            test('should call API with subfolder name and data source ID', async () => {
                mockApiResponse = [];
                await mod.fetchSubFoldersWithFiles('Documents', 5);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetLoomeDataSourceSubFoldersWithFiles',
                    { sub_folder_name: 'Documents', data_source_id: 5 }
                );
            });

            test('should return files in subfolder', async () => {
                mockApiResponse = [
                    { FolderName: 'Documents', FileExtensions: 'pdf' },
                    { FolderName: 'Documents', FileExtensions: 'docx' }
                ];
                const result = await mod.fetchSubFoldersWithFiles('Documents', 5);
                expect(result.length).toBe(2);
            });
        });

        // =====================================================================
        // fetchSqlTables Tests
        // =====================================================================
        describe('fetchSqlTables', () => {
            test('should call API with data_source_id parameter', async () => {
                mockApiResponse = [];
                await mod.fetchSqlTables(3);
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'GetLoomeDataSourceTablesByDataSourceID',
                    { data_source_id: 3 }
                );
            });

            test('should return SQL tables list', async () => {
                mockApiResponse = [
                    { Id: 1, TableName: 'Users' },
                    { Id: 2, TableName: 'Orders' }
                ];
                const result = await mod.fetchSqlTables(3);
                expect(result).toEqual([
                    { Id: 1, TableName: 'Users' },
                    { Id: 2, TableName: 'Orders' }
                ]);
            });
        });

        // =====================================================================
        // renderTablePage Tests
        // =====================================================================
        describe('renderTablePage', () => {
            beforeEach(() => {
                mod.allColumnsData = Array(25).fill({}).map((_, i) => ({
                    DataSetColumnID: i + 1,
                    ColumnName: `col_${i + 1}`,
                    ColumnType: 'varchar'
                }));
                mod.currentPage = 1;
            });

            test('should render first page of data', () => {
                mod.renderTablePage(1);
                const rows = document.querySelectorAll('#dataSetColsBody tr');
                expect(rows.length).toBe(10);
            });

            test('should render correct page data', () => {
                mod.currentPage = 2;
                mod.renderTablePage(1);
                const firstRow = document.querySelector('#dataSetColsBody tr');
                expect(firstRow.innerHTML).toContain('col_11');
            });

            test('should render partial last page', () => {
                mod.currentPage = 3;
                mod.renderTablePage(1);
                const rows = document.querySelectorAll('#dataSetColsBody tr');
                expect(rows.length).toBe(5);
            });

            test('should render pagination controls', () => {
                mod.renderTablePage(1);
                const container = document.getElementById('pagination-controls');
                expect(container.innerHTML).toContain('of 3');
            });
        });

        // =====================================================================
        // createDataSet Tests
        // =====================================================================
        describe('createDataSet', () => {
            beforeEach(() => {
                mod.currentDataSourceTypeID = 1;
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            test('should call API with correct payload structure', async () => {
                mockApiResponse = { DataSetID: 123 };
                const data = { Name: 'Test', DataSourceID: 1 };
                await mod.createDataSet(data);
                
                expect(window.loomeApi.runApiRequest).toHaveBeenCalledWith(
                    'CreateDataSet',
                    expect.objectContaining({
                        payload: expect.objectContaining({
                            Name: 'Test',
                            DataSourceID: 1,
                            OptOutMessage: 'string',
                            OptOutList: 'string',
                            OptOutColumn: '-1',
                            DataSourceTypeID: 1
                        })
                    })
                );
            });

            test('should return API response on success', async () => {
                mockApiResponse = { DataSetID: 456 };
                const result = await mod.createDataSet({ Name: 'Test' });
                expect(result).toEqual({ DataSetID: 456 });
            });

            test('should throw error when API returns no response', async () => {
                mockApiResponse = null;
                await expect(mod.createDataSet({ Name: 'Test' })).rejects.toThrow('Failed to add dataset');
            });

            test('should show success toast on creation', async () => {
                mockApiResponse = { DataSetID: 1 };
                await mod.createDataSet({ Name: 'Test' });
                jest.advanceTimersByTime(100);
                const toast = document.querySelector('.toast-success');
                expect(toast).toBeTruthy();
            });
        });

        // =====================================================================
        // updateDataSet Tests
        // =====================================================================
        describe('updateDataSet', () => {
            beforeEach(() => {
                mod.currentDataSourceTypeID = 1;
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            test('should call API with data set ID and payload', async () => {
                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([]) // field values
                    .mockResolvedValueOnce([]) // meta values
                    .mockResolvedValueOnce({ success: true }); // update

                await mod.updateDataSet(123, { Name: 'Updated' });

                expect(window.loomeApi.runApiRequest).toHaveBeenLastCalledWith(
                    'UpdateDataSet',
                    expect.objectContaining({
                        id: 123,
                        payload: expect.objectContaining({
                            Name: 'Updated',
                            id: 123
                        })
                    })
                );
            });

            test('should preserve existing field values on update', async () => {
                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([{ FieldID: 3, Value: '42' }])
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce({ success: true });

                await mod.updateDataSet(123, { Name: 'Test' });

                const lastCall = window.loomeApi.runApiRequest.mock.calls[2];
                expect(lastCall[1].payload.DataSetFieldValues).toContainEqual({ FieldID: 3, Value: '42' });
            });

            test('should preserve existing metadata values on update', async () => {
                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([{ MetaDataID: 1, Value: 'tag123' }])
                    .mockResolvedValueOnce({ success: true });

                await mod.updateDataSet(123, { Name: 'Test' });

                const lastCall = window.loomeApi.runApiRequest.mock.calls[2];
                expect(lastCall[1].payload.DataSetMetaDataValues).toContainEqual({ MetaDataID: 1, Value: 'tag123' });
            });

            test('should throw error when API returns no response', async () => {
                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce(null);

                await expect(mod.updateDataSet(123, {})).rejects.toThrow('Failed to update dataset');
            });

            test('should group folder files by FolderName for folder type', async () => {
                mod.currentDataSourceTypeID = 3;
                const data = {
                    Name: 'Folder Test',
                    DataSetFolderFiles: [
                        { FolderName: 'Docs', FileType: 'pdf', FileDescription: 'PDFs' },
                        { FolderName: 'Docs', FileType: 'docx', FileDescription: 'Word' }
                    ]
                };

                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce({ success: true });

                await mod.updateDataSet(123, data);

                const lastCall = window.loomeApi.runApiRequest.mock.calls[2];
                expect(lastCall[1].payload.DataSetFolders).toBeDefined();
                expect(lastCall[1].payload.DataSetFolders[0].FolderName).toBe('Docs');
                expect(lastCall[1].payload.DataSetFolders[0].DataSetFolderFiles.length).toBe(2);
            });

            test('should show success toast on update', async () => {
                window.loomeApi.runApiRequest = jest.fn()
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce({ success: true });

                await mod.updateDataSet(123, { Name: 'Test' });
                jest.advanceTimersByTime(100);
                const toast = document.querySelector('.toast-success');
                expect(toast).toBeTruthy();
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

            test('should allow setting and getting allColumnsData', () => {
                mod.allColumnsData = [{ id: 1 }, { id: 2 }];
                expect(mod.allColumnsData).toEqual([{ id: 1 }, { id: 2 }]);
            });

            test('should allow setting and getting currentDataSourceTypeID', () => {
                mod.currentDataSourceTypeID = 3;
                expect(mod.currentDataSourceTypeID).toBe(3);
            });

            test('should allow setting and getting currentDataSourceID', () => {
                mod.currentDataSourceID = 42;
                expect(mod.currentDataSourceID).toBe(42);
            });
        });

    }); // End describe('manageDataSets.js')
} // End if (typeof describe === 'function')