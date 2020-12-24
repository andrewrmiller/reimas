-- Get rid of some (now) unused procedures.
DROP PROCEDURE IF EXISTS `pst_get_favorite_files`;
DROP PROCEDURE IF EXISTS `pst_get_video_files`;

-- Rename the pst_folder_user_roles table and allow it to store
-- roles for different object types.
RENAME TABLE pst_folder_user_roles TO pst_object_users;
ALTER TABLE pst_object_users 
  ADD COLUMN object_type TEXT(20),
  RENAME COLUMN folder_id TO object_id;

UPDATE pst_object_users
SET object_type = 'folder';

INSERT INTO pst_object_users(library_id, object_type, object_id, user_id, role)
SELECT
  ou.library_id, 'library', ou.library_id, ou.user_id, ou.role
FROM 
  pst_object_users ou INNER JOIN pst_folders f 
    ON ou.library_id = f.library_id AND ou.object_type = 'folder' AND ou.object_id = f.folder_id
WHERE f.parent_id IS NULL;

-- Add created/modified columns so that we can properly return
-- "Shared with Me" information.
ALTER TABLE pst_object_users
ADD FOREIGN KEY (library_id) REFERENCES pst_libraries(library_id),
ADD COLUMN created_on DATETIME,
ADD COLUMN created_by VARCHAR(254),
ADD COLUMN modified_on DATETIME,
ADD COLUMN modified_by VARCHAR(254);

UPDATE pst_object_users
SET
  created_on = UTC_TIMESTAMP(),
  created_by = "system",
  modified_on = UTC_TIMESTAMP(),
  modified_by = "system";

ALTER TABLE pst_object_users
  CHANGE created_on created_on DATETIME NOT NULL,
  CHANGE created_by created_by VARCHAR(254) NOT NULL,
  CHANGE modified_on modified_on DATETIME NOT NULL,
  CHANGE modified_by modified_by VARCHAR(254) NOT NULL;

