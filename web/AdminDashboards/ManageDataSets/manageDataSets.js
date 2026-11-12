import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator_bootstrap5.min.css';

// API Constants
const API_GET_COLUMNS_DATA = 'GetColumnsDataByDataSetID';
const API_GET_DATASOURCE_FOLDERS = 'GetLoomeDataSourceFolders';
const API_GET_DATASOURCE_TABLES = 'GetLoomeDataSourceTablesByDataSourceID';
const API_GET_DATASOURCE_TABLE_BY_ID = 'GetLoomeDataSourceTablesByTableId';
const API_GET_DATASET_FIELD_VALUE = 'GetDataSetFieldValuesByDataSetID';
const API_GET_DATASET_METADATA_VALUE = 'GetDataSetMetaDataValue';
const API_GET_DATASETS = 'GetDataSet';
const API_GET_DATASET_COLUMNS = 'GetDatasetIDColumns';
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
const API_GET_REQUESTS_BY_DATASET_ID = 'GetRequestByDataSetID';

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
let dataSourceTypeMap = new Map();
let allColumnsData = [];
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

// =================================================================
//  COLUMNS TABLE (Tabulator)
//  `allColumnsData` is the single source of truth; the table edits those objects in place.
// =================================================================

const COLUMNS_EMPTY_MESSAGE = 'No columns to display. Select a Data Source or existing Data Set.';
const EDITABLE_TEXT_LABELS = {
    LogicalColumnName: 'Logical Name',
    BusinessDescription: 'Business Description',
    ExampleValue: 'Example Value',
    FileDescription: 'File Description'
};

let columnsTable = null;
let columnsTableReady = false;

/** Pulls the table's rows back into `allColumnsData` so saves/exports always see the latest edits. */
function syncColumnsFromTable() {
    if (!columnsTable || !columnsTableReady) return;
    allColumnsData = columnsTable.getData();
}

function notifyColumnsDataChanged() {
    const el = document.getElementById('dataSetColsTable');
    if (el) el.dispatchEvent(new CustomEvent('columnsdatachange'));
}

function textCellFormatter(cell) {
    const value = cell.getValue() ?? '';
    const div = document.createElement('div');
    div.className = 'cell-text-wrap';
    div.textContent = value;
    cell.getElement().title = value;
    return div;
}

function textAreaEditor(cell, onRendered, success, cancel) {
    const field = cell.getField();
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control form-control-sm';
    textarea.rows = 3;
    textarea.style.width = '100%';
    textarea.value = cell.getValue() ?? '';
    let finished = false;

    onRendered(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });

    const commit = () => {
        if (finished) return;
        finished = true;
        const newValue = textarea.value.trim();
        const label = EDITABLE_TEXT_LABELS[field] || field;

        if (containsInvalidChars(newValue)) {
            showToast(`Special characters are not allowed in "${label}".`, 'error');
            cancel();
            return;
        }
        if (newValue.length > 500) {
            showToast(`"${label}" exceeds 500 characters. Please shorten it.`, 'error');
            cancel();
            return;
        }
        success(newValue);
    };

    textarea.addEventListener('blur', commit);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            // Keep Escape from also closing fullscreen / the confirm modal.
            e.preventDefault();
            e.stopPropagation();
            if (!finished) {
                finished = true;
                cancel();
            }
        }
    });

    return textarea;
}

function flagCheckboxFormatter(cell) {
    const field = cell.getField();
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'form-check-input';
    input.checked = normalizeBooleanFlag(cell.getValue());
    input.setAttribute('aria-label', field);
    input.addEventListener('change', () => {
        const row = cell.getRow();
        const update = { [field]: input.checked ? 1 : 0 };
        // Redact and Deidentify are mutually exclusive.
        if (input.checked) update[field === 'Redact' ? 'Deidentify' : 'Redact'] = 0;
        row.update(update);
        syncColumnsFromTable();
    });
    return input;
}

