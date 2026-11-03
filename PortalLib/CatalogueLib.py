import os
import requests
import json
import time
import random
import uuid
from typing import Dict, List, Any, Optional
import logging
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


try:
    from dotenv import load_dotenv
    load_dotenv()  # Load environment variables from .env file
except ImportError:
    # python-dotenv not installed, will use system environment variables only
    pass

# Import configuration from app.config
try:
    from app.config import (
        CUSTOM_APP_NAME, 
        EMBEDDING_URL_DB, 
        EMBEDDING_URL_REDCap
    )
except ImportError:
    # Fallback if app.config is not available (e.g. running as standalone script outside app context)
    CUSTOM_APP_NAME = os.getenv("CUSTOM_APP_NAME", "TRE Research Assets")
    EMBEDDING_URL_DB = os.getenv("EMBEDDING_URL_DB", "https://sttrewebdataonlydevtre.blob.core.windows.net/$web/embeddings/TREEntityDB.js")
    EMBEDDING_URL_REDCap = os.getenv("EMBEDDING_URL_REDCap", "https://sttrewebdataonlydevtre.blob.core.windows.net/$web/embeddings/TREEntityREDCap.js")

EMBEDDING_URL_Folder = os.getenv("EMBEDDING_URL_Folder", "https://sttrewebdataonlydevtre.blob.core.windows.net/$web/embeddings/TREEntityFolder.js")

try:
    import certifi
    _has_certifi = True
except ImportError:
    _has_certifi = False

# =================================================================================================
# SECTION 1: SCRIPT CONFIGURATION & GLOBAL VARIABLES
# =================================================================================================


# --- API Configuration ---

TOKEN_URL = os.getenv("TOKEN_URL")
API_BASE_URL = os.getenv("API_BASE_URL")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

CONSUMER_API_URL = f"{API_BASE_URL}/consumer"

# Validate required environment variables
_required_env_vars = {
    "TOKEN_URL": TOKEN_URL,
    "API_BASE_URL": API_BASE_URL,
    "CLIENT_ID": CLIENT_ID,
    "CLIENT_SECRET": CLIENT_SECRET
}

_missing_vars = [var_name for var_name, var_value in _required_env_vars.items() if not var_value]
if _missing_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(_missing_vars)}")




# --- Script Configuration ---
POLLING_INTERVAL_SECONDS = 2 #1.5
 
# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# test portal connection
def test_portal_connection():
    """Test connection to Portal API using configured SSL settings."""
    test_url = f"{API_BASE_URL}/status"
    try:
        _access_token = get_api_token(
            url=TOKEN_URL,
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            scope=None
        )
        headers = {
            "Authorization": f"Bearer {_access_token}"
        }
        # response = invoke_safe_rest_method(
        #     url=test_url,
        #     method="GET",
        #     headers=headers
        # )
        logger.info(f"Portal API connection test successful. headers: {headers}")
    except Exception as e:
        logger.error(f"Portal API connection test failed: {str(e)}")
        # print vars
        logger.error(f"Environment Variables: TOKEN_URL={TOKEN_URL}")
        logger.error(f"Environment Variables: API_BASE_URL={API_BASE_URL}")
        logger.error(f"Environment Variables: CLIENT_ID={CLIENT_ID}")
        # only show part of client secret
        if CLIENT_SECRET:
            logger.error(f"Environment Variables: CLIENT_SECRET={CLIENT_SECRET[:4]}...{CLIENT_SECRET[-4:]}")        
        else:
            logger.error("Environment Variables: CLIENT_SECRET is not set")

                   
# --- SSL Configuration ---

def create_secure_session() -> requests.Session:
    """
    Creates a requests session with proper SSL configuration and retry strategy.
    .
    """
    session = requests.Session()
    
    # Configure retry strategy
    _retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    
    _adapter = HTTPAdapter(max_retries=_retry_strategy)
    session.mount("http://", _adapter)
    session.mount("https://", _adapter)
    
    # SSL Certificate verification configuration
    _ssl_verify = os.getenv("SSL_VERIFY", "true").lower() in ["true", "1", "yes"]
    
    if _ssl_verify:
        # Use certifi certificate bundle if available
        if _has_certifi:
            session.verify = certifi.where()
            logger.info(f"Using certifi certificate bundle: {certifi.where()}")
        else:
            # Use system default certificate verification
            session.verify = True
            logger.info("Using system default certificate verification")
    else:
        # Disable SSL verification for development environments
        session.verify = False
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        logger.warning("SSL certificate verification disabled")
    
    # Optional: Set client certificate if required
    _client_cert = os.getenv("CLIENT_CERT_PATH")
    if _client_cert and os.path.exists(_client_cert):
        session.cert = _client_cert
        logger.info(f"Using client certificate: {_client_cert}")
    
    return session



