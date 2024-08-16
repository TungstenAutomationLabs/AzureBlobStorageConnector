const { BlobServiceClient, StorageSharedKeyCredential, ContainerSASPermissions, generateBlobSASQueryParameters, SASProtocol } = require('@azure/storage-blob');
const { Readable } = require('stream');

const examplePayloadOrig = `                

Example Payload (base features, all required):
{
    "azure_storage_account_name": "x",
    "azure_storage_account_key": "x",
    "azure_storage_account_container": "x",
    "optional_directory": ".",
    "optional_file_name": "name.ext",
    "optional_file_content_as_base64": " ",
    "action": "list|create|read|update|delete|create_container|delete_container|exists_container|get_sas|get_connection_string",
    "optional_file_custom_metadata": {
        "key1": "value-1",
        "key2": "value-2"
    }
}

Example Response:

`;

const examplePayload = {
    "azure_storage_account_name": "x",
    "azure_storage_account_key": "x",
    "azure_storage_account_container": "x",
    "optional_directory": ".",
    "optional_file_name": "name.ext",
    "optional_file_content_as_base64": " ",
    "action": "list|create|read|update|delete|create_container|delete_container|exists_container|get_sas|get_connection_string",
    "optional_file_custom_metadata": {
        "customKey1": "value1",
        "customKey2": "value2"
    }
}


