DELIMITER ;;

-- Create a procedure that returns all the favorites in a library.
CREATE PROCEDURE `pst_get_favorite_files`(
                    p_user_id VARCHAR(254), 
                    p_library_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);

  -- Figure out if the user has permissions on the root folder in the library.
  -- If they do then they can access the content in this dynamic album.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, NULL);
  
  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library or album not found.' as err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;
    
	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
    pst_expand_guid(f.file_id) AS file_id,
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
		pst_files f LEFT JOIN
      pst_vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.rating > 0
	ORDER BY
		name, imported_on;

END ;;

-- Create a procedure that returns all the videos in a library.
CREATE PROCEDURE `pst_get_video_files`(
                    p_user_id VARCHAR(254), 
                    p_library_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);

  -- Figure out if the user has permissions on the root folder in the library.
  -- If they do then they can access the content in this dynamic album.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, NULL);
  
  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library or album not found.' as err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;
    
	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
    pst_expand_guid(f.file_id) AS file_id,
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
		pst_files f LEFT JOIN
      pst_vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.is_video = 1
	ORDER BY
		name, imported_on;

END ;;

DELIMITER ;
