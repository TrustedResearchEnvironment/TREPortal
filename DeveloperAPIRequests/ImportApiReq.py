# for each item in AllRequests.json submit to 
# https://test-app-api.loomesoftware.com/api/v1/apirequests PendingDeprecationWarning

# Get all https://test-app.loomesoftware.com/loome-tre-portal/developers/api-requests

import json
import requests
import os, time
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()


API_URL= os.getenv('DESTINATION_API_URL')
IDENTITY_URL= os.getenv('DESTINATION_IDENTITY_URL')
clientId = os.getenv('DESTINATION_CLIENT_ID')
clientSecret = os.getenv('DESTINATION_CLIENT_SECRET')

FASTAPI_URL = os.getenv('FASTAPI_URL')
API_KEY = os.getenv('API_KEY')

# ==================Authenticate==================
def GetAuthenticationHeaders(clientID, clientSecret, identityurl, scope='webApi'):
    payload = 'grant_type=client_credentials&client_id=' + clientID + '&client_secret=' + clientSecret 
    headers = {
    'Content-Type': 'application/x-www-form-urlencoded',

    }
    response = requests.request("POST", identityurl, headers=headers, data=payload)
    print(response.text)
    print(response.status_code)
    accesstoken = json.loads(response.text)['access_token']
    print(accesstoken) 
    if response.status_code != 200:
        print("Authentication failed EXIT")
        exit()
    # Header with authentication 
    headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + accesstoken ,
#   'Cookie': 'ARRAffinity=77151573f19a452c5ad33c6a9287cd2cdc8735aa84bd9eb527152f8880316028; ARRAffinitySameSite=77151573f19a452c5ad33c6a9287cd2cdc8735aa84bd9eb527152f8880316028',
    'User-Agent': 'ImportScript/1.0'
    }
    return headers


# get all existign api requests
# GET: https://test-app-api.loomesoftware.com/api/v1/apirequests
def GetAllApiRequests(apiurl, headers):
    response = requests.request("GET", apiurl + '/apirequests', headers=headers)
    if response.status_code != 200:
        print("Failed to get API Requests")
        exit()
    return json.loads(response.text)


# main
if __name__ == "__main__":
    headers = GetAuthenticationHeaders(clientId, clientSecret, IDENTITY_URL)
    
    existing_requests = GetAllApiRequests(API_URL, headers)
    print(f"Existing Requests Count: {len(existing_requests)}")
    # list all existing
    for req in existing_requests:
        print(f"Existing Request: {req['name']} with ID: {req['id']}")

    
    with open('AllRequests.json') as f:
        requests_data = json.load(f)

    for request in requests_data:
        # set it to 1
        # request['id'] = 1
        # remove created by and at 
        # request.pop('createdBy', None)
        # request.pop('createdAt', None)
        # # dateModified
        # request.pop('dateModified', None)
        # # dateCreated
        # request.pop('dateCreated', None)
        # # modifiedBy
        # request.pop('modifiedBy', None)

        # # on url swap REMOVED with http://test-app.loomesoftware.com
        # generate a random name 
        # request['name'] =  str(int(time.time()))
        # remove id
        # request.pop('id', None)
        # look in existing_requests and see if the name is there, if so use that ID
        for existing_request in existing_requests:
            if existing_request['name'] == request['name']:
                request['id'] = existing_request['id']
                print(f"Found existing request: {request['name']} with ID: {request['id']}")
                break
            else:
                request['id'] = 0

        if 'url' in request:
            request['url'] = request['url'].replace('https://PLACEHOLDER', FASTAPI_URL)
        # replace the headers X-API-Key
        if 'headers' in request:
            for header in request['headers']:
                if header['key'] == 'X-API-Key':
                    header['value'] = API_KEY

        # if id is 0 do a post
        if request['id'] == 0:
            response = requests.request("POST", API_URL + '/apirequests', data=json.dumps(request), headers=headers)
        else:
            response = requests.request("PUT", API_URL + '/apirequests', data=json.dumps(request), headers=headers)
        if response.status_code == 200:
            print(f"Successfully submitted request:    {request['name']}")
            # print(response.text)
            # sleep 5
            time.sleep(4)
        else:
            print(response.text)
            print(f"FAILED: to submit request:   {request['name']}, Status Code: {response.status_code}")
            print(response.status_code)
        # exit()