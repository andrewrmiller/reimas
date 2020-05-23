import { IFile, IFileUpdate, ThumbnailSize } from '@picstrata/client';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import multer from 'multer';
import { createPictureStore } from './RouterHelpers';

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

const debug = createDebug('api:routers');

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
