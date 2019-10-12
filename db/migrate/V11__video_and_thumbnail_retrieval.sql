DELIMITER $$

/*
 * Use file ID instead of name when computing path.
 */
DROP PROCEDURE IF EXISTS `get_file_content_info`$$

CREATE PROCEDURE `get_file_content_info`(IN p_library_id VARCHAR(36), IN p_file_id VARCHAR(36))
BEGIN
	
	SELECT
		expand_guid(fi.library_id) AS library_id,
		expand_guid(fi.folder_id) AS folder_id,
    expand_guid(fi.file_id) AS file_id,
    fi.is_video,
		fi.mime_type,
    fi.name,
    CASE 
      WHEN LENGTH(fo.`path`) > 0 THEN CONCAT(fo.`path`, '/', p_file_id)
      ELSE p_file_id
    END AS `path`,
    fi.is_processing
	FROM
		files fi INNER JOIN folders fo ON fi.folder_id = fo.folder_id
  WHERE
    fi.library_id = compress_guid(p_library_id) AND
    fi.file_id = compress_guid(p_file_id);

END$$