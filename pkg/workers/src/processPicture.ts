import { IFileUpdate, ThumbnailSize } from '@picstrata/client';
import {
  Dates,
  PictureExtension,
  PictureMimeType,
  ThumbnailDimensions
} from 'common';
import config from 'config';
import createDebug from 'debug';
import fs from 'fs';
import jo, { RotateDimensions } from 'jpeg-autorotate';
import fetch from 'node-fetch';
import queryString from 'query-string';
import sharp from 'sharp';
import { IProcessPictureMsg, PictureStore } from 'storage';
import { path as buildTempPath } from 'temp';
import { ExifTool, IExifResponse } from './ExifTool';
import { getLocalFilePath } from './getLocalFilePath';

const fsPromises = fs.promises;
const debug = createDebug('workers:processPicture');

type ExifResponseKey = keyof IExifResponse;

/**
 * Result returned from the jpeg-autrotate library.
 */
interface IRotateResult {
  buffer: Buffer;
  orientation: number;
  dimensions: RotateDimensions;
  quality: number;
}

export async function processPicture(
  message: IProcessPictureMsg
): Promise<boolean> {
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
    const rotatedFilePath = await autoRotate(
      pictureStore,
      libraryId,
      fileId,
      localFilePath
    ).catch(err => {
      debug('Error caught while rotating picture %s: %O', fileId, err);
      throw err;
    });

    // If we were successful rotating the picture use the rotated
    // picture moving forward and make sure we clean up.  If rotation
    // failed for some reason, rotatedFilePath will be null.  In this
    // case we proceed with the original file.
    if (rotatedFilePath != null) {
      localFilePath = rotatedFilePath;
      deleteLocalFile = true;
    }
  }

  // Tiff files cannot  be rendered by default in most web browsers.  Convert
  // all TIFF files to JPG to work around this limitation.
  if (metadata.MIMEType === PictureMimeType.Tiff) {
    await convertToJpg(pictureStore, libraryId, fileId, localFilePath);
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
  return getMetadata(pictureStore, libraryId, fileId, localFilePath).then(
    metadata => {
      return pictureStore.getLibrary(libraryId).then(async library => {
        // By default we use the time zone of the library when figuring out
        // the date/time of the file.  But if there are GPS coordinates we
        // try to use those coordinates to figure out the actual time zone.
        let gpsTimeZone: string | undefined;
        if (metadata.GPSLatitude && metadata.GPSLongitude) {
          gpsTimeZone = await getGpsTimeZone(
            metadata.GPSLatitude,
            metadata.GPSLongitude
          ).catch(err => {
            debug('Error: Failed to determine time zone from GPS coordinates.');
            debug(err.message);
            debug('Using library default time zone instead.');
          });
        }

        const timeZone = gpsTimeZone || library.timeZone;
        debug(`Time zone: ${timeZone}`);

        // The taken on timestamp could come from one of two places.
        const takenOn = metadata.DateTimeOriginal || metadata.CreateDate;

        // Convert the EXIF date/time (which includes no time zone info) to
        // an instant using the time zone we selected.
        const takenOnInstant = Dates.exifDateTimeToInstant(takenOn, timeZone);

        return pictureStore
          .updateFile(libraryId, fileId, {
            takenOn: takenOnInstant ? takenOnInstant.toString() : undefined,
            rating: metadata.Rating,
            title: metadata.Title || metadata.ImageDescription,
            comments: metadata.Comment,
            cameraMake: metadata.Make,
            cameraModel: metadata.Model,
            latitude: metadata.GPSLatitude,
            longitude: metadata.GPSLongitude,
            altitude: metadata.GPSAltitude,
            tags: metadata.Keyword
          } as IFileUpdate)
          .then(() => {
            debug('File metadata updated successfully');
            return metadata;
          });
      });
    }
  );
}

/**
 * Retrieves the metadata embedded in the file and augments that with any
 * metadata that was provided at the time the file was uploaded.
 *
 * @param pictureStore The PictureStore instance to use.
 * @param libraryId Unique ID of the parent library.
 * @param fileId Unique ID of the file to update.
 * @param localFilePath Local path to the file.
 */
async function getMetadata(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  return ExifTool.getMetadata(localFilePath).then(metadata => {
    return pictureStore
      .getFileMetadataEx(libraryId, fileId)
      .then(metadataExJson => {
        if (metadataExJson) {
          const metadataEx = JSON.parse(metadataExJson);
          for (const [key, value] of Object.entries(metadataEx)) {
            (metadata as { [key: string]: any })[key as ExifResponseKey] =
              value;
          }
        }
        return metadata;
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
 * Returns null if the picture could not be rotated for some reason.  Otherwise
 * returns the path of the rotated file.  In this case the caller is responsible
 * for cleaning up the rotated file.
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

  // Try to autorotate the picture.
  const rotated: IRotateResult | undefined = await jo
    .rotate(localFilePath, { quality: 90 })
    .catch(async rotateErr => {
      debug('Error caught trying to rotate file %s: %O', fileId, rotateErr);
      return undefined;
    });

  // If we don't have rotated data then the auto rotate library
  // failed us.  This can happen if the metadata isn't quite right.
  // Return null which indicates that the file should be used as-is.
  if (rotated === undefined) {
    return null;
  }

  const rotatedFilePath = buildTempPath({
    prefix: 'rot',
    suffix: `.${PictureExtension.Jpg}`
  });

  return fs.promises
    .writeFile(rotatedFilePath, rotated.buffer)
    .then(() => {
      return pictureStore
        .updatePicture(
          libraryId,
          fileId,
          rotatedFilePath,
          rotated!.buffer.byteLength,
          rotated!.dimensions.height,
          rotated!.dimensions.width
        )
        .then(() => {
          return rotatedFilePath;
        });
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

function convertToJpg(
  pictureStore: PictureStore,
  libraryId: string,
  fileId: string,
  localFilePath: string
) {
  const jpgPath = buildTempPath({
    suffix: `.${PictureExtension.Jpg}`
  });

  debug('Converting picture file to JPG at %s', jpgPath);
  return sharp(localFilePath)
    .toFile(jpgPath)
    .then(info => {
      return pictureStore.importConvertedFile(
        libraryId,
        fileId,
        jpgPath,
        info.size
      );
    })
    .catch(err => {
      debug('Error importing converted picture: %O', err);
      fsPromises.unlink(jpgPath);
      throw err;
    });
}
