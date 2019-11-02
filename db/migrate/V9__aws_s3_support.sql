DELIMITER $$

/*
 * Allow folder ID to be passed into add_folder.
 */
DROP PROCEDURE IF  EXISTS `add_folder`$$

CREATE PROCEDURE `add_folder`(
                  IN p_library_id VARCHAR(36), 
                  IN p_folder_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id VARCHAR(36), 
                  IN p_type VARCHAR(20))
proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  -- Check for invalid characters.
  IF (INSTR(p_name, '/') > 0) THEN
    SELECT 
      8 AS err_code,    -- Invalid field value
      'Invalid character in folder name.' AS err_context;
    LEAVE proc;
  END IF;

  IF (p_parent_id IS NULL) THEN
    BEGIN
      SET @parent_id_compressed = NULL;
      SET @path = p_folder_id;
    END;
  ELSE
    BEGIN
      SET @parent_id_compressed = compress_guid(p_parent_id);

      SELECT 
        CONCAT(`path`, '/', p_folder_id) INTO @path 
      FROM 
        folders 
      WHERE 
        library_id = compress_guid(p_library_id) AND folder_id = @parent_id_compressed;

      -- Trim leading slash if it exists.
      IF (STRCMP(LEFT(@path, 1), '/') = 0) THEN 
        SET @path = SUBSTRING(@path, 2);
      END IF;
    END;
  END IF;

  INSERT INTO 
    folders(library_id, folder_id, name, parent_id, type, `path`)
  VALUES
    (compress_guid(p_library_id), compress_guid(p_folder_id), p_name, @parent_id_compressed, p_type, @path);

	SELECT
    0 AS err_code,
    NULL as err_context;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
		p_name AS name,
		expand_guid(@parent_id_compressed) AS parent_id,
    p_type AS type,
    @path AS `path`,
    0 AS file_count,
    0 AS file_size,
    0 AS file_size_sm,
    0 AS file_size_md,
    0 AS file_size_lg,
    NULL AS data,
    NULL AS `where`,
    NULL AS order_by;

END $$

/*
 * Use folder ID instead of name when computing path.
 */
DROP PROCEDURE IF EXISTS `update_folder`$$

CREATE PROCEDURE `update_folder`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36), IN p_name VARCHAR(80))
BEGIN
  	
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);
  
  -- TODO Create an index on path.

  -- Grab the current name and path for the folder.
  SELECT 
    name, `path` 
  INTO 
    @old_name, @old_path
  FROM
    folders
  WHERE
		library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  -- Break out the root.
  SET @parent_path = 
    LEFT
    (
      @old_path, 
      LENGTH(@old_path) - LENGTH(SUBSTRING_INDEX(@old_path, '/', -1)) -1
    );

  -- Calculate the new path for the folder and make
  -- sure to trim any leading slash.
  SET @new_path = CONCAT(@parent_path, '/', p_folder_id);
  IF (STRCMP(LEFT(@new_path, 1), '/') = 0) THEN 
    SET @new_path = SUBSTRING(@new_path, 2);
  END IF;

  UPDATE
		folders
	SET
		name = p_name,
    `path` = @new_path
	WHERE
		library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

  -- If we successfully renamed the folder then make sure
  -- the path values for any children are also updated.
  IF (@affected_rows = 1) THEN
    SET @old_path_len = LENGTH(@old_path);
    UPDATE
      folders
    SET 
      `path` = CONCAT(@new_path, RIGHT(`path`, LENGTH(`path`) - @old_path_len))
    WHERE
      library_id = @library_id_compressed AND
      `path` LIKE CONCAT(@old_path, '/%');
  END IF;  

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
		name,
		expand_guid(parent_id) AS parent_id,
    type,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    data,
    `where`,
    order_by
  FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

END $$

/*
 * Allow file ID to be passed into add_file and move file
 * name duplication logic into SQL.
 */
DROP PROCEDURE IF EXISTS `add_file`$$

