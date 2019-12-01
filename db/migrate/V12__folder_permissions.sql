CREATE TABLE `folder_user_roles` (
  `library_id` BINARY(16) NOT NULL DEFAULT '0',
  `folder_id` BINARY(16) NOT NULL,
  `user_id` BINARY(16) NOT NULL,
  `role` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`library_id`,`folder_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

DELIMITER $$

/*
 * Create a view that returns all libraries along with
 * the user roles that have been granted to those libraries.
 */
CREATE VIEW vw_library_user_roles AS
SELECT
  l.*,
  ur.user_id,
  ur.role AS user_role
FROM
  libraries l 
    INNER JOIN folders f
    ON l.library_id = f.library_id
    LEFT JOIN folder_user_roles ur
    ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
WHERE
  f.parent_id IS NULL; $$


/*
 * Create a function which validates a role value.
 */
CREATE FUNCTION is_valid_role(p_role VARCHAR(20)) RETURNS BOOL DETERMINISTIC
BEGIN
  RETURN 
    p_role IS NOT NULL AND
    (p_role = 'owner' OR p_role = 'contributor' OR p_role = 'reader');
END$$


/*
 * Create a function that returns the "rank" of a role
 * relative to the other roles in the system.
 *
 * The lower the number, the higher the privileges associated
 * with the role.
 */
CREATE FUNCTION get_role_rank(p_role VARCHAR(20)) RETURNS INT DETERMINISTIC
BEGIN
  -- Owners are most privileged.
  IF (p_role = 'owner') THEN
    RETURN 1;
  END IF;

  -- ...then contributors.
  IF (p_role = 'contributor') THEN
    RETURN 2;
  END IF;

  -- ...and finally readers.
  IF (p_role = 'reader') THEN
    RETURN 3;
  END IF;

  -- Any other role is stuffed in bucket 99.
  RETURN 99;
END$$


/*
 * Create a routine that adds a folder but does not select any results.
 */
CREATE PROCEDURE `add_folder_core`(
                  IN p_user_id VARCHAR(36),
                  IN p_library_id VARCHAR(36), 
                  IN p_folder_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id VARCHAR(36), 
                  IN p_type VARCHAR(20),
                  OUT p_err_code INT,
                  OUT p_err_context VARCHAR(80))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SET p_err_code = 2;   /* Duplicate item */
    SET p_err_context = 'Duplicate item exists';
  END;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET p_err_code = 999;     /* Unexpected error */
    SET p_err_context = 'An unexpected error occurred.';
  END;

  -- Check for invalid characters.
  IF (INSTR(p_name, '/') > 0) THEN
    SET p_err_code = 8;    -- Invalid field value
    SET p_err_context = 'Invalid character in folder name.';
    LEAVE this_proc;
  END IF;

  IF (p_parent_id IS NULL) THEN
    BEGIN
      SET @parent_id_compressed = NULL;
      SET @path = '';
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

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  INSERT INTO 
    folders(library_id, folder_id, name, parent_id, type, `path`)
  VALUES
    (@library_id_compressed, @folder_id_compressed, p_name, @parent_id_compressed, p_type, @path);

  INSERT INTO
    folder_user_roles(library_id, folder_id, user_id, role)
  VALUES
    (@library_id_compressed, @folder_id_compressed,  compress_guid(p_user_id), 'owner');

  SET p_err_code = 0;
  SET p_err_context = NULL;
  
END $$

/*
 * Update get_libraries to return the user's role within the library,
 * and so that it only returns the libraries to which the user has
 * some access.
 *
 * The user's role in the library is equivalent to the user's
 * role on the library root folder.
 */
DROP PROCEDURE IF EXISTS `get_libraries`$$

CREATE PROCEDURE `get_libraries`(IN p_user_id VARCHAR(36))
BEGIN
	
  SET @user_id_compressed = compress_guid(p_user_id);

  SELECT
    0 AS err_code,
    NULL AS err_context;
    
  SELECT 
    expand_guid(l.library_id) AS library_id, 
    l.name, 
    l.description, 
    ur.role AS user_role
  FROM
    libraries l 
      INNER JOIN folders f 
      ON l.library_id = f.library_id
      LEFT JOIN (SELECT * FROM folder_user_roles WHERE user_id = @user_id_compressed) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE 
    f.parent_id IS NULL AND
    l.library_id IN 
      (SELECT DISTINCT library_id FROM folder_user_roles WHERE user_id = @user_id_compressed);

END$$


/*
 * Update the procedure which retrieves a specific library so
 * that it returns the user's role within the library, and so that
 * it only returns the library if the user has access.
 *
 * The user's role in the library is equivalent to the user's
 * role on the library root folder.
 */
DROP PROCEDURE IF EXISTS `get_library`$$

CREATE PROCEDURE `get_library`(
                    IN p_user_id VARCHAR(36), 
                    IN p_library_id VARCHAR(36))
BEGIN

  SET @user_id_compressed = compress_guid(p_user_id);

  SELECT
    0 AS err_code,
    NULL AS err_context;

	SELECT
		expand_guid(l.library_id) AS library_id,
		l.name,
		l.description,
    ur.role AS user_role
	FROM
    libraries l 
      INNER JOIN folders f
      ON l.library_id = f.library_id
      LEFT JOIN (SELECT * FROM folder_user_roles WHERE user_id = @user_id_compressed) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
	WHERE
		l.library_id = compress_guid(p_library_id) AND
    l.library_id IN
      (SELECT DISTINCT library_id FROM folder_user_roles WHERE user_id = @user_id_compressed);
        
END$$


/*
 * Update the procedure that creates a library so that it properly
 * saves the role of the person creating the library.
 */
DROP PROCEDURE IF EXISTS `add_library`$$

CREATE PROCEDURE `add_library`(
                      IN p_user_id VARCHAR(36),
											IN p_library_id VARCHAR(36), 
											IN p_name VARCHAR(80), 
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
    libraries(library_id, name, description)
  VALUES
    (compress_guid(p_library_id), p_name, p_description);

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
		p_description AS description,
    'owner' AS user_role;

END $$


/*
 * Update update_library to take permissions into account.
 */
DROP PROCEDURE IF EXISTS `update_library`$$

CREATE PROCEDURE `update_library`(
                    IN p_user_id VARCHAR(36),
                    IN p_library_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_description LONGTEXT)
this_proc:BEGIN

  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(folder_id) > 0 INTO @user_is_participant FROM folder_user_roles 
  WHERE library_id = @library_id_compressed AND user_id = @user_id_compressed;
  IF (NOT @user_is_participant) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      NULL as err_context;
    LEAVE this_proc;
  END IF;

  -- Only owners and contributors on a library can update it.
  SELECT user_role INTO @role FROM vw_library_user_roles
  WHERE library_id = @library_id_compressed AND user_id = @user_id_compressed;
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
      (SELECT DISTINCT library_id FROM folder_user_roles WHERE user_id = @user_id_compressed) AND
    f.parent_id IS NULL AND
    ur.user_id = @user_id_compressed;

END$$

/*
 * Update delete_library so that it properly deletes roles associated with the library.
 */
DROP PROCEDURE IF EXISTS `delete_library`$$

CREATE PROCEDURE `delete_library`(
                      IN p_user_id VARCHAR(36),
                      IN p_library_id VARCHAR(36))
this_proc:BEGIN

  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(folder_id) > 0 INTO @user_is_participant FROM folder_user_roles 
  WHERE library_id = @library_id_compressed AND user_id = @user_id_compressed;
  IF (NOT @user_is_participant) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library does not exist or user is not member.' as err_context;
    LEAVE this_proc;
  END IF;

  -- Only owners on a library can delete it.
  SELECT user_role INTO @role FROM vw_library_user_roles
  WHERE library_id = @library_id_compressed AND user_id = @user_id_compressed;
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


/*
 * Create a routine that adds a user with a given role to 
 * a folder in an existing library.
 */
CREATE PROCEDURE `add_folder_user`(
                      IN p_user_id VARCHAR(36),
                      IN p_library_id VARCHAR(36),
                      IN p_folder_id VARCHAR(36),
                      IN p_new_user_id VARCHAR(36),
                      IN p_role VARCHAR(20))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT
      2 AS err_code,   /* Duplicate item */
      'Duplicate item exists' AS err_context;
  END;

  IF (NOT is_valid_role(p_role)) THEN
    SELECT
      8 AS err_code,      /* Invalid field value */
      'Invalid role value' AS err_context;
    LEAVE this_proc;
  END IF;

  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  SET @role = COALESCE(get_user_role(@user_id_compressed, @library_id_compressed, @folder_id_compressed), '');
  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to grant folder permissions.' AS err_context;
    LEAVE this_proc;
  END IF;

  INSERT INTO
    folder_user_roles (library_id, folder_id, user_id, role)
  VALUES
    (@library_id_compressed, @folder_id_compressed, compress_guid(p_new_user_id), p_role);

  SELECT
    0 AS err_code,
    NULL as err_context;

  SELECT
    p_library_id AS library_id,
    p_folder_id AS folder_id,
    p_new_user_id AS user_id,
    p_role AS role;

END$$


/*
 * Create a routine that retrieves the most privileged role 
 * the user has on a folder.
 *
 * Looks at granted roles on the specified folder as well as
 * any grants on parent folders.
 */
CREATE FUNCTION `get_user_role`(
                    p_user_id BINARY(16), 
                    p_library_id BINARY(16), 
                    p_folder_id BINARY(16)) 
                    RETURNS VARCHAR(20) DETERMINISTIC
BEGIN

  -- If p_folder_id IS NULL the caller wants to get permssions for the
  -- root folder in the library.  We look the folder ID up in this case.
  IF p_folder_id IS NULL THEN
    SELECT folder_id INTO @folder_id FROM folders
    WHERE library_id = p_library_id AND parent_id IS NULL;
  ELSE
    SET @folder_id = p_folder_id;
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
      ur.role,
      get_role_rank(ur.role) AS role_rank
    FROM 
      folders f LEFT JOIN folder_user_roles ur
      ON f.library_id = ur.library_id AND
        f.folder_id = ur.folder_id AND
        ur.user_id = p_user_id
    WHERE 
      f.library_id = p_library_id AND 
      f.folder_id = @folder_id
      
    UNION ALL
      
    SELECT 
      sub.library_id, 
      sub.folder_id, 
      sub.parent_id, 
      sub_ur.role,
      get_role_rank(sub_ur.role) AS role_rank
    FROM 
      (folder_tree AS fp JOIN folders AS sub
      ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id)
      LEFT JOIN folder_user_roles sub_ur
      ON sub.library_id = sub_ur.library_id
      AND sub.folder_id = sub_ur.folder_id
      AND sub_ur.user_id = p_user_id
  )
  SELECT 
    role INTO @user_role
  FROM 
    folder_tree 
  WHERE
    library_id = p_library_id AND
    folder_id = @folder_id
  ORDER BY 
    role_rank
  LIMIT 1;

  RETURN @user_role;

END$$




/*
 * Update the get folders procedure to check user permissions.
 */
DROP PROCEDURE IF EXISTS `get_folders`$$

CREATE PROCEDURE `get_folders`(
                      IN p_user_id VARCHAR(36),
                      IN p_library_id VARCHAR(36), 
                      IN p_parent_id VARCHAR(36))
this_proc:BEGIN
	
  IF p_parent_id IS NOT NULL THEN
    SET @parent_id_compressed = compress_guid(p_parent_id);
  END IF;

  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);
  

  -- Make sure the user has permission to see folders under the parent.
  SET @role = get_user_role(
              @user_id_compressed, 
              @library_id_compressed, 
              IF (p_parent_id IS NULL, NULL, @parent_id_compressed));

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;

	SELECT
		expand_guid(f.library_id) AS library_id,
		expand_guid(f.folder_id) AS folder_id,
		f.name,
		expand_guid(f.parent_id) AS parent_id,
    f.type,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.data,
    f.`where`,
    f.order_by,
    ur.role AS user_role
	FROM
    folders f 
      LEFT JOIN (SELECT * FROM folder_user_roles WHERE user_id = @user_id_compressed) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = compress_guid(p_library_id) AND
    (f.parent_id = @parent_id_compressed OR (p_parent_id IS NULL AND f.parent_id IS NULL)) AND
    @role IS NOT NULL -- UNDONE: see above.
	ORDER BY
		name;

END$$


/*
 * Update get folder procedure to check user permissions.
 */
DROP PROCEDURE IF EXISTS `get_folder`$$

CREATE PROCEDURE `get_folder`(
                    IN p_user_id VARCHAR(36),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
this_proc:BEGIN
	
  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  -- Make sure the user has permission to see the folder.
  SET @role = get_user_role(
                @user_id_compressed, 
                @library_id_compressed, 
                @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL as err_context;

	SELECT
		expand_guid(f.library_id) AS library_id,
		expand_guid(f.folder_id) AS folder_id,
		f.name,
		expand_guid(f.parent_id) AS parent_id,
    f.type,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.data,
    f.`where`,
    f.order_by,
    ur.role AS user_role
	FROM
    folders f 
      LEFT JOIN (SELECT * FROM folder_user_roles WHERE user_id = @user_id_compressed) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.folder_id = @folder_id_compressed;

END$$


/*
 * Update add_folder so that it properly saves the role of the person
 * creating the folder.
 */
DROP PROCEDURE IF  EXISTS `add_folder`$$

CREATE PROCEDURE `add_folder`(
                  IN p_user_id VARCHAR(36),
                  IN p_library_id VARCHAR(36), 
                  IN p_folder_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id VARCHAR(36), 
                  IN p_type VARCHAR(20))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);

  -- Make sure the user has permission to create folders under the parent.
  SET @role = COALESCE(get_user_role(@user_id_compressed, @library_id_compressed, compress_guid(p_parent_id)), '');
  IF (@role <> 'owner' AND @role <> 'contributor') THEN
    SELECT
      9 AS err_code,
      'User is not authorized to create folders.' AS err_context;
    LEAVE this_proc;
  END IF;

  START TRANSACTION;

  CALL add_folder_core(
            p_user_id, 
            p_library_id, 
            p_folder_id,
            p_name,
            p_parent_id, 
            p_type, 
            @err_code,
            @err_context);

  COMMIT;

	SELECT
    @err_code AS err_code,
    @err_context as err_context;

  SELECT
		expand_guid(library_id) AS library_id,
		expand_guid(folder_id) AS folder_id,
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
    order_by,
    'owner' AS user_role
  FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id = compress_guid(p_folder_id);

END $$


/*
 * Update update folder procedure to take user permisisons into account.
 */
DROP PROCEDURE IF EXISTS `update_folder`$$

CREATE PROCEDURE `update_folder`(
                      IN p_user_id VARCHAR(36),
                      IN p_library_id VARCHAR(36), 
                      IN p_folder_id VARCHAR(36), 
                      IN p_name VARCHAR(80))
this_proc:BEGIN
  	
  SET @user_id_compressed = compress_guid(p_user_id);
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);
  
  -- Make sure the user has permission to update the folder.
  SET @role = get_user_role(@user_id_compressed, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,          /* Not Authorized */
      'User is not authorized to create folders.' AS err_context;
    LEAVE this_proc;
  END IF;

  -- TODO UNDONE Create an index on path.

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
		expand_guid(f.library_id) AS library_id,
		expand_guid(f.folder_id) AS folder_id,
		f.name,
		expand_guid(f.parent_id) AS parent_id,
    f.type,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.data,
    f.`where`,
    f.order_by,
    ur.role AS user_role
  FROM
    folders f 
      LEFT JOIN (SELECT * FROM folder_user_roles WHERE user_id = @user_id_compressed) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.folder_id = @folder_id_compressed;

END $$


/*
 * Update delete_folder to delete roles associated with the folder.
 */
DROP PROCEDURE IF EXISTS `delete_folder`$$

CREATE PROCEDURE `delete_folder`(
                    IN p_user_id VARCHAR(36),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  -- Make sure the user has permission to update the folder.
  SET @role = get_user_role(compress_guid(p_user_id), @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,          /* Not Authorized */
      'User is not authorized to delete this folder.' AS err_context;
    LEAVE this_proc;
  END IF;

  START TRANSACTION;

  -- Recursively delete any permissions associated with the folder tree.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM folders
    WHERE library_id = @library_id_compressed AND folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    folder_user_roles
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

  -- Delete the files in this folder and any folder that is
  -- a descendant of this folder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM folders
    WHERE library_id = @library_id_compressed AND folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    files
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

  -- Now delete the folders.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM folders
    WHERE library_id = @library_id_compressed AND folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

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
			p_library_id AS library_id,
      p_folder_id AS folder_id;
	
END$$

/*
 * Get database statistics.
 */
CREATE PROCEDURE `get_statistics`()
BEGIN

  SELECT
    0 AS err_code,
    NULL AS err_context;
    
  SELECT
    (SELECT COUNT(*) FROM libraries) AS library_count,
    (SELECT COUNT(*) FROM folders) AS folder_count,
    (SELECT COUNT(*) FROM files) AS file_count,
    (SELECT COUNT(*) FROM folder_user_roles) AS folder_user_role_count;

END$$


DELIMITER ;