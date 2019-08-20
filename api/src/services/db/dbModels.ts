import { DbErrorCode } from './DbError';

/**
 * Structure of the first result set returned from DML
 * procedures.  Provides information on the success or
 * failure of the DML operation.
 */
export interface IDmlResponse {
  err_code: DbErrorCode;
  err_context: string;
}

/**
 * Structure of a library as represented in the database.
 */
export interface IDbLibrary {
  library_id: number;
  name: string;
  description: string;
  url: string;
}
