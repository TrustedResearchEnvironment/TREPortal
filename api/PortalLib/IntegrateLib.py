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

LOOME_INTEGRATE_TOKEN_URL = os.getenv("LOOME_INTEGRATE_TOKEN_URL")
LOOME_INTEGRATE_API_BASE_URL = os.getenv("LOOME_INTEGRATE_API_BASE_URL")
LOOME_INTEGRATE_CLIENT_ID = os.getenv("LOOME_INTEGRATE_CLIENT_ID")
LOOME_INTEGRATE_CLIENT_SECRET = os.getenv("LOOME_INTEGRATE_CLIENT_SECRET")
LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME = os.getenv("LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME")
LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME = os.getenv("LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME")
LOOME_INTEGRATE_EXPORT_TASK_NAME = os.getenv("LOOME_INTEGRATE_EXPORT_TASK_NAME")
LOOME_INTEGRATE_IMPORT_TASK_NAME = os.getenv("LOOME_INTEGRATE_IMPORT_TASK_NAME")
LOOME_INTEGRATE_PREP_REPOS_TASK_NAME = os.getenv("LOOME_INTEGRATE_PREP_REPOS_TASK_NAME")  
LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME = os.getenv("LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME")
LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME = os.getenv("LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME")
LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME = os.getenv("LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME")
LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME = os.getenv("LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME")
LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME = os.getenv("LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME")
LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME = os.getenv("LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME")
# Validate required environment variables
_required_env_vars = {
    "TOKEN_URL": LOOME_INTEGRATE_TOKEN_URL,
    "API_BASE_URL": LOOME_INTEGRATE_API_BASE_URL,
    "CLIENT_ID": LOOME_INTEGRATE_CLIENT_ID,
    "CLIENT_SECRET": LOOME_INTEGRATE_CLIENT_SECRET,
    "LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME": LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME,
    "LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME": LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME,
    "LOOME_INTEGRATE_EXPORT_TASK_NAME": LOOME_INTEGRATE_EXPORT_TASK_NAME,
    "LOOME_INTEGRATE_IMPORT_TASK_NAME": LOOME_INTEGRATE_IMPORT_TASK_NAME,
    "LOOME_INTEGRATE_PREP_REPOS_TASK_NAME": LOOME_INTEGRATE_PREP_REPOS_TASK_NAME,
    "LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME": LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME,
    "LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME": LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME,
    "LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME": LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME,
    "LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME": LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME,
    "LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME": LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME,
    "LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME": LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME
}

_missing_vars = [var_name for var_name, var_value in _required_env_vars.items() if not var_value]
if _missing_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(_missing_vars)}")


# connection test, connect get token and validate
def test_integrate_connection():
    try:
        token = get_integrate_bearer_token()
        print("Successfully obtained Loome Integrate token.")
        # get the project 
        project = GetDataExportProject(token)
        if not project:
            print(f"Data export project '{LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}' not found.")
            return False
        print(f"Successfully accessed Loome Integrate project: {project['projectName']}")
        return True
    except Exception as e:
        # print a warning and LOOME* vars
        print(f"LOOME_INTEGRATE_TOKEN_URL: {LOOME_INTEGRATE_TOKEN_URL}")
        print(f"LOOME_INTEGRATE_API_BASE_URL: {LOOME_INTEGRATE_API_BASE_URL}")
        print(f"LOOME_INTEGRATE_CLIENT_ID: {LOOME_INTEGRATE_CLIENT_ID}")
        print(f"LOOME_INTEGRATE_CLIENT_SECRET: {'set' if LOOME_INTEGRATE_CLIENT_SECRET else 'not set'}")
        print(f"LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME: {LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}")
        print(f"LOOME_INTEGRATE_EXPORT_TASK_NAME: {LOOME_INTEGRATE_EXPORT_TASK_NAME}")
        print(f"LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME: {LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME}")
        print(f"LOOME_INTEGRATE_IMPORT_TASK_NAME: {LOOME_INTEGRATE_IMPORT_TASK_NAME}")
        print(f"LOOME_INTEGRATE_PREP_REPOS_TASK_NAME: {LOOME_INTEGRATE_PREP_REPOS_TASK_NAME}")
        print(f"LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME: {LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME}")
        print(f"LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME: {LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME}")
        print(f"LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME: {LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME}")
        print(f"LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME: {LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME}")
        print(f"LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME: {LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME}")
        print(f"LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME: {LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME}")
        print(f"Loome Integrate connection test failed: {str(e)}")
        return False


