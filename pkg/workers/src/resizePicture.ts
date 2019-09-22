import {
  IResizePictureMsg,
  PictureExtension,
  PictureStore,
  ThumbnailDimensions
} from 'common';
import createDebug from 'debug';
import sharp from 'sharp';
import { path } from 'temp';

const debug = createDebug('workers:resizePicture');

export function resizePicture(
  message: IResizePictureMsg,
  callback: (ok: boolean) => void
) {
  debug(`Resizing file ${message.fileId} to size ${message.size}.`);

  // Use library ID and file ID in message to download file to temp
  let getLocalFilePromise;
  if (PictureStore.isLocalFileSystem()) {
    debug('Using path of file in local file system.');
    getLocalFilePromise = PictureStore.getLocalFilePath(
      message.libraryId,
      message.fileId
    );
  } else {
    debug('Downloading original file for resizing.');
    getLocalFilePromise = new Promise<string>((resolve, reject) => {
      resolve('TODO: Download the file to a temporary location');
    });
  }

  getLocalFilePromise
    .then(localFilePath => {
      // Generate a temporary filename for the thumbnail.  Note that thumbnails
      // are always stored as JPEG regardless of the input file format.
      const resizedFilePath = path({
        prefix: message.size,
        suffix: `.${PictureExtension.Jpg}`
      });

      debug(`Resizing '${localFilePath}' to '${resizedFilePath}'`);
      const dims = ThumbnailDimensions[message.size];
      sharp(localFilePath)
        .resize(dims.width, dims.height, { fit: 'inside' })
        .toFile(resizedFilePath, (err, info) => {
          if (err) {
            debug(`Error: Resize error: ${err}`);
            callback(false);
          } else {
            callback(true);
          }
        });

      return null;
    })
    .catch(err => {
      debug(`Error: ${err}`);
      callback(false);
    });
}
