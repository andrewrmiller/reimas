import {
  IAlbum,
  IAlbumAdd,
  IAlbumUpdate,
  IBreadcrumb,
  IFile,
  IFileAdd,
  IFileUpdate,
  IFolder,
  IFolderAdd,
  IFolderUpdate,
  ILibrary,
  ILibraryAdd,
  ILibraryUpdate,
  IObjectUser,
  IStatistics,
  ObjectType,
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
  IDbAlbum,
  IDbBreadcrumb,
  IDbFile,
  IDbFileContentInfo,
  IDbFolder,
  IDbLibrary
} from './dbModels';
import { MySqlQueryBuilder } from './MySqlQueryBuilder';

const debug = createDebug('storage:database');

const FileBitFields = ['is_video', 'is_processing'];

// See: https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
enum MySqlErrNo {
  ER_SIGNAL_NOT_FOUND = 1643,
  ER_ACCESS_DENIED_ERROR = 1045,
  ER_DUP_KEY = 1022,
  ER_WRONG_VALUE = 1525
}

// We use the logical not sign (&#172, 0xAC) to separate tags.
const TagSeparator = '¬';

const dbConfig = config.get('Database') as IDatabaseConfig;
debug(
  `Connecting to database ${dbConfig.name} on host ${dbConfig.host} as user ${dbConfig.user}.`
);
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
 * MySQL Picstrata database interface.
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

  private static convertDbAlbum(dbAlbum: IDbAlbum) {
    return {
      libraryId: dbAlbum.library_id,
      albumId: dbAlbum.album_id,
      name: dbAlbum.name,
      query: dbAlbum.query ? JSON.parse(dbAlbum.query) : undefined
    } as IAlbum;
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

  public addRoleAssignment(
    userId: string,
    libraryId: string,
    objectType: ObjectType,
    objectId: string,
    newUserId: string,
    role: Role
  ) {
    debug(
      `Adding user ${newUserId} as ${role} to ${objectType} ${objectId} in library ${libraryId}.`
    );
    return this.callChangeProc<IObjectUser>('pst_add_object_user', [
      userId,
      libraryId,
      objectType,
      objectId,
      newUserId,
      role
    ]).then((user: IObjectUser) => {
      return ChangeCase.toCamelObject(user) as IObjectUser;
    });
  }

  // TODO: Implement updateRoleAsignment method

  // TODO: Implement deleteRoleAssignment method

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
      add.parentId
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
      return MySqlDatabase.convertBitFields(
        dbFileContentInfo,
        FileBitFields
      ) as IDbFileContentInfo;
    });
  }

  public addFile(
    userId: string,
    libraryId: string,
    folderId: string,
    fileId: string,
    add: IFileAdd,
    metadataEx?: string
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
      add.isProcessing,
      metadataEx || null
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
      update.cameraMake ? update.cameraMake : dbFile.camera_make,
      update.cameraModel ? update.cameraModel : dbFile.camera_model,
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
      dbFile.camera_make,
      dbFile.camera_model,
      dbFile.latitude,
      dbFile.longitude,
      dbFile.altitude,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return MySqlDatabase.convertDbFile(dbFileUpdated);
    });
  }

  public updateFileThumbnail(
    userId: string,
    libraryId: string,
    fileId: string,
    thumbSize: ThumbnailSize,
    fileSize: number
  ) {
    debug(
      `Updating ${thumbSize} thumbnail on ${fileId} in library ${libraryId}.`
    );
    return this.callChangeProc<IDbFile>('pst_update_file_thumbnail', [
      userId,
      libraryId,
      fileId,
      thumbSize,
      fileSize
    ]).then((dbFileUpdated: IDbFile) => {
      return MySqlDatabase.convertDbFile(dbFileUpdated);
    });
  }

  public updateFileConvertedSize(
    userId: string,
    libraryId: string,
    fileId: string,
    fileSize: number
  ) {
    debug(
      `Updating converted video size on ${fileId} in library ${libraryId}.`
    );
    return this.callChangeProc<IDbFile>('pst_update_file_cnv_size', [
      userId,
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

  public addAlbum(
    userId: string,
    libraryId: string,
    albumId: string,
    add: IAlbumAdd
  ) {
    debug(`Adding a new album ${add.name} to library ${libraryId}.`);

    let where: string | undefined;
    let orderBy: string | undefined;
    if (add.query) {
      where = MySqlQueryBuilder.buildWhereClause(
        connectionPool,
        add.query.criteria
      );
      orderBy = MySqlQueryBuilder.buildOrderByClause(add.query.orderBy);
    }

    return this.callChangeProc<IDbAlbum>('pst_add_album', [
      userId,
      libraryId,
      albumId,
      add.name,
      add.query ? JSON.stringify(add.query) : null,
      where || null,
      orderBy || null
    ]).then((dbAlbum: IDbAlbum) => {
      return MySqlDatabase.convertDbAlbum(dbAlbum);
    });
  }

  public getAlbums(userId: string, libraryId: string) {
    debug(`Retrieving albums in library ${libraryId}.`);
    return this.callSelectManyProc<IDbAlbum>('pst_get_albums', [
      userId,
      libraryId
    ]).then(dbAlbums => {
      return dbAlbums.map(dbAlbum => {
        return MySqlDatabase.convertDbAlbum(dbAlbum);
      });
    });
  }

  public getAlbum(userId: string, libraryId: string, albumId: string) {
    debug(`Retrieving album ${albumId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbAlbum>('pst_get_album', [
      userId,
      libraryId,
      albumId
    ]).then(dbAlbum => {
      return MySqlDatabase.convertDbAlbum(dbAlbum);
    });
  }

  public updateAlbum(
    userId: string,
    libraryId: string,
    albumId: string,
    update: IAlbumUpdate
  ) {
    debug(`Updating album ${albumId} in library ${libraryId}.`);
    return this.callSelectOneProc<IDbAlbum>('pst_get_album', [
      userId,
      libraryId,
      albumId
    ]).then(dbAlbum => {
      let where: string | undefined = dbAlbum.where;
      let orderBy: string | undefined = dbAlbum.order_by;
      if (update.query) {
        where = MySqlQueryBuilder.buildWhereClause(
          connectionPool,
          update.query.criteria
        );
        orderBy = MySqlQueryBuilder.buildOrderByClause(update.query.orderBy);
      }
      return this.callChangeProc<IDbAlbum>('pst_update_album', [
        userId,
        libraryId,
        albumId,
        update.name ? update.name : dbAlbum.name,
        update.query ? JSON.stringify(update.query) : dbAlbum.query,
        where,
        orderBy
      ]).then((updated: IDbAlbum) => {
        return MySqlDatabase.convertDbAlbum(updated);
      });
    });
  }

  public deleteAlbum(userId: string, libraryId: string, albumId: string) {
    debug(`Deleting album ${albumId} in library ${libraryId}.`);
    return this.callChangeProc<IDbAlbum>('pst_delete_album', [
      userId,
      libraryId,
      albumId
    ]).then((dbAlbum: IDbAlbum) => {
      return ChangeCase.toCamelObject(dbAlbum);
    });
  }

  public getAlbumFiles(userId: string, libraryId: string, albumId: string) {
    debug(`Retrieving files in album ${albumId} in library ${libraryId}.`);
    return this.callSelectManyProc<IDbFile>('pst_get_album_files', [
      userId,
      libraryId,
      albumId
    ]).then(dbFiles => {
      return dbFiles.map(MySqlDatabase.convertDbFile);
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
      connectionPool.getConnection((connectError, conn) => {
        if (connectError) {
          reject(this.createDbError(connectError));
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
              reject(this.createDbError(error));
            } else {
              try {
                resolve(results[0] as TResult[]);
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
      connectionPool.getConnection((connectError, conn) => {
        if (connectError) {
          reject(this.createDbError(connectError));
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
              reject(this.createDbError(error));
            } else {
              try {
                const dataResult = results[0];
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
      connectionPool.getConnection((connectError, conn) => {
        if (connectError) {
          reject(this.createDbError(connectError));
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
              reject(this.createDbError(error));
            } else {
              try {
                debug(
                  'callChangeProc: Number of result sets:' + results.length
                );

                // The DML operation was successful.  The result
                // set contains information about the item that was inserted,
                // updated or deleted.
                resolve(results[0][0] as TResult);
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

  private createDbError(error: MysqlError) {
    switch (error.errno) {
      case MySqlErrNo.ER_SIGNAL_NOT_FOUND:
        return new DbError(
          DbErrorCode.ItemNotFound,
          'Item not found',
          error.sqlMessage
        );

      case MySqlErrNo.ER_ACCESS_DENIED_ERROR:
        return new DbError(
          DbErrorCode.NotAuthorized,
          'Access denied.',
          error.sqlMessage
        );

      case MySqlErrNo.ER_DUP_KEY:
        return new DbError(
          DbErrorCode.DuplicateItemExists,
          'Duplicate item exists.',
          error.sqlMessage
        );

      case MySqlErrNo.ER_WRONG_VALUE:
        return new DbError(
          DbErrorCode.InvalidFieldValue,
          'Invalid field value.',
          error.sqlMessage
        );

      default:
        return new DbError(
          DbErrorCode.UnexpectedError,
          `An unexpected error occurred (sqlState: ${error.sqlState}).`,
          `sqlMessage: ${error.sqlMessage} sql: ${error.sql}`
        );
    }
  }
}
