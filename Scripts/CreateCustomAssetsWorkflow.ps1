<#
.SYNOPSIS
    Creates a custom App, defines attributes and entity types, generates and stages 1000 resolved assets, and polls for execution status.
#>

# =================================================================================================
# SECTION 1: SCRIPT CONFIGURATION & GLOBAL VARIABLES
# =================================================================================================

# --- API Configuration ---
$tokenUrl = "https://localhost:58291/connect/token"
$apiBaseUrl = "https://localhost:7191/api/v1"
$consumerApiUrl = "$apiBaseUrl/consumer"
$clientId = "03b713ac-78d5-4cd4-8a00-1da3d201cce7"
$clientSecret = "MDNiNzEzYWMtNzhkNS00Y2Q0LThhMDAtMWRhM2QyMDFjY2U3"

# --- Script Configuration ---
$customAppName = "External Research Source"
$pollingIntervalSeconds = 1

# --- Sample Data for Asset Generation ---
$principalInvestigators = "Dr. Eleanor Vance", "Dr. Alistair Finch", "Dr. Sofia Rossi", "Dr. Ben Carter", "Dr. Lena Petrova"
$departments = "Faculty of Medicine and Health Sciences", "Climate Change Research Institute", "Centre for Photonic Technologies", "Institute for Energy and Bioproducts", "Department of Computer Science"
$researchKeywords = "genomics", "climate modeling", "quantum computing", "biofuels", "machine learning", "oncology", "particle physics", "sociology", "linguistics", "AI ethics"

$ProgressPreference = 'SilentlyContinue'

# =================================================================================================
# SECTION 2: FUNCTION DEFINITIONS
# =================================================================================================

