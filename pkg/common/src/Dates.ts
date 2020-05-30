import { Instant, LocalDateTime, ZonedDateTime, ZoneId } from '@js-joda/core';
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

    // In some files the date may not be set to anything meaningful.
    if (exifDateTime.startsWith('0000')) {
      return undefined;
    }

    const dateAndTime = exifDateTime.split(' ');
    if (dateAndTime.length !== 2) {
      throw new Error('Invalid EXIF datetime.');
    }

    // EXIF dates use colons between year, month and day but the ISO 8601
    // standard (and js-joda's parsing logic) uses hyphens.
    dateAndTime[0] = dateAndTime[0].replace(/:/g, '-');

    // If a time zone designator exists in the time portion then we can
    // parse it as a ZonedDateTime.  Otherwise we have to parse as
    // a local date and convert to the right timezone.
    if (
      dateAndTime[1].indexOf('-') >= 0 ||
      dateAndTime[1].indexOf('+') >= 0 ||
      dateAndTime[1].endsWith('Z')
    ) {
      return ZonedDateTime.parse(dateAndTime.join('T')).toInstant();
    } else {
      const local = LocalDateTime.parse(dateAndTime.join('T'));
      return local.atZone(ZoneId.of(timeZone)).toInstant();
    }
  }
}
