// API Constants
const API_GET_COLUMNS_DATA = 'GetColumnsDataByDataSetID';
const API_GET_DATASOURCE_FOLDERS = 'GetLoomeDataSourceFolders';
const API_GET_DATASOURCE_TABLES = 'GetLoomeDataSourceTablesByDataSourceID';
const API_GET_DATASOURCE_TABLE_BY_ID = 'GetLoomeDataSourceTablesByTableId';
const API_GET_DATASET_FIELD_VALUE = 'GetDataSetFieldValuesByDataSetID';
const API_GET_DATASET_METADATA_VALUE = 'GetDataSetMetaDataValue';
const API_GET_DATASETS = 'GetDataSet';
const API_GET_DATASOURCES = 'GetDataSource';
const API_GET_DATASOURCE_BY_ID = 'GetDataSourceByID';
const API_CREATE_DATASET = 'CreateDataSet';
const API_UPDATE_DATASET = 'UpdateDataSet';
const API_CANCEL_DATASET = 'CancelDataSet';
const API_GET_DATASOURCE_SUBFOLDERS = 'GetLoomeDataSourceFirstSubFolders';
const API_GET_DATASOURCE_SUBFOLDERS_WITH_FILES = 'GetLoomeDataSourceSubFoldersWithFiles';
const API_GET_DATASET_FOLDERFILE = 'GetDataSetFolderFileByDataSetID';
const API_GET_REDCAP_DATA = 'SyncREDCapData';
const API_EXPORT_DATASET_COLUMNS_EXCEL = 'ExportDataSetColumnsToExcel';
const API_GET_METADATA = 'GetMetadata';
const API_VERIFY_UPLOAD_SHEET = 'VerifyUploadedSheet';

const API_GET_PORTAL_TOKEN = 'Portal - GetToken';
const API_GET_ASSET_BY_NAME = 'Portal - GetAssetByName';
const API_DELETE_ASSET_BY_ASSET_ID = 'Portal - DeleteByAssetId';

/**
 * Strips characters outside the safe whitelist to guard against injection.
 * Allowed: letters, digits, space, - _ , . ' ( ) ! ? : and standard whitespace.
 */
