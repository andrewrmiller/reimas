import express from 'express';
import { createPictureStore } from './RouterHelpers';

const router = express.Router();

/**
 * Simple health check route.
 */
router.get('/healthcheck', (req: express.Request, res: express.Response) => {
  res.send('Picstrata API service is healthy.');
});

/**
 * Gets statstics for the service.
 */
router.get(
  '/stats',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    createPictureStore(req, true /* allowAnonymous */)
      .getStatistics()
      .then(data => {
        res.send(data);
      })
      .catch(next);
  }
);

export default router;
