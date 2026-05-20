// =================================================================
//  MyRequests.js — Unified My Requests Dashboard
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

function formatDate(inputDate) {
    if (!inputDate) return 'N/A';
    const d = new Date(inputDate);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showToast(message, type = 'success', duration = 5000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const bgMap = { success: '#1AABA3', error: '#dc3545', warning: '#fd7e14', info: '#0dcaf0' };
    const toast = document.createElement('div');
    toast.style.cssText = [
        `background:${bgMap[type] || bgMap.info}`,
        'color:#fff', 'padding:11px 16px', 'border-radius:6px',
        'display:flex', 'align-items:center', 'gap:10px',
        'min-width:260px', 'max-width:420px', 'box-shadow:0 4px 12px rgba(0,0,0,.15)',
        'opacity:0', 'transform:translateY(-6px)', 'transition:opacity .18s,transform .18s'
    ].join(';');
    const txt = document.createElement('span');
    txt.style.flex = '1';
    txt.textContent = message;
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
        'approved': 'bg-green-100 text-green-800',
        'finalised': 'bg-green-100 text-green-800',
        'rejected': 'bg-red-100 text-red-800',
        'failed': 'bg-red-100 text-red-800',
        'working': 'bg-purple-100 text-purple-800',
        'awaiting submission': 'bg-yellow-100 text-yellow-800',
    };
    const cls = map[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${status || 'Unknown'}</span>`;
}

function renderPaginationHtml(containerId, totalItems, rowsPerPage, currentPage) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    const disabled = (v) => v ? 'disabled' : '';
    const btnCls = 'btn btn-sm btn-outline-secondary';
    el.innerHTML = `
        <button class="${btnCls}" data-page="1" ${disabled(currentPage === 1)}>First</button>
        <button class="${btnCls}" data-page="${currentPage - 1}" ${disabled(currentPage === 1)}>‹ Prev</button>
        <span class="d-flex align-items-center gap-1 small text-muted">
            Page
            <input id="${containerId}-input" type="number" value="${currentPage}" min="1" max="${totalPages}"
                   class="form-control form-control-sm text-center pagination-input" style="width:54px">
            of ${totalPages}
        </span>
        <button class="${btnCls}" data-page="${currentPage + 1}" ${disabled(currentPage === totalPages)}>Next ›</button>
        <button class="${btnCls}" data-page="${totalPages}" ${disabled(currentPage === totalPages)}>Last</button>`;
}

const SVG_CHEVRON = `<svg class="chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
const SVG_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin-right:4px;flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;

function buildEmptyState(message) {
    return `<p class="text-center py-5 text-gray-400 text-sm">${message}</p>`;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

// =================================================================
// ACCESS TAB  (server-side pagination via GetRequests API)
// =================================================================

const ACCESS_STATUS_MAP    = { 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected' };
const ACCESS_STATUS_TABS   = ['Pending Approval', 'Approved', 'Rejected', 'Finalised'];
const ACCESS_ROWS_PER_PAGE = 5;

let accessCurrentPage   = 1;
let accessTotalPages    = 1;
let accessCurrentStatus = 'Pending Approval';
let accessProjectsCache = null;

async function accessGetProjectsMapping() {
    if (accessProjectsCache) return accessProjectsCache;
    try {
        const res  = await window.loomeApi.runApiRequest('GetAssistProjectsFilteredByUpn', { page: 1, page_size: 200, search: '' });
        const data = safeParseJson(res);
        const map  = {};
        (data?.Results || data || []).forEach(p => {
            map[p.AssistProjectID]        = { name: p.Name, description: p.Description };
            map[String(p.AssistProjectID)] = { name: p.Name, description: p.Description };
        });
        accessProjectsCache = map;
        return map;
    } catch (e) { return {}; }
}

async function accessGetCount(status) {
    try {
        const statusId = Object.entries(ACCESS_STATUS_MAP).find(([, v]) => v === status)?.[0];
        if (!statusId) return 0;
        const res = await window.loomeApi.runApiRequest('GetRequests', { page: 1, pageSize: 1, search: '', statusId: parseInt(statusId) });
        return safeParseJson(res)?.RowCount ?? 0;
    } catch (e) { return 0; }
}

async function accessRefreshChipCounts() {
    const container = document.getElementById('access-chips');
    if (!container) return;
    await Promise.all([...container.querySelectorAll('.req-chip')].map(async chip => {
        chip.querySelector('.chip-count').textContent = await accessGetCount(chip.dataset.status);
    }));
}

function accessShowDeleteModal(requestId, requestName) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteAccessModal'));
    document.getElementById('deleteAccessModalBody').innerHTML = `
        <div class="alert alert-warning mb-3">
            You are about to permanently delete request <strong>${escapeHtml(requestName)}</strong>.<br>
            This action cannot be undone.
        </div>
        <div class="d-flex justify-content-end gap-2">
            <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
            <button id="confirmAccessDelete" class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;white-space:nowrap">${SVG_TRASH}Cancel &amp; Delete</button>
        </div>`;
    modal.show();
    document.getElementById('confirmAccessDelete').addEventListener('click', async () => {
        modal.hide();
        const t = showToast('Deleting request…', 'info');
        try {
            await window.loomeApi.runApiRequest('CancelRequestID', { id: requestId });
            dismissToast(t);
            showToast('Request deleted successfully.', 'success');
            accessCurrentPage = 1;
            await Promise.all([accessRenderUI(), accessRefreshChipCounts()]);
        } catch (e) {
            dismissToast(t);
            showToast('Failed to delete request.', 'error');
        }
    });
}

async function accessRenderUI() {
    const container  = document.getElementById('access-table-area');
    const searchTerm = (document.getElementById('access-search')?.value || '').trim();
    container.innerHTML = `<p class="text-center py-4 text-gray-400 text-sm">Loading…</p>`;

    try {
        const statusId = Object.entries(ACCESS_STATUS_MAP).find(([, v]) => v === accessCurrentStatus)?.[0];
        const params   = { page: accessCurrentPage, pageSize: ACCESS_ROWS_PER_PAGE, search: searchTerm, statusId: parseInt(statusId) };
        const res      = await window.loomeApi.runApiRequest('GetRequests', params);
        const parsed   = safeParseJson(res);
        const data     = (parsed?.Results || []).map(item => ({ ...item, _status: ACCESS_STATUS_MAP[item.StatusID] || 'Unknown' }));
        const total    = parsed?.RowCount || 0;
        accessTotalPages = Math.max(1, Math.ceil(total / ACCESS_ROWS_PER_PAGE));
        accessRenderTable(container, data, accessCurrentStatus);
        renderPaginationHtml('access-pagination', total, ACCESS_ROWS_PER_PAGE, accessCurrentPage);
    } catch (e) {
        container.innerHTML = `<p class="text-center py-4 text-red-500 text-sm">Error loading requests: ${e.message}</p>`;
    }
}

function accessRenderTable(container, data, selectedStatus) {
    if (!data.length) {
        container.innerHTML = buildEmptyState('No requests found for this status.');
        return;
    }
    const tdCls = 'px-6 py-4 text-sm text-gray-700';
    const headers = ['', 'Request ID', 'Request Name', 'Requested On'];
    if (selectedStatus === 'Pending Approval') headers.push('Approvers');
    else if (selectedStatus === 'Approved')    { headers.push('Approved By'); headers.push('Approved On'); }
    else if (selectedStatus === 'Rejected')    { headers.push('Rejected By'); headers.push('Rejected On'); }
    else if (selectedStatus === 'Finalised')   { headers.push('Approved By'); headers.push('Approved On'); headers.push('Finalised On'); }

    const thead = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    let rows = '';
    data.forEach(item => {
        let extra = '';
        switch (selectedStatus) {
            case 'Pending Approval': extra = `<td class="${tdCls}">${escapeHtml(item.Approvers) || 'N/A'}</td>`; break;
            case 'Approved':         extra = `<td class="${tdCls}">${escapeHtml(item.CurrentlyApproved) || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td>`; break;
            case 'Rejected':         extra = `<td class="${tdCls}">${escapeHtml(item.RejectedBy) || 'N/A'}</td><td class="${tdCls}">${formatDate(item.RejectedDate)}</td>`; break;
            case 'Finalised':        extra = `<td class="${tdCls}">${escapeHtml(item.CurrentlyApproved) || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td><td class="${tdCls}">${formatDate(item.FinalisedDate)}</td>`; break;
        }
        const deleteBtn = selectedStatus === 'Pending Approval'
            ? `<button class="btn btn-danger btn-sm access-delete-btn" style="display:inline-flex;align-items:center;white-space:nowrap" data-id="${item.RequestID}" data-name="${escapeHtml(item.Name || '')}">${SVG_TRASH}Cancel &amp; Delete</button>`
            : '';

        rows += `
        <tr class="table-hover-row access-row" data-id="${item.RequestID}" data-dataset-id="${item.DataSetID || ''}">
            <td class="${tdCls} text-center">${SVG_CHEVRON}</td>
            <td class="${tdCls}">${escapeHtml(item.RequestID)}</td>
            <td class="${tdCls} font-medium" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(item.Name || '').replace(/"/g, '&quot;')}">${escapeHtml(item.Name) || 'N/A'}</td>
            <td class="${tdCls}">${formatDate(item.CreateDate)}</td>
            ${extra}
        </tr>
        <tr class="access-detail-row hidden">
            <td colspan="${headers.length}" class="p-0">
                <div class="accordion-detail">
                    <div class="d-flex justify-content-end mb-2">${deleteBtn}</div>
                    <div class="bg-white rounded p-3 shadow-sm access-detail-content">
                        <p class="text-center text-gray-400 text-sm mb-0">Loading details…</p>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = `
        <table class="w-full divide-y divide-gray-200">
            <thead class="bg-gray-50"><tr>${thead}</tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">${rows}</tbody>
        </table>`;

    // Accordion click
    container.querySelectorAll('.access-row').forEach(row => {
        const detailRow = row.nextElementSibling;
        const chevron   = row.querySelector('.chevron-icon');
        let loaded      = false;
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.access-delete-btn')) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            chevron.classList.toggle('rotated', !isOpen);
            if (!isOpen && !loaded) {
                loaded = true;
                const content = detailRow.querySelector('.access-detail-content');
                try {
                    const [reqRes, projectsMap] = await Promise.all([
                        window.loomeApi.runApiRequest('GetRequestID', { RequestID: row.dataset.id }).then(safeParseJson),
                        accessGetProjectsMapping()
                    ]);
                    const dsRes = row.dataset.datasetId
                        ? safeParseJson(await window.loomeApi.runApiRequest('GetDataSetID', { DataSetID: row.dataset.datasetId }))
                        : null;
                    const proj = reqRes?.ProjectID
                        ? (projectsMap[reqRes.ProjectID] || projectsMap[String(reqRes.ProjectID)] || { name: 'Unknown Project' })
                        : { name: 'N/A' };
                    content.innerHTML = `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div class="space-y-2">
                                ${dsRes ? `<p><span class="font-medium text-gray-600">Dataset:</span> <span class="text-gray-500">${escapeHtml(dsRes.Name) || 'N/A'}</span></p>
                                           <p><span class="font-medium text-gray-600">Description:</span> <span class="text-gray-500">${escapeHtml(dsRes.Description) || 'N/A'}</span></p>` : ''}
                                <p><span class="font-medium text-gray-600">Target Project:</span> <span class="text-gray-500">${escapeHtml(proj.name)}</span></p>
                                ${reqRes?.Purpose ? `<p><span class="font-medium text-gray-600">Purpose:</span> <span class="text-gray-500">${escapeHtml(reqRes.Purpose)}</span></p>` : ''}
                            </div>
                            <div class="space-y-2">
                                ${reqRes?.ApprovalMessage  ? `<p><span class="font-medium text-gray-600">Approval Message:</span> <span class="text-gray-500">${escapeHtml(reqRes.ApprovalMessage)}</span></p>` : ''}
                                ${reqRes?.RejectionMessage ? `<p><span class="font-medium text-gray-600">Rejection Message:</span> <span class="text-gray-500">${escapeHtml(reqRes.RejectionMessage)}</span></p>` : ''}
                                ${reqRes?.FinalisedBy      ? `<p><span class="font-medium text-gray-600">Finalised By:</span> <span class="text-gray-500">${escapeHtml(reqRes.FinalisedBy)}</span></p>` : ''}
                            </div>
                        </div>`;
                } catch (err) { content.innerHTML = `<p class="text-red-500 text-sm">Error loading details.</p>`; }
            }
        });
    });

    // Delete button
    container.querySelectorAll('.access-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            accessShowDeleteModal(btn.dataset.id, btn.dataset.name);
        });
    });
}

function accessSetupListeners() {
    document.getElementById('access-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.req-chip');
        if (!chip) return;
        document.getElementById('access-chips').querySelectorAll('.req-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        accessCurrentStatus = chip.dataset.status;
        accessCurrentPage   = 1;
        accessRenderUI();
    });

    document.getElementById('access-search')?.addEventListener('input', debounce(() => {
        accessCurrentPage = 1;
        accessRenderUI();
    }, 300));

    document.getElementById('access-pagination')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled) return;
        accessCurrentPage = parseInt(btn.dataset.page, 10);
        accessRenderUI();
    });

    document.getElementById('access-pagination')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'access-pagination-input') {
            const p = parseInt(e.target.value, 10);
            if (p >= 1 && p <= accessTotalPages) { accessCurrentPage = p; accessRenderUI(); }
            else { showToast(`Enter a page between 1 and ${accessTotalPages}.`, 'error'); e.target.value = accessCurrentPage; }
        }
    });
}

// =================================================================
// IMPORT TAB  (client-side pagination, fetch all at once)
// =================================================================

const IMPORT_STATUS_MAP    = { '-2': 'Failed', '-1': 'Working', 0: 'Awaiting Submission', 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected' };
const IMPORT_ROWS_PER_PAGE = 5;

let importCurrentPage    = 1;
let importTotalPages     = 1;
let importCurrentStatus  = 'Awaiting Submission';
let importAllJobs        = [];
let importProjectsFetched = false;

function importGetStatus(job) {
    const id = job.StatusID ?? 0;
    return IMPORT_STATUS_MAP[id] ?? IMPORT_STATUS_MAP[String(id)] ?? 'Awaiting Submission';
}

function importFilterJobs(status) {
    return importAllJobs.filter(job => {
        const s = importGetStatus(job);
        if (status === 'Awaiting Submission') return s === 'Failed' || s === 'Working' || s === 'Awaiting Submission';
        return s === status;
    });
}

function importRefreshChipCounts() {
    document.getElementById('import-chips')?.querySelectorAll('.req-chip').forEach(chip => {
        chip.querySelector('.chip-count').textContent = importFilterJobs(chip.dataset.status).length;
    });
}

async function importFetchAllJobs() {
    try {
        const r1   = await window.loomeApi.runApiRequest('GetDataImportFromDBbyUpn', { page: 1, pageSize: 1, search: '' });
        const d1   = safeParseJson(r1);
        const total = d1?.RowCount || 0;
        if (!total) { importAllJobs = []; return; }
        const r2   = await window.loomeApi.runApiRequest('GetDataImportFromDBbyUpn', { page: 1, pageSize: total, search: '' });
        const d2   = safeParseJson(r2);
        importAllJobs = (d2?.Results || []).sort((a, b) => new Date(b.CreateDate || 0) - new Date(a.CreateDate || 0));
    } catch (e) { importAllJobs = []; }
}

async function importDeleteJob(requestId) {
    if (!confirm('Delete this import request? This cannot be undone.')) return;
    const t = showToast('Deleting…', 'info');
    try {
        await window.loomeApi.runApiRequest('CancelImportRequest', { ImportRequestID: parseInt(requestId, 10) });
        dismissToast(t);
        showToast('Import request deleted.', 'success');
        await importFetchAllJobs();
        importRefreshChipCounts();
        importRenderUI();
    } catch (e) { dismissToast(t); showToast('Failed to delete import request.', 'error'); }
}

async function importPopulateProjects() {
    const select = document.getElementById('import-project-select');
    if (!select) return;
    select.innerHTML = '<option value="">Loading…</option>';
    select.disabled = true;
    try {
        const res      = await window.loomeApi.runApiRequest('GetAssistProjectsFilteredByUpn', {});
        const data     = safeParseJson(res);
        const projects = data?.Results || data || [];
        select.innerHTML = '<option value="">Select a project…</option>';
        projects.forEach(p => {
            const o = document.createElement('option');
            o.value            = p.AssistProjectID;
            o.textContent      = p.Name;
            o.dataset.name     = p.Name;
            o.dataset.tenantsId = p.LoomeAssistTenantsID;
            select.appendChild(o);
        });
        importProjectsFetched = true;
    } catch (e) {
        select.innerHTML = '<option value="">Error loading projects</option>';
    } finally { select.disabled = false; }
}

function importRenderUI() {
    const container  = document.getElementById('import-table-area');
    const searchTerm = (document.getElementById('import-search')?.value || '').toLowerCase().trim();
    let filtered = importFilterJobs(importCurrentStatus);
    if (searchTerm) filtered = filtered.filter(j => String(j.ImportRequestName || '').toLowerCase().includes(searchTerm));
    const total = filtered.length;
    importTotalPages    = Math.max(1, Math.ceil(total / IMPORT_ROWS_PER_PAGE));
    if (importCurrentPage > importTotalPages) importCurrentPage = importTotalPages;
    const start    = (importCurrentPage - 1) * IMPORT_ROWS_PER_PAGE;
    const pageData = filtered.slice(start, start + IMPORT_ROWS_PER_PAGE).map(j => ({ ...j, _status: importGetStatus(j) }));
    importRenderTable(container, pageData, importCurrentStatus, searchTerm);
    renderPaginationHtml('import-pagination', total, IMPORT_ROWS_PER_PAGE, importCurrentPage);
}

function importRenderTable(container, data, selectedStatus, searchTerm) {
    if (!data.length) {
        container.innerHTML = buildEmptyState(searchTerm ? 'No import requests match your search.' : 'No import requests found.');
        return;
    }
    const tdCls = 'px-6 py-4 text-sm text-gray-700';
    const headers = ['', 'Import Request Name', 'Requested On', 'Project Name'];
    if (selectedStatus === 'Awaiting Submission') headers.push('Status');
    else if (selectedStatus === 'Approved')  { headers.push('Approved By'); headers.push('Approved On'); }
    else if (selectedStatus === 'Rejected')  headers.push('Rejected On');
    else if (selectedStatus === 'Finalised') headers.push('Finalised On');

    const thead = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    let rows = '';
    data.forEach(item => {
        let extra = '';
        switch (selectedStatus) {
            case 'Awaiting Submission': extra = `<td class="${tdCls}">${getStatusBadgeHtml(item._status)}</td>`; break;
            case 'Approved':  extra = `<td class="${tdCls}">${item.ApprovedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td>`; break;
            case 'Rejected':  extra = `<td class="${tdCls}">${formatDate(item.RejectedDate)}</td>`; break;
            case 'Finalised': extra = `<td class="${tdCls}">${formatDate(item.FinalisedDate)}</td>`; break;
        }
        const canDelete = item._status === 'Awaiting Submission' || item._status === 'Failed' || item._status === 'Working';
        const canSubmit = item._status === 'Awaiting Submission';
        const deleteBtn = canDelete ? `<button class="btn btn-danger btn-sm import-delete-btn" style="display:inline-flex;align-items:center;white-space:nowrap" data-id="${item.ImportRequestID}">${SVG_TRASH}Cancel &amp; Delete</button>` : '';
        const submitBtn = canSubmit ? `<button class="btn btn-outline-primary btn-sm import-submit-btn ms-2" data-id="${item.ImportRequestID}">Submit</button>` : '';

        rows += `
        <tr class="table-hover-row import-row" data-id="${item.ImportRequestID}">
            <td class="${tdCls} text-center">${SVG_CHEVRON}</td>
            <td class="${tdCls} font-medium" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(item.ImportRequestName || '').replace(/"/g, '&quot;')}">${escapeHtml(item.ImportRequestName) || 'N/A'}</td>
            <td class="${tdCls}">${formatDate(item.CreateDate)}</td>
            <td class="${tdCls}">${escapeHtml(item.ImportProjectName || item.ProjectName) || 'N/A'}</td>
            ${extra}
        </tr>
        <tr class="import-detail-row hidden">
            <td colspan="${headers.length}" class="p-0">
                <div class="accordion-detail">
                    <div class="d-flex justify-content-end mb-2">${deleteBtn}${submitBtn}</div>
                    <div class="bg-white rounded p-3 shadow-sm import-detail-content">
                        <p class="text-center text-gray-400 text-sm mb-0">Loading details…</p>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = `
        <table class="w-full divide-y divide-gray-200">
            <thead class="bg-gray-50"><tr>${thead}</tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">${rows}</tbody>
        </table>`;

    container.querySelectorAll('.import-row').forEach(row => {
        const detailRow = row.nextElementSibling;
        const chevron   = row.querySelector('.chevron-icon');
        let loaded      = false;
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.import-delete-btn') || e.target.closest('.import-submit-btn')) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            chevron.classList.toggle('rotated', !isOpen);
            if (!isOpen && !loaded) {
                loaded = true;
                const content = detailRow.querySelector('.import-detail-content');
                try {
                    const d = safeParseJson(await window.loomeApi.runApiRequest('GetImportRequestByID', { RequestID: row.dataset.id }));
                    content.innerHTML = `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div class="space-y-2">
                                <p><span class="font-medium text-gray-600">Import Request ID:</span> <span class="text-gray-500">${escapeHtml(d?.ImportRequestID) || 'N/A'}</span></p>
                                <p><span class="font-medium text-gray-600">Project Name:</span> <span class="text-gray-500">${escapeHtml(d?.ProjectName) || 'N/A'}</span></p>
                                ${d?.Purpose ? `<p><span class="font-medium text-gray-600">Purpose:</span> <span class="text-gray-500">${escapeHtml(d.Purpose)}</span></p>` : ''}
                            </div>
                            <div class="space-y-2">
                                ${d?.ApprovedBy       ? `<p><span class="font-medium text-gray-600">Approved By:</span> <span class="text-gray-500">${escapeHtml(d.ApprovedBy)}</span></p>` : ''}
                                ${d?.ApprovedDate     ? `<p><span class="font-medium text-gray-600">Approved On:</span> <span class="text-gray-500">${formatDate(d.ApprovedDate)}</span></p>` : ''}
                                ${d?.ApprovalMessage  ? `<p><span class="font-medium text-gray-600">Approval Message:</span> <span class="text-gray-500">${escapeHtml(d.ApprovalMessage)}</span></p>` : ''}
                                ${d?.RejectedBy       ? `<p><span class="font-medium text-gray-600">Rejected By:</span> <span class="text-gray-500">${escapeHtml(d.RejectedBy)}</span></p>` : ''}
                                ${d?.RejectedDate     ? `<p><span class="font-medium text-gray-600">Rejected On:</span> <span class="text-gray-500">${formatDate(d.RejectedDate)}</span></p>` : ''}
                                ${d?.RejectionMessage ? `<p><span class="font-medium text-gray-600">Rejection Message:</span> <span class="text-gray-500">${escapeHtml(d.RejectionMessage)}</span></p>` : ''}
                            </div>
                        </div>`;
                } catch (err) { content.innerHTML = `<p class="text-red-500 text-sm">Error loading details.</p>`; }
            }
        });
    });

    container.querySelectorAll('.import-delete-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); importDeleteJob(btn.dataset.id); });
    });

    container.querySelectorAll('.import-submit-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm('Submit this import request for approval?')) return;
            const t = showToast('Submitting…', 'info');
            try {
                const res    = await window.loomeApi.runApiRequest('UpdateDataImportRequestStatus', { ImportRequestID: parseInt(btn.dataset.id, 10), statusID: 1 });
                const parsed = safeParseJson(res);
                dismissToast(t);
                if (parsed?.StatusID === 1 || parsed?.success) {
                    showToast('Import request submitted for approval.', 'success');
                    await importFetchAllJobs();
                    importRefreshChipCounts();
                    importRenderUI();
                } else { showToast('Submission may have failed — please refresh.', 'warning'); }
            } catch (err) { dismissToast(t); showToast('Failed to submit import request.', 'error'); }
        });
    });
}

function importSetupListeners() {
    document.getElementById('import-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.req-chip');
        if (!chip) return;
        document.getElementById('import-chips').querySelectorAll('.req-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        importCurrentStatus = chip.dataset.status;
        importCurrentPage   = 1;
        importRenderUI();
    });

    const importSearchEl = document.getElementById('import-search');
    if (importSearchEl) importSearchEl.removeAttribute('minlength');
    importSearchEl?.addEventListener('input', debounce(() => {
        importCurrentPage = 1;
        importRenderUI();
    }, 300));
    importSearchEl?.addEventListener('search', debounce(() => {
        importCurrentPage = 1;
        importRenderUI();
    }, 300));

    document.getElementById('import-pagination')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled) return;
        importCurrentPage = parseInt(btn.dataset.page, 10);
        importRenderUI();
    });

    document.getElementById('import-pagination')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'import-pagination-input') {
            const p = parseInt(e.target.value, 10);
            if (p >= 1 && p <= importTotalPages) { importCurrentPage = p; importRenderUI(); }
            else { showToast(`Enter a page between 1 and ${importTotalPages}.`, 'error'); e.target.value = importCurrentPage; }
        }
    });

    // Import modal wiring
    const importModal = document.getElementById('importModal');

    importModal?.addEventListener('show.bs.modal', () => {
        const importNameEl  = importModal.querySelector('#import-request-name');
        const importSelEl   = importModal.querySelector('#import-project-select');
        const importSubmBtn = importModal.querySelector('#import-submit-btn');
        if (!importProjectsFetched) importPopulateProjects();
        if (importNameEl) { importNameEl.value = ''; importNameEl.maxLength = 100; attachCharCounter(importNameEl, 100); }
        if (importSelEl)   importSelEl.value = '';
        if (importSubmBtn) importSubmBtn.disabled = true;

        const checkImportForm = () => {
            if (importSubmBtn) importSubmBtn.disabled = !(importNameEl?.value.trim() && importSelEl?.value);
        };
        if (importNameEl) importNameEl.oninput  = checkImportForm;
        if (importSelEl)  importSelEl.onchange = checkImportForm;
    });

    importModal?.addEventListener('click', async (e) => {
        const importSubmBtn = importModal.querySelector('#import-submit-btn');
        if (!e.target.closest('#import-submit-btn')) return;
        const importNameEl = importModal.querySelector('#import-request-name');
        const importSelEl  = importModal.querySelector('#import-project-select');
        const name = sanitizeInput(importNameEl?.value.trim());
        const opt  = importSelEl?.options[importSelEl?.selectedIndex];
        if (containsInvalidChars(importNameEl?.value || '')) { showToast('Special characters are not allowed in the request name.', 'error'); return; }
        if (!name || !opt?.value) { showToast('Please fill in all fields.', 'error'); return; }
        if (importSubmBtn) { importSubmBtn.disabled = true; importSubmBtn.textContent = 'Submitting…'; }
        const t = showToast('Creating import request…', 'info');
        try {
            await window.loomeApi.runApiRequest('RequestDataImportByAssistProjectID', {
                ImportRequestName:    name,
                LoomeAssistProjectID: parseInt(opt.value, 10),
                LoomeAssistName:      opt.dataset.name,
                LoomeAssistTenantsID: opt.dataset.tenantsId
            });
            dismissToast(t);
            showToast('Import request created successfully.', 'success');
            sessionStorage.setItem('showRequestPendingHint', '1');
            bootstrap.Modal.getInstance(importModal)?.hide();
            await importFetchAllJobs();
            importRefreshChipCounts();
            importCurrentStatus = 'Awaiting Submission';
            document.getElementById('import-chips').querySelectorAll('.req-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.status === 'Awaiting Submission');
            });
            importRenderUI();
            sessionStorage.setItem('restoreTab', 'import-tab');
            setTimeout(() => location.reload(), 5000);
        } catch (err) {
            dismissToast(t);
            showToast('Failed to create import request.', 'error');
        } finally {
            if (importSubmBtn) { importSubmBtn.disabled = false; importSubmBtn.textContent = 'Submit Request'; }
        }
    });
}

