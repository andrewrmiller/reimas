import express from 'express';
const router = express.Router();

/* GET library listing. */
router.get(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.send('respond with a resource');
  }
);

router.post(
  '/',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.send(req.body.name);
  }
);

export default router;
