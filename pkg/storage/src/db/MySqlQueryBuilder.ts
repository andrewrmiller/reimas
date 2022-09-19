import {
  FileAttribute,
  IFileCriterion,
  IFileOrderBy,
  Operator
} from '@picstrata/client';

import { EscapeFunctions } from 'mysql';

export class MySqlQueryBuilder {
  public static buildWhereClause(
    escapeFunctions: EscapeFunctions,
    criteria?: IFileCriterion[]
  ) {
    if (!criteria) {
      return undefined;
    }

    const clauses = criteria.map(c => {
      switch (c.attribute) {
        case FileAttribute.ParentFolderId:
          return MySqlQueryBuilder.buildParentFolderCriterion(c);

        case FileAttribute.Filename:
          return MySqlQueryBuilder.buildStringCriterion(
            escapeFunctions,
            c,
            'f.name'
          );

        case FileAttribute.Rating:
          return MySqlQueryBuilder.buildNumberCriterion(c, 'f.rating');

        case FileAttribute.IsVideo:
          return MySqlQueryBuilder.buildNumberCriterion(c, 'f.is_video');

        default:
          throw new Error(`Invalid criteria attribute: ${c.attribute}`);
      }
    });

    return clauses.join(' AND ');
  }

  public static buildOrderByClause(orderBy?: IFileOrderBy[]) {
    if (!orderBy) {
      return undefined;
    }

    const clauses = orderBy.map(o => {
      switch (o.attribute) {
        case FileAttribute.Filename:
          return 'name ' + o.direction;

        case FileAttribute.TakenOn:
          return 'taken_on ' + o.direction;

        default:
          throw new Error(`Invalid order by attribute: ${o.attribute}`);
      }
    });

    return clauses.join(', ');
  }

  private static buildStringCriterion(
    escapeFunctions: EscapeFunctions,
    criterion: IFileCriterion,
    columnName: string
  ) {
    switch (criterion.operator) {
      case Operator.Equals:
        return `${columnName} = '${criterion.value as string}'`;

      case Operator.NotEquals:
        return `${columnName} <> '${criterion.value as string}'`;

      case Operator.Contains:
        return `${columnName} LIKE '%${criterion.value as string}%'`;

      case Operator.OneOf:
      case Operator.NotOneOf: {
        const values = (criterion.value as string[]).map(v =>
          escapeFunctions.escape(v)
        );
        const func = criterion.operator === Operator.OneOf ? 'IN' : 'NOT IN';
        return `${columnName} ${func} [${values.join(',')}]`;
      }

      default:
        throw new Error(
          `Invalid operator ${criterion.operator} for attribute ${criterion.attribute}`
        );
    }
  }

  private static buildNumberCriterion(
    criterion: IFileCriterion,
    columnName: string
  ) {
    let comparison = '';
    switch (criterion.operator) {
      case Operator.Equals:
        comparison = ' = ';
        break;

      case Operator.NotEquals:
        comparison = ' <> ';
        break;

      case Operator.LessThan:
        comparison = '<';
        break;

      case Operator.LessThanOrEquals:
        comparison = '<';
        break;

      case Operator.GreaterThan:
        comparison = '>';
        break;

      case Operator.GreaterThanOrEquals:
        comparison = '>=';
        break;

      default:
        throw new Error(
          `Invalid operator ${criterion.operator} for attribute ${criterion.attribute}`
        );
    }

    return `${columnName} ${comparison} ${criterion.value as number}`;
  }

  private static buildParentFolderCriterion(criterion: IFileCriterion) {
    switch (criterion.operator) {
      case Operator.Equals:
        return this.buildParentFolderIdHelper(criterion.value as string);
      case Operator.OneOf: {
        const criteria = (criterion.value as string[]).map(v =>
          MySqlQueryBuilder.buildParentFolderIdHelper(v)
        );
        return `(${criteria.join(' OR ')})`;
      }
      default:
        throw new Error(
          `Invalid operator ${criterion.operator} for attribute ${criterion.attribute}`
        );
    }
  }

  /**
   * Builds a predicate that retrieves all of the folders that match the
   * provided folder ID or are children of the provided folder.
   *
   * @param parentFolderId Unique ID of the parent folder.
   */
  private static buildParentFolderIdHelper(parentFolderId: string) {
    const folderId = `pst_compress_guid('${parentFolderId}')`;
    const selectParentFolderPath =
      `SELECT CONCAT(pf.path, '%') FROM pst_folders pf ` +
      `WHERE pf.library_id = f.library_id AND pf.folder_id = ${folderId}`;
    return `fo.path LIKE (${selectParentFolderPath})`;
  }
}
