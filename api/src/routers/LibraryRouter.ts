import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ILibraryAdd, ILibraryUpdate } from '../services/models';
import { PictureStore } from '../services/PictureStore';

const router = express.Router();

/**
 * Gets a list of all libraries
 */
router.get(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    PictureStore.getLibraries()
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
    PictureStore.getLibrary(params.libraryId)
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
    PictureStore.addLibrary(req.body as ILibraryAdd)
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
    PictureStore.updateLibrary(params.libraryId, req.body as ILibraryUpdate)
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
    PictureStore.deleteLibrary(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