def get_integrate_bearer_token() -> str:
    """
    Obtain a bearer token using client credentials flow.

    Returns:
        str: The bearer token.
    """
    payload = {
        'grant_type': 'client_credentials',
        'client_id': LOOME_INTEGRATE_CLIENT_ID,
        'client_secret': LOOME_INTEGRATE_CLIENT_SECRET,
        'scope': 'webApi'
    }
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    response = requests.post(LOOME_INTEGRATE_TOKEN_URL, data=payload, headers=headers, verify=True)
    response.raise_for_status()
    token_data = response.json()
    print(response.text)
    return token_data['access_token']


def GetAllIntegrateProjects(auth_token: str) -> List[Dict[str, Any]]:
    
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    # https://dg-api-us.perspectiveilm.com/api/v1/Projects/All
    response = requests.get(f"{LOOME_INTEGRATE_API_BASE_URL}/Projects/All", headers=headers, verify=True)
    response.raise_for_status()
    print(response.text)
    return response.json()

def GetIntegrateProjectByName(auth_token: str, project_name: str) -> Optional[Dict[str, Any]]:
    
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    # call method above and filter on name 
    projects = GetAllIntegrateProjects(auth_token)
    for project in projects:
        if project.get("projectName") == project_name:
            return project
    return None

def GetDataExportProject(auth_token: str) -> Optional[Dict[str, Any]]:
    return GetIntegrateProjectByName(auth_token, LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME)

def GetDataImportProject(auth_token: str) -> Optional[Dict[str, Any]]:
    return GetIntegrateProjectByName(auth_token, LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME)

def GetDataApproveImportProject(auth_token: str) -> Optional[Dict[str, Any]]:
    return GetIntegrateProjectByName(auth_token, LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME)

def GetDataApproveExportProject(auth_token: str) -> Optional[Dict[str, Any]]:
    return GetIntegrateProjectByName(auth_token, LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME)

def GetSubmitDataImportProject(auth_token: str) -> Optional[Dict[str, Any]]:
    return GetIntegrateProjectByName(auth_token, LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME)

def GetAllJobsForProject(auth_token: str, project_id: str) -> List[Dict[str, Any]]:
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }

    
    # https://dg-api-us.perspectiveilm.com/api/v1/Projects/3/Jobs/All
    response = requests.get(f"{LOOME_INTEGRATE_API_BASE_URL}/Projects/{project_id}/Jobs/All", headers=headers, verify=True)
    response.raise_for_status()
    print(response.text)
    return response.json()

def Integrate_Get_Data_Exports(auth_token: str) -> List[Dict[str, Any]]:
    # get the project
    data_export_project = GetDataExportProject(auth_token)
    if not data_export_project:
        print(f"Data export project '{LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}' not found.")
        return []

    # get all jobs for the project
    jobs = GetAllJobsForProject(auth_token, data_export_project["projectId"])
    print(f"Found {len(jobs)} jobs in project '{LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}'.")
    for job in jobs:
        print(f"Job: {job['jobName']} (ID: {job['jobId']})")


def IntegrateNewJob(auth_token: str, project_id: str, job_name: str, upn: str):
    # Create a new job in the specified project
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'    
    }
    #  post https://dg-api-us.perspectiveilm.com/api/v1/Jobs
    payload = {"cancelJobFlag":0,
    "continueOnFailure":"N","emailNotificationRecipients":""
    ,"emailNotificationRuleId":0,"jobName":job_name,
    "logBatchSize":5,"logging":0,
    "predecessorJobIds":[],"projectId":project_id,"retryCount":0}
        
    response = requests.post(f"{LOOME_INTEGRATE_API_BASE_URL}/Jobs", headers=headers, json=payload, verify=True)
    response.raise_for_status()
    return response.json()

