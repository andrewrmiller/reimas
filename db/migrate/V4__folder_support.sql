/*
 * Get rid of unused trigger.
 */
DROP TRIGGER before_insert_library;

/*
 * Convert identity columns to compressed guids.
 */
ALTER TABLE folders CHANGE library_id library_id BINARY(16);
ALTER TABLE folders CHANGE folder_id folder_id BINARY(16);
ALTER TABLE folders CHANGE parent_id parent_id BINARY(16);

/*
 * Use short strings to represent enumerated types.
 */ 
ALTER TABLE folders CHANGE `type` `type` VARCHAR(20); 

/*
 * Get rid of root_id column as it is not being used consistenly.
 */
ALTER TABLE folders DROP COLUMN root_id;

/*
 * Update folder constraints and indexes.
 */

-- Ensure that there are no duplicate folders under a parent.
ALTER TABLE folders ADD CONSTRAINT ux_folders_path UNIQUE KEY(library_id, path);

-- Used when finding child folders
DROP INDEX ix_folders_parent_id on folders;
CREATE INDEX ix_folders_parent_id ON folders(library_id, parent_id);

-- Used when renaming parent folders.
DROP INDEX ix_folders_path on folders;
CREATE INDEX ix_folders_path ON folders(library_id, `path`);


-- Used when searching and sorting folders
DROP INDEX ix_folders_name on folders;
CREATE INDEX ix_folders_name ON folders(library_id, name);

-- Add a foreign key constraint.
ALTER TABLE folders ADD CONSTRAINT fk_folders_library_id FOREIGN KEY (library_id) REFERENCES libraries(library_id);


DELIMITER $$

/*
 * Make compress_guid and expand_guid deterministic
 */
DROP FUNCTION IF  EXISTS `compress_guid`$$

CREATE FUNCTION `compress_guid`(p_guid VARCHAR(36)) RETURNS binary(16) DETERMINISTIC
BEGIN

RETURN UNHEX(REPLACE(p_guid,'-',''));

END$$

DROP FUNCTION IF  EXISTS `expand_guid`$$

CREATE FUNCTION `expand_guid`(p_guid BINARY(16)) RETURNS varchar(36) CHARSET latin1 DETERMINISTIC
BEGIN

RETURN LOWER(
    INSERT(
        INSERT(
          INSERT(
            INSERT(hex(p_guid),9,0,'-'),
            14,0,'-'),
          19,0,'-'),
        24,0,'-'));
    
END$$


/*
 * Update the routine that creates a library.
 */
DROP PROCEDURE IF EXISTS `add_library`$$

CREATE PROCEDURE `add_library`(IN p_name VARCHAR(80), IN p_description LONGTEXT)
BEGIN

  -- Create the library.
	SET @library_id = uuid();
    
	INSERT INTO 
		libraries(library_id, name, description)
	VALUES
		(compress_guid(@library_id), p_name, p_description);

  -- Create the root folder in the library.
  SET @default_folder_id = uuid();

  INSERT INTO
    folders(library_id, folder_id, name, parent_id, type, `path`)
  VALUES
    (compress_guid(@library_id), compress_guid(@default_folder_id), 'All Pictures', NULL, 'picture', '');

	SELECT
		0 AS err_code,
		NULL AS err_context;

	SELECT 
		@library_id AS library_id,
		p_name as name,
		p_description as description;
        
END$$


/*
 * Create a procedure to retrieve folders under a root ordered by name.
 */
DROP PROCEDURE IF EXISTS `get_folders`$$

CREATE PROCEDURE `get_folders`(IN p_library_id VARCHAR(36), IN p_parent_id VARCHAR(36))
BEGIN
	
  IF p_parent_id IS NOT NULL THEN
    SET @parent_id_compressed = compress_guid(p_parent_id);
  END IF;

	SELECT
		expand_guid(library_id) AS library_id,
		expand_guid(folder_id) AS folder_id,
		name,
		expand_guid(parent_id) AS parent_id,
    type,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    data,
    `where`,
    order_by
	FROM
		folders
  WHERE
    library_id = compress_guid(p_library_id) AND
    (parent_id = @parent_id_compressed OR (p_parent_id IS NULL AND parent_id IS NULL))
	ORDER BY
		name;

END$$

/*
 * Create a procedure to retrieve a specific top level folder.
 */
DROP PROCEDURE IF EXISTS `get_folder`$$

CREATE PROCEDURE `get_folder`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36))
BEGIN
	
	SELECT
		expand_guid(library_id) AS library_id,
		expand_guid(folder_id) AS folder_id,
		name,
		expand_guid(parent_id) AS parent_id,
    type,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    data,
    `where`,
    order_by
	FROM
		folders
  WHERE
    library_id = compress_guid(p_library_id) AND
    folder_id = compress_guid(p_folder_id)
	ORDER BY
		name;

