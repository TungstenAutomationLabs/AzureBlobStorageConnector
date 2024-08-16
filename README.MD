# Blob Storage Helper for TotalAgility
This project deploys a standalone, serverless Azure Function that can be called as a Microservice or Connector from Tungsten Automation's TotalAgility, RPA, or other system, via a simple JSON over HTTP, RPC style interface. This provides a low cost, scalable and secure method to connect TotalAgility to Azure Blob Storage.

The function provides a simplified interface for interacting with Azure Blob Storage.

The function is stateless, and no data is stored in Azure after a call is complete. The storage account key should be stored securely in TotalAgility / the calling system, or retrieved dynamically from an Azure Key Store / AWS Key Valut (or equivalent that is used in your environment).

The function essentially provides a proxy interface to interact with Azure Blob Storage, removing the need to manage security calls, header checksums etc. in TotalAgility, greatly simplifying the integration. 

The function code is implemented in node.js (see the notes at the end of this file to see how development project was originally configured and how to deploy it to Azure using the Azure command line).

To use the function, see the example payloads or the example postman project. 


## Using in TotalAgility
In TotalAgility, create corresponding Custom Services to call this service. An example project is provided that can be imported into TotalAgility and just needs the associated web service references to be updated. 

See the "example_totalagility" folder for a project to import into your environment. It contains examples and template for:

 - web service reference
 - custom services & data models to call the function
 - an example process, using the custom services
 - an example form, using the custom services
 - global variables for the form & process 

## Functionality provided by the connector
The function provides an RPC style interface to call blob storage, using json over https. 

 - list - lists the files in the container
 - create - creates a new file in the container, using the provided Base64 data
 - read - retrieves a file from the container as Base64
 - update - updates a file contents / meta-data
 - delete - deletes a file
 - create_container - creates a new container
 - delete_container - deletes a container
 - exists_container - checks if a container exists or not
 - get_sas - gets a SAS string to access files in a container, valid for 24hrs
 - get_connection_string - gets a connection string to access the specified container

## Using the Postman project
Import the project collection (v2.1), and create an environment to use with the following variables:

function_code - this is the security code to add to the function URL (retrieve from the Azure portal after deployment)

function_name - the name used to deploy the function into your Azure enviroment

azure_storage_account_name - the storage account name to use

azure_storage_account_key - the storage account key to use

azure_storage_account_container - the container name to use 


## Original Setup Steps to Configure the Dev Enviromnent
npm init

{
  "name": "blobstoragehelper",
  "version": "1.0.0",
  "description": "Azure function to proxy access to Azure Blob Storage, to simplify authentication & checksum calculation. ",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "azure",
    "blob",
    "storage"
  ],
  "author": "Tom Coppock",
  "license": "ISC"
}



func init blobstoragehelper --javascript
func new --name blobstoragehelper --template "HTTP trigger" --authlevel "function"


npm install @azure/storage-blob


## Steps to run the function on the local machine
To run locally: 
func start


## Steps to deploy the function to Microsoft Azure 
Azure setup steps:
1. Login:
az login

2. Create Resource Group:
az group create --name YOUR_RESOURCE_GROUP_NAME --location northeurope --tags "CustomTag=Tag Value" "Description=Azure function to proxy access to Azure Blob Storage, to simplify authentication & checksum calculation."

3. Create a storage account to hold the function app code:
az storage account create --name YOUR_STORAGE_ACCOUNT_TO_STORE_THE_FUNCTION_CODE --location northeurope --resource-group YOUR_RESOURCE_GROUP_NAME --sku Standard_LRS --allow-blob-public-access false --tags "CustomTag=Tag Value" "Description=Azure function to proxy access to Azure Blob Storage, to simplify authentication & checksum calculation."

4. Create the function app:
az functionapp create --resource-group YOUR_RESOURCE_GROUP_NAME --consumption-plan-location northeurope --runtime node --runtime-version 18 --functions-version 4 --name BlobStorageHelper --storage-account YOUR_STORAGE_ACCOUNT_TO_STORE_THE_FUNCTION_CODE --tags "CustomTag=Tag Value" "Description=Azure function to proxy access to Azure Blob Storage, to simplify authentication & checksum calculation."

5. Publish/redeploy the code from the current directory to the newly created function app: 
func azure functionapp publish BlobStorageHelper

6. Get the key from the new function app and remember to use this when calling the app using HTTP (add key to get or header)


## Steps to Redeploy on the SE Demo Cloud (Tungsten Automation only)
For the SE Demo Cloud, use the following to update the existing function:

func azure functionapp publish SEW-blobstoragehelper