def GetAllTasksAvailableForJobByID(auth_token: str, job_id: str) -> List[Dict[str, Any]]:
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    # hhttps://dg-api-us.perspectiveilm.com/api/v1/Jobs/53/Tasks/All
    response = requests.get(f"{LOOME_INTEGRATE_API_BASE_URL}/Jobs/{job_id}/Tasks/All", headers=headers, verify=True)
    response.raise_for_status()
    print(response.text)
    return response.json()

def AddTaskToJob(auth_token: str, job_id: str, task_id: str, upn: str, runSequence: int = 1):
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    # POST https://dg-api-us.perspectiveilm.com/api/v1/jobs/41/JobSequence
    payload = {
        "active":True,"jobId":job_id,
               "parallelSequence":0,
"runSequence":runSequence,
"taskId":task_id,"runInParallel":False}
    
    response = requests.post(f"{LOOME_INTEGRATE_API_BASE_URL}/jobs/{job_id}/JobSequence", headers=headers, json=payload, verify=True)
    response.raise_for_status()
    print("ADD TASK RESPONSE:", response.status_code, response.text)
    return response.json()

def RunJobOnce(auth_token: str, job_id: str):
    # https://dg-api-us.perspectiveilm.com/api/v1/Jobs/41/JobExecutions/RunOnce
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    response = requests.get(f"{LOOME_INTEGRATE_API_BASE_URL}/Jobs/{job_id}/JobExecutions/RunOnce", headers=headers, verify=True)
    response.raise_for_status()
    print(response.text)
    return response.json()


def GetParameterDictionary(parameterNames: str, parameterDefaults: str) -> Dict[str, str]:
    names = parameterNames.split('|')
    defaults = parameterDefaults.split('|')
    if len(names) != len(defaults):
        raise ValueError("Parameter names and defaults count do not match.")
    return dict(zip(names, defaults))

def MakeParameterString(parameterDict: Dict[str, str]) -> (str, str):
    names = '|'.join(parameterDict.keys())
    defaults = '|'.join(str(v) for v in parameterDict.values())
    return names, defaults

def PatchParametersForTask(auth_token: str, job_id: str, task_id: str, jobSequenceId: str, parameterNames: str, parameterDefaults: str):
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'TrustAPI/1.0'
    }
    # PATCH https://dg-api-us.perspectiveilm.com/api/v1/Jobs/x/Tasks/y
    # https://dg-api-us.perspectiveilm.com/api/v1/jobs/89/JobSequence/162
    payload = [
        # {
        #     # "op": "replace",
        #     "path": "/ParameterNames",
        #     "value": parameterNames
        # },
        {
            # "op": "replace",
            "path": "/ParameterValues",
            "value": parameterDefaults
        }
    ]
    # https://dg-api-us.perspectiveilm.com/api/v1/Jobs/83/Tasks/116
    # https://dg-api-us.perspectiveilm.com/api/v1/Jobs/79/Tasks/116
    response = requests.patch(f"{LOOME_INTEGRATE_API_BASE_URL}/Jobs/{job_id}/JobSequence/{jobSequenceId}", headers=headers, json=payload, verify=True)
    
    print("RESPONSE:", response.status_code, response.text)
    if response.status_code == 204:
        print("PATCH successful")
        response = response.status_code
    else:
        print("PATCH failed")
        print("RESPONSE:", response.status_code, response.text)
        response = response.text
    
    return response

