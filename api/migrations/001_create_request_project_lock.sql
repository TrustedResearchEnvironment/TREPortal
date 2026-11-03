IF OBJECT_ID(N'dbo.RequestProjectLock', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestProjectLock
    (
        RequestType varchar(20) NOT NULL,
        ProjectID int NOT NULL,
        CreatedDate datetime2(7) NOT NULL
            CONSTRAINT DF_RequestProjectLock_CreatedDate
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_RequestProjectLock
            PRIMARY KEY (RequestType, ProjectID),

        CONSTRAINT CK_RequestProjectLock_RequestType
            CHECK (RequestType IN ('Export', 'Import'))
    );
END;