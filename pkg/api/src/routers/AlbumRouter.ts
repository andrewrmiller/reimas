import { IAlbum } from '@picstrata/client';
import { HttpStatusCode } from 'common';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { createPictureStore } from './RouterHelpers';

const router = express.Router();
const debug = createDebug('api:routers');

const BuiltInAlbums: { [key: string]: string } = {
  favorites: 'Favorites',
  videos: 'Videos'
};

/**
 * Gets the information for an album.
 */
router.get(
  '/:libraryId/albums/:albumId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;

    if (Object.keys(BuiltInAlbums).indexOf(params.albumId) < 0) {
      res.status(HttpStatusCode.NOT_FOUND);
      res.send('Library or album not found.');
      return;
    }

    createPictureStore(req)
      .getLibrary(req.params.libraryId)
      .then(_ => {
        res.send({
          libraryId: req.params.libraryId,
          albumId: req.params.albumId,
          name: BuiltInAlbums[req.params.albumId],
          isDynamic: true
        } as IAlbum);
      })
      .catch(next);
  }
);

/**
 * Gets a list of files in the favorites album.
 */
router.get(
  '/:libraryId/albums/favorites/files',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFavoriteFiles(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets a list of files in the videos album.
 */
router.get(
  '/:libraryId/albums/videos/files',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getVideoFiles(params.libraryId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
