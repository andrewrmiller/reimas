import { HttpMethod, HttpStatusCode } from 'common';
import createDebug from 'debug';
import fetch, { BodyInit, Headers } from 'node-fetch';

const debug = createDebug('apitest:libraries');

export const ApiBaseUrl = 'http://localhost:3000';
export const SystemUserId = '11111111-1111-1111-1111-111111111111';

export async function getStats() {
  return sendRequest('service/stats', SystemUserId).then(result => {
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

  if (userId) {
    headers.append('Api-User-ID', userId);
  }

  return fetch(`${ApiBaseUrl}/${relativeUrl}`, {
    method,
    headers,
    body
  });
}
