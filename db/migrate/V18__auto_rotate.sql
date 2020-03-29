DELIMITER $$

/*
 * Change update_file to accept dimensions and file size.
 */
DROP PROCEDURE IF EXISTS `update_file`$$

CREATE PROCEDURE `update_file`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36),  
          IN p_name VARCHAR(80),
          IN p_rating TINYINT,
          IN p_title VARCHAR(80),
          IN p_comments LONGTEXT,
          IN p_height INT,
          IN p_width INT,
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
    name = p_name,
    rating = p_rating,
    title = p_title,
    comments = p_comments,
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
