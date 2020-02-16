import { ApiKeyAuthType, UserIdHeader } from '@picstrata/client';
import express from 'express';

/**
 * Extracts the API key from a request.
 *
 * @param req The request to inspect.
 *
 * @returns The provided API Key if found.  Otherwise undefined.
 */
export function getApiKey(req: express.Request) {
  const authHeader = req.get('Authorization');
  if (authHeader) {
    // Multiple authentication types may be provided, separated by commas.
    const types = authHeader.split(',');
    for (const type of types) {
      const pieces = type.trim().split(' ');
      if (pieces.length === 2 && pieces[0] === ApiKeyAuthType) {
        return pieces[1];
      }
    }
  }

  return undefined;
}

/**
 * Extracts the User ID from a request.
 *
 * @param req The request to inspect.
 *
 * @returns The provided user ID if found.  Otherwise undefined.
 */
export function getUserIdHeader(req: express.Request) {
  return req.get(UserIdHeader);
}
