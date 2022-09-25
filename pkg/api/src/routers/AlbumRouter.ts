import {
  IAlbumAdd,
  IAlbumUpdate,
  IObjectUserAdd,
  ObjectType
} from '@picstrata/client';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { createPictureStore } from './RouterHelpers';

const router = express.Router();
const debug = createDebug('api:routers');

/**
 * Creates a new album in a library.
 */
router.post(
  '/:libraryId/albums',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    debug(`Creating a new album in library ${params.libraryId}`);
    createPictureStore(req)
      .addAlbum(params.libraryId, req.body as IAlbumAdd)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets the list of albums in the library.
 */
router.get(
  '/:libraryId/albums',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    createPictureStore(req)
      .getAlbums(req.params.libraryId)
      .then(albums => {
        res.send(albums);
      })
      .catch(next);
  }
);

/**
 * Gets the information for an album.
 */
router.get(
  '/:libraryId/albums/:albumId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    createPictureStore(req)
      .getAlbum(req.params.libraryId, req.params.albumId)
      .then(album => {
        res.send(album);
      })
      .catch(next);
  }
);

/**
 * Updates an existing album in a library.
 */
router.patch(
  '/:libraryId/albums/:albumId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .updateAlbum(params.libraryId, params.albumId, req.body as IAlbumUpdate)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Deletes an existing album in a library.
 */
router.delete(
  '/:libraryId/albums/:albumId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .deleteAlbum(params.libraryId, params.albumId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a list of files in an album.
 */
router.get(
  '/:libraryId/albums/:albumId/files',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getAlbumFiles(params.libraryId, params.albumId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Adds a new user to an album in a library.
 */
router.post(
  '/:libraryId/albums/:albumId/users',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .addRoleAssignment(
        params.libraryId,
        ObjectType.Album,
        params.albumId,
        req.body as IObjectUserAdd
      )
      .then(result => {
        res.send(result);
      })
      .catch(next);
  }
);

export default router;
