from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# This is the single source of truth for your database connection.
# IMPORTANT: Replace 'your_windows_host_ip' with the actual IP of your Windows machine from WSL.
# You can find it by running this command in your WSL terminal:
# cat /etc/resolv.conf | grep nameserver | awk '{print $2}'

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("SQLDB_CONNECTION_STRING")

# Only initialize database for production/local dev, not tests
if SQLALCHEMY_DATABASE_URL:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=True
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    # Tests will inject their own engine via fixtures
    print("No SQLDB_CONNECTION_STRING set - tests will use testcontainer")
    engine = None
    SessionLocal = None

Base = declarative_base()

# Dependency to get the database session using the standard FastAPI pattern.
def get_db():
    if SessionLocal is None:
        raise RuntimeError("Database not configured - SQLDB_CONNECTION_STRING not set")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_db_and_tables():
    if engine is None:
        raise RuntimeError("Database engine not configured - SQLDB_CONNECTION_STRING not set")
    Base.metadata.create_all(bind=engine)
    
