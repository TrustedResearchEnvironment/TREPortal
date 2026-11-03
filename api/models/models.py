from typing import List, Optional, Dict, Annotated
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field as PydanticField

# SQL Server INT (32-bit signed): 1 – 2,147,483,647 for IDs/FKs;
# 0 – 2,147,483,647 for non-negative flags/counters.
_INT32_POS = Annotated[int, PydanticField(gt=0, le=2_147_483_647)]
_INT32_NN  = Annotated[int, PydanticField(ge=0, le=2_147_483_647)]
_IS_ACTIVE = Annotated[int, PydanticField(ge=0, le=2)]          # 0=inactive, 1=active, 2=pending
_STATUS_ID = Annotated[int, PydanticField(ge=-3, le=6)]         # -3 to 6 inclusive; 6=request conflict


class PagedResult(BaseModel):
    CurrentPage: int
    PageCount: int
    PageSize: int
    RowCount: int
    FirstRowOnPage: int
    LastRowOnPage: int


# =======================Data Source Models=======================
class DataSource(BaseModel):
    # Changed field names to PascalCase to match the database model
    DataSourceTypeID: _INT32_POS
    DataSourceID: _INT32_POS
    Name: str
    Description: Optional[str] = None
    isRefreshed: Optional[bool] = None  # This one was already correct
    ModifiedDate: Optional[datetime] = None
    IsActive: _IS_ACTIVE = 1
    RefreshedDate: Optional[datetime] = None
    # FieldValues: List[DataSourceFieldValue] = [] # You will need to fix this model next

class DataSourceCreate(BaseModel):
    Name: str = PydanticField(..., max_length=100)
    Description: Optional[str] = PydanticField(None, max_length=700)
    DataSourceTypeID: _INT32_POS
    IsActive: _IS_ACTIVE = 1 # Provide a sensible default

    # The client must provide a dictionary of field values.
    Fields: Dict[str, Optional[str]]

# ======================= Data Source wit Field Details Model=======================
class DataSourceWithFieldDict(DataSource):
    Fields: Dict[str, Optional[str]] # e.g., {"UNC Path": "\\prod", "Username": "admin"}

# ======================= END Data Source wit Field Details Model =======================

class DataSourcePagedResult(PagedResult):
    Results: List[DataSourceWithFieldDict]

# =======================END Data Source Models=======================
# =======================MetaData Models=======================
class MetaData(BaseModel):
    MetaDataID: _INT32_POS
    Name: str
    Description: str
    IsActive: _IS_ACTIVE
    DataSourceTypeIDs:  List[int]= PydanticField(default_factory=list)  # List of [DataSourceTypeID]
    ModifiedDate: datetime

class MetaDataCreate(BaseModel):
    Name: str = PydanticField(..., max_length=100)
    Description: Optional[str] = PydanticField(None, max_length=500)
    IsActive: _IS_ACTIVE = 1 # Provide a sensible default
    DataSourceTypeIDs: List[int] = PydanticField(default_factory=list)  # List of [DataSourceTypeID]

class MetaDataPagedResult(PagedResult):
    Results: List[MetaData]
# =======================END MetaData Models=======================
# =======================Data Source Type Models=======================
class DataSourceType(BaseModel):
    # Changed field names to PascalCase to match the database model
    DataSourceTypeID: _INT32_POS
    Name: str
    Description: Optional[str] = None
    IsActive: Optional[bool] = None
    ModifiedDate: Optional[datetime] = None
    
class DataSourceTypePagedResult(PagedResult):
    Results: List[DataSourceType]

# =======================END Data Source Type Models=======================
# =======================Data Source Type Models=======================
class DataSourceTypeMetaData(BaseModel):
    # Changed field names to PascalCase to match the database model
    DataSourceTypeMetaDataID: _INT32_POS
    DataSourceTypeID: _INT32_POS
    MetaDataID: _INT32_POS
    

# =======================END Data Source Type Models=======================
# =======================Email Template Models=======================
class EmailTemplate(BaseModel):
    # Changed field names to PascalCase to match the database model
    EmailTemplateID: _INT32_POS
    EmailTemplateType: str
    EmailTemplateSubject: str
    EmailTemplateText: str
    ModifiedDate: Optional[datetime] = None
    
class EmailTemplatePagedResult(PagedResult):
    Results: List[EmailTemplate]