function Invoke-SafeRestMethod {
<#
.SYNOPSIS
    A robust wrapper for Invoke-RestMethod that provides centralized, detailed error handling.
#>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Uri,
        [Parameter(Mandatory=$false)][string]$Method = "GET",
        [Parameter(Mandatory=$false)][hashtable]$Headers,
        [Parameter(Mandatory=$false)][object]$Body,
        [Parameter(Mandatory=$false)][string]$ContentType,
        [switch]$NoProxy,
        [switch]$UseBasicParsing
    )
    
    $invokeParams = $PSBoundParameters
    

    # Use SkipHttpErrorCheck to handle error responses without throwing
    $response = Invoke-RestMethod @invokeParams -StatusCodeVariable statusCode
    
    # Special case: Re-throw 429 errors for the polling function to handle.
    if ($statusCode -eq 429) {
        throw [System.Net.Http.HttpRequestException]::new("Rate limit exceeded (429)")
    }
    
    # Handle BadRequest (400) and other error status codes
    if ($statusCode -ge 400) {
        Write-Error "API request to '$Uri' failed with status code $statusCode."
        
        # The response body is already parsed by Invoke-RestMethod
        if ($response) {
            if ($response -is [array]) {
                # Array of error strings (e.g., IEnumerable<string> from BadRequest)
                Write-Host "The API returned the following errors:" -ForegroundColor Red
                $response | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
            }
            elseif ($response -is [string]) {
                # Single string error (e.g., BadRequest<string>)
                Write-Host "API Error: $response" -ForegroundColor Red
            }
            else {
                # Fallback: display the entire parsed object
                Write-Host "API returned error: $($response | ConvertTo-Json -Compress)" -ForegroundColor Red
            }
        }
        
        throw "Script aborted due to API errors."
    }
    
    return $response
}
function Get-ApiToken {
    param ([string]$Url, [string]$ClientId, [string]$ClientSecret, [string]$Scope)
    Write-Host "`n=====================================================================" -ForegroundColor Yellow
    Write-Host "STEP 1: AUTHENTICATING WITH API" -ForegroundColor Yellow
    Write-Host "=====================================================================" -ForegroundColor Yellow
    
    $tokenBody = @{ client_id = $ClientId; client_secret = $ClientSecret; grant_type = "client_credentials"; scope = $Scope }
    $tokenResponse = Invoke-SafeRestMethod -Uri $Url -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded" -UseBasicParsing -NoProxy
    Write-Host "Authentication successful. Token obtained." -ForegroundColor Green
    return $tokenResponse.access_token
}
function Ensure-CustomApp {
    param ([string]$ApiUrl, [hashtable]$Headers, [string]$AppName)
    Write-Host "`n=====================================================================" -ForegroundColor Yellow
    Write-Host "STEP 2: ENSURING CUSTOM APP EXISTS" -ForegroundColor Yellow
    Write-Host "=====================================================================" -ForegroundColor Yellow
    
    Write-Host "Checking for custom app named '$AppName'..."
    $allApps = Invoke-SafeRestMethod -Uri "$ApiUrl/customApps" -Method Get -Headers $Headers -UseBasicParsing -NoProxy
    $existingApp = $allApps | Where-Object { $_.name -eq $AppName }

    if ($existingApp) {
        $customAppId = $existingApp.id
        Write-Host "Found existing app. ID: $customAppId" -ForegroundColor Cyan
        return $customAppId
    }
    else {
        Write-Host "App not found. Creating new app..."
        $appBody = @{ name = $AppName; description = "Stores assets from external research institutes." } | ConvertTo-Json -Depth 5
        $newApp = Invoke-SafeRestMethod -Uri "$ApiUrl/customApps" -Method Post -Headers $Headers -Body $appBody -UseBasicParsing -NoProxy
        $customAppId = $newApp.id
        Write-Host "Successfully created new app. ID: $customAppId" -ForegroundColor Green
        return $customAppId
    }
}
function Define-Metadata {
    param ([string]$ApiBaseUrl, [string]$ConsumerApiUrl, [hashtable]$Headers, [string]$CustomAppId, [string]$CustomAppName)
    Write-Host "`n=====================================================================" -ForegroundColor Yellow
    Write-Host "STEP 3: DEFINING ATTRIBUTES AND ENTITY TYPES (CREATE/UPDATE)" -ForegroundColor Yellow
    Write-Host "=====================================================================" -ForegroundColor Yellow

    Write-Host "Fetching all existing attributes and entity types..."
    $existingAttributes = Invoke-SafeRestMethod -Uri "$ApiBaseUrl/attributetype/all" -Method Get -Headers $Headers -UseBasicParsing -NoProxy
    $existingEntityTypes = Invoke-SafeRestMethod -Uri "$ApiBaseUrl/entitytype/nonactivity" -Method Get -Headers $Headers -UseBasicParsing -NoProxy
    
    $desiredAttributes = @(
        @{ name = "Research Domain"; '$type' = "List"; isRequired = $true; options = @(@{ name = "Life Sciences"; children = @(@{ name = "Genomics" }, @{ name = "Oncology" }) }, @{ name = "Physical Sciences"; children = @(@{ name = "Quantum Physics" }, @{ name = "Astrophysics" }) }, @{ name = "Computer Science" }) },
        @{ name = "Compliance Level"; '$type' = "List"; isRequired = $true; options = @(@{ name = "Level 1 - Public Data" }, @{ name = "Level 2 - Internal Use Only" }, @{ name = "Level 3 - Contains PII" }, @{ name = "Level 4 - Highly Confidential" }) },
        @{ name = "Principal Investigator"; '$type' = "Text"; isRequired = $true; options = @{} },
        @{ name = "Grant Amount"; '$type' = "Number"; isRequired = $false; options = @{} }
    )

    Write-Host "Comparing desired attributes with existing ones..."
    foreach ($attribute in $desiredAttributes) {
        $existingAttr = $existingAttributes | Where-Object { $_.name -eq $attribute.name }
        if ($existingAttr) {
            $attribute['id'] = $existingAttr.id
        }
    }
    
    Write-Host "Processing attributes..."
    $attributesBody = $desiredAttributes | ConvertTo-Json -Depth 10
    $finalAttributes = Invoke-SafeRestMethod -Uri "$ConsumerApiUrl/customapps/attributes" -Method Put -Headers $Headers -Body $attributesBody -UseBasicParsing -NoProxy
    Write-Host "Attributes processed successfully." -ForegroundColor Green

    $desiredEntityTypes = @(
        @{ 
            type = "Research Report - Updated"; 
            category = "Publication"; 
            subCategory = "Internal Report"; 
            attributes = $desiredAttributes.name; 
            actions = @(@{ name = "View Publication"; description = "Open the report in the research portal." }) },
        @{ 
            type = "Research Dataset"; 
            category = "Data"; 
            subCategory = "Raw Data"; attributes = $desiredAttributes.name; #+ "Business Area"; 
            actions = @(@{ name = "Access Dataset"; description = "Navigate to the dataset's storage location." }, @{ name = "View Metadata"; description = "View detailed metadata for the dataset." }); 
            embeddingUrl = "https://your-internal-dashboard.com/embed/dataset"; 
            embeddingParams = @(@{
                id = "datasetId";
                name = "Dataset Id"; 
                description = "The unique identifier for the dataset."; 
                type = "Text"
            }) 
        },
        @{ 
            type = "Grant Proposal"; 
            category = "Funding"; 
            subCategory = "Proposal"; 
            attributes = $desiredAttributes.name; 
            actions = @(@{ name = "Review Proposal"; description = "Open the grant proposal document." }) 
        }
    )

    Write-Host "Comparing desired entity types with existing ones..."
    foreach ($entityType in $desiredEntityTypes) {
        $existingType = $existingEntityTypes | Where-Object { $_.source -eq $CustomAppName -and $_.type -eq $entityType.type }
        if ($existingType) {
            $entityType['id'] = $existingType.id
        }
    }

    Write-Host "Processing entity types..."
    $entityTypesBody = $desiredEntityTypes | ConvertTo-Json -Depth 10
    Invoke-SafeRestMethod -Uri "$ConsumerApiUrl/customapps/$CustomAppId/entity-types" -Method Put -Headers $Headers -Body $entityTypesBody -UseBasicParsing -NoProxy
    Write-Host "Entity Types processed successfully." -ForegroundColor Green

    Write-Host "Retrieving final entity type mapping for data generation..."
    # Re-fetch all entity types to get IDs for any that were just created
    $finalEntityTypes = Invoke-SafeRestMethod -Uri "$ApiBaseUrl/entitytype/nonactivity" -Method Get -Headers $Headers -UseBasicParsing -NoProxy
    
    # Filter for the types that belong to our custom app
    $myAppEntityTypes = $finalEntityTypes | Where-Object { $_.source -eq $CustomAppName }

    # Build the lookup map
    $entityTypeMap = @{}
     foreach ($entityType in $myAppEntityTypes) {
        $entityTypeMap[$entityType.type] = $entityType.id
    }
    
    Write-Host "Successfully built entity type map."
    return @{
        EntityTypeMap = $entityTypeMap;
        Attributes    = $finalAttributes;
    }
}
function Stage-Assets {
    param (
        [string]$ConsumerApiUrl,
        [hashtable]$Headers,
        [string]$CustomAppId,
        [System.Object[]]$EntityTypeMap,
        [System.Object[]]$AllAttributes 
    )
    Write-Host "`n=====================================================================" -ForegroundColor Yellow
    Write-Host "STEP 4: GENERATING AND STAGING ASSETS" -ForegroundColor Yellow
    Write-Host "=====================================================================" -ForegroundColor Yellow
    try {
        Write-Host "Building resolution maps from provided metadata..."
        $attributeMap = @{}
        $AllAttributes | ForEach-Object { $attributeMap[$_.name] = $_ }

        $listOptionMaps = @{}
        $AllAttributes | Where-Object { $_.'$type' -eq 'List' } | ForEach-Object {
            $listAttribute = $_
            $options = $listAttribute.options # Use the 'options' property from the response
            $flatOptions = @{}
            
            function Flatten-Options($items, [hashtable]$ht) {
                foreach ($item in $items) {
                    if ($item.name -and $item.id) { $ht[$item.name] = $item.id }
                    if ($item.children) { Flatten-Options $item.children $ht }
                }
            }
            Flatten-Options $options $flatOptions
            $listOptionMaps[$listAttribute.name] = $flatOptions
        }

        Write-Host "Generating 1000 realistic and resolved asset records..."
        $allAssets = 1..5000 | ForEach-Object {
            $assetNumber = $_
            $randomEntityType = $EntityTypeMap[0].GetEnumerator() | Get-Random
            $entityTypeId = $randomEntityType.Value
            $entityTypeName = $randomEntityType.Key

            $assetName = "$entityTypeName $($assetNumber.ToString('0000')) - $(($researchKeywords | Get-Random) -join ' ')"
            $asset = @{ 
                name = $assetName; 
                sourceItemId = "RSRCH-SRC-$($assetNumber.ToString('0000'))-$(New-Guid)"; 
                group = $departments | Get-Random; entityTypeId = $entityTypeId; 
                tags = @(($researchKeywords | Get-Random -Count (Get-Random -Minimum 2 -Maximum 5))) 
            }
            
            switch ($entityTypeName) {
                "Research Report" { $asset.actions = @( @{ name = "View Publication"; value = "https://portal.research.institute/reports/$($asset.sourceItemId)" }) }
                "Research Dataset" { $asset.actions = @( @{ name = "Access Dataset"; value = "https://datasets.research.institute/data/$($asset.sourceItemId)" }) }
                "Grant Proposal" { $asset.actions = @( @{ name = "Review Proposal"; value = "https://grants.research.institute/proposals/$($asset.sourceItemId)" }) }
            }
            
            # --- This part now uses the fast in-memory maps ---
            $asset.attributes = @(
                @{ 
                    name = "Research Domain"
                    Values = @(($listOptionMaps["Research Domain"].Keys | Get-Random)) 
                },
                @{ 
                    name = "Compliance Level"
                    Values = @(($listOptionMaps["Compliance Level"].Keys | Get-Random)) 
                },
                @{ 
                    name = "Principal Investigator"
                    Values = ($principalInvestigators | Get-Random) 
                },
                @{ 
                    name = "Grant Amount"
                    Values = (Get-Random -Minimum 10000 -Maximum 500000) 
                }
            )
            
            $asset
        }

        Write-Host "Asset generation complete. Staging 1000 assets now..."
        $stagingBody = $allAssets | ConvertTo-Json -Depth 10
        $stagingResponse = Invoke-SafeRestMethod -Uri "$ConsumerApiUrl/customapps/$CustomAppId/stage" -Method Post -Headers $Headers -Body $stagingBody -UseBasicParsing -NoProxy
        
        $executionId = $stagingResponse.executionId
        Write-Host "Assets staged successfully. Execution ID: $executionId" -ForegroundColor Green
        return $executionId
    }
    catch {
        Write-Error "Failed to generate or stage assets."
        throw $_
    }
}
function Poll-ExecutionStatus {
    param ([string]$ConsumerApiUrl, [hashtable]$Headers, [string]$ExecutionId, [int]$PollingInterval)
    Write-Host "`n=====================================================================" -ForegroundColor Yellow
    Write-Host "STEP 5: POLLING FOR EXECUTION STATUS (ID: $ExecutionId)" -ForegroundColor Yellow
    Write-Host "=====================================================================" -ForegroundColor Yellow
    $finalStatus = $null; $pollingAttempts = 0
    while ($true) {
        $pollingAttempts++
        try {
            # This call now uses the wrapper, which will re-throw the 429 error
            $statusResponse = Invoke-SafeRestMethod -Uri "$ConsumerApiUrl/customApps/execution/$ExecutionId/status" -Method Get -Headers $Headers -UseBasicParsing -NoProxy
            $status = $statusResponse.status
            Write-Host "Attempt $pollingAttempts : Current status is '$status'..."
            if ($status -ne "PENDING" -and $status -ne "WORKING") { $finalStatus = $statusResponse; break }
        }
        catch [Microsoft.PowerShell.Commands.HttpResponseException] {
            # This block now ONLY catches the 429 error re-thrown by the wrapper
            if ($_.Exception.Response.StatusCode -eq 429) {
                $retryAfter = $_.Exception.Response.Headers.RetryAfter
                Write-Host "Rate limited by API. Waiting for $retryAfter seconds..." -ForegroundColor Magenta
                Start-Sleep -Seconds $retryAfter.Delta.TotalSeconds
                continue;
            } else { throw $_ } # Re-throw other unexpected HTTP errors
        } catch { throw $_ } # Re-throw non-HTTP errors
        Start-Sleep -Seconds $PollingInterval
    }
    Write-Host "Polling complete. Final status is '$($finalStatus.status)'."
    if ($finalStatus.status -ne "SUCCESS") {
        $executionId = $finalStatus.executionId
        Write-Host "`nEXECUTION FAILED OR WAS CANCELLED for $executionId" -ForegroundColor Red
        if ($finalStatus.errorMessages) {
            Write-Host "Error messages from API:" -ForegroundColor Red
            $finalStatus.errorMessages | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
        }
    }
}

