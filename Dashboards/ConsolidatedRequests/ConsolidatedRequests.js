// =================================================================
//                      CONSOLIDATED REQUESTS DASHBOARD
// =================================================================

// =================================================================
//                      TYPE CONFIGURATION
// =================================================================

const typeConfig = {
    'export': {
        label: 'Data Export Requests',
        tableContainerId: 'jobs-table-area',
        fetchApiId: 'GetDataExportFromDBbyUpn',
        requestApiId: 'GetAssistProjectsFilteredByUpn',
        submitApiId: 'RequestDataExportByAssistProjectID',
        updateApiId: 'UpdateDataExportRequestStatus',
        deleteApiId: 'DeleteExportRequest',
        detailApiId: 'GetExportRequestByID',
        detailIdParam: 'ExportRequestID',
        requestIdField: 'ExportRequestID',
        requestNameField: 'ExportRequestName',
        projectNameField: 'ExportProjectName',
        defaultStatus: 'Pending Approval',
        dropdownLabel: 'Source Assist Project',
        modalTitle: 'New Data Export Request',
        requestNameLabel: 'Export Request Name',
        newRequestBtnLabel: 'Request Data Export',
        searchPlaceholder: 'Search export jobs...',
        emptyMessage: 'No export jobs found.',
        statusMap: { '-2': 'Failed', '-1': 'Working', '0': 'Awaiting Submission', '1': 'Pending Approval', '2': 'Approved', '3': 'Finalised', '4': 'Rejected' },
        chips: ['Pending Approval', 'Approved', 'Rejected', 'Finalised'],
        groupedChips: { 'Pending Approval': ['Failed', 'Working', 'Pending Approval'] },
        sortDateField: 'CreateDate',
        sortIdField: 'ExportRequestID',
        accordionType: 'export'
    },
    'import': {
        label: 'Data Import Requests',
        tableContainerId: 'jobs-table-area',
        fetchApiId: 'GetDataImportFromDBbyUpn',
        requestApiId: 'GetAssistProjectsFilteredByUpn',
        submitApiId: 'RequestDataImportByAssistProjectID',
        updateApiId: 'UpdateDataImportRequestStatus',
        deleteApiId: 'DeleteImportRequest',
        detailApiId: 'GetImportRequestByID',
        detailIdParam: 'RequestID',
        requestIdField: 'ImportRequestID',
        requestNameField: 'ImportRequestName',
        projectNameField: 'ImportProjectName',
        defaultStatus: 'Awaiting Submission',
        dropdownLabel: 'Target Assist Project',
        modalTitle: 'New Data Import Request',
        requestNameLabel: 'Import Request Name',
        newRequestBtnLabel: 'Request Data Import',
        searchPlaceholder: 'Search import jobs...',
        emptyMessage: 'No import jobs found.',
        statusMap: { '-2': 'Failed', '-1': 'Working', '0': 'Awaiting Submission', '1': 'Pending Approval', '2': 'Approved', '3': 'Finalised', '4': 'Rejected' },
        chips: ['Awaiting Submission', 'Pending Approval', 'Approved', 'Rejected', 'Finalised'],
        groupedChips: { 'Awaiting Submission': ['Failed', 'Working', 'Awaiting Submission'] },
        sortDateField: 'CreateDate',
        sortIdField: 'ImportRequestID',
        accordionType: 'import'
    },
    'dataaccess': {
        label: 'Data Access Requests',
        tableContainerId: 'jobs-table-area',
        fetchApiId: 'GetRequests',
        requestApiId: null,
        submitApiId: null,
        updateApiId: null,
        deleteApiId: 'DeleteRequestID',
        detailApiId: 'GetRequestID',
        detailIdParam: 'RequestID',
        datasetApiId: 'GetDataSetID',
        requestIdField: 'RequestID',
        requestNameField: 'Name',
        projectNameField: null,
        defaultStatus: 'Pending Approval',
        dropdownLabel: null,
        modalTitle: null,
        requestNameLabel: null,
        newRequestBtnLabel: null,
        searchPlaceholder: 'Search requests...',
        emptyMessage: 'No requests found.',
        statusMap: { '1': 'Pending Approval', '2': 'Approved', '3': 'Finalised', '4': 'Rejected' },
        chips: ['Pending Approval', 'Approved', 'Rejected', 'Finalised'],
        groupedChips: {},
        sortDateField: 'CreateDate',
        sortIdField: 'RequestID',
        paginationMode: 'server',
        accordionType: 'dataaccess'
    }
};

// =================================================================
//                      STATE
// =================================================================

let activeType = 'export';
let currentPage = 1;
let totalPages = 1;
const rowsPerPage = 5;
let allJobs = [];
let isDropdownPopulated = false;
let projectsCache = null;

