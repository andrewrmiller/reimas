-- Add a time_zone column to libraries.
ALTER TABLE libraries   
  ADD COLUMN `time_zone` VARCHAR(80) NOT NULL;

DELIMITER $$

/*
 * Update add_library to take a time zone.
 */
DROP PROCEDURE IF EXISTS `add_library`$$

CREATE PROCEDURE `add_library`(
                      IN p_user_id VARCHAR(254),
											IN p_library_id VARCHAR(36), 
											IN p_name VARCHAR(80), 
                      IN p_time_zone VARCHAR(80),
											IN p_description LONGTEXT)
BEGIN

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Create the library.    
  INSERT INTO 
    libraries(library_id, name, time_zone, description)
  VALUES
    (compress_guid(p_library_id), p_name, p_time_zone, p_description);

  -- Create the root folder in the library.
  SET @default_folder_id = uuid();
  CALL add_folder_core(
            p_user_id, 
            p_library_id, 
            @default_folder_id, 
            'All Pictures', 
            NULL, 
            'picture', 
            @err_code,
            @err_context);

  -- Grant the system user full access to the library.
  INSERT INTO
    folder_user_roles (library_id, folder_id, user_id, role)
  VALUES
    (compress_guid(p_library_id), compress_guid(@default_folder_id), 'system.user@picstrata.api', 'owner');

  IF (@err_code <> 0) THEN
    ROLLBACK;
  ELSE
    COMMIT;
  END IF;

	SELECT
		@err_code AS err_code,
		@err_context AS err_context;

	SELECT 
		p_library_id AS library_id,
		p_name AS name,
    p_time_zone as time_zone,
		p_description AS description,
    'owner' AS user_role;

END $$

/*
 * Update update_library to accept a time zone.
 */
DROP PROCEDURE IF EXISTS `update_library`$$

CREATE PROCEDURE `update_library`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_time_zone VARCHAR(80),
                    IN p_description LONGTEXT)
this_proc:BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(folder_id) > 0 INTO @user_is_participant FROM folder_user_roles 
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (NOT @user_is_participant) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      NULL as err_context;
    LEAVE this_proc;
  END IF;

  -- Only owners and contributors on a library can update it.
  SELECT user_role INTO @role FROM vw_library_user_roles
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (@role IS NULL OR (@role <> 'owner' AND @role <> 'contributor')) THEN
    SELECT 
      9 AS err_code,        /* Not authorized */
      'User is not authorized to update the library.' as err_context;
    LEAVE this_proc;
  END IF;

	UPDATE
		libraries
	SET
		name = p_name,
    time_zone = p_time_zone,
		description = p_description
	WHERE
		library_id = @library_id_compressed;
        
	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

	SELECT
		expand_guid(l.library_id) AS library_id,
		l.name,
    l.time_zone,
		l.description,
    ur.role AS user_role
	FROM
    libraries l 
      INNER JOIN folders f 
        ON l.library_id = f.library_id
      LEFT JOIN folder_user_roles ur 
        ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
	WHERE
		l.library_id = compress_guid(p_library_id) AND
    l.library_id IN
      (SELECT DISTINCT library_id FROM folder_user_roles WHERE user_id = p_user_id) AND
    f.parent_id IS NULL AND
    ur.user_id = p_user_id;

END$$

/*
 * Update get_library to return the time zone.
 */
DROP PROCEDURE IF EXISTS `get_library`$$

CREATE PROCEDURE `get_library`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36))
BEGIN

  SELECT
    0 AS err_code,
    NULL AS err_context;

	SELECT
		expand_guid(l.library_id) AS library_id,
		l.name,
    l.time_zone,
		l.description,
    ur.role AS user_role
	FROM
    libraries l 
      INNER JOIN (SELECT * FROM folders WHERE parent_id IS NULL) f
      ON l.library_id = f.library_id
      LEFT JOIN (SELECT * FROM folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
	WHERE
		l.library_id = compress_guid(p_library_id) AND
    l.library_id IN
      (SELECT DISTINCT library_id FROM folder_user_roles WHERE user_id = p_user_id);
        
END$$

/*
 * Change update_file to accept taken on date.
 */
DROP PROCEDURE IF EXISTS `update_file`$$

CREATE PROCEDURE `update_file`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36),
          IN p_taken_on DATETIME,
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
    taken_on = p_taken_on,
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
