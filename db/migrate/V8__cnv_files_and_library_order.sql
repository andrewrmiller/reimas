-- Rename column to be more general.
ALTER TABLE `pst_files`
  RENAME COLUMN `file_size_cnv_video` TO `file_size_cnv`;

ALTER TABLE `pst_folders`
  RENAME COLUMN `file_size_cnv_video` TO `file_size_cnv`;

DELIMITER $$

-- Return libraries ordered by name.
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
      (SELECT DISTINCT library_id FROM pst_object_users WHERE user_id = p_user_id)
  ORDER BY
    l.name;

END $$

-- Update pst_get_file_ex with new column name.
DROP PROCEDURE IF EXISTS `pst_get_file_ex` $$

CREATE PROCEDURE `pst_get_file_ex`(IN p_library_id BINARY(16), p_file_id BINARY(16))
this_proc:BEGIN

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
      f.file_size_cnv,
      f.file_size_backup,
      f.is_processing,
      t.tags
    FROM
      pst_files f LEFT JOIN
        pst_vw_file_tags t ON
          f.library_id = t.library_id AND
          f.file_id = t.file_id
    WHERE
      f.library_id = p_library_id AND
      f.file_id = p_file_id;

END $$


-- Update pst_add_folder to use new column name.
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
    file_size_cnv,
   'owner' AS user_role
  FROM
    pst_folders
  WHERE
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

END $$

-- Change pst_get_folders to use new column name.
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
    f.file_size_cnv,
    pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS user_role
	FROM
    pst_folders f
  WHERE
    f.library_id = library_id_compressed AND
    (f.parent_id = parent_id_compressed OR (p_parent_id IS NULL AND f.parent_id IS NULL))
	ORDER BY
		name;

END $$

-- Update pst_get_folder to use new column name.
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
    f.file_size_cnv,
    pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS user_role
	FROM
    pst_folders f 
  WHERE
    f.library_id = library_id_compressed AND
    f.folder_id = folder_id_compressed;

END $$

-- Update pst_update_folder to use new column name.
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
    f.file_size_cnv,
    pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS user_role
  FROM
    pst_folders f 
  WHERE
    f.library_id = library_id_compressed AND
    f.folder_id = folder_id_compressed;

END $$

-- Update pst_add_file to use new column name.
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
      file_size_cnv,
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
      null,
      p_is_processing
    );

  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

END $$

-- Update pst_get_files to use new column name.
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
    f.file_size_cnv,
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

-- Update pst_update_file_thumbnail to use new column name.
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
        (mime_type IN (''image/tiff'', ''video/quicktime'', ''video/x-ms-wmv'', ''video/x-msvideo'') AND file_size_cnv IS NULL)
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

-- Fix a bug in pst_update_file_cnv_video caused by variable conversion.
-- Also rename to be more general.
DROP PROCEDURE IF EXISTS `pst_update_file_cnv_video` $$
CREATE PROCEDURE `pst_update_file_cnv_size`(
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
    file_size_cnv = p_file_size,
    is_processing = 
      file_size_sm IS NULL OR 
      file_size_md IS NULL OR 
      file_size_lg IS NULL
  WHERE 
    library_id = library_id_compressed AND file_id = file_id_compressed;

	IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

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
  DECLARE folder_file_size_cnv BIGINT;
  DECLARE subfolder_file_count BIGINT;
  DECLARE subfolder_file_size BIGINT;
  DECLARE subfolder_file_size_sm BIGINT;
  DECLARE subfolder_file_size_md BIGINT;
  DECLARE subfolder_file_size_lg BIGINT;
  DECLARE subfolder_file_size_cnv BIGINT;

  SELECT 
    COALESCE(COUNT(file_id), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv), 0) 
  INTO
    folder_file_count,
    folder_file_size, 
    folder_file_size_sm,
    folder_file_size_md,
    folder_file_size_lg,
    folder_file_size_cnv
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
    COALESCE(SUM(file_size_cnv), 0) 
  INTO 
    subfolder_file_count,
    subfolder_file_size,
    subfolder_file_size_sm,
    subfolder_file_size_md,
    subfolder_file_size_lg,
    subfolder_file_size_cnv
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
    file_size_cnv = folder_file_size_cnv + subfolder_file_size_cnv
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
    file_size_cnv
  FROM
    pst_folders
  WHERE
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed;

END $$

-- Update pst_get_album_files to use new column name.
DROP PROCEDURE IF EXISTS `pst_get_album_files` $$
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
    f.file_size_cnv,
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