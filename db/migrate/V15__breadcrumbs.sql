DELIMITER $$

/*
 * Create a procedure that retrieves the breadcrumbs for a folder
 */
CREATE PROCEDURE `get_folder_breadcrumbs`(
                    p_user_id VARCHAR(254), 
                    p_library_id VARCHAR(36), 
                    p_folder_id VARCHAR(36))
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

	SELECT
		0 AS err_code,
		NULL AS err_context;

  -- Walk the folder tree from the specified folder all the way to the
  -- root looking for the most privileged role assigned to the user.
  -- A higher-ranked role on a parent folder overrides a lower-ranked
  -- role on a subfolder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name, role) AS
  (
    SELECT 
      f.library_id, 
      f.folder_id, 
      f.parent_id, 
      f.name,
      get_user_role(p_user_id, f.library_id, f.folder_id) AS role
    FROM 
      folders f
    WHERE 
      f.library_id = @library_id_compressed AND 
      f.folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT 
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par.name,
      get_user_role(p_user_id, par.library_id, par.folder_id) AS role
    FROM 
      folder_tree AS ft JOIN folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id
  )
  SELECT 
    f.library_id,
    f.folder_id,
    f.name
  FROM 
    folder_tree f
  WHERE
    f.role IS NOT NULL AND
    f.folder_id <> @folder_id_compressed
  ORDER BY 
    name;

END$$


DELIMITER ;