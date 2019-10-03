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

  public static getLastSubpath(path: string) {
    const index = path.lastIndexOf('/');
    return path.substr(index + 1);
  }

  public static addFilenameSuffix(filename: string, suffix: number) {
    const index = filename.lastIndexOf('.');
    return `${filename.substr(0, index)}${suffix}${filename.substr(index)}`;
  }

  public static addFilenameSuffixToPath(path: string, suffix: number) {
    const subpaths = path.split('/');
    const filename = subpaths.pop()!;
    subpaths.push(Paths.addFilenameSuffix(filename, suffix));
    return subpaths.join('/');
  }

  public static deleteLastSubpath(path: string) {
    const index = path.lastIndexOf('/');
    return index >= 0 ? path.substr(0, index) : '';
  }

  public static changeFileExtension(filename: string, newExtension: string) {
    const index = filename.lastIndexOf('.');
    return filename.substr(0, index + 1) + newExtension;
  }
}
