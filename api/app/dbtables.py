from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime


class RequestProjectLock(Base):
    __tablename__ = "RequestProjectLock"
    __table_args__ = {
        "schema": "dbo",
    }

    RequestType = Column(String(20), primary_key=True)
    ProjectID = Column(Integer, primary_key=True)
    CreatedDate = Column(DateTime, nullable=False, server_default=func.sysdatetime())


# Request table
class Request(Base):
    __tablename__ = "Request"
    __table_args__ = {'schema': 'dbo'}

    RequestID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Name = Column(String)
    ProjectID = Column(Integer)
    StatusID = Column(Integer)
    DataSetID = Column(Integer)
    Approvers = Column(String)
    CurrentlyApproved = Column(String, nullable=True)
    CreateUser = Column(String)
    CreateDate = Column(DateTime)
    ModifiedDate = Column(DateTime)
    ApprovedDate = Column(DateTime, nullable=True)
    FinalisedDate = Column(DateTime, nullable=True)
    RejectedBy = Column(String, nullable=True)
    RejectedDate = Column(DateTime, nullable=True)
    ApprovalMessage = Column(String, nullable=True)
    RejectionMessage = Column(String, nullable=True)
    Orphaned = Column(DateTime, nullable=True)
    
    # Assuming 'RequestMessage' from your SQL is 'description' in the model
    Purpose = Column(String, nullable=True)

    # Relationships (optional, but good practice)
    # requestFilterValues = relationship("RequestFilterValue", back_populates="request")

class RequestFilterValue(Base):
    __tablename__ = "RequestFilterValue"
    __table_args__ = {'schema': 'dbo'}

    RequestFilterValueID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    RequestID = Column(Integer, ForeignKey("dbo.Request.RequestID"))
    ColumnName = Column(String)
    ColumnType = Column(String)
    FilterType = Column(String)
    Value1 = Column(String)
    Value2 = Column(String)

    # Relationships (optional, but good practice)
    # request = relationship("Request", back_populates="requestFilterValues")

# DataSource table
class DataSource(Base):
    __tablename__ = "DataSource"
    __table_args__ = {"schema": "dbo"}
    DataSourceID = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String, nullable=True)
    Description = Column(String, nullable=True)
    DataSourceTypeID = Column(Integer, nullable=True)
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, nullable=True)
    isRefreshed = Column(Boolean, nullable=True)
    RefreshedDate = Column(DateTime, nullable=True)

    # CORRECTION: Using 'snake_case' for the property name.
    field_values = relationship(
        "DataSourceFieldValue", 
        back_populates="data_source", # This must match the property name below.
        cascade="all, delete-orphan" # Highly recommended for parent-child links.
    )

class Field(Base):
    __tablename__ = "Field"
    __table_args__ = {"schema": "dbo"}
    FieldID = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(255), nullable=False)
    Description = Column(String(1000), nullable=True)
    IsActive = Column(Boolean, default=True)
    ModifiedDate = Column(DateTime, default=datetime.now)
    isLocked = Column(Boolean, default=False)

    # CORRECTION: Using 'snake_case' for the property name.
    field_values = relationship("DataSourceFieldValue", back_populates="field")

class DataSourceFieldValue(Base):
    __tablename__ = "DataSourceFieldValue"
    __table_args__ = {"schema": "dbo"}
    DataSourceFieldValueID = Column(Integer, primary_key=True, autoincrement=True)
    DataSourceID = Column(Integer, ForeignKey("dbo.DataSource.DataSourceID"), nullable=False)
    FieldID = Column(Integer, ForeignKey("dbo.Field.FieldID"), nullable=False)
    Value = Column(String(4000), nullable=True)
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=func.now())
    
    # CORRECTION: The property names and `back_populates` values are now consistent and case-sensitive.
    data_source = relationship("DataSource", back_populates="field_values")
    field = relationship("Field", back_populates="field_values")

class DataSourceTables(Base):
    __tablename__ = "LoomeDataSourceTables"
    __table_args__ = {"schema": "dbo"}

    Id = Column(Integer, primary_key=True, autoincrement=True)
    DataSourceId = Column(Integer, ForeignKey("dbo.DataSource.DataSourceID"), nullable=False)
    TableName = Column(String(255), nullable=False)
    ColumnList = Column(Text, nullable=True)
    ColumnTypes = Column(Text, nullable=True)
    isActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=datetime.now)

