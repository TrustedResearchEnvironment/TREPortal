# Syrupy Snapshot Testing

This document explains how snapshot testing works with `syrupy` in the TrustAPI project.

## What is Snapshot Testing?

Snapshot testing captures the output of your API and saves it as a "snapshot" file. On subsequent test runs, the output is compared against the saved snapshot. If they don't match, the test fails, alerting you to unexpected changes in your API responses.

## Benefits

- **Catch Unintended Changes**: Automatically detect when API responses change
- **Reduce Boilerplate**: No need to write detailed assertions for complex response structures
- **Documentation**: Snapshots serve as living documentation of your API's output
- **Regression Testing**: Ensure refactoring doesn't break existing behavior

## How It Works

### 1. Writing a Snapshot Test

```python
def test_get_datasets_snapshot(client: TestClient, snapshot):
    """Test dataset response structure matches snapshot."""
    response = client.get("/api/DataSet")
    assert response.status_code == 200
    
    # Snapshot the response structure
    data = response.json()
    assert data == snapshot
```

The `snapshot` fixture is automatically provided by `syrupy`.

### 2. Generating Snapshots

Run the test with the `--snapshot-update` flag to create or update snapshots:

```bash
python3 -m pytest Testing/test_datasets.py::test_get_datasets_snapshot --snapshot-update
```

This creates a snapshot file at `Testing/__snapshots__/test_datasets.ambr`.

### 3. Running Tests

Normal test runs compare against the saved snapshot:

```bash
python3 -m pytest Testing/test_datasets.py::test_get_datasets_snapshot
```

If the API response changes, the test will fail and show a diff.

## Snapshot Files

Snapshots are stored in `__snapshots__/` directories next to your test files:

```
Testing/
├── __snapshots__/
│   └── test_datasets.ambr
├── test_datasets.py
└── test_health.py
```

The `.ambr` files are human-readable and should be committed to version control.

## When to Update Snapshots

Update snapshots when you intentionally change your API:

```bash
# Update all snapshots
python3 -m pytest --snapshot-update

# Update specific test
python3 -m pytest Testing/test_datasets.py::test_get_datasets_snapshot --snapshot-update
```

**Important**: Always review the diff before updating to ensure changes are intentional!

## Best Practices

### 1. Combine with Manual Assertions

Use snapshots for structure, but keep critical assertions explicit:

```python
def test_create_dataset_snapshot(client: TestClient, db_session, snapshot):
    """Test dataset creation response."""
    # ... setup code ...
    
    response = client.post("/api/DataSet/Create", json=new_dataset)
    
    # Critical assertions
    assert response.status_code == 200
    data = response.json()
    assert data["Name"] == "Test Dataset"
    assert data["DataSetID"] is not None
    
    # Snapshot the full response structure
    assert data == snapshot
```

### 2. Use Snapshot Matchers for Dynamic Data

For fields that change (like timestamps or IDs), use matchers:

```python
from syrupy.matchers import path_type

def test_with_dynamic_fields(client: TestClient, snapshot):
    response = client.get("/api/DataSet/1")
    data = response.json()
    
    # Match types instead of exact values for dynamic fields
    assert data == snapshot(matcher=path_type({
        "ModifiedDate": (str,),
        "DataSetID": (int,)
    }))
```

### 3. Snapshot Specific Parts

You can snapshot just part of a response:

```python
def test_dataset_results_only(client: TestClient, snapshot):
    response = client.get("/api/DataSet")
    data = response.json()
    
    # Only snapshot the Results array
    assert data["Results"] == snapshot
```

### 4. Name Your Snapshots

For multiple snapshots in one test:

```python
def test_multiple_endpoints(client: TestClient, snapshot):
    # First endpoint
    response1 = client.get("/api/DataSet")
    assert response1.json() == snapshot(name="datasets")
    
    # Second endpoint
    response2 = client.get("/api/DataSource")
    assert response2.json() == snapshot(name="datasources")
```

## Example: Adding Snapshot Tests to a New Endpoint

Let's add snapshot testing for a `/api/User` endpoint:

```python
# Testing/test_users.py
from fastapi.testclient import TestClient
from app.dbtables import User

def test_get_users_snapshot(client: TestClient, snapshot):
    """Test users list response structure."""
    response = client.get("/api/User")
    assert response.status_code == 200
    assert response.json() == snapshot

def test_get_user_by_id_snapshot(client: TestClient, db_session, snapshot):
    """Test single user response structure."""
    # Arrange: Create test user
    user = User(
        Name="Test User",
        Email="test@example.com",
        IsActive=True
    )
    db_session.add(user)
    db_session.commit()
    
    # Act
    response = client.get(f"/api/User/{user.UserID}")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    
    # Critical fields
    assert data["Email"] == "test@example.com"
    
    # Snapshot full structure
    assert data == snapshot
```

Generate snapshots:

```bash
python3 -m pytest Testing/test_users.py --snapshot-update -v
```

## Reviewing Snapshot Changes

When a snapshot test fails, pytest shows a detailed diff:

```
AssertionError: assert [+ received] == [- snapshot]

  {
    'Results': [
      {
-       'Name': 'Old Name',
+       'Name': 'New Name',
        'DataSetID': 1,
        ...
      }
    ]
  }
```

Review the changes:
- If expected: Update with `--snapshot-update`
- If unexpected: Fix your code

## Troubleshooting

### Snapshot Not Found

If you see "snapshot not found", generate it:

```bash
python3 -m pytest path/to/test.py::test_name --snapshot-update
```

### Snapshot Mismatch

Review the diff carefully. Common causes:
- Intentional API changes (update snapshot)
- Database state differences (ensure proper test isolation)
- Non-deterministic data (use matchers for timestamps, IDs)

### Large Snapshots

If snapshots are too large, consider:
- Snapshotting specific fields instead of the entire response
- Using pagination with smaller page sizes
- Splitting into multiple focused tests

## Integration with CI/CD

In your CI pipeline, run tests normally (without `--snapshot-update`):

```bash
python3 -m pytest
```

Snapshot mismatches will cause the build to fail, preventing unintended API changes from being deployed.

## Snapshot File Management

- **Commit snapshots**: Always commit `.ambr` files to version control
- **Review in PRs**: Snapshot changes should be reviewed like code changes
- **Clean up**: Delete snapshots for removed tests

## Additional Resources

- [Syrupy Documentation](https://github.com/tophat/syrupy)
- [Snapshot Testing Best Practices](https://kentcdodds.com/blog/effective-snapshot-testing)
