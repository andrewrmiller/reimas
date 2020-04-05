ALTER TABLE files
  ADD COLUMN latitude DECIMAL(15, 10),
  ADD COLUMN longitude DECIMAL(15, 10),
  ADD COLUMN altitude DECIMAL(15, 10);

DELIMITER $$

/*
 * Upate get_file_ex to also return GPS info.
 */
DROP PROCEDURE IF EXISTS `get_file_ex`$$

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
      files f LEFT JOIN
        vw_file_tags t ON
          f.library_id = t.library_id AND
          f.file_id = t.file_id
    WHERE
      f.library_id = p_library_id AND
      f.file_id = p_file_id;

END $$

/*
 * Change get_files to also return GPS coordinates.
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
 * Change update_file to accept GPS coordinates.
 */
DROP PROCEDURE IF EXISTS `update_file`$$

CREATE PROCEDURE `update_file`(
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
          IN p_latitude DECIMAL(15, 10),
          IN p_longitude DECIMAL(15, 10),
          IN p_altitude DECIMAL(15, 10),
          IN p_file_size INT)
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
    taken_on = p_taken_on,
    name = p_name,
    rating = p_rating,
    title = p_title,
    comments = p_comments,
    latitude = p_latitude,
    longitude = p_longitude,
    altitude = p_altitude,
    height = p_height,
    width = p_width,
    file_size = p_file_size
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

DELIMITER ;
