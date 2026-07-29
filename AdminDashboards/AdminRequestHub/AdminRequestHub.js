// =================================================================
//  UserRequestsAdmin.js — Admin Request Management Dashboard
//  Tabs: Data Access | Data Import | Data Export
// =================================================================

// =================================================================
// SHARED UTILITIES
// =================================================================

function safeParseJson(response) {
    if (typeof response === 'string') {
        try { return JSON.parse(response); } catch (e) { return null; }
    }
    return response;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function formatDate(inputDate) {
    if (!inputDate) return 'N/A';
    const d = new Date(inputDate);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showToast(message, type = 'success', duration = 5000) {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    container.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    const bgMap = { success: '#1AABA3', error: '#dc3545', warning: '#fd7e14', info: '#0dcaf0' };
    const toast = document.createElement('div');
    toast.style.cssText = [
        `background:${bgMap[type] || bgMap.info}`, 'color:#fff', 'padding:11px 16px', 'border-radius:6px',
        'display:flex', 'align-items:center', 'gap:10px', 'min-width:260px', 'max-width:420px',
        'box-shadow:0 4px 12px rgba(0,0,0,.15)', 'opacity:0', 'transform:translateY(-6px)', 'transition:opacity .18s,transform .18s'
    ].join(';');
    const txt = document.createElement('span');
    txt.style.flex = '1'; txt.textContent = message;
    toast.appendChild(txt);
    if (type === 'error') {
        const x = document.createElement('button');
        x.innerHTML = '&times;';
        x.style.cssText = 'background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0;line-height:1';
        x.onclick = () => dismissToast(toast);
        toast.appendChild(x);
    }
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    if (type !== 'error') setTimeout(() => dismissToast(toast), duration);
    return toast;
}

function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
}

function getStatusBadgeHtml(status) {
    const map = {
        'pending approval': 'bg-blue-100 text-blue-800',
        'approved':         'bg-green-100 text-green-800',
        'finalised':        'bg-green-100 text-green-800',
        'rejected':         'bg-red-100 text-red-800',
        'failed':           'bg-red-100 text-red-800',
        'working':          'bg-purple-100 text-purple-800',
        'awaiting submission': 'bg-yellow-100 text-yellow-800',
        'superseded':          'bg-gray-200 text-gray-800',
    };
    const cls = map[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${status || 'Unknown'}</span>`;
}

function renderPaginationHtml(containerId, totalItems, rowsPerPage, currentPage) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    const d = v => v ? 'disabled' : '';
    const btnCls = 'btn btn-sm btn-outline-secondary';
    el.innerHTML = `
        <button class="${btnCls}" data-page="1" ${d(currentPage === 1)}>First</button>
        <button class="${btnCls}" data-page="${currentPage - 1}" ${d(currentPage === 1)}>‹ Prev</button>
        <span class="d-flex align-items-center gap-1 small text-muted">
            Page <input id="${containerId}-input" type="number" value="${currentPage}" min="1" max="${totalPages}"
                        class="form-control form-control-sm text-center" style="width:54px"> of ${totalPages}
        </span>
        <button class="${btnCls}" data-page="${currentPage + 1}" ${d(currentPage === totalPages)}>Next ›</button>
        <button class="${btnCls}" data-page="${totalPages}" ${d(currentPage === totalPages)}>Last</button>`;
}

const SVG_CHEVRON = `<svg class="chevron-icon" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;

const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin-right:3px;vertical-align:middle">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;

const SVG_X = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin-right:3px;vertical-align:middle">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;

function buildEmptyState(message) {
    return `<p class="text-center py-5 text-gray-400 text-sm">${message}</p>`;
}

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

// =================================================================
// SHARED ACTION MODAL  (Approve / Reject — used by all three tabs)
// =================================================================
//
// pendingAction shape:
//   { type: 'approve'|'reject', tab: 'access'|'import'|'export',
//     id: <string|number>, name: <string> }

let pendingAction = null;

function openActionModal(type, tab, id, name, projectId, createUser) {
    pendingAction = { type, tab, id, name, projectId, createUser };

    const modal       = bootstrap.Modal.getOrCreateInstance(document.getElementById('adminActionModal'));
    const titleEl     = document.getElementById('adminActionModalLabel');
    const approveDiv  = document.getElementById('approveSection');
    const rejectDiv   = document.getElementById('rejectSection');
    const msgTa       = document.getElementById('approvalMessage');
    const reasonTa    = document.getElementById('rejectionReason');
    const reasonErr   = document.getElementById('rejectReasonError');
    const confirmBtn  = document.getElementById('adminActionConfirmBtn');

    if (type === 'approve') {
        titleEl.textContent = 'Approve Request';
        document.getElementById('actionRequestName').textContent = name;
        approveDiv.classList.remove('d-none');
        rejectDiv.classList.add('d-none');
        document.getElementById('approveMessageError')?.classList.add('d-none');
        confirmBtn.className = 'btn btn-success';
        confirmBtn.textContent = 'Approve';
        confirmBtn.disabled = true;
        if (msgTa) {
            msgTa.value = '';
            msgTa.maxLength = 500;
            let approveCounter = approveDiv.querySelector('.char-counter');
            if (!approveCounter) {
                approveCounter = document.createElement('div');
                approveCounter.className = 'char-counter small text-end mt-1';
                msgTa.insertAdjacentElement('afterend', approveCounter);
            }
            approveCounter.textContent = '';
            approveCounter.style.display = 'none';
            msgTa.oninput = () => {
                const len = msgTa.value.length;
                const threshold = Math.floor(500 * 0.8);
                if (len >= threshold) {
                    approveCounter.textContent = `${len} / 500`;
                    approveCounter.style.display = '';
                    approveCounter.style.color = '#dc3545';
                } else {
                    approveCounter.style.display = 'none';
                }
                confirmBtn.disabled = msgTa.value.trim().length === 0;
            };
        }
    } else {
        titleEl.textContent = 'Reject Request';
        document.getElementById('actionRequestNameReject').textContent = name;
        rejectDiv.classList.remove('d-none');
        approveDiv.classList.add('d-none');
        if (reasonTa) {
            reasonTa.value = '';
            reasonTa.maxLength = 500;
            let rejectCounter = rejectDiv.querySelector('.char-counter');
            if (!rejectCounter) {
                rejectCounter = document.createElement('div');
                rejectCounter.className = 'char-counter small text-end mt-1';
                reasonTa.insertAdjacentElement('afterend', rejectCounter);
            }
            rejectCounter.textContent = '';
            rejectCounter.style.display = 'none';
        }
        if (reasonErr) reasonErr.classList.add('d-none');
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Reject';
        confirmBtn.disabled = true;
        if (reasonTa) {
            reasonTa.oninput = () => {
                const len = reasonTa.value.length;
                const threshold = Math.floor(500 * 0.8);
                if (len >= threshold) {
                    let rejectCounter = rejectDiv.querySelector('.char-counter');
                    if (rejectCounter) {
                        rejectCounter.textContent = `${len} / 500`;
                        rejectCounter.style.display = '';
                        rejectCounter.style.color = '#dc3545';
                    }
                } else {
                    const rejectCounter = rejectDiv.querySelector('.char-counter');
                    if (rejectCounter) rejectCounter.style.display = 'none';
                }
                confirmBtn.disabled = reasonTa.value.trim().length === 0;
            };
        }
    }
    modal.show();
}

function setupActionModalConfirm() {
    document.getElementById('adminActionConfirmBtn')?.addEventListener('click', async () => {
        if (!pendingAction) return;
        const { type, tab, id, name } = pendingAction;

        if (type === 'approve') {
            const msg = document.getElementById('approvalMessage')?.value.trim();
            if (!msg) {
                document.getElementById('approveMessageError')?.classList.remove('d-none');
                return;
            }
        }

        if (type === 'reject') {
            const reason = document.getElementById('rejectionReason')?.value.trim();
            if (!reason) {
                document.getElementById('rejectReasonError')?.classList.remove('d-none');
                return;
            }
        }

        const modal  = bootstrap.Modal.getInstance(document.getElementById('adminActionModal'));
        const msg    = sanitizeInput(document.getElementById('approvalMessage')?.value.trim() || '');
        const reason = sanitizeInput(document.getElementById('rejectionReason')?.value.trim() || '');
        if (type === 'approve' && containsInvalidChars(document.getElementById('approvalMessage')?.value || '')) {
            showToast('Special characters are not allowed in the approval message.', 'error');
            return;
        }
        if (type === 'reject' && containsInvalidChars(document.getElementById('rejectionReason')?.value || '')) {
            showToast('Special characters are not allowed in the rejection reason.', 'error');
            return;
        }
        modal?.hide();

        const safeId = safeParseId(id);
        if (safeId === null) { showToast('Invalid request ID.', 'error'); return; }

        const t = showToast(`${type === 'approve' ? 'Approving' : 'Rejecting'}…`, 'info');
        try {
            if (tab === 'access') {
                if (type === 'approve') {
                    await window.loomeApi.runApiRequest('ApproveRequestID', { id: safeId, Message: msg || '' });
                } else {
                    await window.loomeApi.runApiRequest('RejectRequestID', { id: safeId, Message: reason });
                }
                dismissToast(t);
                showToast(`Request ${type === 'approve' ? 'approved' : 'rejected'} successfully.`, 'success');
                await Promise.all([adminAccessRenderUI(), adminAccessRefreshChipCounts()]);

            } else if (tab === 'import') {
                if (type === 'approve') {
                    await window.loomeApi.runApiRequest('ApproveImportRequest', { id: safeId, reason: msg || '' });
                    dismissToast(t);
                    showToast('Import request approved. Initiating data transfer…', 'success');
                    await Promise.all([adminImportRenderUI(), adminImportRefreshChipCounts()]);
                    // Kick off the integrate job to transfer data to the target project
                    try {
                        await window.loomeApi.runApiRequest('ApprovedImportRequestIntegrateJob', { ImportRequestID: safeId });
                        showToast('Data transfer from Import Project to Target Project has been initiated.', 'info');
                    } catch (integrateErr) {
                        showToast('Request approved but data transfer job failed to start. Please retry manually.', 'error');
                    }
                } else {
                    await window.loomeApi.runApiRequest('RejectImportRequest', { id: safeId, reason: reason });
                    dismissToast(t);
                    showToast('Import request rejected successfully.', 'success');
                    await Promise.all([adminImportRenderUI(), adminImportRefreshChipCounts()]);
                }

            } else if (tab === 'export') {
                if (type === 'approve') {
                    await window.loomeApi.runApiRequest('ApproveExportRequest', { id: safeId, reason: msg || '' });
                    dismissToast(t);
                    showToast('Export request approved. Adding researcher to Airlock Project…', 'success');
                    await Promise.all([adminExportRenderUI(), adminExportRefreshChipCounts()]);
                    // Kick off the integrate job to add the researcher to the Airlock project
                    try {
                        await window.loomeApi.runApiRequest('ApprovedExportRequestIntegrateJob', {
                            ExportRequestID: safeId,
                            ExportProjectID: pendingAction.projectId || '',
                            ResearcherEmail: pendingAction.createUser || ''
                        });
                        showToast('Adding researcher to Airlock Project has been initiated.', 'info');
                    } catch (integrateErr) {
                        showToast('Request approved but Airlock integration job failed to start. Please retry manually.', 'error');
                    }
                } else {
                    await window.loomeApi.runApiRequest('RejectExportRequest', { id: safeId, reason: reason });
                    dismissToast(t);
                    showToast('Export request rejected successfully.', 'success');
                    await Promise.all([adminExportRenderUI(), adminExportRefreshChipCounts()]);
                }
            }
        } catch (e) {
            dismissToast(t);
            showToast(`Failed to ${type} request.`, 'error');
        } finally {
            pendingAction = null;
        }
    });
}

// =================================================================
// TUTORIAL SYSTEM
// =================================================================
const TUTORIAL_DATA = {
    'admin-access-tab': {
        title: 'Admin: Data Access Guide',
        steps: [
            { content: 'Welcome to the Admin Request Hub! As an administrator, you can view all access, import, and export requests. Expand any row to see full details.' },
            { content: 'You cannot approve access requests, but you can reject them. A reason is required whenever you reject a request.' },
            { content: 'When you reject a request, the user is automatically notified with your reason.' },
            { content: 'Check the "Finalised" tab for completed requests and their associated logs, useful for auditing purposes.' }
        ]
    },
    'admin-import-tab': {
        title: 'Admin: Data Import Guide',
        steps: [
            { content: 'Review data import requests to ensure only authorized data enters the secure environment.' },
            { content: 'Approving an import request automatically triggers the data transfer job to the user\'s designated project.' },
            { content: 'If a transfer fails, check the "Finalised" or "Failed" logs for details (where available).' },
            { content: 'A researcher can only have one import request in progress at a time per project. If they submit another request while one is pending, the earlier request will be superseded and not processed.' }
        ]
    },
    'admin-export-tab': {
        title: 'Admin: Data Export Guide',
        steps: [
            { content: 'Once a user submits an export request, a secure "Airlock" project is automatically created, containing an "Export sum-..." resource with the user\'s data.' },
            { content: 'To inspect the files, click the down arrow on the Export resource in the Airlock project and select "Go to URL" to download and review the zipped data.' },
            { content: 'If the data is compliant and you approve the request, a background job automatically adds the user to the Airlock project to finalize the transfer.' },
            { content: 'A researcher can only have one export request in progress at a time per project. If they submit another request while one is pending, the earlier request will be superseded and not processed.' }
        ]
    }
};

let currTutorialStep = 0;
let currTutorialSet = null;

function renderTutorialStep() {
    const data = TUTORIAL_DATA[currTutorialSet];
    if (!data) return;

    const step = data.steps[currTutorialStep];
    const isLast = currTutorialStep === data.steps.length - 1;

    document.getElementById('tutorialModalTitle').textContent = data.title;
    document.getElementById('tutorial-content').textContent = step.content;
    document.getElementById('tutorial-progress').textContent = `Step ${currTutorialStep + 1} of ${data.steps.length}`;

    const backBtn = document.getElementById('tutorial-back');
    const nextBtn = document.getElementById('tutorial-next');

    // Hide back button on first step
    backBtn.style.visibility = currTutorialStep === 0 ? 'hidden' : 'visible';
    
    // Change "Next" to "Finish" on last step
    nextBtn.textContent = isLast ? 'Finish' : 'Next';
}

function setupTutorialListeners() {
    document.getElementById('tutorial-btn')?.addEventListener('click', () => {
        const activeTabEl = document.querySelector('#adminTabs .nav-link.active');
        const activeTabId = activeTabEl?.id;

        if (!activeTabId || !TUTORIAL_DATA[activeTabId]) {
            showToast('Tutorial not available for this tab.', 'info');
            return;
        }

        currTutorialSet = activeTabId;
        currTutorialStep = 0;
        renderTutorialStep();

        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('tutorialModal'));
        modal.show();
    });

    document.getElementById('tutorial-next')?.addEventListener('click', () => {
        const data = TUTORIAL_DATA[currTutorialSet];
        if (!data) return;

        if (currTutorialStep < data.steps.length - 1) {
            currTutorialStep++;
            renderTutorialStep();
        } else {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('tutorialModal')).hide();
        }
    });

    document.getElementById('tutorial-back')?.addEventListener('click', () => {
        if (currTutorialStep > 0) {
            currTutorialStep--;
            renderTutorialStep();
        }
    });
}

// =================================================================
// ACCESS TAB (Admin)  — server-side pagination via GetAllRequests
// =================================================================

const ADMIN_ACCESS_STATUS_MAP    = { 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected' };
const ADMIN_ACCESS_ROWS_PER_PAGE = 5;

let adminAccessCurrentPage   = 1;
let adminAccessTotalPages    = 1;
let adminAccessCurrentStatus = 'Pending Approval';
let adminAccessProjectsCache = null;
let _adminAccessFetchToken   = 0;

async function adminAccessGetProjectsMapping() {
    if (adminAccessProjectsCache) return adminAccessProjectsCache;
    try {
        const res  = await window.loomeApi.runApiRequest('GetAllAssistProjects', { page: 1, page_size: 200, search: '' });
        const data = safeParseJson(res);
        const map  = {};
        (data?.Results || data || []).forEach(p => {
            map[p.AssistProjectID]         = { name: p.Name };
            map[String(p.AssistProjectID)] = { name: p.Name };
        });
        adminAccessProjectsCache = map;
        return map;
    } catch (e) { return {}; }
}

async function adminAccessGetCount(status) {
    try {
        const statusId = Object.entries(ADMIN_ACCESS_STATUS_MAP).find(([, v]) => v === status)?.[0];
        if (!statusId) return 0;
        const res = await window.loomeApi.runApiRequest('GetAllRequests', { page: 1, pageSize: 1, search: '', statusId: parseInt(statusId) });
        return safeParseJson(res)?.RowCount ?? 0;
    } catch (e) { return 0; }
}

async function adminAccessRefreshChipCounts() {
    const container = document.getElementById('admin-access-chips');
    if (!container) return;
    await Promise.all([...container.querySelectorAll('.req-chip')].map(async chip => {
        chip.querySelector('.chip-count').textContent = await adminAccessGetCount(chip.dataset.status);
    }));
}

async function adminAccessRenderUI() {
    const token = ++_adminAccessFetchToken;
    document.querySelectorAll('#admin-access-pagination [data-page]').forEach(b => { b.disabled = true; });
    const container  = document.getElementById('admin-access-table-area');
    const searchTerm = (document.getElementById('admin-access-search')?.value || '').trim();
    container.innerHTML = `<p class="text-center py-4 text-gray-400 text-sm">Loading…</p>`;
    try {
        const statusId = Object.entries(ADMIN_ACCESS_STATUS_MAP).find(([, v]) => v === adminAccessCurrentStatus)?.[0];
        const params   = { page: adminAccessCurrentPage, pageSize: ADMIN_ACCESS_ROWS_PER_PAGE, search: searchTerm, statusId: parseInt(statusId) };
        const res      = await window.loomeApi.runApiRequest('GetAllRequests', params);
        if (token !== _adminAccessFetchToken) return;
        const parsed   = safeParseJson(res);
        let data       = (parsed?.Results || []).map(item => ({ ...item, _status: ADMIN_ACCESS_STATUS_MAP[item.StatusID] || 'Unknown' }));
        const total    = parsed?.RowCount || 0;

        if (adminAccessCurrentStatus === 'Finalised') {
            const logsPromises = data.map(item =>
                window.loomeApi.runApiRequest('GetIngestionLogByRequestID', { request_id: item.RequestID })
                    .then(safeParseJson)
                    .catch(() => null)
            );
            const logsResults = await Promise.all(logsPromises);
            data = data.map((item, idx) => {
                const logs = logsResults[idx];
                const hasError = Array.isArray(logs) && logs.length > 0 && !!logs[0].ErrorDescription;
                return { ...item, IngestionError: hasError, _log: (Array.isArray(logs) && logs.length > 0) ? logs[0] : null };
            });
        }

        adminAccessTotalPages = Math.max(1, Math.ceil(total / ADMIN_ACCESS_ROWS_PER_PAGE));
        adminAccessRenderTable(container, data, adminAccessCurrentStatus);
        renderPaginationHtml('admin-access-pagination', total, ADMIN_ACCESS_ROWS_PER_PAGE, adminAccessCurrentPage);
    } catch (e) {
        if (token !== _fetchToken) return;
        container.innerHTML = `<p class="text-center py-4 text-red-500 text-sm">Error loading requests: ${e.message}</p>`;
    } finally {
        if (token === _adminAccessFetchToken) document.querySelectorAll('#admin-access-pagination [data-page]').forEach(b => { b.disabled = false; });
    }
}

function adminAccessRenderTable(container, data, selectedStatus) {
    if (!data.length) { container.innerHTML = buildEmptyState('No requests found for this status.'); return; }
    const tdCls = 'px-6 py-4 text-sm text-gray-700';
    const headers = ['', 'Request Name', 'Requested On', 'Requested By'];
    if (selectedStatus === 'Pending Approval') headers.push('Approvers');
    else if (selectedStatus === 'Approved')    { headers.push('Approved By'); headers.push('Approved On'); }
    else if (selectedStatus === 'Rejected')    { headers.push('Rejected By'); headers.push('Rejected On'); }
    else if (selectedStatus === 'Finalised')   { headers.push('Approved By'); headers.push('Finalised On'); }

    const thead = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    let rows = '';
    data.forEach(item => {
        let extra = '';
        switch (selectedStatus) {
            case 'Pending Approval': extra = `<td class="${tdCls}">${item.Approvers || 'N/A'}</td>`; break;
            case 'Approved':   extra = `<td class="${tdCls}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td>`; break;
            case 'Rejected':   extra = `<td class="${tdCls}">${item.RejectedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.RejectedDate)}</td>`; break;
            case 'Finalised':  extra = `<td class="${tdCls}">${item.CurrentlyApproved || 'N/A'}</td><td class="${tdCls}">${formatDate(item.FinalisedDate)}</td>`; break;
        }

        const nameStyle = (selectedStatus === 'Finalised' && item.IngestionError) ? 'style="color:#dc3545"' : '';

        rows += `
        <tr class="table-hover-row admin-access-row" data-id="${item.RequestID}" data-dataset-id="${item.DataSetID || ''}" data-name="${(item.Name || '').replace(/"/g, '&quot;')}" role="button" tabindex="0" aria-expanded="false" aria-controls="admin-access-detail-${item.RequestID}">
            <td class="${tdCls} text-center">${SVG_CHEVRON}</td>
            <td class="${tdCls} font-medium" style="width:25%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${nameStyle || ''}" title="${escapeHtml(item.Name || '')}">${escapeHtml(item.Name || 'N/A')}</td>
            <td class="${tdCls}" style="width:20%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${formatDate(item.CreateDate)}</td>
            <td class="${tdCls}" style="width:20%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${item.CreateUser || 'N/A'}</td>
            ${extra}
        </tr>
        <tr class="admin-access-detail-row hidden" id="admin-access-detail-${item.RequestID}" aria-hidden="true">
            <td colspan="${headers.length}" class="p-0">
                <div class="accordion-detail">
                    <div class="bg-white rounded shadow-sm position-relative">
                        ${selectedStatus === 'Pending Approval' ? `
                        <div class="position-absolute" style="top:12px;right:12px;z-index:1">
                            <button class="btn btn-danger px-3 py-1 admin-reject-btn" data-id="${item.RequestID}" data-name="${(item.Name || '').replace(/"/g, '&quot;')}">
                                <i class="fa fa-thumbs-down me-2"></i>Reject
                            </button>
                        </div>` : ''}
                        <div class="p-3 admin-access-detail-content">
                            <p class="text-center text-gray-400 text-sm mb-0">Loading details…</p>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = `
        <div class="overflow-x-auto border rounded shadow-sm">
            <table class="w-full divide-y divide-gray-200">
                <thead class="bg-gray-50"><tr>${thead}</tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">${rows}</tbody>
            </table>
        </div>`;

    container.querySelectorAll('.admin-access-row').forEach(row => {
        const detailRow = row.nextElementSibling;
        const chevron   = row.querySelector('.chevron-icon');
        let loaded      = false;
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
        });
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.admin-reject-btn')) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            row.setAttribute('aria-expanded', String(!isOpen));
            detailRow.setAttribute('aria-hidden', String(isOpen));
            chevron.classList.toggle('rotated', !isOpen);
            if (!isOpen && !loaded) {
                loaded = true;
                const content = detailRow.querySelector('.admin-access-detail-content');
                try {
                    const rowData = data.find(d => String(d.RequestID) === String(row.dataset.id));
                    const promises = [
                        window.loomeApi.runApiRequest('GetRequestID', { RequestID: row.dataset.id }).then(safeParseJson),
                        adminAccessGetProjectsMapping()
                    ];

                    // Reuse the log if we already fetched it during RenderUI
                    const [reqRes, projectsMap] = await Promise.all(promises);
                    let log = rowData?._log;

                    // Fallback in case RenderUI didn't fetch it (e.g. status change or race)
                    if (selectedStatus === 'Finalised' && !log) {
                        const logs = safeParseJson(await window.loomeApi.runApiRequest('GetIngestionLogByRequestID', { request_id: row.dataset.id }));
                        log = (Array.isArray(logs) && logs.length > 0) ? logs[0] : null;
                    }

                    const dsRes = row.dataset.datasetId
                        ? safeParseJson(await window.loomeApi.runApiRequest('GetDataSetID', { DataSetID: row.dataset.datasetId }))
                        : null;
                    const proj = reqRes?.ProjectID
                        ? (projectsMap[reqRes.ProjectID] || projectsMap[String(reqRes.ProjectID)] || { name: 'Unknown Project' })
                        : { name: 'N/A' };

                    let ingestionHtml = '';
                    if (log && log.ErrorDescription) {
                        ingestionHtml = `
                            <div class="mt-3 px-3 py-2 bg-red-50 border-l-4 border-red-500 rounded text-sm">
                                <div class="flex items-center gap-2 text-red-700 font-medium">
                                    <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.28 11.163c.75 1.334-.213 2.98-1.743 2.98H3.72c-1.53 0-2.492-1.646-1.743-2.98L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Ingestion Error — contact a data administrator</span>
                                </div>
                                <code class="block mt-2 bg-white/60 border border-red-200 rounded px-2 py-1 text-xs text-red-800 overflow-auto" style="max-height:100px; white-space:pre-wrap;">${escapeHtml(log.ErrorDescription)}</code>
                            </div>`;
                    }

                    content.innerHTML = `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div class="space-y-2">
                                <p><span class="font-medium text-gray-600">Request Name:</span> <span class="text-gray-500">${reqRes?.Name || row.dataset.name || 'N/A'}</span></p>
                                ${dsRes ? `<p><span class="font-medium text-gray-600">Dataset:</span> <span class="text-gray-500">${dsRes.Name || 'N/A'}</span></p>
                                           <p><span class="font-medium text-gray-600">Description:</span> <span class="text-gray-500">${dsRes.Description || 'N/A'}</span></p>` : ''}
                                <p><span class="font-medium text-gray-600">Target Project:</span> <span class="text-gray-500">${proj.name}</span></p>
                                ${reqRes?.Purpose ? `<p><span class="font-medium text-gray-600">Purpose:</span> <span class="text-gray-500">${reqRes.Purpose}</span></p>` : ''}
                            </div>
                            <div class="space-y-2">
                                ${reqRes?.ApprovalMessage  ? `<p><span class="font-medium text-gray-600">Approval Message:</span> <span class="text-gray-500">${reqRes.ApprovalMessage}</span></p>` : ''}
                                ${reqRes?.RejectionMessage ? `<p><span class="font-medium text-gray-600">Rejection Message:</span> <span class="text-gray-500">${reqRes.RejectionMessage}</span></p>` : ''}
                                ${reqRes?.FinalisedBy      ? `<p><span class="font-medium text-gray-600">Finalised By:</span> <span class="text-gray-500">${reqRes.FinalisedBy}</span></p>` : ''}
                            </div>
                        </div>
                        ${ingestionHtml}`;
                } catch (err) { content.innerHTML = `<p class="text-red-500 text-sm">Error loading details.</p>`; }
            }
        });
    });

    container.querySelectorAll('.admin-reject-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openActionModal('reject', 'access', btn.dataset.id, btn.dataset.name); });
    });
}

function adminAccessSetupListeners() {
    document.getElementById('admin-access-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.req-chip');
        if (!chip) return;
        document.getElementById('admin-access-chips').querySelectorAll('.req-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        adminAccessCurrentStatus = chip.dataset.status;
        adminAccessCurrentPage   = 1;
        adminAccessRenderUI();
    });

    document.getElementById('admin-access-search')?.addEventListener('input', debounce(() => {
        adminAccessCurrentPage = 1; adminAccessRenderUI();
    }, 300));

    document.getElementById('admin-access-pagination')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled) return;
        adminAccessCurrentPage = parseInt(btn.dataset.page, 10);
        adminAccessRenderUI();
    });

    document.getElementById('admin-access-pagination')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'admin-access-pagination-input') {
            const p = parseInt(e.target.value, 10);
            if (p >= 1 && p <= adminAccessTotalPages) { adminAccessCurrentPage = p; adminAccessRenderUI(); }
            else { showToast(`Enter a page between 1 and ${adminAccessTotalPages}.`, 'error'); e.target.value = adminAccessCurrentPage; }
        }
    });
}

// =================================================================
// IMPORT TAB (Admin)  — server-side pagination via GetAllImportRequests
// =================================================================

const ADMIN_IMPORT_STATUS_MAP    = { '-3': 'Superseded', '-2': 'Failed', '-1': 'Working', 0: 'Awaiting Submission', 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected', 5: 'Cancelled' };
const ADMIN_IMPORT_STATUS_ID_MAP = { 'Awaiting Submission': 0, 'Pending Approval': 1, 'Approved': 2, 'Finalised': 3, 'Rejected': 4, 'Working': -1, 'Failed': -2, 'Superseded': -3, 'Cancelled': 5 };
const ADMIN_IMPORT_ROWS_PER_PAGE = 5;

let adminImportCurrentPage   = 1;
let adminImportTotalPages    = 1;
let adminImportCurrentStatus = 'Awaiting Submission';
let _adminImportFetchToken   = 0;

async function adminImportGetCount(status) {
    try {
        if (status === 'Awaiting Submission') {
            const [r0, rW] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 1, search: '', statusId: 0 }),
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 1, search: '', statusId: -1 })
            ]);
            return (safeParseJson(r0)?.RowCount || 0) + (safeParseJson(rW)?.RowCount || 0);
        }
        if (status === 'Finalised') {
            const [r3, r_3] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 1, search: '', statusId: 3 }),
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 1, search: '', statusId: -3 })
            ]);
            return (safeParseJson(r3)?.RowCount || 0) + (safeParseJson(r_3)?.RowCount || 0);
        }
        const statusId = ADMIN_IMPORT_STATUS_ID_MAP[status];
        if (statusId === undefined) return 0;
        const res = await window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 1, search: '', statusId });
        return safeParseJson(res)?.RowCount ?? 0;
    } catch (e) { return 0; }
}

async function adminImportRefreshChipCounts() {
    const container = document.getElementById('admin-import-chips');
    if (!container) return;
    await Promise.all([...container.querySelectorAll('.req-chip')].map(async chip => {
        chip.querySelector('.chip-count').textContent = await adminImportGetCount(chip.dataset.status);
    }));
}

async function adminImportRenderUI() {
    const token = ++_adminImportFetchToken;
    document.querySelectorAll('#admin-import-pagination [data-page]').forEach(b => { b.disabled = true; });
    const container  = document.getElementById('admin-import-table-area');
    const searchTerm = (document.getElementById('admin-import-search')?.value || '').trim();
    container.innerHTML = `<p class="text-center py-4 text-gray-400 text-sm">Loading…</p>`;
    try {
        if (adminImportCurrentStatus === 'Awaiting Submission') {
            // Fetch both status 0 (Awaiting Submission) and -1 (Working) and merge
            const [r0, rW] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: 0 }),
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: -1 })
            ]);
            if (token !== _adminImportFetchToken) return;
            const p0 = safeParseJson(r0) || {};
            const pW = safeParseJson(rW) || {};
            const combined = [...(p0.Results || []), ...(pW.Results || [])].map(item => ({
                ...item, _status: ADMIN_IMPORT_STATUS_MAP[item.StatusID] ?? ADMIN_IMPORT_STATUS_MAP[String(item.StatusID)] ?? 'Unknown'
            }));
            combined.sort((a, b) => new Date(b.CreateDate) - new Date(a.CreateDate));
            const total = (p0.RowCount || 0) + (pW.RowCount || 0);
            adminImportTotalPages = Math.max(1, Math.ceil(total / ADMIN_IMPORT_ROWS_PER_PAGE));
            const start = (adminImportCurrentPage - 1) * ADMIN_IMPORT_ROWS_PER_PAGE;
            adminImportRenderTable(container, combined.slice(start, start + ADMIN_IMPORT_ROWS_PER_PAGE), adminImportCurrentStatus);
            renderPaginationHtml('admin-import-pagination', total, ADMIN_IMPORT_ROWS_PER_PAGE, adminImportCurrentPage);
        } else if (adminImportCurrentStatus === 'Finalised') {
            const [r3, r_3] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: 3 }),
                window.loomeApi.runApiRequest('GetAllImportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: -3 })
            ]);
            if (token !== _adminImportFetchToken) return;
            const p3 = safeParseJson(r3) || {};
            const p_3 = safeParseJson(r_3) || {};
            const combined = [...(p3.Results || []), ...(p_3.Results || [])].map(item => ({
                ...item, _status: ADMIN_IMPORT_STATUS_MAP[item.StatusID] ?? ADMIN_IMPORT_STATUS_MAP[String(item.StatusID)] ?? 'Unknown'
            }));
            combined.sort((a, b) => new Date(b.CreateDate) - new Date(a.CreateDate));
            const total = (p3.RowCount || 0) + (p_3.RowCount || 0);
            adminImportTotalPages = Math.max(1, Math.ceil(total / ADMIN_IMPORT_ROWS_PER_PAGE));
            const start = (adminImportCurrentPage - 1) * ADMIN_IMPORT_ROWS_PER_PAGE;
            adminImportRenderTable(container, combined.slice(start, start + ADMIN_IMPORT_ROWS_PER_PAGE), adminImportCurrentStatus);
            renderPaginationHtml('admin-import-pagination', total, ADMIN_IMPORT_ROWS_PER_PAGE, adminImportCurrentPage);
        } else {
            const statusId = ADMIN_IMPORT_STATUS_ID_MAP[adminImportCurrentStatus];
            const params   = { page: adminImportCurrentPage, pageSize: ADMIN_IMPORT_ROWS_PER_PAGE, search: searchTerm, statusId };
            const res      = await window.loomeApi.runApiRequest('GetAllImportRequests', params);
            if (token !== _adminImportFetchToken) return;
            const parsed   = safeParseJson(res);
            const data     = (parsed?.Results || []).map(item => ({
                ...item, _status: ADMIN_IMPORT_STATUS_MAP[item.StatusID] ?? ADMIN_IMPORT_STATUS_MAP[String(item.StatusID)] ?? 'Unknown'
            }));
            const total = parsed?.RowCount || 0;
            adminImportTotalPages = Math.max(1, Math.ceil(total / ADMIN_IMPORT_ROWS_PER_PAGE));
            adminImportRenderTable(container, data, adminImportCurrentStatus);
            renderPaginationHtml('admin-import-pagination', total, ADMIN_IMPORT_ROWS_PER_PAGE, adminImportCurrentPage);
        }
    } catch (e) {
        if (token !== _adminImportFetchToken) return;
        container.innerHTML = `<p class="text-center py-4 text-red-500 text-sm">Error loading import requests: ${e.message}</p>`;
    } finally {
        if (token === _adminImportFetchToken) document.querySelectorAll('#admin-import-pagination [data-page]').forEach(b => { b.disabled = false; });
    }
}

function adminImportRenderTable(container, data, selectedStatus) {
    if (!data.length) { container.innerHTML = buildEmptyState('No import requests found for this status.'); return; }
    const tdCls = 'px-6 py-4 text-sm text-gray-700';
    const headers = ['', 'Import Request Name', 'Requested By', 'Project Name', 'Requested On'];
    if (selectedStatus === 'Approved')    { headers.push('Approved By'); headers.push('Approved On'); }
    else if (selectedStatus === 'Rejected')    { headers.push('Rejected By'); headers.push('Rejected On'); }
    else if (selectedStatus === 'Finalised')   { headers.push('Status'); headers.push('Finalised On'); }
    else if (selectedStatus === 'Awaiting Submission') headers.push('Status');

    const thead = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    let rows = '';
    data.forEach(item => {
        let extra = '';
        switch (selectedStatus) {
            case 'Approved':            extra = `<td class="${tdCls}">${item.ApprovedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td>`; break;
            case 'Rejected':            extra = `<td class="${tdCls}">${item.RejectedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.RejectedDate)}</td>`; break;
            case 'Finalised':           extra = `<td class="${tdCls}">${getStatusBadgeHtml(item._status)}</td><td class="${tdCls}">${formatDate(item.FinalisedDate)}</td>`; break;
            case 'Awaiting Submission': extra = `<td class="${tdCls}">${getStatusBadgeHtml(item._status)}</td>`; break;
        }

        rows += `
        <tr class="table-hover-row admin-import-row" data-id="${item.ImportRequestID}" role="button" tabindex="0" aria-expanded="false" aria-controls="admin-import-detail-${item.ImportRequestID}">
            <td class="${tdCls} text-center">${SVG_CHEVRON}</td>
            <td class="${tdCls} font-medium" style="width:25%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(item.ImportRequestName)}">${item.ImportRequestName || 'N/A'}</td>
            <td class="${tdCls}" style="width:20%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(item.CreateUser || item.UserPrincipalName)}">${item.CreateUser || item.UserPrincipalName || 'N/A'}</td>
            <td class="${tdCls}" style="width:20%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(item.ImportProjectName || item.ProjectName)}">${item.ImportProjectName || item.ProjectName || 'N/A'}</td>
            <td class="${tdCls}">${formatDate(item.CreateDate)}</td>
            ${extra}
        </tr>
        <tr class="admin-import-detail-row hidden" id="admin-import-detail-${item.ImportRequestID}" aria-hidden="true">
            <td colspan="${headers.length}" class="p-0">
                <div class="accordion-detail">
                    <div class="bg-white rounded shadow-sm position-relative">
                        ${selectedStatus === 'Pending Approval' ? `
                        <div class="position-absolute" style="top:12px;right:12px;z-index:1">
                            <div class="btn-group">
                                <button class="btn btn-success px-3 py-1 me-2 admin-import-approve-btn" data-id="${item.ImportRequestID}" data-name="${(item.ImportRequestName || '').replace(/"/g, '&quot;')}">
                                    <i class="fa fa-thumbs-up me-2"></i>Approve
                                </button>
                                <button class="btn btn-danger px-3 py-1 admin-import-reject-btn" data-id="${item.ImportRequestID}" data-name="${(item.ImportRequestName || '').replace(/"/g, '&quot;')}">
                                    <i class="fa fa-thumbs-down me-2"></i>Reject
                                </button>
                            </div>
                        </div>` : ''}
                        <div class="p-3 admin-import-detail-content">
                            <p class="text-center text-gray-400 text-sm mb-0">Loading details…</p>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = `
    <div class="overflow-x-auto border rounded shadow-sm">
        <table class="w-full divide-y divide-gray-200" style="table-layout: fixed; min-width: 800px;">
            <thead class="bg-gray-50">
                <tr>${thead}</tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${rows}
            </tbody>
        </table>
    </div>`;

    container.querySelectorAll('.admin-import-row').forEach(row => {
        const detailRow = row.nextElementSibling;
        const chevron   = row.querySelector('.chevron-icon');
        let loaded      = false;
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
        });
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.admin-import-approve-btn') || e.target.closest('.admin-import-reject-btn') || e.target.closest('.btn-group')) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            row.setAttribute('aria-expanded', String(!isOpen));
            detailRow.setAttribute('aria-hidden', String(isOpen));
            chevron.classList.toggle('rotated', !isOpen);
            if (!isOpen && !loaded) {
                loaded = true;
                const content = detailRow.querySelector('.admin-import-detail-content');
                try {
                    const d = safeParseJson(await window.loomeApi.runApiRequest('GetImportRequestByID', { RequestID: row.dataset.id }));
                    content.innerHTML = `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div class="space-y-2">
                                <p><span class="font-medium text-gray-600">Import Request Name:</span> <span class="text-gray-500">${d?.ImportRequestName || 'N/A'}</span></p>
                                <p><span class="font-medium text-gray-600">Import Request ID:</span> <span class="text-gray-500">${d?.ImportRequestID || 'N/A'}</span></p>
                                <p><span class="font-medium text-gray-600">Project Name:</span> <span class="text-gray-500">${d?.ProjectName || 'N/A'}</span></p>
                                ${d?.Purpose ? `<p><span class="font-medium text-gray-600">Purpose:</span> <span class="text-gray-500">${d.Purpose}</span></p>` : ''}
                            </div>
                            <div class="space-y-2">
                                ${d?.ApprovedBy       ? `<p><span class="font-medium text-gray-600">Approved By:</span> <span class="text-gray-500">${d.ApprovedBy}</span></p>` : ''}
                                ${d?.ApprovalMessage  ? `<p><span class="font-medium text-gray-600">Approval Message:</span> <span class="text-gray-500">${d.ApprovalMessage}</span></p>` : ''}
                                ${d?.RejectedBy       ? `<p><span class="font-medium text-gray-600">Rejected By:</span> <span class="text-gray-500">${d.RejectedBy}</span></p>` : ''}
                                ${d?.RejectionMessage ? `<p><span class="font-medium text-gray-600">Rejection Message:</span> <span class="text-gray-500">${d.RejectionMessage}</span></p>` : ''}
                            </div>
                        </div>`;
                } catch (err) { content.innerHTML = `<p class="text-red-500 text-sm">Error loading details.</p>`; }
            }
        });
    });

    container.querySelectorAll('.admin-import-approve-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openActionModal('approve', 'import', btn.dataset.id, btn.dataset.name); });
    });
    container.querySelectorAll('.admin-import-reject-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openActionModal('reject', 'import', btn.dataset.id, btn.dataset.name); });
    });
}