# =================================================================================================
# SECTION 2: FUNCTION DEFINITIONS
# =================================================================================================

class APIError(Exception):
    """Custom exception for API errors"""
    def __init__(self, message: str, status_code: int = None, response_data: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


def invoke_safe_rest_method(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    data: Optional[Any] = None,
    json_data: Optional[Any] = None
) -> Any:
    """
    A robust wrapper for requests that provides centralized, detailed error handling.
    Uses the global session for consistent SSL handling.
    .
    """
    try:

        _session = create_secure_session()
        
        response = _session.request(
            method=method.upper(),
            url=url,
            headers=headers,
            data=data,
            json=json_data,
            timeout=30
        )
        
        # Special case: Re-raise 429 errors for the polling function to handle
        if response.status_code == 429:
            raise requests.exceptions.HTTPError(f"Rate limit exceeded (429)", response=response)
        
        # Handle BadRequest (400) and other error status codes
        if response.status_code >= 400:
            logger.error(f"API request to '{url}' failed with status code {response.status_code}")
            
            try:
                error_data = response.json()
                if isinstance(error_data, list):
                    # Array of error strings
                    logger.error("The API returned the following errors:")
                    for error in error_data:
                        logger.error(f"- {error}")
                elif isinstance(error_data, str):
                    # Single string error
                    logger.error(f"API Error: {error_data}")
                else:
                    # Fallback: display the entire parsed object
                    logger.error(f"API returned error: {json.dumps(error_data)}")
            except json.JSONDecodeError:
                logger.error(f"API returned non-JSON error: {response.text}")
            
            raise APIError(
                "Script aborted due to API errors",
                status_code=response.status_code,
                response_data=response.text
            )
        
        # Try to return JSON if possible, otherwise return text
        try:
            return response.json()
        except json.JSONDecodeError:
            return response.text
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed: {str(e)}")
        raise


def get_api_token(url: str, client_id: str, client_secret: str, scope: str = None) -> str:
    """Get API authentication token"""
    logger.info("=" * 69)
    logger.info("STEP 1: AUTHENTICATING WITH API")
    logger.info("=" * 69)
    
    token_data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
    }
    if scope:
        token_data["scope"] = scope
    
    response = invoke_safe_rest_method(
        url=url,
        method="POST",
        data=token_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    logger.info("Authentication successful. Token obtained.")
    logger.debug(f"Token response: {response}")
    if "access_token" not in response:
        raise APIError("Authentication failed: 'access_token' not found in response")
    logger.info(f"Access token retrieved successfully. {response['access_token'][:8]}...{response['access_token'][-4:]}")
    return response["access_token"]


def ensure_custom_app(api_url: str, headers: Dict[str, str], app_name: str) -> str:
    """Ensure custom app exists, create if it doesn't"""
    logger.info("=" * 69)
    logger.info("STEP 2: ENSURING CUSTOM APP EXISTS")
    logger.info("=" * 69)
    
    print(headers)
    logger.info(f"Checking for custom app named '{app_name}'...")
    all_apps = invoke_safe_rest_method(
        url=f"{api_url}/customApps",
        method="GET",
        headers=headers
    )

    print("all_apps:", all_apps)
    
    existing_app = next((app for app in all_apps if app["name"] == app_name), None)
    
    if existing_app:
        custom_app_id = existing_app["id"]
        logger.info(f"Found existing app. ID: {custom_app_id}")
        return custom_app_id
    else:
        logger.info("App not found. Creating new app...")
        app_body = {
            "name": app_name,
            "description": "Stores assets from external research institutes."
        }
        
        new_app = invoke_safe_rest_method(
            url=f"{api_url}/customApps",
            method="POST",
            headers=headers,
            json_data=app_body
        )
        
        custom_app_id = new_app["id"]
        logger.info(f"Successfully created new app. ID: {custom_app_id}")
        return custom_app_id



def load_metadata_from_json(file_path: str = "EntityType.json") -> Dict[str, Any]:
    """
    Load metadata configuration (attributes, entity types, and asset template) from JSON file.
    Generated by Copilot.
    """
    try:
        with open(file_path, 'r') as file:
            config = json.load(file)
            
            _entity_types = config.get("entityTypes", [])
            
            # Inject dynamic embedding URLs from configuration
            for et in _entity_types:
                if et.get("type") == "Database":
                    et["embeddingUrl"] = EMBEDDING_URL_DB
                elif et.get("type") == "REDCap API":
                    et["embeddingUrl"] = EMBEDDING_URL_REDCap
                    
            return {
                "attributes": config.get("attributes", []),
                "entityTypes": _entity_types,
                "assetTemplate": config.get("NewAssetTemplate", {})
            }
    except FileNotFoundError:
        logger.error(f"EntityType.json file not found at {file_path}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {str(e)}")
        raise

def create_asset_from_template(_asset_template: Dict[str, Any], _replacements: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create an asset from template by replacing placeholder values.
    """
    # Convert template to JSON string, replace placeholders, then parse back
    _template_json = json.dumps(_asset_template)
    
    for _key, _value in _replacements.items():
        _template_json = _template_json.replace(f"{{{_key}}}", str(_value))
    
    return json.loads(_template_json)

def define_metadata(api_base_url: str, consumer_api_url: str, headers: Dict[str, str], 
                   custom_app_id: str, custom_app_name: str) -> Dict[str, Any]:
    """Define attributes and entity types"""
    
    logger.info("=" * 69)
    logger.info("STEP 3: DEFINING ATTRIBUTES AND ENTITY TYPES (CREATE/UPDATE)")
    logger.info("=" * 69)
    
    logger.info("Fetching all existing attributes and entity types...")
    _existing_attributes = invoke_safe_rest_method(
        url=f"{api_base_url}/attributetype/all",
        method="GET",
        headers=headers
    )
    # print("existing_attributes:", _existing_attributes)

    _existing_entity_types = invoke_safe_rest_method(
        url=f"{api_base_url}/entitytype/nonactivity",
        method="GET",
        headers=headers
    )
    # print("existing_entity_types:", _existing_entity_types)
    
    #  - Load metadata from JSON file
    logger.info("Loading metadata from EntityType.json...")
    _metadata_config = load_metadata_from_json()
    _desired_attributes = _metadata_config["attributes"]
    _desired_entity_types = _metadata_config["entityTypes"]
    
    logger.info("Comparing desired attributes with existing ones...")
    for attribute in _desired_attributes:
        _existing_attr = next(
            (attr for attr in _existing_attributes if attr["name"] == attribute["name"]), 
            None
        )
        if _existing_attr:
            attribute["id"] = _existing_attr["id"]
    
    # print("desired_attributes:", _desired_attributes)
    logger.info("Processing attributes...")
    _final_attributes = invoke_safe_rest_method(
        url=f"{consumer_api_url}/customapps/attributes",
        method="PUT",
        headers=headers,
        json_data=_desired_attributes
    )
    # print(_final_attributes)
    logger.info("Attributes processed successfully.")
    
    logger.info("Comparing desired entity types with existing ones...")
    for entity_type in _desired_entity_types:
        _existing_type = next(
            (et for et in _existing_entity_types 
             if et.get("source") == custom_app_name and et["type"] == entity_type["type"]),
            None
        )
        if _existing_type:
            entity_type["id"] = _existing_type["id"]
    
    logger.info("Processing entity types...")
    invoke_safe_rest_method(
        url=f"{consumer_api_url}/customapps/{custom_app_id}/entity-types",
        method="PUT",
        headers=headers,
        json_data=_desired_entity_types
    )
    logger.info("Entity Types processed successfully.")

    logger.info("Retrieving final entity type mapping for data generation...")
    _final_entity_types = invoke_safe_rest_method(
        url=f"{api_base_url}/entitytype/nonactivity",
        method="GET",
        headers=headers
    )
    
    # Filter for the types that belong to our custom app
    _my_app_entity_types = [
        et for et in _final_entity_types 
        if et.get("source") == custom_app_name
    ]
    
    # Build the lookup map
    _entity_type_map = {et["type"]: et["id"] for et in _my_app_entity_types}
    print ("_entity_type_map:", _entity_type_map)
    logger.info("Successfully built entity type map.")
    return {
        "EntityTypeMap": _entity_type_map,
        "Attributes": _final_attributes
    }


def flatten_options(items: List[Dict], flat_dict: Dict[str, str]) -> None:
    """Recursively flatten nested options"""
    for item in items:
        if item.get("name") and item.get("id"):
            flat_dict[item["name"]] = item["id"]
        if item.get("children"):
            flatten_options(item["children"], flat_dict)


def stage_assets(consumer_api_url: str, headers: Dict[str, str], custom_app_id: str,
                entity_type_map: Dict[str, str], all_attributes: List[Dict], 
                _replacements_list: List[Dict[str, Any]]) -> str:
    """Generate and stage assets"""
    logger.info("=" * 69)
    logger.info("STEP 4: GENERATING AND STAGING ASSETS")
    logger.info("=" * 69)
    
    try:
        logger.info("Building resolution maps from provided metadata...")
        _attribute_map = {attr["name"]: attr for attr in all_attributes}
        # print("_attribute_map:", _attribute_map)
        # print("_entity_type_map:", entity_type_map)
        
        # Load asset template from JSON
        logger.info("Loading asset template from EntityType.json...")
        _metadata_config = load_metadata_from_json()
        _asset_template = _metadata_config["assetTemplate"]
        
        # Debug print to see what's available
        # print("Available keys in _metadata_config:", list(_metadata_config.keys()))
        # print("_asset_template:", _asset_template)
        
        _list_option_maps = {}
        for attr in all_attributes:
            if attr.get("$type") == "List":
                _options = attr.get("options", [])
                _flat_options = {}
                flatten_options(_options, _flat_options)
                _list_option_maps[attr["name"]] = _flat_options
        
        _all_assets = []
        
        # Create multiple assets from template using list of replacements
        for _replacement_dict in _replacements_list:
            # replace with _entityTypeId
            # print entity name id info 
            print(f"Entity Name ID: {_replacement_dict.get('entity_type_name')} -> {entity_type_map.get(_replacement_dict.get('entity_type_name'))}")
            print(f"Entity Type Map: {entity_type_map}")
            _replacement_dict["_entityTypeId"] = entity_type_map.get(_replacement_dict.get("entity_type_name"))
           
            _generated_asset = create_asset_from_template(_asset_template, _replacement_dict)
            
            print(f"Generated asset from template: {_generated_asset}")
             
            if isinstance(_generated_asset, list):
                _all_assets.extend(_generated_asset)
            else:
                _all_assets.append(_generated_asset)
    
        logger.info(f"Asset generation complete. Generated {len(_all_assets)} assets. Staging assets now...")
        _staging_response = invoke_safe_rest_method(
            url=f"{consumer_api_url}/customapps/{custom_app_id}/stage",
            method="POST",
            headers=headers,
            json_data=_all_assets
        )
        
        _execution_id = _staging_response["executionId"]
        logger.info(f"Assets staged successfully. Execution ID: {_execution_id}")
        return _execution_id
        
    except Exception as e:
        logger.error("Failed to generate or stage assets.")
        raise e


def commit_assets(consumer_api_url: str, headers: Dict[str, str], execution_id: str, keep_orphans: bool) -> str:
    """
    Commit staged assets after successful staging.
    .
    """
    # https://{{PortalUrl}}/api/v1/consumer/customapps/execution/{{ExecutionId}}/commit?keepOrphans={{keepOrphans}}
    logger.info("=" * 69)
    logger.info(f"STEP 4.5: COMMITTING STAGED ASSETS (ID: {execution_id})")
    logger.info("=" * 69)
    
    try:
        logger.info(f"Committing staged assets for execution ID: {execution_id}")
        
        commit_response = invoke_safe_rest_method(
            url=f"{consumer_api_url}/customApps/execution/{execution_id}/commit?keepOrphans={'true' if keep_orphans else 'false'}",
            method="POST",
            headers=headers
        )
        
        
        logger.info(f"Assets committed successfully. Commit ID: {commit_response}")
        return commit_response
        
    except Exception as e:
        logger.error(f"Failed to commit staged assets for execution ID: {execution_id}")
        logger.error(str(e))
        raise e


def poll_execution_status(consumer_api_url: str, headers: Dict[str, str], 
                         execution_id: str, polling_interval: int) -> None:
    """Poll for execution status"""
    logger.info("=" * 69)
    logger.info(f"STEP 5: POLLING FOR EXECUTION STATUS (ID: {execution_id})")
    logger.info("=" * 69)
    
    final_status = None
    polling_attempts = 0
    
    while True:
        polling_attempts += 1
        try:
            status_response = invoke_safe_rest_method(
                url=f"{consumer_api_url}/customApps/execution/{execution_id}/status",
                method="GET",
                headers=headers
            )

            status = status_response["status"].upper()
            logger.info(f"Attempt {polling_attempts}: Current status is '{status}'...")
            
            if status not in ["PENDING", "WORKING"]:
                final_status = status_response
                break
                
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 429:
                retry_after = e.response.headers.get('Retry-After', '60')
                logger.info(f"Rate limited by API. Waiting for {retry_after} seconds...")
                time.sleep(int(retry_after))
                continue
            else:
                raise e
        except Exception as e:
            raise e
            
        time.sleep(polling_interval)
    
    logger.info(f"Polling complete. Final status is '{final_status['status']}'.")
    
    if final_status["status"].upper() != "SUCCESS":
        execution_id = final_status["executionId"]
        logger.error(f"EXECUTION FAILED OR WAS CANCELLED for {execution_id}")
        
        if final_status.get("errorMessages"):
            logger.error("Error messages from API:")
            for error_msg in final_status["errorMessages"]:
                logger.error(f"- {error_msg}")


def submit_new_asset(_replacement_dict_list: List[Dict[str, Any]], keep_orphans: bool = True) -> None:
    """
    Submit new assets using provided replacement dictionaries.
    
    Args:
        _replacement_dict_list: List of asset replacement dictionaries
        keep_orphans: If False, will delete assets not in the list (default: True, keeps orphans)
    """
    try:
        # Authenticate
        _access_token = get_api_token(
            url=TOKEN_URL,
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            scope=None
        )
         
        # print(f"Access token retrieved successfully. {_access_token[:8]}...{_access_token[-4:]}")
        
        _api_headers = {
            "Authorization": f"Bearer {_access_token}",
            "Content-Type": "application/json"
        }

        # Ensure our Custom App == Get or create
        _app_id = ensure_custom_app(
            api_url=CONSUMER_API_URL,
            headers=_api_headers,
            app_name=CUSTOM_APP_NAME
        )

        # Ensure our attributes and entity types
        _metadata = define_metadata(
            api_base_url=API_BASE_URL,
            consumer_api_url=CONSUMER_API_URL,
            headers=_api_headers,
            custom_app_id=_app_id,
            custom_app_name=CUSTOM_APP_NAME
        )
        
        logger.info(f"Generated replacement dictionary for asset creation")
        
        # Build the assets and stage them
        _exec_id = stage_assets(
            consumer_api_url=CONSUMER_API_URL,
            headers=_api_headers,
            custom_app_id=_app_id,
            entity_type_map=_metadata["EntityTypeMap"],
            all_attributes=_metadata["Attributes"],
            _replacements_list=_replacement_dict_list  # Use passed parameter
        )

        # commit staged assets
        _commit_id = commit_assets(
            consumer_api_url=CONSUMER_API_URL,
            headers=_api_headers,
            execution_id=_exec_id,
            keep_orphans=keep_orphans
        )
        
        # Poll for completion
        poll_execution_status(
            consumer_api_url=CONSUMER_API_URL,
            headers=_api_headers,
            execution_id=_exec_id,
            polling_interval=POLLING_INTERVAL_SECONDS
        )
        
        logger.info("=" * 69)
        logger.info("SCRIPT COMPLETED SUCCESSFULLY")
        logger.info("=" * 69)
        
    except Exception as e:
        logger.error("SCRIPT FAILED TO COMPLETE")
        logger.error(str(e))
        raise e
