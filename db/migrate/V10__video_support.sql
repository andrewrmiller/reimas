ALTER TABLE files ADD COLUMN file_size_cnv_video int(11) DEFAULT NULL AFTER file_size_lg;
ALTER TABLE folders ADD COLUMN file_size_cnv_video int(11) DEFAULT NULL AFTER file_size_lg;

-- UNDONE: Fix up all the other places where we return file_size*

DELIMITER $$

/*
 * Create a procedure to update the converted video size for a file.
 */
DROP PROCEDURE IF EXISTS `update_file_cnv_video`$$

CREATE PROCEDURE `update_file_cnv_video`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_file_size INT(11))
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  UPDATE 
    files 
  SET 
    file_size_cnv_video = p_file_size,
    is_processing = FALSE
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
    file_size_cnv_video,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

END $$


/*
 * Update the procedure that recalcs a foler's size.
 */
DROP PROCEDURE IF EXISTS `recalc_folder`$$

CREATE PROCEDURE `recalc_folder`(
          IN p_library_id VARCHAR(36), 
          IN p_folder_id VARCHAR(36))
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  SELECT 
    COALESCE(COUNT(file_id), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv_video), 0) 
  INTO
    @folder_file_count,
    @folder_file_size, 
    @folder_file_size_sm,
    @folder_file_size_md,
    @folder_file_size_lg,
    @folder_file_size_cnv_video
  FROM 
    files 
  WHERE 
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  SELECT
    COALESCE(SUM(file_count), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv_video), 0) 
  INTO 
    @subfolder_file_count,
    @subfolder_file_size,
    @subfolder_file_size_sm,
    @subfolder_file_size_md,
    @subfolder_file_size_lg,
    @subfolder_file_size_cnv_video
  FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    parent_id = @folder_id_compressed;

  UPDATE 
    folders
  SET 
    file_count = @folder_file_count + @subfolder_file_count,
    file_size = @folder_file_size + @subfolder_file_size,
    file_size_sm = @folder_file_size_sm + @subfolder_file_size_sm,
    file_size_md = @folder_file_size_md + @subfolder_file_size_md,
    file_size_lg = @folder_file_size_lg + @subfolder_file_size_lg,
    file_size_cnv_video = @folder_file_size_cnv_video + @subfolder_file_size_cnv_video
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

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
    file_size_cnv_video,
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
 * Return file_size_cnv_video from proc.
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
    0 AS file_size_cnv_video,
    NULL AS data,
    NULL AS `where`,
    NULL AS order_by;

END $$

/*
 * Return file_size_cnv_video from proc.
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
    file_size_cnv_video,
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
 * Return file_size_cnv_video from proc.
 */
DROP PROCEDURE IF EXISTS `update_file`$$

CREATE PROCEDURE `update_file`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_name VARCHAR(80),
          IN p_rating TINYINT(4),
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
    file_size_cnv_video,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

END $$

/*
 * Return file_size_cnv_video from proc.
 */
DROP PROCEDURE IF EXISTS `get_files`$$

CREATE PROCEDURE `get_files`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36))
BEGIN
	
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
    file_size_cnv_video,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = compress_guid(p_library_id) AND
    folder_id = compress_guid(p_folder_id)
	ORDER BY
		name, imported_on;

END$$

/*
 * Return file_size_cnv_video from proc.
 */
DROP PROCEDURE IF EXISTS `get_file`$$

CREATE PROCEDURE `get_file`(IN p_library_id VARCHAR(36), IN p_file_id VARCHAR(36))
BEGIN
	
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
    file_size_cnv_video,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = compress_guid(p_library_id) AND
    file_id = compress_guid(p_file_id);

END$$

/*
 * Return file_size_cnv_video from proc.
 */
DROP PROCEDURE IF EXISTS `update_file_thumbnail`$$

CREATE PROCEDURE `update_file_thumbnail`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_thumbnail_size CHAR(2),
          IN p_file_size INT(11))
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  SET @sql = CONCAT(
    'UPDATE 
      files 
    SET 
      file_size_', p_thumbnail_size, ' = ?,
      is_processing = file_size_sm IS NULL OR file_size_md IS NULL OR file_size_lg IS NULL 
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
    file_size_cnv_video,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

END $$



DELIMITER;