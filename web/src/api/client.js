// Direct client for the TrustAPI operations listed in DeveloperAPIRequests/AllRequests.json.
// Each entry mirrors one catalog operation:
//   id  - catalog id
//   m   - HTTP method
//   p   - path template; {name} is replaced by params[name]
//   q   - query string: array of same-named keys, or { queryKey: paramName }
//   b   - body: 'payload' sends params.payload; { bodyKey: paramName | fn(params) } builds an object
// Portal - * operations are not listed here; they stay on the host's window.loomeApi.
// X-API-Key is injected by the nginx proxy; the browser sends the Entra ID bearer token
// and the API takes the UPN from it.

import { getAccessToken } from '../auth.js';

// Param names that pages send under a different key than the catalog expects.
const ALIASES = {
    pageSize: 'page_size',
    reason: 'Message',
};

const parseTemplateText = (raw) => {
    // The catalog inserts EmailTemplateText as a raw JSON value; pages send it JSON-encoded.
    if (typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

export const OPERATIONS = {
    GetDataSource:                              { id: 1,  m: 'GET',    p: '/api/DataSource',                                   q: ['search', 'page', 'pageSize', 'activeStatus'] },
    GetDataSetID:                               { id: 2,  m: 'GET',    p: '/api/DataSet/{DataSetID}' },
    GetDatasetIDColumns:                        { id: 3,  m: 'GET',    p: '/api/DataSet/{DataSetID}/columns' },
    GetRequestID:                               { id: 4,  m: 'GET',    p: '/api/Request/{RequestID}' },
    GetAssistProjectsFilteredByUpn:             { id: 5,  m: 'GET',    p: '/api/Request/AssistProjects',                       q: ['page', 'page_size'] },
    GetDataSet:                                 { id: 6,  m: 'GET',    p: '/api/DataSet',                                      q: ['search', 'page', 'pageSize', 'activeStatus'] },
    GetMetadata:                                { id: 7,  m: 'GET',    p: '/api/MetaData',                                     q: ['search', 'page', 'pageSize'] },
    GetDataSourceTypes:                         { id: 8,  m: 'GET',    p: '/api/DataSourceType',                               q: ['search', 'page', 'pageSize'] },
    GetEmailTemplates:                          { id: 9,  m: 'GET',    p: '/api/EmailTemplate',                                q: ['search', 'page', 'pageSize'] },
    GetRequestList:                             { id: 10, m: 'GET',    p: '/api/Request/List',                                 q: ['search', 'page', 'pageSize', 'statusId'] },
    GetAllRequests:                             { id: 11, m: 'GET',    p: '/api/Request/All',                                  q: ['page', 'pageSize', 'statusId', 'search'] },
    RequestDataSet:                             { id: 12, m: 'POST',   p: '/api/DataSet/{DataSetID}/Request',                  b: 'payload' },
    GetDataSourceFieldValues:                   { id: 13, m: 'GET',    p: '/api/DataSourceFieldValue' },
    GetField:                                   { id: 14, m: 'GET',    p: '/api/Field' },
    CancelRequestID:                            { id: 15, m: 'PUT',    p: '/api/Request/{id}/Cancel' },
    UpdateDataSource:                           { id: 16, m: 'PUT',    p: '/api/DataSource/Update/{data_source_id}',           b: 'payload' },
    AddDataSource:                              { id: 17, m: 'POST',   p: '/api/DataSource/Add',
                                                  b: { Name: 'name', Description: 'description', DataSourceTypeID: 'dataSourceTypeID', IsActive: 'isActive', Fields: 'fields' } },
    ApproveRequestID:                           { id: 18, m: 'POST',   p: '/api/Request/{id}/Approve',                         q: ['reason'] },
    RejectRequestID:                            { id: 19, m: 'POST',   p: '/api/Request/{id}/Reject',                          q: ['reason'] },
    GetDataSetActiveStatus:                     { id: 20, m: 'GET',    p: '/api/DataSet/IsActive/{IsActive}' },
    AddMetaData:                                { id: 21, m: 'POST',   p: '/api/MetaData/Add',
                                                  b: { Name: 'name', Description: 'description', IsActive: 'isActive', DataSourceTypeIDs: 'dataSourceTypeIDs' } },
    UpdateMetaData:                             { id: 22, m: 'PUT',    p: '/api/MetaData/Update/{meta_data_id}',               q: { meta_data_id: 'meta_data_id' },
                                                  b: { Name: 'name', Description: 'description', IsActive: 'isActive', DataSourceTypeIDs: 'dataSourceTypeIDs' } },
    UpdateDataSet:                              { id: 23, m: 'PUT',    p: '/api/DataSet/Update/{id}',                          b: 'payload' },
    CreateDataSet:                              { id: 24, m: 'POST',   p: '/api/DataSet/Create',                               b: 'payload' },
    GetDataSourceTable:                         { id: 25, m: 'GET',    p: '/api/DataSource/DataSourceTable' },
    GetDataSourceFolders:                       { id: 26, m: 'GET',    p: '/api/DataSource/DataSourceFolder' },
    GetDatabaseConnection:                      { id: 27, m: 'GET',    p: '/api/DataSource/DatabaseConnection' },
    GetLoomeDataSourceTablesByDataSourceID:     { id: 28, m: 'GET',    p: '/api/DataSourceTables/DataSourceID/{data_source_id}' },
    GetLoomeDataSourceFolders:                  { id: 29, m: 'GET',    p: '/api/DataSourceFolders/{data_source_id}' },
    GetDataSetFieldValuesByDataSetID:           { id: 30, m: 'GET',    p: '/api/DataSetFieldValue/{data_set_id}' },
    GetLoomeDataSourceTablesByTableId:          { id: 31, m: 'GET',    p: '/api/DataSourceTables/TableID/{table_id}' },
    GetColumnsDataByDataSetID:                  { id: 32, m: 'GET',    p: '/api/DataSetColumns/DataSetID/{data_set_id}',       q: ['page', 'pageSize'] },
    CreateAndUpdateDataSetColumns:              { id: 33, m: 'POST',   p: '/api/DataSetColumns/{data_set_id}',
                                                  b: { LogicalColumnName: 'LogicalColumnName', BusinessDescription: 'BusinessDescription', ExampleValue: 'ExampleValue', Redact: 'Redact', Tokenise: 'Tokenise', IsFilter: 'IsFilter' } },
    GetDataSetMetaDataValue:                    { id: 34, m: 'GET',    p: '/api/DataSetMetaDataValue/DataSetID/{data_set_id}' },
    GetDataExport:                              { id: 35, m: 'GET',    p: '/api/DataExport',                                   q: ['page', 'pageSize'] },
    RequestDataExportByAssistProjectID:         { id: 36, m: 'POST',   p: '/api/ExportRequest/WithJob',                        q: ['loomeAssistTenantsID', 'loomeAssistName', 'exportRequestName', 'projectID'] },
    GetAllAssistProjects:                       { id: 37, m: 'GET',    p: '/api/Request/AssistProjects/All' },
    UpdateEmailTemplate:                        { id: 38, m: 'PUT',    p: '/api/EmailTemplate/Update/{email_template_id}',     q: { id: 'email_template_id' },
                                                  b: { EmailTemplateID: 'email_template_id', EmailTemplateType: 'email_template_type', EmailTemplateSubject: 'email_template_subject', EmailTemplateText: (p) => parseTemplateText(p.email_template_body) } },
    GetRequests:                                { id: 39, m: 'GET',    p: '/api/Request/',                                     q: ['page', 'pageSize', 'search', 'statusId'] },
    GetLoomeDataSourceFirstSubFolders:          { id: 40, m: 'GET',    p: '/api/DataSourceFolders/FirstSubFolder/{data_source_id}' },
    GetLoomeDataSourceSubFoldersWithFiles:      { id: 41, m: 'GET',    p: '/api/DataSourceFolders/SubFoldersWithFiles',        q: ['data_source_id', 'sub_folder_name'] },
    GetFolderConnection:                        { id: 42, m: 'GET',    p: '/api/DataSource/Folder' },
    GetDataSetFolderFileByDataSetID:            { id: 43, m: 'GET',    p: '/api/DataSetFolderFile/{data_set_id}' },
    CancelDataSet:                              { id: 44, m: 'PUT',    p: '/api/DataSet/{id}/Cancel' },
    CancelDataSource:                           { id: 45, m: 'PUT',    p: '/api/DataSource/{id}/Cancel' },
    CancelMetaData:                             { id: 46, m: 'PUT',    p: '/api/MetaData/Cancel/{meta_data_id}' },
    SyncREDCapData:                             { id: 47, m: 'GET',    p: '/api/DataSource/sync-redcap/{data_source_id}' },
    ExportDataSetColumnsToExcel:                { id: 48, m: 'POST',   p: '/api/DataSetColumns/download-excel',                b: 'payload' },
    VerifyUploadedSheet:                        { id: 49, m: 'POST',   p: '/api/DataSetColumns/verify-integrity',              b: 'payload' },
    GetDataSourceByID:                          { id: 50, m: 'GET',    p: '/api/DataSource/{data_source_id}' },
    GetDataImport:                              { id: 51, m: 'GET',    p: '/api/DataImport',                                   q: ['page', 'pageSize'] },
    RequestDataImportByAssistProjectID:         { id: 52, m: 'POST',   p: '/api/ImportRequest/WithJob',                        q: ['importRequestName', 'loomeAssistTenantsID', 'loomeAssistName', 'projectID'] },
    GetDataImportFromDBbyUpn:                   { id: 53, m: 'GET',    p: '/api/ImportRequest/List',                           q: ['search', 'page', 'pageSize'] },
    CancelImportRequest:                        { id: 54, m: 'PUT',    p: '/api/ImportRequest/{ImportRequestID}/Cancel' },
    ApproveImportRequest:                       { id: 55, m: 'POST',   p: '/api/ImportRequest/{id}/Approve',                   q: ['reason'] },
    RejectImportRequest:                        { id: 56, m: 'POST',   p: '/api/ImportRequest/{id}/Reject',                    q: ['reason'] },
    GetAllImportRequests:                       { id: 57, m: 'GET',    p: '/api/ImportRequest/',                               q: ['page', 'pageSize', 'statusId', 'search'] },
    GetImportRequestByID:                       { id: 58, m: 'GET',    p: '/api/ImportRequest/{RequestID}' },
    SubmitImportRequestForApproval:             { id: 59, m: 'PUT',    p: '/api/ImportRequest/ForApproval/{ImportRequestID}',  q: { statusID: 'statusID', id: 'ImportRequestID', importProjectID: 'ImportProjectID' } },
    ApprovedImportRequestIntegrateJob:          { id: 60, m: 'POST',   p: '/api/DataImport/ApprovedDataTransfer/{ImportRequestID}' },
    GetDataExportFromDBbyUpn:                   { id: 61, m: 'GET',    p: '/api/ExportRequest/List',                           q: ['search', 'page', 'pageSize'] },
    UpdateDataExportRequestStatus:              { id: 62, m: 'PUT',    p: '/api/ExportRequest/Update/{ExportRequestID}',       q: ['statusID'] },
    CancelExportRequest:                        { id: 63, m: 'PUT',    p: '/api/ExportRequest/{ExportRequestID}/Cancel' },
    GetExportRequestByID:                       { id: 64, m: 'GET',    p: '/api/ExportRequest/{ExportRequestID}' },
    GetAllExportRequests:                       { id: 65, m: 'GET',    p: '/api/ExportRequest/',                               q: ['page', 'pageSize', 'statusId', 'search'] },
    ApproveExportRequest:                       { id: 66, m: 'POST',   p: '/api/ExportRequest/{id}/Approve',                   q: ['reason'] },
    RejectExportRequest:                        { id: 67, m: 'POST',   p: '/api/ExportRequest/{id}/Reject',                    q: ['reason'] },
    ApprovedExportRequestIntegrateJob:          { id: 68, m: 'POST',   p: '/api/DataExport/ApprovedDataExport/{ExportRequestID}', q: { ExportProjectID: 'ExportProjectID', Researcher: 'ResearcherEmail' } },
    GetRequestByDataSetID:                      { id: 72, m: 'GET',    p: '/api/Request/DataSet/{data_set_id}' },
    GetDataSetDateTimeFields:                   { id: 73, m: 'GET',    p: '/api/DataSetColumns/Datetime/DataSetID/{data_set_id}' },
    GetIngestionLogByRequestID:                 { id: 74, m: 'GET',    p: '/api/IngestionLog/GetIngestionLogByRequestID/{request_id}' },
};

const NAME_BY_ID = Object.fromEntries(Object.entries(OPERATIONS).map(([name, op]) => [op.id, name]));

/**
 * Returns the TrustAPI operation name for a catalog name or numeric id, or null when the
 * operation is not in the table (for example Portal - * operations).
 */
export function resolveOperationName(nameOrId) {
    const name = typeof nameOrId === 'number' ? NAME_BY_ID[nameOrId] : nameOrId;
    return typeof name === 'string' && Object.prototype.hasOwnProperty.call(OPERATIONS, name) ? name : null;
}

const pick = (params, key) => {
    if (params[key] !== undefined) return params[key];
    return ALIASES[key] !== undefined ? params[ALIASES[key]] : undefined;
};

const isMissing = (value) => value === undefined || value === null || value === '';

const buildBody = (spec, params) => {
    if (spec === undefined) return undefined;
    if (spec === 'payload') return params.payload;
    return Object.fromEntries(
        Object.entries(spec).map(([key, src]) => [key, typeof src === 'function' ? src(params) : pick(params, src)])
    );
};

/**
 * Calls a TrustAPI operation. Resolves with the parsed JSON body (or text when the body is not JSON),
 * including for non-2xx responses, because pages inspect error payloads such as `detail`.
 * Rejects only on network failure or when a path parameter is missing.
 */
export async function callTrustApi(name, params = {}) {
    const op = OPERATIONS[name];
    if (!op) throw new Error(`Unknown TrustAPI operation: ${name}`);

    const path = op.p.replace(/\{(\w+)\}/g, (_, key) => {
        const value = pick(params, key);
        if (isMissing(value)) throw new Error(`${name}: missing path parameter "${key}"`);
        return encodeURIComponent(value);
    });

    const queryMap = Array.isArray(op.q) ? Object.fromEntries(op.q.map((key) => [key, key])) : (op.q || {});
    const query = new URLSearchParams();
    for (const [queryKey, paramKey] of Object.entries(queryMap)) {
        const value = pick(params, paramKey);
        if (value !== undefined && value !== null) query.append(queryKey, String(value));
    }
    const url = query.toString() ? `${path}?${query}` : path;

    const init = { method: op.m, headers: { Accept: 'application/json' } };
    const token = await getAccessToken();
    if (token) init.headers.Authorization = `Bearer ${token}`;
    const body = buildBody(op.b, params);
    if (body !== undefined && body !== null) {
        init.headers['Content-Type'] = 'application/json';
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
