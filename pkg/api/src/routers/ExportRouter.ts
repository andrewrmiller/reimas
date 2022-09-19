import { IExportJobAdd } from '@picstrata/client';
import createDebug from 'debug';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { createPictureStore } from './RouterHelpers';

const router = express.Router();
const debug = createDebug('api:routers');

/**
 * Creates an asynchronous job to export a set of files as a .zip.
 */
router.post(
  '/:libraryId/exportjobs',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    debug('Received a request to create an export job.');
    createPictureStore(req)
      .addExportJob(params.libraryId, req.body as IExportJobAdd)
      .then(jobId => {
        res.json({ jobId });
      })
      .catch(next);
  }
);

/**
 * Gets the contents an exported file.
 */
router.get(
  '/:libraryId/exports/:jobId',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const params = req.params as ParamsDictionary;
    const asAttachment = req.query.attachment === 'true';
    createPictureStore(req)
      .getZipFileContents(params.libraryId, params.jobId)
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

export default router;
