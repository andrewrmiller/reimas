import {
  FileAttribute,
  IAlbum,
  IAlbumAdd,
  IAlbumUpdate,
  IFile,
  IFolder,
  IFolderAdd,
  ILibrary,
  ILibraryAdd,
  IStatistics,
  Operator,
  Role,
  SortDirection
} from '@picstrata/client';
import {
  HttpMethod,
  HttpStatusCode,
  PictureMimeType,
  VideoMimeType
} from 'common';
import createDebug from 'debug';
import { v1 as createGuid } from 'uuid';
import {
  ApiBaseUrl,
  getStats,
  postFileToFolder,
  sendRequest,
  sleep,
  waitForProcessingComplete,
  waitForQueueDrain
} from './TestUtilities';

const debug = createDebug('apitest:libraries');

/**
 * Test data
 */
const OwnerUserId = createGuid();
const ContributorUserId = createGuid();
const ReaderUserId = createGuid();
const NonMemberUserId = createGuid();

const NewLibrary: ILibraryAdd = {
  name: 'Test Library',
  timeZone: 'America/Los_Angeles',
  description: 'Test Library Description'
};

const MainTestFiles = [
  {
    path: '../../test/samples/Aurora.jpg',
    contentType: PictureMimeType.Jpg
  },
  {
    path: '../../test/samples/Marbles.GIF',
    contentType: PictureMimeType.Gif
  },
  {
    path: '../../test/samples/Space.jpg',
    contentType: PictureMimeType.Jpg
  },
  {
    path: '../../test/samples/big-buck-bunny.mp4',
    contentType: VideoMimeType.MP4
  },
  {
    path: '../../test/samples/small.avi',
    contentType: VideoMimeType.AVI
  },
  {
    path: '../../test/samples/Puffins.mov',
    contentType: VideoMimeType.MOV
  }
];

const SubFolderATestFiles = [
  {
    path: '../../test/samples/Marina.png',
    name: 'Marina.png',
    contentType: PictureMimeType.Jpg
  },
  {
    path: '../../test/samples/Abbey.jpg',
    name: 'Abbey.jpg',
    contentType: PictureMimeType.Jpg
  }
];

const SubFolderBTestFiles = [
  {
    path: '../../test/samples/jellyfish-25-mbps-hd-hevc.mp4',
    name: 'jellyfish-25-mpbs-hd-hevc.mp4',
    contentType: VideoMimeType.MP4
  }
];