function buildColumnDefs(dataSetTypeId) {
    const flagColumn = (field, title) => ({
        title,
        field,
        width: 120,
        hozAlign: 'center',
        headerHozAlign: 'center',
        headerSort: false,
        formatter: flagCheckboxFormatter,
        headerFilter: 'tickCross',
        headerFilterParams: { tristate: true },
        headerFilterFunc: (headerValue, rowValue) => normalizeBooleanFlag(rowValue) === !!headerValue,
        headerFilterLiveFilter: true
    });

    const textColumn = (field, title) => ({
        title,
        field,
        minWidth: 160,
        widthGrow: 2,
        headerSort: false,
        cssClass: 'cell-editable',
        formatter: textCellFormatter,
        editor: textAreaEditor
    });

    if (dataSetTypeId == 3) {
        return [
            { title: 'File Type', field: 'FileType', minWidth: 120, headerFilter: 'input', headerFilterPlaceholder: 'Search…' },
            textColumn('FileDescription', 'File Description'),
            flagColumn('Redact', 'Redact'),
            flagColumn('Deidentify', 'Deidentify')
        ];
    }

    return [
        { title: 'Column Name', field: 'ColumnName', minWidth: 160, widthGrow: 1, headerFilter: 'input', headerFilterPlaceholder: 'Search…' },
        {
            title: 'Column Type',
            field: 'ColumnType',
            width: 120,
            headerSort: false,
            formatter: (cell) => {
                const raw = cell.getValue();
                return escapeHtml(String(getDisplayColumnType(raw) || raw || ''));
            }
        },
        textColumn('LogicalColumnName', 'Logical Name'),
        textColumn('BusinessDescription', 'Business Description'),
        textColumn('ExampleValue', 'Example Value'),
        flagColumn('Redact', 'Redact'),
        flagColumn('Deidentify', 'Deidentify')
    ];
}

/**
 * (Re)builds the columns table for the given rows. Pass `allColumnsData` so edits land in the shared objects.
 */
function setColumnsTableData(data, dataSetTypeId = currentDataSourceTypeID, emptyMessage = COLUMNS_EMPTY_MESSAGE) {
    const el = document.getElementById('dataSetColsTable');
    if (!el) return;

    const rows = Array.isArray(data) ? data : [];
    // Redact takes priority if both flags arrive set.
    rows.forEach(col => {
        if (col.Redact && col.Deidentify) col.Deidentify = false;
    });

    if (columnsTable) {
        columnsTable.destroy();
        columnsTable = null;
    }
    columnsTableReady = false;

    const isFolder = dataSetTypeId == 3;
    columnsTable = new Tabulator(el, {
        data: rows,
        columns: buildColumnDefs(dataSetTypeId),
        layout: 'fitColumns',
        pagination: true,
        paginationMode: 'local',
        paginationSize: pageSize,
        paginationCounter: 'rows',
        placeholder: emptyMessage,
        placeholderHeaderFilter: 'No columns match your search or filter.',
        initialSort: isFolder ? [] : [{ column: 'ColumnName', dir: 'asc' }],
        groupBy: isFolder ? (row) => row.FolderName || 'Unnamed Folder' : false,
        groupHeader: (value, count) => `${escapeHtml(String(value))} <span class="text-muted">(${count})</span>`,
        groupStartOpen: true
    });

    columnsTable.on('tableBuilt', () => {
        columnsTableReady = true;
        notifyColumnsDataChanged();
    });
    columnsTable.on('cellEdited', syncColumnsFromTable);

    notifyColumnsDataChanged();
}

function escapeHtml(value) {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
    const table = document.getElementById('dataSetColsTable');
    if (table) table.setAttribute('aria-busy', 'true');
}

