import {
  IBreadcrumb,
  IFile,
  IFileAdd,
  IFileContentInfo,
  IFileUpdate,
  IFolder,
  IFolderAdd,
  IFolderUpdate,
  IFolderUser,
  ILibrary,
  ILibraryAdd,
  ILibraryUpdate,
  IStatistics,
  Role,
  ThumbnailSize
} from '@picstrata/client';
import { ChangeCase } from 'common';
import config from 'config';
import createDebug from 'debug';
import mysql, {
  Connection,
  FieldInfo,
  MysqlError,
  Query,
  queryCallback
} from 'mysql';
import { IDatabaseConfig } from '../config/IDatabaseConfig';
import { DbError, DbErrorCode } from './DbError';
import {
  IDbBreadcrumb,
  IDbFile,
  IDbFileContentInfo,
  IDbFolder,
  IDbLibrary,
  IDmlResponse
} from './dbModels';

const debug = createDebug('storage:database');

const FileBitFields = ['is_video', 'is_processing'];

// We use the logical not sign (&#172, 0xAC) to separate tags.
const TagSeparator = '¬';

const dbConfig = config.get('Database') as IDatabaseConfig;
const connectionPool = mysql.createPool({
  connectionLimit: 20,
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.name,
  // We store dates using the DATETIME type which has no
  // timezone information in MySQL.  The dates are provided
  // to MySQL in UTC.  When we get them back from the database
  // we don't want any timezone translation to occur so we
  // configure the mysql client with timezone='Z'.
  timezone: 'Z',

  // We use the DECIMAL type to store GPS coordinates.
  supportBigNumbers: true,

  // It would be nice to set bigNumberStrings to true as well so that
  // we don't have to worry about precision loss, but it affects count
  // values as well and we want those to be numbers.
  bigNumberStrings: false
});

/**
 * MySQL Reimas database interface.
 */
export class MySqlDatabase {
  /**
   * Converts an ISO 8601 UTC date time string into a MySql DATETIME literal.
   *
   * @param utcDateTime ISO 8601 date time string to convert.
   */
  private static utcDateTimeToDbDateTime(utcDateTime?: string) {
    if (!utcDateTime) {
      return utcDateTime;
    }

    const dbDateTime = utcDateTime.replace('T', ' ');
    return dbDateTime.substring(0, dbDateTime.length - 1);
  }

