-- Update pst_get_folder_breadcrumbs to sort by path.
DROP PROCEDURE IF EXISTS `pst_get_folder_breadcrumbs` $$
CREATE PROCEDURE `pst_get_folder_breadcrumbs`(
                    p_user_id VARCHAR(254), 
                    p_library_id VARCHAR(36), 
                    p_folder_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE user_role VARCHAR(20);

  -- Make sure the user has permission to see the folder.
  SET user_role = pst_get_folder_user_role(
                p_user_id, 
                library_id_compressed, 
                folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Folder not found.';
  END IF;

  -- Walk the folder tree from the specified folder all the way to the
  -- root looking for the most privileged role assigned to the user.
  -- A higher-ranked role on a parent folder overrides a lower-ranked
  -- role on a subfolder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name, path, role) AS
  (
    SELECT 
      f.library_id, 
      f.folder_id, 
      f.parent_id, 
      f.name,
      f.path,
      pst_get_folder_user_role(p_user_id, f.library_id, f.folder_id) AS role
    FROM 
      pst_folders f
    WHERE 
      f.library_id = library_id_compressed AND 
      f.folder_id = folder_id_compressed
      
    UNION ALL
      
    SELECT 
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par.name,
      par.pathm,
      pst_get_folder_user_role(p_user_id, par.library_id, par.folder_id) AS role
    FROM 
      folder_tree AS ft JOIN pst_folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id
  )
  SELECT 
    pst_expand_guid(f.library_id) AS library_id,
    pst_expand_guid(f.folder_id) AS folder_id,
    f.name
  FROM 
    folder_tree f
  WHERE
    f.role IS NOT NULL AND
    f.folder_id <> folder_id_compressed
  ORDER BY 
    path;

END $$