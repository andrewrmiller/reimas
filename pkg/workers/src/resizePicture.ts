import {
  IResizePictureMsg,
  PictureExtension,
  PictureStore,
  ThumbnailDimensions
} from 'common';
import createDebug from 'debug';
import fs from 'fs';
import sharp from 'sharp';
import { path as buildTempPath } from 'temp';

const fsPromises = fs.promises;
const debug = createDebug('workers:resizePicture');

export function resizePicture(
  message: IResizePictureMsg,
  callback: (ok: boolean) => void
) {
  debug(`Resizing file ${message.fileId} to size ${message.size}.`);

  // Use library ID and file ID in message to open the original
  // file locally.  Note that for some file systems that means
  // downloading the file first.
  let getLocalFilePromise;
  const isLocalFileSystem = PictureStore.isLocalFileSystem();
  if (isLocalFileSystem) {
    debug('Using path of file in local file system.');
    getLocalFilePromise = PictureStore.getLocalFilePath(
      message.libraryId,
      message.fileId
    );
  } else {
    debug('Downloading original file for resizing.');
    getLocalFilePromise = PictureStore.downloadTempFile(
      message.libraryId,
      message.fileId
    );
  }

  getLocalFilePromise
    .then(localFilePath => {
      // Generate a temporary filename for the thumbnail.  Note that thumbnails
      // are always stored as JPEG regardless of the input file format.
      const resizedFilePath = buildTempPath({
        prefix: message.size,
        suffix: `.${PictureExtension.Jpg}`
      });

      debug(`Resizing '${localFilePath}' to '${resizedFilePath}'`);
      const dims = ThumbnailDimensions[message.size];
      return sharp(localFilePath)
        .resize(dims.width, dims.height, { fit: 'inside' })
        .toFile(resizedFilePath)
        .then(info => {
          return PictureStore.importThumbnail(
            message.libraryId,
            message.fileId,
            message.size,
            resizedFilePath,
            info.size
          ).then(() => {
            // If we downloaded a temporary file, make sure we clean up.
            if (!isLocalFileSystem) {
              fsPromises.unlink(localFilePath).catch(unlinkErr => {
                debug(`Error deleting temporary file: ${unlinkErr}`);
              });
            }
            callback(true);
            return null;
          });
        });
    })
    .catch(err => {
      debug(`Error: ${err}`);
      callback(false);
    });
}
