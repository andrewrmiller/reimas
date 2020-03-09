DROP INDEX ux_folders_path ON folders;

CREATE UNIQUE INDEX ux_folders_parent_id_name ON folders(library_id, parent_id, name);

DELIMITER $$

/*
 * Fix p_new_user_id argument in add_folder_user.
 */
DROP PROCEDURE IF EXISTS `add_folder_user`$$

CREATE PROCEDURE `add_folder_user`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36),
                      IN p_folder_id VARCHAR(36),
                      IN p_new_user_id VARCHAR(254),
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

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  SET @role = COALESCE(get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed), '');
  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to grant folder permissions.' AS err_context;
    LEAVE this_proc;
  END IF;

  INSERT INTO
    folder_user_roles (library_id, folder_id, user_id, role)
  VALUES
    (@library_id_compressed, @folder_id_compressed, p_new_user_id, p_role);

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
 * Fix a bug in the get_library function that was causing it to
 * return more than one row.
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


DELIMITER ;