import { VideoExtension } from 'common';
import createDebug from 'debug';
import ffmpeg, { Video } from 'ffmpeg';
import fs from 'fs';
import rimraf from 'rimraf';
import { IProcessVideoMsg, PictureStore } from 'storage';
import { path as buildTempPath } from 'temp';
import { getLocalFilePath } from './getLocalFilePath';
import { createThumbnails, updateMetadata } from './processPicture';

const fsPromises = fs.promises;
const debug = createDebug('workers:processVideo');

export async function processVideo(
  message: IProcessVideoMsg
): Promise<boolean> {
  debug(
    `Processing video file ${message.fileId} in library ${message.libraryId}.`
  );
  const pictureStore = PictureStore.createForSystemOp();

  const localFilePath = await getLocalFilePath(
    message.libraryId,
    message.fileId
  ).catch(err => {
    debug(`Error getting local path for ${message.fileId}: ${err.message}`);
    return null;
  });

  if (localFilePath === null) {
    return false;
  }

  return processLocalVideoFile(pictureStore, message, localFilePath)
    .then(() => {
      return true;
    })
    .catch(err => {
      debug(
        `Error caught while processing video file %s: %O`,
        message.fileId,
        err
      );
      return false;
    })
    .finally(() => {
      if (!pictureStore.isLocalFileSystem()) {
        fsPromises.unlink(localFilePath).catch(unlinkErr => {
          debug(
            'Error deleting temporary file for video %s: %O',
            message.fileId,
            unlinkErr
          );
        });
      }
    });
}

async function processLocalVideoFile(
  pictureStore: PictureStore,
  message: IProcessVideoMsg,
  localFilePath: string
) {
  await updateMetadata(
    pictureStore,
    message.libraryId,
    message.fileId,
    localFilePath
  );

  return new ffmpeg(localFilePath)
    .then(video => {
      return createVideoThumbnails(pictureStore, message, video).then(() => {
        if (message.convertToMp4) {
          return convertToMp4(pictureStore, message, video);
        } else {
          debug(
            'Video %s is already MP4.  No conversion necessary.',
            message.fileId
          );
          return null;
        }
      });
    })
    .finally(() => {
      if (!pictureStore.isLocalFileSystem()) {
        fsPromises.unlink(localFilePath);
      }
    });
}

function createVideoThumbnails(
  pictureStore: PictureStore,
  message: IProcessVideoMsg,
  video: Video
) {
  const tempFrameDir = buildTempPath({
    prefix: `frame`
  });

  debug('Extracting frame from video file into %s.', tempFrameDir);
  return fsPromises.mkdir(tempFrameDir).then(() => {
    return video
      .fnExtractFrameToJPG(tempFrameDir!, {
        start_time: '00:00:02',
        frame_rate: 1,
        number: 1,
        file_name: 'exframe.jpg'
      })
      .then(frameFiles => {
        return createThumbnails(
          pictureStore,
          message.libraryId,
          message.fileId,
          frameFiles[0]
        );
      })
      .finally(() => {
        if (tempFrameDir) {
          rimraf(tempFrameDir, err => {
            if (err) {
              debug('Error cleaning up temporary frame directory: %O', err);
            }
          });
        }
      })
      .catch(err => {
        debug('Error extracting frame from video: %O', err);
        throw err;
      });
  });
}

function convertToMp4(
  pictureStore: PictureStore,
  message: IProcessVideoMsg,
  video: Video
) {
  const mp4Path = buildTempPath({
    suffix: `.${VideoExtension.MP4}`
  });

  debug('Converting video file to MP4 at %s', mp4Path);
  video.setVideoFormat('mp4');
  return video.save(mp4Path).then(mp4File => {
    debug('Importing converted video file %s into library.', mp4File);
    return fsPromises
      .stat(mp4File)
      .then(stats => {
        return pictureStore.importConvertedVideo(
          message.libraryId,
          message.fileId,
          mp4File,
          stats.size
        );
      })
      .catch(err => {
        debug('Error importing converted video: %O', err);
        fsPromises.unlink(mp4File);
        throw err;
      });
  });
}