function sanitizeInput(value) {
    return (value || '').replace(/[^a-zA-Z0-9 \-_,.'()!?:\n\r\t]/g, '');
}

/** Returns true if the string contains any character outside the allowed whitelist. */
function containsInvalidChars(value) {
    return /[^a-zA-Z0-9 \-_,.'()!?:\n\r\t]/.test(value || '');
}

/**
 * Attaches a progressive character counter to an input/textarea.
 * The counter only appears when the user has used ≥80% of the character limit.
 */
function attachCharCounter(inputEl, max) {
    if (!inputEl || inputEl.dataset.charCounterAttached) return;
    inputEl.dataset.charCounterAttached = 'true';
    const counter = document.createElement('span');
    counter.style.cssText = 'font-size:0.75rem;float:right;display:none;margin-top:2px;';
    inputEl.insertAdjacentElement('afterend', counter);
    const threshold = Math.floor(max * 0.8);
    const update = () => {
        const len = inputEl.value.length;
        if (len >= threshold) {
            counter.textContent = `${len}/${max}`;
            counter.style.display = 'inline';
            counter.style.color = len >= max ? '#dc3545' : '#fd7e14';
        } else {
            counter.style.display = 'none';
        }
    };
    inputEl.addEventListener('input', update);
    update();
}

/**
 * Extracts a human-readable error message from an API response.
 * Handles: plain string, { detail: string }, { detail: [{field,message}] },
 * and top-level [{field,message}] arrays.
 */
function extractApiError(parsed) {
    if (!parsed) return null;
    if (Array.isArray(parsed)) {
        return parsed.map(e => e.message || e.field || JSON.stringify(e)).join('\n');
    }
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed.detail)) {
        return parsed.detail.map(e => e.message || e.field || JSON.stringify(e)).join('\n');
    }
    return null;
}

const pageSize = 10;
let currentPage = 1;
let dataSourceTypeMap = new Map();
let allColumnsData = [];
let filteredColumnsData = [];
let columnSearchTerm = '';
let columnRedactFilter = 'both';
let columnDeidentifyFilter = 'both';
let columnNameSortDirection = 'asc';
let columnVisibility = new Map();
let columnNameDropdownSearchTerm = '';
let currentDataSourceTypeID = 0;
let currentDataSourceID = 0;

// When set to true, programmatic changes to `selectionDropdown` should not
// trigger the normal change handler (which fetches DB values and would
// overwrite values supplied from an uploaded sheet).
let suppressSelectionChange = false;

/**
 * Displays a temporary "toast" notification on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of toast ('success', 'error', 'info').
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'success', duration = 5000) {
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
// Convert raw DB column types into a friendly label for display only.
// This does NOT mutate the original `ColumnType` value stored in objects.
//
// Unit comment (UI-only clarity):
// - `getDisplayColumnType(rawType)` returns a user-friendly label used only
//   for rendering in the table. It deliberately does NOT modify `rawType` or
//   any column object.
// - All persistence and DB/export operations read the canonical
//   `ColumnType` from the in-memory model (for example `allColumnsData`), so
//   changing the display label here will not affect database behavior.
function getDisplayColumnType(rawType) {
    if (!rawType && rawType !== 0) return '';
    const t = String(rawType).trim().toLowerCase();
    if (!t) return '';

    // Common mappings - adjust as needed
    const textTypes = ['varchar', 'nvarchar', 'char', 'text', 'nchar', 'longtext'];
    const intTypes = ['int', 'bigint', 'smallint', 'tinyint', 'integer'];
    const numTypes = ['float', 'double', 'decimal', 'numeric', 'real'];
    const dateTypes = ['date', 'datetime', 'timestamp', 'time'];
    const boolTypes = ['bit', 'boolean', 'bool'];

    // If the raw type contains a keyword (e.g. varchar(255)), check startsWith
    const base = t.split(/\s|\(|,|;/)[0];

    if (textTypes.includes(base)) return 'text';
    // Treat integer and numeric types the same for display purposes
    // so consumers see aa single 'number' label for all numeric columns.
    if (intTypes.includes(base) || numTypes.includes(base)) return 'number';
    if (dateTypes.includes(base)) return 'date/time';
    // Use a user-friendly literal label for boolean columns in the UI.
    // Display 'True/False' (capitalized) to match the sheet and validation text.
    if (boolTypes.includes(base)) return 'True/False';

    // Fallback: return the original raw string but normalized
    return rawType;
}

function displayColumnsTable(data, dataSetTypeId, emptyMessage = 'No columns to display. Select a Data Source or existing Data Set.') {
    const tableBody = document.getElementById('dataSetColsBody');

    if (!data || data.length === 0) {
        const headerRow = document.getElementById('dataSetColsHeader');
        const columnCount = headerRow ? headerRow.querySelectorAll('th').length || 6 : 6;
        const placeholderHtml = `
            <tr>
                <td colspan="${columnCount}" class="text-center text-muted">
                    ${emptyMessage}
                </td>
            </tr>`;
        tableBody.innerHTML = placeholderHtml;
        return;
    }

    // --- DATA EXISTS ---
    // Enforce mutual exclusivity: if both Redact and Deidentify are set, Redact takes priority.
    data.forEach(col => {
        if (col.Redact && col.Deidentify) {
            col.Deidentify = false;
        }
    });

    let rowsHtml = '';
    if (dataSetTypeId == 1) { // Database type

        rowsHtml = data.map((col, index) => `
            <tr data-id="${col.DataSetColumnID || col.ColumnName || index}" data-column-name="${col.ColumnName}">
                <td>${col.ColumnName || ''}</td>
                <td>${escapeHtml(getDisplayColumnType(col.ColumnType) || col.ColumnType || '')}</td>
                <td class="editable-cell" data-field="LogicalColumnName" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(col.LogicalColumnName || '')}">${col.LogicalColumnName || ''}</td>
                <td class="editable-cell" data-field="BusinessDescription" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(col.BusinessDescription || '')}">${col.BusinessDescription || ''}</td>
                <td class="editable-cell" data-field="ExampleValue" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(col.ExampleValue || '')}">${col.ExampleValue || ''}</td>
                <td class="checkbox-cell">
                    <input class="form-check-input editable-checkbox" type="checkbox" data-field="Redact" ${col.Redact ? 'checked' : ''}>
                </td>
                <td class="checkbox-cell">
                    <input class="form-check-input editable-checkbox" type="checkbox" data-field="Deidentify" ${col.Deidentify ? 'checked' : ''}>
                </td>
            </tr>
        `).join('');


    } else if (dataSetTypeId == 2) { // REDCap type
        // console.log("Data for REDCap columns:", data);
        rowsHtml = data.map((row) => {
            // For REDCap, always use ColumnName as the unique id
            return `
                <tr data-id="${row.ColumnName}" data-column-name="${row.ColumnName}">
                    <td>${row.ColumnName || ''}</td>
                    <td>${escapeHtml(getDisplayColumnType(row.ColumnType) || row.ColumnType || '')}</td>
                    <td class="editable-cell" data-field="LogicalColumnName" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(row.LogicalColumnName || '')}">${row.LogicalColumnName || ''}</td>
                    <td class="editable-cell" data-field="BusinessDescription" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(row.BusinessDescription || '')}">${row.BusinessDescription || ''}</td>
                    <td class="editable-cell" data-field="ExampleValue" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(row.ExampleValue || '')}">${row.ExampleValue || ''}</td>
                    <td class="checkbox-cell">
                        <input class="form-check-input editable-checkbox" type="checkbox" data-field="Redact" ${row.Redact ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input class="form-check-input editable-checkbox" type="checkbox" data-field="Deidentify" ${row.Deidentify ? 'checked' : ''}>
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
                const isDeidentified = col.Deidentify ? 1 : 0;  // Convert to 1/0

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
                                <input class="form-check-input editable-checkbox" type="checkbox" data-field="Deidentify" ${isDeidentified === 1 ? 'checked' : ''}>
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
                                <input class="form-check-input editable-checkbox" type="checkbox" data-field="Deidentify" ${isDeidentified === 1 ? 'checked' : ''}>
                            </td>
                        </tr>
                    `;
                }
            });
        });
    }

    tableBody.innerHTML = rowsHtml;
    updateColumnRowsVisibility();
}

function escapeHtml(value) {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAllColumnNames() {
    const names = Array.from(new Set(allColumnsData
        .map(col => (col?.ColumnName || '').trim())
        .filter(name => name !== '')));
    names.sort((a, b) => a.localeCompare(b));
    return names;
}

function buildColumnNameDropdownList(term = '') {
    const lowerTerm = (term || '').trim().toLowerCase();
    const names = getAllColumnNames().filter(name => {
        return !lowerTerm || name.toLowerCase().includes(lowerTerm);
    });

    if (names.length === 0) {
        return '<li class="text-muted small px-2">No columns match your search.</li>';
    }

    return names.map(name => {
        const safeName = escapeHtml(name);
        const encoded = encodeURIComponent(name);
        const isChecked = columnVisibility.get(name) !== false;
        return `
            <li data-column="${encoded}">
                <label>
                    <input type="checkbox" ${isChecked ? 'checked' : ''}>
                    <span>${safeName}</span>
                </label>
            </li>`;
    }).join('');
}

function refreshColumnVisibilityMap() {
    const existing = new Map(columnVisibility);
    columnVisibility = new Map();
    getAllColumnNames().forEach(name => {
        columnVisibility.set(name, existing.has(name) ? existing.get(name) : true);
    });
}

function updateColumnRowsVisibility() {
    document.querySelectorAll('#dataSetColsBody tr[data-column-name]').forEach(row => {
        const columnName = row.dataset.columnName || '';
        if (!columnName) return;
        if (columnVisibility.get(columnName) === false) {
            row.classList.add('d-none');
        } else {
            row.classList.remove('d-none');
        }
    });
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

function showColumnsLoader(message = 'Loading columns...') {
    const loader = document.getElementById('dataSetColsLoader');
    if (loader) {
        const textSpan = loader.querySelector('span');
        if (textSpan) {
            textSpan.textContent = message;
        }
        loader.classList.remove('d-none');
    }
}

function hideColumnsLoader() {
    const loader = document.getElementById('dataSetColsLoader');
    if (loader) {
        loader.classList.add('d-none');
    }
}

function normalizeBooleanFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (!trimmed || trimmed === '0' || trimmed === 'false') return false;
        return true;
    }
    return Boolean(value);
}

/**
 * Validate that uploaded DataSetColumns exactly match the expected columns.
 * - parsedCols: array of rows from DataSetColumns sheet (objects with ColumnName)
 * - metaRow: single metadata object parsed from DataSetMetadata sheet
 *
 * Returns: Promise<{ valid: boolean, message?: string, missing?: string[], extra?: string[], expected?: string[], actual?: string[] }>
 */
async function validateDataSetColumns(parsedCols, metaRow) {
    const actual = Array.isArray(parsedCols) ? parsedCols.map(c => String(c.ColumnName || '').trim()) : [];
    const dataSetId = metaRow && metaRow.DataSetID ? String(metaRow.DataSetID) : 'new';
    const dsType = Number(metaRow && metaRow.DataSourceTypeID  || 0);
    // console.log("DataSourceTypeID for validation:", dsType);
    let expected = [];

    try {
        if (dsType === 2) { // REDCap - crosscheck with REDCap source
            if (dataSetId === 'new') {
                if (!metaRow.DataSourceID) {
                    return { valid: false, message: 'DataSourceID required for REDCap crosscheck.' };
                }

                // console.log("REDCap New")

                // For NEW REDCap: call the REDCap sync endpoint to get expected columns
                // using existing helper; adapt if your endpoint differs.
                const rc = await syncREDCapDataSetColumns(parseInt(metaRow.DataSourceID, 10));
                // console.log("syncREDCapDataSetColumns returned:", rc);
                // syncREDCapDataSetColumns may return an object like { status, metadata }
                // where `metadata` is an array of fields with properties such as
                // 'field_name', 'field_label', 'field_type', 'select_choices_or_calculations'.
                // Accept either an array or the {metadata: []} shape and map robustly.
                let rcList = [];
                if (Array.isArray(rc)) {
                    rcList = rc;
                } else if (rc && Array.isArray(rc.metadata)) {
                    rcList = rc.metadata;
                }

                // console.log("REDCap sync returned metadata:", rcList);

                expected = Array.isArray(rcList)
                    ? rcList.map(r => String(
                        (r && r.field_name ) || ''
                      ).trim()).filter(Boolean)
                    : [];
                
                // console.log("Expected columns from REDCap sync:", expected);
            } else {
                // For EXISTING REDCap dataset: fetch expected columns via REDCap dataset endpoint
                // console.log("REDCap Existing - fetching columns for dataset ID:", dataSetId);
                const rcList = await fetchSQLorREDCAPDataSetColumns(dataSetId);
                // console.log("Fetched columns for existing REDCap dataset (raw response):", rcList);
                
                expected = Array.isArray(rcList)
                    ? rcList.map(r => String((r && r.ColumnName) || '').trim()).filter(Boolean)
                    : [];
                // console.log("Expected columns for existing REDCap dataset:", expected);
            }
        } else if (dsType === 1) { // Database
            if (dataSetId === 'new') {
                // NEW-Database: source of truth is dbo.LoomeDataSourceTables.Columns
                // Fetch the table list for this DataSource and extract ColumnList by using the DataSetFieldValues which refers to the Table 
               
                const validJsonString = metaRow.DataSetFieldValues.replace(/'/g, '"');
                const tableId = JSON.parse(validJsonString)[0]?.Value;
                
                // console.log("Extracted Table ID from DataSetFieldValues:", tableId);
                const tables = await fetchSqlTables(metaRow.DataSourceID) || [];
                
                const dataSetTable = tables.find(obj => obj.Id == tableId);
                const columnListStr = (dataSetTable && (dataSetTable.ColumnList || '')) || '';
                
                // console.log('dataSetTable:', dataSetTable);
                // console.log('columnListStr:', columnListStr);
                expected = columnListStr.split(',').map(s => String(s || '').trim()).filter(Boolean);
                // console.log('expected (from ColumnList):', expected);
            } else {
                // EXISTING-Database: source of truth is dbo.DataSetColumns (API)
                const colsList = await fetchSQLorREDCAPDataSetColumns(dataSetId) || [];
                // console.log('fetchSQLorREDCAPDataSetColumns returned for existing Database dataset ID', dataSetId);
                // console.log('Fetched columns for existing Database dataset:', colsList);
                expected = Array.isArray(colsList)
                    ? colsList.map(r => String((r && r.ColumnName) || '').trim()).filter(Boolean)
                    : [];
                // console.log('expected (from DataSetColumns):', expected);
            }
        } else {
            return { valid: false, message: 'Unknown DataSourceTypeID; cannot validate columns.' };
        }
    } catch (err) {
        return { valid: false, message: 'Failed to fetch expected columns: ' + (err && err.message ? err.message : String(err)) };
    }

    // Normalize and compare sets (case-insensitive, trimmed)
    const normalize = arr => Array.from(new Set((arr || []).map(s => String(s || '').trim().toLowerCase())));
    const actualNorm = normalize(actual);
    const expectedNorm = normalize(expected);
    // console.log('Normalized Actual Columns:', actualNorm);
    // console.log('Normalized Expected Columns:', expectedNorm);

    const missing = expectedNorm.filter(x => !actualNorm.includes(x));
    const extra = actualNorm.filter(x => !expectedNorm.includes(x));

    // console.log('Missing Columns:', missing);
    // console.log('Extra Columns:', extra);

    if (missing.length || extra.length) {
        return {
            valid: false,
            message: 'Uploaded columns do not match expected columns.',
            missing,
            extra,
            expected,
            actual
        };
    }

    // 5) Validate Tokenise and Redact values
    for (let i = 0; i < parsedCols.length; i++) {
        const row = parsedCols[i];
        const rowNum = i + 2; // +1 for 1-based index, +1 for header row
        // console.log(row)
        
        const isValidFlag = (val) => {
            if (typeof val === 'boolean') return true;
            if (typeof val === 'string') {
                const s = val.trim().toLowerCase();
                return s === 'true' || s === 'false';
            }
            if (typeof val === 'number') {
                return val === 1 || val === 0;
            }
            return false;
        };

        if (!isValidFlag(row.Deidentify)) {
            return {
                valid: false,
                message: `Row ${rowNum}: 'Deidentify' must be boolean (found '${row.Deidentify}')`
            };
        }
        if (!isValidFlag(row.Redact)) {
            return {
                valid: false,
                message: `Row ${rowNum}: 'Redact' must be boolean (found '${row.Redact}')`
            };
        }
    }

    return { valid: true };
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
        showToast(`Please enter a page number between 1 and ${totalPages}.`, "error");
                
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
    // console.log("Fetched Folder Value:", result.Value);

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
        // console.log("DataSource in Folder Selector:", dataSource);
        const folders = await fetchSubFolders(dataSource.DataSourceID);
        // console.log("Fetched folders:", folders);

        // Await the result from your function
        const fetchedData = await fetchDataSetFolderValue(dataSetID);
        // console.log("Fetched DataSet Field Value 2:", fetchedData);
        let folderId = fetchedData.id;
        let folderName = fetchedData.name;

        let rowHtml = '';
        if (dataSetID === "new" || !folderName) {
            const optionsHtml = folders.map(folder => `<option value="${folder.FolderName}">${folder.FolderName}</option>`).join('');
            rowHtml = `
            <tr>
                <td>Folder Name <input type="text" hidden="true"></td>
                <td width="70%">
                    <select id="tableNameSelector" class="form-control selectpicker bg-white" required style="border:2px solid #f97316;box-shadow:0 0 0 3px rgba(249,115,22,0.15);" onchange="var msg=this.closest('td').querySelector('.validation-message');if(this.value){this.style.border='';this.style.boxShadow='';msg.style.display='none';}else{this.style.border='2px solid #f97316';this.style.boxShadow='0 0 0 3px rgba(249,115,22,0.15)';msg.style.display='';}"> 
                        <option value="">Select a Folder</option>
                        ${optionsHtml}
                    </select>
                    <div class="validation-message" style="color:#f97316;font-size:0.8rem;margin-top:0.25rem;">⚠ A folder must be selected before saving.</div>
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
    // console.log("Fetched DataSet Field Value (as array):", resultsArray);
    if (!resultsArray || resultsArray.length === 0) {
        console.warn("API returned no data for data_set_id:", data_set_id);
        return { id: null, name: null }; // Return a default value
    }

    // --- KEY CHANGE: Get the first object from the array ---
    const result = resultsArray[0];
    // console.log("Fetched DataSet Field Value 1:", result);
    // console.log("Result FieldID:", result.FieldID);
    // If Field Value is a Table Name, the result is the ID of the table
    // Get the actual table name from another endpoint
    // Case 1: The value is a table ID, so we need to fetch the name
    if (result.FieldID == 3) {
        // console.log("FieldID indicates a table reference. Fetching table name...");
        const tableIdAsString = result.Value; // The value is a string, e.g., "9"

        // --- CONVERT TO INTEGER HERE ---
        const tableId = parseInt(tableIdAsString, 10);

        const tableInfo = await fetchLoomeDataSourceTablesByTableId(tableId);
        // console.log("Fetched Table Info:", tableId, tableInfo[0]);
        // Return an object with BOTH the ID and the fetched name
        return {
            id: tableId,
            name: tableInfo[0].TableName
        };

        // Case 2: The value is just a simple value, not a reference to another table
    } else {
        // console.log("FieldID indicates a direct value. Using value as-is.");
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
        // console.log("Fetched tables:", tables);

        const fetchedData = await fetchDataSetFieldValue(dataSetID);
        // console.log("Fetched DataSet Field Value 2:", fetchedData);
        let tableId = fetchedData.id;
        let tableName = fetchedData.name;

        let rowHtml = '';

        if (dataSetID === "new" || !tableId) {
            // Create the dropdown HTML with the fetched tables
            const optionsHtml = tables.map(table => `<option value="${table.Id}">${table.TableName}</option>`).join('');

            rowHtml = `
            <tr>
                <td>Table Name <input type="text" hidden="true"></td>
                <td width="70%">
                    <select id="tableNameSelector" class="form-control selectpicker bg-white" required style="border:2px solid #f97316;box-shadow:0 0 0 3px rgba(249,115,22,0.15);" onchange="var msg=this.closest('td').querySelector('.validation-message');if(this.value){this.style.border='';this.style.boxShadow='';msg.style.display='none';}else{this.style.border='2px solid #f97316';this.style.boxShadow='0 0 0 3px rgba(249,115,22,0.15)';msg.style.display='';}">
                        <option value="">Select a Table</option>
                        ${optionsHtml}
                    </select>
                    <div class="validation-message" style="color:#f97316;font-size:0.8rem;margin-top:0.25rem;">⚠ A table must be selected before saving.</div>
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

    // console.log("Updating fields for DataSource:", dataSource);

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

    // console.log("DataSourceTypeID:", dataSource.DataSourceTypeID);

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
// NOTE: Per recent refactor, individual metadata renderers were removed.
// Metadata rows are now created dynamically inside `updateMetaDataTable`.

/**
 * Renders two static rows with input fields for REDCap API metadata.
 */
// REDCap-specific static renderer removed. See `updateMetaDataTable`.


/**
 * Hides the metadata table and shows the placeholder text.
 */
// Folder-specific metadata renderer removed. See `updateMetaDataTable`.

async function updateMetaDataTable(dataSource, dataSetID) {
    const metaDataTable = document.getElementById('metaDataTable');
    const metaDataPlaceholder = document.getElementById('metaDataPlaceholder');
    const tbody = metaDataTable.querySelector('tbody');

    // Clear any old data
    tbody.innerHTML = '';

    // Guard: no data source selected
    if (!dataSource || !dataSource.DataSourceTypeID) {
        metaDataPlaceholder.style.display = 'block';
        metaDataTable.style.display = 'none';
        return;
    }

    // Basic visibility
    metaDataPlaceholder.style.display = 'none';
    metaDataTable.style.display = 'table';

    const initialParams = { "page": 1, "pageSize": 100, "search": '' };
    const results = await getFromAPI(API_GET_METADATA, initialParams) || [];

    // If editing an existing dataset, fetch existing metadata values first
    let existingMeta = [];
    if (dataSetID && dataSetID !== 'new') {
        try {
            existingMeta = await getFromAPI(API_GET_DATASET_METADATA_VALUE, { data_set_id: dataSetID }) || [];
        } catch (e) {
            console.error('Failed to fetch existing metadata values:', e);
            existingMeta = [];
        }
    }

    // Build metadata definitions dynamically from API `results`.
    // Each result has: MetaDataID, Name, Description, IsActive, DataSourceTypeIDs[]
    const allDefsById = (Array.isArray(results) ? results : []).reduce((acc, r) => {
        if (!r || r.MetaDataID === undefined) return acc;
        acc[String(r.MetaDataID)] = r;
        return acc;
    }, {});

    // Base defs: those currently associated with this DataSourceType and active
    const baseDefs = (Array.isArray(results) ? results : [])
        .filter(r => r && r.IsActive && Array.isArray(r.DataSourceTypeIDs) && r.DataSourceTypeIDs.some(id => String(id) === String(dataSource.DataSourceTypeID)))
        .map(r => ({
            id: r.MetaDataID,
            label: r.Name || `Meta ${r.MetaDataID}`,
            inputId: `meta_${r.MetaDataID}`,
            type: 'text',
            description: r.Description || '',
            legacy: false
        }));

    // If editing an existing dataset, include any metadata values that were previously assigned
    // even if the metadata is no longer associated with the current DataSourceType.
    const extraDefs = [];
    if (existingMeta && existingMeta.length > 0) {
        const baseIds = new Set(baseDefs.map(d => String(d.id)));
        existingMeta.forEach(mv => {
            const mid = String(mv.MetaDataID);
            if (!baseIds.has(mid)) {
                const metaDef = allDefsById[mid];
                // Even if not currently associated or active, show as legacy
                extraDefs.push({
                    id: metaDef ? metaDef.MetaDataID : parseInt(mid, 10),
                    label: `${metaDef ? metaDef.Name : `Meta ${mid}`} (legacy)`,
                    inputId: `meta_${mid}`,
                    type: 'text',
                    description: metaDef ? metaDef.Description : '',
                    legacy: true
                });
                baseIds.add(mid);
            }
        });
    }

    const defs = baseDefs.concat(extraDefs);

    if (!defs.length) {
        // No metadata fields for this type and nothing saved previously
        metaDataTable.style.display = 'none';
        metaDataPlaceholder.style.display = 'block';
        metaDataPlaceholder.textContent = 'No metadata fields for this data source type.';
        return;
    }

    // Build rows
    const rowsHtml = defs.map(def => {
        const found = existingMeta.find(m => String(m.MetaDataID) === String(def.id));
        const value = found ? (found.Value || '') : '';
        const safeValue = escapeHtml(value);
        const safeLabel = escapeHtml(def.label || `Meta ${def.id}`);
        const labelClass = def.legacy ? 'text-muted' : '';
        return `
            <tr>
                <td><small class="${labelClass}">${safeLabel}</small> <input type="hidden" value="${def.id}"></td>
                <td width="70%">
                    <input id="${def.inputId}" class="form-control" value="${safeValue}">
                </td>
            </tr>`;
    }).join('');

    tbody.innerHTML = rowsHtml;

    // Notify user of special characters on blur — does NOT auto-sanitize
    tbody.querySelectorAll('input.form-control').forEach(input => {
        input.addEventListener('blur', () => {
            if (containsInvalidChars(input.value)) {
                showToast('Special characters are not allowed in metadata fields.', 'error');
            }
        });
    });
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
            // console.log("API returned no data.");
            return [];
        }

        let allResults = []; // Initialize as an empty array for a clean state

        // --- DETECTION LOGIC ---
        if (parsedInitial.PageCount !== undefined && Array.isArray(parsedInitial.Results)) {

            // --- PAGINATED PATH ---
            // console.log("Detected a paginated response.");

            allResults = parsedInitial.Results;
            const totalPages = parsedInitial.PageCount;

            if (totalPages > 1) {
                for (let page = 2; page <= totalPages; page++) {
                    // console.log(`Fetching page ${page} of ${totalPages}...`);

                    // Construct params for the next page, preserving other initial params
                    const params = { ...initialParams, "page": page };
                    // console.log(params)
                    const response = await window.loomeApi.runApiRequest(API_ID, params);
                    const parsed = safeParseJson(response);

                    if (parsed && parsed.Results) {
                        allResults = allResults.concat(parsed.Results);
                    }

                } // end for loop
            }

        } else {
            // --- NON-PAGINATED PATH ---
            // console.log("Detected a non-paginated response.");

            if (Array.isArray(parsedInitial)) {
                allResults = parsedInitial;
            } else {
                allResults = [parsedInitial];
            }
        }

        // console.log(`Finished fetching for API ID ${API_ID}. Total items: ${allResults.length}`);
        return allResults;

    } catch (error) {
        console.error("An error occurred while fetching data source types:", error);
        return [];
    }
}

async function getAllDataSets() {
    const initialParams = { "page": 1, "pageSize": 100, "search": '', "activeStatus": 3 }; //Get both active and inactive Data Set
    return getFromAPI(API_GET_DATASETS, initialParams)
}

async function getAllDataSources() {
    const initialParams = { "page": 1, "pageSize": 100, "search": '', "activeStatus": 1 };
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
    if (!selectElement) return;

    // Clear all existing options first to avoid leftover/undefined options
    selectElement.innerHTML = '';

    // If data is not an array or empty, show a disabled placeholder saying no data
    if (!Array.isArray(data) || data.length === 0) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'No available Data Sources';
        placeholder.disabled = true;
        placeholder.selected = true;
        selectElement.appendChild(placeholder);
        return;
    }

    // Add the default prompt option
    const prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = 'Select a Data Source...';
    prompt.disabled = true;
    prompt.selected = true;
    selectElement.appendChild(prompt);

    // Append valid options from the provided data array, skipping invalid entries
    data.forEach(item => {
        if (!item) return;
        const val = item[valueField];
        // skip undefined/null values
        if (val === undefined || val === null) return;
        const option = document.createElement('option');
        option.value = String(val);
        option.textContent = item[textField] || '';
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
            "Deidentify": false,
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
    showColumnsLoader();
    try {
        const dataSetId = document.getElementById('dataSetSelection').value;
        let newColumnsData = []; // Default to an empty array

        if (dataSourceTypeId !== undefined && dataSourceTypeId !== null) {
            currentDataSourceTypeID = dataSourceTypeId;
        }

        if (dataSourceTypeId === 1) { // SQL Database Type
        // --- SCENARIO 1: Editing an EXISTING Data Set ---
        if (dataSetId && dataSetId !== 'new') {
            try {
                // console.log(`FETCHING columns for existing Data Set ID: ${dataSetId}...`);
                newColumnsData = await fetchSQLorREDCAPDataSetColumns(dataSetId);

                // console.log("newColumnsData:", newColumnsData)
            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
            }
        }
        // --- SCENARIO 2: Creating a NEW Data Set ---
        else if (dataSetId === 'new') {
            const tableNameSelector = document.getElementById('tableNameSelector');
            if (tableNameSelector && tableNameSelector.value && tableNameSelector.value !== '-1') {
                const tableId = tableNameSelector.value;
                // console.log(`FETCHING schema for new Data Set from Table ID: ${tableId}...`);
                newColumnsData = await formatSQLColumnsFromSchema(tableId);
            }
        }
    } else if (dataSourceTypeId === 2) { // REDCap Type
        // --- SCENARIO 1: Editing an EXISTING Data Set ---
        if (dataSetId && dataSetId !== 'new') {
            try {
                // console.log(`FETCHING columns for existing Data Set ID: ${dataSetId}...`);
                newColumnsData = await fetchSQLorREDCAPDataSetColumns(dataSetId);

                // console.log("newColumnsData:", newColumnsData)
            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
            }
        }
        // --- SCENARIO 2: Creating a NEW Data Set ---
        else if (dataSetId === 'new') {
            const redCapResult= await syncREDCapDataSetColumns(currentDataSourceID);
            const redCapResultStatus = redCapResult.status;
            const redCapColumns = redCapResult.metadata || [];
            // console.log(redCapColumns);

            // Supports this response shapes:
            // { status: 'success', metadata: [ { }, { }, ... ] }
            if (redCapResultStatus === 'success' && Array.isArray(redCapColumns) && redCapColumns.length > 0) {
                newColumnsData = redCapColumns.map((item, idx) => {
                    // item might be a string (column name) or an object with various properties
                    let columnName = '';
                    let columnType = '';
                    let logicalName = '';
                    let businessDesc = '';
                    let example = '';
                    let deidentify = false;
                    let tokenIdentifierType = 0;
                    let redact = false;

                    columnName = String(item.field_name).trim() || '';
                    businessDesc = String(item.field_label).trim() || '';
                    columnType = String(item.field_type).trim() || '';
                    logicalName =  String(item.field_name).trim() || '';
                    example = String(item.select_choices_or_calculations).trim() || '';
                    deidentify = normalizeBooleanFlag(item.Deidentify ?? item.deidentify ?? item.Deidentify ?? false);
                    tokenIdentifierType = item.TokenIdentifierType || item.token_identifier_type || 0;
                    redact = normalizeBooleanFlag(item.Redact ?? item.redact ?? false);
                    

                    return {
                        ColumnName: columnName,
                        ColumnType: columnType || "",
                        LogicalColumnName: logicalName,
                        BusinessDescription: businessDesc,
                        ExampleValue: example,
                        Deidentify: deidentify,
                        TokenIdentifierType: tokenIdentifierType,
                        Redact: redact,
                        DisplayOrder: idx + 1,
                        IsFilter: false
                    };
                });

            }  else {
                // console.log(`Error fetching columns for Data Set ID ${dataSetId}: Pull from REDCap server did not succeed`);
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
                Deidentify: item.Deidentify || 0
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

                // console.log("Mapped NEW Folder Columns Data: ", newColumnsData);
            }
        } else if (dataSetId && dataSetId !== 'new') {
            try {
                // 1. Fetch data for EXISTING set (SAVED data from DB)
                const fetchedData = await getFromAPI(API_GET_DATASET_FOLDERFILE, { "data_set_id": dataSetId });

                // 2. Apply the SAME consistent mapping
                newColumnsData = fetchedData.map(mapFolderData);

                // console.log("Fetched and Mapped EXISTING (saved) folder columns:", newColumnsData);

            } catch (error) {
                console.error(`Error fetching columns for Data Set ID ${dataSetId}:`, error);
            }
        }
    }


        // --- CRITICAL: Update the master state ---
        allColumnsData = newColumnsData || [];
        refreshColumnVisibilityMap();

        // Ensure the column-name dropdown initialization runs again after a fresh load
        // so the "Select All" checkbox and per-column checkboxes are enabled on first real populate.
        columnNameDropdownInitialized = false;

        // Reapply the search filter so pagination and table reflect the new data.
        applyColumnSearchFilter(dataSourceTypeId);

        // Rebuild the table header (and the column-name dropdown) now that columns are available.
        try {
            updateTableHeader(currentDataSourceTypeID);
        } catch (e) {
            console.warn('Failed to update table header after loading columns:', e);
        }
    } finally {
        hideColumnsLoader();
    }
}

/**
 * Renders the UI based on the current state of `allColumnsData` and `currentPage`.
 * This function DOES NOT fetch data.
 */
function renderTablePage(dataSetTypeId) {
    const sourceData = filteredColumnsData || [];
    const totalItems = sourceData.length;
    const normalizedTotalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (currentPage > normalizedTotalPages) {
        currentPage = normalizedTotalPages;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    // console.log(startIndex, endIndex)
    const pageData = sourceData.slice(startIndex, endIndex);
    // console.log("pageData: ", pageData, sourceData)

    const emptyMessage = columnSearchTerm.trim() && totalItems === 0
        ? 'No columns match your search term. Clear the search to view all columns.'
        : 'No columns to display. Select a Data Source or existing Data Set.';

    displayColumnsTable(pageData, dataSetTypeId, emptyMessage);

    // console.log(totalItems, pageSize, currentPage)
    renderPagination('pagination-controls', totalItems, pageSize, currentPage);
}

function applyColumnSearchFilter(dataSetTypeId = currentDataSourceTypeID) {
    const normalizedTerm = (columnSearchTerm || '').trim().toLowerCase();
    filteredColumnsData = allColumnsData.filter(column => {
        const columnName = (column?.ColumnName || '').toLowerCase();
        const matchesTerm = !normalizedTerm || columnName.includes(normalizedTerm);

        let matchesRedact = true;
        if (columnRedactFilter === 'yes') {
            matchesRedact = normalizeBooleanFlag(column?.Redact);
        } else if (columnRedactFilter === 'no') {
            matchesRedact = !normalizeBooleanFlag(column?.Redact);
        }

        let matchesDeidentify = true;
        if (columnDeidentifyFilter === 'yes') {
            matchesDeidentify = normalizeBooleanFlag(column?.Deidentify);
        } else if (columnDeidentifyFilter === 'no') {
            matchesDeidentify = !normalizeBooleanFlag(column?.Deidentify);
        }

        return matchesTerm && matchesRedact && matchesDeidentify;
    });

    if (columnNameSortDirection) {
        filteredColumnsData.sort((a, b) => {
            const aName = (a?.ColumnName || '').toLowerCase();
            const bName = (b?.ColumnName || '').toLowerCase();
            if (aName === bName) return 0;
            const comparison = aName < bName ? -1 : 1;
            return columnNameSortDirection === 'asc' ? comparison : -comparison;
        });
    }

    currentPage = 1;
    renderTablePage(dataSetTypeId);
    
    // Ensure export button state is refreshed whenever the table data changes
    if (typeof updateExportButtonState === 'function') {
        updateExportButtonState();
    }
}

/**
 * Validates email format
 * @param {string} email - The email to validate
 * @returns {boolean} True if email is valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Gathers all data from the form fields and tables into a structured object.
 * @returns {object} An object containing mainDetails and columns arrays.
 */
function gatherFormData(allColumnsData) {
    // --- Part A: Gather Main Form Details ---
    const rawName = document.getElementById('dataSetName').value;
    const rawDescription = document.getElementById('dataSetDescription').value;
    const mainDetails = {
        Name: sanitizeInput(rawName.trim()),
        _rawName: rawName.trim(),
        Description: sanitizeInput(rawDescription.trim()),
        _rawDescription: rawDescription.trim(),
        DataSourceID: parseInt(document.getElementById('dataSource').value, 10),
        Owner: document.getElementById('dataSetOwner').value.trim(),
        Approvers: document.getElementById('dataSetApprover').value.trim(),
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
        if (tableNameSelector && tableNameSelector.value) {
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

    var columns = allColumnsData;


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
        // console.log("Gathering form data for Folder type with columns:", columns);
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

    // console.log("Sending this payload to the API:", payload);

    try {
        // Send the new 'payload' object to the API instead of the original 'data'
        const response = await window.loomeApi.runApiRequest(API_CREATE_DATASET, { "payload": payload });
        if (!response) throw new Error("Failed to add dataset - no response from server");
        
        // Handle cases where the API returns an error object (e.g. HTTPException) instead of throwing
        const parsed = safeParseJson(response);
        const apiErr = extractApiError(parsed);
        if (apiErr) {
            const error = new Error(apiErr);
            error.detail = apiErr;
            error.response = response;
            throw error;
        }
        if (parsed && parsed.status && parsed.status >= 400) {
            const error = new Error(parsed.message || 'Server error');
            error.response = response;
            throw error;
        }

        return parsed;
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
                Deidentify: file.Deidentify ? 1 : 0,
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


    // console.log("Sending this payload to the API:", payload);


    try {
        // Send the new 'payload' object to the API
        const response = await window.loomeApi.runApiRequest(
            API_UPDATE_DATASET,
            { id: data_set_id, payload }
        );

        if (!response) throw new Error("Failed to update dataset - no response from server");

        // Handle cases where the API returns an error object (e.g. HTTPException) instead of throwing
        const parsed = safeParseJson(response);
        const apiErr = extractApiError(parsed);
        if (apiErr) {
            const error = new Error(apiErr);
            error.detail = apiErr;
            error.response = response;
            throw error;
        }
        if (parsed && parsed.status && parsed.status >= 400) {
            const error = new Error(parsed.message || 'Server error');
            error.response = response;
            throw error;
        }

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
    const headerDefinitions = {
        1: [
            { label: 'Column Name', sortKey: 'column-name' },
            { label: 'Column Type' },
            { label: 'Logical Name' },
            { label: 'Business Description' },
            { label: 'Example Value' },
            { label: 'Redact', filterType: 'redact' },
            { label: 'Deidentify', filterType: 'deidentify' }
        ],
        2: [
            { label: 'Column Name', sortKey: 'column-name' },
            { label: 'Column Type' },
            { label: 'Logical Name' },
            { label: 'Business Description' },
            { label: 'Example Value' },
            { label: 'Redact', filterType: 'redact' },
            { label: 'Deidentify', filterType: 'deidentify' }
        ],
        3: [
            { label: 'Folder Name' },
            { label: 'File Type' },
            { label: 'File Description' },
            { label: 'Redact', filterType: 'redact' },
            { label: 'Deidentify', filterType: 'deidentify' }
        ]
    };

    const headerRow = document.getElementById('dataSetColsHeader');
    if (!headerRow) {
        console.error("Error: Table header row with id 'dataSetColsHeader' not found.");
        return;
    }

    // Default to the Database header (key 1) when no valid dataSourceType is provided
    const definitions = headerDefinitions[dataSourceType] || headerDefinitions[1];

    const filterOptions = [
        { value: 'both', label: 'All Data' },
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
    ];

    const buildHeaderCell = (def) => {
        if (def.sortKey === 'column-name') {
            const arrow = columnNameSortDirection === 'desc' ? '▲' : '▼';
            const ariaLabel = columnNameSortDirection === 'desc' ? 'Sort ascending' : 'Sort descending';
            const listHtml = buildColumnNameDropdownList(columnNameDropdownSearchTerm);
            return `
                <th>
                    <details class="header-filter column-name-filter" data-filter="column-name">
                        <summary>
                            <span>${def.label}</span>
                            <span class="header-filter-arrow">▾</span>
                        </summary>
                        <div class="column-name-dropdown">
                            <div class="column-name-sort-row">
                                <button type="button" data-action="sort-asc" title="Sort A-Z">A-Z</button>
                                <button type="button" data-action="sort-desc" title="Sort Z-A">Z-A</button>
                                <span style="flex:1"></span>
                                
                            </div>
                          
                            <input type="search" class="column-name-dropdown-search" placeholder="Search columns" value="${escapeHtml(columnNameDropdownSearchTerm)}">
                            <div class="column-name-select-all">
                                <input type="checkbox" id="column-name-select-all">
                                <label for="column-name-select-all">Select All</label>
                            </div>
                            <ul class="column-name-dropdown-list">
                                ${listHtml}
                            </ul>
                        </div>
                    </details>
                </th>`;
        }

        if (!def.filterType) {
            return `<th>${def.label}</th>`;
        }

        const currentFilter = def.filterType === 'redact' ? columnRedactFilter : columnDeidentifyFilter;
        const displayLabel = currentFilter === 'both'
            ? def.label
            : `${def.label} (${currentFilter === 'yes' ? 'Yes' : 'No'})`;

        const optionsHtml = filterOptions.map(option => {
            const isActive = option.value === currentFilter ? ' aria-current="true"' : '';
            return `<li data-value="${escapeHtml(String(option.value))}"${isActive}>${escapeHtml(String(option.label))}</li>`;
        }).join('');

        return `
            <th style="${def.filterType === 'deidentify' ? 'min-width:115px;' : ''}position:relative;overflow:visible;">
                <details class="header-filter" data-filter="${def.filterType}">
                    <summary>
                        <span>${displayLabel}</span>
                        <span class="header-filter-arrow">▾</span>
                    </summary>
                    <ul style="position:absolute;z-index:1050;background:#fff;min-width:110px;box-shadow:0 4px 12px rgba(0,0,0,.15);border-radius:4px;padding:4px 0;margin:0;list-style:none;">
                        ${optionsHtml}
                    </ul>
                </details>
            </th>`;
    };

    const headerCells = definitions.map(buildHeaderCell).join('');
    headerRow.innerHTML = `<tr>${headerCells}</tr>`;
    setupColumnNameDropdownHandlers();
}

function attachColumnNameCheckboxListeners(listElement) {
    if (!listElement) return;
    listElement.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
            const li = input.closest('li[data-column]');
            if (!li) return;
            const encoded = li.dataset.column || '';
            if (!encoded) return;
            const columnName = decodeURIComponent(encoded);
            columnVisibility.set(columnName, input.checked);
            updateColumnRowsVisibility();
        });
    });
}

function setupColumnNameDropdownHandlers() {
    const container = document.querySelector('.column-name-filter');
    if (!container) return;
    const searchInput = container.querySelector('.column-name-dropdown-search');
    const list = container.querySelector('.column-name-dropdown-list');
    const selectAllCheckbox = container.querySelector('#column-name-select-all');
    const sortAscBtn = container.querySelector('[data-action="sort-asc"]');
    const sortDescBtn = container.querySelector('[data-action="sort-desc"]');

    const refreshList = () => {
        if (!list) return;
        list.innerHTML = buildColumnNameDropdownList(columnNameDropdownSearchTerm);
        attachColumnNameCheckboxListeners(list);
        // Update Select All state
        if (selectAllCheckbox) {
            const all = Array.from(list.querySelectorAll('li[data-column] input[type="checkbox"]'));
            const checked = all.filter(i => i.checked).length;
            selectAllCheckbox.checked = all.length > 0 && checked === all.length;
            selectAllCheckbox.indeterminate = checked > 0 && checked < all.length;
        }
    };

    if (searchInput) {
        searchInput.value = columnNameDropdownSearchTerm;
        searchInput.addEventListener('input', (event) => {
            columnNameDropdownSearchTerm = event.target.value;
            refreshList();
        });
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checked = !!e.target.checked;
            // apply to currently visible list items
            if (list) {
                list.querySelectorAll('li[data-column]').forEach(li => {
                    const encoded = li.dataset.column;
                    const name = decodeURIComponent(encoded || '');
                    columnVisibility.set(name, checked);
                    const cb = li.querySelector('input[type="checkbox"]');
                    if (cb) cb.checked = checked;
                });
            }
            updateColumnRowsVisibility();
        });
    }

    if (sortAscBtn) {
        sortAscBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            columnNameSortDirection = 'asc';
            applyColumnSearchFilter();
            // keep dropdown open and refresh the arrow
            updateTableHeader(currentDataSourceTypeID);
            setupColumnNameDropdownHandlers();
        });
    }

    if (sortDescBtn) {
        sortDescBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            columnNameSortDirection = 'desc';
            applyColumnSearchFilter();
            updateTableHeader(currentDataSourceTypeID);
            setupColumnNameDropdownHandlers();
        });
    }

    refreshList();
}

