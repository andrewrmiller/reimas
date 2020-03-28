import { IFileUpdate, ThumbnailSize } from '@picstrata/client';
import {
  IProcessPictureMsg,
  PictureExtension,
  PictureStore,
  ThumbnailDimensions
} from 'common';
import createDebug from 'debug';
import fs from 'fs';
import sharp from 'sharp';
import { path as buildTempPath } from 'temp';
import { ExifTool } from './ExifTool';
import { getLocalFilePath } from './getLocalFilePath';

const fsPromises = fs.promises;
const debug = createDebug('workers:processPicture');

export function processPicture(
  message: IProcessPictureMsg,
  callback: (ok: boolean) => void
) {
  debug(
    `Processing picture file ${message.fileId} in library ${message.libraryId}.`
  );
  const pictureStore = PictureStore.createForSystemOp();

  return getLocalFilePath(message.libraryId, message.fileId)
    .then(async localFilePath => {
      const metadata = await updateMetadata(
        pictureStore,
        message.libraryId,
        message.fileId,
        localFilePath
      );

      if (metadata.Orientation && metadata.Orientation.startsWith('Rotate')) {
        debug('*** ROTATION NEEDED ***');
      }

      return createThumbnails(
        pictureStore,
        message.libraryId,
        message.fileId,
        localFilePath
      )
        .then(() => {
          // If we downloaded a temporary file, make sure we clean up.
          if (!pictureStore.isLocalFileSystem()) {
            fsPromises.unlink(localFilePath).catch(unlinkErr => {
              debug(`Error deleting temporary file: ${unlinkErr}`);
            });
          }
          callback(true);
          return null;
        })
        .catch(thumbnailError => {
          fs.promises.unlink(localFilePath);
          throw thumbnailError;
        });
    })
    .catch(err => {
      debug(`Error creating thumbnails: %o`, err);
      callback(false);
    });
}

/**
 * Creates small,  medium and large thumbnails from a local picture file.
 *
 * @param libraryId Unique ID of the parent library.
 * @param fileId Unique ID of the file in the library.
 * @param localFilePath Local path to the source file.
 */
export function createThumbnails(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  return createThumbnail(
    pictureStore,
    libraryId,
    fileId,
    localFilePath,
    ThumbnailSize.Small
  )
    .then(() => {
      return createThumbnail(
        pictureStore,
        libraryId,
        fileId,
        localFilePath,
        ThumbnailSize.Medium
      );
    })
    .then(() => {
      return createThumbnail(
        pictureStore,
        libraryId,
        fileId,
        localFilePath,
        ThumbnailSize.Large
      );
    });
}

/**
 * Extracts the metadata from the file using ExifTool and then
 * updates the metadata in the database.
 *
 * NOTE that extracted keywords are stored as tags in the database.
 *
 * @param pictureStore The PictureStore instance to use.
 * @param libraryId Unique ID of the parent library.
 * @param fileId Unique ID of the file to update.
 * @param localFilePath Local path to the file.
 */
function updateMetadata(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  return ExifTool.getMetadata(localFilePath).then(metadata => {
    return pictureStore
      .updateFile(libraryId, fileId, {
        rating: metadata.Rating,
        title: metadata.Title,
        comments: metadata.Comment,
        tags: metadata.Keyword
      } as IFileUpdate)
      .then(result => {
        debug('File metadata updated successfully');
        return metadata;
      });
  });
}

function createThumbnail(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string,
  thumbnailSize: ThumbnailSize
) {
  // Generate a temporary filename for the thumbnail.  Note that thumbnails
  // are always stored as JPEG regardless of the input file format.
  const resizedFilePath = buildTempPath({
    prefix: thumbnailSize,
    suffix: `.${PictureExtension.Jpg}`
  });

  debug(`Resizing '${localFilePath}' to '${resizedFilePath}'`);
  const dims = ThumbnailDimensions[thumbnailSize];
  return sharp(localFilePath)
    .resize(dims.width, dims.height, { fit: 'inside' })
    .toFile(resizedFilePath)
    .then(info => {
      return pictureStore.importThumbnail(
        libraryId,
        fileId,
        thumbnailSize,
        resizedFilePath,
        info.size
      );
    });
}