#ExportRequestName: str,
def CreateDataExport(auth_token: str, ExportRequestName: str, LoomeAssistProjectID: str, LoomeAssistTenantsID: str, LoomeAssistName: str, upn: str):
    data_export_project = GetDataExportProject(auth_token)
    if not data_export_project:
        print(f"Data export project '{LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}' not found.")
        return

    # Create a new data export job
    _utc_timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S%f")
    # Result: "2025-10-15 14:30:25 UTC"
    # job_name but be SHORT
    job_name = f"[{LoomeAssistProjectID}] {upn} {_utc_timestamp}"
    truncate_job_name = job_name[:50]  # Truncate to 100 characters if necessary
    print(f"Creating new data export job '{truncate_job_name}' in project '{data_export_project['projectName']}'...")
    newJob = IntegrateNewJob(auth_token, data_export_project["projectId"], truncate_job_name, upn)

    # --- MIGUEL DEBUG ---
    print("--- DEBUG: RAW CONTENT OF 'newJob' ---")
    print(json.dumps(newJob, indent=2))
    print("--------------------------------------")

    # get all tasks 
    allTasks = GetAllTasksAvailableForJobByID(auth_token, newJob["jobId"])
   
    # get the task with name "Add Task to Job"
    exportTask = next((task for task in allTasks if task.get("taskName") == LOOME_INTEGRATE_EXPORT_TASK_NAME), None)
    if not exportTask:
        print("Export task not found in the job:", LOOME_INTEGRATE_EXPORT_TASK_NAME)
        print(newJob)
        # list all names
        for task in allTasks:
            print(f"Task: {task.get('taskName')} (ID: {task.get('taskId')})")
        return

    print(exportTask)
   
    # # update the task with new parameters
    # exportTask["parameterNames"] = names
    # exportTask["parameterDefaults"] = defaults
    # print("Updated export task with new parameters:", exportTask)


  
    # Add task to job
    newSeq = AddTaskToJob(auth_token, newJob["jobId"], exportTask["taskId"], upn)

     # example parameters
    # 'parameterNames': 'assistApiHostname|idsHostname|clientId|clientSecret|assistProjectName|emailId', 
    # 'parameterDefaults': 'assist-api-us.loomesoftware.com|identity-us.perspectiveilm.com|dce3b16f-dac3-4b15-b691-2f8e42c8b6a4|ZGNlM2IxNmYtZGFjMy00YjE1LWI2OTEtMmY4ZTQyYzhiNmE0|TEST|Soumya.Hari@bizdata.com.au', 
    parameterDictionary = GetParameterDictionary(exportTask['parameterNames'], exportTask['parameterDefaults'])
    print(parameterDictionary)
    parameterDictionary["IntegrateJobID"] = newJob["jobId"]
    parameterDictionary["ExportRequestName"] = ExportRequestName
    parameterDictionary["LoomeAssistProjectID"] = LoomeAssistProjectID
    parameterDictionary["LoomeAssistTenantsID"] = LoomeAssistTenantsID
    parameterDictionary["LoomeAssistProjectName"] = LoomeAssistName
    parameterDictionary["UserUPN"] = upn
    print("Updated parameters for export task:", parameterDictionary)
    # set the new parameters
    names, defaults = MakeParameterString(parameterDictionary)
    PatchParametersForTask(auth_token, newJob["jobId"], exportTask["taskId"], newSeq["jobSequenceId"], names, defaults)

    # Run the job once
    runJob = RunJobOnce(auth_token, newJob["jobId"])
    print(f"Data export job '{truncate_job_name}' created and started successfully.")
    return newJob

