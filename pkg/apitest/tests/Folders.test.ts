import {
  IFolder,
  IFolderAdd,
  IFolderUpdate,
  ILibrary,
  ILibraryAdd,
  IStatistics,
  Role
} from '@picstrata/client';
import { HttpMethod, HttpStatusCode } from 'common';
import createDebug from 'debug';
import { v1 as createGuid } from 'uuid';
import {
  ApiBaseUrl,
  getStats,
  logTestStart,
  sendRequest
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

describe('Folder Tests', () => {
  let testLibraryId: string;
  let allPicturesFolderId: string;
  let subFolder1Id: string;
  let subFolder2Id: string;
  let subFolder2Child1Id: string;

  beforeAll(() => {
    debug(`Testing folder routes on API server at ${ApiBaseUrl}`);
  });

  beforeEach(async () => {
    await logTestStart();
  });

  test('Verify initial state', async () => {
    return getStats().then(stats => {
      expect(stats.libraryCount).toBe(0);
      expect(stats.folderCount).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.objectUserCount).toBe(0);
    });
  });

  test('Verify creation of new folders in a library.', async () => {
    // Create a new library.
    await sendRequest(
      'libraries',
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify(NewLibrary)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((library: ILibrary) => {
        testLibraryId = library.libraryId;
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

    // Create SubFolder1
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: allPicturesFolderId,
        name: 'SubFolder1'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        subFolder1Id = folder.folderId;
        expect(folder.userRole).toBe(Role.Owner);
      });
    });

    // Add a contributor to that folder.
    expect(ContributorUserId).not.toBe(OwnerUserId);
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}/users`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: ContributorUserId,
        role: Role.Contributor
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      result.json().then(user => {
        expect(user.userId).toBe(ContributorUserId);
        expect(user.role).toBe(Role.Contributor);
      });
    });

    // Create SubFolder2
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: allPicturesFolderId,
        name: 'SubFolder2'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        subFolder2Id = folder.folderId;
        expect(folder.userRole).toBe(Role.Owner);
      });
    });

    // And add a subfolder under that.
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: subFolder2Id,
        name: 'SubFolder2 Child 1'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        subFolder2Child1Id = folder.folderId;
        expect(folder.userRole).toBe(Role.Owner);
      });
    });

    // Add a reader to that folder.
    expect(ReaderUserId).not.toBe(OwnerUserId);
    expect(ReaderUserId).not.toBe(ContributorUserId);
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}/users`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: ReaderUserId,
        role: Role.Reader
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      result.json().then(user => {
        expect(user.userId).toBe(ReaderUserId);
        expect(user.role).toBe(Role.Reader);
      });
    });

    // Verify that adding the same reader again fails.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}/users`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: ReaderUserId,
        role: Role.Reader
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.CONFLICT);
    });

    // Verify that the reader cannot add anyone else because they don't have permissions
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}/users`,
      ReaderUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: createGuid(),
        role: Role.Reader
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });
  });

  test('Verify folder user access to library information', async () => {
    // Folder contributors should see the library but not have any library role.
    await sendRequest(`libraries/${testLibraryId}`, ContributorUserId).then(
      result => {
        expect(result.status).toBe(HttpStatusCode.OK);
        return result.json().then((library: ILibrary) => {
          expect(library.libraryId).toBe(testLibraryId);
          expect(library.userRole).toBe(undefined);
        });
      }
    );

    // Same for folder readers.
    await sendRequest(`libraries/${testLibraryId}`, ReaderUserId).then(
      result => {
        expect(result.status).toBe(HttpStatusCode.OK);
        return result.json().then((library: ILibrary) => {
          expect(library.libraryId).toBe(testLibraryId);
          expect(library.userRole).toBe(undefined);
        });
      }
    );
  });

  test('Verify access to folder information', async () => {
    // Owners should be able to see both subfolders.
    await sendRequest(
      `libraries/${testLibraryId}/folders?parent=${allPicturesFolderId}`,
      OwnerUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folders: IFolder[]) => {
        expect(folders).toHaveLength(2);
        expect(folders[0].libraryId).toBe(testLibraryId);
        expect(folders[0].folderId).toBe(subFolder1Id);
        expect(folders[0].userRole).toBe(Role.Owner);
        expect(folders[1].libraryId).toBe(testLibraryId);
        expect(folders[1].folderId).toBe(subFolder2Id);
        expect(folders[1].userRole).toBe(Role.Owner);
      });
    });
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}`,
      OwnerUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folder: IFolder) => {
        expect(folder.folderId).toBe(subFolder2Id);
        expect(folder.userRole).toBe(Role.Owner);
      });
    });

    // Contributor on SubFolder1 should not be able to see any folders
    // under All Pictures, but should be able to see SubFolder1 and
    // any child folders under SubFolder1.
    // UNDONE: this doesn't work yet.
    // await sendRequest(
    //   `libraries/${testLibraryId}/folders?parent=${allPicturesFolderId}`,
    //   ContributorUserId
    // ).then(result => {
    //   expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    // });

    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      ContributorUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folder: IFolder) => {
        expect(folder.folderId).toBe(subFolder1Id);
        expect(folder.userRole).toBe(Role.Contributor);
      });
    });

    await sendRequest(
      `libraries/${testLibraryId}/folders?parent=${subFolder1Id}`,
      ContributorUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then(folders => {
        expect(folders).toHaveLength(0);
      });
    });

    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}`,
      ContributorUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });

    // Reader on SubFolder2 should not be able to see any folders
    // under All Pictures, but should be able to see SubFolder2 and
    // any child folders under SubFolder2.
    // UNDONE: this doesn't work yet.
    // await sendRequest(
    //   `libraries/${testLibraryId}/folders?parent=${allPicturesFolderId}`,
    //   ReaderUserId
    // ).then(result => {
    //   expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    // });

    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}`,
      ReaderUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folder: IFolder) => {
        expect(folder.folderId).toBe(subFolder2Id);
        expect(folder.userRole).toBe(Role.Reader);
      });
    });

    await sendRequest(
      `libraries/${testLibraryId}/folders?parent=${subFolder2Id}`,
      ReaderUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folders: IFolder[]) => {
        expect(folders).toHaveLength(1);
        expect(folders[0].folderId).toBe(subFolder2Child1Id);
        expect(folders[0].userRole).toBe(Role.Reader);
      });
    });

    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      ReaderUserId
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });
  });

  test('Verify updating an existing folder', async () => {
    // Contributors should not be able to update folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      ContributorUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: 'SubFolder1Updated' } as IFolderUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Read-only users should not be able to update folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}`,
      ReaderUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: 'SubFolder2Updated' } as IFolderUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Non-members should not know that the folder even exists.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      NonMemberUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: 'SubFolder1Updated' } as IFolderUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });

    // Owners should be able to update folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      OwnerUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: 'SubFolder1Updated' } as IFolderUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folder: IFolder) => {
        expect(folder.folderId).toBe(subFolder1Id);
        expect(folder.name).toBe('SubFolder1Updated');
      });
    });

    // Reset the folder to the original state.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      OwnerUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: 'SubFolder1' } as IFolderUpdate)
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folder: IFolder) => {
        expect(folder.folderId).toBe(subFolder1Id);
        expect(folder.name).toBe('SubFolder1');
      });
    });
  });

  test('Verify contributor subfolder operations', async () => {
    let childFolderAId: string = '';

    // Contributors should be able to create new subfolders.
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      ContributorUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: subFolder1Id,
        name: 'Contributor Folder A'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        childFolderAId = folder.folderId;
        expect(folder.name).toBe('Contributor Folder A');
        expect(folder.userRole).toBe(Role.Owner);
      });
    });

    // Since they are owners on folders they create, they should
    // be able to update those folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${childFolderAId}`,
      ContributorUserId,
      HttpMethod.Patch,
      JSON.stringify({
        name: 'Contributor Folder A Updated'
      } as IFolderUpdate)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then((folder: IFolder) => {
        expect(folder.name).toBe('Contributor Folder A Updated');
      });
    });

    // They should also be able to delete folders they create.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${childFolderAId}`,
      ContributorUserId,
      HttpMethod.Delete
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
    });

    // Contributors should be able to create new subfolders.
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      ReaderUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: subFolder2Id,
        name: 'Reader Folder B'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });
  });

  test('Verify folder breadcrumbs', async () => {
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Child1Id}/breadcrumbs`,
      OwnerUserId,
      HttpMethod.Get
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.OK);
      return response.json().then(result => {
        expect(result).toHaveLength(2);
        expect(result[0].folderId).toBe(allPicturesFolderId);
        expect(result[1].folderId).toBe(subFolder2Id);
      });
    });
  });

  test('Verify duplicate folder name detection', async () => {
    await sendRequest(
      `libraries/${testLibraryId}/folders`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        parentId: allPicturesFolderId,
        name: 'SubFolder1'
      } as IFolderAdd)
    ).then(response => {
      expect(response.status).toBe(HttpStatusCode.CONFLICT);
      return null;
    });
  });

  test('Verify deleting folders and subfolders', async () => {
    let startingStats: IStatistics;

    await getStats().then((stats: IStatistics) => {
      startingStats = stats;
    });

    // Contributors should not be able to delete folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      ContributorUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Readers should not be able to delete folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder2Id}`,
      ReaderUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Non-members should not know that the folder even exists.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      NonMemberUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });

    // Owners should also be able to delete folders.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${subFolder1Id}`,
      OwnerUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((folder: IFolder) => {
        expect(folder.folderId).toBe(subFolder1Id);
      });
    });

    await getStats().then((stats: IStatistics) => {
      expect(stats.folderCount).toEqual(startingStats.folderCount - 1);
      expect(stats.objectUserCount).toEqual(startingStats.objectUserCount - 2);
    });
  });

  test('Verify clean up.', async () => {
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
      expect(stats.objectUserCount).toBe(0);
    });
  });
});
