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
const API_GET_REDCAP_DATA = 'SyncREDCapData';

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
async function fetchSQLorREDCAPDataSetColumns(data_set_id, page = 1) {
    // Add page and pageSize to the parameters sent to the API
    const params = {
        "data_set_id": data_set_id,
        "page": page,
        "pageSize": pageSize
    };

    // IMPORTANT: getFromAPI should return the single paginated object, not an array
    return getFromAPI(API_GET_COLUMNS_DATA, params);
}

// This gets the column names directly from the REDCap Server and not the TRE's Workflow database
async function syncREDCapDataSetColumns(data_source_id) {
    const initialParams = { "data_source_id": data_source_id };
    const result = await getFromAPI(API_GET_REDCAP_DATA, initialParams);
    return result[0];
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


    } else if (dataSetTypeId == 2) { // REDCap type
        console.log("Data for REDCap columns:", data);
        rowsHtml = data.map((row) => {
            // For REDCap, always use ColumnName as the unique id
            return `
                <tr data-id="${row.ColumnName}" data-column-name="${row.ColumnName}">
                    <td>${row.ColumnName || ''}</td>
                    <td class="editable-cell" data-field="LogicalColumnName">${row.LogicalColumnName || ''}</td>
                    <td class="editable-cell" data-field="BusinessDescription">${row.BusinessDescription || ''}</td>
                    <td class="editable-cell" data-field="ExampleValue">${row.ExampleValue || ''}</td>
                    <td class="checkbox-cell">
                        <input class="form-check-input editable-checkbox" type="checkbox" data-field="Redact" ${row.Redact ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input class="form-check-input editable-checkbox" type="checkbox" data-field="Tokenise" ${row.Tokenise ? 'checked' : ''}>
                    </td>
                </tr>
            `;
        }).join('');


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
                const fileExtension = col.FileType || col.FileExtensions || '';
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
    // const rowHtml = `
    //     <tr>
    //         <td>REDCap API Key <input type="text" hidden="true"></td>
    //         <td width="70%">
    //             <div class="container">
    //                 <div class="row">
    //                     <div class="col">
    //                         <input id="redcapapi" type="password" class="form-control valid">
    //                         <div class="validation-message"></div>
    //                     </div>
    //                     <div class="col col-lg-3">
    //                         <button id="redcapRefreshBtn" class="btn btn-accent float-right" title="RedCap">Refresh</button>
    //                     </div>
    //                 </div>
    //             </div>
    //         </td>
    //     </tr>`;

    const rowHtml = `
        <tr>
            <p class="text-muted">Not applicable for REDCap Data Sources</p>
        </tr>
    `;

    tbody.innerHTML = rowHtml;

    // Optional: Add an event listener to the new button
    // tbody.querySelector('#redcapRefreshBtn').addEventListener('click', () => {
    //     const apiKey = tbody.querySelector('#redcapapi').value;
    //     console.log(`Refresh button clicked! API Key: ${apiKey}`);
    //     showToast('Refresh clicked!');
    // });
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
async function renderRedcapApiKeyRowMetaData(tbody, dataSource, dataSetID) {
    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td>Citations for related publications <input type="hidden" value=5></td>
            <td width="70%">
                <input id="redcapCitations" class="form-control" value="Loading..." disabled>
            </td>
        </tr>
        <tr>
            <td>ANZCTR URL <input type="hidden" value=2></td>
            <td width="70%">
                <input id="redcapAnzctrUrl" class="form-control" value="Loading..." disabled>
            </td>
        </tr>
    `;

    // If new, just show empty fields
    if (!dataSetID || dataSetID === "new") {
        tbody.innerHTML = `
            <tr>
                <td>Citations for related publications <input type="hidden" value=5></td>
                <td width="70%">
                    <input id="redcapCitations" class="form-control" value="">
                </td>
            </tr>
            <tr>
                <td>ANZCTR URL <input type="hidden" value=2></td>
                <td width="70%">
                    <input id="redcapAnzctrUrl" class="form-control" value="">
                </td>
            </tr>
        `;
        return;
    }

    try {
        // Fetch metadata values for this dataset
        const metaValues = await getFromAPI(API_GET_DATASET_METADATA_VALUE, { "data_set_id": dataSetID });
        let citations = '';
        let anzctr = '';
        if (Array.isArray(metaValues)) {
            for (const mv of metaValues) {
                if (mv.MetaDataID == 5) citations = mv.Value || '';
                if (mv.MetaDataID == 2) anzctr = mv.Value || '';
            }
        }
        tbody.innerHTML = `
            <tr>
                <td>Citations for related publications <input type="hidden" value=5></td>
                <td width="70%">
                    <input id="redcapCitations" class="form-control" value="${citations}">
                </td>
            </tr>
            <tr>
                <td>ANZCTR URL <input type="hidden" value=2></td>
                <td width="70%">
                    <input id="redcapAnzctrUrl" class="form-control" value="${anzctr}">
                </td>
            </tr>
        `;
    } catch (error) {
        console.error("Failed to fetch REDCap metadata values:", error);
        tbody.innerHTML = `<tr><td colspan="2" class="text-danger">Error loading REDCap metadata fields.</td></tr>`;
    }
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
            renderRedcapApiKeyRowMetaData(tbody, dataSource, dataSetID);
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
 * Fetches the columns for a given Data Set ID and formats it into a standard array of column objects.
 */
async function fetchREDCapDataSetColumns(dataSetId) {
    try {
        const response = await window.loomeApi.runApiRequest(API_GET_DATASETS, { "DataSetID": dataSetId });
        const parsed = safeParseJson(response);

        if (parsed && parsed.Results) {
            return parsed.Results;
        }
    } catch (error) {
        console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
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
                newColumnsData = await fetchSQLorREDCAPDataSetColumns(dataSetId);

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
    } else if (dataSourceTypeId === 2) { // REDCap Type
        // --- SCENARIO 1: Editing an EXISTING Data Set ---
        if (dataSetId && dataSetId !== 'new') {
            try {
                console.log(`FETCHING columns for existing Data Set ID: ${dataSetId}...`);
                newColumnsData = await fetchSQLorREDCAPDataSetColumns(dataSetId);

                console.log("newColumnsData:", newColumnsData)
            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
            }
        }
        // --- SCENARIO 2: Creating a NEW Data Set ---
        else if (dataSetId === 'new') {
            const redCapColumns = await syncREDCapDataSetColumns(currentDataSourceID);
            console.log(redCapColumns);
            if (redCapColumns.status == "success") {
                newColumnsData = redCapColumns.columns_detected.map((colName, idx) => ({
                    ColumnName: colName,
                    ColumnType: "",
                    LogicalColumnName: "",
                    BusinessDescription: "",
                    ExampleValue: "",
                    Tokenise: false,
                    TokenIdentifierType: 0,
                    Redact: false,
                    DisplayOrder: idx + 1,
                    IsFilter: false
                }));
            } else {
                console.log(`Error fetching columns for Data Set ID ${dataSetId}: Pull from REDCap server did not succeed`);
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

                // Fetch data for NEW set
                const originalData = await fetchSubFoldersWithFiles(subFolderName, currentDataSourceID);

                // Apply the consistent mapping
                newColumnsData = originalData.map(mapFolderData);

                console.log("Mapped NEW Folder Columns Data: ", newColumnsData);
            }
        } else if (dataSetId && dataSetId !== 'new') {
            try {
                console.log(`FETCHING SAVED columns for existing Data Set ID: ${dataSetId}...`);

                // 1. Fetch data for EXISTING set (SAVED data from DB)
                const fetchedData = await (dataSetId); //NEED TO CHANGE THIS

                const originalData = await fetchSubFoldersWithFiles(subFolderName, currentDataSourceID);
                console.log("Original NEW Folder Columns Data: ", originalData);
                // Apply the consistent mapping
                newColumnsData = originalData.map(mapFolderData);

                console.log("Mapped NEW Folder Columns Data: ", newColumnsData);
            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
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
                metaData.push({
                    MetaDataID: parseInt(keyInput.value, 10),
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
    } else if (currentDataSourceTypeID === 2) {
        return {
            ...mainDetails,
            DataSetMetaDataValues: metaData,
            DataSetFieldValues: [],
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
        OptOutMessage: null,
        OptOutList: null,
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
        OptOutMessage: null,
        OptOutList: null,
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
        // Use values from the form (data) if present, otherwise fetch from DB
        if (currentDataSourceTypeID === 2) {
            payload.DataSetFieldValues = [];
        } else if (!payload.DataSetFieldValues || !Array.isArray(payload.DataSetFieldValues) || payload.DataSetFieldValues.length === 0) {
            const fieldValues = await getFromAPI(API_GET_DATASET_FIELD_VALUE, { "data_set_id": data_set_id });
            payload.DataSetFieldValues = Array.isArray(fieldValues)
                ? fieldValues.map(fv => ({ FieldID: fv.FieldID, Value: fv.Value }))
                : [];
        }

        if (!payload.DataSetMetaDataValues || !Array.isArray(payload.DataSetMetaDataValues) || payload.DataSetMetaDataValues.length === 0) {
            const metaValues = await getFromAPI(API_GET_DATASET_METADATA_VALUE, { "data_set_id": data_set_id });
            payload.DataSetMetaDataValues = Array.isArray(metaValues)
                ? metaValues.map(mv => ({ MetaDataID: mv.MetaDataID, Value: mv.Value }))
                : [];
        }
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

        // --- ALWAYS REFRESH DATASETS AND UI ---
        if (typeof getAllDataSets === 'function' && typeof getAllDataSources === 'function') {
            const selectionDropdown = document.getElementById('dataSetSelection');
            const dataSourceDrpDwn = document.getElementById('dataSource');
            const optgroup = selectionDropdown ? selectionDropdown.querySelector('optgroup') : null;
            // Force a fresh fetch by adding a cache-busting param (if supported)
            let allDataSets = await getAllDataSets();
            let allDataSources = await getAllDataSources();
            if (optgroup && allDataSets) populateExistingDataSets(optgroup, allDataSets);
            if (dataSourceDrpDwn && allDataSources) populateDataSourceOptions(dataSourceDrpDwn, allDataSources, 'DataSourceID', 'Name');

            // Always re-select and reload the updated dataset
            if (selectionDropdown) {
                selectionDropdown.value = data_set_id.toString();
                // Fetch again to ensure latest data (in case populateExistingDataSets uses stale data)
                allDataSets = await getAllDataSets();
                allDataSources = await getAllDataSources();
                const updatedDataSet = allDataSets.find(ds => ds.DataSetID == data_set_id);
                const updatedDataSource = updatedDataSet ? allDataSources.find(dsrc => dsrc.DataSourceID == updatedDataSet.DataSourceID) : null;
                if (updatedDataSet && updatedDataSource) {
                    if (typeof populateForm === 'function') populateForm(updatedDataSet, updatedDataSource);
                    if (typeof updateDataSetFieldsTable === 'function') await updateDataSetFieldsTable(updatedDataSource, data_set_id);
                    if (typeof updateMetaDataTable === 'function') updateMetaDataTable(updatedDataSource, data_set_id);
                    if (typeof updateTableHeader === 'function') updateTableHeader(updatedDataSource.DataSourceTypeID);
                    if (typeof loadColumnsData === 'function') await loadColumnsData(updatedDataSource.DataSourceTypeID, updatedDataSource.DataSourceID);
                }
            }
        }

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
        2: ['Column Name', 'Logical Name', 'Business Description', 'Example Value', 'Redact', 'Deidentify'],
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

async function renderManageDataSetPage() {

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
            console.log("Selected Data Set and Data Source:", selectedDataSet, dataSource);
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
                // Always fetch fresh data on selection
                allDataSets = await getAllDataSets();
                allDataSources = await getAllDataSources();
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

renderManageDataSetPage();