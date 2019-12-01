import { PictureStore } from 'common';
import createDebug from 'debug';
import { SystemUserId } from './constants';

const debug = createDebug('workers:getLocalFilePath');

/**
 * Uses library ID and file ID in message to open the original
 * file locally.  Note that for some file systems that means
 * downloading the file first.
 *
 * @param libraryId Unique ID of the parent library.
 * @param fileId Unique ID of the file.
 */
export function getLocalFilePath(libraryId: string, fileId: string) {
  const pictureStore = new PictureStore(SystemUserId);
  const isLocalFileSystem = pictureStore.isLocalFileSystem();
  if (isLocalFileSystem) {
    debug('Using path of file in local file system.');
    return pictureStore.getLocalFilePath(libraryId, fileId);
  } else {
    debug('Downloading original file for processing.');
    return pictureStore.downloadTempFile(libraryId, fileId);
  }
}
