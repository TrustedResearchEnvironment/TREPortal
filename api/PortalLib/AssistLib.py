import os
import requests
import json
import time
import random, datetime
import uuid
from typing import Dict, List, Any, Optional
import logging
# from tomlkit import datetime
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


try:
    from dotenv import load_dotenv
    load_dotenv()  # Load environment variables from .env file
except ImportError:
    # python-dotenv not installed, will use system environment variables only
    pass

# =================================================================================================
# SECTION 1: SCRIPT CONFIGURATION & GLOBAL VARIABLES
# =================================================================================================


# --- API Configuration ---

LOOME_ASSIST_TOKEN_URL = os.getenv("LOOME_ASSIST_TOKEN_URL")
LOOME_ASSIST_API_BASE_URL = os.getenv("LOOME_ASSIST_API_BASE_URL")
LOOME_ASSIST_CLIENT_ID = os.getenv("LOOME_ASSIST_CLIENT_ID")
LOOME_ASSIST_CLIENT_SECRET = os.getenv("LOOME_ASSIST_CLIENT_SECRET") 
# Validate required environment variables
_required_env_vars = {
    "TOKEN_URL": LOOME_ASSIST_TOKEN_URL,
    "API_BASE_URL": LOOME_ASSIST_API_BASE_URL,
    "CLIENT_ID": LOOME_ASSIST_CLIENT_ID,
    "CLIENT_SECRET": LOOME_ASSIST_CLIENT_SECRET
    
}

_missing_vars = [var_name for var_name, var_value in _required_env_vars.items() if not var_value]
if _missing_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(_missing_vars)}")


# connection test, connect get token and validate
def test_assist_connection():
    try:
        token = get_assist_bearer_token()
        print("Successfully obtained Loome Assist token.")
        # get the project 
        numOfProjects = GetAssistProjectList(token)
        if not numOfProjects:
            print(f"No projects found in Loome Assist.")
            return False
        print(f"Successfully accessed Loome Assist project with {numOfProjects} projects.")
        return True
    except Exception as e:
        # print a warning and LOOME* vars
        print(f"LOOME_ASSIST_TOKEN_URL: {LOOME_ASSIST_TOKEN_URL}")
        print(f"LOOME_ASSIST_API_BASE_URL: {LOOME_ASSIST_API_BASE_URL}")
        print(f"LOOME_ASSIST_CLIENT_ID: {LOOME_ASSIST_CLIENT_ID}")
        # only first and last 4 chars of LOOME_ASSIST_CLIENT_SECRET
        if LOOME_ASSIST_CLIENT_SECRET and len(LOOME_ASSIST_CLIENT_SECRET) > 8:
            print(f"LOOME_ASSIST_CLIENT_SECRET: {LOOME_ASSIST_CLIENT_SECRET[:4]}...{LOOME_ASSIST_CLIENT_SECRET[-4:]}")
        else:
            print(f"LOOME_ASSIST_CLIENT_SECRET: {LOOME_ASSIST_CLIENT_SECRET}")
        print(f"Loome Assist connection test failed: {str(e)}")
        return False


def get_assist_bearer_token() -> str:
    """
    Obtain a bearer token using client credentials flow.

    Returns:
        str: The bearer token.
    """
    payload = {
        'grant_type': 'client_credentials',
        'client_id': LOOME_ASSIST_CLIENT_ID,
        'client_secret': LOOME_ASSIST_CLIENT_SECRET,
        'scope': 'webApi'
    }
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    response = requests.post(LOOME_ASSIST_TOKEN_URL, data=payload, headers=headers, verify=True)
    response.raise_for_status()
    token_data = response.json()

    return token_data['access_token']

def GetAssistProjectList(auth_token: str) -> List[Dict[str, Any]]:
    """
    Get the list of projects from Loome Assist.

    Args:
        auth_token (str): The bearer token for authentication.
    Returns:
        List[Dict[str, Any]]: A list of projects with their details.
    """
    url = f"{LOOME_ASSIST_API_BASE_URL}/Projects"
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    response = requests.get(url, headers=headers, verify=True)
    response.raise_for_status()
    projects = response.json()
    print(f"Fetched {len(projects)} projects from Loome Assist.")
    return len(projects)

def DeleteRepository(auth_token: str, LoomeAssistProjectID: str, RepositoryID: str) -> bool:
    """
    Delete a repository from a Loome Assist project.

    Args:
        auth_token (str): The bearer token for authentication.
        LoomeAssistProjectID (str): The ID of the Loome Assist project.
        RepositoryID (str): The ID of the repository to delete.
    Returns:
        bool: True if deletion was successful, False otherwise.
    """
    url = f"{LOOME_ASSIST_API_BASE_URL}/Projects/{LoomeAssistProjectID}/DataRepositories/{RepositoryID}"
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    response = requests.delete(url, headers=headers, verify=True)
    if response.status_code == 204:
        print(f"Successfully deleted repository {RepositoryID} from project {LoomeAssistProjectID}.")
        return True
    else:
        print(f"Failed to delete repository {RepositoryID} from project {LoomeAssistProjectID}. Status code: {response.status_code}, Response: {response.text}")
        return False

def DeleteSolutionCollection(auth_token: str, LoomeAssistProjectID: str, SolutionCollectionID: str) -> bool:
    """
    Delete a solution collection from a Loome Assist project.

    Args:
        auth_token (str): The bearer token for authentication.
        LoomeAssistProjectID (str): The ID of the Loome Assist project.
        SolutionCollectionID (str): The ID of the solution collection to delete.
    Returns:
        bool: True if deletion was successful, False otherwise.
    """
    url = f"{LOOME_ASSIST_API_BASE_URL}/Projects/{LoomeAssistProjectID}/SolutionCollections/{SolutionCollectionID}"
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    response = requests.delete(url, headers=headers, verify=True)
    if response.status_code == 204:
        print(f"Successfully deleted solution collection {SolutionCollectionID} from project {LoomeAssistProjectID}.")
        return True
    else:
        print(f"Failed to delete solution collection {SolutionCollectionID} from project {LoomeAssistProjectID}. Status code: {response.status_code}, Response: {response.text}")
        return False
    
def DeleteResources(auth_token: str, LoomeAssistProjectID: str, DataRepoID: str, SolCollID: str) -> bool:
    """
    Delete import resources (Repo and Solution Collection) from a Loome Assist project.

    Args:
        auth_token (str): The bearer token for authentication.
        LoomeAssistProjectID (str): The ID of the Loome Assist project.
        DataRepoID (str): The ID of the data repository to delete.
        SolCollID (str): The ID of the solution collection to delete.
    Returns:
        bool: True if deletion was successful, False otherwise.
    """

    DeleteRepositoryResult = DeleteRepository(auth_token, LoomeAssistProjectID, DataRepoID)
    DeleteSolutionCollectionResult = DeleteSolutionCollection(auth_token, LoomeAssistProjectID, SolCollID)
    
    if DeleteRepositoryResult and DeleteSolutionCollectionResult:
        print(f"Successfully deleted both repository {DataRepoID} and solution collection {SolCollID} from project {LoomeAssistProjectID}.")
        return True
    
    return DeleteRepositoryResult and DeleteSolutionCollectionResult