DELIMITER $$

/*
 * Create a procedure that updates the size of a thumbnail.
 */
CREATE PROCEDURE `update_file_thumbnail`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_thumbnail_size CHAR(2),
          IN p_file_size INT)
BEGIN

  SET @library_id_compressed = compress_guid(p_library_id);
  SET @file_id_compressed = compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  SET @sql = CONCAT(
    'UPDATE 
      files 
    SET 
      file_size_', p_thumbnail_size, ' = ?,
      is_processing = file_size_sm IS NULL OR file_size_md IS NULL OR file_size_lg IS NULL 
    WHERE 
      library_id = ? AND file_id = ?;');

  PREPARE stmt FROM @sql;
  EXECUTE stmt USING @file_size, @library_id_compressed, @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  DEALLOCATE PREPARE stmt;

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
    taken_on,
    modified_on,
    rating,
    title,
    subject,
    comments,
    file_size,
    file_size_sm,
    file_size_lg,
    file_size_backup,
    is_processing
	FROM
		files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

END $$

DELIMITER;