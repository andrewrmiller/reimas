import { IProcessVideoMsg, PictureStore, VideoExtension } from 'common';
import createDebug from 'debug';
import ffmpeg, { Video } from 'ffmpeg';
import fs from 'fs';
import rimraf from 'rimraf';
import { path as buildTempPath } from 'temp';
import { getLocalFilePath } from './getLocalFilePath';
import { createThumbnails, updateMetadata } from './processPicture';

const fsPromises = fs.promises;
const debug = createDebug('workers:processVideo');

export function processVideo(
  message: IProcessVideoMsg,
  callback: (ok: boolean) => void
) {
  debug(
    `Processing video file ${message.fileId} in library ${message.libraryId}.`
  );
  const pictureStore = PictureStore.createForSystemOp();

  return getLocalFilePath(message.libraryId, message.fileId)
    .then(async localFilePath => {
      await updateMetadata(
        pictureStore,
        message.libraryId,
        message.fileId,
        localFilePath
      );

      return new ffmpeg(localFilePath)
        .then(video => {
          return createVideoThumbnails(pictureStore, message, video).then(
            () => {
              if (message.convertToMp4) {
                return convertToMp4(pictureStore, message, video);
              } else {
                debug(
                  `Video ${message.fileId} is already MP4.  No conversion necessary.`
                );
                return null;
              }
            }
          );
        })
        .finally(() => {
          if (!pictureStore.isLocalFileSystem()) {
            fsPromises.unlink(localFilePath);
          }
        });
    })
    .then(() => {
      callback(true);
    })
    .catch(err => {
      debug(`Error processing video: %o`, err);
      callback(false);
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

  debug(`Extracting frame from video file into ${tempFrameDir}.`);
  return fsPromises.mkdir(tempFrameDir).then(() => {
    return video
      .fnExtractFrameToJPG(tempFrameDir!, {
        start_time: '00:00:02',
        frame_rate: 1,
        number: 1,
        file_name: 'exframe.jpg'
      })
      .then(frameFiles => {
        debug(`Creating thumbnails from frame file ${frameFiles[0]}.`);
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
              debug(`Error cleaning up temporary frame directory: %o`, err);
            }
          });
        }
      })
      .catch(err => {
        debug('Error extracting frame from video: %o', err);
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

  debug(`Converting video file to MP4 at '${mp4Path}'`);
  video.setVideoFormat('mp4');
  return video.save(mp4Path).then(mp4File => {
    debug(`Importing converted video file '${mp4File}' into library.`);
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
        debug(`Error importing converted video: %o`, err);
        fsPromises.unlink(mp4File);
        throw err;
      });
  });
}