# =======================END Email Template Models=======================
# =======================Data Source Field Models=======================
class DataSourceFieldValue(BaseModel):
    DataSourceFieldValueID: _INT32_POS
    DataSourceID: _INT32_POS
    FieldID: _INT32_POS
    Value: Optional[str] = None

class DataSourceFieldValueCreate(BaseModel):
    DataSourceID: _INT32_POS
    FieldID: _INT32_POS
    Value: Optional[str] = None
# =======================END Data Source Field  Models=======================
# ======================= Field Models=======================
class Field(BaseModel):
    FieldID: _INT32_POS
    Name: str
    Description: Optional[str] = None
    IsActive: bool
    ModifiedDate: datetime
    isLocked: bool

# =======================END  Field  Models=======================


class DataSourceTables(BaseModel):
    Id: _INT32_POS
    DataSourceId: _INT32_POS
    TableName: str
    ColumnList: str
    ColumnTypes: str
    isActive: _INT32_NN

class DataSourceFolders(BaseModel):
    Id: _INT32_POS
    DataSourceId: _INT32_POS
    FolderName: str
    FileExtensions: str
    isActive: _INT32_NN


class RedcapSharedMetaData(BaseModel):
    field_name: str
    field_label: str
    field_type: str



# in models.py

class LoomeIntegrateConnection(BaseModel):
    id: _INT32_POS
    name: str
    connectionType: str

class FieldModel(BaseModel):
    fieldID: _INT32_POS
    name: str
    description: str
    modifiedDate: datetime

class FieldPagedResult(PagedResult):
    results: List[FieldModel]

class RequestFilterValue(BaseModel):
    RequestFilterValueID: _INT32_POS
    RequestID: _INT32_POS
    ColumnName: str
    ColumnType: str
    FilterType: str
    Value1: str
    Value2: str

class Request(BaseModel):
    RequestID: _INT32_POS
    Name: str
    Purpose: Optional[str] = None
    CreateDate: datetime
    CreateUser: str
    ModifiedDate: datetime
    ApprovedDate: Optional[datetime]
    RejectedDate: Optional[datetime]
    FinalisedDate: Optional[datetime]
    StatusID: _STATUS_ID
    ProjectID: _INT32_POS
    DataSetID: _INT32_POS
    Approvers: str
    CurrentlyApproved: Optional[str]
    RejectedBy: Optional[str]
    ApprovalMessage: Optional[str]
    RejectionMessage: Optional[str]
    Orphaned: Optional[datetime] = None

class RequestPagedResult(PagedResult):
    Results: List[Request]

# Miguel:
class RequestCreate(BaseModel):
    requestName: str = PydanticField(..., max_length=100)
    purpose: Optional[str] = PydanticField(None, max_length=500)
    assistProjectID: _INT32_POS
    schedule: Optional[str] = None
    approvers: str
    requestFilterValues: List[RequestFilterValue] = []
    requestID: str
    approvalMessage: Optional[str] = PydanticField(None, max_length=500)
    rejectionMessage: Optional[str] = PydanticField(None, max_length=500)
    approvedDate: datetime
    rejectedDate: datetime
    finalisedDate: datetime
    currentlyApproved: str

# USING
class LoomeAssistProject(BaseModel):
    # Update field names to match the database table structure
    AssistProjectID: _INT32_POS
    Name: str = PydanticField(..., max_length=500)
    Description: Optional[str] = None
    IsActive: Optional[bool] = None
    ModifiedDate: Optional[datetime] = None
    LoomeAssistTenantsID: Optional[str] = None
    DeletedDate: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# USING
class LoomeAssistProjectPagedResult(PagedResult):
    Results: List[LoomeAssistProject]

class LoomeAssistProjectsUsers(BaseModel):
    LoomeAssistProjectsUsersID: _INT32_POS
    LoomeAssistProjectsID: _INT32_POS
    Username: str
    Orphaned: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class LoomeAssistProjectDataRepo(BaseModel):
    LoomeAssistProjectsDataReposID: _INT32_POS
    LoomeAssistProjectsID: _INT32_POS
    SourceDataRepoID: _INT32_POS
    SourceDataRepoName: str
    SummaryDataRepoID: _INT32_POS
    SummaryDataRepoName: str
    Orphaned: Optional[datetime] = None

class User(BaseModel):
    id: _INT32_POS
    username: str
    firstName: str
    lastName: str
    email: str

class UserPagedResult(PagedResult):
    results: List[User]

