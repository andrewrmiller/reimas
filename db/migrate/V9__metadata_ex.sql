-- Add a separate metadata column to support uploaded files
-- with extra metadata provided as a JSON string.
ALTER TABLE pst_files
    ADD COLUMN metadata_ex TEXT;


DELIMITER $$

-- Update pst_get_file_content_info to return metadata_ex
DROP PROCEDURE IF EXISTS `pst_get_file_content_info` $$
CREATE PROCEDURE `pst_get_file_content_info`(
                        IN p_user_id VARCHAR(254),
                        IN p_library_id VARCHAR(36), 
                        IN p_file_id VARCHAR(36))
BEGIN
	
  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE user_role VARCHAR(20);

  -- Figure out if the user has permissions on the file.
  SET user_role = pst_get_file_user_role(p_user_id, library_id_compressed, file_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'File not found.';
  END IF;

	SELECT
		pst_expand_guid(fi.library_id) AS library_id,
		pst_expand_guid(fi.folder_id) AS folder_id,
        pst_expand_guid(fi.file_id) AS file_id,
		fi.mime_type as mime_type,
        fi.name AS name,
        CASE 
            WHEN LENGTH(fo.`path`) > 0 THEN CONCAT(fo.`path`, '/', p_file_id)
            ELSE p_file_id
        END AS `path`,
        fi.is_video,
        fi.is_processing,
        fi.metadata_ex
	FROM
		pst_files fi INNER JOIN pst_folders fo ON fi.folder_id = fo.folder_id
  WHERE
    fi.library_id = library_id_compressed AND
    fi.file_id = file_id_compressed;

END $$


-- Update pst_add_file to take p_metadata_ex.
DROP PROCEDURE IF EXISTS `pst_add_file` $$
CREATE PROCEDURE `pst_add_file`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36),
                    IN p_file_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_mime_type VARCHAR(45), 
                    IN p_is_video BIT(1),
                    IN p_height INT,
                    IN p_width INT,
                    IN p_file_size INT,
                    IN p_is_processing BIT(1),
                    IN p_metadata_ex TEXT)
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE folder_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_folder_id);
  DECLARE file_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_file_id);
  DECLARE suffix INT;
  DECLARE idx INT;
  DECLARE base VARCHAR(80);
  DECLARE ext VARCHAR(80);
  DECLARE filename VARCHAR(80);
  DECLARE existing BINARY(16);
  DECLARE user_role VARCHAR(20);

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1022, MESSAGE_TEXT = 'Duplicate item exists.';
  END;

  -- Figure out if the user has permissions on the folder.
  SET user_role = pst_get_folder_user_role(p_user_id, library_id_compressed, folder_id_compressed);

  IF (user_role IS NULL) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library or folder not found.';
  END IF;

  IF (user_role = 'reader') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to add files to this folder.';
  END IF;

  -- Check for existing pst_files with the same name.
  SET suffix = 1;
  SET idx = CHAR_LENGTH(p_name) - LOCATE('.', REVERSE(p_name)) + 1;
  SET base = LEFT(p_name, idx - 1);
  SET ext = SUBSTRING(p_name, idx);
  SET filename = p_name;
  SELECT 
    file_id INTO existing 
  FROM
    pst_files
  WHERE 
    library_id = library_id_compressed AND
    folder_id = folder_id_compressed AND
    name = filename;
  find_existing_file: WHILE existing IS NOT NULL AND suffix <= 999 DO 
    SET suffix = suffix + 1;
    SET existing = NULL;
    SET filename = CONCAT(base, ' (', CONVERT(suffix, CHAR), ')', ext);
    SELECT 
      file_id INTO existing 
    FROM
      pst_files
    WHERE 
      library_id = library_id_compressed AND
      folder_id = folder_id_compressed AND
      name = filename;
  END WHILE find_existing_file;

  INSERT INTO
    pst_files(
      library_id,
      folder_id,
      file_id,
      name,
      mime_type,
      is_video,
      height,
      width,
      imported_on,
      file_size,
      file_size_cnv,
      is_processing,
      metadata_ex
    )
  VALUES 
    (
      library_id_compressed,
      folder_id_compressed,
      file_id_compressed,
      filename,
      p_mime_type,
      p_is_video,
      p_height,
      p_width,
      UTC_TIMESTAMP(),
      p_file_size,
      CASE WHEN p_is_video = 1 AND p_mime_type = 'video/mp4' THEN 0 ELSE NULL END,
      p_is_processing,
      p_metadata_ex
    );

  CALL pst_get_file_ex(library_id_compressed, file_id_compressed);

END $$

DELIMITER ;
