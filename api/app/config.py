
# config.py

import os
from dotenv import load_dotenv
from datetime import timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Load variables from the .env file into the environment
load_dotenv()

# --- Read the timezone string from the environment ---
# Default to "UTC" if the variable is not set. This is a safe fallback.
_tz_string = os.getenv("APP_TIMEZONE", "UTC")

# --- Convert the string into a reusable timezone object ---
def get_timezone_object(tz_string: str) -> timezone:
    """
    Converts a timezone string (e.g., "UTC", "Europe/London") into a
    datetime-compatible timezone object.
    """
    # Handle the special case for "UTC"
    if tz_string.upper() == "UTC":
        return timezone.utc
    
    # Try to create a ZoneInfo object for all other IANA names
    try:
        return ZoneInfo(tz_string)
    except ZoneInfoNotFoundError:
        print(f"WARNING: Invalid timezone '{tz_string}' found in .env file. "
              f"Defaulting to UTC.")
        return timezone.utc

# This is the timezone object your application will import and use
APP_TIMEZONE_OBJ = get_timezone_object(_tz_string)

# --- Catalogue & Entity Metadata Configuration ---
# CUSTOM_APP_NAME is used to identify assets in the Portal Catalogue.
# Overriding this allows different branches/environments to separate their assets.
CUSTOM_APP_NAME = os.getenv("CUSTOM_APP_NAME", "TRE Research Assets")

# Embedding URLs for different entity types.
# These can be overridden to point to different blob storage locations or JS files per branch.
EMBEDDING_URL_DB = os.getenv("EMBEDDING_URL_DB", "https://sttrewebdataonlydevtre.blob.core.windows.net/$web/embeddings/TREEntityDB.js")
EMBEDDING_URL_REDCap = os.getenv("EMBEDDING_URL_REDCap", "https://sttrewebdataonlydevtre.blob.core.windows.net/$web/embeddings/TREEntityREDCap.js")

print(f"Application timezone configured to: {APP_TIMEZONE_OBJ}")
print(f"Catalogue Custom App Name: {CUSTOM_APP_NAME}")