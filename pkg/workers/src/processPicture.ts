import { IFileUpdate, ThumbnailSize } from '@picstrata/client';
import {
  Dates,
  IProcessPictureMsg,
  PictureExtension,
  PictureStore,
  ThumbnailDimensions
} from 'common';
import createDebug from 'debug';
import fs from 'fs';
import jo from 'jpeg-autorotate';
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

      const orientation = metadata.Orientation;
      if (orientation && orientation.startsWith('Rotate')) {
        await autoRotate(
          pictureStore,
          message.libraryId,
          message.fileId,
          localFilePath
        );
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
 * Creates small, medium and large thumbnails from a local picture file.
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
    return pictureStore.getLibrary(libraryId).then(library => {
      const takenOnInstant = Dates.exifDateTimeToInstant(
        metadata.DateTimeOriginal || metadata.CreateDate,
        library.timeZone
      );

      return pictureStore
        .updateFile(libraryId, fileId, {
          rating: metadata.Rating,
          title: metadata.Title,
          comments: metadata.Comment,
          tags: metadata.Keyword,
          takenOn: takenOnInstant ? takenOnInstant.toString() : undefined
        } as IFileUpdate)
        .then(result => {
          debug('File metadata updated successfully');
          return metadata;
        });
    });
  });
}

/**
 * Automatically rotates the picture to the right orientation and pushes
 * the rotated file back into the store.
 *
 * @param pictureStore The PictureStore instance to use.
 * @param libraryId Unique ID of the parent library.
 * @param fileId Unique ID of the file to update.
 * @param localFilePath Local path to the file.
 */
async function autoRotate(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  debug(`Rotating picture ${fileId}`);

  await jo
    .rotate(localFilePath, { quality: 90 })
    .then(result => {
      // Save the rotated file to disk, save it back to the store
      // and make sure the database is updated.
      const rotatedFilePath = buildTempPath({
        prefix: 'rot',
        suffix: `.${PictureExtension.Jpg}`
      });

      return fs.promises.writeFile(rotatedFilePath, result.buffer).then(_ => {
        return pictureStore.updatePicture(
          libraryId,
          fileId,
          rotatedFilePath,
          result.buffer.byteLength,
          result.dimensions.height,
          result.dimensions.width
        );
      });
    })
    .then(file => {
      debug('File auto rotated successfully.');
      return file;
    })
    .catch(err => {
      debug(`Auto rotation failed: ${err.message}`);
      throw err;
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
