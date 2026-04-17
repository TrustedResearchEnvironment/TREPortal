// =================================================================
// UNIFIED REQUESTS DASHBOARD
// Each dashboard is wrapped in an IIFE module to avoid global
// variable collisions. Shared utilities live at the top level.
// =================================================================

// =================================================================
//                      SHARED UTILITIES
// =================================================================

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast-item toast-' + type;
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
        closeBtn.onclick = () => { if (toast.parentNode) toast.remove(); };
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
        setTimeout(() => { if (toast && toast.parentNode) toast.remove(); }, 300);
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
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sharedGetFromAPI(API_ID, initialParams) {
    return (async () => {
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
    })();
}

function renderPaginationHTML(currentPage, totalPages) {
    if (totalPages <= 1) return '';
    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage === totalPages;
    const btnCls = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100";
    const disCls = "opacity-50 cursor-not-allowed";
    return '<div class="flex items-center gap-2">' +
        '<button data-page="1" class="' + btnCls + (isFirstPage ? ' ' + disCls : '') + '"' + (isFirstPage ? ' disabled' : '') + '>First</button>' +
        '<button data-page="' + (currentPage - 1) + '" class="' + btnCls + (isFirstPage ? ' ' + disCls : '') + '"' + (isFirstPage ? ' disabled' : '') + '>Previous</button>' +
        '</div>' +
        '<div class="flex items-center gap-2 text-sm text-gray-700">' +
        '<span>Page</span>' +
        '<input type="number" class="page-input w-16 text-center border border-gray-300 rounded-md shadow-sm" value="' + currentPage + '" min="1" max="' + totalPages + '">' +
        '<span>of ' + totalPages + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
        '<button data-page="' + (currentPage + 1) + '" class="' + btnCls + (isLastPage ? ' ' + disCls : '') + '"' + (isLastPage ? ' disabled' : '') + '>Next</button>' +
        '<button data-page="' + totalPages + '" class="' + btnCls + (isLastPage ? ' ' + disCls : '') + '"' + (isLastPage ? ' disabled' : '') + '>Last</button>' +
        '</div>';
}