async function renderManageDataSetPage() {
    // Form input elements must be defined before running export logic
    const selectionDropdown = document.getElementById('dataSetSelection');
    const detailsContainer = document.getElementById('dataSetDetailsContainer');
    const optgroup = selectionDropdown.querySelector('optgroup');
    let dataSource = {};

    const nameInput = document.getElementById('dataSetName');
    const descriptionInput = document.getElementById('dataSetDescription');
    const dataSourceDrpDwn = document.getElementById('dataSource');
    const activeCheckbox = document.getElementById('dataSetActive');
    const owner = document.getElementById('dataSetOwner');
    const approver = document.getElementById('dataSetApprover');
    const dataSetFieldsTable = document.getElementById('dataSetFieldsTable');
    const submitButton = document.getElementById('submit-button');

    // Export button logic (now positioned after form elements)
    const exportBtn = document.getElementById('export-ds-cols-btn');
    const exportLoading = document.getElementById('export-ds-cols-loading');
    const uploadBtn = document.getElementById('upload-ds-cols-btn');
    const uploadInput = document.getElementById('upload-ds-cols-input');

    if (exportBtn) {
        
        function getCurrentDataSourceName() {
            const dsSelect = document.getElementById('dataSource');
            const selected = dsSelect?.options[dsSelect.selectedIndex];
            return selected ? selected.text : '';
        }

        function getTimestampString() {
            const now = new Date();
            return now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
        }

        async function createAndDownloadExcelFile() {
            const formData = gatherFormData(allColumnsData);
            if (!formData.Name || !formData.Owner || !formData.Approvers) {
                showToast('Please fill in Name, Owner, and Approver before exporting.', 'error');
                return;
            }

            const payload = {
                ...formData, // Spread all properties from the original object
                DataSetID: (selectionDropdown && selectionDropdown.value) ? selectionDropdown.value : 'new',
                OptOutMessage: null,
                OptOutList: null,
                OptOutColumn: "-1",
                DataSourceTypeID: currentDataSourceTypeID
            };
            
            // console.log("Export Payload:", payload);

            exportLoading.style.display = 'inline-block';
            exportBtn.disabled = true;

            try {
                const dataSourceName = getCurrentDataSourceName() || 'DataSource';
                const timestamp = getTimestampString();
                // XLSX files are ZIP archives internally; use .xlsx extension so Excel opens it.
                const filename = `DataSetColumns_${dataSourceName}_${timestamp}.xlsx`;

                // 1. Get the response (which is the Blob)
                const response = await window.loomeApi.runApiRequest(API_EXPORT_DATASET_COLUMNS_EXCEL, {
                    "payload": payload 
                });

                // console.log("--- DEBUG START ---");
                // console.log("Constructor:", response.constructor.name);
                // console.log("Keys:", Object.keys(response));
                // console.log("Full Object:", response);
                // console.log("Typeof:", typeof response);
                // console.log("--- DEBUG END ---");
                
                // 1. Get the base64 string from the object
                const base64String = response.fileData;

                // 2. Convert Base64 to a Blob
                const byteCharacters = atob(base64String);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const finalBlob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                // 3. Download
                const url = window.URL.createObjectURL(finalBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();

                // Cleanup
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                showToast('Dataset Columns exported successfully!');

            } catch (error) {
                console.error("Export Error:", error);
                showToast(error.message || 'Failed to export. Please try again.', 'error');
            } finally {
                exportLoading.style.display = 'none';
                updateExportButtonState();
            }
        }


        function updateExportButtonState() {
            const dsSelected = !!(selectionDropdown?.value && selectionDropdown.value !== '' && selectionDropdown.value !== 'new');
            const dataSourceSelected = !!(dataSourceDrpDwn?.value && dataSourceDrpDwn.value !== '');
            
            // For export visibility, we check for presence of data in either the table or the global array
            // since there might be race conditions between the state update and DOM rendering
            const tableRowsCount = document.querySelectorAll('#dataSetColsBody tr[data-column-name]').length;
            const stateRowsCount = (allColumnsData && allColumnsData.length) || 0;
            const tableHasRows = tableRowsCount > 0 || stateRowsCount > 0;

            // console.log("Checking export button state:", { dsSelected, dataSourceSelected, tableRowsCount, stateRowsCount });

            // Export: existing dataset OR a new dataset with imported/loaded columns
            const showExport = (dsSelected || dataSourceSelected) && tableHasRows;
            exportBtn.style.display = showExport ? '' : 'none';
            exportBtn.disabled = !tableHasRows;

            // Titles/help text
            exportBtn.title = tableHasRows ? 'Export columns and dataset info to Excel.' : 'Select a Data Source and ensure columns are loaded to enable export.';
            uploadBtn.title = dataSourceSelected ? 'Upload columns from an Excel file to create a new Data Set.' : 'Select a Data Source first to upload columns.';
        }

        dataSourceDrpDwn?.addEventListener('change', updateExportButtonState);
        // Also update when the top-level Data Set selection changes
        selectionDropdown?.addEventListener('change', updateExportButtonState);
        document.getElementById('dataSetColsBody').addEventListener('DOMSubtreeModified', updateExportButtonState);
        updateExportButtonState();
        exportBtn.addEventListener('click', createAndDownloadExcelFile);
        
        // Upload handling
        if (uploadBtn && uploadInput) {
            // Trigger file picker
            uploadBtn.addEventListener('click', () => uploadInput.click());

            uploadInput.addEventListener('change', async (event) => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;

                // 1) Validate extension (basic client-side check)
                const name = (file.name || '').toLowerCase();
                if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
                    showToast('Please choose an Excel file (.xls or .xlsx).', 'error');
                    uploadInput.value = '';
                    return;
                }

                // 2) Ensure SheetJS is available
                if (typeof XLSX === 'undefined') {
                    showToast('Spreadsheet parser not available. Ensure xlsx library is loaded.', 'error');
                    uploadInput.value = '';
                    return;
                }

                showColumnsLoader('Uploading and validating sheet...');

                // Read file as ArrayBuffer first so verification and local parsing
                // use the same bytes and we avoid a FileReader race condition.
                let arrayBuffer;
                try {
                    arrayBuffer = await file.arrayBuffer();
                } catch (err) {
                    console.error('Failed to read file as ArrayBuffer:', err);
                    showToast('Failed to read the file. Please try again.', 'error');
                    hideColumnsLoader();
                    uploadInput.value = '';
                    return;
                }

                // Convert ArrayBuffer to base64 for sending to verification API
                const arrayBufferToBase64 = (buffer) => {
                    const bytes = new Uint8Array(buffer);
                    const chunkSize = 0x8000;
                    let binary = '';
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                    }
                    return btoa(binary);
                };

                const base64String = arrayBufferToBase64(arrayBuffer);
                const payload = { fileData: base64String };

                // Wait for verification to complete before proceeding
                try {
                    const response = await window.loomeApi.runApiRequest(API_VERIFY_UPLOAD_SHEET, { "payload": payload });
                    // console.log('Verification response:', response);
                    const result = response;
                    if (!result || result.valid !== true) {
                        console.error('Tampering Detected:', result && result.message ? result.message : 'Unknown verification failure');
                        showToast((result && result.message) || 'Column validation failed.', 'error');
                        hideColumnsLoader();
                        uploadInput.value = '';
                        return;
                    }
                    // console.log('Verification successful:', result.message);
                } catch (error) {
                    console.error('Network or Parsing Error during verification:', error);
                    showToast('Could not verify file integrity. Please try again.', 'error');
                    hideColumnsLoader();
                    uploadInput.value = '';
                    return;
                }

                // Now parse the workbook using the same arrayBuffer we sent for verification
                try {
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

                    // 4) Validate sheet names
                    const requiredSheets = ['DataSetColumns', 'DataSetMetadata'];
                    const names = workbook.SheetNames || [];
                    const missing = requiredSheets.filter(s => !names.includes(s));
                    if (missing.length) {
                        showToast(`Missing required sheets: ${missing.join(', ')}`, 'error');
                        hideColumnsLoader();
                        uploadInput.value = '';
                        return;
                    }

                    // 5) Validate headers exactly as specified
                    const colsSheet = workbook.Sheets['DataSetColumns'];
                    const metaSheet = workbook.Sheets['DataSetMetadata'];
                    const colsRows = XLSX.utils.sheet_to_json(colsSheet, { header: 1, defval: '' });
                    const metaRows = XLSX.utils.sheet_to_json(metaSheet, { header: 1, defval: '' });

                    const expectedColsHeader = ['ColumnName','ColumnType','LogicalColumnName','BusinessDescription','ExampleValue','Redact','Deidentify']; //,'TokenIdentifierType', 'DisplayOrder','IsFilter'
                    const expectedMetaHeader = ['Name','Description','DataSourceID','IsActive','Approvers','OptOutMessage','OptOutList','Owner','OptOutColumn','DataSetFieldValues','DataSetMetaDataValues','DataSetFolders','DataSetFolderFiles','DataSourceTypeID','DataSetID', '_VerificationHash'];

                    const actualColsHeader = (colsRows[0] || []).map(c => String(c).trim());
                    const actualMetaHeader = (metaRows[0] || []).map(c => String(c).trim());

                    const arrayEquals = (a, b) => {
                        if (!Array.isArray(a) || !Array.isArray(b)) return false;
                        if (a.length !== b.length) return false;
                        for (let i = 0; i < a.length; i++) {
                            if (String(a[i]) !== String(b[i])) return false;
                        }
                        return true;
                    };

                    if (!arrayEquals(actualColsHeader, expectedColsHeader)) {
                        showToast('Invalid header in DataSetColumns sheet. Ensure columns match the required header and order.', 'error');
                        hideColumnsLoader();
                        uploadInput.value = '';
                        return;
                    }

                    if (!arrayEquals(actualMetaHeader, expectedMetaHeader)) {
                        showToast('Invalid header in DataSetMetadata sheet. Ensure columns match the required header and order.', 'error');
                        hideColumnsLoader();
                        uploadInput.value = '';
                        return;
                    }

                    // Success - parse and import rows into UI
                    const parsedCols = XLSX.utils.sheet_to_json(colsSheet, { header: expectedColsHeader, range: 1, defval: '' });
                    const parsedMeta = XLSX.utils.sheet_to_json(metaSheet, { header: expectedMetaHeader, range: 1, defval: '' });

                    // Enforce exactly one metadata row
                    if (!Array.isArray(parsedMeta) || parsedMeta.length !== 1) {
                        showToast('DataSetMetadata must contain exactly one data row.', 'error');
                        hideColumnsLoader();
                        uploadInput.value = '';
                        return;
                    }
                    
                    // Validate column data against expected types and required fields before importing
                    const metaRow = (Array.isArray(parsedMeta) && parsedMeta.length) ? parsedMeta[0] : null;
                    const validation = await validateDataSetColumns(parsedCols, metaRow);
                    if (!validation.valid) {
                        console.warn('Upload validation failed:', validation);
                        // show detailed feedback to the user
                        showToast(validation.message || 'Column validation failed.', 'error');
                        // Optionally surface missing/extra in console or UI
                        // console.log('Column validation details:', validation);
                        hideColumnsLoader();
                        uploadInput.value = '';
                        return; // abort import
                    }

                    // Map and normalize column rows to the internal shape
                    const importedColumns = parsedCols.map((r, idx) => ({
                        DataSetColumnID: r.DataSetColumnID || null,
                        ColumnName: String(r.ColumnName || '').trim(),
                        ColumnType: r.ColumnType || '',
                        LogicalColumnName: r.LogicalColumnName || '',
                        BusinessDescription: r.BusinessDescription || '',
                        ExampleValue: r.ExampleValue || '',
                        Deidentify: normalizeBooleanFlag(r.Deidentify),
                        TokenIdentifierType: Number(r.TokenIdentifierType) || 0,
                        Redact: normalizeBooleanFlag(r.Redact),
                        DisplayOrder: Number(r.DisplayOrder) || (idx + 1),
                        IsFilter: normalizeBooleanFlag(r.IsFilter)
                    }));

                    // If metadata contains DataSourceTypeID/DataSourceID, set globals so header and behavior match
                    if (Array.isArray(parsedMeta) && parsedMeta.length > 0) {
                        const meta0 = parsedMeta[0];
                        const dsType = parseInt(meta0.DataSourceTypeID, 10);
                        const dsId = parseInt(meta0.DataSourceID, 10);
                        if (!Number.isNaN(dsType)) currentDataSourceTypeID = dsType;
                        if (!Number.isNaN(dsId)) currentDataSourceID = dsId;
                    }

                    // Update master state and refresh UI
                    allColumnsData = importedColumns;
                    refreshColumnVisibilityMap();
                    columnNameDropdownInitialized = false;
                    
                    // Populate form fields from metadata sheet
                    try {
                        const metaRow = (Array.isArray(parsedMeta) && parsedMeta.length) ? parsedMeta[0] : null;
                        if (metaRow) {
                            if (Object.prototype.hasOwnProperty.call(metaRow, 'Name')) nameInput.value = metaRow.Name || '';
                            if (Object.prototype.hasOwnProperty.call(metaRow, 'Description')) descriptionInput.value = metaRow.Description || '';
                            if (Object.prototype.hasOwnProperty.call(metaRow, 'Owner')) owner.value = metaRow.Owner || '';
                            if (Object.prototype.hasOwnProperty.call(metaRow, 'Approvers')) approver.value = metaRow.Approvers || '';
                            if (Object.prototype.hasOwnProperty.call(metaRow, 'IsActive')) {
                                activeCheckbox.checked = normalizeBooleanFlag(metaRow.IsActive);
                            }

                            // 1. Data Source Handling
                            if (Object.prototype.hasOwnProperty.call(metaRow, 'DataSourceID')) {
                                const dsIdFromSheet = metaRow.DataSourceID ? String(metaRow.DataSourceID) : '';
                                if (dsIdFromSheet) {
                                    let opt = Array.from(dataSourceDrpDwn.options).find(o => o.value === dsIdFromSheet);
                                    if (!opt) {
                                        opt = document.createElement('option');
                                        opt.value = dsIdFromSheet;
                                        opt.textContent = `Imported DataSource ${dsIdFromSheet}`;
                                        dataSourceDrpDwn.appendChild(opt);
                                    }
                                    dataSourceDrpDwn.value = dsIdFromSheet;
                                }
                            }

                            // 2. Data Set Selection handling (NO dispatchEvent here to prevent clearForm)
                            const dsIdFromMeta = metaRow.DataSetID ? String(metaRow.DataSetID) : 'new';
                            let selOpt = Array.from(selectionDropdown.options).find(o => o.value === dsIdFromMeta);
                            if (!selOpt) {
                                selOpt = document.createElement('option');
                                selOpt.value = dsIdFromMeta;
                                selOpt.textContent = metaRow.Name ? metaRow.Name : `Imported DataSet ${dsIdFromMeta}`;
                                const selOptGroup = selectionDropdown.querySelector('optgroup');
                                if (selOptGroup) selOptGroup.appendChild(selOpt); else selectionDropdown.appendChild(selOpt);
                            }
                            selectionDropdown.value = dsIdFromMeta;

                            // 3. Render Field/Meta tables and populate JSON values
                            const dsIdToUse = (Object.prototype.hasOwnProperty.call(metaRow, 'DataSourceID') && metaRow.DataSourceID) ? parseInt(metaRow.DataSourceID, 10) : currentDataSourceID;
                            const dsTypeToUse = (Object.prototype.hasOwnProperty.call(metaRow, 'DataSourceTypeID') && metaRow.DataSourceTypeID) ? parseInt(metaRow.DataSourceTypeID, 10) : currentDataSourceTypeID;
                            const tmpDataSource = { 
                                DataSourceID: dsIdToUse, 
                                DataSourceTypeID: dsTypeToUse 
                            };

                            try {
                                suppressSelectionChange = true; // Guard against recursive logic
                                await updateDataSetFieldsTable(tmpDataSource, dsIdFromMeta);
                                await updateMetaDataTable(tmpDataSource, dsIdFromMeta);

                                // Helper to handle your single-quoted strings from Excel
                                const parseSheetJson = (val) => {
                                    if (typeof val !== 'string' || !val.trim()) return val;
                                    try {
                                        const validJson = val.replace(/'/g, '"');
                                        return JSON.parse(validJson);
                                    } catch (e) { return val; }
                                };

                                // Populate Metadata values
                                let metaVals = parseSheetJson(metaRow.DataSetMetaDataValues);
                                if (Array.isArray(metaVals)) {
                                    const metaTbody = document.getElementById('metaDataTable').querySelector('tbody');
                                    const metaTable = document.getElementById('metaDataTable');
                                    const metaPlaceholder = document.getElementById('metaDataPlaceholder');

                                    // Ensure table is visible if we have values to show
                                    if (metaVals.length > 0) {
                                        metaTable.style.display = 'table';
                                        metaPlaceholder.style.display = 'none';
                                    }

                                    const existingTableIds = new Set(Array.from(metaTbody.querySelectorAll('input[type="hidden"]')).map(i => String(i.value)));
                                    
                                    // We need to fetch the metadata list to show names for extra/legacy items
                                    const allMetaDefs = await getFromAPI(API_GET_METADATA, { "page": 1, "pageSize": 100, "search": '' }) || [];
                                    const defMap = allMetaDefs.reduce((acc, r) => {
                                        if (r && r.MetaDataID !== undefined) acc[String(r.MetaDataID)] = r;
                                        return acc;
                                    }, {});

                                    metaVals.forEach(mv => {
                                        const mid = String(mv.MetaDataID);
                                        if (!existingTableIds.has(mid)) {
                                            const metaDef = defMap[mid];
                                            const row = document.createElement('tr');
                                            row.innerHTML = `
                                                <td><small class="text-muted">${escapeHtml(metaDef ? metaDef.Name : `Meta ${mid}`)} (legacy)</small> <input type="hidden" value="${mid}"></td>
                                                <td width="70%">
                                                    <input id="meta_${mid}" class="form-control" value="${escapeHtml(mv.Value || '')}">
                                                </td>
                                            `;
                                            metaTbody.appendChild(row);
                                            existingTableIds.add(mid);
                                        } else {
                                            const input = document.getElementById(`meta_${mid}`);
                                            if (input) {
                                                input.value = mv.Value || '';
                                                // If it's present in the table, make sure the row isn't hidden by "no metadata for type"
                                            }
                                        }
                                    });
                                }

                                // Populate DataSetFieldValues (e.g. Table Name selection)
                                let fieldVals = parseSheetJson(metaRow.DataSetFieldValues);
                                if (Array.isArray(fieldVals)) {
                                    fieldVals.forEach(fv => {
                                        if (fv.FieldID === 3 || fv.FieldID === 6) {
                                            const selector = document.getElementById('tableNameSelector');
                                            if (selector && fv.Value) {
                                                if (!Array.from(selector.options).some(o => o.value === String(fv.Value))) {
                                                    const opt = document.createElement('option');
                                                    opt.value = String(fv.Value); opt.textContent = String(fv.Value);
                                                    selector.appendChild(opt);
                                                }
                                                selector.value = String(fv.Value);
                                                selector.dispatchEvent(new Event('change'));
                                            }
                                        }
                                    });
                                }
                            } finally {
                                suppressSelectionChange = false;
                                
                                // Final UI Refresh: apply filter (which renders table) and update header
                                // We do this at the very end of the import to ensure all states (DataSourceID, etc)
                                // are fully applied so updateExportButtonState has correct context.
                                applyColumnSearchFilter();
                                if (typeof updateExportButtonState === 'function') {
                                    updateExportButtonState();
                                }
                                try { updateTableHeader(currentDataSourceTypeID); } catch (e) { /* ignore */ }
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to populate form from metadata sheet:', e);
                    }

                    showToast('Upload validated and imported successfully.', 'success');
                    // console.log('Imported columns:', importedColumns);
                    // console.log('Imported metadata rows:', parsedMeta);

                } catch (err) {
                    console.error('Failed to parse uploaded workbook:', err);
                    showToast('Failed to parse the Excel file. Ensure it is a valid workbook.', 'error');
                } finally {
                    hideColumnsLoader();
                    uploadInput.value = '';
                }
            });
        }
    }

    // Delete button handler: call delete API and show API detail on error
    const deleteBtn = document.getElementById('delete-button');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const selectedId = selectionDropdown ? selectionDropdown.value : null;
            if (!selectedId || selectedId === 'new') {
                showToast('Select an existing Data Set to delete.', 'error');
                return;
            }

            if (!confirm('Are you sure you want to delete this Data Set? This action cannot be undone.')) return;

            // --- Show "Deleting..." state ---
            const originalHtml = deleteBtn.innerHTML;
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Deleting…`;

            try {

                // These API calls update the Portal Catalogue list
                const datasetName = nameInput.value.trim();
                const dataSourceTypeLabels = { 1: 'Database', 2: 'REDCap', 3: 'Folder' };
                const dataSourceTypeLabel = dataSourceTypeLabels[currentDataSourceTypeID] || 'Dataset';
                const token = await window.loomeApi.runApiRequest(API_GET_PORTAL_TOKEN);
                const returnedAssets = await window.loomeApi.runApiRequest(API_GET_ASSET_BY_NAME, { 
                        assetName: datasetName,
                        entityTypes: dataSourceTypeLabel,
                        token: token.access_token
                    }
                );
                const asset = returnedAssets?.items?.[0];
                if (asset && asset.id) {
                    const deletedDataSet = await window.loomeApi.runApiRequest(API_DELETE_ASSET_BY_ASSET_ID, { 
                        assetId: asset.id, token: token.access_token 
                    });
                    // console.log('Deleted catalogue asset:', deletedDataSet);
                } else {
                    showToast(`No matching catalogue asset found for "${datasetName}" (${dataSourceTypeLabel}). Database was not modified.`, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalHtml;
                    return;
                }

                const params = { id: parseInt(selectedId, 10) };
                // Use the low-level runApiRequest so we can inspect error payloads directly
                // This API call updates the database
                const raw = await window.loomeApi.runApiRequest(API_CANCEL_DATASET, params);
                const parsed = safeParseJson(raw);

                // If the API responded with a detail message, treat it as an error
                if (parsed && parsed.detail) {
                    showToast(parsed.detail, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalHtml;
                    return;
                }


                // Some APIs may return a truthy success value or empty array; consider that success
                showToast('Data Set deleted successfully.', 'success');
                setTimeout(() => window.location.reload(), 700);
            } catch (err) {
                // Prefer API `detail` when available in thrown error objects
                let detailMsg = 'Failed to delete Data Set.';
                try {
                    if (err && typeof err === 'object') {
                        if (err.detail) detailMsg = err.detail;
                        else if (err.response) {
                            const parsed = safeParseJson(err.response);
                            detailMsg = parsed && parsed.detail ? parsed.detail : (err.message || JSON.stringify(err));
                        } else {
                            detailMsg = err.message || JSON.stringify(err);
                        }
                    } else if (typeof err === 'string') {
                        detailMsg = err;
                    }
                } catch (e) {
                    detailMsg = 'Failed to delete Data Set.';
                }
                showToast(detailMsg, 'error');
                // Restore button on failure so the user can retry
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = originalHtml;
            }
        });
    }

 

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
        // console.log("Form cleared for new data source.");
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

        // console.log("Form populated with:", dataSet, dataSource);
    }


    async function updateFormForSelection(allDataSets, allDataSources) {
        const selectedId = selectionDropdown.value;

        if (selectedId === 'new') {

            nameInput.disabled = false;
            nameInput.readOnly = false;
            descriptionInput.disabled = false;
            dataSourceDrpDwn.disabled = false;


            clearForm();
            // Clear global state so we don't reload previous columns when switching to 'new'
            currentDataSourceTypeID = null;
            currentDataSourceID = null;
            allColumnsData = [];
            filteredColumnsData = [];
            refreshColumnVisibilityMap();
            // Reset table header and pagination
            try { updateTableHeader(currentDataSourceTypeID); } catch (e) { /* ignore */ }
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
            
            let dataSource = allDataSources.find(dsrc => dsrc.DataSourceID == selectedDataSet.DataSourceID);
            submitButton.textContent = 'Save Data Set';
            submitButton.disabled = false;
            // The data source might be inactive and thus not included in the initial dropdown population. If it's not found, we should still fetch it to populate the form correctly.
            if (!dataSource) {
                // try fetching the single data source even if getAllDataSources() excluded inactive ones
                const fetched = await getFromAPI(API_GET_DATASOURCE_BY_ID, { data_source_id: selectedDataSet.DataSourceID });
                dataSource = Array.isArray(fetched) && fetched.length ? fetched[0] : null;
                const option = document.createElement('option');
                option.value = String(dataSource.DataSourceID);
                option.textContent = dataSource.Name + (dataSource.IsActive ? '' : ' (Inactive)');
                dataSourceDrpDwn.appendChild(option);

                submitButton.disabled = true;
                submitButton.textContent = 'Saving Disabled';
                showToast('This dataset is based on an inactive data source. It is not available for requests or edits. Please contact the platform administrator for assistance.', 'error');
            }

            // The data source might still be missing if the API call failed or if the ID is invalid. In that case, we should log a warning and avoid trying to populate the form with undefined data.
            if (!dataSource) {
                console.warn('Data source not found for dataset', selectedDataSet.DataSourceID);
                return;
            }

            // console.log("Selected Data Set and Data Source:", selectedDataSet, dataSource);
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

    // Toggle visibility of the delete button based on whether an existing Data Set is selected
    function updateDeleteButtonState() {
        if (!deleteBtn) return;
        const selected = selectionDropdown ? selectionDropdown.value : 'new';
        deleteBtn.style.display = (selected && selected !== 'new') ? '' : 'none';
    }



    // Add the 'async' keyword to the function that wraps this logic.
    // For example, if it's inside a DOMContentLoaded listener:
    document.addEventListener('DOMContentLoaded', async () => {

        attachCharCounter(document.getElementById('dataSetName'), 100);
        attachCharCounter(document.getElementById('dataSetDescription'), 700);

        try {
            // 1. Use 'await' to wait for the data to arrive.
            // The code will pause here until getAllDataSources() resolves.
            let allDataSets = await getAllDataSets();
            let allDataSources = await getAllDataSources();

            // 2. Now, allResults is the actual array of data.
            // console.log('Data has arrived:', allDataSets);

            // 3. The rest of your code can now run in the correct order.
            populateExistingDataSets(optgroup, allDataSets);
            populateDataSourceOptions(dataSourceDrpDwn, allDataSources, 'DataSourceID', 'Name');

            // Create the Empty Columns Table
            await updateFormForSelection(allDataSets, allDataSources);
            // Ensure delete button visibility is correct after initial selection population
            try { updateDeleteButtonState(); } catch (e) { /* ignore */ }
            // Ensure export button is recalculated after initial population
            try { if (typeof updateExportButtonState === 'function') updateExportButtonState(); } catch (e) { /* ignore */ }


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
                try { if (typeof updateExportButtonState === 'function') updateExportButtonState(); } catch (e) { /* ignore */ }


            });

            // Listener for TOP-LEVEL data set selection
            selectionDropdown.addEventListener('change', async () => {
                if (suppressSelectionChange) return;

                // Always fetch fresh data on selection
                allDataSets = await getAllDataSets();
                allDataSources = await getAllDataSources();
                await updateFormForSelection(allDataSets, allDataSources);
                await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
                try { updateDeleteButtonState(); } catch (e) { /* ignore */ }
                try { if (typeof updateExportButtonState === 'function') updateExportButtonState(); } catch (e) { /* ignore */ }
            });

            // Listener for TABLE NAME dropdown
            dataSetFieldsTable.addEventListener('change', async (event) => {
                if (event.target.id === 'tableNameSelector') {
                    // Always load the FIRST page when the table changes
                    //await updateColumnsForTable(1);
                    // console.log("Table Name Selector Changed");
                    await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
                    try { if (typeof updateExportButtonState === 'function') updateExportButtonState(); } catch (e) { /* ignore */ }

                }
            });

            const columnsSearchInput = document.getElementById('dataSetColumnsSearch');
            if (columnsSearchInput) {
                columnsSearchInput.addEventListener('input', () => {
                    columnSearchTerm = (columnsSearchInput.value || '').trim();
                    applyColumnSearchFilter();
                });
            }
            const columnsHeader = document.getElementById('dataSetColsHeader');
            if (columnsHeader) {
                columnsHeader.addEventListener('click', (event) => {
                    const sortButton = event.target.closest('[data-sort]');
                    if (sortButton) {
                        event.preventDefault();
                        event.stopPropagation();
                        if (sortButton.dataset.sort === 'column-name') {
                            columnNameSortDirection = columnNameSortDirection === 'asc' ? 'desc' : 'asc';
                            updateTableHeader(currentDataSourceTypeID);
                            applyColumnSearchFilter();
                        }
                        return;
                    }

                    const menuItem = event.target.closest('li[data-value]');
                    if (!menuItem) return;
                    const detail = menuItem.closest('details[data-filter]');
                    if (!detail) return;
                    const filterType = detail.dataset.filter;
                    const chosenValue = menuItem.dataset.value;

                    if (filterType === 'redact') {
                        columnRedactFilter = chosenValue;
                    } else if (filterType === 'deidentify') {
                        columnDeidentifyFilter = chosenValue;
                    } else {
                        return;
                    }

                    detail.removeAttribute('open');
                    updateTableHeader(currentDataSourceTypeID);
                    applyColumnSearchFilter();
                });
            }

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
                    const newValue = input.value.trim();
                    const field = cell.dataset.field;

                    // Reject special characters
                    if (containsInvalidChars(newValue)) {
                        showToast('Special characters are not allowed in this field.', 'error');
                        cell.innerHTML = originalText;
                        cell.title = originalText;
                        return;
                    }

                    // Reject values exceeding 500 characters
                    if (newValue.length > 500) {
                        showToast(`"${field === 'LogicalColumnName' ? 'Logical Name' : field === 'BusinessDescription' ? 'Business Description' : 'Example Value'}" exceeds 500 characters. Please shorten it.`, 'error');
                        cell.innerHTML = originalText;
                        cell.title = originalText;
                        return;
                    }

                    updateInMemoryData(cell.closest('tr'), field, newValue);
                    // Revert the cell to plain text
                    cell.innerHTML = newValue;
                    cell.title = newValue;
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
                    const row = target.closest('tr');

                    // Mutual exclusivity: Redact and Deidentify cannot both be checked
                    if (target.checked && (field === 'Redact' || field === 'Deidentify')) {
                        const oppositeField = field === 'Redact' ? 'Deidentify' : 'Redact';
                        const oppositeCheckbox = row.querySelector(`.editable-checkbox[data-field="${oppositeField}"]`);
                        if (oppositeCheckbox && oppositeCheckbox.checked) {
                            oppositeCheckbox.checked = false;
                            updateInMemoryData(row, oppositeField, 0);
                        }
                    }

                    const value = target.checked ? 1 : 0;
                    updateInMemoryData(row, field, value);
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

                // console.log(`Updating... ID: ${uniqueId}, Field: ${field}, New Value:`, value);

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
                    // console.log("✓ Updated successfully. Object now:", columnToUpdate);
                    // console.log("✓ Full allColumnsData:", allColumnsData);
                } else {
                    console.error("✗ Could not find matching object for uniqueId:", uniqueId);
                    console.error("Available objects:", allColumnsData.map(col => `${col.FolderName}-${col.FileType}`));
                }
            }



            // =================================================================
            //  SUBMIT DATASET DETAILS LOGIC
            // =================================================================

            const manageDataSetForm = document.getElementById('manageDataSetForm');

            // --- Confirmation modal elements ---
            const confirmModal = document.getElementById('confirm-save-modal');
            const confirmBody = document.getElementById('confirm-save-body');
            const confirmOkBtn = document.getElementById('confirm-save-ok-btn');
            const confirmCancelBtn = document.getElementById('confirm-save-cancel-btn');
            const confirmBackdrop = document.getElementById('confirm-save-backdrop');

            // Stash for the pending save so the confirm button can execute it
            let pendingSave = null;

            function showConfirmModal() { confirmModal.style.display = ''; }
            function hideConfirmModal() { confirmModal.style.display = 'none'; }

            function buildConfirmModalBody(columns) {
                const included = columns.filter(c => !c.Redact);
                const deidentified = columns.filter(c => c.Deidentify);
                const redacted = columns.filter(c => c.Redact);
                const nameKey = currentDataSourceTypeID === 3 ? 'FolderName' : 'ColumnName';
                const plural = (n) => n !== 1 ? 's' : '';

                const warningBanner = (redacted.length === 0 && deidentified.length === 0) ? `
                    <div style="display:flex;align-items:center;gap:0.75rem;padding:1rem;background:#fefce8;border:1px solid #fde68a;border-radius:0.5rem;">
                        <span style="font-size:1.25rem;">⚠️</span>
                        <p style="margin:0;font-size:0.875rem;color:#854d0e;">No columns are marked for <strong>Redact</strong> or <strong>Deidentify</strong>. The data will be saved as-is.</p>
                    </div>` : '';

                const buildSection = (items, label, headerBg, headerColor, badgeBg) => {
                    const count = items.length;
                    const badge = `<span style="display:inline-block;background:${badgeBg};color:#fff;font-size:0.75rem;font-weight:700;padding:0.1rem 0.5rem;border-radius:999px;margin-left:0.5rem;">${count}</span>`;

                    if (count === 0) {
                        return `
                            <div style="border:1px solid #e5e7eb;border-radius:0.5rem;overflow:hidden;">
                                <div style="padding:0.625rem 0.75rem;background:${headerBg};color:${headerColor};font-size:0.8125rem;font-weight:600;display:flex;align-items:center;">
                                    ${label} ${badge}
                                    <span style="margin-left:auto;font-size:0.75rem;font-weight:400;color:#9ca3af;font-style:italic;">None</span>
                                </div>
                            </div>`;
                    }

                    const rows = items.map(c => {
                        const name = c[nameKey] || 'Unknown';
                        const extra = currentDataSourceTypeID === 3 && c.FileType ? `<span style="color:#9ca3af;font-size:0.75rem;margin-left:0.5rem;">(${escapeHtml(c.FileType)})</span>` : '';
                        return `<tr><td style="padding:0.375rem 0.75rem;font-size:0.8125rem;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(name)}${extra}</td></tr>`;
                    }).join('');

                    return `
                        <div style="border:1px solid #e5e7eb;border-radius:0.5rem;overflow:hidden;">
                            <div onclick="(function(el){var b=el.nextElementSibling;var a=el.querySelector('[data-arrow]');if(b.style.display==='none'){b.style.display='block';a.textContent='▾';}else{b.style.display='none';a.textContent='▸';}})(this)"
                                 style="padding:0.625rem 0.75rem;background:${headerBg};color:${headerColor};font-size:0.8125rem;font-weight:600;display:flex;align-items:center;cursor:pointer;user-select:none;">
                                <span data-arrow style="margin-right:0.5rem;font-size:0.75rem;">▸</span>
                                ${label} ${badge}
                                <span style="margin-left:auto;font-size:0.75rem;font-weight:400;color:${headerColor};opacity:0.7;">Show details</span>
                            </div>
                            <div style="display:none;max-height:200px;overflow-y:auto;">
                                <table style="width:100%;"><tbody>${rows}</tbody></table>
                            </div>
                        </div>`;
                };

                return `
                    <div style="display:flex;flex-direction:column;gap:0.75rem;">
                        ${warningBanner}
                        ${buildSection(included, 'Included', '#f0fdf4', '#15803d', '#16a34a')}
                        ${buildSection(deidentified, 'Deidentified', '#eff6ff', '#1d4ed8', '#2563eb')}
                        ${buildSection(redacted, 'Redacted', '#fef2f2', '#b91c1c', '#dc2626')}
                    </div>`;
            }

            // Close modal on Cancel / backdrop click / Escape
            confirmCancelBtn.addEventListener('click', () => {
                hideConfirmModal();
                pendingSave = null;
                submitButton.disabled = false;
                submitButton.textContent = 'Save Data Set';
            });
            confirmBackdrop.addEventListener('click', () => {
                confirmCancelBtn.click();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && confirmModal.style.display !== 'none') {
                    confirmCancelBtn.click();
                }
            });

            // Confirm button — execute the stashed save
            confirmOkBtn.addEventListener('click', async () => {
                hideConfirmModal();
                if (typeof pendingSave === 'function') {
                    await pendingSave();
                    pendingSave = null;
                }
            });

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
                    // console.log("Form Data to Submit:", formData);
                    
                    // --- Client-side validation ---
                    if (containsInvalidChars(formData._rawName)) {
                        const msg = 'Special characters are not allowed in the Dataset Name.';
                        showToast(msg, 'error');
                        const err = new Error(msg); err.handled = true; throw err;
                    }
                    if (!formData.Name || !formData.Name.trim()) {
                        const msg = 'Data Set Name is required.';
                        showToast(msg, 'error');
                        const err = new Error(msg); err.handled = true; throw err;
                    }
                    if (containsInvalidChars(formData._rawDescription)) {
                        const msg = 'Special characters are not allowed in the Dataset Description.';
                        showToast(msg, 'error');
                        const err = new Error(msg); err.handled = true; throw err;
                    }

                    // Validate Owner field
                    if (!formData.Owner || formData.Owner.trim() === '') {
                        showToast('Owner email is required.', 'error');
                        throw new Error('Validation failed: Owner is required.');
                    }

                    if (!isValidEmail(formData.Owner)) {
                        showToast('Owner email is not in a valid format.', 'error');
                        throw new Error('Validation failed: Owner email format is invalid.');
                    }

                    // Validate Approver field
                    if (!formData.Approvers || formData.Approvers.trim() === '') {
                        showToast('Approver email is required.', 'error');
                        throw new Error('Validation failed: Approver is required.');
                    }

                    if (!isValidEmail(formData.Approvers)) {
                        showToast('Approver email is not in a valid format.', 'error');
                        throw new Error('Validation failed: Approver email format is invalid.');
                    }

                    // Validate special characters in column fields
                    const columnFieldLabels = { LogicalColumnName: 'Logical Name', BusinessDescription: 'Business Description', ExampleValue: 'Example Value' };
                    for (const col of allColumnsData) {
                        for (const [field, label] of Object.entries(columnFieldLabels)) {
                            if (containsInvalidChars(col[field])) {
                                const msg = `Special characters are not allowed in the "${label}" column (found in column "${col.ColumnName || col.FolderName || ''}"${col.FileType ? ' / ' + col.FileType : ''}).`;
                                showToast(msg, 'error');
                                const err = new Error(msg); err.handled = true; throw err;
                            }
                            if ((col[field] || '').length > 500) {
                                const rowNum = allColumnsData.indexOf(col) + 1;
                                const msg = `"${label}" in row ${rowNum} (column "${col.ColumnName || col.FolderName || ''}") exceeds the 500 character limit.`;
                                showToast(msg, 'error');
                                const err = new Error(msg); err.handled = true; throw err;
                            }
                        }
                    }

                    // Validate special characters in metadata fields
                    const metaInputs = document.querySelectorAll('#metaDataTable tbody input.form-control');
                    for (const input of metaInputs) {
                        if (containsInvalidChars(input.value)) {
                            const row = input.closest('tr');
                            const label = row ? (row.querySelector('td small')?.textContent?.trim() || 'Metadata') : 'Metadata';
                            const msg = `Special characters are not allowed in the "${label}" metadata field.`;
                            showToast(msg, 'error');
                            input.focus();
                            const err = new Error(msg); err.handled = true; throw err;
                        }
                    }

                    // Validate Data Set Field (Table/Folder selection) for types that require it
                    if (currentDataSourceTypeID === 1 || currentDataSourceTypeID === 3) {
                        const fieldLabel = currentDataSourceTypeID === 1 ? 'Table' : 'Folder';
                        const selector = document.getElementById('tableNameSelector');
                        if (!selector || !selector.value) {
                            const msg = `A ${fieldLabel} must be selected before saving.`;
                            showToast(msg, 'error');
                            const err = new Error(msg); err.handled = true; throw err;
                        }
                    }

                    // --- Show confirmation modal before saving ---
                    confirmBody.innerHTML = buildConfirmModalBody(allColumnsData);

                    // Stash the actual save as a function the Confirm button will call
                    pendingSave = async () => {
                        submitButton.disabled = true;
                        submitButton.textContent = 'Saving...';
                        try {
                            // 4. Determine if this is a CREATE or UPDATE operation
                            const dataSetId = document.getElementById('dataSetSelection').value;

                            if (dataSetId === 'new') {
                                // console.log("Creating new Data Set with payload:", formData);
                                const newDataSet = await createDataSet(formData);
                                const newDataSetId = newDataSet.DataSetID;
                                showToast('Data Set created successfully!');
                            } else {
                                // console.log(`Updating Data Set ID ${dataSetId} with payload:`, formData);
                                await updateDataSet(dataSetId, formData);
                                showToast('Dataset updated successfully!');
                            }

                            // Clear the forms
                            clearForm();
                            updateDataSetFieldsTable(null, null);
                            updateMetaDataTable(null, null);
                            displayColumnsTable(null);
                            populateExistingDataSets(optgroup, await getAllDataSets());

                        } catch (error) {
                            console.error('An error occurred during submission:', error);
                            let detailMsg = 'Failed to save the Data Set.';
                            try {
                                if (error && typeof error === 'object') {
                                    if (error.detail) detailMsg = error.detail;
                                    else if (error.response) {
                                        const parsed = safeParseJson(error.response);
                                        detailMsg = parsed && parsed.detail ? parsed.detail : (error.message || JSON.stringify(error));
                                    } else {
                                        detailMsg = error.message || JSON.stringify(error);
                                    }
                                } else if (typeof error === 'string') {
                                    detailMsg = error;
                                }
                            } catch (e) {
                                detailMsg = 'Failed to save the Data Set.';
                            }
                            showToast(detailMsg, 'error');
                        } finally {
                            submitButton.disabled = false;
                            submitButton.textContent = originalButtonText;
                        }
                    };

                    // Show the modal and return — save will happen via confirmOkBtn
                    showConfirmModal();
                    return;

                } catch (error) {
                    console.error('An error occurred during submission:', error);
                    if (!error.handled) {
                        let detailMsg = 'Failed to save the Data Set.';
                        try {
                            if (error && typeof error === 'object') {
                                if (error.detail) detailMsg = error.detail;
                                else if (error.response) {
                                    const parsed = safeParseJson(error.response);
                                    detailMsg = parsed && parsed.detail ? parsed.detail : (error.message || JSON.stringify(error));
                                } else {
                                    detailMsg = error.message || JSON.stringify(error);
                                }
                            } else if (typeof error === 'string') {
                                detailMsg = error;
                            }
                        } catch (e) {
                            detailMsg = 'Failed to save the Data Set.';
                        }
                        showToast(detailMsg, 'error');
                    }
                } finally {
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