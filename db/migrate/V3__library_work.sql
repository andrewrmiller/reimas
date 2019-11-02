/*
 * Get rid of old integer ID columns
 */
ALTER TABLE libraries DROP COLUMN next_folder_id;
ALTER TABLE libraries DROP COLUMN next_file_id;
ALTER TABLE libraries DROP COLUMN next_keyword_id;
ALTER TABLE libraries CHANGE library_id library_id binary(16);

/*
 * Also get rid of unused url column.
 */
ALTER TABLE libraries DROP COLUMN url;

DELIMITER $$

/*
 * Create a trigger to init library_id on create.
 */ 
CREATE TRIGGER before_insert_library
BEFORE INSERT ON libraries
FOR EACH ROW
BEGIN

  IF new.library_id IS NULL THEN
    SET new.library_id = compress_guid(uuid());
  END IF;

END$$


/*
 * Create a procedure to retrieve all libraries in order.
 */
CREATE PROCEDURE `get_libraries`()
BEGIN
	
	SELECT
		expand_guid(library_id) AS library_id,
		name,
		description
	FROM
		libraries
	ORDER BY
		name;

END$$

/*
 * Create a procedure to get a specific library.
 */
CREATE PROCEDURE `get_library`(IN p_library_id VARCHAR(36))
BEGIN

	SELECT
		expand_guid(library_id) AS library_id,
		name,
		description
	FROM
		libraries
	WHERE
		library_id = compress_guid(p_library_id);
        
END$$

/*
 * Create a procedure to create a new library.
 */
CREATE PROCEDURE `add_library`(IN p_name VARCHAR(80), IN p_description LONGTEXT)
BEGIN

	SET @library_id = uuid();
    
	INSERT INTO 
		libraries(library_id, name, description)
	VALUES
		(compress_guid(@library_id), p_name, p_description);

	SELECT
		0 AS err_code,
		NULL AS err_context;

	SELECT 
		@library_id AS library_id,
		p_name as name,
		p_description as description;
        
END$$

/*
 * Create a procedure to udpate an existing library.
 */
CREATE PROCEDURE `update_library`(IN p_library_id VARCHAR(36), IN p_name VARCHAR(80), IN p_description LONGTEXT)
BEGIN

	UPDATE
		libraries
	SET
		name = p_name,
		description = p_description
	WHERE
		library_id = compress_guid(p_library_id);
        
	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

	SELECT
			p_library_id AS library_id,
			p_name AS name,
			p_description AS description;
	
END$$

/*
 * Create a procedure to delete an existing library.
 */
CREATE PROCEDURE `delete_library`(IN p_library_id VARCHAR(36))
BEGIN

	DELETE FROM
		libraries
	WHERE
		library_id = compress_guid(p_library_id);
        
	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id;
	
END$$


DELIMITER ;