# Alias for compatibility if needed
LoomeDataSourceTables = DataSourceTables

class DataSourceFolders(Base):
    __tablename__ = "LoomeDataSourceFolders"
    __table_args__ = {"schema": "dbo"}

    Id = Column(Integer, primary_key=True, autoincrement=True)
    DataSourceId = Column(Integer, ForeignKey("dbo.DataSource.DataSourceID"), nullable=False)
    FolderName = Column(Text, nullable=True)
    FileExtensions = Column(Text, nullable=True)
    isActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=datetime.now)

# Alias for compatibility
LoomeDataSourceFolders = DataSourceFolders


#     from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import relationship
# from datetime import datetime

# Base = declarative_base()

class DataSet(Base):
    __tablename__ = "DataSet"

    DataSetID = Column(Integer, primary_key=True, index=True)
    Name = Column(String(255), index=True)
    Description = Column(String(1000))
    DataSourceID = Column(Integer)
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=datetime.now)
    Approvers = Column(String(1000))
    OptOutMessage = Column(String(1000))
    OptOutList = Column(Text)
    Owner = Column(String(255))
    OptOutColumn = Column(String(50))

    #Relationships
    

    # Relationships
    # DataSetFieldValues = relationship("DataSetFieldValue", back_populates="dataset", cascade="all, delete-orphan")
    # DataSetMetaDataValues = relationship("DataSetMetaDataValue", back_populates="dataset", cascade="all, delete-orphan")
    # DataSetColumns = relationship("DataSetColumn", back_populates="dataset", cascade="all, delete-orphan")
    # DataSetFolders = relationship("DataSetFolder", back_populates="dataset", cascade="all, delete-orphan")


class DataSetFieldValue(Base):
    __tablename__ = "DataSetFieldValue"

    DataSetFieldValueID = Column(Integer, primary_key=True, index=True)
    DataSetID = Column(Integer, ForeignKey("DataSet.DataSetID"))
    FieldID = Column(Integer)
    Value = Column(String(255))
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=func.now())

    # Relationships
    # dataset = relationship("DataSet", back_populates="DataSetFieldValues")


class DataSetMetaDataValue(Base):
    __tablename__ = "DataSetMetaDataValue"

    DataSetMetaDataValueID = Column(Integer, primary_key=True, index=True)
    DataSetID = Column(Integer, ForeignKey("DataSet.DataSetID"))
    MetaDataID = Column(Integer)
    Value = Column(String(255))
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=func.now())

    # Relationships
    # dataset = relationship("DataSet", back_populates="DataSetMetaDataValues")


class DataSetColumn(Base):
    __tablename__ = "DataSetColumn"

    DataSetColumnID = Column(Integer, primary_key=True, index=True)
    DataSetID = Column(Integer, ForeignKey("DataSet.DataSetID"))
    ColumnName = Column(String(255))
    ColumnType = Column(String(100))
    LogicalColumnName = Column(String(255))
    BusinessDescription = Column(String(1000))
    ExampleValue = Column(String(255))
    Deidentify = Column(Boolean, default=False)
    TokenIdentifierType = Column(Integer, default=0)
    Redact = Column(Boolean, default=False)
    DisplayOrder = Column(Integer, default=0)
    IsFilter = Column(Boolean, default=False)
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=func.now())

    # Relationships
    # dataset = relationship("DataSet", back_populates="DataSetColumns")


class DataSetFolder(Base):
    __tablename__ = "DataSetFolder"

    DataSetFolderID = Column(Integer, primary_key=True, index=True)
    DataSetID = Column(Integer, ForeignKey("DataSet.DataSetID"))
    FolderName = Column(String(255))
    Description = Column(String(1000))
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=func.now())

    # Relationships
    # dataset = relationship("DataSet", back_populates="DataSetFolders")
    DataSetFolderFiles = relationship("DataSetFolderFile", back_populates="folder", cascade="all, delete-orphan")


