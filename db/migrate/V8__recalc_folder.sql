DELIMITER $$

-- Create a procedure that adds a thumbnail size to an existing file.
/*
 * Create a procedure to create a new folder in a library.
 */
DROP PROCEDURE IF EXISTS `recalc_folder`$$

CREATE PROCEDURE `recalc_folder`(
          IN p_library_id VARCHAR(36), 
          IN p_folder_id VARCHAR(36))
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @folder_id_compressed = compress_guid(p_folder_id);

  SELECT 
    COALESCE(COUNT(file_id), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0) 
  INTO
    @folder_file_count,
    @folder_file_size, 
    @folder_file_size_sm,
    @folder_file_size_md,
    @folder_file_size_lg
  FROM 
    files 
  WHERE 
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  SELECT
    COALESCE(SUM(file_count), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0)
  INTO 
    @subfolder_file_count,
    @subfolder_file_size,
    @subfolder_file_size_sm,
    @subfolder_file_size_md,
    @subfolder_file_size_lg
  FROM
    folders
  WHERE
    library_id = @library_id_compressed AND
    parent_id = @folder_id_compressed;

  UPDATE 
    folders
  SET 
    file_count = @folder_file_count + @subfolder_file_count,
    file_size = @folder_file_size + @subfolder_file_size,
    file_size_sm = @folder_file_size_sm + @subfolder_file_size_sm,
    file_size_md = @folder_file_size_md + @subfolder_file_size_md,
    file_size_lg = @folder_file_size_lg + @subfolder_file_size_lg
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

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

DELIMITER;