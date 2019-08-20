/**
 * Utility class to change string case from snake_case to camelCase.
 */
export class ChangeCase {
  /**
   * Change the case of an object's properties from snake case to camel case.
   *
   * @param o The object to convert.
   */
  public static toCamelObject(o: { [key: string]: any }) {
    const newObject: { [key: string]: any } = {};
    Object.keys(o).forEach(k => {
      const newKey = ChangeCase.toCamelString(k);
      newObject[newKey] = o[k];
    });

    return newObject;
  }

  /**
   * Change the case of a string from snake case to camel case.
   * @param s chang
   */
  public static toCamelString(s: string) {
    return s.replace(/([-_][a-z])/gi, $1 => {
      return $1
        .toUpperCase()
        .replace('-', '')
        .replace('_', '');
    });
  }
}
