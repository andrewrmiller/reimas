import { PictureStore } from 'common';
import express from 'express';
import { getUserIdHeader } from '../common/HttpHeader';

const router = express.Router();

/**
 * Gets statstics for the service.
 */
router.get(
  '/stats',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const pictureStore = new PictureStore(getUserIdHeader(req));
    pictureStore
      .getStatistics()
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
