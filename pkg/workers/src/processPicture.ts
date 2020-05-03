import { IFileUpdate, ThumbnailSize } from '@picstrata/client';
import { Dates, PictureExtension, ThumbnailDimensions } from 'common';
import config from 'config';
import createDebug from 'debug';
import fs from 'fs';
import jo from 'jpeg-autorotate';
import fetch from 'node-fetch';
import queryString from 'query-string';
import sharp from 'sharp';
import { IProcessPictureMsg, PictureStore } from 'storage';
import { path as buildTempPath } from 'temp';
import { ExifTool } from './ExifTool';
import { getLocalFilePath } from './getLocalFilePath';

const fsPromises = fs.promises;
const debug = createDebug('workers:processPicture');

export async function processPicture(message: IProcessPictureMsg) {
  debug(
    'Processing picture %s in library %s.',
    message.fileId,
    message.libraryId
  );
  const pictureStore = PictureStore.createForSystemOp();

  const localFilePath = await getLocalFilePath(
    message.libraryId,
    message.fileId
  ).catch(err => {
    debug('Error getting local path for %s: %O', message.fileId, err);
    return null;
  });

  if (localFilePath === null) {
    return false;
  }

  return processLocalPictureFile(
    pictureStore,
    message.libraryId,
    message.fileId,
    localFilePath
  )
    .then(() => {
      return true;
    })
    .catch(err => {
      debug(
        'Error caught while processing picture %s: %O',
        message.fileId,
        err
      );
      return false;
    })
    .finally(() => {
      if (!pictureStore.isLocalFileSystem()) {
        fsPromises.unlink(localFilePath).catch(unlinkErr => {
          debug(
            'Error deleting temporary file for picture %s: %O',
            message.fileId,
            unlinkErr
          );
        });
      }
    });
}

/**
 * Extracts metadata, rotates automatically and generates thumbnails for a
 * local picture file.
 *
 * @param pictureStore PictureStore instance to use.
 * @param libraryId Unique ID of the library where the picture lives.
 * @param fileId Unique ID of the picture file.
 * @param localFilePath Local path to the file.
 */
async function processLocalPictureFile(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  let deleteLocalFile = false;

  const metadata = await updateMetadata(
    pictureStore,
    libraryId,
    fileId,
    localFilePath
  ).catch(err => {
    debug('Error caught while updating metadata for %s: %O', fileId, err);
    throw err;
  });

  const orientation = metadata.Orientation;
  if (orientation && orientation !== 1) {
    localFilePath = await autoRotate(
      pictureStore,
      libraryId,
      fileId,
      localFilePath
    ).catch(err => {
      debug('Error caught while rotating picture %s: %O', fileId, err);
      throw err;
    });

    // A new local file was created containing the rotated picture.
    deleteLocalFile = true;
  }

  return createThumbnails(pictureStore, libraryId, fileId, localFilePath)
    .then(() => {
      return null;
    })
    .catch(err => {
      debug('Error caught while thumbnailing %s: %O', fileId, err);
      throw err;
    })
    .finally(() => {
      if (deleteLocalFile) {
        fsPromises.unlink(localFilePath).catch(unlinkErr => {
          debug(`Error deleting rotation file for %s: %O`, fileId, unlinkErr);
        });
      }
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
  debug('Creating thumbnails for %s stored at %s', fileId, localFilePath);

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
export function updateMetadata(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  return ExifTool.getMetadata(localFilePath).then(metadata => {
    return pictureStore.getLibrary(libraryId).then(async library => {
      // By default we use the time zone of the library when figuring out
      // the date/time of the file.  But if there are GPS coordinates we
      // try to use those coordinates to figure out the actual time zone.
      let timeZone = library.timeZone;
      if (metadata.GPSLatitude && metadata.GPSLongitude) {
        timeZone = await getGpsTimeZone(
          metadata.GPSLatitude,
          metadata.GPSLongitude
        ).catch(err => {
          debug('Error: Failed to determine time zone from GPS coordinates.');
          debug(err.message);
          debug('Using library default time zone instead.');
        });
      }

      // The taken on timestamp could come from one of two places.
      let takenOn = metadata.DateTimeOriginal || metadata.CreateDate;

      // In some files the date may not be set to anything meaningful.
      if (takenOn && takenOn.startsWith('0000')) {
        takenOn = undefined;
      }

      // Convert the EXIF date/time (which includes no time zone info) to
      // an instant using the time zone we selected.
      const takenOnInstant = Dates.exifDateTimeToInstant(takenOn, timeZone);

      return pictureStore
        .updateFile(libraryId, fileId, {
          takenOn: takenOnInstant ? takenOnInstant.toString() : undefined,
          rating: metadata.Rating,
          title: metadata.Title,
          comments: metadata.Comment,
          latitude: metadata.GPSLatitude,
          longitude: metadata.GPSLongitude,
          altitude: metadata.GPSAltitude,
          tags: metadata.Keyword
        } as IFileUpdate)
        .then(result => {
          debug('File metadata updated successfully');
          return metadata;
        });
    });
  });
}

/**
 * Retrieves a time zone value given latitude and longitude.
 *
 * @param latitude Latitude where the picture was taken.
 * @param longitude Longitude where the picture was taken.
 */
async function getGpsTimeZone(latitude: string, longitude: string) {
  const params = {
    key: config.get<string>('TimeZoneDb.apiKey'),
    by: 'position',
    format: 'json',
    lat: latitude,
    lng: longitude
  };

  return fetch(
    `http://api.timezonedb.com/v2.1/get-time-zone?${queryString.stringify(
      params
    )}`
  ).then(response => {
    if (!response.ok) {
      throw new Error(
        `timezonedb.com API call failed with status: ${response.status}`
      );
    }

    return response.json().then(info => {
      debug('GPS coordinates mapped to time zone: %s', info.zoneName);
      return info.zoneName;
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
  debug('Rotating picture %s stored at %s', fileId, localFilePath);

  return jo
    .rotate(localFilePath, { quality: 90 })
    .then(async result => {
      const rotatedFilePath = buildTempPath({
        prefix: 'rot',
        suffix: `.${PictureExtension.Jpg}`
      });

      await fs.promises.writeFile(rotatedFilePath, result.buffer).catch(err => {
        throw err;
      });

      await pictureStore
        .updatePicture(
          libraryId,
          fileId,
          rotatedFilePath,
          result.buffer.byteLength,
          result.dimensions.height,
          result.dimensions.width
        )
        .catch(err => {
          throw err;
        });

      return rotatedFilePath;
    })
    .catch(err => {
      debug('%s auto rotation failed: %O', fileId, err);
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