class DataSetFolderFile(Base):
    __tablename__ = "DataSetFolderFile"

    DataSetFolderFileID = Column(Integer, primary_key=True, index=True)
    DataSetFolderID = Column(Integer, ForeignKey("DataSetFolder.DataSetFolderID"))
    FileType = Column(String(100))
    FileDescription = Column(String(1000))
    # TokeniseRule = Column(String(255))
    Redact = Column(Boolean, default=False)
    Deidentify = Column(Boolean, default=False)
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=func.now())

    # Relationships
    folder = relationship("DataSetFolder", back_populates="DataSetFolderFiles")


class LoomeIntegrateConnections(Base):
    __tablename__ = "LoomeIntegrateConnections"

    ConnectionID = Column(Integer, primary_key=True, index=True)
    ConnectionName = Column(Text)
    ConnectionType = Column(String(255))

# class LoomeDataSourceTables(Base):
#     __tablename__ = "LoomeDataSourceTables"
# 
#     Id = Column(Integer, primary_key=True, index=True)
#     DataSourceId = Column(Integer)
#     TableName = Column(String(255))
#     ColumnList = Column(Text)
#     ColumnTypes = Column(Text)


class LoomeAssistProjectsUsers(Base):
    __tablename__ = "LoomeAssistProjectsUsers"
    __table_args__ = {'schema': 'dbo'}

    Id = Column(Integer, primary_key=True, index=True)
    LoomeAssistProjectsUsersID = Column(Integer)
    LoomeAssistProjectsID = Column(Integer)
    Username = Column(Text)
    Orphaned = Column(DateTime, nullable=True)

# class LoomeDataSourceFolders(Base):
#     __tablename__ = "LoomeDataSourceFolders"
# 
#     Id = Column(Integer, primary_key=True, index=True)
#     DataSourceId = Column(Integer)
#     FolderName = Column(String(255))
#     FileExtensions = Column(String(255))


class MetaDataTokens(Base):
    __tablename__ = "MetaDataTokens"

    TokenID = Column(Integer, primary_key=True, index=True)
    Token = Column(String(255))
    TokenDescription = Column(String(1000))
    DeIdentify = Column(Boolean, default=False)


# class Field(Base):
#     __tablename__ = "Field"

#     FieldID = Column(Integer, primary_key=True, index=True)
#     Name = Column(String(255))
#     Description = Column(String(1000))
#     IsActive = Column(Boolean, default=True)
#     ModifiedDate = Column(DateTime, default=datetime.now)
#     IsLocked = Column(Boolean, default=False)


# class DataSource(Base):
#     __tablename__ = "DataSource"

#     DataSourceID = Column(Integer, primary_key=True, index=True)
#     Name = Column(String(255))
#     Description = Column(String(1000))
#     DataSourceTypeID = Column(Integer)
#     IsActive = Column(Boolean, default=True)
#     ModifiedDate = Column(DateTime, default=datetime.now)
#     isRefreshed = Column(Boolean, default=False)
#     RefreshedDate = Column(DateTime, default=datetime.now)

#     # Relationships
#     DataSourceFieldValues = relationship("DataSourceFieldValue", back_populates="datasource", cascade="all, delete-orphan")


# class DataSourceFieldValue(Base):
#     __tablename__ = "DataSourceFieldValue"

#     DataSourceFieldValueID = Column(Integer, primary_key=True, index=True)
#     DataSourceID = Column(Integer, ForeignKey("DataSource.DataSourceID"))
#     FieldID = Column(Integer)
#     Value = Column(String(255))

#     # Relationships
#     datasource = relationship("DataSource", back_populates="DataSourceFieldValues")


class DataSourceType(Base):
    __tablename__ = "DataSourceType"

    DataSourceTypeID = Column(Integer, primary_key=True, index=True)
    Name = Column(String(255))
    Description = Column(String(1000))
    IsActive = Column(Boolean, default=True)
    ModifiedDate = Column(DateTime, default=datetime.now)

    # Relationships
    DataSourceTypeFields = relationship("DataSourceTypeField", back_populates="datasourcetype", cascade="all, delete-orphan")
    DataSourceTypeMetaDatas = relationship("DataSourceTypeMetaData", back_populates="datasourcetype", cascade="all, delete-orphan")
    DataSetFields = relationship("DataSetField", back_populates="datasourcetype", cascade="all, delete-orphan")