// =================================================================
//                      UTILITY FUNCTIONS
// =================================================================

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.style.cssText = 'margin-bottom:10px;padding:12px 16px;border-radius:6px;color:#fff;display:flex;align-items:center;min-width:250px;max-width:360px;opacity:0;transition:opacity .25s ease,transform .25s ease;';

    let bgColor = '#2196F3';
    if (type === 'success') bgColor = '#1AABA3';
    if (type === 'error') bgColor = '#f44336';
    if (type === 'warning') bgColor = '#ff9800';
    toast.style.backgroundColor = bgColor;

    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';
    textWrap.textContent = message;
    toast.appendChild(textWrap);

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
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });

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

function hideToast(toast) {
    if (toast && toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }
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

function getStatusChipColor(status) {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
        case 'failed': return 'bg-red-100 text-red-800';
        case 'working': return 'bg-purple-100 text-purple-800';
        case 'awaiting submission': return 'bg-yellow-100 text-yellow-800';
        case 'pending approval': return 'bg-blue-100 text-blue-800';
        case 'approved':
        case 'finalised': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

async function getFromAPI(API_ID, initialParams) {
    let allResults = [];
    try {
        const initialResponse = await window.loomeApi.runApiRequest(API_ID, initialParams);
        const parsedInitial = safeParseJson(initialResponse);

        if (!parsedInitial) return [];

        if (parsedInitial.PageCount !== undefined && Array.isArray(parsedInitial.Results)) {
            allResults = parsedInitial.Results;
            const totalPages = parsedInitial.PageCount;
            if (totalPages > 1) {
                for (let page = 2; page <= totalPages; page++) {
                    const params = { ...initialParams, "page": page };
                    const response = await window.loomeApi.runApiRequest(API_ID, params);
                    const parsed = safeParseJson(response);
                    if (parsed && parsed.Results) {
                        allResults = allResults.concat(parsed.Results);
                    }
                }
            }
        } else {
            allResults = Array.isArray(parsedInitial) ? parsedInitial : [parsedInitial];
        }

        return allResults;
    } catch (error) {
        console.error("Error fetching from API:", error);
        return [];
    }
}

async function getProjectsMapping() {
    if (projectsCache) return projectsCache;

    try {
        const initialParams = { "page": 1, "page_size": 100, "search": '' };
        const data = await getFromAPI('GetAssistProjectsFilteredByUpn', initialParams);
        const mapping = {};
        if (data) {
            data.forEach(project => {
                mapping[project.AssistProjectID] = {
                    name: project.Name,
                    description: project.Description
                };
            });
        }
        projectsCache = mapping;
        return mapping;
    } catch (error) {
        console.error("Error fetching projects:", error);
        return {};
    }
}

function getActiveConfig() {
    return typeConfig[activeType];
}

function getActiveStatus() {
    const activeChip = document.querySelector('#status-chips-container .chip.active');
    return activeChip ? activeChip.dataset.status : getActiveConfig().defaultStatus;
}

function getSearchTerm() {
    const input = document.getElementById('search-input');
    return input ? input.value.toLowerCase() : '';
}

// =================================================================
//                      PAGINATION
// =================================================================

function renderPagination(containerId, totalItems, itemsPerPage, page) {
    const container = document.getElementById(containerId);
    if (!container) return;

    totalPages = Math.ceil(totalItems / itemsPerPage);
    container.innerHTML = '';

    if (totalPages <= 1) return;

    const isFirstPage = page === 1;
    const isLastPage = page === totalPages;
    const commonButtonClasses = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100";
    const disabledClasses = "opacity-50 cursor-not-allowed";

    let paginationHTML = `
        <div class="flex items-center gap-2">
            <button data-page="1" 
                    class="${commonButtonClasses} ${isFirstPage ? disabledClasses : ''}" 
                    ${isFirstPage ? 'disabled' : ''}>
                First
            </button>
            <button data-page="${page - 1}" 
                    class="${commonButtonClasses} ${isFirstPage ? disabledClasses : ''}" 
                    ${isFirstPage ? 'disabled' : ''}>
                Previous
            </button>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-700">
            <span>Page</span>
            <input type="number" 
                   id="page-input" 
                   class="w-16 text-center border border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                   value="${page}" 
                   min="1" 
                   max="${totalPages}" 
                   aria-label="Current page">
            <span>of ${totalPages}</span>
        </div>
        <div class="flex items-center gap-2">
            <button data-page="${page + 1}" 
                    class="${commonButtonClasses} ${isLastPage ? disabledClasses : ''}" 
                    ${isLastPage ? 'disabled' : ''}>
                Next
            </button>
            <button data-page="${totalPages}" 
                    class="${commonButtonClasses} ${isLastPage ? disabledClasses : ''}" 
                    ${isLastPage ? 'disabled' : ''}>
                Last
            </button>
        </div>
    `;

    container.innerHTML = paginationHTML;
}

// =================================================================
//                      STATUS CHIPS
// =================================================================

function renderStatusChips() {
    const config = getActiveConfig();
    const container = document.getElementById('status-chips-container');
    container.innerHTML = '';

    config.chips.forEach((chipLabel, index) => {
        const btn = document.createElement('button');
        btn.className = 'chip' + (chipLabel === config.defaultStatus ? ' active' : '');
        btn.dataset.status = chipLabel;
        btn.innerHTML = `${chipLabel} <span class="chip-count"></span>`;
        container.appendChild(btn);
    });
}

async function refreshAllChipCounts() {
    const config = getActiveConfig();
    const chipsContainer = document.getElementById('status-chips-container');
    if (!chipsContainer) return;

    for (const chip of chipsContainer.querySelectorAll('.chip')) {
        const status = chip.dataset.status;
        let count = 0;

        if (config.paginationMode === 'server') {
            // Data Access: server-side count
            const statusId = parseInt(Object.keys(config.statusMap).find(key => config.statusMap[key] === status));
            const apiParams = { "page": 1, "pageSize": 1, "search": '', "statusId": statusId };
            try {
                const response = await window.loomeApi.runApiRequest(config.fetchApiId, apiParams);
                const parsed = safeParseJson(response);
                count = parsed.RowCount || 0;
            } catch (e) {
                console.error("Error fetching count:", e);
            }
        } else {
            // Export/Import: client-side count from allJobs
            const grouped = config.groupedChips[status];
            if (grouped) {
                count = allJobs.filter(job => {
                    const statusId = job.StatusID ?? 0;
                    const jobStatus = config.statusMap[String(statusId)] || config.defaultStatus;
                    return grouped.includes(jobStatus);
                }).length;
            } else {
                count = allJobs.filter(job => {
                    const statusId = job.StatusID ?? 0;
                    const jobStatus = config.statusMap[String(statusId)] || config.defaultStatus;
                    return jobStatus === status;
                }).length;
            }
        }

        const countSpan = chip.querySelector('.chip-count');
        if (countSpan) countSpan.textContent = count;
    }
}

// =================================================================
//                      NEW REQUEST BUTTON
// =================================================================

function updateNewRequestButton() {
    const config = getActiveConfig();
    const btn = document.getElementById('new-request-btn');
    if (!btn) return;

    if (config.newRequestBtnLabel) {
        btn.textContent = config.newRequestBtnLabel;
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// =================================================================
//                      SEARCH PLACEHOLDER
// =================================================================

function updateSearchPlaceholder() {
    const config = getActiveConfig();
    const input = document.getElementById('search-input');
    if (input) input.placeholder = config.searchPlaceholder;
}

// =================================================================
//                      MODAL
// =================================================================

function openModal() {
    const config = getActiveConfig();
    if (!config.modalTitle) return;

    const modal = document.getElementById('request-modal');
    if (!modal) return;

    // Update modal content
    document.getElementById('modal-title').textContent = config.modalTitle;
    document.getElementById('request-name-label').textContent = config.requestNameLabel;
    document.getElementById('dropdown-label').textContent = config.dropdownLabel;

    // Reset form
    const nameInput = document.getElementById('request-name-input');
    if (nameInput) nameInput.value = '';
    document.getElementById('request-dropdown').selectedIndex = 0;
    document.getElementById('modal-submit-btn').disabled = true;

    modal.classList.remove('hidden');

    if (!isDropdownPopulated) {
        populateAssistProjectsDropdown();
    }
}

function closeModal() {
    const modal = document.getElementById('request-modal');
    if (modal) modal.classList.add('hidden');
}

async function populateAssistProjectsDropdown() {
    const config = getActiveConfig();
    const dropdown = document.getElementById('request-dropdown');
    if (!dropdown || !config.requestApiId) return;

    dropdown.disabled = true;
    dropdown.innerHTML = '<option value="">Loading...</option>';

    try {
        const response = await window.loomeApi.runApiRequest(config.requestApiId, {});
        const data = safeParseJson(response);
        const assistProjects = data.Results;

        const placeholder = activeType === 'export' ? 'Select source Assist Project...' : 'Select Target Assist Project...';
        dropdown.innerHTML = `<option value="">${placeholder}</option>`;

        if (assistProjects && assistProjects.length > 0) {
            assistProjects.forEach(type => {
                const option = document.createElement('option');
                option.value = type.AssistProjectID;
                option.textContent = type.Name;
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

// =================================================================
//                      ACCORDION DETAIL RENDERING
// =================================================================

async function displayExportImportDetails(container, requestDetails, config) {
    if (!requestDetails || Object.keys(requestDetails).length === 0) {
        container.innerHTML = '<p class="text-center text-red-500">No details available</p>';
        return;
    }

    try {
        const idField = config.requestIdField;
        const projectField = config.projectNameField;
        const idLabel = activeType === 'export' ? 'Export Request ID' : 'Import Request ID';
        const projectLabel = activeType === 'export' ? 'Source Project Name' : 'Target Project Name';

        let html = `
            <div class="grid grid-cols-2 gap-5">
                <div>
                    <div class="space-y-3">
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">${idLabel}</span>
                            <span class="text-sm text-gray-500">${requestDetails[idField] || 'N/A'}</span>
                        </div>
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">${projectLabel}</span>
                            <span class="text-sm text-gray-500">${requestDetails.ProjectName || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="space-y-3">
                        ${requestDetails.ApprovedBy ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Approved By</span>
                            <span class="text-sm text-gray-500">${requestDetails.ApprovedBy}</span>
                        </div>` : ''}
                        ${requestDetails.ApprovedDate ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Approved On</span>
                            <span class="text-sm text-gray-500">${formatDate(requestDetails.ApprovedDate)}</span>
                        </div>` : ''}
                        ${requestDetails.ApprovalMessage ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Approval Message</span>
                            <span class="text-sm text-gray-500">${requestDetails.ApprovalMessage}</span>
                        </div>` : ''}
                        ${requestDetails.RejectedBy ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Rejected By</span>
                            <span class="text-sm text-gray-500">${requestDetails.RejectedBy}</span>
                        </div>` : ''}
                        ${requestDetails.RejectedDate ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Rejected On</span>
                            <span class="text-sm text-gray-500">${formatDate(requestDetails.RejectedDate)}</span>
                        </div>` : ''}
                        ${requestDetails.RejectionMessage ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Rejection Message</span>
                            <span class="text-sm text-gray-500">${requestDetails.RejectionMessage}</span>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (error) {
        console.error("Error displaying details:", error);
        container.innerHTML = `
            <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                <p class="text-center text-red-500 mb-2">Error loading details</p>
                <p class="text-sm">${error.message || 'Unknown error'}</p>
            </div>
        `;
    }
}

async function displayDataAccessDetails(container, requestDetails, datasetDetails) {
    if ((!requestDetails || Object.keys(requestDetails).length === 0) &&
        (!datasetDetails || Object.keys(datasetDetails).length === 0)) {
        container.innerHTML = '<p class="text-center text-red-500">No details available</p>';
        return;
    }

    container.innerHTML = '<p class="text-center">Loading details...</p>';

    try {
        const projectsMapping = await getProjectsMapping();
        const projectInfo = requestDetails && requestDetails.ProjectID ?
            (projectsMapping[requestDetails.ProjectID] || { name: 'Unknown Project', description: '' }) :
            { name: 'Unknown Project', description: '' };

        let html = `
            <div class="grid grid-cols-2 gap-5">
                <div>
                    <div class="space-y-3">
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Requested Dataset</span>
                            <span class="text-sm text-gray-500">${(datasetDetails && datasetDetails.Name) || 'N/A'}</span>
                        </div>
                        ${datasetDetails && datasetDetails.Description ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Dataset Description</span>
                            <span class="text-sm text-gray-500">${datasetDetails.Description}</span>
                        </div>` : ''}
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Data Source ID</span>
                            <span class="text-sm text-gray-500">${(datasetDetails && (datasetDetails.DataSource || datasetDetails.DataSourceID)) || 'N/A'}</span>
                        </div>
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Target Project Name</span>
                            <span class="text-sm text-gray-500">${projectInfo.name}</span>
                        </div>
                        ${projectInfo.description ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Project Description</span>
                            <span class="text-sm text-gray-500">${projectInfo.description}</span>
                        </div>` : ''}
                    </div>
                </div>
                <div>
                    <div class="space-y-3">
                        ${requestDetails && requestDetails.Purpose ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Purpose</span>
                            <span class="text-sm text-gray-500">${requestDetails.Purpose}</span>
                        </div>` : ''}
                        ${requestDetails && requestDetails.ApprovalMessage ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Approval Message</span>
                            <span class="text-sm text-gray-500">${requestDetails.ApprovalMessage}</span>
                        </div>` : ''}
                        ${requestDetails && requestDetails.RejectionMessage ? `
                        <div class="grid grid-cols-1 gap-1">
                            <span class="font-medium">Rejection Message</span>
                            <span class="text-sm text-gray-500">${requestDetails.RejectionMessage}</span>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (error) {
        console.error("Error displaying combined details:", error);
        container.innerHTML = `
            <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                <p class="text-center text-red-500 mb-2">Error loading details</p>
                <p class="text-sm">${error.message || 'Unknown error'}</p>
            </div>
        `;
    }
}

// =================================================================
//                      DELETE / SUBMIT ACTIONS
// =================================================================

async function handleDelete(itemId, itemName) {
    const config = getActiveConfig();

    const confirmed = confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`);
    if (!confirmed) return;

    let loadingToast = null;
    try {
        loadingToast = showToast('Deleting request...', 'info');

        if (activeType === 'dataaccess') {
            await window.loomeApi.runApiRequest(config.deleteApiId, { "id": itemId });
        } else {
            const params = {};
            params[config.requestIdField] = itemId;
            await window.loomeApi.runApiRequest(config.deleteApiId, params);
        }

        if (loadingToast) hideToast(loadingToast);
        showToast('Request deleted successfully', 'success');
        await refreshAllChipCounts();
        setTimeout(() => { renderUI(); }, 100);
    } catch (error) {
        console.error("Error deleting request:", error);
        if (loadingToast) hideToast(loadingToast);
        showToast('Failed to delete request. Please try again.', 'error');
    }
}

async function handleSubmitImport(importRequestID) {
    const config = getActiveConfig();

    const confirmed = confirm('Are you sure you want to submit the import job?');
    if (!confirmed) return;

    try {
        showToast('Submitting import job...', 'info');
        const params = { ImportRequestID: parseInt(importRequestID, 10), statusID: 1 };
        const response = await window.loomeApi.runApiRequest(config.updateApiId, params);
        const parsedResponse = safeParseJson(response);

        if (parsedResponse && parsedResponse.StatusID === 1) {
            showToast('Import job submitted successfully!', 'success');
            setTimeout(() => { initializePage(); }, 1000);
        } else {
            const errorMessage = parsedResponse?.message || parsedResponse?.Message || 'Submission failed';
            showToast(`Failed to submit import job: ${errorMessage}`, 'error');
        }
    } catch (error) {
        console.error('Error submitting import job:', error);
        showToast('Failed to submit import job. Please try again.', 'error');
    }
}

// =================================================================
//                      TABLE RENDERING
// =================================================================

function renderTable(containerId, data, selectedStatus, searchTerm) {
    const config = getActiveConfig();
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!data || data.length === 0) {
        const message = searchTerm && searchTerm.trim() ?
            config.emptyMessage.replace('.', '. Please review your search term.') :
            config.emptyMessage;
        container.innerHTML = `<p class="text-center text-gray-500">${message}</p>`;
        return;
    }

    const table = document.createElement('table');
    table.className = 'w-full divide-y divide-gray-200';
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    const headerRow = document.createElement('tr');

    // Chevron column
    const chevronTh = document.createElement('th');
    chevronTh.className = 'w-10 px-6 py-3';
    chevronTh.innerHTML = '';
    headerRow.appendChild(chevronTh);

    // Build headers based on active type and selected status
    const headers = getTableHeaders(config, selectedStatus);
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

    data.forEach((item) => {
        const statusId = item.StatusID ?? 0;
        const itemStatus = config.statusMap[String(statusId)] || config.defaultStatus;
        const tdClasses = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';

        // Main row
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 cursor-pointer';

        // Build row HTML based on type
        let rowHTML = '';
        if (activeType === 'dataaccess') {
            rowHTML = buildDataAccessRowHTML(item, selectedStatus, tdClasses);
        } else {
            rowHTML = buildExportImportRowHTML(item, selectedStatus, tdClasses, itemStatus, config);
        }
        row.innerHTML = rowHTML;
        tbody.appendChild(row);

        // Accordion detail row
        const detailRow = document.createElement('tr');
        detailRow.className = 'details-row hidden';
        detailRow.innerHTML = buildAccordionHTML(item, itemStatus, selectedStatus, headers.length + 1, config);
        tbody.appendChild(detailRow);

        // Wire up row click
        row.addEventListener('click', async () => {
            detailRow.classList.toggle('hidden');
            const chevron = row.querySelector('.chevron-icon');
            if (chevron) {
                if (activeType === 'dataaccess') {
                    chevron.classList.toggle('rotate-180');
                } else {
                    chevron.style.transform = detailRow.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
                }
            }

            if (!detailRow.classList.contains('hidden')) {
                const idField = config.requestIdField;
                const itemId = item[idField];
                const detailsContainer = detailRow.querySelector(`#combined-details-${itemId}`);
                if (!detailsContainer) return;

                detailsContainer.innerHTML = '<p class="text-center">Loading details...</p>';

                try {
                    if (activeType === 'dataaccess') {
                        let requestDetails = null;
                        let datasetDetails = null;
                        try {
                            const resp = await window.loomeApi.runApiRequest(config.detailApiId, { "RequestID": itemId });
                            requestDetails = safeParseJson(resp);
                        } catch (e) { console.error('Error fetching request details:', e); }
                        try {
                            const resp = await window.loomeApi.runApiRequest(config.datasetApiId, { "DataSetID": item.DataSetID });
                            datasetDetails = safeParseJson(resp);
                        } catch (e) { console.error('Error fetching dataset details:', e); }

                        if (!requestDetails && !datasetDetails) throw new Error('Failed to fetch both request and dataset details');
                        await displayDataAccessDetails(detailsContainer, requestDetails, datasetDetails);
                    } else {
                        const params = {};
                        params[config.detailIdParam] = parseInt(itemId, 10);
                        const resp = await window.loomeApi.runApiRequest(config.detailApiId, params);
                        const requestDetails = safeParseJson(resp);
                        if (!requestDetails) throw new Error('Failed to fetch request details');
                        await displayExportImportDetails(detailsContainer, requestDetails, config);
                    }
                } catch (error) {
                    console.error("Error loading details:", error);
                    detailsContainer.innerHTML = `
                        <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p class="text-center text-red-500 mb-2">Error loading details</p>
                            <p class="text-sm">${error.message || 'Unknown error'}</p>
                            ${activeType === 'dataaccess' ? `<button class="mt-2 px-3 py-1 bg-white border border-gray-300 rounded text-sm retry-btn">Retry</button>` : ''}
                        </div>
                    `;

                    // Retry for data access
                    if (activeType === 'dataaccess') {
                        const retryBtn = detailsContainer.querySelector('.retry-btn');
                        if (retryBtn) {
                            retryBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                detailsContainer.innerHTML = '<p class="text-center">Loading details...</p>';
                                try {
                                    const reqResp = await window.loomeApi.runApiRequest(config.detailApiId, { "RequestID": itemId });
                                    const retryReq = safeParseJson(reqResp);
                                    const dsResp = await window.loomeApi.runApiRequest(config.datasetApiId, { "DataSetID": item.DataSetID });
                                    const retryDs = safeParseJson(dsResp);
                                    await displayDataAccessDetails(detailsContainer, retryReq, retryDs);
                                } catch (retryError) {
                                    detailsContainer.innerHTML = `
                                        <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                                            <p class="text-red-600">Failed to load details</p>
                                            <p class="text-sm text-red-500 mt-1">${retryError.message || 'Unknown error'}</p>
                                        </div>
                                    `;
                                }
                            });
                        }
                    }
                }
            }
        });

        // Wire up delete button
        const deleteBtn = detailRow.querySelector('.action-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nameField = config.requestNameField;
                handleDelete(item[config.requestIdField], item[nameField] || 'this request');
            });
        }

        // Wire up submit import button
        const submitBtn = detailRow.querySelector('.action-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSubmitImport(item[config.requestIdField]);
            });
        }
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

function getTableHeaders(config, selectedStatus) {
    if (activeType === 'dataaccess') {
        const headers = ['Request ID', 'Request Name', 'Requested On'];
        if (selectedStatus === 'Pending Approval') headers.push('Approvers');
        else if (selectedStatus === 'Approved') { headers.push('Approved by'); headers.push('Approved on'); }
        else if (selectedStatus === 'Rejected') { headers.push('Rejected by'); headers.push('Rejected on'); }
        else if (selectedStatus === 'Finalised') { headers.push('Approved by'); headers.push('Approved on'); headers.push('Finalised on'); }
        return headers;
    } else {
        // Export and Import share same pattern
        const nameCol = activeType === 'export' ? 'Export Request Name' : 'Import Request Name';
        const projectCol = activeType === 'export' ? 'Export Project Name' : 'Import Project Name';
        const headers = [nameCol, 'Requested On', projectCol];

        const defaultChip = activeType === 'export' ? 'Pending Approval' : 'Awaiting Submission';
        if (selectedStatus === defaultChip) {
            headers.push('Status');
        } else if (selectedStatus === 'Approved') {
            headers.push('Approved by');
            headers.push('Approved on');
            headers.push('Status');
        } else if (selectedStatus === 'Rejected') {
            headers.push('Rejected on');
        } else if (selectedStatus === 'Finalised') {
            headers.push('Finalised on');
        }
        return headers;
    }
}

function buildDataAccessRowHTML(item, selectedStatus, tdClasses) {
    let statusSpecificCols = '';
    switch (item.status) {
        case 'Pending Approval': statusSpecificCols = `<td class="${tdClasses}">${item.Approvers || 'N/A'}</td>`; break;
        case 'Rejected': statusSpecificCols = `<td class="${tdClasses}">${item.RejectedBy || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.RejectedDate)}</td>`; break;
        case 'Approved': statusSpecificCols = `<td class="${tdClasses}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td>`; break;
        case 'Finalised': statusSpecificCols = `<td class="${tdClasses}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td><td class="${tdClasses}">${formatDate(item.FinalisedDate)}</td>`; break;
    }

    return `
        <td class="${tdClasses} text-center">
            <svg class="chevron-icon h-5 w-5 text-gray-500 transform transition-transform duration-200 inline-block" 
                 xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </td>
        <td class="${tdClasses}">${item.RequestID}</td>
        <td class="${tdClasses}">${item.Name}</td>
        <td class="${tdClasses}">${formatDate(item.CreateDate)}</td>
        ${statusSpecificCols}
    `;
}

function buildExportImportRowHTML(item, selectedStatus, tdClasses, itemStatus, config) {
    let statusSpecificCols = '';
    switch (item.status) {
        case 'Rejected': statusSpecificCols = `<td class="${tdClasses}">${item.RejectedBy || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.RejectedDate)}</td>`; break;
        case 'Approved': statusSpecificCols = `<td class="${tdClasses}">${item.ApprovedBy || 'N/A'}</td><td class="${tdClasses}">${formatDate(item.ApprovedDate)}</td>`; break;
        case 'Finalised': statusSpecificCols = `<td class="${tdClasses}">${formatDate(item.FinalisedDate)}</td>`; break;
    }

    const defaultChip = config.defaultStatus;
    const nameField = config.requestNameField;
    const projectField = config.projectNameField;

    return `
        <td class="w-10 px-6 py-4">
            <button class="toggle-details flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600">
                <svg class="w-4 h-4 transition-transform duration-200 transform chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>
        </td>
        <td class="${tdClasses}">${item[nameField] || 'N/A'}</td>
        <td class="${tdClasses}">${formatDate(item.CreateDate)}</td>
        <td class="${tdClasses}">${item[projectField] || 'N/A'}</td>
        ${statusSpecificCols}
        ${selectedStatus === defaultChip ? `
            <td class="${tdClasses}">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusChipColor(itemStatus)}">
                    ${itemStatus}
                </span>
            </td>
        ` : ''}
        ${selectedStatus === 'Approved' ? `
            <td class="${tdClasses}">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusChipColor(itemStatus)}">
                    Data Transfer In Progress
                </span>
            </td>
        ` : ''}
    `;
}

function buildAccordionHTML(item, itemStatus, selectedStatus, colSpan, config) {
    const idField = config.requestIdField;
    const itemId = item[idField];

    let deleteBtn = '';
    let submitBtn = '';

    if (activeType === 'dataaccess') {
        // Data Access: delete only when Pending Approval
        if (selectedStatus === 'Pending Approval') {
            deleteBtn = `
                <button class="btn btn-danger action-delete px-3 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                </button>`;
        }
    } else {
        // Export/Import: delete when Awaiting Submission, Working, or Failed (or Pending Approval for export)
        const deletableStatuses = activeType === 'export'
            ? ['Pending Approval', 'Working', 'Failed']
            : ['Awaiting Submission', 'Working', 'Failed'];

        if (deletableStatuses.includes(itemStatus)) {
            deleteBtn = `
                <button class="btn btn-danger action-delete px-3 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                </button>`;
        }

        // Import: submit button only when Awaiting Submission
        if (activeType === 'import' && itemStatus === 'Awaiting Submission') {
            submitBtn = `
                <button class="btn btn-primary action-submit px-3 py-1 ms-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Import
                </button>`;
        }
    }

    const hasActions = deleteBtn || submitBtn;
    return `
        <td colspan="${colSpan}" class="p-0">
            <div class="bg-gray-50 p-4 m-2 rounded">
                <div class="grid grid-cols-1 gap-4">
                    ${hasActions ? `<div class="flex justify-end mb-1">${deleteBtn}${submitBtn}</div>` : ''}
                    <div class="bg-white p-5 rounded-md shadow-sm">
                        <div id="combined-details-${itemId}" class="combined-content">
                            <p class="text-center text-gray-500">Loading details...</p>
                        </div>
                    </div>
                </div>
            </div>
        </td>
    `;
}

// =================================================================
//                      RENDER UI (Main Orchestrator)
// =================================================================

async function renderUI() {
    const config = getActiveConfig();
    const selectedStatus = getActiveStatus();
    const searchTerm = getSearchTerm();

    if (config.paginationMode === 'server') {
        // Data Access: server-side pagination
        const statusId = parseInt(Object.keys(config.statusMap).find(key => config.statusMap[key] === selectedStatus));
        const apiParams = {
            "page": currentPage,
            "pageSize": rowsPerPage,
            "search": searchTerm,
            "statusId": statusId
        };

        const response = await window.loomeApi.runApiRequest(config.fetchApiId, apiParams);
        const parsedResponse = safeParseJson(response);
        const rawData = parsedResponse.Results;
        const totalItems = parsedResponse.RowCount;

        const dataWithStatus = rawData.map(item => ({
            ...item,
            status: config.statusMap[String(item.StatusID)] || 'Unknown'
        }));

        renderTable(config.tableContainerId, dataWithStatus, selectedStatus, searchTerm);
        renderPagination('pagination-controls', totalItems, rowsPerPage, currentPage);
    } else {
        // Export/Import: client-side pagination
        const grouped = config.groupedChips[selectedStatus];

        let filteredJobs = allJobs.filter(job => {
            const statusId = job.StatusID ?? 0;
            const jobStatus = config.statusMap[String(statusId)] || config.defaultStatus;
            if (grouped) {
                return grouped.includes(jobStatus);
            }
            return jobStatus === selectedStatus;
        });

        // Client-side search filtering
        if (searchTerm) {
            const nameField = config.requestNameField;
            filteredJobs = filteredJobs.filter(job => {
                const name = (job[nameField] || '').toLowerCase();
                return name.includes(searchTerm);
            });
        }

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const jobsForPage = filteredJobs.slice(startIndex, endIndex);

        const jobsWithStatus = jobsForPage.map(item => ({
            ...item,
            status: config.statusMap[String(item.StatusID)] || 'Unknown'
        }));

        renderTable(config.tableContainerId, jobsWithStatus, selectedStatus, searchTerm);
        renderPagination('pagination-controls', filteredJobs.length, rowsPerPage, currentPage);
    }
}

// =================================================================
//                      INITIALIZATION
// =================================================================

async function initializePage() {
    const config = getActiveConfig();
    const container = document.getElementById(config.tableContainerId);
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500">Loading Requests...</p>';

    try {
        if (config.paginationMode === 'server') {
            // Data Access: server-side — just render, chip counts fetched separately
            allJobs = [];
        } else {
            // Export/Import: fetch all data once
            const initialResponse = await window.loomeApi.runApiRequest(config.fetchApiId, { page: 1, pageSize: 1, search: '' });
            const initialData = safeParseJson(initialResponse);
            const totalJobs = initialData.RowCount;
            allJobs = [];

            if (totalJobs > 0) {
                const allDataResponse = await window.loomeApi.runApiRequest(config.fetchApiId, { page: 1, pageSize: totalJobs, search: '' });
                const allData = safeParseJson(allDataResponse);
                allJobs = (allData.Results || []).slice();

                // Sort by CreateDate descending, with ID as tiebreaker
                const dateField = config.sortDateField;
                const idField = config.sortIdField;
                allJobs.sort((a, b) => {
                    const ta = a && a[dateField] ? new Date(a[dateField]).getTime() : 0;
                    const tb = b && b[dateField] ? new Date(b[dateField]).getTime() : 0;
                    if (tb !== ta) return tb - ta;
                    return (b[idField] || 0) - (a[idField] || 0);
                });
            }
        }

        await refreshAllChipCounts();
        await renderUI();
    } catch (error) {
        console.error("Error initializing page:", error);
        container.innerHTML = '<p class="text-center text-red-500">Failed to load data.</p>';
    }
}

async function refreshPageData() {
    let loadingToast = null;
    try {
        loadingToast = showToast('Refreshing data...', 'info');
        await initializePage();
        if (loadingToast) hideToast(loadingToast);
        showToast('Data refreshed successfully.', 'success');
    } catch (error) {
        console.error('Error refreshing page data:', error);
        if (loadingToast) hideToast(loadingToast);
        showToast('Failed to refresh data.', 'error');
    }
}

// =================================================================
//                      TAB SWITCHING
// =================================================================

function switchType(newType) {
    if (activeType === newType) return;
    activeType = newType;
    currentPage = 1;
    isDropdownPopulated = false;
    allJobs = [];

    // Update tab bar
    document.querySelectorAll('.type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === newType);
    });

    // Re-render chips, button, search placeholder
    renderStatusChips();
    updateNewRequestButton();
    updateSearchPlaceholder();

    // Clear search
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    // Re-init page
    initializePage();
}