function adminImportSetupListeners() {
    document.getElementById('admin-import-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.req-chip');
        if (!chip) return;
        document.getElementById('admin-import-chips').querySelectorAll('.req-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        adminImportCurrentStatus = chip.dataset.status;
        adminImportCurrentPage   = 1;
        adminImportRenderUI();
    });

    document.getElementById('admin-import-search')?.addEventListener('input', debounce(() => {
        adminImportCurrentPage = 1; adminImportRenderUI();
    }, 300));

    document.getElementById('admin-import-pagination')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled) return;
        adminImportCurrentPage = parseInt(btn.dataset.page, 10);
        adminImportRenderUI();
    });

    document.getElementById('admin-import-pagination')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'admin-import-pagination-input') {
            const p = parseInt(e.target.value, 10);
            if (p >= 1 && p <= adminImportTotalPages) { adminImportCurrentPage = p; adminImportRenderUI(); }
            else { showToast(`Enter a page between 1 and ${adminImportTotalPages}.`, 'error'); e.target.value = adminImportCurrentPage; }
        }
    });
}

// =================================================================
// EXPORT TAB (Admin)  — server-side pagination via GetAllExportRequests
// =================================================================

const ADMIN_EXPORT_STATUS_MAP    = { '-3': 'Superseded', '-2': 'Failed', '-1': 'Working', 0: 'Awaiting Submission', 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected', 5: 'Cancelled' };
const ADMIN_EXPORT_STATUS_ID_MAP = { 'Awaiting Submission': 0, 'Pending Approval': 1, 'Approved': 2, 'Finalised': 3, 'Rejected': 4, 'Working': -1, 'Failed': -2, 'Superseded': -3, 'Cancelled': 5 };
const ADMIN_EXPORT_ROWS_PER_PAGE = 5;

let adminExportCurrentPage   = 1;
let adminExportTotalPages    = 1;
let adminExportCurrentStatus = 'Awaiting Submission';
let _adminExportFetchToken   = 0;

async function adminExportGetCount(status) {
    try {
        if (status === 'Awaiting Submission') {
            const [r0, rW] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 1, search: '', statusId: 0 }),
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 1, search: '', statusId: -1 })
            ]);
            return (safeParseJson(r0)?.RowCount || 0) + (safeParseJson(rW)?.RowCount || 0);
        }
        if (status === 'Finalised') {
            const [r3, r_3] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 1, search: '', statusId: 3 }),
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 1, search: '', statusId: -3 })
            ]);
            return (safeParseJson(r3)?.RowCount || 0) + (safeParseJson(r_3)?.RowCount || 0);
        }
        const statusId = ADMIN_EXPORT_STATUS_ID_MAP[status];
        if (statusId === undefined) return 0;
        const res = await window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 1, search: '', statusId });
        return safeParseJson(res)?.RowCount ?? 0;
    } catch (e) { return 0; }
}

