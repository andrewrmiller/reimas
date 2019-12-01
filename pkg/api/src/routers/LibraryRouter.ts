import { PictureStore } from 'common';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ILibraryAdd, ILibraryUpdate } from 'picstrata-client';
import { getUserIdHeader } from '../common/HttpHeader';

const router = express.Router();

/**
 * Gets a list of all libraries
 */
router.get(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const pictureStore = new PictureStore(getUserIdHeader(req));
    pictureStore
      .getLibraries()
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a specific library.
 */
router.get(
  '/:libraryId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const pictureStore = new PictureStore(getUserIdHeader(req));
    pictureStore
      .getLibrary(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Adds a new library.
 */
router.post(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const pictureStore = new PictureStore(getUserIdHeader(req));
    pictureStore
      .addLibrary(req.body as ILibraryAdd)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Updates an existing library.
 */
router.patch(
  '/:libraryId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const pictureStore = new PictureStore(getUserIdHeader(req));
    pictureStore
      .updateLibrary(params.libraryId, req.body as ILibraryUpdate)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Deletes an existing library.
 */
router.delete(
  '/:libraryId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const pictureStore = new PictureStore(getUserIdHeader(req));
    pictureStore
      .deleteLibrary(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
