ALTER TABLE file_tags 
  DROP PRIMARY KEY, 
  DROP COLUMN folder_id, 
  DROP COLUMN tag_id,
  CHANGE library_id library_id binary(16),
  CHANGE file_id file_id binary(16),
  ADD tag VARCHAR(80),
  ADD PRIMARY KEY(library_id, file_id, tag);

DROP TABLE tags;

ALTER TABLE files
  DROP COLUMN subject;

DELIMITER $$

/*
 * Create a view to retrieve the tags for a file as a delimited string.
 */
CREATE VIEW vw_file_tags AS 
  -- We use the logical not sign (&#172, 0xAC) to separate tags.
  SELECT 
    library_id, 
    file_id, 
    GROUP_CONCAT(tag SEPARATOR '¬') AS tags 
  FROM 
    file_tags 
  GROUP BY 
    library_id, 
    file_id; $$

/*
 * Create a procedure to retrieve a file by ID extended with tag information.
 */
 
CREATE PROCEDURE `get_file_ex` (IN p_library_id BINARY(16), p_file_id BINARY(16))
this_proc:BEGIN

  SELECT
      expand_guid(f.library_id) AS library_id,
      expand_guid(f.folder_id) AS folder_id,
      expand_guid(f.file_id) AS file_id,
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
      f.file_size,
      f.file_size_sm,
      f.file_size_md,
      f.file_size_lg,
      f.file_size_cnv_video,
      f.file_size_backup,
      f.is_processing,
      t.tags
    FROM
      files f LEFT JOIN
        vw_file_tags t ON
          f.library_id = t.library_id AND
          f.file_id = t.file_id
    WHERE
      f.library_id = p_library_id AND
      f.file_id = p_file_id;

END $$

/*
 * Change update_file to accept comments and drop subject.
 */
DROP PROCEDURE IF EXISTS `update_file`$$

CREATE PROCEDURE `update_file`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36),  
          IN p_name VARCHAR(80),
          IN p_rating TINYINT,
          IN p_title VARCHAR(80),
          IN p_comments LONGTEXT)
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not Found */
      'File does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role = 'reader') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to modify file.' AS err_context;
    LEAVE this_proc;
  END IF;

  UPDATE
    files 
  SET
    name = p_name,
    rating = p_rating,
    title = p_title,
    comments = p_comments
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  CALL get_file_ex(@library_id_compressed, @file_id_compressed);

END $$

/*
 * Change get_files so that it no longer fetches subject.
 */
DROP PROCEDURE IF EXISTS `get_files`$$

CREATE PROCEDURE `get_files`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
this_proc:BEGIN
	
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  -- Figure out if the user has permissions on the folder.
  SET @role = get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);
  
  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library or folder not found.' as err_context;
    LEAVE this_proc;
  END IF;
  
  SELECT
    0 AS err_code,
    NULL AS err_context;
    
	SELECT
		expand_guid(f.library_id) AS library_id,
		expand_guid(f.folder_id) AS folder_id,
    expand_guid(f.file_id) AS file_id,
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
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.file_size_backup,
    f.is_processing,
    t.tags
	FROM
		files f LEFT JOIN
      vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.folder_id = @folder_id_compressed
	ORDER BY
		name, imported_on;

END$$


/*
 * Change get_file so that it no longer fetches subject.
 */
DROP PROCEDURE IF EXISTS `get_file`$$

CREATE PROCEDURE `get_file`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_file_id VARCHAR(36))
this_proc:BEGIN
	
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);
  
  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'File not found.' as err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;

  CALL get_file_ex(@library_id_compressed, @file_id_compressed);

END$$

/*
 * Change update_file_thumbnail so that it no longer fetches subject.
 */
DROP PROCEDURE IF EXISTS `update_file_thumbnail`$$

CREATE PROCEDURE `update_file_thumbnail`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_thumbnail_size CHAR(2),
          IN p_file_size INT)
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  SET @sql = CONCAT(
    'UPDATE 
      files 
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
  EXECUTE stmt USING @file_size, @library_id_compressed, @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  DEALLOCATE PREPARE stmt;

  CALL get_file_ex(@library_id_compressed, @file_id_compressed);

END $$

/*
 * Change update_file_cnv_video so that it no longer fetches subject.
 */
DROP PROCEDURE IF EXISTS `update_file_cnv_video`$$

CREATE PROCEDURE `update_file_cnv_video`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_file_size INT)
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  UPDATE 
    files 
  SET 
    file_size_cnv_video = p_file_size,
    is_processing = 
      file_size_sm IS NULL OR 
      file_size_md IS NULL OR 
      file_size_lg IS NULL
  WHERE 
    library_id = @library_id_compressed AND file_id = @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  CALL get_file_ex(@library_id_compressed, @file_id_compressed);

END $$

/*
 * Create a function that returns a specific token in a delimited string.
 */