class DataSourceTypeField(Base):
    __tablename__ = "DataSourceTypeField"

    DataSourceTypeFieldID = Column(Integer, primary_key=True, index=True)
    DataSourceTypeID = Column(Integer, ForeignKey("DataSourceType.DataSourceTypeID"))
    FieldID = Column(Integer)

    # Relationships
    datasourcetype = relationship("DataSourceType", back_populates="DataSourceTypeFields")


class DataSourceTypeMetaData(Base):
    __tablename__ = "DataSourceTypeMetaData"

    DataSourceTypeMetaDataID = Column(Integer, primary_key=True, index=True)
    DataSourceTypeID = Column(Integer, ForeignKey("DataSourceType.DataSourceTypeID"))
    MetaDataID = Column(Integer)

    # Relationships
    datasourcetype = relationship("DataSourceType", back_populates="DataSourceTypeMetaDatas")


class DataSetField(Base):
    __tablename__ = "DataSetField"

    DataSetFieldID = Column(Integer, primary_key=True, index=True)
    DataSourceTypeID = Column(Integer, ForeignKey("DataSourceType.DataSourceTypeID"))
    FieldID = Column(Integer)

    # Relationships
    datasourcetype = relationship("DataSourceType", back_populates="DataSetFields")


class MetaData(Base):
    __tablename__ = "MetaData"

    MetaDataID = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(255))
    Description = Column(String(1000))
    IsActive = Column(Integer, default=1)
    ModifiedDate = Column(DateTime, default=datetime.now)


class RedcapSharedMetaData:
    def __init__(self, field_name=None, form_name=None, section_header=None, field_type=None, 
                 field_label=None, select_choices_or_calculations=None, field_note=None,
                 text_validation_type_or_show_slider_number=None, text_validation_min=None, 
                 text_validation_max=None, identifier=None, branching_logic=None, 
                 required_field=None, custom_alignment=None, question_number=None, 
                 matrix_group_name=None, maxtrix_ranking=None, field_annotation=None):
        self.field_name = field_name
        self.form_name = form_name
        self.section_header = section_header
        self.field_type = field_type
        self.field_label = field_label
        self.select_choices_or_calculations = select_choices_or_calculations
        self.field_note = field_note
        self.text_validation_type_or_show_slider_number = text_validation_type_or_show_slider_number
        self.text_validation_min = text_validation_min
        self.text_validation_max = text_validation_max
        self.identifier = identifier
        self.branching_logic = branching_logic
        self.required_field = required_field
        self.custom_alignment = custom_alignment
        self.question_number = question_number
        self.matrix_group_name = matrix_group_name
        self.maxtrix_ranking = maxtrix_ranking
        self.field_annotation = field_annotation
# =================End Dataset
# CREATE TABLE [dbo].[LoomeAssistProjectsDataRepos](
# 	[LoomeAssistProjectsDataReposID] [int] IDENTITY(1,1) NOT NULL,
# 	[LoomeAssistProjectsID] [int] NULL,
# 	[SourceDataRepoID] [int] NULL,
# 	[SourceDataRepoName] [varchar](max) NULL,
# 	[SummaryDataRepoID] [int] NULL,
# 	[SummaryDataRepoName] [varchar](max) NULL
# ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

# CREATE TABLE [dbo].[LoomeAssistProjects](
# 	[LoomeAssistProjectsID] [int] IDENTITY(1,1) NOT NULL,
# 	[LoomeAssistTenantsID] [varchar](max) NULL,
# 	[AssistProjectID] [int] NULL,
# 	[Name] [varchar](max) NULL,
# 	[Description] [varchar](max) NULL,
# 	[IsActive] [bit] NULL,
# 	[ModifiedDate] [datetime] NULL
# ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