// =================================================================
//                      EVENT LISTENERS
// =================================================================

function setupEventListeners() {
    // Type tab bar
    document.getElementById('type-tab-bar').addEventListener('click', (e) => {
        const tab = e.target.closest('.type-tab');
        if (!tab) return;
        switchType(tab.dataset.type);
    });

    // Refresh button
    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshPageData);

    // Status chip clicks
    document.getElementById('status-chips-container').addEventListener('click', (event) => {
        const clickedChip = event.target.closest('.chip');
        if (!clickedChip) return;

        document.querySelectorAll('#status-chips-container .chip').forEach(chip => chip.classList.remove('active'));
        clickedChip.classList.add('active');

        currentPage = 1;
        renderUI();
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            renderUI();
        });
    }

    // Pagination
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) return;
        currentPage = parseInt(button.dataset.page, 10);
        renderUI();
    });

    paginationContainer.addEventListener('keydown', (event) => {
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

    // New Request button
    const newRequestBtn = document.getElementById('new-request-btn');
    if (newRequestBtn) newRequestBtn.addEventListener('click', openModal);

    // Modal
    const closeBtn = document.getElementById('modal-close-btn');
    const modal = document.getElementById('request-modal');
    const form = document.getElementById('request-form');
    const dropdown = document.getElementById('request-dropdown');
    const submitButton = document.getElementById('modal-submit-btn');

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

            const config = getActiveConfig();
            const nameInput = document.getElementById('request-name-input');
            const requestName = nameInput ? nameInput.value.trim() : '';

            if (!requestName) {
                showToast(`Please enter a ${config.requestNameLabel}.`);
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
                let params;
                if (activeType === 'export') {
                    params = {
                        "ExportRequestName": requestName,
                        "LoomeAssistProjectID": parseInt(selectedAssistProjectID, 10),
                        "LoomeAssistName": selectedName,
                        "LoomeAssistTenantsID": selectedTenantsID
                    };
                } else {
                    params = {
                        "ImportRequestName": requestName,
                        "LoomeAssistProjectID": parseInt(selectedAssistProjectID, 10),
                        "LoomeAssistName": selectedName,
                        "LoomeAssistTenantsID": selectedTenantsID
                    };
                }

                await window.loomeApi.runApiRequest(config.submitApiId, params);
                showToast(`${activeType === 'export' ? 'Export' : 'Import'} request submitted successfully! Refreshing page in 5 seconds...`, "success");
                closeModal();
                await new Promise(resolve => setTimeout(resolve, 5000));
                await initializePage();
            } catch (error) {
                console.error('Failed to submit request:', error);
                showToast('An error occurred while submitting the request. Please try again.', "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Request';
            }
        });
    }

    // Escape key closes modal
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// =================================================================
//                      DOM CONTENT LOADED
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    activeType = 'export';

    // Render initial state
    renderStatusChips();
    updateNewRequestButton();
    updateSearchPlaceholder();

    // Setup all event listeners
    setupEventListeners();

    // Initialize
    initializePage();
});