class Login(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    token: str



class DataSetColumnBase(BaseModel):
    ColumnName: Optional[str] = None
    ColumnType: Optional[str] = None
    LogicalColumnName: Optional[str] = PydanticField(None, max_length=500)
    BusinessDescription: Optional[str] = PydanticField(None, max_length=500)
    ExampleValue: Optional[str] = PydanticField(None, max_length=500)
    Deidentify: bool = False
    TokenIdentifierType: _INT32_NN = 0
    Redact: bool = False
    DisplayOrder: _INT32_NN = 0
    IsFilter: bool = False
    IsActive: _IS_ACTIVE = 1
    ModifiedDate: Optional[datetime] = None



class DataSetColumn(DataSetColumnBase):
    DataSetColumnID: _INT32_POS
    DataSetID: _INT32_POS

    model_config = ConfigDict(from_attributes=True)

class DataSetColumnPagedResult(PagedResult):
    Results: List[DataSetColumn]

# =================== Extra Models for Responses with Metadata ===================
class DataSetFolderFileBase(BaseModel):
    FileType: Optional[str] = None
    FileDescription: Optional[str] = None
    Redact: bool = False
    Deidentify: bool = False
    IsActive: _IS_ACTIVE = 1
    ModifiedDate: Optional[datetime] = None

class DataSetFolderFileCreate(BaseModel):
    FolderName: Optional[str] = None
    FileExtensions: str
    FileType: Optional[str] = None
    FileDescription: Optional[str] = None
    Redact: bool = False
    Deidentify: bool = False

class DataSetFolderFile(DataSetFolderFileBase):
    DataSetFolderFileID: _INT32_POS
    DataSetFolderID: _INT32_POS
    model_config = ConfigDict(from_attributes=True)

class DataSetFileWithFolder(DataSetFolderFile):
    FolderName: str
    model_config = ConfigDict(from_attributes=False)

class DataSetFolderBase(BaseModel):
    FolderName: Optional[str] = None
    Description: Optional[str] = None
    IsActive: _IS_ACTIVE = 1
    ModifiedDate: Optional[datetime] = None
    DataSetFolderFiles: List[DataSetFolderFileCreate] = []

class DataSetFolderCreate(BaseModel):
    FolderName: Optional[str] = PydanticField(None, max_length=500)
    Description: Optional[str] = PydanticField(None, max_length=500)
    DataSetFolderFiles: List[DataSetFolderFileCreate] = []

class DataSetFolder(DataSetFolderBase):
    DataSetFolderID: _INT32_POS
    DataSetID: _INT32_POS
    DataSetFolderFiles: List[DataSetFolderFile] = []

    model_config = ConfigDict(from_attributes=True)

class DataSetColumnCreate(BaseModel):
    # All the fields the client provides
    ColumnName: str = PydanticField(..., max_length=500)
    ColumnType: Optional[str] = None
    LogicalColumnName: Optional[str] = PydanticField(None, max_length=500)
    BusinessDescription: Optional[str] = PydanticField(None, max_length=500)
    ExampleValue: Optional[str] = PydanticField(None, max_length=500)
    Deidentify: bool = False
    TokenIdentifierType: _INT32_NN = 0
    Redact: bool = False
    DisplayOrder: Optional[_INT32_NN] = None
    IsFilter: bool = False

class DataSetMetaDataValueBase(BaseModel):
    MetaDataID: _INT32_POS
    Value: Optional[str] = None
    IsActive: _IS_ACTIVE = 1
    ModifiedDate: Optional[datetime] = None

class DataSetMetaDataValueCreate(BaseModel):
    MetaDataID: _INT32_POS
    Value: Optional[str] = None

class DataSetMetaDataValue(DataSetMetaDataValueBase):
    DataSetMetaDataValueID: _INT32_POS
    DataSetID: _INT32_POS

    model_config = ConfigDict(from_attributes=True)

class DataSetFieldValue(BaseModel):
    DataSetFieldValueID: _INT32_POS
    DataSetID: _INT32_POS
    FieldID: _INT32_POS
    Value: Optional[str] = None
    IsActive: _IS_ACTIVE = 1
    ModifiedDate: Optional[datetime] = None

class DataSetFieldValueCreate(BaseModel):
    FieldID: _INT32_POS
    Value: Optional[str] = None




# =======================Data Set Models=======================

# USING
class DataSetBase(BaseModel):
    Name: str = PydanticField(..., max_length=100)
    Description: Optional[str] = PydanticField(None, max_length=700)
    DataSourceID: _INT32_POS
    IsActive: _IS_ACTIVE = 1
    Approvers: Optional[str] = None
    OptOutMessage: Optional[str] = PydanticField(None, max_length=500)
    OptOutList: Optional[str] = None
    Owner: Optional[str] = None
    OptOutColumn: Optional[str] = "-1"

class DataSet(DataSetBase):
    DataSetID: _INT32_POS
    ModifiedDate: datetime

class DataSetPagedResult(PagedResult):
    Results: List[DataSet]

class DataSetCreate(DataSetBase):
    DataSetFieldValues: List[DataSetFieldValueCreate] = []
    DataSetMetaDataValues: List[DataSetMetaDataValueCreate] = []
    DataSetColumns: List[DataSetColumnCreate] = []
    DataSetFolders: List[DataSetFolderCreate] = []
    DataSetFolderFiles: List[DataSetFolderFileCreate] = []
    DataSourceTypeID: _INT32_POS
    # Allow the client to optionally include a DataSetID in the payload
    # (e.g. "new") so it is preserved when calling `data.model_dump()`.
    DataSetID: Optional[str] = None



class DataSetColumnBase(BaseModel):
    ColumnName: Optional[str] = None
    ColumnType: Optional[str] = None
    LogicalColumnName: Optional[str] = PydanticField(None, max_length=500)
    BusinessDescription: Optional[str] = PydanticField(None, max_length=500)
    ExampleValue: Optional[str] = PydanticField(None, max_length=500)
    Deidentify: bool = False
    TokenIdentifierType: _INT32_NN = 0
    Redact: bool = False
    DisplayOrder: _INT32_NN = 0
    IsFilter: bool = False



class DataSetColumn(DataSetColumnBase):
    DataSetColumnID: _INT32_POS
    DataSetID: _INT32_POS


class DataSetColumnPagedResult(PagedResult):
    Results: List[DataSetColumn]

class DataSetMetaDataValue(BaseModel):
    # The ID will be null/None when creating a new record
    DataSetMetaDataValueID: Optional[_INT32_POS] = None
    DataSetID: _INT32_POS
    MetaDataID: _INT32_POS
    Value: Optional[str] = None

# =======================Other Models=======================
#Miguel
class DatabaseConnection(BaseModel):
    ConnectionID: _INT32_POS
    ConnectionName: str
class TableInfo(BaseModel):
    TableName: str
    ColumnList: str
    ColumnTypes: str

class DataSourceTable(BaseModel):
    ConnectionId: _INT32_POS
    ConnectionName: str
    Tables: List[TableInfo] = []

    model_config = ConfigDict(from_attributes=True)

# class DatabaseConnection(DataSourceFieldValueCreate):
#     ConnectionId: int
#     ConnectionName: str
#     Tables: List[TableInfo] = []

class LoomeDataSourceTables(BaseModel):
    Id: _INT32_POS
    DataSourceId: _INT32_POS
    TableName: str
    ColumnList: str
    ColumnTypes: str
    
    model_config = ConfigDict(from_attributes=True)


# Miguel ---------
class FolderConnection(BaseModel):
    ConnectionID: int
    ConnectionName: str
class FolderInfo(BaseModel):
    FolderName: str
    FileExtensions: str

class LoomeDataSourceFolders(BaseModel):
    ConnectionId: int
    ConnectionName: str
    Folders: List[FolderInfo] = []
# ---------

class MetaDataTokens(BaseModel):
    TokenID: _INT32_POS
    Token: str
    TokenDescription: Optional[str] = None
    DeIdentify: bool = False
    
    model_config = ConfigDict(from_attributes=True)

# class RedcapSharedMetaData(BaseModel):
#     field_name: Optional[str] = None
#     form_name: Optional[str] = None
#     section_header: Optional[str] = None
#     field_type: Optional[str] = None
#     field_label: Optional[str] = None
#     select_choices_or_calculations: Optional[str] = None
#     field_note: Optional[str] = None
#     text_validation_type_or_show_slider_number: Optional[str] = None
#     text_validation_min: Optional[str] = None
#     text_validation_max: Optional[str] = None
#     identifier: Optional[str] = None
#     branching_logic: Optional[str] = None
#     required_field: Optional[str] = None
#     custom_alignment: Optional[str] = None
#     question_number: Optional[str] = None
#     matrix_group_name: Optional[str] = None
#     maxtrix_ranking: Optional[str] = None
#     field_annotation: Optional[str] = None


# =======================MODELS FOR UPDATING =======================


# This model is for a PUT request.
# All fields are required.
class DataSourceUpdate(BaseModel):
    # These fields are now mandatory.
    Name: str
    Description: str
    IsActive: _IS_ACTIVE
    # The Fields dictionary itself is mandatory, but you can decide
    # if the values inside can be null.
    Fields: Dict[str, Optional[str]] 
    



# DEUGGING REMOVE AFTER
# --- ADD THIS NEW MODEL ---
# This model represents the information for a single database trigger.
class TriggerInfo(BaseModel):
    TriggerName: str
    SchemaName: str
    TableName: str
    TriggerDefinition: str

class DbDependencyInfo(BaseModel):
    dependent_object_name: str
    dependent_object_type: str

class ImportRequest(BaseModel):
    ImportRequestID: _INT32_POS
    ImportProjectID: Optional[_INT32_POS] = None 
    JobID: Optional[_INT32_POS] = None
    ImportProjectName: Optional[str] = None
    ImportRequestName: Optional[str] = None
    ProjectName: Optional[str] = None
    ProjectID: Optional[_INT32_POS] = None
    StatusID: _STATUS_ID
    CreateDate: Optional[datetime] = None
    CreateUser: Optional[str] = None
    ApprovedDate: Optional[datetime] = None
    ApprovedBy: Optional[str] = None
    FinalisedDate: Optional[datetime] = None
    RejectedDate: Optional[datetime] = None
    RejectedBy: Optional[str] = None
    ApprovalMessage: Optional[str] = None
    RejectionMessage: Optional[str] = None
    Orphaned: Optional[datetime] = None

class ImportRequestPagedResult(PagedResult):
    Results: List[ImportRequest]

class ImportRequestUpdate(BaseModel):
    StatusID: _STATUS_ID
    ApprovedDate: Optional[datetime] = None
    FinalisedDate: Optional[datetime] = None
    RejectedDate: Optional[datetime] = None
    ApprovalMessage: Optional[str] = PydanticField(None, max_length=500)
    RejectionMessage: Optional[str] = PydanticField(None, max_length=500)


class ExportRequest(BaseModel):
    ExportRequestID: _INT32_POS
    ExportProjectID: Optional[_INT32_POS] = None 
    JobID: Optional[_INT32_POS] = None
    ExportProjectName: Optional[str] = None
    ExportRequestName: Optional[str] = None
    ProjectName: Optional[str] = None
    ProjectID: Optional[_INT32_POS] = None
    StatusID: _STATUS_ID
    CreateDate: Optional[datetime] = None
    CreateUser: Optional[str] = None
    ApprovedDate: Optional[datetime] = None
    ApprovedBy: Optional[str] = None
    FinalisedDate: Optional[datetime] = None
    RejectedDate: Optional[datetime] = None
    RejectedBy: Optional[str] = None
    ApprovalMessage: Optional[str] = None
    RejectionMessage: Optional[str] = None

class ExportRequestPagedResult(PagedResult):
    Results: List[ExportRequest]

class ExportRequestUpdate(BaseModel):
    StatusID: _STATUS_ID
    ApprovedDate: Optional[datetime] = None
    FinalisedDate: Optional[datetime] = None
    RejectedDate: Optional[datetime] = None
    ApprovalMessage: Optional[str] = PydanticField(None, max_length=500)
    RejectionMessage: Optional[str] = PydanticField(None, max_length=500)


# DATA SET REQUEST PAYLOAD MODELS
#  Define the inner Date/Time Filter structure
class DateTimeFilter(BaseModel):
    field: str
    fromDate: Optional[str] = PydanticField(None, alias="from") 
    toDate: Optional[str] = PydanticField(None, alias="to")    

    model_config = ConfigDict(populate_by_name=True)

#  Define the main dataset request content
class DatasetRequestContent(BaseModel):
    approvers: str = PydanticField(..., max_length=1000)  # Assuming this is a comma-separated string
    assistProjectID: int
    purpose: str = PydanticField(..., max_length=500)
    requestName: str = PydanticField(..., max_length=100)
    dateTimeFilters: List[DateTimeFilter]


class IngestionLog(BaseModel):
    IngestionLogID: _INT32_POS
    LoggedDate: Optional[datetime] = None
    ProjectID: Optional[_INT32_POS] = None
    RequestID: _INT32_POS
    IngestionResult: Optional[str] = PydanticField(None, max_length=500)
    ErrorDescription: Optional[str] = PydanticField(None, max_length=500)
    IsResolved: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)