import {
  IFolderAdd,
  IFolderUpdate,
  IObjectUserAdd,
  ObjectType
} from '@picstrata/client';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import createHttpError from 'http-errors';
import { createPictureStore } from './RouterHelpers';

const router = express.Router();

const debug = createDebug('api:routers');

/*
 * Note that folders are always contained in a library, so this router
 * is attached to '/libraries/:libraryid' in app.ts.
 */

/**
 * Creates a new folder in a library.
 */
router.post(
  '/:libraryId/folders',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .addFolder(params.libraryId, req.body as IFolderAdd)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a list of folders in a library.
 *
 * The `parent` query string parameter must be provided to specify
 * which collection of folders to retrieve.  To retrieve the collection
 * of root folders in the library (i.e. "All Pictures", "Search Folders", etc.),
 * use `?parent=`.
 */
router.get(
  '/:libraryId/folders',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Parent query string parameter must be provided.
    const parent = req.query.parent;
    if (parent === undefined) {
      debug(`parent query string parameter was not specified.`);
      throw createHttpError(
        400,
        'parent query string parameter must be specified.'
      );
    }

    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFolders(params.libraryId, parent === '' ? undefined : parent)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a specific folder in a library.
 */
router.get(
  '/:libraryId/folders/:folderId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFolder(params.libraryId, params.folderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets the breadcrumbs for a specific folder in a library.
 */
router.get(
  '/:libraryId/folders/:folderId/breadcrumbs',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFolderBreadcrumbs(params.libraryId, params.folderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Updates an existing folder in a library.
 */
router.patch(
  '/:libraryId/folders/:folderId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .updateFolder(
        params.libraryId,
        params.folderId,
        req.body as IFolderUpdate
      )
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Deletes an existing folder in a library.
 */
router.delete(
  '/:libraryId/folders/:folderId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .deleteFolder(params.libraryId, params.folderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a list of all subfolders underneath a folder in a library.
 */
router.get(
  '/:libraryId/folders/:folderId/subfolders',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFolders(params.libraryId, params.folderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a list of files in a library folder.
 */
router.get(
  '/:libraryId/folders/:folderId/files',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFiles(params.libraryId, params.folderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Adds a new user to a folder in a library.
 */
router.post(
  '/:libraryId/folders/:folderId/users',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .addRoleAssignment(
        params.libraryId,
        ObjectType.Folder,
        params.folderId,
        req.body as IObjectUserAdd
      )
      .then(result => {
        res.send(result);
      })
      .catch(next);
  }
);

export default router;