class LoomeAssistProjects(Base):
    __tablename__ = "LoomeAssistProjects"
    __table_args__ = {'schema': 'dbo'}

    LoomeAssistProjectsID = Column(Integer, primary_key=True, index=True)
    LoomeAssistTenantsID = Column(String)
    AssistProjectID = Column(Integer)
    Name = Column(String)
    Description = Column(String)
    IsActive = Column(Boolean)
    ModifiedDate = Column(DateTime)
    DeletedDate = Column(DateTime, nullable=True)

    # Relationship to LoomeAssistProjectsDataRepos
    data_repos = relationship("LoomeAssistProjectsDataRepos", back_populates="project")


class LoomeAssistProjectsDataRepos(Base):
    __tablename__ = "LoomeAssistProjectsDataRepos"
    __table_args__ = {'schema': 'dbo'}

    LoomeAssistProjectsDataReposID = Column(Integer, primary_key=True, index=True)
    LoomeAssistProjectsID = Column(Integer, ForeignKey("dbo.LoomeAssistProjects.LoomeAssistProjectsID"))
    SourceDataRepoID = Column(Integer)
    SourceDataRepoName = Column(String)
    SummaryDataRepoID = Column(Integer)
    SummaryDataRepoName = Column(String)
    Orphaned = Column(DateTime, nullable=True)

    # Relationship to LoomeAssistProjects
    project = relationship("LoomeAssistProjects", back_populates="data_repos")


class ImportRequest(Base):
    __tablename__ = "ImportRequest"
    __table_args__ = {'schema': 'dbo'}

    ImportRequestID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ImportProjectID = Column(Integer, nullable=True)
    JobID = Column(Integer, nullable=True)
    ImportProjectName = Column(String, nullable=True)
    ImportRequestName = Column(String, nullable=True)
    ProjectName = Column(String, nullable=True)
    ProjectID = Column(Integer, nullable=True)
    StatusID = Column(Integer, nullable=True)
    CreateDate = Column(DateTime, nullable=True)
    CreateUser = Column(String, nullable=True)
    ApprovedDate = Column(DateTime, nullable=True)
    ApprovedBy = Column(String, nullable=True)
    FinalisedDate = Column(DateTime, nullable=True)
    RejectedDate = Column(DateTime, nullable=True)
    RejectedBy = Column(String, nullable=True)
    ApprovalMessage = Column(String, nullable=True)
    RejectionMessage = Column(String, nullable=True)
    Orphaned = Column(DateTime, nullable=True)
    SolutionCollectionID = Column(Integer, nullable=True)

class ExportRequest(Base):
    __tablename__ = "ExportRequest"
    __table_args__ = {'schema': 'dbo'}

    ExportRequestID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ExportProjectID = Column(Integer, nullable=True)
    JobID = Column(Integer, nullable=True)
    ExportProjectName = Column(String, nullable=True)
    ExportRequestName = Column(String, nullable=True)
    ProjectName = Column(String, nullable=True)
    ProjectID = Column(Integer, nullable=True)
    StatusID = Column(Integer, nullable=True)
    CreateDate = Column(DateTime, nullable=True)
    CreateUser = Column(String, nullable=True)
    ApprovedDate = Column(DateTime, nullable=True)
    ApprovedBy = Column(String, nullable=True)
    FinalisedDate = Column(DateTime, nullable=True)
    RejectedDate = Column(DateTime, nullable=True)
    RejectedBy = Column(String, nullable=True)
    ApprovalMessage = Column(String, nullable=True)
    RejectionMessage = Column(String, nullable=True)
    Orphaned = Column(DateTime, nullable=True)
    SolutionCollectionID = Column(Integer, nullable=True)


class EmailTemplate(Base):
    __tablename__ = "EmailTemplate"
    EmailTemplateID = Column(Integer, primary_key=True, index=True)
    EmailTemplateType = Column(String(255))
    EmailTemplateSubject = Column(String(255))
    EmailTemplateText = Column(String)
    ModifiedDate = Column(DateTime, default=datetime.now)


class IngestionLog(Base):
    __tablename__ = "IngestionLog"
    __table_args__ = {'schema': 'ref'}
    IngestionLogID = Column(Integer, primary_key=True, index=True)
    LoggedDate = Column(DateTime)
    ProjectID = Column(Integer)
    RequestID = Column(Integer)
    IngestionResult = Column(String)
    ErrorDescription = Column(String)
    IsResolved = Column(Boolean, default=False)