module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    let responseJson = {};
    responseJson.error = "none";

    try {



        if (req.method != 'POST') {
            responseJson.error = `This HTTP triggered function executed successfully, but should be called using POST.  Pass in the following parameters in the POST body:`
            responseJson.examplePayload = examplePayload;
            responseJson.guidance = "The service will return a status code 200 if successful, 400 if called with an incorrect payload, or 500 if there is an error.";
            context.res = {
                status: 400, /* Bad Request */
                body: responseJson
            };
        } else {

            const obj = req.body; // body is automatically treated as json, based on content type

            if (obj.azure_storage_account_name &&
                obj.azure_storage_account_key &&
                obj.azure_storage_account_container &&
                (obj.action === "list" || obj.action === "create" || obj.action === "read" || obj.action === "update" || obj.action === "delete" || obj.action === "create_container" || obj.action === "delete_container" || obj.action === "exists_container" || obj.action === "get_sas" || obj.action === "get_connection_string")
            ) {

                /**
                 * Authenticate to the service 
                 */
                const sharedKeyCredential = new StorageSharedKeyCredential(obj.azure_storage_account_name, obj.azure_storage_account_key);
                const blobServiceClient = new BlobServiceClient(
                    `https://${obj.azure_storage_account_name}.blob.core.windows.net`,
                    sharedKeyCredential
                );

                responseJson.debug = "Authenticated to the blob storage service.";
                responseJson.action = obj.action;

                // throw new Error ("TEST ERROR");

                if (obj.action === "create_container" || obj.action === "delete_container" || obj.action === "exists_container") {
                    if (obj.action === "create_container") {
                        if (isValidContainerName(obj.azure_storage_account_container)) {
                            responseJson.result = await create_container(blobServiceClient, obj.azure_storage_account_container);
                        } else {
                            throw new Error("Invalid container name. Container names can only contain lowercase letters, numbers, and hyphens, and must start and end with a letter or number.");
                        }
                    }
                    if (obj.action === "delete_container") {
                        responseJson.result = await delete_container(blobServiceClient, obj.azure_storage_account_container);
                    }
                    if (obj.action === "exists_container") {
                        responseJson.result = await exists_container(blobServiceClient, obj.azure_storage_account_container);
                    }
                } else {
                    // create container client
                    const containerClient = await blobServiceClient.getContainerClient(obj.azure_storage_account_container);

                    // Call subfunctions depending on what parameters were provided:
                    switch (obj.action) {
                        case "list":
                            if (typeof obj.optional_directory === 'undefined') {
                                obj.optional_directory = ".";
                            }
                            responseJson.results = await list_directory(containerClient, obj.optional_directory);
                            break;
                        case "create":
                            if (typeof obj.optional_file_name === 'undefined' || obj.optional_file_name === null || obj.optional_file_name === "") {
                                responseJson.error = "No file name supplied";
                            } else {
                                if (typeof obj.optional_file_content_as_base64 === 'undefined' || obj.optional_file_content_as_base64 === null || obj.optional_file_content_as_base64 === "") {
                                    responseJson.error = "No file contents supplied";
                                } else {
                                    responseJson.fileName = addDirectoryToFilename(obj.optional_directory, obj.optional_file_name);
                                    responseJson.debug = await create_blob(containerClient, responseJson.fileName, obj.optional_file_content_as_base64);
                                }
                            }
                            if (responseJson.debug.startsWith("Error:")) {
                                responseJson.error = responseJson.debug;
                            }

                            // Add any optional metadata to the new object:
                            // Check if obj.optional_file_custom_metadata exists and is not null
                            if (obj.optional_file_custom_metadata && Object.keys(obj.optional_file_custom_metadata).length > 0) {
                                console.log('Data exists in obj.optional_file_custom_metadata.');

                                // Extract custom metadata from JSON
                                let customMetadata = obj.optional_file_custom_metadata || {};

                                const blobClient = containerClient.getBlobClient(obj.optional_file_name);

                                try {
                                    // Set custom metadata for the blob
                                    await blobClient.setMetadata(customMetadata);
                                } catch (error) {
                                    console.error('Error adding custom metadata:', error.message);
                                    responseJson.metadata_error = "Error adding custom metadata: " + error.message;
                                }
                            }
                            // End add metadata
                            break;
                        case "read":
                            if (typeof obj.optional_file_name === 'undefined' || obj.optional_file_name === null || obj.optional_file_name === "") {
                                responseJson.error = "No file name supplied";
                            } else {
                                responseJson.fileName = addDirectoryToFilename(obj.optional_directory, obj.optional_file_name);
                                responseJson.debug = "Getting blob " + responseJson.fileName;
                                responseJson.fileAsBase64 = await read_blob(containerClient, responseJson.fileName);
                            }
                            if (responseJson.fileAsBase64.startsWith("Error:")) {
                                responseJson.error = responseJson.fileAsBase64.startsWith;
                            }
                            break;
                        case "update":
                            if (typeof obj.optional_file_name === 'undefined' || obj.optional_file_name === null || obj.optional_file_name === "") {
                                responseJson.error = "No file name supplied";
                            } else {
                                if (typeof obj.optional_file_content_as_base64 === 'undefined' || obj.optional_file_content_as_base64 === null || obj.optional_file_content_as_base64 === "") {
                                    responseJson.error = "No file contents supplied";
                                } else {
                                    responseJson.fileName = addDirectoryToFilename(obj.optional_directory, obj.optional_file_name);
                                    responseJson.debug = await create_blob(containerClient, responseJson.fileName, obj.optional_file_content_as_base64);
                                }
                            }
                            if (responseJson.debug.startsWith("Error:")) {
                                responseJson.error = responseJson.debug;
                            }
                            // Add any optional metadata to the new object:
                            // Check if obj.optional_file_custom_metadata exists and is not null
                            if (obj.optional_file_custom_metadata && Object.keys(obj.optional_file_custom_metadata).length > 0) {
                                console.log('Data exists in obj.optional_file_custom_metadata.');

                                // Extract custom metadata from JSON
                                let customMetadata = obj.optional_file_custom_metadata || {};

                                const blobClient = containerClient.getBlobClient(obj.optional_file_name);

                                try {
                                    // Set custom metadata for the blob
                                    await blobClient.setMetadata(customMetadata);
                                } catch (error) {
                                    console.error('Error adding custom metadata:', error.message);
                                    responseJson.metadata_error = "Error adding custom metadata: " + error.message;
                                }
                            }
                            // End add metadata
                            break;
                        case "delete":
                            if (typeof obj.optional_file_name === 'undefined' || obj.optional_file_name === null || obj.optional_file_name === "") {
                                responseJson.error = "No file name supplied";
                            } else {
                                // Note that folders are virtual in Blob Storage
                                // So there is no "delete directory" operation, if all the files in a folder are deleted, the folder will be deleted too.
                                responseJson.fileName = addDirectoryToFilename(obj.optional_directory, obj.optional_file_name);
                                responseJson.debug = await delete_blob(containerClient, responseJson.fileName);
                            }
                            if (responseJson.debug.startsWith("Error:")) {
                                responseJson.error = responseJson.debug;
                            }
                            break;
                        case "get_sas":
                            responseJson.sasToken = await generateContainerSasToken(containerClient);
                            break;

                        case "get_connection_string":
                            responseJson.connectionString = `DefaultEndpointsProtocol=https;BlobEndpoint=https://${obj.azure_storage_account_name}.blob.core.windows.net;SharedAccessSignature=${await generateContainerSasToken(containerClient)}`
                            responseJson.containerName = obj.azure_storage_account_container
                            break;
                        default:
                            responseJson.debug = "Error reading action parameter"; // Should never be reached
                            break;
                    }
                }

                // Return the response: 
                context.res = {
                    // status: 200, /* Defaults to 200 */
                    body: responseJson
                };

            } else {

                responseJson.error = `This HTTP triggered function executed successfully, but not all the required information was found. Please use the example payload for guidance:`
                responseJson.examplePayload = examplePayload;

                context.res = {
                    status: 400, /* Bad Request */
                    body: responseJson
                };
            }

        }

    } catch (error) {
        responseJson.error = `An error occured. Pass in the following parameters in the POST body to call the service:`
        responseJson.examplePayload = examplePayload;
        responseJson.errorMessage = "\"" + error + "\""; // Potentially could URI error to make sure json is alway valid, but makes error harder to read, so omitted for now. 
        responseJson.guidance = "The service will return a status code 200 if successful, 400 if called with an incorrect payload, or 500 if there is an error.";
        context.res = {
            status: 500, /* Bad Request */
            body: responseJson
        };
    }

}



