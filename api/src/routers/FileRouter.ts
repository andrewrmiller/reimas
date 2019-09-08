import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import createHttpError from 'http-errors';
import multer from 'multer';
import { IFile, IFileAdd, IFileUpdate } from '../services/models';
import { PictureStore } from '../services/PictureStore';

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

const debug = createDebug('api:routers');

/*
 * Note that files always live in folder and folders are always contained
 * in a library, so this router is attached to '/libraries/:libraryid' in app.ts.
 */

/**
 * Gets a list of files in a library folder.
 */
router.get(
  '/:libraryId/folders/:folderId/files',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    PictureStore.getFiles(params.libraryId, params.folderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Gets the contents of a specific file in a library folder.
 */
router.get(
  '/:libraryId/folders/:folderId/files/:pictureId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;

    // TODO: What about metadata vs. picture?

    PictureStore.getFile(params.libraryId, params.folderId, params.pictureId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Adds one or more pictures to a folder in a library.
 */
router.post(
  '/:libraryId/folders/:folderId/pictures',
  upload.array('files'),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const importPromises: Array<Promise<IFile>> = [];
    for (const file of (req.files as any) as Express.Multer.File[]) {
      // NOTE: Uploaded file will be deleted by importFile method.
      importPromises.push(
        PictureStore.importFile(
          params.libraryId,
          params.folderId,
          file.path, // Relative path to the file in the uploads dir
          file.originalname,
          file.mimetype,
          file.size
        )
      );
    }

    Promise.all(importPromises)
      .then((files: IFile[]) => {
        res.send(files);
      })
      .catch(next);
  }
);

/**
 * Updates an existing picture in a library.
 */
router.patch(
  '/:libraryId/folders/:folderId/pictures/:pictureId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    PictureStore.updateFile(
      params.libraryId,
      params.pictureId,
      req.body as IFileUpdate
    )
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Deletes an existing picture in a library.
 */
router.delete(
  '/:libraryId/folders/:folderId/pictures/:pictureId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    PictureStore.deleteFile(params.libraryId, params.pictureId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
