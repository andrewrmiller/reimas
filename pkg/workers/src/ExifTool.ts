import * as child_process from 'child_process';
import * as fs from 'fs';
import * as util from 'util';
const stat = util.promisify(fs.stat);

export interface IExifResponse {
  SourceFile: string;
  ExifToolVersion: number;
  FileName: string;
  Directory: string;
  FileSize: string;
  FileModifyDate: string;
  FileAccessDate: string;
  FileInodeChangeDate: string;
  FilePermissions: string;
  FileType: string;
  FileTypeExtension: string;
  MIMEType: string;
  MajorBrand?: string;
  MinorVersion?: string;
  CompatibleBrands?: string;
  MovieHeaderVersion?: number;
  DateTimeOriginal?: string;
  CreateDate?: string;
  ModifyDate?: string;
  TimeScale?: number;
  EBMLVersion?: number;
  EBMLReadVersion?: number;
  DocType?: string;
  DocTypeVersion?: number;
  DocTypeReadVersion?: number;
  TimecodeScale?: string;
  MuxingApp?: string;
  WritingApp?: string;
  Duration: string;
  CodecID: string;
  VideoFrameRate: number;
  ImageWidth: number;
  ImageHeight: number;
  CompressorID?: string;
  VideoScanType: string;
  TrackNumber: number;
  TrackLanguage: string;
  VideoCodecID: string;
  TrackType: string;
  AudioFormat?: string;
  AudioChannels: number;
  AudioSampleRate: number;
  AudioBitsPerSample: number;
  AvgBitrate?: string;
  TagName: string;
  TagString: string;
  ImageSize: string;
  Megapixels: number;
  Orientation?: number;
  Title?: string;
  Comment?: string;
  Rating?: number;
  Keyword?: string[];
  Subject?: string[];

  // These numeric values stored as strings for accuracy.
  GPSLatitude?: string; // Decimal degrees
  GPSLongitude?: string; // Decimal degrees
  GPSAltitude?: string; // Meters above/below sea level.
}

/**
 * A simple wrapper around the ExifTool command line app (https://exiftool.org/).
 */
export class ExifTool {
  public static async getMetadata(filePath: string): Promise<IExifResponse> {
    try {
      const exifTool = await this.getExecPath();
      const metadata = await this.getExifMetadata(exifTool, filePath);
      return metadata;
    } catch (err) {
      throw new Error(`Could not get the file metadata: ${err}`);
    }
  }

  private static getExifMetadata(
    exifToolPath: string,
    filePath: string
  ): Promise<IExifResponse> {
    return new Promise((resolve, reject) => {
      child_process.exec(
        `${exifToolPath} -j -n ${filePath}`,
        (err, stdout, stderr) => {
          if (err) {
            return reject(err);
          }
          return resolve(JSON.parse(stdout)[0]);
        }
      );
    });
  }

  private static async getExecPath(): Promise<string> {
    try {
      const path = '/usr/bin/exiftool';
      await stat(path);
      return path;
    } catch (err) {
      return '/usr/bin/vendor_perl/exiftool';
    }
  }
}
