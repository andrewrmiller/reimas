import {
  IFile,
  IFileAdd,
  IFileContentInfo,
  IFileUpdate,
  IFolder,
  IFolderAdd,
  IFolderUpdate,
  ILibrary,
  ILibraryAdd,
  ILibraryUpdate,
  IStatistics,
  Role,
  ThumbnailSize
} from '@picstrata/client';
import config from 'config';
import createDebug from 'debug';
import mysql, { FieldInfo, MysqlError, Query, queryCallback } from 'mysql';
import { ChangeCase } from '../../ChangeCase';
import { IDatabaseConfig } from '../../IDatabaseConfig';
import { DbError, DbErrorCode } from './DbError';
import {
  IDbFile,
  IDbFileContentInfo,
  IDbFolder,
  IDbLibrary,
  IDmlResponse
} from './dbModels';

const debug = createDebug('storage:database');

const FileBitFields = ['is_video', 'is_processing'];

/**
 * MySQL Reimas database interface.
 */
export class MySqlDatabase {
  private config: IDatabaseConfig;
  private conn?: mysql.Connection;

  constructor() {
    this.config = config.get('Database');
  }

  /**
   * Connects to the database using configuration information.
   */
  public connect() {
    debug(
      `Connecting to MySQL database ${this.config.name} on host ${this.config.host}.`
    );
    this.conn = mysql.createConnection({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.name,
      // We store dates using the DATETIME type which has no
      // timezone information in MySQL.  The dates are provided
      // to MySQL in UTC.  When we get them back from the database
      // we don't want any timezone translation to occur so we
      // configure the mysql client with timezone='Z'.
      timezone: 'Z'
    });

    this.conn.connect();
  }

  /**
   * Disconnects from the database.
   */
  public disconnect() {
    this.conn!.end();
  }

  public getStatistics() {
    debug('Retrieving database statistics.');
    return this.callSelectOneProc<IDbLibrary>('get_statistics', []).then(
      stats => {
        return ChangeCase.toCamelObject(stats) as IStatistics;
      }
    );
  }

  public getLibraries(userId: string) {
    debug(`Retrieving all libraries for user ${userId}.`);
    return this.callSelectManyProc<IDbLibrary>('get_libraries', [userId]).then(
      dbLibraries => {
        return dbLibraries.map(dbLibrary => {
          return ChangeCase.toCamelObject(dbLibrary) as ILibrary;
        });
      }
    );
  }

  public getLibrary(userId: string, libraryId: string) {
    debug(`Retrieving library ${libraryId} for user ${userId}.`);
    return this.callSelectOneProc<IDbLibrary>('get_library', [
      userId,
      libraryId
    ]).then(dbLibrary => {
      return ChangeCase.toCamelObject(dbLibrary) as ILibrary;
    });
  }

  public addLibrary(userId: string, newLibrary: ILibraryAdd) {
    debug(
      `Adding a new library: ${newLibrary.name} on behalf of user ${userId}`
    );
    return this.callChangeProc<IDbLibrary>('add_library', [
      userId,
      newLibrary.libraryId,
      newLibrary.name,
      newLibrary.description ? newLibrary.description : null
    ]).then((library: IDbLibrary) => {
      return ChangeCase.toCamelObject(library) as ILibrary;
    });
  }

  public updateLibrary(
    userId: string,
    libraryId: string,
    update: ILibraryUpdate
  ) {
    debug(
      `Updating existing library ${libraryId} on behalf of user ${userId}.`
    );
    return this.callSelectOneProc<IDbLibrary>('get_library', [
      userId,
      libraryId
    ]).then(dbLibrary => {
      return this.callChangeProc<IDbLibrary>('update_library', [
        userId,
        libraryId,
        update.name ? update.name : dbLibrary.name,
        update.description ? update.description : dbLibrary.description
      ]).then((library: IDbLibrary) => {
        return ChangeCase.toCamelObject(library) as ILibrary;
      });
    });
  }

  public deleteLibrary(userId: string, libraryId: string) {
    debug(`Deleting library ${libraryId} on behalf of user ${userId}.`);
    return this.callChangeProc<IDbLibrary>('delete_library', [
      userId,
      libraryId
    ]).then((library: IDbLibrary) => {
      return ChangeCase.toCamelObject(library) as ILibrary;
    });
  }

  public addFolderUser(
    userId: string,
    libraryId: string,
    folderId: string | null,
    newUserId: string,
    role: Role
  ) {
    debug(
      `Adding user ${newUserId} to library ${libraryId} with role ${role} on folder ${folderId}.`
    );
    return this.callChangeProc<IDbLibrary>('add_folder_user', [
      userId,
      libraryId,
      folderId,
      newUserId,
      role
    ]).then((library: IDbLibrary) => {
      return ChangeCase.toCamelObject(library) as ILibrary;
    });
  }

