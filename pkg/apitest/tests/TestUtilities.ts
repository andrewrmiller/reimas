import {
  ApiKeyAuthType,
  UserIdHeader,
  IFile,
  IFolder,
  IFolderAdd,
  Role
} from '@picstrata/client';
import { HttpMethod, HttpStatusCode, Paths } from 'common';
import createDebug from 'debug';
import FormData from 'form-data';
import fs from 'fs';
import fetch, { BodyInit, Headers } from 'node-fetch';

const debug = createDebug('apitest:libraries');
const testLog = createDebug('apitest:testinfo');

export const ApiBaseUrl = `http://localhost:${process.env.APITEST_PORT}`;

const AuthorizationHeader = 'Authorization';
const WaitRetryCount = 20;

const ApiKey = process.env.PST_API_KEY_1;

export async function logTestStart() {
  const state = expect.getState();
  const path = state.testPath.split('/tests/')[1];
  testLog(`[${path}] Starting test: ${state.currentTestName}`);
}

export async function getStats() {
  return sendRequest('service/stats').then(result => {
    expect(result.status).toBe(HttpStatusCode.OK);
    return result.json();
  });
}

export async function sendRequest(
  relativeUrl: string,
  userId?: string,
  method: HttpMethod = HttpMethod.Get,
  body?: BodyInit
) {
  const headers = new Headers();

  if (method !== HttpMethod.Get) {
    headers.append('Content-Type', 'application/json');
  }

  headers.append(AuthorizationHeader, ApiKeyAuthType + ' ' + ApiKey);

  if (userId) {
    headers.append(UserIdHeader, userId);
  }

  return fetch(`${ApiBaseUrl}/${relativeUrl}`, {
    method,
    headers,
    body
  });
}

/**
 * Creates a folder in a library.
 *
 * @param userId Unique ID of the user creating the folder.
 * @param libraryId Unique ID of the library.
 * @param parentId Unique ID of the parent folder.
 * @param name Name of the new folder.
 *
 * @returns An IFolder instance.
 */
export function createFolder(
  userId: string,
  libraryId: string,
  parentId: string,
  name: string
) {
  return sendRequest(
    `libraries/${libraryId}/folders`,
    userId,
    HttpMethod.Post,
    JSON.stringify({
      parentId,
      name
    } as IFolderAdd)
  ).then(response => {
    expect(response.status).toBe(HttpStatusCode.OK);
    return response.json().then((folder: IFolder) => {
      expect(folder.userRole).toBe(Role.Owner);
      return folder;
    });
  });
}

/**
 * Posts a file to the API under test.
 *
 * @param relativeUrl Site-relative URL to use in the post.
 * @param userId Unique ID of the user making the post.
 * @param body FormData object which manages the multipart/form-data.
 */
export async function postFile(
  relativeUrl: string,
  userId: string,
  body: FormData
) {
  const headers = new Headers();

  headers.append(AuthorizationHeader, ApiKeyAuthType + ' ' + ApiKey);
  headers.append(UserIdHeader, userId);

  return fetch(`${ApiBaseUrl}/${relativeUrl}`, {
    method: HttpMethod.Post,
    headers,
    body
  });
}

/**
 * Posts a file from the local file system to a folder in a library.
 *
 * @param userId Unique ID of the user making the post.
 * @param libraryId Unique ID of the library to post to.
 * @param folderId Unique ID of the parent folder.
 * @param localPath Local path to the file to upload.
 * @param contentType Content type of the file to upload.
 * @param metadataEx Optional additional metadata represented as JSON.
 */
export async function postFileToFolder(
  userId: string,
  libraryId: string,
  folderId: string,
  localPath: string,
  contentType: string,
  metadataEx?: string
) {
  const form = new FormData();
  const buffer = fs.readFileSync(localPath);
  const filename = Paths.getLastSubpath(localPath);

  form.append('files', buffer, {
    contentType,
    filename
  });

  if (metadataEx) {
    form.append('metadata', metadataEx);
  }

  return postFile(
    `libraries/${libraryId}/folders/${folderId}/files`,
    userId,
    form
  ).then(response => {
    expect(response.status).toBe(HttpStatusCode.OK);
    return response.json().then((files: IFile[]) => {
      return files[0];
    });
  });
}

/**
 * Retrieves the list of files in a folder.
 *
 * @param userId Unique ID of the user creating the folder.
 * @param libraryId Unique ID of the library.
 * @param folderId Unique ID of the folder.
 *
 * @returns An array of IFile instances.
 */
export function getFilesInFolder(
  userId: string,
  libraryId: string,
  folderId: string
) {
  return sendRequest(
    `libraries/${libraryId}/folders/${folderId}/files`,
    userId
  ).then(response => {
    expect(response.status).toBe(HttpStatusCode.OK);
    return response.json().then((files: IFile[]) => {
      return files;
    });
  });
}

/**
 * Copies a file into a target folder.
 *
 * @param userId Unique ID of the user creating the folder.
 * @param libraryId Unique ID of the library.
 * @param fileId Unique ID of the source file.
 * @param targetFolderId Unique ID of the target folder.
 *
 * @returns An IFile instance.
 */
export function copyFile(
  userId: string,
  libraryId: string,
  fileId: string,
  targetFolderId: string
) {
  // Copy the file from SubFolder1 to SubFolder3.
  return sendRequest(
    `libraries/${libraryId}/folders/${targetFolderId}/files?source=${fileId}`,
    userId,
    HttpMethod.Post
  ).then(response => {
    expect(response.status).toBe(HttpStatusCode.OK);
    return response.json().then((file: IFile) => {
      expect(file.isProcessing).toBeTruthy();
      return file;
    });
  });
}

/**
 * Sleeps for a specified duration.
 *
 * @param timeMs Number of milliseconds to sleep.
 */
export async function sleep(timeMs: number) {
  await new Promise(resolve => setTimeout(resolve, timeMs));
}

/**
 * Waits for all files to be processed before returning.
 */
export async function waitForProcessingComplete() {
  debug('Waiting for file processing to complete...');
  let retry = 0;

  while (retry < WaitRetryCount) {
    // If there are no files being processed we are done.
    const count = await getProcessingCount();
    if (count === 0) {
      return;
    }

    // Check again in a bit.
    retry++;
    await sleep(1000);
  }

  expect(retry).toBeLessThan(WaitRetryCount);
}

/**
 * Gets the number of files that are currently being processed.
 */
export async function getProcessingCount() {
  return getStats().then(stats => {
    return stats.processingCount;
  });
}

/**
 * Waits for the asynchronous queue to drain.
 */
export async function waitForQueueDrain() {
  let retry = 0;

  while (retry < WaitRetryCount) {
    // If the queue length is 0 we're done.
    const stats = await getStats();
    if (stats.queueLength === 0) {
      return;
    }

    // Check again in a bit.
    debug(`Queue length is ${stats.queueLength}.  Waiting...`);
    retry++;
    await sleep(1000);
  }

  expect(retry).toBeLessThan(WaitRetryCount);
}