# =================================================================================================
# SECTION 3: MAIN SCRIPT EXECUTION
# =================================================================================================

try {
    # Authenticate
    $accessToken = Get-ApiToken -Url $tokenUrl -ClientId $clientId -ClientSecret $clientSecret -Scope $scope
    $apiHeaders = @{ "Authorization" = "Bearer $accessToken"; "Content-Type" = "application/json" }

    # Ensure our Custom App
    $appId = Ensure-CustomApp -ApiUrl $consumerApiUrl -Headers $apiHeaders -AppName $customAppName

    # Ensure our attributes and entity types
    $metadataArray  = Define-Metadata -ApiBaseUrl $apiBaseUrl -ConsumerApiUrl $consumerApiUrl -Headers $apiHeaders -CustomAppId $appId -CustomAppName $customAppName
    $metadata = $metadataArray[-1];
    # Build the assets and stage them
    $execId = Stage-Assets -ConsumerApiUrl $consumerApiUrl -Headers $apiHeaders -CustomAppId $appId -EntityTypeMap $metadata.EntityTypeMap -AllAttributes $metadata.Attributes
    
    Poll-ExecutionStatus -ConsumerApiUrl $consumerApiUrl -Headers $apiHeaders -ExecutionId $execId -PollingInterval $pollingIntervalSeconds

    Write-Host "`n=====================================================================" -ForegroundColor Green
    Write-Host "SCRIPT COMPLETED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Green
}
catch {
    throw $_

    # This top-level catch will now receive the nicely formatted errors from the wrapper function
    Write-Error "`nSCRIPT FAILED TO COMPLETE." -ErrorAction Stop
    # The specific error message has already been displayed by the wrapper function.
    exit 1
}