/************************************************************************************************
 * Lists the files in the blob storage container and directory specified. 
 * 
 * @param {ContainerClient} containerClient 
 * @param {string} directory 
 * @returns [object]
 */
async function list_directory(containerClient, directory) {

    console.log("Directory is:" + directory + "#");

    var results = [];

    const listOptions = {
        includeCopy: false,                 // include metadata from previous copies
        includeDeleted: false,              // include deleted blobs 
        includeDeletedWithVersions: false,  // include deleted blobs with versions
        includeLegalHold: false,            // include legal hold
        includeMetadata: true,              // include custom metadata
        includeSnapshots: true,             // include snapshots
        includeTags: true,                  // include indexable tags
        includeUncommitedBlobs: false,      // include uncommitted blobs
        includeVersions: false              // include all blob version
    };


    if (directory === "." || directory === null || directory === "" || directory === " ") {
        // Don't add a prefix option, i.e. list everything
    } else { // Filter only results starting with the directory string:
        if (directory.endsWith("/")) {
            listOptions.prefix = directory; // filter by blob name prefix
        } else {
            listOptions.prefix = directory + "/"; // filter by blob name prefix
        }
    }

    let iter = containerClient.listBlobsFlat(listOptions); // Returns up to 5000 results
    //let iter = containerClient.listBlobsByHierarchy(directory, listOptions);
    let entity = await iter.next();
    while (!entity.done) {
        var itemContentLength = parseFloat(parseFloat(entity.value.properties.contentLength));
        if (!isNaN(itemContentLength) && itemContentLength > 0) {
            var item = {};

            item.name = entity.value.name;
            item.contentLength = entity.value.properties.contentLength;
            item.createdOn = entity.value.properties.createdOn;
            item.lastModified = entity.value.properties.lastModified;
            item.contentType = entity.value.properties.contentType;

            /*
            // Add metadata to the item, as a separate array in the repsonse json:  
            if (entity.value.metadata) {  
                item.metadata = entity.value.metadata;  
            } 
            */

            // Add metadata to the top level item using the specified key names:
            if (entity.value.metadata) {
                Object.keys(entity.value.metadata).forEach((key) => {
                    const metadataKey = `${key}`;  // Could also use `metadata_${key}`
                    item[metadataKey] = entity.value.metadata[key];
                });
            }



            results.push(item);
        } else {
            // Ignore as it is a directory, so don't include in the list results.
        }

        entity = await iter.next();
    }
    return results;
}


