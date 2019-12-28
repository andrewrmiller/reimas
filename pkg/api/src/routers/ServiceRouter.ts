import express from 'express';
import { createPictureStore } from './RouterHelpers';

const router = express.Router();

/**
 * Gets statstics for the service.
 */
router.get(
  '/stats',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    createPictureStore(req)
      .getStatistics()
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