function hideColumnsLoader() {
    const loader = document.getElementById('dataSetColsLoader');
    if (loader) {
        loader.classList.add('d-none');
    }
    const table = document.getElementById('dataSetColsTable');
    if (table) table.setAttribute('aria-busy', 'false');
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
 * Extracts values from raw Excel cells, preserving original formatting exactly as entered.
 * Uses cell.w (formatted text) to keep the user's original format (dates, text, etc.).
 * For dates with 2-digit years, uses the serial number to restore the full 4-digit year.
 * @param {Object} sheet - The XLSX sheet object
 * @param {Array} expectedHeader - Expected header column names
 * @param {number} startRow - Row to start parsing (0-indexed, typically 1 for data after header)
 * @returns {Array} Array of objects with parsed data preserving original formatting
 */
function parseSheetWithFormattedValues(sheet, expectedHeader, startRow) {
    const result = [];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    /**
     * Converts Excel date serial to get the full 4-digit year
     */
    function getFullYearFromSerial(serialNum) {
        if (typeof serialNum !== 'number' || serialNum < 1 || serialNum > 60000) return null;
        try {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (serialNum - 1) * 24 * 60 * 60 * 1000);
            return date.getFullYear();
        } catch (e) {
            return null;
        }
    }
    
    /**
     * If formatted text has a 2-digit year, replace it with the 4-digit year from serial
     */
    function restoreFourDigitYear(formattedText, serialNum) {
        if (!formattedText || typeof formattedText !== 'string') return formattedText;
        
        // Match patterns with 2-digit years at the end
        // Examples: "9/10/98", "09/10/98", "9-10-98", "Sep 10 98", "9 10 98"
        const hasTwoDigitYearPattern = /[\/\-\s](\d{1,2})$/.test(formattedText);
        
        if (hasTwoDigitYearPattern) {
            const fullYear = getFullYearFromSerial(serialNum);
            if (fullYear !== null) {
                // Replace the last 1-2 digit number (the 2-digit year) with full 4-digit year
                return formattedText.replace(/(\d{1,2})$/, String(fullYear));
            }
        }
        
        return formattedText;
    }
    
    for (let row = startRow; row <= range.e.r; row++) {
        const rowObj = {};
        let hasData = false;
        
        for (let col = range.s.c; col < Math.min(range.e.c + 1, expectedHeader.length); col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = sheet[cellAddress];
            const header = expectedHeader[col];
            
            if (header) {
                // Use cell.w (formatted text display) to preserve original formatting
                let cellValue = '';
                if (cell) {
                    cellValue = cell.w ? cell.w : (cell.v !== undefined && cell.v !== null ? String(cell.v) : '');
                    
                    // If we have formatted text AND a numeric value (indicates it's likely a date),
                    // check if the formatted text has a 2-digit year and restore it
                    if (cell.w && typeof cell.v === 'number' && cell.v > 0) {
                        cellValue = restoreFourDigitYear(cell.w, cell.v);
                    }
                    
                    if (cellValue) hasData = true;
                } else {
                    cellValue = '';
                }
                rowObj[header] = cellValue;
            }
        }
        
        // Only include rows that have at least some data
        if (hasData) {
            result.push(rowObj);
        }
    }
    
    return result;
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
                const rcDsId = safeParseId(metaRow.DataSourceID);
                if (rcDsId === null) throw new Error('Invalid DataSourceID in metadata row.');
                const rc = await syncREDCapDataSetColumns(rcDsId);
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
        const tableId = safeParseId(tableIdAsString);
        if (tableId === null) throw new Error(`Invalid table reference ID: ${tableIdAsString}`);

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
                    id: metaDef ? metaDef.MetaDataID : (safeParseId(mid) ?? 0),
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

/**
 * Returns a debounced version of fn that delays invocation by `wait` ms.
 */
function debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

/**
 * Safely parses an ID value, rejecting NaN, floats, negatives, zero,
 * and values exceeding SQL INT max (2147483647).
 * @param {any} value
 * @returns {number|null}
 */
function safeParseId(value) {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || !Number.isFinite(n) || n <= 0 || n > 2147483647) return null;
    return n;
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
        const response = await window.loomeApi.runApiRequest(API_GET_DATASET_COLUMNS, { "DataSetID": dataSetId });
        const parsed = safeParseJson(response);

        if (parsed && parsed.Results) {
            return parsed.Results;
        }
        return [];
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

        // Rebuild the table (headers depend on the data source type).
        setColumnsTableData(allColumnsData, dataSourceTypeId);
    } finally {
        hideColumnsLoader();
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
        DataSourceID: safeParseId(document.getElementById('dataSource').value),
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
                    MetaDataID: safeParseId(keyInput.value),
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
        id: safeParseId(data_set_id),
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
    const cancelEditBtn = document.getElementById('cancel-edit-button');

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
            
            // For export visibility, rely on the in-memory column state
            const tableHasRows = ((allColumnsData && allColumnsData.length) || 0) > 0;

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
        document.getElementById('dataSetColsTable').addEventListener('columnsdatachange', updateExportButtonState);
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
                    // Use raw cell data to preserve original formatting (dates, text, etc.)
                    const parsedCols = parseSheetWithFormattedValues(colsSheet, expectedColsHeader, 1);
                    const parsedMeta = parseSheetWithFormattedValues(metaSheet, expectedMetaHeader, 1);

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
                        // Handle both string messages and arrays of error objects
                        let errorMessage = 'Column validation failed.';
                        if (validation.message) {
                            if (Array.isArray(validation.message)) {
                                // Convert array of errors to readable list
                                errorMessage = validation.message
                                    .map(err => typeof err === 'string' ? err : (err.message || JSON.stringify(err)))
                                    .join('; ');
                            } else if (typeof validation.message === 'object') {
                                errorMessage = JSON.stringify(validation.message);
                            } else {
                                errorMessage = String(validation.message);
                            }
                        }
                        showToast(errorMessage, 'error');
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
                        ExampleValue: String(r.ExampleValue || '').trim(),
                        Deidentify: normalizeBooleanFlag(r.Deidentify),
                        TokenIdentifierType: Number(r.TokenIdentifierType) || 0,
                        Redact: normalizeBooleanFlag(r.Redact),
                        DisplayOrder: Number(r.DisplayOrder) || (idx + 1),
                        IsFilter: normalizeBooleanFlag(r.IsFilter)
                    }));

                    // If metadata contains DataSourceTypeID/DataSourceID, set globals so header and behavior match
                    if (Array.isArray(parsedMeta) && parsedMeta.length > 0) {
                        const meta0 = parsedMeta[0];
                        const dsType = safeParseId(meta0.DataSourceTypeID);
                        const dsId = safeParseId(meta0.DataSourceID);
                        if (dsType !== null) currentDataSourceTypeID = dsType;
                        if (dsId !== null) currentDataSourceID = dsId;
                    }

                    // Update master state and refresh UI
                    allColumnsData = importedColumns;
                    
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
                            const dsIdToUse = (Object.prototype.hasOwnProperty.call(metaRow, 'DataSourceID') && metaRow.DataSourceID) ? (safeParseId(metaRow.DataSourceID) ?? currentDataSourceID) : currentDataSourceID;
                            const dsTypeToUse = (Object.prototype.hasOwnProperty.call(metaRow, 'DataSourceTypeID') && metaRow.DataSourceTypeID) ? (safeParseId(metaRow.DataSourceTypeID) ?? currentDataSourceTypeID) : currentDataSourceTypeID;
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
                                
                                // Final UI refresh: render the table last so all states (DataSourceID, etc.)
                                // are applied before updateExportButtonState runs.
                                setColumnsTableData(allColumnsData, currentDataSourceTypeID);
                                if (typeof updateExportButtonState === 'function') {
                                    updateExportButtonState();
                                }
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

    // Cancel Edit button handler: restore form to last loaded values
    if (cancelEditBtn) {
        cancelEditBtn.style.display = 'none';
        cancelEditBtn.addEventListener('click', async () => {
            if (!formSnapshot) return;
            nameInput.value = formSnapshot.name;
            descriptionInput.value = formSnapshot.description;
            activeCheckbox.checked = formSnapshot.isActive;
            owner.value = formSnapshot.owner;
            approver.value = formSnapshot.approvers;
            // Reload the columns from the saved state
            await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
            // Re-fetch and restore the metadata fields from the API.
            // Build a minimal data source object from the module-level globals —
            // allDataSources is not in scope here (it lives inside DOMContentLoaded).
            const currentDataSetID = selectionDropdown ? selectionDropdown.value : null;
            if (currentDataSourceID && currentDataSourceTypeID && currentDataSetID && currentDataSetID !== 'new') {
                const minimalDataSource = { DataSourceID: currentDataSourceID, DataSourceTypeID: currentDataSourceTypeID };
                await updateMetaDataTable(minimalDataSource, currentDataSetID);
            }
            showToast('Changes cancelled. Form restored to saved values.', 'info');
        });
    }

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
                // Before Cancelling a DataSet (Catalogue Asset or from the Database) there are guards that must be passed
                // 1. Check if there is a matching asset in the Portal Catalogue and delete it if it exists. 
                //      This ensures we don't leave orphaned assets that point to deleted datasets, which would cause confusion and clutter in the catalogue.
                // 2. Check if there are any existing requests for the DataSet and prevent deletion if so, 
                //      since that would orphan requests and cause errors for users who have requested access to this data.

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

                // Check if the asset exists in the catalogue before attempting to delete it
                let inCatalogue = false;
                if (asset && asset.id) {
                    inCatalogue = true;
                    // console.log('Deleted catalogue asset:', deletedDataSet);
                } else {
                    showToast(`No matching catalogue asset found for "${datasetName}" (${dataSourceTypeLabel}). Database was not modified.`, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalHtml;
                    return;
                }

                // Check if the asset has existing requests
                let hasExistingRequests = await window.loomeApi.runApiRequest(API_GET_REQUESTS_BY_DATASET_ID, { data_set_id: selectedId });

                // If there are no requests, set hasExistingRequests to false
                if (hasExistingRequests) {
                    showToast(`Cannot delete Data Set "${datasetName}" because there are existing requests associated with it. Please resolve or remove those requests before attempting deletion.`, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalHtml;
                    return;
                }

                // Proceed with cancellation of both Catalogue Asset and Database entry 
                // if it has a catalogue entry and no existing requests
                if (inCatalogue && !hasExistingRequests) {
                    // Proceed with cancellation of both Catalogue Asset and Database entry
                    // if it has a catalogue entry and no existing requests
                    
                    // Cancel from Database Entry
                    const safeSelectedId = safeParseId(selectedId);
                    if (safeSelectedId === null) { showToast('Invalid dataset ID.', 'error'); return; }
                    const params = { id: safeSelectedId };
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

                    // Remove from Catalogue Asset List
                    const deletedDataSet = await window.loomeApi.runApiRequest(API_DELETE_ASSET_BY_ASSET_ID, { 
                        assetId: asset.id, token: token.access_token 
                    });
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

    // Snapshot of the last loaded dataset for cancel-edit restoration
    let formSnapshot = null;

    function saveFormSnapshot(dataSet, dataSource) {
        formSnapshot = {
            name: dataSet.Name,
            description: dataSet.Description,
            dataSourceID: dataSource.DataSourceID,
            isActive: dataSet.IsActive,
            owner: dataSet.Owner,
            approvers: dataSet.Approvers
        };
    }

    function updateCancelEditButtonState() {
        if (!cancelEditBtn) return;
        const selected = selectionDropdown ? selectionDropdown.value : 'new';
        cancelEditBtn.style.display = (selected && selected !== 'new') ? '' : 'none';
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
        saveFormSnapshot(dataSet, dataSource);
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
            updateDataSetFieldsTable(null, null);
            updateMetaDataTable(null, null);
            // When creating a new set, there are no columns to show. Clear the table.
            setColumnsTableData([], null);
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
        }
    }

    // Toggle visibility of the delete button based on whether an existing Data Set is selected
    function updateDeleteButtonState() {
        if (!deleteBtn) return;
        const selected = selectionDropdown ? selectionDropdown.value : 'new';
        deleteBtn.style.display = (selected && selected !== 'new') ? '' : 'none';
        updateCancelEditButtonState();
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
                    allColumnsData = [];
                    setColumnsTableData([], null);
                    // You might also want to clear the metadata tables here.
                }

                await loadColumnsData(currentDataSourceTypeID, currentDataSourceID);
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
            let _confirmModalTrigger = null; // element to restore focus to on close

            function showConfirmModal() {
                _confirmModalTrigger = document.activeElement;
                confirmModal.style.display = '';
                confirmModal.setAttribute('aria-hidden', 'false');
                // Move focus into the dialog so screen readers announce it
                const dialog = confirmModal.querySelector('[role="dialog"]');
                if (dialog) dialog.focus();
            }
            function hideConfirmModal() {
                confirmModal.style.display = 'none';
                confirmModal.setAttribute('aria-hidden', 'true');
                // Restore focus to the element that opened the modal
                if (_confirmModalTrigger) { _confirmModalTrigger.focus(); _confirmModalTrigger = null; }
            }

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

                const originalButtonText = submitButton.textContent;

                try {
                    // 2. Gather all data from the form into a structured object
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

                    // Validation passed — disable the button now while the modal is open
                    submitButton.disabled = true;
                    submitButton.textContent = 'Saving...';

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
                            allColumnsData = [];
                            setColumnsTableData([], null);
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

    const toggleBtn = document.getElementById('toggleFullscreenBtn');
    // Target the shared parent wrapper container instead of just the table
    const workspaceWrapper = document.getElementById('tableWorkspaceWrapper');

    const expandIcon = toggleBtn.querySelector('.icon-expand');
    const collapseIcon = toggleBtn.querySelector('.icon-collapse');

    function toggleTableFullscreen() {
        // Toggles class on parent container so both table and pagination expand together
        const isFullscreen = workspaceWrapper.classList.toggle('table-fullscreen-active');
        
        if (isFullscreen) {
            expandIcon.style.display = 'none';
            collapseIcon.style.display = 'block';
        } else {
            expandIcon.style.display = 'block';
            collapseIcon.style.display = 'none';
        }

        // Tabulator needs a redraw once its container size changes.
        if (columnsTable) columnsTable.redraw(true);
    }

    toggleBtn.addEventListener('click', toggleTableFullscreen);

    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' || event.key === 'Esc') {
            if (workspaceWrapper.classList.contains('table-fullscreen-active')) {
                toggleTableFullscreen();
            }
        }
    });

}

renderManageDataSetPage();