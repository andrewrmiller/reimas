-- Add the new table to track export jobs.
CREATE TABLE pst_export_jobs (
  `library_id` binary(16) NOT NULL,
  `job_id` binary(16) NOT NULL,
  `file_ids` text NOT NULL,
  `status` text NOT NULL,
  `error` text NULL,
  `created_by` varchar(254) NOT NULL,
  `created_on` datetime NOT NULL,
  `updated_on` datetime NOT NULL,
  PRIMARY KEY (`library_id`,`job_id`),
  CONSTRAINT `fk_export_files_library_id` FOREIGN KEY (`library_id`) REFERENCES `pst_libraries` (`library_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

DELIMITER $$

-- Create a procedure that inserts a row in to pst_export_jobs.
CREATE PROCEDURE `pst_add_export_job`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_job_id VARCHAR(36),
                    IN p_file_ids TEXT)
this_proc:BEGIN

    DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
    DECLARE job_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_job_id);
    DECLARE now DATETIME DEFAULT UTC_TIMESTAMP();
    
    INSERT INTO
        pst_export_jobs(
            library_id,
            job_id,
            file_ids,
            `status`,
            error,
            created_by,
            created_on,
            updated_on
        )
    VALUES (
        library_id_compressed,
        job_id_compressed,
        p_file_ids,
        'pending',
        null,
        p_user_id,
        now,
        now
    );

    SELECT 
        pst_expand_guid(library_id) as library_id,
        pst_expand_guid(job_id) as job_id,
        file_ids,
        status,
        error,
        created_by,
        created_on,
        updated_on
    FROM
      pst_export_jobs
    WHERE
      library_id = library_id_compressed AND
      job_id = job_id_compressed;

END $$

-- Create a procedure that gets a row from pst_export_jobs.
CREATE PROCEDURE `pst_get_export_job`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_job_id VARCHAR(36))
this_proc:BEGIN

    DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
    DECLARE job_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_job_id);

    SELECT
        pst_expand_guid(library_id) as library_id,
        pst_expand_guid(job_id) as job_id,
        file_ids,        
        status,
        created_by,
        created_on,
        updated_on
    FROM
        pst_export_jobs
    WHERE
        library_id = library_id_compressed AND
        job_id = job_id_compressed AND
        created_by = p_user_id;

END $$

-- Create a procedure that updates a row in pst_export_jobs.
CREATE PROCEDURE `pst_update_export_job`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_job_id VARCHAR(36),
                    IN p_status TEXT,
                    IN p_error TEXT)
this_proc:BEGIN

    DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
    DECLARE job_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_job_id);
    DECLARE now DATETIME DEFAULT UTC_TIMESTAMP();

    -- Only the system user can update export jobs.
    IF (p_user_id <> 'system.user@picstrata.api') THEN
        SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to add files to this folder.';
    END IF;

    UPDATE
        pst_export_jobs
    SET
        status = p_status,
        updated_on = now
    WHERE
        library_id = library_id_compressed AND
        job_id = job_id_compressed;

    SELECT
        pst_expand_guid(library_id) as library_id,
        pst_expand_guid(job_id) as job_id,
        file_ids,
        status,
        created_by,
        created_on,
        updated_on
    FROM
        pst_export_jobs
    WHERE
        library_id = library_id_compressed AND
        job_id = job_id_compressed;

END $$

-- Update pst_delete_library to delete pst_export_jobs as well.
DROP PROCEDURE IF EXISTS `pst_delete_library` $$
CREATE PROCEDURE `pst_delete_library`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36))
BEGIN

  DECLARE library_id_compressed BINARY(16) DEFAULT pst_compress_guid(p_library_id);
  DECLARE user_role VARCHAR(20);
  DECLARE user_is_participant BOOLEAN;
  DECLARE affected_rows BIGINT;

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(object_id) > 0 INTO user_is_participant FROM pst_object_users 
  WHERE library_id = library_id_compressed AND user_id = p_user_id;
  IF (NOT user_is_participant) THEN
    SIGNAL SQLSTATE '02000' SET MYSQL_ERRNO = 1643, MESSAGE_TEXT = 'Library not found.';
  END IF;

  -- Only owners on a library can delete it.
  SET user_role = pst_get_library_user_role(p_user_id, library_id_compressed);
  IF (user_role IS NULL OR user_role <> 'owner') THEN
    SIGNAL SQLSTATE '28000' SET MYSQL_ERRNO = 1045, MESSAGE_TEXT = 'User is not authorized to delete the library.';
  END IF;

  tran_block:BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION 
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

    START TRANSACTION;

    -- Delete pst_files in the library first.
    DELETE FROM
      pst_file_tags
    WHERE
      library_id = library_id_compressed;

    DELETE FROM
      pst_files
    WHERE
      library_id = library_id_compressed;

    -- Delete permissions assigned to the library and children.
    DELETE FROM 
      pst_object_users
    WHERE
      library_id = library_id_compressed;

    -- Delete child pst_folders next.
    DELETE FROM
      pst_folders
    WHERE
      library_id = library_id_compressed;

    -- And then pst_albums.
    DELETE FROM
      pst_albums
    WHERE
      library_id = library_id_compressed;

    -- And finally pst_export_jobs.
    DELETE FROM
      pst_export_jobs
    WHERE
      library_id = library_id_compressed;

    -- Now delete the library itself.
    DELETE FROM
      pst_libraries
    WHERE
      library_id = library_id_compressed;
          
    SELECT ROW_COUNT() INTO affected_rows;

    COMMIT;
  END;

  SELECT p_library_id, affected_rows;
END $$

DELIMITER ;