/*************************************************************************************************
 * 
 * Reads the content of a file from Azure Blob Storage. 
 * 
 * @param {@azure/storage-blob ContainerClient} containerClient 
 * @param {string} blobName 
 * @returns base64 string
 */
async function read_blob(containerClient, blobName) {

    try {
        // Get a reference to the blob
        const blobClient = containerClient.getBlobClient(blobName);

        // Get blob content from position 0 to the end
        // In Node.js, get downloaded data by accessing downloadBlockBlobResponse.readableStreamBody
        const downloadBlockBlobResponse = await blobClient.download();
        const downloaded = (
            await streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
        ).toString('base64');
        //console.log("Downloaded blob content:", downloaded);
        return downloaded;
    }
    catch (error) {
        return "Error: " + error;
    }
}


// [Node.js only] A helper method used to read a Node.js readable stream into a Buffer
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on("error", reject);
    });
}


/*
// Convert stream to text
async function streamToText(readable) {
    readable.setEncoding('utf8');
    let data = '';
    for await (const chunk of readable) {
        data += chunk;
    }
    return data;
}
*/

/*
async function update_blob(containerClient) {


}
*/


async function delete_blob(containerClient, blobName) {

    try {
        // include: Delete the base blob and all of its snapshots.
        // only: Delete only the blob's snapshots and not the blob itself.
        const options = {
            deleteSnapshots: 'include' // or 'only'
        }

        // Create blob client from container client
        const blockBlobClient = await containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.delete(options);

        return `Deleted blob: ${blobName}`;

    } catch (error) {
        return "Error: " + error;
    }

}


/*************************************************************************************
 * Creates or overwrites a blob using the content supplied
 * 
 * @param {@azure/storage-blob ContainerClient} containerClient 
 * @param {string} blobName 
 * @param {string} base64String 
 * @returns string
 */
async function create_blob(containerClient, blobName, base64String) {

    try {

        // Convert the base64 string to a buffer
        const buffer = Buffer.from(base64String, 'base64');

        // Create blob client from container client
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Get the mimeType / contentType
        const contentType = determineContentType(blobName);

        // Set options, including the MIME type  
        const options = {
            blobHTTPHeaders: {
                blobContentType: contentType
            }
        };

        // Upload buffer
        await blockBlobClient.uploadData(buffer, options);

        return `Created blob: ${blobName}`;

    } catch (error) {
        return "Error: " + error;
    }

}


/**
 * Utility function to merge the path and file name
 * 
 * @param {*} directory 
 * @param {*} filename 
 * @returns file name inc. full path
 */
function addDirectoryToFilename(directory, filename) {
    if (typeof directory === 'undefined' || directory === null || directory === "") {
        return filename; // No directory was provided
    } else {
        var lastIndexOfSlash = filename.lastIndexOf('/') + 1; // +1 so it removes the "/" as well
        //console.log("lastIndexOfSlash: " + (lastIndexOfSlash) );
        trimmed_filename = filename.substring(lastIndexOfSlash); // Remove any path provided in the filename
        if (directory.endsWith('/')) { // Directory ends with /
            return directory + trimmed_filename;
        } else { // Directory does not end with /
            return directory + "/" + trimmed_filename;
        }
    }
}



/************************************************************************************************
 * Creates the specified container, if it  doesn't already exist.  
 * 
 * @param {BlobServiceClient} blobServiceClient 
 * @param {string} containerName 
 * @returns [object]
 */
