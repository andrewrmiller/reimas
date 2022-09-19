import {
  IFile,
  IFileCopyTarget,
  IFileUpdate,
  ThumbnailSize
} from '@picstrata/client';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import multer from 'multer';
import { createPictureStore } from './RouterHelpers';

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

const debug = createDebug('api:routers');

/*
 * Note that files always live in folder and folders are always contained
 * in a library, so this router is attached to '/libraries/:libraryid' in app.ts.
 */

/**
 * Adds one or more pictures to a folder in a library.
 */
router.post(
  '/:libraryId/folders/:folderId/files',
  upload.array('files'),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    debug(
      `Adding a file with id = ${params.fileId} to library ${params.folderIds}`
    );
    const importPromises: Promise<IFile>[] = [];
    const pictureStore = createPictureStore(req);
    const uploadedFiles: Express.Multer.File[] = req.files as any;
    for (const file of uploadedFiles) {
      // NOTE: Uploaded file will be deleted by importFile method.
      importPromises.push(
        pictureStore.importFile(
          params.libraryId,
          params.folderId,
          file.path, // Relative path to the file in the uploads dir
          file.originalname,
          file.mimetype,
          file.size,
          req.body.metadata
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
    debug(
      `Fetching metadata for file ${params.fileId} in library ${params.fileId}`
    );
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
    debug(
      `Fetching contents for file ${params.fileId} in library ${params.fileId}`
    );
    const asAttachment = req.query.attachment === 'true';
    createPictureStore(req)
      .getFileContents(params.libraryId, params.fileId, asAttachment)
      .then(contents => {
        if (asAttachment) {
          res.setHeader(
            'Content-Disposition',
            `attachment; filename=${contents.filename}`
          );
        }
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
    debug(
      `Fetching thumbnail for file ${params.fileId} in library ${params.fileId}`
    );
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
    debug(`Updating file ${params.fileId} in library ${params.fileId}`);
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
    debug(`Deleting file ${params.fileId} in library ${params.fileId}`);
    createPictureStore(req)
      .deleteFile(params.libraryId, params.fileId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

/**
 * Copies a file from one folder to another.
 */
router.put(
  '/:libraryId/files/:fileId/copy',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    debug(
      `Cop9ying file ${params.fileId} in library ${params.fileId} to folder ${req.body.targetFolderId}`
    );
    const target = req.body as IFileCopyTarget;
    createPictureStore(req)
      .copyFile(params.libraryId, params.fileId, target.targetFolderId)
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
