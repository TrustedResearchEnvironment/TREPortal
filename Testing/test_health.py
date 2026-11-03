from fastapi.testclient import TestClient

def test_root_endpoint(client: TestClient):
    """Test the root endpoint returns environment info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "GITHUB_REPOSITORY" in data
    assert "CLIENT_IP" in data

def test_db_connection(client: TestClient):
    """Test the database health check endpoint."""
    response = client.get("/test-db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Database connection successful" in data["message"]
