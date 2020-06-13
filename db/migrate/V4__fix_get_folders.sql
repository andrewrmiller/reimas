DELIMITER $$

-- Fix potentially uninitialized @parent_id_compressed in pst_get_folders.
DROP PROCEDURE IF EXISTS `pst_get_folders` $$

CREATE PROCEDURE `pst_get_folders`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_parent_id VARCHAR(36))
this_proc:BEGIN
	
  IF p_parent_id IS NOT NULL THEN
    SET @parent_id_compressed = pst_compress_guid(p_parent_id);
  ELSE
    SET @parent_id_compressed = NULL;
  END IF;

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  

  -- Make sure the user has permission to see pst_folders under the parent.
  SET @role = pst_get_user_role(
              p_user_id, 
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
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
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
    pst_folders f 
      LEFT JOIN (SELECT * FROM pst_folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = pst_compress_guid(p_library_id) AND
    (f.parent_id = @parent_id_compressed OR (p_parent_id IS NULL AND f.parent_id IS NULL))
	ORDER BY
		name;

END $$

DELIMITER ;