// =================================================================
// EXPORT TAB  (client-side pagination, fetch all at once)
// =================================================================

const EXPORT_STATUS_MAP    = { '-2': 'Failed', '-1': 'Working', 0: 'Awaiting Submission', 1: 'Pending Approval', 2: 'Approved', 3: 'Finalised', 4: 'Rejected' };
const EXPORT_ROWS_PER_PAGE = 5;

let exportCurrentPage     = 1;
let exportTotalPages      = 1;
let exportCurrentStatus   = 'Awaiting Submission';
let exportAllJobs         = [];
let exportProjectsFetched = false;

function exportGetStatus(job) {
    const id = job.StatusID ?? 0;
    return EXPORT_STATUS_MAP[id] ?? EXPORT_STATUS_MAP[String(id)] ?? 'Awaiting Submission';
}

function exportFilterJobs(status) {
    return exportAllJobs.filter(job => {
        const s = exportGetStatus(job);
        if (status === 'Awaiting Submission') return s === 'Failed' || s === 'Working' || s === 'Awaiting Submission';
        return s === status;
    });
}

function exportRefreshChipCounts() {
    document.getElementById('export-chips')?.querySelectorAll('.req-chip').forEach(chip => {
        chip.querySelector('.chip-count').textContent = exportFilterJobs(chip.dataset.status).length;
    });
}

