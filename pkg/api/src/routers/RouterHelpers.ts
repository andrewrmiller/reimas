import { HttpStatusCode, PictureStore } from 'common';
import express from 'express';
import createHttpError from 'http-errors';
import { getApiKey, getUserIdHeader } from '../common/HttpHeader';

export function createPictureStore(req: express.Request) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    throw createHttpError(HttpStatusCode.UNAUTHORIZED, 'API key not found.');
  }

  const userId = getUserIdHeader(req);
  if (!userId) {
    throw createHttpError(
      HttpStatusCode.BAD_REQUEST,
      'User ID header not found.'
    );
  }

  return PictureStore.createForApiRequest(apiKey, userId);
}
