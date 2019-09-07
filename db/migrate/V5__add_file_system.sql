DELIMITER $$

/*
 * Update the routine that creates a library.
 */
DROP PROCEDURE IF EXISTS `add_library`$$

CREATE PROCEDURE `add_library`(
											IN p_library_id VARCHAR(36), 
											IN p_name VARCHAR(80), 
											IN p_description LONGTEXT)
BEGIN

  -- Create the library.    
	INSERT INTO 
		libraries(library_id, name, description)
	VALUES
		(compress_guid(p_library_id), p_name, p_description);

  -- Create the root folder in the library.
  SET @default_folder_id = uuid();

  INSERT INTO
    folders(library_id, folder_id, name, parent_id, type, `path`)
  VALUES
    (compress_guid(p_library_id), compress_guid(@default_folder_id), 'All Pictures', NULL, 'picture', '');

	SELECT
		0 AS err_code,
		NULL AS err_context;

	SELECT 
		p_library_id AS library_id,
		p_name as name,
		p_description as description;
        
END$$
