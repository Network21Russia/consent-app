ALTER TABLE `tickets`
    ADD `code` VARCHAR(14) NULL DEFAULT NULL COMMENT 'код доступа' AFTER `amount`,
    ADD UNIQUE `code_uniq_idx` (`code`);

ALTER TABLE `consents`
    ADD `code_sent`    BOOLEAN  NOT NULL DEFAULT FALSE COMMENT 'коды отправлены' AFTER `signed_patronimic`,
    ADD `code_sent_at` DATETIME NULL     DEFAULT NULL COMMENT 'дата и время отправки кодов' AFTER `code_sent`;

CREATE TABLE `codes_tmp`
(
    `id`   INT(11)     NOT NULL COMMENT 'id билета',
    `code` VARCHAR(14) NOT NULL COMMENT 'код доступа',
    PRIMARY KEY (`id`),
    UNIQUE `code_uniq_idx` (`code`)
) ENGINE = InnoDB
  CHARSET = utf8
  COLLATE utf8_general_ci COMMENT = 'Временная таблица для загрузки кодов';