async function exportFetchAllJobs() {
    try {
        const r1    = await window.loomeApi.runApiRequest('GetDataExportFromDBbyUpn', { page: 1, pageSize: 1, search: '' });
        const d1    = safeParseJson(r1);
        const total = d1?.RowCount || 0;
        if (!total) { exportAllJobs = []; return; }
        const r2 = await window.loomeApi.runApiRequest('GetDataExportFromDBbyUpn', { page: 1, pageSize: total, search: '' });
        const d2 = safeParseJson(r2);
        exportAllJobs = (d2?.Results || []).sort((a, b) => new Date(b.CreateDate || 0) - new Date(a.CreateDate || 0));
    } catch (e) { exportAllJobs = []; }
}

async function exportDeleteJob(requestId) {
    if (!confirm('Delete this export request? This cannot be undone.')) return;
    const t = showToast('Deleting…', 'info');
    try {
        await window.loomeApi.runApiRequest('CancelExportRequest', { ExportRequestID: parseInt(requestId, 10) });
        dismissToast(t);
        showToast('Export request deleted.', 'success');
        await exportFetchAllJobs();
        exportRefreshChipCounts();
        exportRenderUI();
    } catch (e) { dismissToast(t); showToast('Failed to delete export request.', 'error'); }
}

async function exportPopulateProjects() {
    const select = document.getElementById('export-project-select');
    if (!select) return;
    select.innerHTML = '<option value="">Loading…</option>';
    select.disabled  = true;
    try {
        const res      = await window.loomeApi.runApiRequest('GetAssistProjectsFilteredByUpn', {});
        const data     = safeParseJson(res);
        const projects = data?.Results || data || [];
        select.innerHTML = '<option value="">Select a project…</option>';
        projects.forEach(p => {
            const o = document.createElement('option');
            o.value             = p.AssistProjectID;
            o.textContent       = p.Name;
            o.dataset.name      = p.Name;
            o.dataset.tenantsId = p.LoomeAssistTenantsID;
            select.appendChild(o);
        });
        exportProjectsFetched = true;
    } catch (e) {
        select.innerHTML = '<option value="">Error loading projects</option>';
    } finally { select.disabled = false; }
}

