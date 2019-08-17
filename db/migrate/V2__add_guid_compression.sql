DELIMITER $$

/*
 * Compress a guid from text notation to a packed binary.
 */

CREATE FUNCTION `compress_guid`(p_guid VARCHAR(36)) RETURNS binary(16)
BEGIN

RETURN UNHEX(REPLACE(p_guid,'-',''));

END$$

/*
 * Expand a guid from a packed binary to text notation.
 */ 
CREATE FUNCTION `expand_guid`(p_guid BINARY(16)) RETURNS varchar(36) CHARSET latin1
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

DELIMITER ;
