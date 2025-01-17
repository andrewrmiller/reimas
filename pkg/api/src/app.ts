import { HttpStatusCode } from 'common';
import cookieParser from 'cookie-parser';
import createDebug from 'debug';
import express from 'express';
import createHttpError from 'http-errors';
import logger from 'morgan';
import path from 'path';
import { DbError, DbErrorCode } from 'storage';
import albumRouter from './routers/AlbumRouter';
import exportRouter from './routers/ExportRouter';
import fileRouter from './routers/FileRouter';
import folderRouter from './routers/FolderRouter';
import libraryRouter from './routers/LibraryRouter';
import serviceRouter from './routers/ServiceRouter';
import { PictureStore } from 'storage';

const debug = createDebug('api:app');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/libraries', libraryRouter);
app.use('/libraries', folderRouter);
app.use('/libraries', fileRouter);
app.use('/libraries', albumRouter);
app.use('/libraries', exportRouter);
app.use('/service', serviceRouter);

// Catch all other request here and forward to error handler.
app.use((req, res, next) => {
  next(createHttpError(404));
});

app.use(express.json());

// Top-level error handler.
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    next: express.NextFunction
  ) => {
    let statusCode: number;

    // If this was a database error, try to map the DbErrorCode
    // to a meaningful HttpStatus code.
    if (err instanceof DbError) {
      switch (err.errorCode) {
        case DbErrorCode.ItemNotFound:
          statusCode = HttpStatusCode.NOT_FOUND;
          break;

        case DbErrorCode.DuplicateItemExists:
          statusCode = HttpStatusCode.CONFLICT;
          break;

        case DbErrorCode.ItemTooLarge:
        case DbErrorCode.MaximumSizeExceeded:
        case DbErrorCode.QuotaExceeded:
        case DbErrorCode.InvalidFieldValue:
          statusCode = HttpStatusCode.BAD_REQUEST;
          break;

        case DbErrorCode.NotAuthorized:
          statusCode = HttpStatusCode.UNAUTHORIZED;
          break;

        default:
          statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
      }
    } else {
      statusCode = err.status || HttpStatusCode.INTERNAL_SERVER_ERROR;
    }

    // Set locals, only providing error in development.
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    debug(`ERROR: ${err.message}`);

    // Render the error page.
    res.status(statusCode);
    res.render('error');
  }
);

// There may be files in the database that need processing.
const pictureStore = PictureStore.createForSystemOp();
pictureStore.enqueueProcessFileJobs();

debug('API server ready.');

module.exports = app;
