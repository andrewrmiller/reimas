import { LocalFileSystem } from './LocalFileSystem';

export class FileSystemFactory {
  public static createInstance() {
    return new LocalFileSystem();
  }
}
