import createDebug from 'debug';
import { IRecalcFolderMsg, PictureStore } from 'storage';

const debug = createDebug('workers:recalcFolder');

export function recalcFolder(message: IRecalcFolderMsg): Promise<boolean> {
  debug(
    `Recalculating folder ${message.folderId} in library ${message.libraryId}.`
  );

  const pictureStore = PictureStore.createForSystemOp();
  return pictureStore
    .recalcFolder(message.libraryId, message.folderId)
    .then(folder => {
      return true;
    })
    .catch(err => {
      debug(`Error caught while recalculating folder: ${err.message}`);
      return false;
    });
}
