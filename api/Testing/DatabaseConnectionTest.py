

import sqlalchemy

from PortalLib.CatalogueLib import test_portal_connection
from PortalLib.IntegrateLib import test_integrate_connection
from main import _startup_db_retry



if __name__ == "__main__":

    
    print("Testing Loome Integrate connection on startup...")
    test_integrate_connection()
    print("Loome Integrate connection test completed.")

    print("Testing Loome Portal connection on startup...")
    test_portal_connection()
    print("Loome Portal connection test completed.")
    print("Testing database connection...")
    _startup_db_retry()
    print("Database connection test completed.")