async function create_container(blobServiceClient, containerName) {

    console.log("Creates a blob storage container, if it doesn't already exist.");
    const containerClient = blobServiceClient.getContainerClient(containerName);

    try {
        const exists = await containerClient.exists();

        if (!exists) {
            console.log("Creating container");
            await containerClient.create();
            return `Container "${containerName}" created successfully.`;
        } else {
            console.log("Container already exists");
            return `Container "${containerName}" already exists.`;
        }
    } catch (error) {
        console.log("create_container error: " + error.message);
        return `Error: ${error.message}`;
    }
}

/************************************************************************************************
 * Deletes the specified container, if it exists. 
 * 
 * @param {BlobServiceClient} blobServiceClient 
 * @param {string} containerName 
 * @returns [object]
 */
async function delete_container(blobServiceClient, containerName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);

    try {
        const exists = await containerClient.exists();

        if (exists) {
            await containerClient.delete();
            return `Container "${containerName}" deleted successfully.`;
        } else {
            return `Container "${containerName}" does not exist.`;
        }
    } catch (error) {
        return `Error: ${error.message}`;
    }
}


async function exists_container(blobServiceClient, containerName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);

    try {
        const exists = await containerClient.exists();

        if (exists) {
            return `true`;
        } else {
            return `false`;
        }
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function isValidContainerName(containerName) {
    // Regular expression for validating Azure Storage container name
    const validContainerNameRegex = /^[a-z0-9](-*[a-z0-9])*$/;

    // Check if the container name matches the valid regex
    if (validContainerNameRegex.test(containerName)) {
        return true;
    } else {
        return false;
    }
}

/************************************************************************************************
 * Creates a temporary Shared Access Signature for the blob storage container . 
 * 
 * @param {ContainerClient} containerClient 
 * @returns string
 */
async function generateContainerSasToken(containerClient) {
    // Set the SAS expiration time (in this example, it's set to expire in 24 hours)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);

    // Define the SAS permissions for the container
    //const permissions = ContainerSASPermissions.parse("rwdl"); // Adjust permissions as needed
    const permissions = ContainerSASPermissions.parse("rl");

    // Generate the SAS token for the container
    const sasToken = generateBlobSASQueryParameters({
        containerName: containerClient.containerName,
        permissions,
        startsOn: new Date(),
        expiresOn: expiryTime,
        protocol: SASProtocol.HttpsAndHttp, // Adjust protocol as needed
    }, containerClient.credential).toString();

    return sasToken;
}




/*****************************************************
 * 
 * Utility method to get the mimetype for a file
 * 
 * @param {string} filename 
 * @returns {string} MimeType for the file
 */
function determineContentType(filename) {
    try {
        // Extract the file extension and remove any path 
        const extension = filename.split(/[/\\]/).pop().split('.').pop().toLowerCase();

        // Determine the MIME type based on the file extension  
        switch (extension) {
            case 'avi':
                return 'video/x-msvideo';
            case 'bmp':
                return 'image/bmp';
            case 'csv':
                return 'text/csv';
            case 'docx':
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case 'flv':
                return 'video/x-flv';
            case 'gif':
                return 'image/gif';
            case 'htm':
            case 'html':
                return 'text/html';
            case 'jpeg':
            case 'jpg':
                return 'image/jpeg';
            case 'js':
                return 'application/javascript';
            case 'json':
                return 'application/json';
            case 'm4v':
            case 'mp4':
                return 'video/mp4';
            case 'mkv':
                return 'video/x-matroska';
            case 'mov':
                return 'video/quicktime';
            case 'ogv':
                return 'video/ogg';
            case 'pdf':
                return 'application/pdf';
            case 'png':
                return 'image/png';
            case 'pptx':
                return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            case 'tif':
            case 'tiff':
                return 'image/tiff';
            case 'txt':
                return 'text/plain';
            case 'webm':
                return 'video/webm';
            case 'wmv':
                return 'video/x-ms-wmv';
            case 'xlsx':
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'xml':
                return 'application/xml';
            default:
                return 'application/octet-stream'; // Default MIME type for unknown files  
        }
    }
    catch (error) {
        return 'application/octet-stream'; // Default MIME type for unknown files  
    }

}  