// =================================================================
//              DATA ACCESS REQUESTS MODULE (userreqs.js)
// =================================================================
const DataAccessModule = (function () {
    // --- Configuration ---
    const TABLE_CONTAINER_ID = 'da-requests-table-area';
    const PAGINATION_ID = 'da-pagination-controls';
    const CHIPS_CONTAINER_ID = 'da-status-chips-container';
    const SEARCH_ID = 'da-searchRequests';
    const REFRESH_BTN_ID = 'da-refresh-data-btn';
    const API_REQUEST_ID = 'GetRequests';
    const API_DELETE_REQUEST = 'DeleteRequestID';
    const API_GET_REQUEST_DETAILS = 'GetRequestID';
    const API_GET_DATASET_DETAILS = 'GetDataSetID';
    const API_GET_ASSIST_PROJECTS = 'GetAssistProjectsFilteredByUpn';

    const statusIdToNameMap = { 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected' };
    const configMap = {
        'Pending Approval': { showActions: true },
        'Approved': { showActions: true },
        'Rejected': { showActions: true },
        'Finalised': { showActions: true },
    };

    let allRequests = [];
    let currentPage = 1;
    let totalPages = 1;
    const rowsPerPage = 5;
    let projectsCache = null;
    let initialized = false;

    function getSearchInput() { return document.getElementById(SEARCH_ID); }

    async function getProjectsMapping() {
        if (projectsCache) return projectsCache;
        try {
            const data = await sharedGetFromAPI(API_GET_ASSIST_PROJECTS, { "page": 1, "page_size": 100, "search": '' });
            const mapping = {};
            if (data) data.forEach(p => { mapping[p.AssistProjectID] = { name: p.Name, description: p.Description }; });
            projectsCache = mapping;
            return mapping;
        } catch (e) { console.error("Error fetching projects:", e); return {}; }
    }

    async function fetchRequestDetails(requestID) {
        const response = await window.loomeApi.runApiRequest(API_GET_REQUEST_DETAILS, { "RequestID": requestID });
        return safeParseJson(response);
    }

    async function fetchDatasetDetails(datasetID) {
        const response = await window.loomeApi.runApiRequest(API_GET_DATASET_DETAILS, { "DataSetID": datasetID });
        return safeParseJson(response);
    }

    function getDataSourceName(dataSourceID) {
        const ds = { 1: 'BIS Data (pilot test)', 4: 'Barwon Health DB Source View 1', 25: 'Source Mock SQL Data for Testing' };
        return ds[dataSourceID] || 'Unknown Source (' + dataSourceID + ')';
    }

    async function displayCombinedDetails(container, requestDetails, datasetDetails) {
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

            let html = '<div class="grid grid-cols-2 gap-5"><div><div class="space-y-3">';
            html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Requested Dataset</span><span class="text-sm text-gray-500">' + ((datasetDetails && datasetDetails.Name) || 'N/A') + '</span></div>';
            if (datasetDetails && datasetDetails.Description) {
                html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Dataset Description</span><span class="text-sm text-gray-500">' + datasetDetails.Description + '</span></div>';
            }
            html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Data Source</span><span class="text-sm text-gray-500">' + ((datasetDetails && (datasetDetails.DataSource || datasetDetails.DataSourceID)) || 'N/A') + '</span></div>';
            html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Target Project Name</span><span class="text-sm text-gray-500">' + projectInfo.name + '</span></div>';
            if (projectInfo.description) {
                html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Project Description</span><span class="text-sm text-gray-500">' + projectInfo.description + '</span></div>';
            }
            html += '</div></div><div><div class="space-y-3">';
            if (requestDetails && requestDetails.Purpose) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Purpose</span><span class="text-sm text-gray-500">' + requestDetails.Purpose + '</span></div>';
            if (requestDetails && requestDetails.ApprovalMessage) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Approval Message</span><span class="text-sm text-gray-500">' + requestDetails.ApprovalMessage + '</span></div>';
            if (requestDetails && requestDetails.RejectionMessage) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Rejection Message</span><span class="text-sm text-gray-500">' + requestDetails.RejectionMessage + '</span></div>';
            html += '</div></div></div>';
            container.innerHTML = html;
        } catch (error) {
            console.error("Error displaying combined details:", error);
            container.innerHTML = '<div class="p-3 bg-red-50 border border-red-200 rounded-md"><p class="text-center text-red-500 mb-2">Error loading details</p><p class="text-sm">' + (error.message || 'Unknown error') + '</p></div>';
        }
    }

    function DeleteRequest(request) {
        const modalBody = document.getElementById('da-deleteRequestModalBody');
        const modalTitle = document.getElementById('da-deleteRequestModalLabel');
        modalTitle.textContent = 'Delete Request';
        modalBody.innerHTML = '<div class="col-md-12"><div class="alert alert-warning"><i class="fa fa-exclamation-triangle"></i> You are about to delete the request:<br><strong>' + request.Name + '</strong></div><div class="form-group mt-3 d-flex justify-content-center"><button id="da-confirmDeleteBtn" class="btn btn-danger px-3 py-1">Delete</button></div></div>';
        setTimeout(() => {
            const confirmBtn = document.getElementById('da-confirmDeleteBtn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => { deleteRequestFromAPI(request.RequestID); });
            }
        }, 100);
    }

    async function deleteRequestFromAPI(requestId) {
        let loadingToast = null;
        try {
            loadingToast = showToast('Deleting request...', 'info');
            await window.loomeApi.runApiRequest(API_DELETE_REQUEST, { "id": requestId });
            try {
                const deleteModal = bootstrap.Modal.getInstance(document.getElementById('da-deleteRequestModal'));
                if (deleteModal) deleteModal.hide();
            } catch (e) { console.error('Error hiding modal:', e); }
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

    function renderTable(containerId, data, config, selectedStatus, searchTerm) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'w-full divide-y divide-gray-200';
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        const headerRow = document.createElement('tr');

        const chevronTh = document.createElement('th');
        chevronTh.className = 'w-10 px-6 py-3';
        headerRow.appendChild(chevronTh);

        const headers = ['Request ID', 'Request Name', 'Requested On'];
        if (selectedStatus === 'Pending Approval') headers.push('Approvers');
        else if (selectedStatus === 'Approved') { headers.push('Approved by'); headers.push('Approved on'); }
        else if (selectedStatus === 'Rejected') { headers.push('Rejected by'); headers.push('Rejected on'); }
        else if (selectedStatus === 'Finalised') { headers.push('Approved by'); headers.push('Approved on'); headers.push('Finalised on'); }

        headers.forEach(h => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        if (data.length === 0) {
            const msg = (searchTerm && searchTerm.trim()) ? 'No requests found. Please review your search term.' : 'No requests found.';
            tbody.innerHTML = '<tr><td colspan="' + (headers.length + 1) + '" class="px-6 py-4 text-center text-sm text-gray-500">' + msg + '</td></tr>';
        } else {
            data.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'cursor-pointer hover:bg-gray-100';
                const td = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';

                let statusCols = '';
                switch (item.status) {
                    case 'Pending Approval': statusCols = '<td class="' + td + '">' + (item.Approvers || 'N/A') + '</td>'; break;
                    case 'Rejected': statusCols = '<td class="' + td + '">' + (item.RejectedBy || 'N/A') + '</td><td class="' + td + '">' + formatDate(item.RejectedDate) + '</td>'; break;
                    case 'Approved': statusCols = '<td class="' + td + '">' + (item.CurrentlyApproved || 'N/A') + '</td><td class="' + td + '">' + formatDate(item.ApprovedDate) + '</td>'; break;
                    case 'Finalised': statusCols = '<td class="' + td + '">' + (item.CurrentlyApproved || 'N/A') + '</td><td class="' + td + '">' + formatDate(item.ApprovedDate) + '</td><td class="' + td + '">' + formatDate(item.FinalisedDate) + '</td>'; break;
                }

                row.innerHTML = '<td class="' + td + ' text-center"><svg class="chevron-icon h-5 w-5 text-gray-500 transform transition-transform duration-200 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></td>' +
                    '<td class="' + td + '">' + item.RequestID + '</td>' +
                    '<td class="' + td + '">' + item.Name + '</td>' +
                    '<td class="' + td + '">' + formatDate(item.CreateDate) + '</td>' +
                    statusCols;

                const accordionRow = document.createElement('tr');
                accordionRow.classList.add('hidden', 'accordion-row');

                if (selectedStatus === 'Pending Approval') {
                    accordionRow.innerHTML = '<td colspan="' + (headers.length + 1) + '" class="p-0"><div class="bg-gray-50 p-4 m-2 rounded"><div class="grid grid-cols-1 gap-4"><div class="flex justify-end mb-1"><button class="btn btn-danger action-delete px-3 py-1" data-bs-toggle="modal" data-bs-target="#da-deleteRequestModal">Delete</button></div><div class="bg-white p-5 rounded-md shadow-sm"><div id="da-combined-details-' + item.RequestID + '" class="combined-content"><p class="text-center text-gray-500">Loading details...</p></div></div></div></div></td>';
                } else {
                    accordionRow.innerHTML = '<td colspan="' + (headers.length + 1) + '" class="p-0"><div class="bg-gray-50 p-4 m-2 rounded"><div class="grid grid-cols-1 gap-4"><div class="bg-white p-5 rounded-md shadow-sm"><div id="da-combined-details-' + item.RequestID + '" class="combined-content"><p class="text-center text-gray-500">Loading details...</p></div></div></div></div></td>';
                }

                row.addEventListener('click', async () => {
                    accordionRow.classList.toggle('hidden');
                    const chevron = row.querySelector('.chevron-icon');
                    if (chevron) chevron.classList.toggle('rotate-180');

                    if (!accordionRow.classList.contains('hidden')) {
                        const detailsEl = accordionRow.querySelector('#da-combined-details-' + item.RequestID);
                        detailsEl.innerHTML = '<p class="text-center">Loading details...</p>';
                        try {
                            let reqDetails = null;
                            try { reqDetails = await fetchRequestDetails(item.RequestID); } catch (e) { console.error(e); }
                            let dsDetails = null;
                            try { dsDetails = await fetchDatasetDetails(item.DataSetID); } catch (e) { console.error(e); }
                            if (!reqDetails && !dsDetails) throw new Error('Failed to fetch details');
                            await displayCombinedDetails(detailsEl, reqDetails, dsDetails);
                        } catch (error) {
                            detailsEl.innerHTML = '<div class="p-3 bg-red-50 border border-red-200 rounded-md"><p class="text-center text-red-500 mb-2">Error loading details</p><p class="text-sm">' + (error.message || '') + '</p></div>';
                        }
                    }
                });

                const deleteBtn = accordionRow.querySelector('.action-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); DeleteRequest(item); });
                }

                tbody.appendChild(row);
                tbody.appendChild(accordionRow);
            });
        }

        table.appendChild(tbody);
        container.appendChild(table);
    }

    function renderPagination() {
        const container = document.getElementById(PAGINATION_ID);
        if (!container) return;
        container.innerHTML = renderPaginationHTML(currentPage, totalPages);
    }

    async function getCounts(status) {
        const apiParams = {
            "page": 1, "pageSize": 1, "search": '',
            "statusId": parseInt(Object.keys(statusIdToNameMap).find(key => statusIdToNameMap[key] === status))
        };
        const response = await window.loomeApi.runApiRequest(API_REQUEST_ID, apiParams);
        return safeParseJson(response).RowCount;
    }

    async function refreshAllChipCounts() {
        const chipsContainer = document.getElementById(CHIPS_CONTAINER_ID);
        if (!chipsContainer) return;
        for (const chip of chipsContainer.querySelectorAll('.chip')) {
            const status = chip.dataset.status;
            const count = await getCounts(status);
            chip.querySelector('.chip-count').textContent = count;
        }
    }

    async function renderUI() {
        const activeChip = document.querySelector('#' + CHIPS_CONTAINER_ID + ' .chip.active');
        if (!activeChip) return;
        const selectedStatus = activeChip.dataset.status;
        const searchInput = getSearchInput();
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const apiParams = {
            "page": currentPage, "pageSize": rowsPerPage, "search": searchTerm,
            "statusId": parseInt(Object.keys(statusIdToNameMap).find(key => statusIdToNameMap[key] === selectedStatus))
        };
        const response = await window.loomeApi.runApiRequest(API_REQUEST_ID, apiParams);
        const parsedResponse = safeParseJson(response);
        const rawData = parsedResponse.Results;
        const totalItems = parsedResponse.RowCount;

        allRequests = rawData.map(item => ({ ...item, status: statusIdToNameMap[item.StatusID] || 'Unknown' }));
        totalPages = Math.ceil(totalItems / rowsPerPage);
        renderTable(TABLE_CONTAINER_ID, allRequests, configMap[selectedStatus], selectedStatus, searchTerm);

        const paginationContainer = document.getElementById(PAGINATION_ID);
        paginationContainer.innerHTML = renderPaginationHTML(currentPage, totalPages);
    }

    async function refreshPageData() {
        let loadingToast = null;
        try {
            loadingToast = showToast('Refreshing data...', 'info');
            await renderUI();
            await refreshAllChipCounts();
            if (loadingToast) hideToast(loadingToast);
            showToast('Data refreshed', 'success');
        } catch (error) {
            if (loadingToast) hideToast(loadingToast);
            showToast('Failed to refresh data.', 'error');
        }
    }

    async function init() {
        if (initialized) return;
        initialized = true;

        await refreshAllChipCounts();

        const refreshBtn = document.getElementById(REFRESH_BTN_ID);
        if (refreshBtn) refreshBtn.addEventListener('click', refreshPageData);

        const chipsContainer = document.getElementById(CHIPS_CONTAINER_ID);
        chipsContainer.addEventListener('click', (event) => {
            const clickedChip = event.target.closest('.chip');
            if (!clickedChip) return;
            chipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            clickedChip.classList.add('active');
            currentPage = 1;
            renderUI();
        });

        const searchInput = getSearchInput();
        if (searchInput) {
            searchInput.addEventListener('input', () => { currentPage = 1; renderUI(); });
        }

        const paginationContainer = document.getElementById(PAGINATION_ID);
        paginationContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            currentPage = parseInt(button.dataset.page, 10);
            renderUI();
        });
        paginationContainer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.classList.contains('page-input')) {
                const newPage = parseInt(event.target.value, 10);
                if (newPage >= 1 && newPage <= totalPages) { currentPage = newPage; renderUI(); }
                else { showToast('Please enter a page number between 1 and ' + totalPages + '.', 'error'); event.target.value = currentPage; }
            }
        });

        // Trigger initial render
        const firstChip = document.querySelector('#' + CHIPS_CONTAINER_ID + ' .chip[data-status="Pending Approval"]');
        if (firstChip) firstChip.click();
    }

    return { init: init };
})();