-- Add the new albums table.
CREATE TABLE pst_albums (
  `library_id` binary(16) NOT NULL,
  `album_id` binary(16) NOT NULL,
  `name` varchar(80) NOT NULL,
  `query` text,
  `where` text,
  `order_by` text,
  PRIMARY KEY (`library_id`,`album_id`),
  UNIQUE KEY `ux_albums_name` (`library_id`,`name`),
  KEY `ix_folders_name` (`library_id`,`name`),
  CONSTRAINT `fk_albums_library_id` FOREIGN KEY (`library_id`) REFERENCES `pst_libraries` (`library_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Get rid of unused columns on pst_folders.
ALTER TABLE pst_folders
  DROP COLUMN type,
  DROP COLUMN data,
  DROP COLUMN `where`,
  DROP COLUMN order_by;

DELIMITER $$

DROP PROCEDURE IF EXISTS `pst_get_statistics` $$
CREATE PROCEDURE `pst_get_statistics`()
BEGIN

  SELECT
    (SELECT COUNT(*) FROM pst_libraries) AS library_count,
    (SELECT COUNT(*) FROM pst_folders) AS folder_count,
    (SELECT COUNT(*) FROM pst_files) AS file_count,
    (SELECT COUNT(*) FROM pst_albums) AS album_count,
    (SELECT COUNT(*) FROM pst_object_users) AS object_user_count,
    (SELECT COUNT(*) FROM pst_files WHERE is_processing=1) AS processing_count;

END $$

-- Convert pst_add_folder_user to a more general purpose procedure
-- that will work for other object types.
DROP PROCEDURE IF EXISTS `pst_add_folder_user` $$
CREATE PROCEDURE `pst_add_object_user`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36),
                      IN p_object_type VARCHAR(20),
                      IN p_object_id VARCHAR(36),
                      IN p_new_user_id VARCHAR(254),
                      IN p_role VARCHAR(20))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE object_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_object_id);
  DECLARE user_role VARCHAR(20);
  DECLARE now DATETIME DEFAULT UTC_TIMESTAMP();

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1022, MESSAGE_TEXT = 'Duplicate item exists.';
  END;

  IF (NOT pst_is_valid_role(p_role)) THEN
    SIGNAL SQLSTATE 'HY000' SET MYSQL_ERRNO = 1525, MESSAGE_TEXT = 'Invalid role value.';
  END IF;

  IF (p_object_type <> 'library' AND p_object_type <> 'folder' AND p_object_type <> 'album') THEN
    SIGNAL SQLSTATE 'HY000' SET MYSQL_ERRNO = 1525, MESSAGE_TEXT = 'Invalid object type.';
  END IF;

  SET user_role =
    CASE
      WHEN p_object_type = "library" THEN
        COALESCE(pst_get_library_user_role(p_user_id, library_id_compressed), '')
      ELSE
        COALESCE(pst_get_folder_user_role(p_user_id, library_id_compressed, object_id_compressed), '')
    END;

  IF (user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to grant permissions.';
  END IF;

  INSERT INTO
    pst_object_users 
      (library_id, 
      object_type, 
      object_id, 
      user_id, 
      role, 
      created_on, 
      created_by, 
      modified_on, 
      modified_by)
  VALUES
    (library_id_compressed, 
    p_object_type, 
    object_id_compressed, 
    p_new_user_id, 
    p_role,
    now,
    p_user_id,
    now,
    p_user_id);

  SELECT
    p_library_id AS library_id,
    p_object_type as object_type,
    p_object_id AS object_id,
    p_new_user_id AS user_id,
    p_role AS role,
    now AS created_on,
    p_user_id AS created_by,
    now AS modified_on,
    p_user_id AS modified_by;

END $$

-- Create a procedure that assigns ownership of an object to 
-- a user without doing any permission checks.  This is used
-- when a user is creating a new object.
CREATE PROCEDURE `pst_add_owner_object_user`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id_compressed BINARY(16),
                      IN p_object_type VARCHAR(20),
                      IN p_object_id_compressed BINARY(16))
BEGIN

 DECLARE now DATETIME DEFAULT UTC_TIMESTAMP();
 INSERT INTO
    pst_object_users
      (library_id, 
      object_type, 
      object_id, 
      user_id, 
      role,
      created_on,
      created_by,
      modified_on,
      modified_by)
  VALUES
    (p_library_id_compressed, 
    p_object_type, 
    p_object_id_compressed, 
    p_user_id, 
    'owner',
    now,
    p_user_id,
    now,
    p_user_id);

END $$

-- Get rid of the pst_library_user_roles view.
DROP VIEW IF EXISTS `pst_library_user_roles` $$

-- Create a function that returns the role that the user has on
-- the library.  If the user is not explicitly added to the library's
-- user list, this function returns null.
CREATE FUNCTION `pst_get_library_user_role`(
                      p_user_id VARCHAR(254), 
                      p_library_id_compressed BINARY(16)) RETURNS VARCHAR(20) CHARSET utf8mb4
    DETERMINISTIC
BEGIN

  DECLARE user_role VARCHAR(20);

  SELECT role INTO user_role
  FROM pst_object_users
  WHERE 
    library_id = p_library_id_compressed AND 
    object_type = 'library' AND 
    user_id = p_user_id;

  RETURN user_role;

END $$

-- Rename pst_get_user_role to pst_get_folder_user_role and change it to pull
-- date from pst_object_users.  Also have it check library permissions to
-- see if those are greater than what has been granted on the folder.
DROP FUNCTION IF EXISTS `pst_get_user_role` $$
CREATE FUNCTION `pst_get_folder_user_role`(
                    p_user_id VARCHAR(254), 
                    p_library_id_compressed BINARY(16), 
                    p_folder_id_compressed BINARY(16)) RETURNS VARCHAR(20) CHARSET utf8mb4
    DETERMINISTIC
BEGIN

  DECLARE user_role VARCHAR(20);
  DECLARE library_user_role VARCHAR(20);
  DECLARE folder_id_start BINARY(16);

  -- If p_folder_id_compressed IS NULL the caller wants to get permissions for the
  -- root folder in the library.  We look the folder ID up in this case.
  IF p_folder_id_compressed IS NULL THEN
    SELECT folder_id INTO folder_id_start FROM pst_folders
    WHERE library_id = p_library_id_compressed AND parent_id IS NULL;
  ELSE
    SET folder_id_start = p_folder_id_compressed;
  END IF;

  -- Walk the folder tree from the specified folder all the way to the
  -- root looking for the most privileged role assigned to the user.
  -- A higher-ranked role on a parent folder overrides a lower-ranked
  -- role on a subfolder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, role, role_rank) AS
  (
    SELECT 
      f.library_id, 
      f.folder_id, 
      f.parent_id, 
      ou.role,
      pst_get_role_rank(ou.role) AS role_rank
    FROM 
      pst_folders f LEFT JOIN pst_object_users ou
      ON f.library_id = ou.library_id AND
        f.folder_id = ou.object_id AND
        ou.object_type = 'folder' AND
        ou.user_id = p_user_id
    WHERE 
      f.library_id = p_library_id_compressed AND 
      f.folder_id = folder_id_start
      
    UNION ALL
      
    SELECT 
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par_ou.role,
      pst_get_role_rank(par_ou.role) AS role_rank
    FROM 
      (folder_tree AS ft JOIN pst_folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id)
      LEFT JOIN pst_object_users par_ou
      ON par.library_id = par_ou.library_id
      AND par.folder_id = par_ou.object_id
      AND par_ou.object_type = 'folder'
      AND par_ou.user_id = p_user_id
  )
  SELECT 
    role INTO user_role
  FROM 
    folder_tree 
  ORDER BY 
    role_rank
  LIMIT 1;

  -- If the user has permissions on the library and they are greater than
  -- their permissions on the folder, use the library permissions.
  SET library_user_role = pst_get_library_user_role(p_user_id, p_library_id_compressed);
	IF (library_user_role IS NOT NULL AND pst_get_role_rank(library_user_role) < pst_get_role_rank(user_role)) THEN
      SET user_role = library_user_role;
  END IF;
  
  RETURN user_role;

END $$

-- Create a function that returns the role that the user has on
-- a file.  Currently this is determined by looking at the user's
-- role on the parent folder.
CREATE FUNCTION `pst_get_file_user_role`(
                      p_user_id VARCHAR(254), 
                      p_library_id_compressed BINARY(16),
                      p_file_id_compressed BINARY(16)) RETURNS VARCHAR(20) CHARSET utf8mb4
    DETERMINISTIC
BEGIN

  DECLARE folder_id_compressed BINARY(16);
  DECLARE user_role VARCHAR(20);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO folder_id_compressed
  FROM
    pst_files
  WHERE
    library_id = p_library_id_compressed AND
    file_id = p_file_id_compressed;

  -- The role for the file is the same as the role on the parent folder.
  RETURN pst_get_folder_user_role(p_user_id, p_library_id_compressed, folder_id_compressed);

END $$

-- Create a function that returns the role that the user has on
-- the library.  If the user is not explicitly added to the album's
-- user list, this function returns null.
CREATE FUNCTION `pst_get_album_user_role`(
                      p_user_id VARCHAR(254), 
                      p_library_id_compressed BINARY(16),
                      p_album_id_compressed BINARY(16)) RETURNS VARCHAR(20) CHARSET utf8mb4
    DETERMINISTIC
BEGIN

  DECLARE user_role VARCHAR(20);
  DECLARE library_user_role VARCHAR(20);

  SELECT role INTO user_role
  FROM pst_object_users
  WHERE 
    library_id = p_library_id_compressed AND 
    object_id = p_album_id_compressed AND 
    user_id = p_user_id;

  -- If the user has permissions on the library and they are higher than
  -- their permissions on the album, use the library permissions.
  SET library_user_role = pst_get_library_user_role(p_user_id, p_library_id_compressed);
	IF (library_user_role IS NOT NULL AND pst_get_role_rank(library_user_role) < pst_get_role_rank(user_role)) THEN
      SET user_role = library_user_role;
  END IF;
  
  RETURN user_role;

END $$

-- Update the pst_add_folder_core routine so that it uses the pst_object_users table.
-- Also get rid of the type parameter since that column has been removed.
DROP PROCEDURE IF EXISTS `pst_add_folder_core` $$
CREATE PROCEDURE `pst_add_folder_core`(
                  IN p_user_id VARCHAR(254),
                  IN p_library_id_compressed BINARY(16), 
                  IN p_folder_id_compressed BINARY(16), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id_compressed BINARY(16))
BEGIN

  -- This procedure assumes that it is being invoked inside of a transaction.

  DECLARE folder_path VARCHAR(255);

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1022, MESSAGE_TEXT = 'Duplicate item exists.';
  END;

  -- Check for invalid characters.
  IF (INSTR(p_name, '/') > 0) THEN
    SIGNAL SQLSTATE 'HY000' SET MYSQL_ERRNO = 1525, MESSAGE_TEXT = 'Invalid character in folder name.';
  END IF;

  IF (p_parent_id_compressed IS NULL) THEN
    BEGIN
      SET folder_path = '';
    END;
  ELSE
    BEGIN
      SELECT 
        CONCAT(`path`, '/', pst_expand_guid(p_folder_id_compressed)) INTO folder_path
      FROM 
        pst_folders 
      WHERE 
        library_id = p_library_id_compressed AND 
        folder_id = p_parent_id_compressed;

      -- Trim leading slash if it exists.
      IF (STRCMP(LEFT(folder_path, 1), '/') = 0) THEN 
        SET folder_path = SUBSTRING(folder_path, 2);
      END IF;
    END;
  END IF;

  INSERT INTO 
    pst_folders
      (library_id, 
      folder_id, 
      name, 
      parent_id, 
      `path`)
  VALUES
      (p_library_id_compressed, 
      p_folder_id_compressed, 
      p_name, 
      p_parent_id_compressed, 
      folder_path);

  CALL pst_add_owner_object_user(
          p_user_id, 
          p_library_id_compressed, 
          'folder', 
          p_folder_id_compressed);

END $$

-- Update pst_add_library so that it uses pst_object_users.
DROP PROCEDURE IF EXISTS `pst_add_library` $$
CREATE PROCEDURE `pst_add_library`(
                      IN p_user_id VARCHAR(254),
											IN p_library_id VARCHAR(36), 
											IN p_name VARCHAR(80), 
                      IN p_time_zone VARCHAR(80),
											IN p_description LONGTEXT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE default_folder_id_compressed BINARY(16);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Create the library.    
  INSERT INTO 
    pst_libraries(library_id, name, time_zone, description)
  VALUES
    (library_id_compressed, p_name, p_time_zone, p_description);

  -- Create the root folder in the library.
  SET default_folder_id_compressed = pst_compress_guid(uuid());
  CALL pst_add_folder_core(
            p_user_id, 
            library_id_compressed, 
            default_folder_id_compressed, 
            'All Pictures', 
            NULL);

  -- Grant the creator full access to the library.
  CALL pst_add_owner_object_user(
          p_user_id, 
          library_id_compressed, 
          'library', 
          library_id_compressed);

  -- Grant the system user full access to the library.
  CALL pst_add_owner_object_user(
          'system.user@picstrata.api', 
          library_id_compressed, 
          'library', 
          library_id_compressed);

  COMMIT;

	SELECT 
		p_library_id AS library_id,
		p_name AS name,
    p_time_zone as time_zone,
		p_description AS description,
    'owner' AS user_role;

END $$

-- Update pst_get_libraries to use pst_object_users.
DROP PROCEDURE IF EXISTS `pst_get_libraries` $$
CREATE PROCEDURE `pst_get_libraries`(IN p_user_id VARCHAR(254))
BEGIN
	
  -- Users can retrieve library info for any library in which they have
  -- some object access (e.g. if a folder has been shared with them).
  SELECT 
    pst_expand_guid(l.library_id) AS library_id, 
    l.name, 
    l.description, 
    pst_get_library_user_role(p_user_id, l.library_id) AS user_role
  FROM
    pst_libraries l
  WHERE 
    l.library_id IN 
      (SELECT DISTINCT library_id FROM pst_object_users WHERE user_id = p_user_id);

END $$

-- Update pst_get_library to use pst_object_users.
DROP PROCEDURE IF EXISTS `pst_get_library` $$
CREATE PROCEDURE `pst_get_library`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36))
BEGIN

  -- Users can retrieve library info for any library in which they have
  -- some object access (e.g. if a folder has been shared with them).
	SELECT
		pst_expand_guid(l.library_id) AS library_id,
		l.name,
    l.time_zone,
		l.description,
    pst_get_library_user_role(p_user_id, l.library_id) AS user_role
	FROM
    pst_libraries l
	WHERE
		l.library_id = pst_compress_guid(p_library_id) AND
    l.library_id IN
      (SELECT DISTINCT library_id FROM pst_object_users WHERE user_id = p_user_id);
        
END $$

-- Update pst_update_library to use pst_object_users.
DROP PROCEDURE IF EXISTS `pst_update_library` $$
CREATE PROCEDURE `pst_update_library`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_time_zone VARCHAR(80),
                    IN p_description LONGTEXT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE user_role VARCHAR(20);
  DECLARE user_is_participant BOOLEAN;

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(object_id) > 0 INTO user_is_participant FROM pst_object_users 
  WHERE library_id = library_id_compressed AND user_id = p_user_id;
  IF (NOT user_is_participant) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library not found.';
  END IF;

  -- Only owners and contributors on a library can update it.
  SET user_role = pst_get_library_user_role(p_user_id, library_id_compressed);
  IF (user_role IS NULL OR (user_role <> 'owner' AND user_role <> 'contributor')) THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to update the library.';
  END IF;

	UPDATE
		pst_libraries
	SET
		name = p_name,
    time_zone = p_time_zone,
		description = p_description
	WHERE
		library_id = library_id_compressed;
        
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library not found.';
  END IF;

	SELECT
		pst_expand_guid(l.library_id) AS library_id,
		l.name,
    l.time_zone,
		l.description,
    user_role
	FROM
    pst_libraries l
	WHERE
		l.library_id = pst_compress_guid(p_library_id);

END $$

-- Update pst_delete_library to use pst_object_users instead of pst_folder_user_roles.
-- Also clean up pst_albums on library delete.
DROP PROCEDURE IF EXISTS `pst_delete_library` $$
CREATE PROCEDURE `pst_delete_library`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE user_role VARCHAR(20);
  DECLARE user_is_participant BOOLEAN;
  DECLARE affected_rows BIGINT;

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(object_id) > 0 INTO user_is_participant FROM pst_object_users 
  WHERE library_id = library_id_compressed AND user_id = p_user_id;
  IF (NOT user_is_participant) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library not found.';
  END IF;

  -- Only owners on a library can delete it.
  SET user_role = pst_get_library_user_role(p_user_id, library_id_compressed);
  IF (user_role IS NULL OR user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to delete the library.';
  END IF;

  tran_block:BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION 
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

    START TRANSACTION;

    -- Delete pst_files in the library first.
    DELETE FROM
      pst_file_tags
    WHERE
      library_id = library_id_compressed;

    DELETE FROM
      pst_files
    WHERE
      library_id = library_id_compressed;

    -- Delete permissions assigned to the library and children.
    DELETE FROM 
      pst_object_users
    WHERE
      library_id = library_id_compressed;

    -- Delete child pst_folders next.
    DELETE FROM
      pst_folders
    WHERE
      library_id = library_id_compressed;

    -- And then pst_albums.
    DELETE FROM
      pst_albums
    WHERE
      library_id = library_id_compressed;

    -- Now delete the library itself.
    DELETE FROM
      pst_libraries
    WHERE
      library_id = library_id_compressed;
          
    SELECT ROW_COUNT() INTO affected_rows;

    COMMIT;
  END;

	SELECT
		CASE 
			WHEN affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			'No rows were modified by delete statement.' as err_context;

	SELECT
			p_library_id AS library_id;
	
END $$

-- Update pst_add_folder so that it doesn't return removed columns.
DROP PROCEDURE IF EXISTS `pst_add_folder` $$
CREATE PROCEDURE `pst_add_folder`(
                  IN p_user_id VARCHAR(254),
                  IN p_library_id VARCHAR(36), 
                  IN p_folder_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- Make sure the user has permission to create pst_folders under the parent.
  SET user_role = COALESCE(pst_get_folder_user_role(p_user_id, library_id_compressed, pst_compress_guid(p_parent_id)), '');
  IF (user_role <> 'owner' AND user_role <> 'contributor') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to create folders.';
  END IF;

  START TRANSACTION;

  CALL pst_add_folder_core(
            p_user_id, 
            library_id_compressed, 
            folder_id_compressed,
            p_name,
            pst_compress_guid(p_parent_id));

  COMMIT;

  SELECT
		pst_expand_guid(library_id) AS library_id,
		pst_expand_guid(folder_id) AS folder_id,
		name,
		pst_expand_guid(parent_id) AS parent_id,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    file_size_cnv_video,
   'owner' AS user_role
  FROM
    pst_folders
  WHERE
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

END $$

-- Change pst_get_folders to use pst_get_folder_user_role and to
-- stop returning columns that have been removed from pst_folders.
DROP PROCEDURE IF EXISTS `pst_get_folders` $$
CREATE PROCEDURE `pst_get_folders`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_parent_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE parent_id_compressed BINARY(16);
  DECLARE user_role VARCHAR(20);

  IF p_parent_id IS NOT NULL THEN
    SET parent_id_compressed = pst_compress_guid(p_parent_id);
  ELSE
    SET parent_id_compressed = NULL;
  END IF;

  -- Make sure the user has permission to see pst_folders under the parent.
  SET user_role = pst_get_folder_user_role(
              p_user_id, 
              library_id_compressed, 
              IF (p_parent_id IS NULL, NULL, parent_id_compressed));

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Parent folder not found.';
  END IF;

	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS user_role
	FROM
    pst_folders f
  WHERE
    f.library_id = library_id_compressed AND
    (f.parent_id = parent_id_compressed OR (p_parent_id IS NULL AND f.parent_id IS NULL))
	ORDER BY
		name;

END $$

-- Update pst_get_folder to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_get_folder` $$
CREATE PROCEDURE `pst_get_folder`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);

  -- Make sure the user has permission to see the folder.
  SET user_role = pst_get_folder_user_role(
                p_user_id, 
                library_id_compressed, 
                folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS user_role
	FROM
    pst_folders f 
  WHERE
    f.library_id = library_id_compressed AND
    f.folder_id = folder_id_compressed;

END $$

-- Update pst_update_folder to use pst_get_folder_user_role and to also avoid
-- returning columns that have been removed from folders.
DROP PROCEDURE IF EXISTS `pst_update_folder` $$
CREATE PROCEDURE `pst_update_folder`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_folder_id VARCHAR(36), 
                      IN p_name VARCHAR(80))
BEGIN
  	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);
  DECLARE old_name VARCHAR(80);
  DECLARE old_path VARCHAR(255);
  DECLARE parent_path VARCHAR(255);
  DECLARE new_path VARCHAR(255);
  DECLARE old_path_len INT;
  DECLARE affected_rows BIGINT;

  -- Make sure the user has permission to update the folder.
  SET user_role = pst_get_folder_user_role(
                p_user_id, 
                library_id_compressed, 
                folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

  IF (user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to update the folder.';
  END IF;

  -- TODO UNDONE Create an index on path.

  -- Grab the current name and path for the folder.
  SELECT 
    name, `path` 
  INTO 
    old_name, old_path
  FROM
    pst_folders
  WHERE
		library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

  -- Break out the root.
  SET parent_path = 
    LEFT
    (
      old_path, 
      LENGTH(old_path) - LENGTH(SUBSTRING_INDEX(old_path, '/', -1)) -1
    );

  -- Calculate the new path for the folder and make
  -- sure to trim any leading slash.
  SET new_path = CONCAT(parent_path, '/', p_folder_id);
  IF (STRCMP(LEFT(new_path, 1), '/') = 0) THEN 
    SET new_path = SUBSTRING(new_path, 2);
  END IF;

  UPDATE
		pst_folders
	SET
		name = p_name,
    `path` = new_path
	WHERE
		library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

	SELECT ROW_COUNT() INTO affected_rows;
  IF affected_rows = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

  -- If we successfully renamed the folder then make sure
  -- the path values for any children are also updated.
  IF (affected_rows = 1) THEN
    SET old_path_len = LENGTH(old_path);
    UPDATE
      pst_folders
    SET 
      `path` = CONCAT(new_path, RIGHT(`path`, LENGTH(`path`) - old_path_len))
    WHERE
      library_id = library_id_compressed AND
      `path` LIKE CONCAT(old_path, '/%');
  END IF;  

  SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS user_role
  FROM
    pst_folders f 
  WHERE
    f.library_id = library_id_compressed AND
    f.folder_id = folder_id_compressed;

END $$

-- Update pst_delete_folder to use pst_get_folder_user_role
DROP PROCEDURE IF EXISTS `pst_delete_folder` $$
CREATE PROCEDURE `pst_delete_folder`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);
  DECLARE affected_rows BIGINT;

  -- Make sure the user has permission to update the folder.
  SET user_role = pst_get_folder_user_role(
                p_user_id, 
                library_id_compressed, 
                folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library not found.';
  END IF;

  IF (user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to delete the folder.';
  END IF;

  START TRANSACTION;

  -- Recursively delete any permissions associated with the folder tree.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM pst_folders
    WHERE library_id = library_id_compressed AND folder_id = folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN pst_folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    pst_object_users
  WHERE
    library_id = library_id_compressed AND
    object_type = 'folder' AND
    object_id IN (SELECT folder_id FROM folder_tree);

  -- Delete the pst_files in this folder and any folder that is
  -- a descendant of this folder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM pst_folders
    WHERE library_id = library_id_compressed AND folder_id = folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN pst_folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    pst_files
  WHERE
    library_id = library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

  -- Now delete the pst_folders.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM pst_folders
    WHERE 
      library_id = library_id_compressed AND 
      folder_id = folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN pst_folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    pst_folders
  WHERE
    library_id = library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

	SELECT ROW_COUNT() INTO affected_rows;

  COMMIT;

  IF affected_rows = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

	SELECT
			p_library_id AS library_id,
      p_folder_id AS folder_id;
	
END $$

-- Update pst_get_folder_breadcrumbs to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_get_folder_breadcrumbs` $$
CREATE PROCEDURE `pst_get_folder_breadcrumbs`(
                    p_user_id VARCHAR(254), 
                    p_library_id VARCHAR(36), 
                    p_folder_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);

  -- Make sure the user has permission to see the folder.
  SET user_role = pst_get_folder_user_role(
                p_user_id, 
                library_id_compressed, 
                folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

  -- Walk the folder tree from the specified folder all the way to the
  -- root looking for the most privileged role assigned to the user.
  -- A higher-ranked role on a parent folder overrides a lower-ranked
  -- role on a subfolder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name, role) AS
  (
    SELECT 
      f.library_id, 
      f.folder_id, 
      f.parent_id, 
      f.name,
      pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS role
    FROM 
      pst_folders f
    WHERE 
      f.library_id = library_id_compressed AND 
      f.folder_id = folder_id_compressed
      
    UNION ALL
      
    SELECT 
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par.name,
      pst_get_folder_user_role(p_user_id, par.library_id, par.folder_id) AS role
    FROM 
      folder_tree AS ft JOIN pst_folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id
  )
  SELECT 
    pst_expand_guid(f.library_id) AS library_id,
    pst_expand_guid(f.folder_id) AS folder_id,
    f.name
  FROM 
    folder_tree f
  WHERE
    f.role IS NOT NULL AND
    f.folder_id <> folder_id_compressed
  ORDER BY 
    name;

END $$

-- Update pst_add_file to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_add_file` $$
CREATE PROCEDURE `pst_add_file`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36),
                    IN p_file_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_mime_type VARCHAR(45), 
                    IN p_is_video BIT(1),
                    IN p_height INT,
                    IN p_width INT,
                    IN p_file_size INT,
                    IN p_is_processing BIT(1))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE suffix INT;
  DECLARE idx INT;
  DECLARE base VARCHAR(80);
  DECLARE ext VARCHAR(80);
  DECLARE filename VARCHAR(80);
  DECLARE existing BINARY(16);
  DECLARE user_role VARCHAR(20);

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1022, MESSAGE_TEXT = 'Duplicate item exists.';
  END;

  -- Figure out if the user has permissions on the folder.
  SET user_role = pst_get_folder_user_role(p_user_id, library_id_compressed, folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library or folder not found.';
  END IF;

  IF (user_role = 'reader') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to add files to this folder.';
  END IF;

  -- Check for existing pst_files with the same name.
  SET suffix = 1;
  SET idx = CHAR_LENGTH(p_name) - LOCATE('.', REVERSE(p_name)) + 1;
  SET base = LEFT(p_name, idx - 1);
  SET ext = SUBSTRING(p_name, idx);
  SET filename = p_name;
  SELECT 
    file_id INTO existing 
  FROM
    pst_files
  WHERE 
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed AND
    name = filename;
  find_existing_file: WHILE existing IS NOT NULL AND suffix <= 999 DO 
    SET suffix = suffix + 1;
    SET existing = NULL;
    SET filename = CONCAT(base, ' (', CONVERT(suffix, CHAR), ')', ext);
    SELECT 
      file_id INTO existing 
    FROM
      pst_files
    WHERE 
      library_id = library_id_compressed AND
      folder_id = folder_id_compressed AND
      name = filename;
  END WHILE find_existing_file;

  INSERT INTO
    pst_files(
      library_id,
      folder_id,
      file_id,
      name,
      mime_type,
      is_video,
      height,
      width,
      imported_on,
      file_size,
      file_size_cnv_video,
      is_processing
    )
  VALUES 
    (
      library_id_compressed,
      folder_id_compressed,
      file_id_compressed,
      filename,
      p_mime_type,
      p_is_video,
      p_height,
      p_width,
      UTC_TIMESTAMP(),
      p_file_size,
      CASE WHEN p_is_video = 1 AND p_mime_type = 'video/mp4' THEN 0 ELSE NULL END,
      p_is_processing
    );

  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

END $$

-- Update pst_get_files to use pst_get_folder_user_role
DROP PROCEDURE IF EXISTS `pst_get_files` $$
CREATE PROCEDURE `pst_get_files`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);

  -- Figure out if the user has permissions on the folder.
  SET user_role = pst_get_folder_user_role(p_user_id, library_id_compressed, folder_id_compressed);
  
  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library or folder not found.';
  END IF;
  
	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
    pst_expand_guid(f.file_id) AS file_id,
		f.name,
		f.mime_type,
    f.is_video,
    f.height,
    f.width,
    f.imported_on,
    f.taken_on,
    f.modified_on,
    f.rating,
    f.title,
    f.comments,
    f.camera_make,
    f.camera_model,
    f.latitude,
    f.longitude,
    f.altitude,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.file_size_backup,
    f.is_processing,
    t.tags
	FROM
		pst_files f LEFT JOIN
      pst_vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id
  WHERE
    f.library_id = library_id_compressed AND
    f.folder_id = folder_id_compressed
	ORDER BY
		name, imported_on;

END $$

-- Update pst_get_file to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_get_file` $$
CREATE PROCEDURE `pst_get_file`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_file_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE user_role VARCHAR(20);

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);
  
  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

END $$

-- Update pst_get_file_content_info to use _pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_get_file_content_info` $$
CREATE PROCEDURE `pst_get_file_content_info`(
                        IN p_user_id VARCHAR(254),
                        IN p_library_id VARCHAR(36), 
                        IN p_file_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE user_role VARCHAR(20);

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

	SELECT
		pst_expand_guid(fi.library_id) AS library_id,
		pst_expand_guid(fi.folder_id) AS folder_id,
    pst_expand_guid(fi.file_id) AS file_id,
		fi.mime_type as mime_type,
    fi.name AS name,
    CASE 
      WHEN LENGTH(fo.`path`) > 0 THEN CONCAT(fo.`path`, '/', p_file_id)
      ELSE p_file_id
    END AS `path`,
    fi.is_video,
    fi.is_processing
	FROM
		pst_files fi INNER JOIN pst_folders fo ON fi.folder_id = fo.folder_id
  WHERE
    fi.library_id = library_id_compressed AND
    fi.file_id = file_id_compressed;

END $$

-- Update pst_update_file to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_update_file` $$
CREATE PROCEDURE `pst_update_file`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36),
          IN p_height INT,
          IN p_width INT,
          IN p_taken_on DATETIME,
          IN p_name VARCHAR(80),
          IN p_rating TINYINT,
          IN p_title VARCHAR(80),
          IN p_comments LONGTEXT,
          IN p_camera_make VARCHAR(80),
          IN p_camera_model VARCHAR(80),
          IN p_latitude DECIMAL(15, 10),
          IN p_longitude DECIMAL(15, 10),
          IN p_altitude DECIMAL(15, 10),
          IN p_file_size INT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE user_role VARCHAR(20);

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1022, MESSAGE_TEXT = 'Duplicate item exists.';
  END;

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  IF (user_role = 'reader') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to update the file.';
  END IF;

  UPDATE
    pst_files 
  SET
    taken_on = p_taken_on,
    name = p_name,
    rating = p_rating,
    title = p_title,
    comments = p_comments,
    camera_make = p_camera_make,
    camera_model = p_camera_model,
    latitude = p_latitude,
    longitude = p_longitude,
    altitude = p_altitude,
    height = p_height,
    width = p_width,
    file_size = p_file_size
  WHERE
    library_id = library_id_compressed AND
    file_id = file_id_compressed;

	IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;


  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

END $$

-- Update pst_update_file_thumbnail to properly check permissions.
DROP PROCEDURE IF EXISTS `pst_update_file_thumbnail` $$
CREATE PROCEDURE `pst_update_file_thumbnail`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_thumbnail_size CHAR(2),
          IN p_file_size INT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE file_size INT DEFAULT p_file_size;
  DECLARE user_role VARCHAR(20); 

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  IF (user_role = 'reader') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to update the file.';
  END IF;

  SET @sql = CONCAT(
    'UPDATE 
      pst_files 
    SET 
      file_size_', p_thumbnail_size, ' = ?,
      is_processing = 
        file_size_sm IS NULL OR 
        file_size_md IS NULL OR 
        file_size_lg IS NULL OR
        (is_video = 1 AND file_size_cnv_video IS NULL)
    WHERE 
      library_id = ? AND file_id = ?;');

  PREPARE stmt FROM @sql;
  SET @file_size = file_size;
  SET @library_id_compressed = library_id_compressed;
  SET @file_id_compressed = file_id_compressed;
  EXECUTE stmt USING @file_size, @library_id_compressed, @file_id_compressed;

	IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  DEALLOCATE PREPARE stmt;

  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

END $$

-- Update pst_update_file_cnv_video to properly check for permissions.
DROP PROCEDURE IF EXISTS `pst_update_file_cnv_video` $$
CREATE PROCEDURE `pst_update_file_cnv_video`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_file_size INT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE user_role VARCHAR(20);

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  IF (user_role = 'reader') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to update the file.';
  END IF;

  UPDATE 
    pst_files 
  SET 
    file_size_cnv_video = p_file_size,
    is_processing = 
      file_size_sm IS NULL OR 
      file_size_md IS NULL OR 
      file_size_lg IS NULL
  WHERE 
    library_id = library_id_compressed AND file_id = file_id_compressed;

	IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  CALL pst_get_file_ex(@library_id_compressed, @file_id_compressed);

END $$

-- Update pst_set_file_tags to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_set_file_tags` $$
CREATE PROCEDURE `pst_set_file_tags`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_tags LONGTEXT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE pos INT;
  DECLARE tag VARCHAR(80);
  DECLARE user_role VARCHAR(20);

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  START TRANSACTION;

  DELETE FROM 
    pst_file_tags
  WHERE
    library_id = library_id_compressed AND
    file_id = file_id_compressed;

  SET pos = 1;
  SET tag = pst_split_string(p_tags, '¬', pos);
  insert_tags: WHILE tag IS NOT NULL AND LENGTH(tag) > 0 DO

    INSERT INTO 
      pst_file_tags(library_id, file_id, tag)
    VALUES
      (library_id_compressed, file_id_compressed, tag);

    SET pos = pos + 1;
    SET tag = pst_split_string(p_tags, '¬', pos);
  END WHILE insert_tags;

  COMMIT;

	SELECT
			p_library_id AS library_id,
      p_file_id AS file_id,
      pos - 1 AS tag_count;
	
END $$

-- Update pst_delete_file to use pst_get_folder_user_role.
DROP PROCEDURE IF EXISTS `pst_delete_file` $$
CREATE PROCEDURE `pst_delete_file`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_file_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE user_role VARCHAR(20);
  DECLARE affected_rows BIGINT;

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  IF (user_role = 'reader') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to delete the file.';
  END IF;

	DELETE FROM
		pst_files
	WHERE
		library_id = library_id_compressed AND
    file_id = file_id_compressed;
        
	IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

	SELECT
			p_library_id AS library_id,
      p_file_id AS file_id;
	
END $$

-- Update pst_recalc_folder to stop returning columns that no longer exist.
DROP PROCEDURE IF EXISTS `pst_recalc_folder` $$
CREATE PROCEDURE `pst_recalc_folder`(
          IN p_library_id VARCHAR(36), 
          IN p_folder_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE folder_file_count BIGINT;
  DECLARE folder_file_size BIGINT;
  DECLARE folder_file_size_sm BIGINT;
  DECLARE folder_file_size_md BIGINT;
  DECLARE folder_file_size_lg BIGINT;
  DECLARE folder_file_size_cnv_video BIGINT;
  DECLARE subfolder_file_count BIGINT;
  DECLARE subfolder_file_size BIGINT;
  DECLARE subfolder_file_size_sm BIGINT;
  DECLARE subfolder_file_size_md BIGINT;
  DECLARE subfolder_file_size_lg BIGINT;
  DECLARE subfolder_file_size_cnv_video BIGINT;

  SELECT 
    COALESCE(COUNT(file_id), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv_video), 0) 
  INTO
    folder_file_count,
    folder_file_size, 
    folder_file_size_sm,
    folder_file_size_md,
    folder_file_size_lg,
    folder_file_size_cnv_video
  FROM 
    pst_files 
  WHERE 
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

  SELECT
    COALESCE(SUM(file_count), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv_video), 0) 
  INTO 
    subfolder_file_count,
    subfolder_file_size,
    subfolder_file_size_sm,
    subfolder_file_size_md,
    subfolder_file_size_lg,
    subfolder_file_size_cnv_video
  FROM
    pst_folders
  WHERE
    library_id = library_id_compressed AND
    parent_id = folder_id_compressed;

  UPDATE 
    pst_folders
  SET 
    file_count = folder_file_count + subfolder_file_count,
    file_size = folder_file_size + subfolder_file_size,
    file_size_sm = folder_file_size_sm + subfolder_file_size_sm,
    file_size_md = folder_file_size_md + subfolder_file_size_md,
    file_size_lg = folder_file_size_lg + subfolder_file_size_lg,
    file_size_cnv_video = folder_file_size_cnv_video + subfolder_file_size_cnv_video
  WHERE
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

  IF ROW_COUNT() = 0 THEN
      SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
		name,
		pst_expand_guid(parent_id) AS parent_id,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    file_size_cnv_video
  FROM
    pst_folders
  WHERE
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

END $$

-- Create a new procedure to add albums to a library.
CREATE PROCEDURE `pst_add_album`(
                  IN p_user_id VARCHAR(254),
                  IN p_library_id VARCHAR(36), 
                  IN p_album_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_query TEXT,
                  IN p_where TEXT,
                  IN p_order_by TEXT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE album_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_album_id);
  DECLARE user_role VARCHAR(20);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- Make sure the user has permission to create albums in the library.
  SET user_role = COALESCE(pst_get_library_user_role(p_user_id, library_id_compressed), '');
  IF (user_role <> 'owner' AND user_role <> 'contributor') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to create albums.';
  END IF;

  START TRANSACTION;

  INSERT INTO pst_albums(
      library_id, 
      album_id, 
      name, 
      query, 
      `where`, 
      order_by)
  VALUES (
      library_id_compressed, 
      album_id_compressed, 
      p_name, 
      p_query, 
      p_where, 
      p_order_by);

  CALL pst_add_owner_object_user(
          p_user_id, 
          library_id_compressed, 
          'album', 
          album_id_compressed);

  COMMIT;

  SELECT
		pst_expand_guid(library_id) AS library_id,
		pst_expand_guid(album_id) AS album_id,
		name,
    query,
    `where`,
    order_by,
   'owner' AS user_role
  FROM
    pst_albums
  WHERE
    library_id = library_id_compressed AND
    album_id = album_id_compressed;

END $$

-- Create a new procedure to get the list of albums in a library.
CREATE PROCEDURE `pst_get_albums`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE user_role VARCHAR(20);

  -- Make sure the user has permission to see albums in the library
  SET user_role = pst_get_library_user_role(p_user_id, library_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library not found.';
  END IF;

	SELECT
		pst_expand_guid(a.library_id) AS library_id,
		pst_expand_guid(a.album_id) AS album_id,
		a.name,
    a.query,
    a.`where`,
    a.order_by,
    pst_get_album_user_role(p_user_id, a.library_id, a.album_id) AS user_role
	FROM
    pst_albums a 
  WHERE
    a.library_id = library_id_compressed
	ORDER BY
		name;

END $$

-- Create a new procedure to retrieve an individual album.
CREATE PROCEDURE `pst_get_album`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_album_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE album_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_album_id);
  DECLARE user_role VARCHAR(20);

  -- Make sure the user has permission to see the album.
  SET user_role = pst_get_album_user_role(
                p_user_id, 
                library_id_compressed, 
                album_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Album not found.';
  END IF;

	SELECT
		pst_expand_guid(a.library_id) AS library_id,
		pst_expand_guid(a.album_id) AS album_id,
		a.name,
    a.query,
    pst_get_album_user_role(p_user_id, a.library_id, a.album_id) AS user_role
	FROM
    pst_albums a 
  WHERE
    a.library_id = library_id_compressed AND
    a.album_id = album_id_compressed;

END $$

-- Create a procedure that updates the metadata for an album.
CREATE PROCEDURE `pst_update_album`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_album_id VARCHAR(36), 
                      IN p_name VARCHAR(80),
                      IN p_query TEXT,
                      IN p_where TEXT,
                      IN p_order_by TEXT)
BEGIN
  	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE album_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_album_id);
  DECLARE user_role VARCHAR(20);

  -- Make sure the user has permission to update the album.
  SET user_role = pst_get_album_user_role(
                p_user_id, 
                library_id_compressed, 
                album_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Album not found.';
  END IF;

  IF (user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to update the album.';
  END IF;

  UPDATE
		pst_albums
	SET
		name = p_name,
    query = p_query,
    `where` = p_where,
    order_by = p_order_by
	WHERE
		library_id = library_id_compressed AND
    album_id = album_id_compressed;

	IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Album not found.';
  END IF;

	SELECT
		pst_expand_guid(a.library_id) AS library_id,
		pst_expand_guid(a.album_id) AS album_id,
		a.name,
    a.query,
    a.`where`,
    a.order_by,
    pst_get_album_user_role(p_user_id, a.library_id, a.album_id) AS user_role
	FROM
    pst_albums a 
  WHERE
    a.library_id = library_id_compressed AND
    a.album_id = album_id_compressed;

END $$

-- Create a new procedure to delete an album.
CREATE PROCEDURE `pst_delete_album`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_album_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE album_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_album_id);
  DECLARE user_role VARCHAR(20);
  DECLARE affected_rows BIGINT;

  -- Make sure the user has permission to delete the album.
  SET user_role = pst_get_album_user_role(
                p_user_id, 
                library_id_compressed, 
                album_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Album not found.';
  END IF;

  IF (user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to delete the album.';
  END IF;

  START TRANSACTION;

  DELETE FROM
    pst_object_users
  WHERE
    library_id = library_id_compressed AND
    object_type = 'album' AND
    object_id = album_id_compressed;

  DELETE FROM
    pst_albums
  WHERE
    library_id = library_id_compressed AND
    album_id = album_id_compressed;

	SELECT ROW_COUNT() INTO affected_rows;

  COMMIT;

  IF affected_rows = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Album not found.';
  END IF;

	SELECT
			p_library_id AS library_id,
      p_album_id AS album_id;
	
END $$

-- Create a new procedure to retrieve the files in an album.
CREATE PROCEDURE `pst_get_album_files`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_album_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE album_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_album_id);
  DECLARE user_role VARCHAR(20);
  DECLARE album_where TEXT;
  DECLARE album_order_by TEXT;

  -- Figure out if the user has permissions on the album.
  SET user_role = pst_get_album_user_role(p_user_id, library_id_compressed, album_id_compressed);
  
  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Album not found.';
  END IF;
  
  SELECT `where`, order_by INTO album_where, album_order_by
  FROM pst_albums 
  WHERE library_id = library_id_compressed AND album_id = album_id_compressed;

  SET @sql = 
	'SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
    pst_expand_guid(f.file_id) AS file_id,
		f.name,
		f.mime_type,
    f.is_video,
    f.height,
    f.width,
    f.imported_on,
    f.taken_on,
    f.modified_on,
    f.rating,
    f.title,
    f.comments,
    f.camera_make,
    f.camera_model,
    f.latitude,
    f.longitude,
    f.altitude,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.file_size_backup,
    f.is_processing,
    t.tags
	FROM
		pst_files f 
      INNER JOIN pst_folders fo ON
        f.library_id = fo.library_id AND
        f.folder_id = fo.folder_id
      LEFT JOIN pst_vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id ';

  SET @sql = CONCAT(@sql, 'WHERE f.library_id = pst_compress_guid(\'', p_library_id, '\') ');
  IF (album_where) IS NOT NULL THEN
    SET @sql = CONCAT(@sql, 'AND ', album_where, ' ');
  END IF;
  IF album_order_by IS NOT NULL THEN
    SET @sql = CONCAT(@sql, 'ORDER BY ', album_order_by);
  END IF;

  SET @sql = @sql;
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;

END $$

DELIMITER ;