  /**
   * Converts a Date returned from the database to an ISO 8601 date.
   *
   * @param dbDateTime Database date to convert.
   */
  private static dbDateTimeToUtcDateTime(dbDateTime?: Date) {
    if (!dbDateTime) {
      return dbDateTime;
    }

    return dbDateTime.toISOString();
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
  private static convertBitFields(
    jsonObject: { [key: string]: any },
    bitFields: string[]
  ) {
    const newObject = {
      ...jsonObject
    };

    for (const bitField of bitFields) {
      const bitFieldValue = jsonObject[bitField];
      if (bitFieldValue) {
        newObject[bitField] = (bitFieldValue.lastIndexOf(1) !== -1) as boolean;
      }
    }

    return newObject;
  }

  /**
   * Decimal values are returned by mysql as strings only when they cannot
   * be accurately represented as a number in Javascript.  Since we value
   * both accuracy and consistency we always want them to be strings.
   *
   * @param decimalValue Decimal column value as returned from mysql.
   */
  private static convertDecimalValue(
    decimalValue: number | string | undefined
  ) {
    return decimalValue ? decimalValue.toString() : undefined;
  }

  /**
   * Converts an IDbFile object into an IFile object.
   */
  private static convertDbFile(dbFile: IDbFile) {
    const tags = dbFile.tags ? dbFile.tags.split(TagSeparator) : [];
    const file = ChangeCase.toCamelObject(
      MySqlDatabase.convertBitFields(dbFile, FileBitFields)
    ) as IFile;

    file.importedOn = MySqlDatabase.dbDateTimeToUtcDateTime(
      dbFile.imported_on
    )!;
    file.modifiedOn = MySqlDatabase.dbDateTimeToUtcDateTime(dbFile.modified_on);
    file.takenOn = MySqlDatabase.dbDateTimeToUtcDateTime(dbFile.taken_on);

    file.latitude = MySqlDatabase.convertDecimalValue(dbFile.latitude);
    file.longitude = MySqlDatabase.convertDecimalValue(dbFile.longitude);
    file.altitude = MySqlDatabase.convertDecimalValue(dbFile.altitude);

    return {
      ...file,
      tags
    } as IFile;
  }

  private config: IDatabaseConfig;

  constructor() {
    this.config = config.get('Database');
  }

  public getStatistics() {
    debug('Retrieving database statistics.');
    return this.callSelectOneProc<IDbLibrary>('pst_get_statistics', []).then(
      stats => {
        return ChangeCase.toCamelObject(stats) as IStatistics;
      }
    );
  }

  public getLibraries(userId: string) {
    debug(`Retrieving all libraries for user ${userId}.`);
    return this.callSelectManyProc<IDbLibrary>('pst_get_libraries', [
      userId
    ]).then(dbLibraries => {
      return dbLibraries.map(dbLibrary => {
        return ChangeCase.toCamelObject(dbLibrary) as ILibrary;
      });
    });
  }

  public getLibrary(userId: string, libraryId: string) {
    debug(`Retrieving library ${libraryId} for user ${userId}.`);
    return this.callSelectOneProc<IDbLibrary>('pst_get_library', [
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
    return this.callChangeProc<IDbLibrary>('pst_add_library', [
      userId,
      newLibrary.libraryId,
      newLibrary.name,
      newLibrary.timeZone,
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
    return this.callSelectOneProc<IDbLibrary>('pst_get_library', [
      userId,
      libraryId
    ]).then(dbLibrary => {
      return this.callChangeProc<IDbLibrary>('pst_update_library', [
        userId,
        libraryId,
        update.name ? update.name : dbLibrary.name,
        update.timeZone ? update.timeZone : dbLibrary.time_zone,
        update.description ? update.description : dbLibrary.description
      ]).then((library: IDbLibrary) => {
        return ChangeCase.toCamelObject(library) as ILibrary;
      });
    });
  }

  public deleteLibrary(userId: string, libraryId: string) {
    debug(`Deleting library ${libraryId} on behalf of user ${userId}.`);
    return this.callChangeProc<IDbLibrary>('pst_delete_library', [
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
    return this.callChangeProc<IFolderUser>('pst_add_folder_user', [
      userId,
      libraryId,
      folderId,
      newUserId,
      role
    ]).then((user: IFolderUser) => {
      return ChangeCase.toCamelObject(user) as IFolderUser;
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
    return this.callSelectManyProc<IDbFolder>('pst_get_folders', [
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
    return this.callSelectOneProc<IDbFolder>('pst_get_folder', [
      userId,
      libraryId,
      folderId
    ]).then(dbFolder => {
      return ChangeCase.toCamelObject(dbFolder) as IFolder;
    });
  }

  public getFolderBreadcrumbs(
    userId: string,
    libraryId: string,
    folderId: string
  ) {
    debug(`Retrieving folder ${folderId} in library ${libraryId}.`);
    return this.callSelectManyProc<IDbBreadcrumb[]>(
      'pst_get_folder_breadcrumbs',
      [userId, libraryId, folderId]
    ).then(dbBreadcrumbs => {
      return dbBreadcrumbs.map(dbBreadcrumb => {
        return ChangeCase.toCamelObject(dbBreadcrumb) as IBreadcrumb;
      });
    });
  }

  public addFolder(
    userId: string,
    libraryId: string,
    folderId: string,
    add: IFolderAdd
  ) {
    debug(`Adding a new folder ${add.name} to library ${libraryId}.`);
    return this.callChangeProc<IDbFolder>('pst_add_folder', [
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
    return this.callSelectOneProc<IDbFolder>('pst_get_folder', [
      userId,
      libraryId,
      folderId
    ]).then(dbFolder => {
      return this.callChangeProc<IDbFolder>('pst_update_folder', [
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
    return this.callChangeProc<IDbFolder>('pst_delete_folder', [
      userId,
      libraryId,
      folderId
    ]).then((folder: IDbFolder) => {
      return ChangeCase.toCamelObject(folder) as IFolder;
    });
  }

  public recalcFolder(libraryId: string, folderId: string) {
    return this.callChangeProc<IDbFolder>('pst_recalc_folder', [
      libraryId,
      folderId
    ]).then((folder: IDbFolder) => {
      return ChangeCase.toCamelObject(folder) as IFolder;
    });
  }

  public getFiles(userId: string, libraryId: string, folderId: string) {
    debug(`Retrieving files in folder ${folderId} in library ${libraryId}.`);
    return this.callSelectManyProc<IDbFile>('pst_get_files', [
      userId,
      libraryId,
      folderId
    ]).then(dbFiles => {
      return dbFiles.map(MySqlDatabase.convertDbFile);
    });
  }

  public getFile(userId: string, libraryId: string, fileId: string) {
    debug(`Retrieving file ${fileId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbFile>('pst_get_file', [
      userId,
      libraryId,
      fileId
    ]).then(dbFile => {
      return MySqlDatabase.convertDbFile(dbFile);
    });
  }

  public getFileContentInfo(userId: string, libraryId: string, fileId: string) {
    debug(
      `Retrieving file content info for ${fileId} in library ${libraryId} for user ${userId}.`
    );
    return this.callSelectOneProc<IDbFileContentInfo>(
      'pst_get_file_content_info',
      [userId, libraryId, fileId]
    ).then(dbFileContentInfo => {
      return ChangeCase.toCamelObject(
        MySqlDatabase.convertBitFields(dbFileContentInfo, FileBitFields)
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
    return this.callChangeProc<IDbFile>('pst_add_file', [
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
      return MySqlDatabase.convertDbFile(file);
    });
  }

  public async updateFile(
    userId: string,
    libraryId: string,
    fileId: string,
    update: IFileUpdate
  ) {
    debug(`Updating file ${fileId} in library ${libraryId}.`);
    const dbFile = await this.callSelectOneProc<IDbFile>('pst_get_file', [
      userId,
      libraryId,
      fileId
    ]).catch(err => {
      throw err;
    });

    // Tags are handled separately from other metadata.
    if (update.tags) {
      debug(`Updating tags on file ${fileId} in library ${libraryId}`);

      // We pass the tags to the database as a delimited string.  Make
      // sure the tags themselves don't contain the delimiter.
      if (update.tags.some(t => t.indexOf(TagSeparator) >= 0)) {
        throw new DbError(
          DbErrorCode.InvalidFieldValue,
          'Invalid character found in tag.'
        );
      }

      await this.callChangeProc<any>('pst_set_file_tags', [
        userId,
        libraryId,
        fileId,
        update.tags.join(TagSeparator)
      ]).catch(err => {
        throw err;
      });
    }

    return this.callChangeProc<IDbFile>('pst_update_file', [
      userId,
      libraryId,
      fileId,
      dbFile.height,
      dbFile.width,
      update.takenOn
        ? MySqlDatabase.utcDateTimeToDbDateTime(update.takenOn)
        : dbFile.taken_on,
      update.name ? update.name : dbFile.name,
      update.rating !== undefined
        ? update.rating === 0
          ? null
          : update.rating
        : dbFile.rating,
      update.title ? update.title : dbFile.title,
      update.comments ? update.comments : dbFile.comments,
      update.latitude ? update.latitude : dbFile.latitude,
      update.longitude ? update.longitude : dbFile.longitude,
      update.altitude ? update.altitude : dbFile.altitude,
      dbFile.file_size
    ]).then((dbFileUpdated: IDbFile) => {
      return MySqlDatabase.convertDbFile(dbFileUpdated);
    });
  }

  public async updateFileDimsAndSize(
    userId: string,
    libraryId: string,
    fileId: string,
    height: number,
    width: number,
    fileSize: number
  ) {
    debug(
      `Updating dimensions and size of file ${fileId} in library ${libraryId}.`
    );
    const dbFile = await this.callSelectOneProc<IDbFile>('pst_get_file', [
      userId,
      libraryId,
      fileId
    ]).catch(err => {
      throw err;
    });

    return this.callChangeProc<IDbFile>('pst_update_file', [
      userId,
      libraryId,
      fileId,
      height,
      width,
      dbFile.taken_on,
      dbFile.name,
      dbFile.rating,
      dbFile.title,
      dbFile.comments,
      dbFile.latitude,
      dbFile.longitude,
      dbFile.altitude,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return MySqlDatabase.convertDbFile(dbFileUpdated);
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
    return this.callChangeProc<IDbFile>('pst_update_file_thumbnail', [
      libraryId,
      fileId,
      thumbSize,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return MySqlDatabase.convertDbFile(dbFileUpdated);
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
    return this.callChangeProc<IDbFile>('pst_update_file_cnv_video', [
      libraryId,
      fileId,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return MySqlDatabase.convertDbFile(dbFileUpdated);
    });
  }

  public deleteFile(userId: string, libraryId: string, fileId: string) {
    debug(`Deleting file ${fileId} in library ${libraryId}.`);
    return this.callChangeProc<IDbFile>('pst_delete_file', [
      userId,
      libraryId,
      fileId
    ]).then((file: IDbFile) => {
      return MySqlDatabase.convertDbFile(file);
    });
  }

  /**
   * Invokes a procedure which selects zero or more items from the database.
   *
   * @param procName Name of the procedure to invoke.
   * @param parameters Parameters to pass to the procedure.
   */
  private callSelectManyProc<TResult>(procName: string, parameters: any[]) {
    const p = new Promise<TResult[]>((resolve, reject) => {
      connectionPool.getConnection((err, conn) => {
        if (err) {
          reject(err);
          return;
        }

        this.invokeStoredProc(
          conn,
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
        conn.release();
      });
    });

    return p;
  }

  /**
   * Invokes a procedure which selects a single item from the database.
   *
   * @param procName Name of the procedure to invoke.
   * @param parameters Parameters to pass to the procedure.
   */
  private callSelectOneProc<TResult>(procName: string, parameters: any[]) {
    const p = new Promise<TResult>((resolve, reject) => {
      connectionPool.getConnection((err, conn) => {
        if (err) {
          reject(err);
          return;
        }

        this.invokeStoredProc(
          conn,
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
        conn.release();
      });
    });

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
    const p = new Promise<TResult>((resolve, reject) => {
      connectionPool.getConnection((err, conn) => {
        if (err) {
          reject(err);
          return;
        }

        this.invokeStoredProc(
          conn,
          procName,
          parameters,
          (error, results, fields) => {
            if (error) {
              debug(
                `callChangeProc: Call to ${procName} failed: ${error.message}`
              );
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
                debug(
                  `callChangeProc: Result processing failed: ${error.message}`
                );
                reject(error);
              }
            }
          }
        );
        conn.release();
      });
    });

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
    conn: Connection,
    procName: string,
    parameters: any[],
    callback?: queryCallback
  ): Query {
    const placeholders = parameters.length
      ? '?' + ',?'.repeat(parameters.length - 1)
      : '';
    return this.query(
      conn,
      `call ${procName}(${placeholders})`,
      parameters,
      callback
    );
  }

  /**
   * Executes a database query.
   *
   * @param conn Database connection to use.
   * @param options Query to execute.
   * @param values Parameter values  to provide to the query.
   * @param callback Function to call with results.
   */
  private query(
    conn: Connection,
    options: string,
    values: any,
    callback?: queryCallback
  ): Query {
    return conn.query(options, values, callback);
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
}