def CreateDataImport(auth_token: str, ImportRequestName: str, LoomeAssistProjectID: str, LoomeAssistTenantsID: str, LoomeAssistName: str, upn: str):
    data_import_project = GetDataImportProject(auth_token)
    if not data_import_project:
        print(f"Data import project '{LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME}' not found.")
        return

    # Create a new data import job
    _utc_timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S%f")
    # Result: "2025-10-15 14:30:25 UTC"
    # job_name but be SHORT
    job_name = f"[{LoomeAssistProjectID}] {upn} {_utc_timestamp}"
    truncate_job_name = job_name[:50]  # Truncate to 100 characters if necessary
    print(f"Creating new data import job '{truncate_job_name}' in project '{data_import_project['projectName']}'...")
    newJob = IntegrateNewJob(auth_token, data_import_project["projectId"], truncate_job_name, upn)

    # --- MIGUEL DEBUG ---
    print("--- DEBUG: RAW CONTENT OF 'newJob' ---")
    print(json.dumps(newJob, indent=2))
    print("--------------------------------------")

    # get all tasks 
    allTasks = GetAllTasksAvailableForJobByID(auth_token, newJob["jobId"])
   
    # get the task with name "Add Task to Job"
    importTask = next((task for task in allTasks if task.get("taskName") == LOOME_INTEGRATE_IMPORT_TASK_NAME), None)
    if not importTask:
        print("Import task not found in the job:", LOOME_INTEGRATE_IMPORT_TASK_NAME)
        print(newJob)
        # list all names
        for task in allTasks:
            print(f"Task: {task.get('taskName')} (ID: {task.get('taskId')})")
        return

    print(importTask)

    # Add the Prepare Repositories for Data Ingestion Task
    # It creates the input and output data repository in the Target Assist Project
    prepReposTask = next((task for task in allTasks if task.get("taskName") == LOOME_INTEGRATE_PREP_REPOS_TASK_NAME), None)
    if not prepReposTask:
        print("Prepare Repositories for Data Ingestion task not found in the job.")
        print(newJob)
        # list all names
        for task in allTasks:
            print(f"Task: {task.get('taskName')} (ID: {task.get('taskId')})")
        return
    print(prepReposTask)
  
    # Add task to job
    newSeq = AddTaskToJob(auth_token, newJob["jobId"], importTask["taskId"], upn, runSequence=1)

    parameterDictionary = GetParameterDictionary(importTask['parameterNames'], importTask['parameterDefaults'])
    print(parameterDictionary)
    parameterDictionary["IntegrateJobID"] = newJob["jobId"]
    parameterDictionary["ImportRequestName"] = ImportRequestName
    parameterDictionary["LoomeAssistProjectID"] = LoomeAssistProjectID
    parameterDictionary["LoomeAssistTenantsID"] = LoomeAssistTenantsID
    parameterDictionary["LoomeAssistProjectName"] = LoomeAssistName
    parameterDictionary["UserUPN"] = upn
    print("Updated parameters for import task:", parameterDictionary)
    # set the new parameters
    names, defaults = MakeParameterString(parameterDictionary)
    PatchParametersForTask(auth_token, newJob["jobId"], importTask["taskId"], newSeq["jobSequenceId"], names, defaults)

    AddTaskToJob(auth_token, newJob["jobId"], prepReposTask["taskId"], upn, runSequence=2)
    
    # Run the job once
    runJob = RunJobOnce(auth_token, newJob["jobId"])
    print(f"Data import job '{truncate_job_name}' created and started successfully.")
    return newJob

def CreateDataApproveImport(auth_token: str, ImportRequestID: int, upn: str):
    data_approve_import_project = GetDataApproveImportProject(auth_token)
    if not data_approve_import_project:
        print(f"Data approve import project '{LOOME_INTEGRATE_APPROVE_IMPORT_PROJECT_NAME}' not found.")
        return

    # Create a new data import job
    _utc_timestamp = int( time.time() ) # datetime.datetime.now().strftime("%H%M%S")
    # Result: "2025-10-15 14:30:25 UTC"
    # job_name but be SHORT
    job_name = f"[{ImportRequestID}] {upn} {_utc_timestamp}"
    truncate_job_name = job_name[:50]  # Truncate to 100 characters if necessary
    print(f"Creating new data import job '{truncate_job_name}' in project '{data_approve_import_project['projectName']}'...")
    newJob = IntegrateNewJob(auth_token, data_approve_import_project["projectId"], truncate_job_name, upn)

    # --- MIGUEL DEBUG ---
    print("--- DEBUG: RAW CONTENT OF 'newJob' ---")
    print(json.dumps(newJob, indent=2))
    print("--------------------------------------")

    # get all tasks 
    allTasks = GetAllTasksAvailableForJobByID(auth_token, newJob["jobId"])
   
    # get the task with name "Add Task to Job"
    approveImportTask = next((task for task in allTasks if task.get("taskName") == LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME), None)
    if not approveImportTask:
        print("Approve import task not found in the job:", LOOME_INTEGRATE_APPROVE_IMPORT_TASK_NAME)
        print(newJob)
        # list all names
        for task in allTasks:
            print(f"Task: {task.get('taskName')} (ID: {task.get('taskId')})")
        return

    print(approveImportTask)
  
    # Add task to job
    newSeq = AddTaskToJob(auth_token, newJob["jobId"], approveImportTask["taskId"], upn, runSequence=1)

    parameterDictionary = GetParameterDictionary(approveImportTask['parameterNames'], approveImportTask['parameterDefaults'])
    print(parameterDictionary)
    parameterDictionary["UserUPN"] = upn
    parameterDictionary["ImportRequestID"] = ImportRequestID
    print("Updated parameters for import task:", parameterDictionary)
    # set the new parameters
    names, defaults = MakeParameterString(parameterDictionary)
    PatchParametersForTask(auth_token, newJob["jobId"], approveImportTask["taskId"], newSeq["jobSequenceId"], names, defaults)
   
    # Run the job once
    runJob = RunJobOnce(auth_token, newJob["jobId"])
    print(f"Data import job '{truncate_job_name}' created and started successfully.")
    return newJob