// =================================================================
//              IMPORT REQUESTS MODULE (ImportData.js)
// =================================================================
const ImportModule = (function () {
    const TABLE_CONTAINER_ID = 'imp-import-jobs-table-area';
    const PAGINATION_ID = 'imp-pagination-controls';
    const CHIPS_CONTAINER_ID = 'imp-status-chips-container';
    const SEARCH_ID = 'imp-searchImports';
    const REFRESH_BTN_ID = 'imp-refresh-data-btn';
    const GET_DATAIMPORT_FROM_DB = 'GetDataImportFromDBbyUpn';
    const IMPORT_REQUEST_API_ID = 'GetAssistProjectsFilteredByUpn';
    const SUBMIT_IMPORT_API_ID = 'RequestDataImportByAssistProjectID';
    const UPDATE_IMPORT_REQUEST = 'UpdateDataImportRequestStatus';
    const DELETE_IMPORT_REQUEST = 'DeleteImportRequest';

    const MODAL_ID = 'imp-import-modal';
    const OPEN_MODAL_BTN_ID = 'imp-request-import-btn';
    const CLOSE_MODAL_BTN_ID = 'imp-modal-close-btn';
    const IMPORT_FORM_ID = 'imp-import-form';
    const DROPDOWN_ID = 'imp-import-type';
    const SUBMIT_MODAL_BTN_ID = 'imp-modal-submit-btn';

    const statusIdToNameMap = {};
    statusIdToNameMap[-2] = 'Failed';
    statusIdToNameMap[-1] = 'Working';
    statusIdToNameMap[0] = 'Awaiting Submission';
    statusIdToNameMap[1] = 'Pending Approval';
    statusIdToNameMap[2] = 'Approved';
    statusIdToNameMap[3] = 'Finalised';
    statusIdToNameMap[4] = 'Rejected';

    const configMap = {
        'Failed': { showActions: false }, 'Working': { showActions: false },
        'Awaiting Submission': { showActions: true }, 'Pending Approval': { showActions: false },
        'Approved': { showActions: false }, 'Rejected': { showActions: false }, 'Finalised': { showActions: false },
    };

    let currentPage = 1;
    let totalPages = 1;
    const rowsPerPage = 5;
    let allJobs = [];
    let isDropdownPopulated = false;
    let projectsCache = null;
    let initialized = false;

    function getSearchInput() { return document.getElementById(SEARCH_ID); }

    function getStatusChipColor(status) {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'failed': return 'bg-red-100 text-red-800';
            case 'working': return 'bg-purple-100 text-purple-800';
            case 'awaiting submission': return 'bg-yellow-100 text-yellow-800';
            case 'pending approval': return 'bg-blue-100 text-blue-800';
            case 'approved': case 'finalised': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    async function getProjectsMapping() {
        if (projectsCache) return projectsCache;
        try {
            const data = await sharedGetFromAPI(IMPORT_REQUEST_API_ID, { "page": 1, "page_size": 100, "search": '' });
            const mapping = {};
            if (data) data.forEach(p => { mapping[p.AssistProjectID] = { name: p.Name, description: p.Description }; });
            projectsCache = mapping;
            return mapping;
        } catch (e) { console.error("Error fetching projects:", e); return {}; }
    }

    async function fetchRequestDetails(requestID) {
        const response = await window.loomeApi.runApiRequest('GetImportRequestByID', { "RequestID": requestID });
        return safeParseJson(response);
    }

    async function displayCombinedDetails(container, requestDetails) {
        if (!requestDetails || Object.keys(requestDetails).length === 0) {
            container.innerHTML = '<p class="text-center text-red-500">No details available</p>';
            return;
        }
        try {
            await getProjectsMapping();
            let html = '<div class="grid grid-cols-2 gap-5"><div><div class="space-y-3">';
            html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Import Request ID</span><span class="text-sm text-gray-500">' + (requestDetails.ImportRequestID || 'N/A') + '</span></div>';
            html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Target Project Name</span><span class="text-sm text-gray-500">' + requestDetails.ProjectName + '</span></div>';
            html += '</div></div><div><div class="space-y-3">';
            if (requestDetails.ApprovedBy) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Approved By</span><span class="text-sm text-gray-500">' + requestDetails.ApprovedBy + '</span></div>';
            if (requestDetails.ApprovedDate) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Approved On</span><span class="text-sm text-gray-500">' + formatDate(requestDetails.ApprovedDate) + '</span></div>';
            if (requestDetails.ApprovalMessage) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Approval Message</span><span class="text-sm text-gray-500">' + requestDetails.ApprovalMessage + '</span></div>';
            if (requestDetails.RejectedBy) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Rejected By</span><span class="text-sm text-gray-500">' + requestDetails.RejectedBy + '</span></div>';
            if (requestDetails.RejectedDate) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Rejected On</span><span class="text-sm text-gray-500">' + formatDate(requestDetails.RejectedDate) + '</span></div>';
            if (requestDetails.RejectionMessage) html += '<div class="grid grid-cols-1 gap-1"><span class="font-medium">Rejection Message</span><span class="text-sm text-gray-500">' + requestDetails.RejectionMessage + '</span></div>';
            html += '</div></div></div>';
            container.innerHTML = html;
        } catch (error) {
            console.error("Error displaying combined details:", error);
            container.innerHTML = '<div class="p-3 bg-red-50 border border-red-200 rounded-md"><p class="text-center text-red-500 mb-2">Error loading details</p><p class="text-sm">' + (error.message || '') + '</p></div>';
        }
    }

    // Exposed globally for inline onclick in rendered HTML
    window._impSubmitImportJob = async function (importRequestID) {
        try {
            if (!confirm('Are you sure you want to submit the import job?')) return;
            showToast('Submitting import job...', 'info');
            const params = { ImportRequestID: parseInt(importRequestID, 10), statusID: 1 };
            const response = await window.loomeApi.runApiRequest(UPDATE_IMPORT_REQUEST, params);
            const parsed = safeParseJson(response);
            if (parsed && parsed.StatusID === 1) {
                showToast('Import job submitted successfully!', 'success');
                setTimeout(() => { initializePage(); }, 1000);
            } else {
                showToast('Failed to submit import job: ' + (parsed?.message || parsed?.Message || 'Submission failed'), 'error');
            }
        } catch (e) { console.error(e); showToast('Failed to submit import job.', 'error'); }
    };

    window._impDeleteImportJob = async function (importRequestID) {
        try {
            if (!confirm('Are you sure you want to delete the import job? This action cannot be undone.')) return;
            showToast('Deleting import job...', 'info');
            const response = await window.loomeApi.runApiRequest(DELETE_IMPORT_REQUEST, { ImportRequestID: importRequestID });
            const parsed = safeParseJson(response);
            if (parsed) {
                showToast('Import job deleted successfully!', 'success');
                setTimeout(() => { initializePage(); }, 1000);
            } else {
                showToast('Failed to delete import job.', 'error');
            }
        } catch (e) { console.error(e); showToast('Failed to delete import job.', 'error'); }
    };

    function renderTable(containerId, data, config, selectedStatus, searchTerm) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (!data || data.length === 0) {
            const msg = (searchTerm && searchTerm.trim()) ? 'No import jobs found. Please review your search term.' : 'No import jobs found.';
            container.innerHTML = '<p class="text-center text-gray-500">' + msg + '</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'w-full divide-y divide-gray-200';
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        const headerRow = document.createElement('tr');

        const chevronTh = document.createElement('th');
        chevronTh.className = 'w-10 px-6 py-3';
        headerRow.appendChild(chevronTh);

        const headers = ['Import Request Name', 'Requested On', 'Import Project Name'];
        if (selectedStatus === 'Awaiting Submission') headers.push('Status');
        else if (selectedStatus === 'Approved') { headers.push('Approved by'); headers.push('Approved on'); headers.push('Status'); }
        else if (selectedStatus === 'Rejected') headers.push('Rejected on');
        else if (selectedStatus === 'Finalised') headers.push('Finalised on');

        headers.forEach(h => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        data.forEach((item, index) => {
            const statusId = item.StatusID ?? 0;
            const itemStatus = statusIdToNameMap[statusId] !== undefined ? statusIdToNameMap[statusId] : 'Awaiting Submission';
            const td = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';

            let statusCols = '';
            switch (item.status) {
                case 'Rejected': statusCols = '<td class="' + td + '">' + (item.RejectedBy || 'N/A') + '</td><td class="' + td + '">' + formatDate(item.RejectedDate) + '</td>'; break;
                case 'Approved': statusCols = '<td class="' + td + '">' + (item.ApprovedBy || 'N/A') + '</td><td class="' + td + '">' + formatDate(item.ApprovedDate) + '</td>'; break;
                case 'Finalised': statusCols = '<td class="' + td + '">' + formatDate(item.FinalisedDate) + '</td>'; break;
            }

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 cursor-pointer';
            row.innerHTML = '<td class="w-10 px-6 py-4"><button class="toggle-details flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600"><svg class="w-4 h-4 transition-transform duration-200 transform chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button></td>' +
                '<td class="' + td + '">' + (item.ImportRequestName || 'N/A') + '</td>' +
                '<td class="' + td + '">' + formatDate(item.CreateDate) + '</td>' +
                '<td class="' + td + '">' + (item.ImportProjectName || 'N/A') + '</td>' +
                statusCols +
                (selectedStatus === 'Awaiting Submission' ? '<td class="' + td + '"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + getStatusChipColor(itemStatus) + '">' + itemStatus + '</span></td>' : '') +
                (selectedStatus === 'Approved' ? '<td class="' + td + '"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + getStatusChipColor(itemStatus) + '">Data Transfer In Progress</span></td>' : '');
            tbody.appendChild(row);

            const detailRow = document.createElement('tr');
            detailRow.className = 'details-row hidden';
            detailRow.innerHTML = '<td colspan="' + (headers.length + 1) + '" class="p-0"><div class="bg-gray-50 p-4 m-2 rounded"><div class="grid grid-cols-1 gap-4"><div class="flex justify-end mb-1">' +
                ((itemStatus === 'Awaiting Submission' || itemStatus === 'Working' || itemStatus === 'Failed') ? '<button onclick="_impDeleteImportJob(\'' + item.ImportRequestID + '\')" class="btn btn-danger px-3 py-1">Delete</button>' : '') +
                ((itemStatus === 'Awaiting Submission' && config.showActions) ? '<button onclick="_impSubmitImportJob(\'' + item.ImportRequestID + '\')" class="btn btn-primary px-3 py-1 ms-2">Submit Import</button>' : '') +
                '</div><div class="bg-white p-5 rounded-md shadow-sm"><div id="imp-combined-details-' + item.ImportRequestID + '" class="combined-content"><p class="text-center text-gray-500">Loading details...</p></div></div></div></div></td>';
            tbody.appendChild(detailRow);

            row.addEventListener('click', async () => {
                detailRow.classList.toggle('hidden');
                const chevron = row.querySelector('.chevron-icon');
                if (chevron) chevron.style.transform = detailRow.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';

                if (!detailRow.classList.contains('hidden')) {
                    const detailsEl = detailRow.querySelector('#imp-combined-details-' + item.ImportRequestID);
                    detailsEl.innerHTML = '<p class="text-center">Loading details...</p>';
                    try {
                        const reqDetails = await fetchRequestDetails(item.ImportRequestID);
                        if (!reqDetails) throw new Error('Failed to fetch request details');
                        await displayCombinedDetails(detailsEl, reqDetails);
                    } catch (error) {
                        detailsEl.innerHTML = '<div class="p-3 bg-red-50 border border-red-200 rounded-md"><p class="text-center text-red-500 mb-2">Error loading details</p><p class="text-sm">' + (error.message || '') + '</p></div>';
                    }
                }
            });
        });

        table.appendChild(tbody);
        container.appendChild(table);
    }

    function renderUI() {
        const activeChip = document.querySelector('#' + CHIPS_CONTAINER_ID + ' .chip.active');
        const selectedStatus = activeChip ? activeChip.dataset.status : 'Awaiting Submission';
        const searchInput = getSearchInput();
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const config = configMap[selectedStatus];

        let filteredJobs = allJobs.filter(job => {
            const statusId = job.StatusID ?? 0;
            const jobStatus = statusIdToNameMap[statusId] || 'Awaiting Submission';
            if (selectedStatus === 'Awaiting Submission') return jobStatus === 'Failed' || jobStatus === 'Working' || jobStatus === 'Awaiting Submission';
            return jobStatus === selectedStatus;
        });

        const startIndex = (currentPage - 1) * rowsPerPage;
        const importRequests = filteredJobs.slice(startIndex, startIndex + rowsPerPage);
        const importRequestsWithStatus = importRequests.map(item => ({ ...item, status: statusIdToNameMap[item.StatusID] || 'Unknown' }));

        renderTable(TABLE_CONTAINER_ID, importRequestsWithStatus, config, selectedStatus, searchTerm);
        totalPages = Math.ceil(filteredJobs.length / rowsPerPage);
        document.getElementById(PAGINATION_ID).innerHTML = renderPaginationHTML(currentPage, totalPages);
    }

    async function getCounts(status) {
        return allJobs.filter(job => {
            const statusId = job.StatusID ?? 0;
            const jobStatus = statusIdToNameMap[statusId] || 'Awaiting Submission';
            if (status === 'Awaiting Submission') return jobStatus === 'Failed' || jobStatus === 'Working' || jobStatus === 'Awaiting Submission';
            return jobStatus === status;
        }).length;
    }

    async function refreshAllChipCounts() {
        const chipsContainer = document.getElementById(CHIPS_CONTAINER_ID);
        if (!chipsContainer) return;
        for (const chip of chipsContainer.querySelectorAll('.chip')) {
            const count = await getCounts(chip.dataset.status);
            const countSpan = chip.querySelector('.chip-count');
            if (countSpan) countSpan.textContent = count;
        }
    }

    async function initializePage() {
        const container = document.getElementById(TABLE_CONTAINER_ID);
        if (!container) return;
        container.innerHTML = '<p class="text-center text-gray-500">Loading Import Jobs...</p>';
        try {
            const initialResponse = await window.loomeApi.runApiRequest(GET_DATAIMPORT_FROM_DB, { page: 1, pageSize: 1, search: '' });
            const initialData = safeParseJson(initialResponse);
            const totalJobs = initialData.RowCount;
            allJobs = [];
            if (totalJobs > 0) {
                const allDataResponse = await window.loomeApi.runApiRequest(GET_DATAIMPORT_FROM_DB, { page: 1, pageSize: totalJobs, search: '' });
                const allData = safeParseJson(allDataResponse);
                allJobs = (allData.Results || []).slice();
                allJobs.sort((a, b) => {
                    const ta = a && a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                    const tb = b && b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                    return tb - ta;
                });
            }
            await refreshAllChipCounts();
            renderUI();
        } catch (error) {
            console.error("Error initializing import page:", error);
            container.innerHTML = '<p class="text-center text-red-500">Failed to load data.</p>';
        }
    }

    async function refreshPageData() {
        try {
            showToast('Refreshing data...', 'info');
            await initializePage();
            showToast('Data refreshed successfully.', 'success');
        } catch (error) {
            showToast('Failed to refresh data.', 'error');
        }
    }

    async function populateAssistProjectsDropdown() {
        const dropdown = document.getElementById(DROPDOWN_ID);
        if (!dropdown) return;
        dropdown.disabled = true;
        dropdown.innerHTML = '<option value="">Loading...</option>';
        try {
            const response = await window.loomeApi.runApiRequest(IMPORT_REQUEST_API_ID, {});
            const data = safeParseJson(response);
            const projects = data.Results;
            dropdown.innerHTML = '<option value="">Select Target Assist Project...</option>';
            if (projects && projects.length > 0) {
                projects.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.AssistProjectID;
                    opt.textContent = p.Name;
                    opt.dataset.name = p.Name;
                    opt.dataset.tenantsId = p.LoomeAssistTenantsID;
                    dropdown.appendChild(opt);
                });
                isDropdownPopulated = true;
            } else {
                dropdown.innerHTML = '<option value="">No Assist Project found.</option>';
            }
        } catch (e) {
            dropdown.innerHTML = '<option value="">Error loading options.</option>';
        } finally { dropdown.disabled = false; }
    }

    function openModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById(DROPDOWN_ID).selectedIndex = 0;
            document.getElementById(SUBMIT_MODAL_BTN_ID).disabled = true;
            const nameInput = document.getElementById('imp-import-request-name');
            if (nameInput) nameInput.value = '';
            if (!isDropdownPopulated) populateAssistProjectsDropdown();
        }
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.classList.add('hidden');
    }

    async function init() {
        if (initialized) return;
        initialized = true;

        document.getElementById(REFRESH_BTN_ID)?.addEventListener('click', refreshPageData);

        const chipsContainer = document.getElementById(CHIPS_CONTAINER_ID);
        if (chipsContainer) {
            chipsContainer.addEventListener('click', (event) => {
                const chip = event.target.closest('.chip');
                if (!chip) return;
                chipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentPage = 1;
                renderUI();
            });
        }

        const searchInput = getSearchInput();
        if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; renderUI(); });

        const paginationContainer = document.getElementById(PAGINATION_ID);
        paginationContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            currentPage = parseInt(button.dataset.page, 10);
            renderUI();
        });
        paginationContainer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.classList.contains('page-input')) {
                const newPage = parseInt(event.target.value, 10);
                if (newPage >= 1 && newPage <= totalPages) { currentPage = newPage; renderUI(); }
                else { showToast('Please enter a page number between 1 and ' + totalPages + '.', 'error'); event.target.value = currentPage; }
            }
        });

        const openBtn = document.getElementById(OPEN_MODAL_BTN_ID);
        const closeBtn = document.getElementById(CLOSE_MODAL_BTN_ID);
        const modal = document.getElementById(MODAL_ID);
        const form = document.getElementById(IMPORT_FORM_ID);
        const dropdown = document.getElementById(DROPDOWN_ID);
        const submitButton = document.getElementById(SUBMIT_MODAL_BTN_ID);

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dropdown && submitButton) dropdown.addEventListener('change', () => { submitButton.disabled = !dropdown.value; });
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const nameInput = document.getElementById('imp-import-request-name');
                const importName = nameInput ? nameInput.value.trim() : '';
                if (!importName) { showToast('Please enter an Import Request Name.'); return; }
                const selectedOption = dropdown.options[dropdown.selectedIndex];
                if (!selectedOption || !selectedOption.value) { showToast('Please select an Assist Project.'); return; }
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
                try {
                    const params = {
                        "ImportRequestName": importName,
                        "LoomeAssistProjectID": parseInt(selectedOption.value, 10),
                        "LoomeAssistName": selectedOption.dataset.name,
                        "LoomeAssistTenantsID": selectedOption.dataset.tenantsId
                    };
                    await window.loomeApi.runApiRequest(SUBMIT_IMPORT_API_ID, params);
                    showToast('Import request submitted successfully! Refreshing page in 5 seconds...', 'success');
                    closeModal();
                    await new Promise(r => setTimeout(r, 5000));
                    await initializePage();
                } catch (e) {
                    showToast('An error occurred while submitting the request.', 'error');
                } finally { submitButton.disabled = false; submitButton.textContent = 'Submit Request'; }
            });
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal(); });

        await initializePage();
    }

    return { init: init };
})();


