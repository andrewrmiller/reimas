import { IRecalcFolderMsg, PictureStore } from 'common';
import createDebug from 'debug';

const debug = createDebug('workers:recalcFolder');

export function recalcFolder(
  message: IRecalcFolderMsg,
  callback: (ok: boolean) => void
) {
  debug(
    `Recalculating folder ${message.folderId} in library ${message.libraryId}.`
  );

  const pictureStore = PictureStore.createForSystemOp();
  return pictureStore
    .recalcFolder(message.libraryId, message.folderId)
    .then(folder => {
      callback(true);
    })
    .catch(err => {
      debug(`Error: ${err}`);
      callback(false);
    });
}
