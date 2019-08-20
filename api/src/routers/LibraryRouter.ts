import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { DbFactory } from '../services/db/DbFactory';
import { ILibraryPatch, INewLibrary } from '../services/db/models';
const router = express.Router();

/**
 * Get a list of all libraries
 */
router.get(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const db = DbFactory.createInstance();
    db.getLibraries()
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Get a specific library.
 */
router.get(
  '/:libraryId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const db = DbFactory.createInstance();
    db.getLibrary(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Add a new library.
 */
router.post(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const db = DbFactory.createInstance();
    db.addLibrary(req.body as INewLibrary)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Update an existing library.
 */
router.patch(
  '/:libraryId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const db = DbFactory.createInstance();
    db.patchLibrary(params.libraryId, req.body as ILibraryPatch)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Delete an existing library.
 */
router.delete(
  '/:libraryId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const db = DbFactory.createInstance();
    db.deleteLibrary(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