def CreateDataApproveExport(auth_token: str, ExportRequestID: int, ExportProjectID: int, upn: str, Researcher: str):
    data_approve_export_project = GetDataApproveExportProject(auth_token)
    if not data_approve_export_project:
        print(f"Data approve export project '{LOOME_INTEGRATE_APPROVE_EXPORT_PROJECT_NAME}' not found.")
        return

    # Create a new data export job
    _utc_timestamp = int( time.time() ) # datetime.datetime.now().strftime("%H%M%S")
    # Result: "2025-10-15 14:30:25 UTC"
    # job_name but be SHORT
    job_name = f"[{ExportRequestID}] {upn} {_utc_timestamp}"
    truncate_job_name = job_name[:50]  # Truncate to 100 characters if necessary
    print(f"Creating new data export job '{truncate_job_name}' in project '{data_approve_export_project['projectName']}'...")
    newJob = IntegrateNewJob(auth_token, data_approve_export_project["projectId"], truncate_job_name, upn)

    # --- MIGUEL DEBUG ---
    print("--- DEBUG: RAW CONTENT OF 'newJob' ---")
    print(json.dumps(newJob, indent=2))
    print("--------------------------------------")

    # get all tasks 
    allTasks = GetAllTasksAvailableForJobByID(auth_token, newJob["jobId"])
   
    # get the task with name "Add Task to Job"
    approveExportTask = next((task for task in allTasks if task.get("taskName") == LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME), None)
    if not approveExportTask:
        print("Approve export task not found in the job:", LOOME_INTEGRATE_APPROVE_EXPORT_TASK_NAME)
        print(newJob)
        # list all names
        for task in allTasks:
            print(f"Task: {task.get('taskName')} (ID: {task.get('taskId')})")
        return

    print(approveExportTask)
  
    # Add task to job
    newSeq = AddTaskToJob(auth_token, newJob["jobId"], approveExportTask["taskId"], upn, runSequence=1)

    parameterDictionary = GetParameterDictionary(approveExportTask['parameterNames'], approveExportTask['parameterDefaults'])
    print(parameterDictionary)
    parameterDictionary["UserUPN"] = upn
    parameterDictionary["ExportProjectID"] = ExportProjectID
    parameterDictionary["Researcher"] = Researcher
    parameterDictionary["ExportRequestID"] = ExportRequestID
    print("Updated parameters for export task:", parameterDictionary)
    # set the new parameters
    names, defaults = MakeParameterString(parameterDictionary)
    PatchParametersForTask(auth_token, newJob["jobId"], approveExportTask["taskId"], newSeq["jobSequenceId"], names, defaults)
   
    # Run the job once
    runJob = RunJobOnce(auth_token, newJob["jobId"])
    print(f"Data export job '{truncate_job_name}' created and started successfully.")
    return newJob

def GetAllExportJobs(auth_token: str,  upn: str):
    data_export_project = GetDataExportProject(auth_token)
    if not data_export_project:
        print(f"Data export project '{LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}' not found.")
        return
    # get all jobs for the project
    jobs = GetAllJobsForProject(auth_token, data_export_project["projectId"])
    
    # filter where jobname contains upn 
    user_jobs = [job for job in jobs if upn in job.get("jobName", "")]
    print(f"Found {len(user_jobs)} jobs for user '{upn}' in project '{LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME}'.")
    for job in user_jobs:
        print(f"Job: {job['jobName']} (ID: {job['jobId']})")
    return user_jobs    
     
