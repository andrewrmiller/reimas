DELIMITER $$

-- Create a procedure that inserts a row in to pst_export_jobs.
CREATE PROCEDURE `pst_get_files_to_process`()
BEGIN

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
        f.camera_make,
        f.camera_model,
        f.latitude,
        f.longitude,
        f.altitude,
        f.file_size,
        f.file_size_sm,
        f.file_size_md,
        f.file_size_lg,
        f.file_size_cnv,
        f.file_size_backup,
        f.is_processing,
        t.tags
    FROM
        pst_files f LEFT JOIN
        pst_vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id
    WHERE
        f.is_processing = 1;

END $$

DELIMITER ;