async function adminExportRefreshChipCounts() {
    const container = document.getElementById('admin-export-chips');
    if (!container) return;
    await Promise.all([...container.querySelectorAll('.req-chip')].map(async chip => {
        chip.querySelector('.chip-count').textContent = await adminExportGetCount(chip.dataset.status);
    }));
}

async function adminExportRenderUI() {
    const token = ++_adminExportFetchToken;
    document.querySelectorAll('#admin-export-pagination [data-page]').forEach(b => { b.disabled = true; });
    const container  = document.getElementById('admin-export-table-area');
    const searchTerm = (document.getElementById('admin-export-search')?.value || '').trim();
    container.innerHTML = `<p class="text-center py-4 text-gray-400 text-sm">Loading…</p>`;
    try {
        if (adminExportCurrentStatus === 'Awaiting Submission') {
            // Fetch both status 0 (Awaiting Submission) and -1 (Working) and merge
            const [r0, rW] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: 0 }),
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: -1 })
            ]);
            if (token !== _adminExportFetchToken) return;
            const p0 = safeParseJson(r0) || {};
            const pW = safeParseJson(rW) || {};
            const combined = [...(p0.Results || []), ...(pW.Results || [])].map(item => ({
                ...item, _status: ADMIN_EXPORT_STATUS_MAP[item.StatusID] ?? ADMIN_EXPORT_STATUS_MAP[String(item.StatusID)] ?? 'Unknown'
            }));
            combined.sort((a, b) => new Date(b.CreateDate) - new Date(a.CreateDate));
            const total = (p0.RowCount || 0) + (pW.RowCount || 0);
            adminExportTotalPages = Math.max(1, Math.ceil(total / ADMIN_EXPORT_ROWS_PER_PAGE));
            const start = (adminExportCurrentPage - 1) * ADMIN_EXPORT_ROWS_PER_PAGE;
            adminExportRenderTable(container, combined.slice(start, start + ADMIN_EXPORT_ROWS_PER_PAGE), adminExportCurrentStatus);
            renderPaginationHtml('admin-export-pagination', total, ADMIN_EXPORT_ROWS_PER_PAGE, adminExportCurrentPage);
        } else if (adminExportCurrentStatus === 'Finalised') {
            const [r3, r_3] = await Promise.all([
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: 3 }),
                window.loomeApi.runApiRequest('GetAllExportRequests', { page: 1, pageSize: 200, search: searchTerm, statusId: -3 })
            ]);
            if (token !== _adminExportFetchToken) return;
            const p3 = safeParseJson(r3) || {};
            const p_3 = safeParseJson(r_3) || {};
            const combined = [...(p3.Results || []), ...(p_3.Results || [])].map(item => ({
                ...item, _status: ADMIN_EXPORT_STATUS_MAP[item.StatusID] ?? ADMIN_EXPORT_STATUS_MAP[String(item.StatusID)] ?? 'Unknown'
            }));
            combined.sort((a, b) => new Date(b.CreateDate) - new Date(a.CreateDate));
            const total = (p3.RowCount || 0) + (p_3.RowCount || 0);
            adminExportTotalPages = Math.max(1, Math.ceil(total / ADMIN_EXPORT_ROWS_PER_PAGE));
            const start = (adminExportCurrentPage - 1) * ADMIN_EXPORT_ROWS_PER_PAGE;
            adminExportRenderTable(container, combined.slice(start, start + ADMIN_EXPORT_ROWS_PER_PAGE), adminExportCurrentStatus);
            renderPaginationHtml('admin-export-pagination', total, ADMIN_EXPORT_ROWS_PER_PAGE, adminExportCurrentPage);
        } else {
            const statusId = ADMIN_EXPORT_STATUS_ID_MAP[adminExportCurrentStatus];
            const params   = { page: adminExportCurrentPage, pageSize: ADMIN_EXPORT_ROWS_PER_PAGE, search: searchTerm, statusId };
            const res      = await window.loomeApi.runApiRequest('GetAllExportRequests', params);
            if (token !== _adminExportFetchToken) return;
            const parsed   = safeParseJson(res);
            const data     = (parsed?.Results || []).map(item => ({
                ...item, _status: ADMIN_EXPORT_STATUS_MAP[item.StatusID] ?? ADMIN_EXPORT_STATUS_MAP[String(item.StatusID)] ?? 'Unknown'
            }));
            const total = parsed?.RowCount || 0;
            adminExportTotalPages = Math.max(1, Math.ceil(total / ADMIN_EXPORT_ROWS_PER_PAGE));
            adminExportRenderTable(container, data, adminExportCurrentStatus);
            renderPaginationHtml('admin-export-pagination', total, ADMIN_EXPORT_ROWS_PER_PAGE, adminExportCurrentPage);
        }
    } catch (e) {
        if (token !== _adminExportFetchToken) return;
        container.innerHTML = `<p class="text-center py-4 text-red-500 text-sm">Error loading export requests: ${e.message}</p>`;
    } finally {
        if (token === _adminExportFetchToken) document.querySelectorAll('#admin-export-pagination [data-page]').forEach(b => { b.disabled = false; });
    }
}

