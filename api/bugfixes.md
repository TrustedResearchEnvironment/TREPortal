# Bug Fixes — Discovered by New Test Suite

This document summarises the bugs discovered during test development and the fixes applied. Use it as a reference during git push / merge review.

---

## Bug 1: Null-check ordering in `approve_request_by_id`

**File:** `app/request.py` (line ~258)

**Symptom:** Approving a non-existent request returned HTTP 500 (Internal Server Error) instead of 404.

**Root Cause:** Two debug `print()` statements accessed `req.Approvers` and `req.CreateUser` **before** the `if req is None` check. When the request didn't exist, `req` was `None`, causing an `AttributeError`.

**Before:**
```python
req = db.query(dbtables.Request).filter(dbtables.Request.RequestID == id).first()
print("Approvesrs: ", req.Approvers)
print("CreateUser: ", req.CreateUser)
if req is None:
    raise HTTPException(status_code=404, detail="Request not found")
```

**After:**
```python
req = db.query(dbtables.Request).filter(dbtables.Request.RequestID == id).first()
if req is None:
    raise HTTPException(status_code=404, detail="Request not found")
print("Approvesrs: ", req.Approvers)
print("CreateUser: ", req.CreateUser)
```

**Test that caught it:** `Testing/test_request.py::test_approve_request_not_found`

---

## Bug 2: Column name casing mismatch in metadata value creation

**File:** `app/datasetmetadatavalue.py` (line ~95)

**Symptom:** Creating new `DataSetMetaDataValue` rows via the batch upsert endpoint raised a `TypeError` because the ORM constructor received an unexpected keyword argument.

**Root Cause:** The constructor used `MetadataID=` (lowercase **d**) but the SQLAlchemy model column is `MetaDataID` (uppercase **D**). This only affected the **create** path; the update path was correct.

**Before:**
```python
db_metadata = dbtables.DataSetMetaDataValue(
    DataSetID=data_set_id,
    MetadataID=meta_data.MetaDataID,   # ← wrong casing
    Value=meta_data.Value,
)
```

**After:**
```python
db_metadata = dbtables.DataSetMetaDataValue(
    DataSetID=data_set_id,
    MetaDataID=meta_data.MetaDataID,   # ← matches ORM column
    Value=meta_data.Value,
)
```

**Tests that caught it:**
- `Testing/test_batch_upserts.py::test_batch_create_metadata_values`
- `Testing/test_batch_upserts.py::test_batch_mixed_upsert_metadata`

---

## Files Changed

| File | Change |
|------|--------|
| `app/request.py` | Moved null-check before `print()` statements |
| `app/datasetmetadatavalue.py` | Fixed `MetadataID` → `MetaDataID` casing |
| `Testing/test_request.py` | Removed `@pytest.mark.xfail` from `test_approve_request_not_found` |
| `Testing/test_batch_upserts.py` | Removed `@pytest.mark.xfail` from `test_batch_create_metadata_values` and `test_batch_mixed_upsert_metadata` |