CREATE FUNCTION `split_string`(
	p_str LONGTEXT,
	p_delim VARCHAR(12),
	p_pos INT
) RETURNS VARCHAR(80) CHARSET latin1 
BEGIN
  RETURN REPLACE(
    SUBSTRING(
      SUBSTRING_INDEX(p_str, p_delim, p_pos) ,
      CHAR_LENGTH(
        SUBSTRING_INDEX(p_str, p_delim , p_pos - 1)
      ) + 1
    ),
    p_delim,
    ''
  );
END $$

/*
 * Create a routine that sets the tags associated with a file.
 */
CREATE PROCEDURE `set_file_tags`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_tags LONGTEXT)
this_proc:BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not Found */
      'File does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  START TRANSACTION;

  DELETE FROM 
    file_tags
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  SET @pos = 1;
  SET @tag = split_string(p_tags, '¬', @pos);
  insert_tags: WHILE @tag IS NOT NULL AND LENGTH(@tag) > 0 DO

    INSERT INTO 
      file_tags(library_id, file_id, tag)
    VALUES
      (@library_id_compressed, @file_id_compressed, @tag);

    SET @pos = @pos + 1;
    SET @tag = split_string(p_tags, '¬', @pos);
  END WHILE insert_tags;

  COMMIT;

	SELECT
		0
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id,
      p_file_id AS file_id,
      @pos - 1 AS tag_count;
	
END $$


/*
 * Change add_file so that it sets file_size_cnv_video to 0 for
 * video files of type video/mp4 (no conversion necessary).
 */
DROP PROCEDURE IF EXISTS `add_file`$$

CREATE PROCEDURE `add_file`(
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
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);
  SET @file_id_compressed = compress_guid(p_file_id);

  -- Figure out if the user has permissions on the folder.
  SET @role = get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not found */
      'Library or folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role = 'reader') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to add files to this folder.' AS err_context;
    LEAVE this_proc;
  END IF;

  -- Check for existing files with the same name.
  SET @suffix = 1;
  SET @idx = CHAR_LENGTH(p_name) - LOCATE('.', REVERSE(p_name)) + 1;
  SET @base = LEFT(p_name, @idx - 1);
  SET @ext = SUBSTRING(p_name, @idx);
  SET @name = p_name;
  SELECT 
    p_file_id INTO @existing 
  FROM
    files
  WHERE 
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed AND
    name = @name;
  find_existing_file: WHILE @existing IS NOT NULL AND @suffix <= 999 DO 
    SET @suffix = @suffix + 1;
    SET @existing = NULL;
    SET @name = CONCAT(@base, ' (', CONVERT(@suffix, CHAR), ')', @ext);
    SELECT 
      p_file_id INTO @existing 
    FROM
      files
    WHERE 
      library_id = @library_id_compressed AND
      folder_id = @folder_id_compressed AND
      name = @name;
  END WHILE find_existing_file;

  SET @imported_on = UTC_TIMESTAMP();

  INSERT INTO
    files(
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
      @library_id_compressed,
      @folder_id_compressed,
      @file_id_compressed,
      @name,
      p_mime_type,
      p_is_video,
      p_height,
      p_width,
      @imported_on,
      p_file_size,
      CASE WHEN p_is_video = 1 AND p_mime_type = 'video/mp4' THEN 0 ELSE NULL END,
      p_is_processing
    );

	SELECT
    0 AS err_code,
    NULL as err_context;

  CALL get_file_ex(@library_id_compressed, @file_id_compressed);

END$$


/*
 * Change delete_library so that it deletes tags used in the library.
 */
DROP PROCEDURE IF EXISTS `delete_library`$$

CREATE PROCEDURE `delete_library`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(folder_id) > 0 INTO @user_is_participant FROM folder_user_roles 
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (NOT @user_is_participant) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library does not exist.' as err_context;
    LEAVE this_proc;
  END IF;

  -- Only owners on a library can delete it.
  SELECT user_role INTO @role FROM vw_library_user_roles
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (@role IS NULL OR @role <> 'owner') THEN
    SELECT 
      9 AS err_code,        /* Not authorized */
      'User is not authorized to delete the library.' as err_context;
    LEAVE this_proc;
  END IF;

  tran_block:BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION 
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

    START TRANSACTION;

    -- Delete files in the library first.
    DELETE FROM
      file_tags
    WHERE
      library_id = @library_id_compressed;

    DELETE FROM
      files
    WHERE
      library_id = @library_id_compressed;

    -- Delete permissions assigned to child folders.
    DELETE FROM 
      folder_user_roles
    WHERE
      library_id = @library_id_compressed;

    -- Delete child folders next.
    DELETE FROM
      folders
    WHERE
      library_id = @library_id_compressed;

    -- Now delete the library itself.
    DELETE FROM
      libraries
    WHERE
      library_id = @library_id_compressed;
          
    SELECT ROW_COUNT() INTO @affected_rows;

    COMMIT;
  END;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			'No rows were modified by delete statement.' as err_context;

	SELECT
			p_library_id AS library_id;
	
END$$


DELIMITER ;