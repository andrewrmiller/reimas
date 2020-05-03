import { HttpStatusCode } from 'common';
import express from 'express';
import createHttpError from 'http-errors';
import { PictureStore } from 'storage';
import { getApiKey, getUserIdHeader } from '../common/HttpHeader';

export function createPictureStore(
  req: express.Request,
  allowAnonymous: boolean = false
) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    throw createHttpError(HttpStatusCode.UNAUTHORIZED, 'API key not found.');
  }

  const userId = getUserIdHeader(req);
  if ((!userId && !allowAnonymous) || userId === '') {
    throw createHttpError(
      HttpStatusCode.BAD_REQUEST,
      'Invalid or missing user ID.'
    );
  }

  return PictureStore.createForApiRequest(apiKey, userId);
}
