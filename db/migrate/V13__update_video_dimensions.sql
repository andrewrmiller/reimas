DELIMITER $$

/*
 * Fix defect in get_user_role--should look up the tree not down.
 */
DROP FUNCTION IF EXISTS `get_user_role`$$

CREATE FUNCTION `get_user_role`(
                    p_user_id VARCHAR(254), 
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
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par_ur.role,
      get_role_rank(par_ur.role) AS role_rank
    FROM 
      (folder_tree AS ft JOIN folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id)
      LEFT JOIN folder_user_roles par_ur
      ON par.library_id = par_ur.library_id
      AND par.folder_id = par_ur.folder_id
      AND par_ur.user_id = p_user_id
  )
  SELECT 
    role INTO @user_role
  FROM 
    folder_tree 
  ORDER BY 
    role_rank
  LIMIT 1;

  RETURN @user_role;

END$$


DELIMITER ;
