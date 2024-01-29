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
    `Export job ${job.jobId}: Adding ${job.fileIds.length} files from library ${job.libraryId}.`
  );

  const pictureStore = PictureStore.createForSystemOp();
  const zipFilename = buildTempPath({ prefix: 'exp', suffix: `.zip` });

  try {
    await pictureStore.updateExportJob(
      job.libraryId,
      job.jobId,
      ExportJobStatus.Processing
    );

    // Build a map of file name to local file path.  If the files are
    // not stored locally by default, this will download temp copies.
    const fileMap = await getExportFileMap(
      pictureStore,
      job.libraryId,
      job.fileIds
    );

    // Now that we have all the files locally and we have resolved any
    // naming conflicts, create the .zip file.
    try {
      await createExportZip(job.libraryId, job.jobId, fileMap, zipFilename);
    } finally {
      if (!pictureStore.isLocalFileSystem()) {
        await removeTempFiles(fileMap.values());
      }
    }

    // Upload the .zip to the /exports folder and delete the temp file.
    await pictureStore.importZipFile(job.libraryId, job.jobId, zipFilename);
    await fsPromises.unlink(zipFilename);

    await pictureStore.updateExportJob(
      job.libraryId,
      job.jobId,
      ExportJobStatus.Success
    );
    debug(`Export job ${job.jobId}: Job is complete.`);
    return true;
  } catch (err) {
    const message = (err as any).message;
    debug(
      `Export job ${job.jobId}: Error caught while creating zip file: ${message}`
    );
    await pictureStore.updateExportJob(
      job.libraryId,
      job.jobId,
      ExportJobStatus.Failed,
      message
    );
    if (fs.existsSync(zipFilename)) {
      await fsPromises.unlink(zipFilename);
    }
    return false;
  }
}

async function getExportFileMap(
  pictureStore: PictureStore,
  libraryId: string,
  fileIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    for (const fileId of fileIds) {
      const localFile = await getLocalFilePath(libraryId, fileId);
      const file = await pictureStore.getFile(libraryId, fileId);

      // .zip files allow files with the same name to coexist in the .zip
      // but extractors often do bad things when this happens.  Better to
      // use unique names for all pictures being added.
      let suffix = 2;
      const originalName = file.name;
      while (map.has(file.name.toLocaleLowerCase())) {
        file.name = Paths.addFilenameSuffixToPath(originalName, suffix++);
      }

      map.set(file.name.toLocaleLowerCase(), localFile);
    }
  } catch (err) {
    // We weren't able to find or download all the files needed.
    // If the files are not stored locally by default, they were
    // downloaded and need to be cleaned up.
    if (!pictureStore.isLocalFileSystem()) {
      await removeTempFiles(map.values());
      for (const localFile of map.values()) {
        await fsPromises.unlink(localFile);
      }
    }
    throw err;
  }

  return map;
}

async function createExportZip(
  libraryId: string,
  jobId: string,
  fileMap: Map<string, string>,
  zipFileName: string
): Promise<void> {
  debug(
    `Export job ${jobId}: Adding ${fileMap.size} files to .zip ${zipFileName} for library ${libraryId}.`
  );

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });
    output.on('close', resolve);
    archive.on('error', reject);

    for (const filename of fileMap.keys()) {
      archive.file(fileMap.get(filename)!, { name: filename });
    }

    archive.pipe(output);
    archive.finalize();
  });
}

async function removeTempFiles(tempFiles: IterableIterator<string>) {
  for (const tempFile of tempFiles) {
    await fsPromises.unlink(tempFile);
  }
}
