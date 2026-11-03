
GET /api/DataSet
Description: Returns a paginated list of datasets.
Query Parameters:
name (string): Filter datasets by name (case-insensitive).
page (int): The page number for pagination.
GET /api/DataSet/GetTablesList
Description: Returns a list of all Loome data source tables.
GET /api/DataSet/GetFoldersList
Description: Returns a list of all Loome data source folders.
GET /api/DataSet/GetDistinctFoldersList
Description: Returns a list of distinct Loome data source folders.
GET /api/DataSet/GetDataSetList
Description: Returns a list of all datasets.
GET /api/DataSet/GetMetaDataTokenList
Description: Returns a list of all metadata tokens.
GET /api/DataSet/TypeAhead
Description: Returns the top 10 datasets for a type-ahead search.
Query Parameters:
name (string): The name to search for.
GET /api/DataSet/{id}
Description: Gets a specific dataset by its ID.
POST /api/DataSet
Description: Creates a new dataset.
Body: A DataSet object.
PUT /api/DataSet/{id}
Description: Updates an existing dataset.
Body: A DataSet object.
DELETE /api/DataSet/{id}
Description: Deletes a dataset by its ID.
GET /api/DataSet/GetREDCapData
Description: Retrieves metadata from a REDCap project.
Query Parameters:
apikey (string): The API key for the REDCap project.
datasourceid (int): The ID of the data source.
DataSourceController
GET /api/DataSource
Description: Returns a paginated list of data sources.
Query Parameters:
name (string): Filter data sources by name.
page (int): The page number for pagination.
GET /api/DataSource/GetConnectionList
Description: Returns a list of Loome Integrate connections for Microsoft SQL Server.
GET /api/DataSource/GetDataSourceList
Description: Returns a list of all refreshed data sources.
GET /api/DataSource/TypeAhead
Description: Returns the top 10 data sources for a type-ahead search.
Query Parameters:
name (string): The name to search for.
GET /api/DataSource/{id}
Description: Gets a specific data source by its ID.
POST /api/DataSource
Description: Creates a new data source.
Body: A DataSource object.
PUT /api/DataSource/{id}
Description: Updates an existing data source.
Body: A DataSource object.
DELETE /api/DataSource/{id}
Description: Deletes a data source by its ID.
DataSourceTypeController
GET /api/DataSourceType
Description: Returns a paginated list of data source types.
Query Parameters:
name (string): Filter data source types by name.
page (int): The page number for pagination.
GET /api/DataSourceType/GetDataSourceTypeList
Description: Returns a list of all data source types, including their fields and metadata.
GET /api/DataSourceType/TypeAhead
Description: Returns the top 10 data source types for a type-ahead search.
Query Parameters:
name (string): The name to search for.
GET /api/DataSourceType/{id}
Description: Gets a specific data source type by its ID.
POST /api/DataSourceType
Description: Creates a new data source type.
Body: A DataSourceType object.
PUT /api/DataSourceType/{id}
Description: Updates an existing data source type.
Body: A DataSourceType object.
DELETE /api/DataSourceType/{id}
Description: Deletes a data source type by its ID.
EmailTemplateController
GET /api/EmailTemplate
Description: Returns a paginated list of email templates.
Query Parameters:
name (string): Filter email templates by type.
page (int): The page number for pagination.
GET /api/EmailTemplate/GetEmailTemplateList
Description: Returns a list of all email templates.
GET /api/EmailTemplate/TypeAhead
Description: Returns the top 10 email templates for a type-ahead search.
Query Parameters:
name (string): The name to search for.
GET /api/EmailTemplate/{id}
Description: Gets a specific email template by its ID.
POST /api/EmailTemplate
Description: Creates a new email template.
Body: An EmailTemplate object.
PUT /api/EmailTemplate/{id}
Description: Updates an existing email template.
Body: An EmailTemplate object.
DELETE /api/EmailTemplate/{id}
Description: Deletes an email template by its ID.
FieldController
GET /api/Field
Description: Returns a paginated list of fields.
Query Parameters:
name (string): Filter fields by name.
page (int): The page number for pagination.
GET /api/Field/GetFieldList
Description: Returns a list of all fields.
GET /api/Field/TypeAhead
Description: Returns the top 10 fields for a type-ahead search.
Query Parameters:
name (string): The name to search for.
GET /api/Field/{id}
Description: Gets a specific field by its ID.
POST /api/Field
Description: Creates a new field.
Body: A Field object.
PUT /api/Field/{id}
Description: Updates an existing field.
Body: A Field object.
DELETE /api/Field/{id}
Description: Deletes a field by its ID.
MetaDataController
GET /api/MetaData
Description: Returns a paginated list of metadata.
Query Parameters:
name (string): Filter metadata by name.
page (int): The page number for pagination.
GET /api/MetaData/GetMetaDataList
Description: Returns a list of all metadata.
GET /api/MetaData/TypeAhead
Description: Returns the top 10 metadata for a type-ahead search.
Query Parameters:
name (string): The name to search for.
GET /api/MetaData/{id}
Description: Gets a specific metadata by its ID.
POST /api/MetaData
Description: Creates a new metadata.
Body: A MetaData object.
PUT /api/MetaData/{id}
Description: Updates an existing metadata.
Body: A MetaData object.
DELETE /api/MetaData/{id}
Description: Deletes a metadata by its ID.
RequestController
GET /api/Request
Description: Returns a paginated list of requests.
Query Parameters:
name (string): Filter requests by name.
page (int): The page number for pagination.
GET /api/Request/{id}
Description: Gets a specific request by its ID.
GET /api/Request/GetLoomeAssistProjectsList
Description: Returns a list of all Loome Assist projects.
GET /api/Request/GetRequestList
Description: Returns a list of all requests.
POST /api/Request
Description: Creates a new request.
Body: A Request object.
PUT /api/Request/{id}
Description: Updates an existing request.
Body: A Request object.
DELETE /api/Request/{id}
Description: Deletes a request by its ID.
UserController
GET /api/User
Description: Returns a paginated list of users.
Query Parameters:
page (int): The page number for pagination.
GET /api/User/{id}
Description: Gets a specific user by their ID.
POST /api/User
Description: Creates a new user.
Body: A User object.
PUT /api/User/{id}
Description: Updates an existing user.
Body: A User object.
DELETE /api/User/{id}
Description: Deletes a user by their ID.
POST /api/User/logon
Description: Authenticates a user and returns a JWT token.
Body: A Login object containing a username and password.