function exportRenderUI() {
    const container  = document.getElementById('export-table-area');
    const searchTerm = (document.getElementById('export-search')?.value || '').toLowerCase().trim();
    let filtered = exportFilterJobs(exportCurrentStatus);
    if (searchTerm) filtered = filtered.filter(j => String(j.ExportRequestName || '').toLowerCase().includes(searchTerm));
    const total = filtered.length;
    exportTotalPages    = Math.max(1, Math.ceil(total / EXPORT_ROWS_PER_PAGE));
    if (exportCurrentPage > exportTotalPages) exportCurrentPage = exportTotalPages;
    const start    = (exportCurrentPage - 1) * EXPORT_ROWS_PER_PAGE;
    const pageData = filtered.slice(start, start + EXPORT_ROWS_PER_PAGE).map(j => ({ ...j, _status: exportGetStatus(j) }));
    exportRenderTable(container, pageData, exportCurrentStatus, searchTerm);
    renderPaginationHtml('export-pagination', total, EXPORT_ROWS_PER_PAGE, exportCurrentPage);
}

function exportRenderTable(container, data, selectedStatus, searchTerm) {
    if (!data.length) {
        container.innerHTML = buildEmptyState(searchTerm ? 'No export requests match your search.' : 'No export requests found.');
        return;
    }
    const tdCls = 'px-6 py-4 text-sm text-gray-700';
    const headers = ['', 'Export Request Name', 'Requested On', 'Project Name'];
    if (selectedStatus === 'Awaiting Submission') headers.push('Status');
    else if (selectedStatus === 'Approved')  { headers.push('Approved By'); headers.push('Approved On'); }
    else if (selectedStatus === 'Rejected')  headers.push('Rejected On');
    else if (selectedStatus === 'Finalised') headers.push('Finalised On');

    const thead = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    let rows = '';
    data.forEach(item => {
        let extra = '';
        switch (selectedStatus) {
            case 'Awaiting Submission': extra = `<td class="${tdCls}">${getStatusBadgeHtml(item._status)}</td>`; break;
            case 'Approved':  extra = `<td class="${tdCls}">${item.ApprovedBy || 'N/A'}</td><td class="${tdCls}">${formatDate(item.ApprovedDate)}</td>`; break;
            case 'Rejected':  extra = `<td class="${tdCls}">${formatDate(item.RejectedDate)}</td>`; break;
            case 'Finalised': extra = `<td class="${tdCls}">${formatDate(item.FinalisedDate)}</td>`; break;
        }
        const canDelete = item._status === 'Awaiting Submission' || item._status === 'Failed' || item._status === 'Working';
        const canSubmit = item._status === 'Awaiting Submission';
        const deleteBtn = canDelete ? `<button class="btn btn-danger btn-sm export-delete-btn" style="display:inline-flex;align-items:center;white-space:nowrap" data-id="${item.ExportRequestID}">${SVG_TRASH}Cancel &amp; Delete</button>` : '';
        const submitBtn = canSubmit ? `<button class="btn btn-outline-primary btn-sm export-submit-btn ms-2" data-id="${item.ExportRequestID}">Submit</button>` : '';

        rows += `
        <tr class="table-hover-row export-row" data-id="${item.ExportRequestID}">
            <td class="${tdCls} text-center">${SVG_CHEVRON}</td>
            <td class="${tdCls} font-medium" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(item.ExportRequestName || '').replace(/"/g, '&quot;')}">${escapeHtml(item.ExportRequestName) || 'N/A'}</td>
            <td class="${tdCls}">${formatDate(item.CreateDate)}</td>
            <td class="${tdCls}">${escapeHtml(item.ExportProjectName || item.ProjectName) || 'N/A'}</td>
            ${extra}
        </tr>
        <tr class="export-detail-row hidden">
            <td colspan="${headers.length}" class="p-0">
                <div class="accordion-detail">
                    <div class="d-flex justify-content-end mb-2">${deleteBtn}${submitBtn}</div>
                    <div class="bg-white rounded p-3 shadow-sm export-detail-content">
                        <p class="text-center text-gray-400 text-sm mb-0">Loading details…</p>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = `
        <table class="w-full divide-y divide-gray-200">
            <thead class="bg-gray-50"><tr>${thead}</tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">${rows}</tbody>
        </table>`;

    container.querySelectorAll('.export-row').forEach(row => {
        const detailRow = row.nextElementSibling;
        const chevron   = row.querySelector('.chevron-icon');
        let loaded      = false;
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.export-delete-btn') || e.target.closest('.export-submit-btn')) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            chevron.classList.toggle('rotated', !isOpen);
            if (!isOpen && !loaded) {
                loaded = true;
                const content = detailRow.querySelector('.export-detail-content');
                try {
                    const d = safeParseJson(await window.loomeApi.runApiRequest('GetExportRequestByID', { ExportRequestID: parseInt(row.dataset.id, 10) }));
                    content.innerHTML = `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div class="space-y-2">
                                <p><span class="font-medium text-gray-600">Export Request ID:</span> <span class="text-gray-500">${escapeHtml(d?.ExportRequestID) || 'N/A'}</span></p>
                                <p><span class="font-medium text-gray-600">Project Name:</span> <span class="text-gray-500">${escapeHtml(d?.ProjectName) || 'N/A'}</span></p>
                                ${d?.Purpose ? `<p><span class="font-medium text-gray-600">Purpose:</span> <span class="text-gray-500">${escapeHtml(d.Purpose)}</span></p>` : ''}
                            </div>
                            <div class="space-y-2">
                                ${d?.ApprovedBy       ? `<p><span class="font-medium text-gray-600">Approved By:</span> <span class="text-gray-500">${escapeHtml(d.ApprovedBy)}</span></p>` : ''}
                                ${d?.ApprovedDate     ? `<p><span class="font-medium text-gray-600">Approved On:</span> <span class="text-gray-500">${formatDate(d.ApprovedDate)}</span></p>` : ''}
                                ${d?.ApprovalMessage  ? `<p><span class="font-medium text-gray-600">Approval Message:</span> <span class="text-gray-500">${escapeHtml(d.ApprovalMessage)}</span></p>` : ''}
                                ${d?.RejectedBy       ? `<p><span class="font-medium text-gray-600">Rejected By:</span> <span class="text-gray-500">${escapeHtml(d.RejectedBy)}</span></p>` : ''}
                                ${d?.RejectedDate     ? `<p><span class="font-medium text-gray-600">Rejected On:</span> <span class="text-gray-500">${formatDate(d.RejectedDate)}</span></p>` : ''}
                                ${d?.RejectionMessage ? `<p><span class="font-medium text-gray-600">Rejection Message:</span> <span class="text-gray-500">${escapeHtml(d.RejectionMessage)}</span></p>` : ''}
                            </div>
                        </div>`;
                } catch (err) { content.innerHTML = `<p class="text-red-500 text-sm">Error loading details.</p>`; }
            }
        });
    });

    container.querySelectorAll('.export-delete-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); exportDeleteJob(btn.dataset.id); });
    });

    container.querySelectorAll('.export-submit-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm('Submit this export request for approval?')) return;
            const t = showToast('Submitting…', 'info');
            try {
                const res    = await window.loomeApi.runApiRequest('UpdateDataExportRequestStatus', { ExportRequestID: parseInt(btn.dataset.id, 10), statusID: 1 });
                const parsed = safeParseJson(res);
                dismissToast(t);
                if (parsed?.StatusID === 1 || parsed?.success) {
                    showToast('Export request submitted for approval.', 'success');
                    await exportFetchAllJobs();
                    exportRefreshChipCounts();
                    exportRenderUI();
                } else { showToast('Submission may have failed — please refresh.', 'warning'); }
            } catch (err) { dismissToast(t); showToast('Failed to submit export request.', 'error'); }
        });
    });
}

function exportSetupListeners() {
    document.getElementById('export-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.req-chip');
        if (!chip) return;
        document.getElementById('export-chips').querySelectorAll('.req-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        exportCurrentStatus = chip.dataset.status;
        exportCurrentPage   = 1;
        exportRenderUI();
    });

    const exportSearchEl = document.getElementById('export-search');
    if (exportSearchEl) exportSearchEl.removeAttribute('minlength');
    exportSearchEl?.addEventListener('input', debounce(() => {
        exportCurrentPage = 1;
        exportRenderUI();
    }, 300));
    exportSearchEl?.addEventListener('search', debounce(() => {
        exportCurrentPage = 1;
        exportRenderUI();
    }, 300));

    document.getElementById('export-pagination')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled) return;
        exportCurrentPage = parseInt(btn.dataset.page, 10);
        exportRenderUI();
    });

    document.getElementById('export-pagination')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'export-pagination-input') {
            const p = parseInt(e.target.value, 10);
            if (p >= 1 && p <= exportTotalPages) { exportCurrentPage = p; exportRenderUI(); }
            else { showToast(`Enter a page between 1 and ${exportTotalPages}.`, 'error'); e.target.value = exportCurrentPage; }
        }
    });

    // Export modal wiring
    const exportModal = document.getElementById('exportModal');

    exportModal?.addEventListener('show.bs.modal', () => {
        const exportNameEl  = exportModal.querySelector('#export-request-name');
        const exportSelEl   = exportModal.querySelector('#export-project-select');
        const exportSubmBtn = exportModal.querySelector('#export-submit-btn');
        if (!exportProjectsFetched) exportPopulateProjects();
        if (exportNameEl) { exportNameEl.value = ''; exportNameEl.maxLength = 100; attachCharCounter(exportNameEl, 100); }
        if (exportSelEl)   exportSelEl.value = '';
        if (exportSubmBtn) exportSubmBtn.disabled = true;

        const checkExportForm = () => {
            if (exportSubmBtn) exportSubmBtn.disabled = !(exportNameEl?.value.trim() && exportSelEl?.value);
        };
        if (exportNameEl) exportNameEl.oninput  = checkExportForm;
        if (exportSelEl)  exportSelEl.onchange = checkExportForm;
    });

    exportModal?.addEventListener('click', async (e) => {
        const exportSubmBtn = exportModal.querySelector('#export-submit-btn');
        if (!e.target.closest('#export-submit-btn')) return;
        const exportNameEl = exportModal.querySelector('#export-request-name');
        const exportSelEl  = exportModal.querySelector('#export-project-select');
        const name = sanitizeInput(exportNameEl?.value.trim());
        const opt  = exportSelEl?.options[exportSelEl?.selectedIndex];
        if (containsInvalidChars(exportNameEl?.value || '')) { showToast('Special characters are not allowed in the request name.', 'error'); return; }
        if (!name || !opt?.value) { showToast('Please fill in all fields.', 'error'); return; }
        if (exportSubmBtn) { exportSubmBtn.disabled = true; exportSubmBtn.textContent = 'Submitting…'; }
        const t = showToast('Creating export request…', 'info');
        try {
            await window.loomeApi.runApiRequest('RequestDataExportByAssistProjectID', {
                ExportRequestName:    name,
                LoomeAssistProjectID: parseInt(opt.value, 10),
                LoomeAssistName:      opt.dataset.name,
                LoomeAssistTenantsID: opt.dataset.tenantsId
            });
            dismissToast(t);
            showToast('Export request created successfully.', 'success');
            sessionStorage.setItem('showRequestPendingHint', '1');
            bootstrap.Modal.getInstance(exportModal)?.hide();
            await exportFetchAllJobs();
            exportRefreshChipCounts();
            exportCurrentStatus = 'Awaiting Submission';
            document.getElementById('export-chips').querySelectorAll('.req-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.status === 'Awaiting Submission');
            });
            exportRenderUI();
            sessionStorage.setItem('restoreTab', 'export-tab');
            setTimeout(() => location.reload(), 5000);
        } catch (err) {
            dismissToast(t);
            showToast('Failed to create export request.', 'error');
        } finally {
            if (exportSubmBtn) { exportSubmBtn.disabled = false; exportSubmBtn.textContent = 'Submit Request'; }
        }
    });
}

// =================================================================
// INITIALIZATION
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    accessSetupListeners();
    importSetupListeners();
    exportSetupListeners();

    if (sessionStorage.getItem('showRequestPendingHint')) {
        sessionStorage.removeItem('showRequestPendingHint');
        showToast('Request submitted. It may take a few minutes to move from “Working” to “Awaiting Submission” — refresh the page to check its progress.', 'info', 12000);
    }

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
        const activeTarget = document.querySelector('#requestTabs .nav-link.active')?.dataset.bsTarget;
        const t = showToast('Refreshing…', 'info');
        if (activeTarget === '#access-pane') {
            await Promise.all([accessRenderUI(), accessRefreshChipCounts()]);
        } else if (activeTarget === '#import-pane') {
            await importFetchAllJobs();
            importRefreshChipCounts();
            importRenderUI();
        } else if (activeTarget === '#export-pane') {
            await exportFetchAllJobs();
            exportRefreshChipCounts();
            exportRenderUI();
        }
        dismissToast(t);
        showToast('Data refreshed.', 'success');
    });

    // Tab switch: lazy-load Import/Export on first visit
    document.getElementById('import-tab')?.addEventListener('shown.bs.tab', async () => {
        if (!importAllJobs.length) {
            document.getElementById('import-table-area').innerHTML =
                `<p class="text-center py-5 text-gray-400 text-sm">Loading…</p>`;
            await importFetchAllJobs();
            importRefreshChipCounts();
        }
        importRenderUI();
    });

    document.getElementById('export-tab')?.addEventListener('shown.bs.tab', async () => {
        if (!exportAllJobs.length) {
            document.getElementById('export-table-area').innerHTML =
                `<p class="text-center py-5 text-gray-400 text-sm">Loading…</p>`;
            await exportFetchAllJobs();
            exportRefreshChipCounts();
        }
        exportRenderUI();
    });

    // Restore tab from before reload — must happen AFTER shown.bs.tab listeners are attached
    const tabToRestore = sessionStorage.getItem('restoreTab');
    if (tabToRestore) {
        sessionStorage.removeItem('restoreTab');
        const tabEl = document.getElementById(tabToRestore);
        if (tabEl) bootstrap.Tab.getOrCreateInstance(tabEl).show();
    } else {
        // Default: render Access tab
        await Promise.all([accessRenderUI(), accessRefreshChipCounts()]);
    }
});
