import { HttpMethod, HttpStatusCode } from 'common';
import createDebug from 'debug';
import { IFolder, ILibrary, ILibraryAdd, Role } from 'picstrata-client';
import { v1 as createGuid } from 'uuid';
import { getStats, sendRequest } from './TestUtilities';

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
  description: 'Test Library Description'
};
const UpdatedLibraryName = 'Test Library Updated';

describe('Library Tests', () => {
  let testLibraryId: string;
  let allPicturesFolderId: string;

  test('Verify initial state', async () => {
    return getStats().then(stats => {
      expect(stats.libraryCount).toBe(0);
      expect(stats.folderCount).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.folderUserRoleCount).toBe(0);
    });
  });

  test('Verify creation of a new library', async () => {
    return sendRequest(
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
  });

  test('Verify existence of new library in all libraries', async () => {
    await sendRequest('libraries', OwnerUserId).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((libraries: ILibrary[]) => {
        expect(libraries.length).toBeGreaterThanOrEqual(1);
        const library = libraries.find(l => (l.libraryId = testLibraryId));
        expect(library).not.toBeUndefined();
        expect(library!.name).toEqual(NewLibrary.name);
        expect(library!.description).toEqual(NewLibrary.description);
        expect(library!.userRole).toEqual(Role.Owner);
      });
    });
  });

  test('Verify ability to fetch library details', async () => {
    return sendRequest(`libraries/${testLibraryId}`, OwnerUserId).then(
      result => {
        expect(result.status).toBe(HttpStatusCode.OK);
        return result.json().then((library: any) => {
          expect(library).not.toBeUndefined();
          expect(library.name).toEqual(NewLibrary.name);
          expect(library.description).toEqual(NewLibrary.description);
          expect(library.userRole).toEqual(Role.Owner);

          // Get list of top level folders.
          return sendRequest(
            `libraries/${testLibraryId}/folders?parent=`,
            OwnerUserId
          ).then(result2 => {
            expect(result2.status).toBe(HttpStatusCode.OK);
            return result2.json().then((folders: IFolder[]) => {
              expect(folders).toHaveLength(1);
              const folder = folders[0];
              expect(folder.name).toBe('All Pictures');
              allPicturesFolderId = folder.folderId;
            });
          });
        });
      }
    );
  });

  test('Verify addition of users to a library', async () => {
    // Owner should be able to add a contributor.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${allPicturesFolderId}/users`,
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

    // Owner should also be able to add a reader.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${allPicturesFolderId}/users`,
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

    // Adding the same user a second time should return an error.
    await sendRequest(
      `libraries/${testLibraryId}/folders/${allPicturesFolderId}/users`,
      OwnerUserId,
      HttpMethod.Post,
      JSON.stringify({
        userId: ReaderUserId,
        role: Role.Reader
      })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.CONFLICT);
    });
  });

  test('Verify access to library information', async () => {
    // Contributor should be able to see the library.
    await sendRequest(`libraries`, ContributorUserId).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((libraries: ILibrary[]) => {
        expect(libraries).toHaveLength(1);
        expect(libraries[0].libraryId).toBe(testLibraryId);
      });
    });
    await sendRequest(`libraries/${testLibraryId}`, ContributorUserId).then(
      result => {
        expect(result.status).toBe(HttpStatusCode.OK);
      }
    );

    // Reader should be able to see the library.
    await sendRequest(`libraries`, ReaderUserId).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((libraries: ILibrary[]) => {
        expect(libraries).toHaveLength(1);
        expect(libraries[0].libraryId).toBe(testLibraryId);
      });
    });
    await sendRequest(`libraries/${testLibraryId}`, ReaderUserId).then(
      result => {
        expect(result.status).toBe(HttpStatusCode.OK);
      }
    );

    // Non-members shoiuld not be able to see the library.
    await sendRequest(`libraries`, NonMemberUserId).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((libraries: ILibrary[]) => {
        expect(libraries).toHaveLength(0);
      });
    });
    await sendRequest(`libraries/${testLibraryId}`, NonMemberUserId).then(
      result => {
        expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
      }
    );
  });

  test('Verify updating an existing library', async () => {
    // Owners should be able to update the library.
    await sendRequest(
      `libraries/${testLibraryId}`,
      OwnerUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: UpdatedLibraryName })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((updated: ILibrary) => {
        expect(updated.name).toBe(UpdatedLibraryName);
      });
    });

    // Contributors should be able to update the library.
    await sendRequest(
      `libraries/${testLibraryId}`,
      ContributorUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: UpdatedLibraryName })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
      return result.json().then((updated: ILibrary) => {
        expect(updated.name).toBe(UpdatedLibraryName);
      });
    });

    // Readers are blocked from updating.
    await sendRequest(
      `libraries/${testLibraryId}`,
      ReaderUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: UpdatedLibraryName })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Non-members can't even see that there is a library.
    await sendRequest(
      `libraries/${testLibraryId}`,
      NonMemberUserId,
      HttpMethod.Patch,
      JSON.stringify({ name: UpdatedLibraryName })
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });
  });

  test('Verify deletion of an existing library.', async () => {
    // Non-members shouldn't even see the library.
    await sendRequest(
      `libraries/${testLibraryId}`,
      NonMemberUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.NOT_FOUND);
    });

    // Readers should be blocked.
    await sendRequest(
      `libraries/${testLibraryId}`,
      ReaderUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Contributors should be blocked.
    await sendRequest(
      `libraries/${testLibraryId}`,
      ContributorUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.UNAUTHORIZED);
    });

    // Owners should be able to delete the library.
    await sendRequest(
      `libraries/${testLibraryId}`,
      OwnerUserId,
      HttpMethod.Delete
    ).then(result => {
      expect(result.status).toBe(HttpStatusCode.OK);
    });
  });

  test('Verify error when no user ID provided.', async () => {
    return sendRequest('libraries').then(response => {
      expect(response.status).toBe(400);
    });
  });

  test('Verify creation of a new library with bad user ID', async () => {
    await sendRequest(
      'libraries',
      '', // Empty user IDs are not allowed
      HttpMethod.Post,
      JSON.stringify(NewLibrary)
    ).then(result => {
      expect(result.status).toBe(400);
    });

    await sendRequest(
      'libraries',
      'system.user@picstrata.api', // Can't use system user ID.
      HttpMethod.Post,
      JSON.stringify(NewLibrary)
    ).then(result => {
      expect(result.status).toBe(400);
    });
  });

  test('Verify end state', async () => {
    await getStats().then(stats => {
      expect(stats.libraryCount).toBe(0);
      expect(stats.folderCount).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.folderUserRoleCount).toBe(0);
    });
  });
});