END$$


/*
 * Create a procedure to create a new folder in a library.
 */
DROP PROCEDURE IF EXISTS `add_folder`$$

CREATE PROCEDURE `add_folder`(IN p_library_id VARCHAR(36), IN p_name VARCHAR(80), IN p_parent_id VARCHAR(36), IN p_type VARCHAR(20))
proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @folder_id = uuid();

  -- Check for invalid characters.
  IF (INSTR(p_name, '/') > 0) THEN
    SELECT 
      8 AS err_code,    -- Invalid field value
      'Invalid character in folder name.' AS err_context;
    LEAVE proc;
  END IF;

  IF (p_parent_id IS NULL) THEN
    BEGIN
      SET @parent_id_compressed = NULL;
      SET @path = p_name;
    END;
  ELSE
    BEGIN
      SET @parent_id_compressed = compress_guid(p_parent_id);

      SELECT 
        CONCAT(`path`, '/', p_name) INTO @path 
      FROM 
        folders 
      WHERE 
        library_id = compress_guid(p_library_id) AND folder_id = @parent_id_compressed;

      -- Trim leading slash if it exists.
      IF (STRCMP(LEFT(@path, 1), '/') = 0) THEN 
        SET @path = SUBSTRING(@path, 2);
      END IF;
    END;
  END IF;

  INSERT INTO 
    folders(library_id, folder_id, name, parent_id, type, `path`)
  VALUES
    (compress_guid(p_library_id), compress_guid(@folder_id), p_name, @parent_id_compressed, p_type, @path);

	SELECT
    0 AS err_code,
    NULL as err_context;

  SELECT
		p_library_id AS library_id,
		@folder_id AS folder_id,
		p_name AS name,
		expand_guid(@parent_id_compressed) AS parent_id,
    p_type AS type,
    @path AS `path`,
    0 AS file_count,
    0 AS file_size,
    0 AS file_size_sm,
    0 AS file_size_md,
    0 AS file_size_lg,
    NULL AS data,
    NULL AS `where`,
    NULL AS order_by;

END$$

/*
 * Create a procedure to create a new folder in a library.
 */
DROP PROCEDURE IF EXISTS `update_folder`$$

CREATE PROCEDURE `update_folder`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36), IN p_name VARCHAR(80))
BEGIN
  	
  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);
  
  -- TODO Create an index on path.

  -- Grab the current name and path for the folder.
  SELECT 
    name, `path` 
  INTO 
    @old_name, @old_path
  FROM
    folders
  WHERE
		library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  -- Break out the root.
  SET @parent_path = 
    LEFT
    (
      @old_path, 
      LENGTH(@old_path) - LENGTH(SUBSTRING_INDEX(@old_path, '/', -1)) -1
    );

  -- Calculate the new path for the folder and make
  -- sure to trim any leading slash.
  SET @new_path = CONCAT(@parent_path, '/', p_name);
  IF (STRCMP(LEFT(@new_path, 1), '/') = 0) THEN 
    SET @new_path = SUBSTRING(@new_path, 2);
  END IF;

  UPDATE
		folders
	SET
		name = p_name,
    `path` = @new_path
	WHERE
		library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

  -- If we successfully renamed the folder then make sure
  -- the path values for any children are also updated.
  IF (@affected_rows = 1) THEN
    SET @old_path_len = LENGTH(@old_path);
    UPDATE
      folders
    SET 
      `path` = CONCAT(@new_path, RIGHT(`path`, LENGTH(`path`) - @old_path_len))
    WHERE
      library_id = @library_id_compressed AND
      `path` LIKE CONCAT(@old_path, '/%');
  END IF;  

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
		name,
		expand_guid(parent_id) AS parent_id,
    type,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    data,
    `where`,
    order_by
  FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

END $$

/*
 * Create a procedure to delete an existing folder.
 */
DROP PROCEDURE IF EXISTS `delete_folder`$$

CREATE PROCEDURE `delete_folder`(IN p_library_id VARCHAR(36), IN p_folder_id VARCHAR(36))
BEGIN

	DELETE FROM
		folders
	WHERE
		library_id = compress_guid(p_library_id) AND
    folder_id = compress_guid(p_folder_id);
        
	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id,
      p_folder_id AS folder_id;
	
END$$

/*
 * Update the procedure to delete an existing library.
 */
DROP PROCEDURE IF EXISTS `delete_library`$$

CREATE PROCEDURE `delete_library`(IN p_library_id VARCHAR(36))
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);

  -- Delete child folders first.
  DELETE FROM
    folders
  WHERE
    library_id = @library_id_compressed;

  -- Now delete the library itself.
	DELETE FROM
		libraries
	WHERE
		library_id = @library_id_compressed;
        
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