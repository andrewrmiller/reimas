/**
 * Utility class for working with file system paths.
 */
export class Paths {
  public static replaceLastSubpath(path: string, lastSubpath: string) {
    const subpaths = path.split('/');
    subpaths.pop();
    subpaths.push(lastSubpath);
    return subpaths.join('/');
  }
}
