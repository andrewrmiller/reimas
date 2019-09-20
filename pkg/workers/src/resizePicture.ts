import { IResizePictureMsg, PictureStore } from 'common';
import createDebug from 'debug';

const debug = createDebug('workers:resizePicture');

export function resizePicture(
  message: IResizePictureMsg,
  callback: (ok: boolean) => void
) {
  debug(`Resizing file ${message.fileId} to size ${message.size}.`);
  callback(true);
}