function adminExportRenderTable(container, data, selectedStatus) {
    if (!data.length) { container.innerHTML = buildEmptyState('No export requests found for this status.'); return; }
    const tdCls = 'px-6 py-4 text-sm text-gray-700';
    const headers = ['', 'Export Request Name', 'Requested By', 'Project Name', 'Requested On'];
    if (selectedStatus === 'Approved')    { headers.push('Approved By'); headers.push('Approved On'); }
    else if (selectedStatus === 'Rejected')    { headers.push('Rejected By'); headers.push('Rejected On'); }
    else if (selectedStatus === 'Finalised')   { headers.push('Status'); headers.push('Finalised On'); }
    else if (selectedStatus === 'Awaiting Submission') headers.push('Status');

    const thead = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    let rows = '';
    data.forEach(item => {
        let extra = '';
        switch (selectedStatus) {
            case 'Approved':            extra = `<td class="${tdCls}">${item.ApprovedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td>`; break;
            case 'Rejected':            extra = `<td class="${tdCls}">${item.RejectedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.RejectedDate)}</td>`; break;
            case 'Finalised':           extra = `<td class="${tdCls}">${getStatusBadgeHtml(item._status)}</td><td class="${tdCls}">${formatDate(item.FinalisedDate)}</td>`; break;
            case 'Awaiting Submission': extra = `<td class="${tdCls}">${getStatusBadgeHtml(item._status)}</td>`; break;
        }

        rows += `
        <tr class="table-hover-row admin-export-row" data-id="${item.ExportRequestID}" role="button" tabindex="0" aria-expanded="false" aria-controls="admin-export-detail-${item.ExportRequestID}">
            <td class="${tdCls} text-center">${SVG_CHEVRON}</td>
            <td class="${tdCls} font-medium" style="width:25%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(item.ExportRequestName || '').replace(/"/g, '&quot;')}">${item.ExportRequestName || 'N/A'}</td>
            <td class="${tdCls}" style="width:20%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${item.CreateUser || 'N/A'}</td>
            <td class="${tdCls}" style="width:20%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${item.ExportProjectName || item.ProjectName || 'N/A'}</td>
            <td class="${tdCls}">${formatDate(item.CreateDate)}</td>
            ${extra}
        </tr>
        <tr class="admin-export-detail-row hidden" id="admin-export-detail-${item.ExportRequestID}" aria-hidden="true">
            <td colspan="${headers.length}" class="p-0">
                <div class="accordion-detail">
                    <div class="bg-white rounded shadow-sm position-relative">
                        ${selectedStatus === 'Pending Approval' ? `
                        <div class="position-absolute" style="top:12px;right:12px;z-index:1">
                            <div class="btn-group">
                                <button class="btn btn-success px-3 py-1 me-2 admin-export-approve-btn" data-id="${item.ExportRequestID}" data-name="${(item.ExportRequestName || '').replace(/"/g, '&quot;')}" data-project-id="${item.ExportProjectID || ''}" data-create-user="${item.CreateUser || ''}">
                                    <i class="fa fa-thumbs-up me-2"></i>Approve
                                </button>
                                <button class="btn btn-danger px-3 py-1 admin-export-reject-btn" data-id="${item.ExportRequestID}" data-name="${(item.ExportRequestName || '').replace(/"/g, '&quot;')}">
                                    <i class="fa fa-thumbs-down me-2"></i>Reject
                                </button>
                            </div>
                        </div>` : ''}
                        <div class="p-3 admin-export-detail-content">
                            <p class="text-center text-gray-400 text-sm mb-0">Loading details…</p>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = `
        <div class="overflow-x-auto border rounded shadow-sm">
            <table class="w-full divide-y divide-gray-200">
                <thead class="bg-gray-50"><tr>${thead}</tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">${rows}</tbody>
            </table>
        </div>`;

    container.querySelectorAll('.admin-export-row').forEach(row => {
        const detailRow = row.nextElementSibling;
        const chevron   = row.querySelector('.chevron-icon');
        let loaded      = false;
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
        });
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.admin-export-approve-btn') || e.target.closest('.admin-export-reject-btn') || e.target.closest('.btn-group')) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            row.setAttribute('aria-expanded', String(!isOpen));
            detailRow.setAttribute('aria-hidden', String(isOpen));
            chevron.classList.toggle('rotated', !isOpen);
            if (!isOpen && !loaded) {
                loaded = true;
                const content = detailRow.querySelector('.admin-export-detail-content');
                try {
                    const exportRowId = safeParseId(row.dataset.id);
                    if (exportRowId === null) throw new Error('Invalid export request ID.');
                    const d = safeParseJson(await window.loomeApi.runApiRequest('GetExportRequestByID', { ExportRequestID: exportRowId }));
                    content.innerHTML = `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div class="space-y-2">
                                <p><span class="font-medium text-gray-600">Export Request Name:</span> <span class="text-gray-500">${d?.ExportRequestName || 'N/A'}</span></p>
                                <p><span class="font-medium text-gray-600">Export Request ID:</span> <span class="text-gray-500">${d?.ExportRequestID || 'N/A'}</span></p>
                                <p><span class="font-medium text-gray-600">Project Name:</span> <span class="text-gray-500">${d?.ProjectName || 'N/A'}</span></p>
                                ${d?.Purpose ? `<p><span class="font-medium text-gray-600">Purpose:</span> <span class="text-gray-500">${d.Purpose}</span></p>` : ''}
                            </div>
                            <div class="space-y-2">
                                ${d?.ApprovedBy       ? `<p><span class="font-medium text-gray-600">Approved By:</span> <span class="text-gray-500">${d.ApprovedBy}</span></p>` : ''}
                                ${d?.ApprovalMessage  ? `<p><span class="font-medium text-gray-600">Approval Message:</span> <span class="text-gray-500">${d.ApprovalMessage}</span></p>` : ''}
                                ${d?.RejectedBy       ? `<p><span class="font-medium text-gray-600">Rejected By:</span> <span class="text-gray-500">${d.RejectedBy}</span></p>` : ''}
                                ${d?.RejectionMessage ? `<p><span class="font-medium text-gray-600">Rejection Message:</span> <span class="text-gray-500">${d.RejectionMessage}</span></p>` : ''}
                            </div>
                        </div>
                        ${d?.StatusID === -3 ? `<div class="mt-3 p-2 bg-gray-50 border-start border-4 border-gray-300 text-gray-600 text-xs italic">Note: This request has been superseded by a subsequent submission. Any associated data has been updated accordingly.</div>` : ''}`;
                } catch (err) { content.innerHTML = `<p class="text-red-500 text-sm">Error loading details.</p>`; }
            }
        });
    });

    container.querySelectorAll('.admin-export-approve-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openActionModal('approve', 'export', btn.dataset.id, btn.dataset.name, btn.dataset.projectId, btn.dataset.createUser); });
    });
    container.querySelectorAll('.admin-export-reject-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openActionModal('reject', 'export', btn.dataset.id, btn.dataset.name); });
    });
}

function adminExportSetupListeners() {
    document.getElementById('admin-export-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.req-chip');
        if (!chip) return;
        document.getElementById('admin-export-chips').querySelectorAll('.req-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        adminExportCurrentStatus = chip.dataset.status;
        adminExportCurrentPage   = 1;
        adminExportRenderUI();
    });

    document.getElementById('admin-export-search')?.addEventListener('input', debounce(() => {
        adminExportCurrentPage = 1; adminExportRenderUI();
    }, 300));

    document.getElementById('admin-export-pagination')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled) return;
        adminExportCurrentPage = parseInt(btn.dataset.page, 10);
        adminExportRenderUI();
    });

    document.getElementById('admin-export-pagination')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'admin-export-pagination-input') {
            const p = parseInt(e.target.value, 10);
            if (p >= 1 && p <= adminExportTotalPages) { adminExportCurrentPage = p; adminExportRenderUI(); }
            else { showToast(`Enter a page between 1 and ${adminExportTotalPages}.`, 'error'); e.target.value = adminExportCurrentPage; }
        }
    });
}

// =================================================================
// INITIALIZATION
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    adminAccessSetupListeners();
    adminImportSetupListeners();
    adminExportSetupListeners();
    setupActionModalConfirm();
    setupTutorialListeners();

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
        const activeTarget = document.querySelector('#adminTabs .nav-link.active')?.dataset.bsTarget;
        const t = showToast('Refreshing…', 'info');
        if (activeTarget === '#admin-access-pane') {
            await Promise.all([adminAccessRenderUI(), adminAccessRefreshChipCounts()]);
        } else if (activeTarget === '#admin-import-pane') {
            await Promise.all([adminImportRenderUI(), adminImportRefreshChipCounts()]);
        } else if (activeTarget === '#admin-export-pane') {
            await Promise.all([adminExportRenderUI(), adminExportRefreshChipCounts()]);
        }
        dismissToast(t);
        showToast('Data refreshed.', 'success');
    });

    // Tab switch: lazy-load Import/Export on first visit
    document.getElementById('admin-import-tab')?.addEventListener('shown.bs.tab', async () => {
        await Promise.all([adminImportRenderUI(), adminImportRefreshChipCounts()]);
    });

    document.getElementById('admin-export-tab')?.addEventListener('shown.bs.tab', async () => {
        await Promise.all([adminExportRenderUI(), adminExportRefreshChipCounts()]);
    });

    // Initial render — Access tab is active by default
    await Promise.all([adminAccessRenderUI(), adminAccessRefreshChipCounts()]);
});
