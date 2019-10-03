import { IFile, IFileUpdate, PictureStore } from 'common';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import multer from 'multer';

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
 * Gets the attributes of a specific file in a library folder.
 */
router.get(
  '/:libraryId/files/:fileId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    PictureStore.getFile(params.libraryId, params.fileId)
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
    PictureStore.getFileContentInfo(params.libraryId, params.fileId)
      .then(contents => {
        const stream = PictureStore.getFileStream(
          params.libraryId,
          contents.path
        );
        stream.on('error', next);
        res.contentType(contents.mimeType);
        stream.pipe(res);
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
    PictureStore.updateFile(
      params.libraryId,
      params.fileId,
      req.body as IFileUpdate
    )
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
    PictureStore.deleteFile(params.libraryId, params.fileId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
