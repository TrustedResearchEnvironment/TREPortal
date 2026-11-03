-- Migration 002: allow Integrate-created project IDs to be populated after
-- the request row is inserted.
--
-- This migration has already been applied to the target database. Keep this
-- file as the checked-in schema record; do not run it again unless deploying
-- to a database that has not received migration 002.

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.ExportRequest')
      AND name = N'ExportProjectID'
      AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.ExportRequest
    ALTER COLUMN ExportProjectID int NULL;
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.ImportRequest')
      AND name = N'ImportProjectID'
      AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.ImportRequest
    ALTER COLUMN ImportProjectID int NULL;
END;