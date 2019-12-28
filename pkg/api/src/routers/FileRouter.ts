import { ThumbnailSize } from 'common';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import multer from 'multer';
import { IFile, IFileUpdate } from 'picstrata-client';
import { createPictureStore } from './RouterHelpers';

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
    createPictureStore(req)
      .getFiles(params.libraryId, params.folderId)
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
  '/:libraryId/folders/:folderId/files',
  upload.array('files'),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const importPromises: Array<Promise<IFile>> = [];
    const pictureStore = createPictureStore(req);
    for (const file of (req.files as any) as Express.Multer.File[]) {
      // NOTE: Uploaded file will be deleted by importFile method.
      importPromises.push(
        pictureStore.importFile(
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
 * Gets the attributes of a specific file in a library folder.
 */
router.get(
  '/:libraryId/files/:fileId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFile(params.libraryId, params.fileId)
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
  '/:libraryId/files/:fileId/contents',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFileContents(params.libraryId, params.fileId)
      .then(contents => {
        res.contentType(contents.mimeType);
        contents.stream.on('error', next);
        contents.stream.pipe(res);
      })
      .catch(next);
  }
);

/**
 * Gets a thumbnail for a specific file in a library folder.
 */
router.get(
  '/:libraryId/files/:fileId/thumbnails/:size',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .getFileThumbnail(
        params.libraryId,
        params.fileId,
        params.size as ThumbnailSize
      )
      .then(contents => {
        res.contentType(contents.mimeType);
        contents.stream.on('error', next);
        contents.stream.pipe(res);
      })
      .catch(next);
  }
);

/**
 * Updates an existing file in a library.
 */
router.patch(
  '/:libraryId/files/:fileId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .updateFile(params.libraryId, params.fileId, req.body as IFileUpdate)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Deletes an existing file in a library.
 */
router.delete(
  '/:libraryId/files/:fileId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    createPictureStore(req)
      .deleteFile(params.libraryId, params.fileId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
