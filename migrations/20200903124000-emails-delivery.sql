ALTER TABLE `emails`
    ADD `is_delivered`       BOOLEAN  NOT NULL DEFAULT FALSE COMMENT 'письмо доставлено получаетелю' AFTER `datetime`,
    ADD `delivered_datetime` DATETIME NULL     DEFAULT NULL COMMENT 'дата и время доставки' AFTER `is_delivered`,
    ADD INDEX `is_delivered_idx` (`is_delivered`);
