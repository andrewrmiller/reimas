-- Change types of three keys
ALTER TABLE files CHANGE library_id library_id binary(16);
ALTER TABLE files CHANGE folder_id folder_id binary(16);
ALTER TABLE files CHANGE file_id file_id binary(16);

-- Make a few columns non-nullable.
ALTER TABLE files MODIFY COLUMN mime_type VARCHAR(45) NOT NULL;
ALTER TABLE files MODIFY COLUMN imported_on DATETIME NOT NULL;
ALTER TABLE files MODIFY COLUMN file_size INT(11) NOT NULL;
ALTER TABLE files MODIFY COLUMN is_processing BIT(1) NOT NULL;


DELIMITER $$

/*
 * Create a procedure to create a new file in a library.
 */
DROP PROCEDURE IF EXISTS `add_file`$$

CREATE PROCEDURE `add_file`(
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36),
                    IN p_name VARCHAR(80), 
                    IN p_mime_type VARCHAR(45), 
                    IN p_is_video BIT(1),
                    IN p_height INT(11),
                    IN p_width INT(11),
                    IN p_file_size INT(11),
                    IN p_is_processing BIT(1))
proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @file_id = uuid();
  SET @imported_on = NOW();

  INSERT INTO
    files(
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
      is_processing
    )
  VALUES 
    (
      compress_guid(p_library_id),
      compress_guid(p_folder_id),
      compress_guid(@file_id),
      p_name,
      p_mime_type,
      p_is_video,
      p_height,
      p_width,
      @imported_on,
      p_file_size,
      p_is_processing
    );

	SELECT
    0 AS err_code,
    NULL as err_context;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
    @file_id AS file_id,
		p_name AS name,
    p_mime_type AS mime_type,
    p_is_video AS is_video,
    p_height AS height,
    p_width AS width,
    @imported_on AS imported_on,
    p_file_size AS file_size,
    p_is_processing AS is_processing;

END$$


/*
 * Create a procedure to retrieve files in a folder.
 */
DROP PROCEDURE IF EXISTS `get_files`$$

CREATE PROCEDURE `get_files`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36))
BEGIN
	
	SELECT
		expand_guid(library_id) AS library_id,
		expand_guid(folder_id) AS folder_id,
    expand_guid(file_id) AS file_id,
		name,
		mime_type,
    is_video,
    height,
    width,
    imported_on,
    file_size,
    is_processing
	FROM
		files
  WHERE
    library_id = compress_guid(p_library_id) AND
    folder_id = compress_guid(p_folder_id)
	ORDER BY
		name, imported_on;

END$$

/*
 * Create a procedure to retrieve a specific file.
 */
DROP PROCEDURE IF EXISTS `get_file`$$

CREATE PROCEDURE `get_file`(IN p_library_id VARCHAR(36), IN p_file_id VARCHAR(36))
BEGIN
	
	SELECT
		expand_guid(library_id) AS library_id,
		expand_guid(folder_id) AS folder_id,
    expand_guid(file_id) AS file_id,
		name,
		mime_type,
    is_video,
    height,
    width,
    imported_on,
    file_size,
    is_processing
	FROM
		files
  WHERE
    library_id = compress_guid(p_library_id) AND
    file_id = compress_guid(p_file_id);

END$$

/*
 * Create a procedure to retrieve metadata that is
 * essential to the retrieval of the file's contents.
 */
DROP PROCEDURE IF EXISTS `get_file_content_info`$$

CREATE PROCEDURE `get_file_content_info`(IN p_library_id VARCHAR(36), IN p_file_id VARCHAR(36))
BEGIN
	
	SELECT
		expand_guid(fi.library_id) AS library_id,
		expand_guid(fi.folder_id) AS folder_id,
    expand_guid(fi.file_id) AS file_id,
		fi.mime_type,
    CASE 
      WHEN LENGTH(fo.`path`) > 0 THEN CONCAT(fo.`path`, '/', fi.name)
      ELSE fi.name
    END AS `path`
	FROM
		files fi INNER JOIN folders fo ON fi.folder_id = fo.folder_id
  WHERE
    fi.library_id = compress_guid(p_library_id) AND
    fi.file_id = compress_guid(p_file_id);

END$$


DELIMITER;
