import { LocalDateTime, ZoneId } from '@js-joda/core';
import '@js-joda/timezone';

export class Dates {
  /**
   * Converts a date time retrieved from an EXIF metadata attribute
   * to an Instant.  Since EXIF dates and times do not include time
   * zone information, a time zone must be provided.
   *
   * @param exifDateTime The EXIF date time to convert.
   * @param timeZone The time zone to use during conversion.
   */
  public static exifDateTimeToInstant(
    exifDateTime: string | undefined,
    timeZone: string
  ) {
    if (!exifDateTime) {
      return undefined;
    }

    const dateAndTime = exifDateTime.split(' ');
    if (dateAndTime.length !== 2) {
      throw new Error('Invalid EXIF datetime.');
    }

    dateAndTime[0] = dateAndTime[0].replace(/:/g, '-');
    const local = LocalDateTime.parse(dateAndTime.join('T'));
    return local.atZone(ZoneId.of(timeZone)).toInstant();
  }
}
