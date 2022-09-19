import { ExportJobStatus } from '@picstrata/client';
import archiver from 'archiver';
import { Paths } from 'common';
import createDebug from 'debug';
import fs from 'fs';
import { IExportFilesMsg, PictureStore } from 'storage';
import { path as buildTempPath } from 'temp';
import { getLocalFilePath } from './getLocalFilePath';

const debug = createDebug('workers:exportFiles');
const fsPromises = fs.promises;

// This job uses the archiver NodeJS package.  You can find more info here:
// https://github.com/archiverjs/node-archiver.

export async function exportFiles(message: IExportFilesMsg): Promise<boolean> {
  const job = message.exportJob;
  debug(
    `Exporting ${job.fileIds.length} files from library ${job.libraryId} as job ID ${job.jobId}.`
  );

  const pictureStore = PictureStore.createForSystemOp();
  const zipFilename = buildTempPath({ prefix: 'exp', suffix: `.zip` });

  try {
    pictureStore.updateExportJob(
      job.libraryId,
      job.jobId,
      ExportJobStatus.Processing
    );

    await createExportZip(
      pictureStore,
      job.libraryId,
      job.fileIds,
      zipFilename
    );

    // Upload the .zip to the /exports folder and delete the temp file.
    await pictureStore.importZipFile(job.libraryId, job.jobId, zipFilename);
    await fsPromises.unlink(zipFilename);

    pictureStore.updateExportJob(
      job.libraryId,
      job.jobId,
      ExportJobStatus.Success
    );
    debug(`Export job ${job.jobId} complete.`);
    return true;
  } catch (err) {
    const message = (err as any).message;
    pictureStore.updateExportJob(
      job.libraryId,
      job.jobId,
      ExportJobStatus.Failed,
      message
    );
    debug(`Error caught while creating zip file: ${message}`);
    await fsPromises.unlink(zipFilename);
    return false;
  }
}

async function createExportZip(
  pictureStore: PictureStore,
  libraryId: string,
  fileIds: string[],
  zipFileName: string
): Promise<void> {
  /* eslint-disable no-async-promise-executor */
  return new Promise(async (resolve, reject) => {
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });
    output.on('close', resolve);
    archive.on('error', reject);

    const fileSet = new Set();
    for (const fileId of fileIds) {
      const localFile = await getLocalFilePath(libraryId, fileId);
      try {
        const file = await pictureStore.getFile(libraryId, fileId);

        // .zip files allow files with the same name to coexist in the .zip
        // but extractors often do bad things when this happens.  Better to
        // use unique names for all pictures being added.
        let suffix = 2;
        const originalName = file.name;
        while (fileSet.has(file.name.toLocaleLowerCase())) {
          file.name = Paths.addFilenameSuffixToPath(originalName, suffix++);
        }

        archive.file(localFile, { name: file.name });
        fileSet.add(file.name.toLocaleLowerCase());
      } finally {
        if (!pictureStore.isLocalFileSystem()) {
          fsPromises.unlink(localFile);
        }
      }
    }

    archive.pipe(output);
    archive.finalize();
  });
}