CREATE PROCEDURE `add_file`(
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
proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

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
      is_processing
    )
  VALUES 
    (
      @library_id_compressed,
      @folder_id_compressed,
      compress_guid(p_file_id),
      @name,
      p_mime_type,
      p_is_video,
      p_height,
      p_width,
      @imported_on,
      p_file_size,
      p_is_processing
    );

	SELECT
    0 AS err_code,
    NULL as err_context;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
    p_file_id AS file_id,
		@name AS name,
    p_mime_type AS mime_type,
    p_is_video AS is_video,
    p_height AS height,
    p_width AS width,
    @imported_on AS imported_on,
    p_file_size AS file_size,
    p_is_processing AS is_processing;

END$$

/*
 * Use file ID instead of name when computing path.
 */
DROP PROCEDURE IF EXISTS `get_file_content_info`$$

CREATE PROCEDURE `get_file_content_info`(IN p_library_id VARCHAR(36), IN p_file_id VARCHAR(36))
BEGIN
	
	SELECT
		expand_guid(fi.library_id) AS library_id,
		expand_guid(fi.folder_id) AS folder_id,
    expand_guid(fi.file_id) AS file_id,
		fi.mime_type as mime_type,
    fi.name AS name,
    CASE 
      WHEN LENGTH(fo.`path`) > 0 THEN CONCAT(fo.`path`, '/', p_file_id)
      ELSE p_file_id
    END AS `path`
	FROM
		files fi INNER JOIN folders fo ON fi.folder_id = fo.folder_id
  WHERE
    fi.library_id = compress_guid(p_library_id) AND
    fi.file_id = compress_guid(p_file_id);

END$$

/*
 * Add conflict detection to update_file.
 */
DROP PROCEDURE IF EXISTS `update_file`$$

CREATE PROCEDURE `update_file`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_name VARCHAR(80),
          IN p_rating TINYINT,
          IN p_title VARCHAR(80),
          IN p_subject VARCHAR(80))
proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);
  
  UPDATE
    files 
  SET
    name = p_name,
    rating = p_rating,
    title = p_title,
    subject = p_subject
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

  SELECT
		expand_guid(library_id) AS library_id,
		expand_guid(folder_id) AS folder_id,
    expand_guid(file_id) AS file_id,
		name,
		mime_type,
    is_video,
    height,
    width,
    imported_on,
    taken_on,
    modified_on,
    rating,
    title,
    subject,
    comments,
    file_size,
    file_size_sm,
    file_size_lg,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

END $$


/*
 * Delete files in the folder as well as the folder itself.
 */
DROP PROCEDURE IF EXISTS `delete_folder`$$

CREATE PROCEDURE `delete_folder`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36))
proc:BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  START TRANSACTION;

  SELECT
    path INTO @path
  FROM 
    folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  IF (@path IS NULL) THEN
	SELECT
		1	/* Not Found */
			AS err_code,
			NULL as err_context;
      ROLLBACK;
      LEAVE proc;
  END IF;

  -- Delete the files in this folder and any folder that is
  -- a descendant of this folder.
  DELETE FROM
    files
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (
      SELECT folder_id FROM folders
      WHERE 
        library_id = @library_id_compressed AND
        path LIKE CONCAT(@path, '%'));

  -- Now delete the folders.
  DELETE FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    path LIKE CONCAT(@path, '%');
        
  COMMIT;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		0
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id,
      p_folder_id AS folder_id;
	
END$$



/*
 * Add transaction to delete_library and remember to delete files.
 */
DROP PROCEDURE IF EXISTS `delete_library`$$

CREATE PROCEDURE `delete_library`(IN p_library_id VARCHAR(36))
BEGIN

  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    SET @affected_rows = 0;
    ROLLBACK;
  END;

  SET @library_id_compressed = compress_guid(p_library_id);

  START TRANSACTION;

  -- Delete files in the library first.
  DELETE FROM
    files
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

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id;
	
END$$


DELIMITER ;