// =================================================================
//              EXPORT REQUESTS MODULE (exportData.js)
// =================================================================
const ExportModule = (function () {
    const TABLE_CONTAINER_ID = 'exp-export-jobs-table-area';
    const PAGINATION_ID = 'exp-pagination-controls';
    const REFRESH_BTN_ID = 'exp-refresh-data-btn';
    const API_REQUEST_ID = 'GetDataExport';
    const EXPORT_REQUEST_API_ID = 'GetAssistProjectsFilteredByUpn';
    const SUBMIT_EXPORT_API_ID = 'RequestDataExportByAssistProjectID';

    const MODAL_ID = 'exp-export-modal';
    const OPEN_MODAL_BTN_ID = 'exp-request-export-btn';
    const CLOSE_MODAL_BTN_ID = 'exp-modal-close-btn';
    const EXPORT_FORM_ID = 'exp-export-form';
    const DROPDOWN_ID = 'exp-export-type';
    const SUBMIT_MODAL_BTN_ID = 'exp-modal-submit-btn';

    let currentPage = 1;
    const rowsPerPage = 5;
    let allJobs = [];
    let isDropdownPopulated = false;
    let initialized = false;

    async function populateAssistProjectsDropdown() {
        const dropdown = document.getElementById(DROPDOWN_ID);
        if (!dropdown) return;
        dropdown.disabled = true;
        dropdown.innerHTML = '<option value="">Loading...</option>';
        try {
            const response = await window.loomeApi.runApiRequest(EXPORT_REQUEST_API_ID, {});
            const data = safeParseJson(response);
            const projects = data.Results;
            dropdown.innerHTML = '<option value="">Select source Assist Project...</option>';
            if (projects && projects.length > 0) {
                projects.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.AssistProjectID;
                    opt.textContent = p.Name;
                    opt.dataset.name = p.Name;
                    opt.dataset.tenantsId = p.LoomeAssistTenantsID;
                    dropdown.appendChild(opt);
                });
                isDropdownPopulated = true;
            } else {
                dropdown.innerHTML = '<option value="">No Assist Project found.</option>';
            }
        } catch (e) {
            dropdown.innerHTML = '<option value="">Error loading options.</option>';
        } finally { dropdown.disabled = false; }
    }

    function openModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById(DROPDOWN_ID).selectedIndex = 0;
            document.getElementById(SUBMIT_MODAL_BTN_ID).disabled = true;
            if (!isDropdownPopulated) populateAssistProjectsDropdown();
        }
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.classList.add('hidden');
    }

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
        ['Job Name', 'Date Created', 'Status'].forEach(h => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">' + (item.jobName || 'N/A') + '</td>' +
                '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">' + formatDate(item.dateCreated) + '</td>' +
                '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">' + (item.lastExecution.status ?? 'In progress') + '</td>';
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    function renderUI() {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const jobsForPage = allJobs.slice(startIndex, startIndex + rowsPerPage);
        renderTable(TABLE_CONTAINER_ID, jobsForPage);
        const totalPages = Math.ceil(allJobs.length / rowsPerPage);
        document.getElementById(PAGINATION_ID).innerHTML = renderPaginationHTML(currentPage, totalPages);
    }

    async function initializePage() {
        const container = document.getElementById(TABLE_CONTAINER_ID);
        if (!container) return;
        container.innerHTML = '<p class="text-center text-gray-500">Loading Requests...</p>';
        try {
            const initialResponse = await window.loomeApi.runApiRequest(API_REQUEST_ID, { page: 1, pageSize: 1 });
            const initialData = safeParseJson(initialResponse);
            const totalJobs = initialData.RowCount;
            allJobs = [];
            if (totalJobs > 0) {
                const allDataResponse = await window.loomeApi.runApiRequest(API_REQUEST_ID, { page: 1, pageSize: totalJobs });
                const allData = safeParseJson(allDataResponse);
                allJobs = (allData.Results || []).slice();
                allJobs.sort((a, b) => {
                    const ta = a && a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                    const tb = b && b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                    return tb - ta;
                });
            }
            renderUI();
        } catch (error) {
            console.error("Error initializing export page:", error);
            container.innerHTML = '<p class="text-center text-red-500">Failed to load data.</p>';
        }
    }

    async function refreshPageData() {
        try {
            showToast('Refreshing data...', 'info');
            await initializePage();
            showToast('Data refreshed successfully.', 'success');
        } catch (e) { showToast('Failed to refresh data.', 'error'); }
    }

    async function init() {
        if (initialized) return;
        initialized = true;

        document.getElementById(REFRESH_BTN_ID)?.addEventListener('click', refreshPageData);

        const paginationContainer = document.getElementById(PAGINATION_ID);
        paginationContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            currentPage = parseInt(button.dataset.page, 10);
            renderUI();
        });
        paginationContainer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.classList.contains('page-input')) {
                const tp = Math.ceil(allJobs.length / rowsPerPage);
                const newPage = parseInt(event.target.value, 10);
                if (newPage >= 1 && newPage <= tp) { currentPage = newPage; renderUI(); }
                else { showToast('Please enter a page number between 1 and ' + tp + '.', 'error'); event.target.value = currentPage; }
            }
        });

        const openBtn = document.getElementById(OPEN_MODAL_BTN_ID);
        const closeBtn = document.getElementById(CLOSE_MODAL_BTN_ID);
        const modal = document.getElementById(MODAL_ID);
        const form = document.getElementById(EXPORT_FORM_ID);
        const dropdown = document.getElementById(DROPDOWN_ID);
        const submitButton = document.getElementById(SUBMIT_MODAL_BTN_ID);

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dropdown && submitButton) dropdown.addEventListener('change', () => { submitButton.disabled = !dropdown.value; });
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const selectedOption = dropdown.options[dropdown.selectedIndex];
                if (!selectedOption || !selectedOption.value) { showToast('Please select an Assist Project.'); return; }
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
                try {
                    const params = {
                        "LoomeAssistProjectID": parseInt(selectedOption.value, 10),
                        "LoomeAssistName": selectedOption.dataset.name,
                        "LoomeAssistTenantsID": selectedOption.dataset.tenantsId
                    };
                    await window.loomeApi.runApiRequest(SUBMIT_EXPORT_API_ID, params);
                    showToast('Export request submitted successfully.', 'success');
                    closeModal();
                    await initializePage();
                } catch (e) {
                    showToast('An error occurred while submitting the request.', 'error');
                } finally { submitButton.disabled = false; submitButton.textContent = 'Submit Request'; }
            });
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal(); });

        await initializePage();
    }

    return { init: init };
})();


// =================================================================
//                   TAB SWITCHING & INITIALIZATION
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = {
        'data-access': document.getElementById('tab-data-access'),
        'import': document.getElementById('tab-import'),
        'export': document.getElementById('tab-export')
    };
    const modules = {
        'data-access': DataAccessModule,
        'import': ImportModule,
        'export': ExportModule
    };
    const initializedTabs = new Set();

    function switchTab(tabId) {
        // Update buttons
        tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        // Show/hide panels
        Object.entries(tabPanels).forEach(([id, panel]) => panel.classList.toggle('active', id === tabId));
        // Lazy-init the module on first activation
        if (!initializedTabs.has(tabId)) {
            initializedTabs.add(tabId);
            modules[tabId].init();
        }
    }

    tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    // Initialize the first tab
    switchTab('data-access');
});