  // TODO: Implement updateFolderUser method

  // TODO: Implement deleteFolderUser method

  public getFolders(
    userId: string,
    libraryId: string,
    parentFolderId: string | null
  ) {
    debug(
      `Retrieving folders in library ${libraryId} with parent=${parentFolderId}.`
    );
    return this.callSelectManyProc<IDbFolder>('get_folders', [
      userId,
      libraryId,
      parentFolderId
    ]).then(dbFolders => {
      return dbFolders.map(dbFolder => {
        return ChangeCase.toCamelObject(dbFolder) as IFolder;
      });
    });
  }

  public getFolder(userId: string, libraryId: string, folderId: string) {
    debug(`Retrieving folder ${folderId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbFolder>('get_folder', [
      userId,
      libraryId,
      folderId
    ]).then(dbFolder => {
      return ChangeCase.toCamelObject(dbFolder) as IFolder;
    });
  }

  public addFolder(
    userId: string,
    libraryId: string,
    folderId: string,
    add: IFolderAdd
  ) {
    debug(`Adding a new folder ${add.name} to library ${libraryId}.`);
    return this.callChangeProc<IDbFolder>('add_folder', [
      userId,
      libraryId,
      folderId,
      add.name,
      add.parentId,
      add.type
    ]).then((folder: IDbFolder) => {
      return ChangeCase.toCamelObject(folder) as IFolder;
    });
  }

  public updateFolder(
    userId: string,
    libraryId: string,
    folderId: string,
    update: IFolderUpdate
  ) {
    debug(`Updating folder ${folderId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbFolder>('get_folder', [
      userId,
      libraryId,
      folderId
    ]).then(dbFolder => {
      return this.callChangeProc<IDbFolder>('update_folder', [
        userId,
        libraryId,
        folderId,
        update.name ? update.name : dbFolder.name
      ]).then((folder: IDbFolder) => {
        return ChangeCase.toCamelObject(folder) as IFolder;
      });
    });
  }

  public deleteFolder(userId: string, libraryId: string, folderId: string) {
    debug(`Deleting folder ${folderId} in library ${libraryId}.`);
    return this.callChangeProc<IDbFolder>('delete_folder', [
      userId,
      libraryId,
      folderId
    ]).then((folder: IDbFolder) => {
      return ChangeCase.toCamelObject(folder) as IFolder;
    });
  }

  public recalcFolder(libraryId: string, folderId: string) {
    return this.callChangeProc<IDbFolder>('recalc_folder', [
      libraryId,
      folderId
    ]).then((folder: IDbFolder) => {
      return ChangeCase.toCamelObject(folder) as IFolder;
    });
  }

  public getFiles(userId: string, libraryId: string, folderId: string) {
    debug(`Retrieving files in folder ${folderId} in library ${libraryId}.`);
    return this.callSelectManyProc<IDbFile>('get_files', [
      userId,
      libraryId,
      folderId
    ]).then(dbFiles => {
      return dbFiles.map(dbFile => {
        return ChangeCase.toCamelObject(
          this.convertBitFields(dbFile, FileBitFields)
        ) as IFile;
      });
    });
  }

  public getFile(userId: string, libraryId: string, fileId: string) {
    debug(`Retrieving file ${fileId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbFile>('get_file', [
      userId,
      libraryId,
      fileId
    ]).then(dbFile => {
      return ChangeCase.toCamelObject(
        this.convertBitFields(dbFile, FileBitFields)
      ) as IFile;
    });
  }

  public getFileContentInfo(userId: string, libraryId: string, fileId: string) {
    debug(
      `Retrieving file content info for ${fileId} in library ${libraryId} for user ${userId}.`
    );
    return this.callSelectOneProc<IDbFileContentInfo>('get_file_content_info', [
      userId,
      libraryId,
      fileId
    ]).then(dbFileContentInfo => {
      return ChangeCase.toCamelObject(
        this.convertBitFields(dbFileContentInfo, FileBitFields)
      ) as IFileContentInfo;
    });
  }

  public addFile(
    userId: string,
    libraryId: string,
    folderId: string,
    fileId: string,
    add: IFileAdd
  ) {
    debug(`Adding a new file ${add.name} to library ${libraryId}.`);
    return this.callChangeProc<IDbFile>('add_file', [
      userId,
      libraryId,
      folderId,
      fileId,
      add.name,
      add.mimeType,
      add.isVideo,
      add.height,
      add.width,
      add.fileSize,
      add.isProcessing
    ]).then((file: IDbFile) => {
      return ChangeCase.toCamelObject(
        this.convertBitFields(file, FileBitFields)
      ) as IFile;
    });
  }

  public updateFile(
    userId: string,
    libraryId: string,
    fileId: string,
    update: IFileUpdate
  ) {
    debug(`Updating file ${fileId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbFile>('get_file', [
      userId,
      libraryId,
      fileId
    ]).then(dbFile => {
      return this.callChangeProc<IDbFile>('update_file', [
        userId,
        libraryId,
        fileId,
        update.name ? update.name : dbFile.name,
        update.rating ? update.rating : dbFile.rating,
        update.title ? update.title : dbFile.title,
        update.subject ? update.subject : dbFile.subject
      ]).then((dbFileUpdated: IDbFile) => {
        return ChangeCase.toCamelObject(
          this.convertBitFields(dbFileUpdated, FileBitFields)
        ) as IFile;
      });
    });
  }

  public updateFileThumbnail(
    libraryId: string,
    fileId: string,
    thumbSize: ThumbnailSize,
    fileSize: number
  ) {
    debug(
      `Updating ${thumbSize} thumbnail on ${fileId} in library ${libraryId}.`
    );
    return this.callChangeProc<IDbFile>('update_file_thumbnail', [
      libraryId,
      fileId,
      thumbSize,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return ChangeCase.toCamelObject(
        this.convertBitFields(dbFileUpdated, FileBitFields)
      ) as IFile;
    });
  }

  public updateFileConvertedVideo(
    libraryId: string,
    fileId: string,
    fileSize: number
  ) {
    debug(
      `Updating converted video size on ${fileId} in library ${libraryId}.`
    );
    return this.callChangeProc<IDbFile>('update_file_cnv_video', [
      libraryId,
      fileId,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return ChangeCase.toCamelObject(
        this.convertBitFields(dbFileUpdated, FileBitFields)
      ) as IFile;
    });
  }

  public deleteFile(userId: string, libraryId: string, fileId: string) {
    debug(`Deleting file ${fileId} in library ${libraryId}.`);
    return this.callChangeProc<IDbFile>('delete_file', [
      userId,
      libraryId,
      fileId
    ]).then((file: IDbFile) => {
      return ChangeCase.toCamelObject(file) as IFile;
    });
  }

  /**
   * Invokes a procedure which selects zero or more items from the database.
   *
   * @param procName Name of the procedure to invoke.
   * @param parameters Parameters to pass to the procedure.
   */
  private callSelectManyProc<TResult>(procName: string, parameters: any[]) {
    this.connect();

    const p = new Promise<TResult[]>((resolve, reject) => {
      this.invokeStoredProc(
        procName,
        parameters,
        (error: MysqlError | null, results: any, fields?: FieldInfo[]) => {
          if (error) {
            debug(
              `callSelectManyProc: Call to ${procName} failed: ${error.message}`
            );
            reject(error);
          } else {
            try {
              debug('Number of result sets:' + results.length);

              // The first one-row result set contains success/failure
              // information.  If the select operation failed (e.g. due
              // to insufficient permissions) then the promise is rejected.
              const result = results[0][0] as IDmlResponse;
              if (result.err_code !== DbErrorCode.NoError) {
                debug(
                  `callSelectManyProc: Call to ${procName} failed with err_code: ${result.err_code}`
                );
                debug(`and err_context: ${result.err_context}`);
                reject(this.createDbError(result));
              }

              // The second result set contains the selected items.
              resolve(results[1] as TResult[]);
            } catch (error) {
              debug(
                `callSelectManyProc: Result processing failed: ${error.message}`
              );
              reject(error);
            }
          }
        }
      );
    });

    this.disconnect();
    return p;
  }

  /**
   * Invokes a procedure which selects a single item from the database.
   *
   * @param procName Name of the procedure to invoke.
   * @param parameters Parameters to pass to the procedure.
   */
  private callSelectOneProc<TResult>(procName: string, parameters: any[]) {
    this.connect();

    const p = new Promise<TResult>((resolve, reject) => {
      this.invokeStoredProc(
        procName,
        parameters,
        (error: MysqlError | null, results: any, fields?: FieldInfo[]) => {
          if (error) {
            debug(
              `callSelectOneProc: Call to ${procName} failed: ${error.message}`
            );
            reject(error);
          } else {
            try {
              debug('Number of result sets:' + results.length);

              // The first one-row result set contains success/failure
              // information.  If the select operation failed (e.g. due
              // to insufficient permissions) then the promise is rejected.
              const result = results[0][0] as IDmlResponse;
              if (result.err_code !== DbErrorCode.NoError) {
                debug(
                  `callSelectOneProc: Call to ${procName} failed with err_code: ${result.err_code}`
                );
                debug(`and err_context: ${result.err_context}`);
                reject(this.createDbError(result));
              }

              // The second result set contains the selected item.
              const dataResult = results[1];
              if (dataResult.length === 0) {
                reject(
                  new DbError(DbErrorCode.ItemNotFound, 'Item not found.')
                );
              } else {
                resolve(dataResult[0] as TResult);
              }
            } catch (error) {
              debug(
                `callSelectOneProc: Result processing failed: ${error.message}`
              );
              reject(error);
            }
          }
        }
      );
    });

    this.disconnect();
    return p;
  }

  /**
   * Invokes a procedure which changes data in the database.
   *
   * All DML procedures return two one-row result sets:
   *     1) Operation result including err_code and err_context.
   *     2) The data for the element that was added, updated or deleted.
   *
   * @param procName Name of the stored procedure to execute.
   * @param parameters Parameters to provide to the procedure.
   */
  private callChangeProc<TResult>(procName: string, parameters: any[]) {
    this.connect();

    const p = new Promise<TResult>((resolve, reject) => {
      this.invokeStoredProc(procName, parameters, (error, results, fields) => {
        if (error) {
          debug(`callChangeProc: Call to ${procName} failed: ${error.message}`);
          reject(error);
        } else {
          try {
            debug('Number of result sets:' + results.length);

            // The first one-row result set contains success/failure
            // information.  If the DML operation failed then the
            // promise is rejected.
            const result = results[0][0] as IDmlResponse;
            if (result.err_code !== DbErrorCode.NoError) {
              debug(
                `callChangeProc: Call to ${procName} failed with err_code: ${result.err_code}`
              );
              debug(`and err_context: ${result.err_context}`);
              reject(this.createDbError(result));
            }

            // The DML operation was successful.  The second one-row result
            // set contains information about the item that was inserted,
            // updated or deleted.
            resolve(results[1][0] as TResult);
          } catch (error) {
            debug(`callChangeProc: Result processing failed: ${error.message}`);
            reject(error);
          }
        }
      });
    });

    this.disconnect();
    return p;
  }

  /**
   * Executes a stored procedure.
   *
   * @param procName Name of the procedure to execute.
   * @param parameters Parameters to pass to the procedure.
   * @param callback Function to call with the results.
   */
  private invokeStoredProc(
    procName: string,
    parameters: any[],
    callback?: queryCallback
  ): Query {
    const placeholders = parameters.length
      ? '?' + ',?'.repeat(parameters.length - 1)
      : '';
    return this.query(
      `call ${procName}(${placeholders})`,
      parameters,
      callback
    );
  }

  /**
   * Executes a database query.
   *
   * @param options Query to execute.
   * @param values Parameter values  to provide to the query.
   * @param callback Function to call with results.
   */
  private query(options: string, values: any, callback?: queryCallback): Query {
    return this.conn!.query(options, values, callback);
  }

  /**
   * Creates a new DbError from a DML response.
   *
   * @param response The DML response to convert.
   */
  private createDbError(response: IDmlResponse) {
    let errorMessage: string;
    switch (response.err_code) {
      case DbErrorCode.ItemNotFound:
        errorMessage = 'Item not found.';
        break;

      case DbErrorCode.DuplicateItemExists:
        errorMessage = 'Duplicate item already exists.';
        break;

      case DbErrorCode.QuotaExceeded:
        errorMessage = 'Quote has been exceeded.';
        break;

      case DbErrorCode.MaximumSizeExceeded:
        errorMessage = 'The maximum size has been exceeded.';
        break;

      case DbErrorCode.ItemTooLarge:
        errorMessage = 'Item is too large.';
        break;

      case DbErrorCode.ItemIsExpired:
        errorMessage = 'Item is expired.';
        break;

      case DbErrorCode.ItemAlreadyProcessed:
        errorMessage = 'Item has already been processed.';
        break;

      case DbErrorCode.InvalidFieldValue:
        errorMessage = 'Invalid field value.';
        break;

      case DbErrorCode.NotAuthorized:
        errorMessage = 'Not authorized';
        break;

      case DbErrorCode.UnexpectedError:
      default:
        errorMessage = `An unexpected error occurred (Error Code: ${response.err_code}).`;
        break;
    }

    return new DbError(response.err_code, errorMessage, response.err_context);
  }

  /**
   * Converts the object returned for MySQL bit fields into a
   * more consumable boolean.
   *
   * https://stackoverflow.com/questions/34414659
   *
   * @param jsonObject JSON object returned from MySQL.
   * @param bitFields Names of the bit fields to convert.
   */
  private convertBitFields(
    jsonObject: { [key: string]: any },
    bitFields: string[]
  ) {
    const newObject = {
      ...jsonObject
    };

    for (const bitField of bitFields) {
      newObject[bitField] = (jsonObject[bitField].lastIndexOf(1) !==
        -1) as boolean;
    }

    return newObject;
  }
}