def GetAllImportJobs(auth_token: str,  upn: str):
    data_import_project = GetDataImportProject(auth_token)
    if not data_import_project:
        print(f"Data import project '{LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME}' not found.")
        return
    # get all jobs for the project
    jobs = GetAllJobsForProject(auth_token, data_import_project["projectId"])
    
    # filter where jobname contains upn 
    user_jobs = [job for job in jobs if upn in job.get("jobName", "")]
    print(f"Found {len(user_jobs)} jobs for user '{upn}' in project '{LOOME_INTEGRATE_DATA_IMPORT_PROJECT_NAME}'.")
    for job in user_jobs:
        print(f"Job: {job['jobName']} (ID: {job['jobId']})")
    return user_jobs    
     
def DeleteIntegrateJob(auth_token: str, job_id: str):
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        'User-Agent': 'TrustAPI/1.0'
    }
    response = requests.delete(
        f"{LOOME_INTEGRATE_API_BASE_URL}/Jobs/{job_id}",
        headers=headers,
        verify=True,
    )
    if response.status_code == 204:
        print(f"Job '{job_id}' deleted successfully.")
        return

    raise RuntimeError(
        f"Failed to delete job '{job_id}'. Status code: "
        f"{response.status_code}, Response: {response.text}"
    )
    
def RemoveReadersFromImportProject(auth_token: str, import_project_id: str, loome_assist_tenants_id: str, loome_assist_name: str, upn: str):
    data_submit_import_project = GetSubmitDataImportProject(auth_token)
    if not data_submit_import_project:
        print(f"Data submit import project '{LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_PROJECT_NAME}' not found.")
        return

    # Create a new submit data import job
    _utc_timestamp = int( time.time() ) # datetime.datetime.now().strftime("%H%M%S")
    # Result: "2025-10-15 14:30:25 UTC"
    # job_name but be SHORT
    job_name = f"[{import_project_id}] {upn} {_utc_timestamp}"
    truncate_job_name = job_name[:50]  # Truncate to 50 characters if necessary
    print(f"Creating new submit data import job '{truncate_job_name}' in project '{data_submit_import_project['projectName']}'...")
    newJob = IntegrateNewJob(auth_token, data_submit_import_project["projectId"], truncate_job_name, upn)

    # get all tasks GetAllTasksAvailableForJobByID
    allTasks = GetAllTasksAvailableForJobByID(auth_token, newJob["jobId"])
   
    # get the task with name "Add Task to Job"
    approveImportTask = next((task for task in allTasks if task.get("taskName") == LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME), None)
    if not approveImportTask:
        print("Approve import task not found in the job:", LOOME_INTEGRATE_SUBMIT_DATA_IMPORT_TASK_NAME)
        print(newJob)
        # list all names
        for task in allTasks:
            print(f"Task: {task.get('taskName')} (ID: {task.get('taskId')})")
        return

    print(approveImportTask)
  
    # Add task to job
    newSeq = AddTaskToJob(auth_token, newJob["jobId"], approveImportTask["taskId"], upn, runSequence=1)

    parameterDictionary = GetParameterDictionary(approveImportTask['parameterNames'], approveImportTask['parameterDefaults'])
    print(parameterDictionary)
    parameterDictionary["LoomeAssistProjectID"] = import_project_id
    parameterDictionary["LoomeAssistTenantsID"] = loome_assist_tenants_id
    parameterDictionary["LoomeAssistName"] = loome_assist_name
    print("Updated parameters for submit import task:", parameterDictionary)
    # set the new parameters
    names, defaults = MakeParameterString(parameterDictionary)
    PatchParametersForTask(auth_token, newJob["jobId"], approveImportTask["taskId"], newSeq["jobSequenceId"], names, defaults)
   
    # Run the job once
    runJob = RunJobOnce(auth_token, newJob["jobId"])
    print(f"Submit data import job '{truncate_job_name}' created and started successfully.")
    return newJob