describe('Album Tests', () => {
  let testLibraryId: string;
  let allPicturesFolderId: string;
  let subFolderAId: string;
  let subFolderBId: string;
  let favoritesAlbumId: string;
  let videosAlbumId: string;
  let subFoldersAlbumId: string;
  const fileIds: string[] = [];

  beforeAll(() => {
    jest.setTimeout(20000);
    debug(`Testing album routes on API server at ${ApiBaseUrl}`);
  });

  test('Verify initial state', async () => {
    return getStats().then(stats => {
      expect(stats.libraryCount).toBe(0);
      expect(stats.folderCount).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.albumCount).toBe(0);
      expect(stats.objectUserCount).toBe(0);
    });
  });

  test('Verify addition of files to library', async () => {
    // Create a new library.
    await sendRequest(
      'libraries',
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify(NewLibrary)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((library: ILibrary) => {
        testLibraryId = library.libraryId;
        expect(library.name).toBe(NewLibrary.name);
        expect(library.description).toBe(NewLibrary.description);
        expect(library.userRole).toBe(Role.Owner);
      });
    });

    // Grab the All Pictures folder ID.
    await sendRequest(
      `libraries/${testLibraryId}/folders?parent=`,
      OwnerUserId
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folders: IFolder[]) => {
        expect(folders).toHaveLength(1);
        allPicturesFolderId = folders[0].folderId;
        expect(folders[0].userRole).toBe(Role.Owner);
      });
    });

    // Upload some files.
    for (const file of MainTestFiles) {
      await postFileToFolder(
        OwnerUserId,
        testLibraryId,
        allPicturesFolderId,
        file.path,
        file.contentType
      ).then((newFile: IFile) => {
        expect(newFile.mimeType).toBe(file.contentType);
        fileIds.push(newFile.fileId);
      });
    }

    // Create SubFolderA.
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: allPicturesFolderId,
        name: 'SubFolderA'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        subFolderAId = folder.folderId;
      });
    });

    // Add some files to it.
    for (const file of SubFolderATestFiles) {
      await postFileToFolder(
        OwnerUserId,
        testLibraryId,
        subFolderAId,
        file.path,
        file.contentType
      ).then((newFile: IFile) => {
        expect(newFile.mimeType).toBe(file.contentType);
        fileIds.push(newFile.fileId);
      });
    }

    // Create SubFolderB.
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: allPicturesFolderId,
        name: 'SubFolderB'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        subFolderBId = folder.folderId;
      });
    });

    // Add some files to it.
    for (const file of SubFolderBTestFiles) {
      await postFileToFolder(
        OwnerUserId,
        testLibraryId,
        subFolderBId,
        file.path,
        file.contentType
      ).then((newFile: IFile) => {
        expect(newFile.mimeType).toBe(file.contentType);
        fileIds.push(newFile.fileId);
      });
    }

    // Let asynchronous processing complete.
    await waitForQueueDrain();
    await waitForProcessingComplete();
  });

  test('Verify album creation', async () => {
    // Create a Favorites album.
    await sendRequest(
      `libraries/${testLibraryId}/albums`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        name: 'Favorites',
        query: {
          version: '1.0',
          criteria: [
            {
              attribute: FileAttribute.Rating,
              operator: Operator.GreaterThanOrEquals,
              value: 1
            }
          ],
          orderBy: [
            {
              attribute: FileAttribute.Filename,
              direction: SortDirection.Ascending
            }
          ]
        }
      } as IAlbumAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then(album => {
        expect(album.name).toBe('Favorites');
        expect(album.query).toBeDefined();
        expect(album.query.criteria).toHaveLength(1);
        expect(album.query.criteria[0].attribute).toBe(FileAttribute.Rating);
        expect(album.query.orderBy).toHaveLength(1);
        expect(album.query.orderBy[0].attribute).toBe(FileAttribute.Filename);
        favoritesAlbumId = album.albumId;
      });
    });

    await addUsersToAlbum(favoritesAlbumId);

    // Verify that the files returned are the right files.  Owners, contributors
    // and readers should all be able to read these files.
    [OwnerUserId, ContributorUserId, ReaderUserId].forEach(async user => {
      await sendRequest(
        `libraries/${testLibraryId}/albums/${favoritesAlbumId}/files`,
        user,
        HttpMethod.Get
      ).then(response => {
        expect(response.status).toBe(HttpStatusCode.OK);
        return response.json().then(files => {
          expect(files).toHaveLength(1);
          expect(files[0].name).toBe('Aurora.jpg');
        });
      });
    });

    // Create a Videos album.
    await sendRequest(
      `libraries/${testLibraryId}/albums`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        name: 'Videos',
        query: {
          version: '1.0',
          criteria: [
            {
              attribute: FileAttribute.IsVideo,
              operator: Operator.Equals,
              value: 1
            }
          ],
          orderBy: [
            {
              attribute: FileAttribute.Filename,
              direction: SortDirection.Ascending
            }
          ]
        }
      } as IAlbumAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then(album => {
        expect(album.name).toBe('Videos');
        expect(album.query).toBeDefined();
        expect(album.query.criteria).toHaveLength(1);
        expect(album.query.criteria[0].attribute).toBe(FileAttribute.IsVideo);
        expect(album.query.orderBy).toHaveLength(1);
        expect(album.query.orderBy[0].attribute).toBe(FileAttribute.Filename);
        videosAlbumId = album.albumId;
      });
    });

    await addUsersToAlbum(videosAlbumId);

    // Verify that the files returned are the right files.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${videosAlbumId}/files`,
      OwnerUserId,
      HttpMethod.Get
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then(files => {
        expect(files).toHaveLength(4);
      });
    });

    // Create a SubFolders album.
    await sendRequest(
      `libraries/${testLibraryId}/albums`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        name: 'SubFolders',
        query: {
          version: '1.0',
          criteria: [
            {
              attribute: FileAttribute.ParentFolderId,
              operator: Operator.OneOf,
              value: [subFolderAId, subFolderBId]
            }
          ]
        }
      } as IAlbumAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then(album => {
        expect(album.name).toBe('SubFolders');
        expect(album.query).toBeDefined();
        expect(album.query.criteria).toHaveLength(1);
        expect(album.query.criteria[0].attribute).toBe(
          FileAttribute.ParentFolderId
        );
        subFoldersAlbumId = album.albumId;
      });
    });

    // Verify that the files returned are the right files.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${subFoldersAlbumId}/files`,
      OwnerUserId,
      HttpMethod.Get
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((files: IFile[]) => {
        expect(files).toHaveLength(3);
        expect(files.find(f => f.name === SubFolderATestFiles[0].name));
        expect(files.find(f => f.name === SubFolderATestFiles[1].name));
        expect(files.find(f => f.name === SubFolderBTestFiles[0].name));
      });
    });
  });

  test('Verify album retrieval', async () => {
    // The owner should have permissison to enumerate all the albums in the library.
    await sendRequest(`libraries/${testLibraryId}/albums`, OwnerUserId).then(
      response => {
        expect(response.status).toBe(HttpStatusCode.OK);
        return response.json().then((albums: IAlbum[]) => {
          expect(albums).toHaveLength(3);
          expect(albums.find(a => a.name === 'Favorites')).toBeDefined();
          expect(albums.find(a => a.name === 'Videos')).toBeDefined();
          expect(albums.find(a => a.name === 'SubFolders')).toBeDefined();
        });
      }
    );

    // All users should be able to get the details for a given album.
    [OwnerUserId, ContributorUserId, ReaderUserId].forEach(async user => {
      await sendRequest(
        `libraries/${testLibraryId}/albums/${favoritesAlbumId}`,
        user
      ).then(response => {
        expect(response.status).toBe(HttpStatusCode.OK);
        return response.json().then((album: IAlbum) => {
          expect(album.name).toBe('Favorites');
        });
      });
    });
  });

  test('Verify updating an existing album', async () => {
    // Contributors and readers should not be able to update the album.
    [ContributorUserId, ReaderUserId].forEach(async user => {
      await sendRequest(
        `libraries/${testLibraryId}/albums/${favoritesAlbumId}`,
        user,
        HttpMethod.Patch,
        JSON.stringify({
          name: 'New Name'
        } as IAlbumUpdate)
      ).then(result => {
        expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
      });
    });

    // Owners should be able to update the names of albums.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${favoritesAlbumId}`,
      OwnerUserId,
      HttpMethod.Patch,
      JSON.stringify({
        name: 'My Favorites'
      } as IAlbumUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((album: IAlbum) => {
        expect(album.name).toBe('My Favorites');
        // These should be unchanged
        expect(album.query!.criteria![0].attribute).toBe(FileAttribute.Rating);
        expect(album.query!.criteria![0].value).toBe(1);
      });
    });

    // Owners should also be able to update album queries.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${favoritesAlbumId}`,
      OwnerUserId,
      HttpMethod.Patch,
      JSON.stringify({
        query: {
          version: '1.0',
          criteria: [
            {
              attribute: FileAttribute.Rating,
              operator: Operator.GreaterThanOrEquals,
              value: 4
            }
          ]
        }
      } as IAlbumUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((album: IAlbum) => {
        expect(album.query!.criteria![0].attribute).toBe(FileAttribute.Rating);
        expect(album.query!.criteria![0].value).toBe(4);
        expect(album.query!.orderBy).toBeUndefined();
      });
    });

    // Verify that the files returned are the right files.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${favoritesAlbumId}/files`,
      OwnerUserId,
      HttpMethod.Get
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then(files => {
        expect(files).toHaveLength(0);
      });
    });
  });

  test('Verify deleting albums', async () => {
    let startingStats: IStatistics;

    await getStats().then((stats: IStatistics) => {
      startingStats = stats;
    });

    // Contributors and readers should not be able to delete albums.
    [ContributorUserId, ReaderUserId].forEach(async user => {
      await sendRequest(
        `libraries/${testLibraryId}/albums/${videosAlbumId}`,
        user,
        HttpMethod.Delete
      ).then(result => {
        expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
      });
    });

    // Non-members should not know that the album even exists.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${videosAlbumId}`,
      NonMemberUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });

    // Owners should also be able to delete albums.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${videosAlbumId}`,
      OwnerUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((album: IAlbum) => {
        expect(album.albumId).toBe(videosAlbumId);
      });
    });

    await getStats().then((stats: IStatistics) => {
      expect(stats.albumCount).toEqual(startingStats.albumCount - 1);
      expect(stats.objectUserCount).toEqual(startingStats.objectUserCount - 3);
    });
  });

  test('Verify clean up', async () => {
    // Wait for the queue to drain and all processing to complete.
    // Then wait a little longer to let jobs like the folder reacalc
    // job to complete--there isn't currently a way to see if it is
    // running.
    await waitForQueueDrain();
    await waitForProcessingComplete();
    await sleep(1000);
    debug('Deleting library...');

    await sendRequest(
      `libraries/${testLibraryId}`,
      OwnerUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
    });

    await getStats().then(stats => {
      expect(stats.libraryCount).toBe(0);
      expect(stats.folderCount).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.albumCount).toBe(0);
      expect(stats.objectUserCount).toBe(0);
    });
  });

  const addUsersToAlbum = async (albumId: string) => {
    // Add a contributor to that album.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${albumId}/users`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: ContributorUserId,
        role: Role.Contributor
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
    });

    // Add a reader to that album.
    await sendRequest(
      `libraries/${testLibraryId}/albums/${albumId}/users`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: ReaderUserId,
        role: Role.Reader
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
    });
  };
});
