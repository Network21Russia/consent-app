ALTER TABLE `customers`
    ADD `pass_serial` VARCHAR(4) NULL DEFAULT NULL COMMENT 'серия паспорта' AFTER `gender`,
    ADD `pass_number` VARCHAR(6) NULL DEFAULT NULL COMMENT 'номер паспорта' AFTER `pass_serial`;

TRUNCATE TABLE `codes`;

ALTER TABLE `codes`
    ADD `code_type` ENUM ('1','2','3') NOT NULL COMMENT 'категория кода' AFTER `code`,
    ADD INDEX `code_type_idx` (`code_type`);

ALTER TABLE `tickets`
    CHANGE `code` `code_type_1` VARCHAR(14) CHARACTER SET utf8 COLLATE utf8_general_ci                      NULL     DEFAULT NULL COMMENT 'код доступа 1 типа',
    ADD `code_type_2`           VARCHAR(14) CHARACTER SET utf8 COLLATE utf8_general_ci                      NULL     DEFAULT NULL COMMENT 'код доступа 2 типа',
    ADD `code_type_3`           VARCHAR(14) CHARACTER SET utf8 COLLATE utf8_general_ci                      NULL     DEFAULT NULL COMMENT 'код доступа 3 типа',
    ADD `action`                ENUM ('surcharge-1','surcharge-2','surcharge-3','code-1','code-2','code-3') NULL COMMENT 'выбор пользователя' AFTER `amount`,
    ADD `surcharge_amount`      DECIMAL(8, 2)                                                               NOT NULL DEFAULT '0' COMMENT 'сумма доплаты' AFTER `action`,
    ADD `event_name`            VARCHAR(128) CHARACTER SET utf8 COLLATE utf8_general_ci                     NULL     DEFAULT NULL COMMENT 'название мероприятия' AFTER `order_date`,
    ADD INDEX `action_idx` (`action`);

ALTER TABLE `consents`
    ADD `type`                ENUM ('surcharge','code') NOT NULL COMMENT 'тип согласия' AFTER `datetime`,
    ADD `signed_pass_serial`  VARCHAR(4)                NULL     DEFAULT NULL COMMENT 'серия паспорта' AFTER `signed_patronimic`,
    ADD `signed_pass_number`  VARCHAR(6)                NULL     DEFAULT NULL COMMENT 'номер паспорта' AFTER `signed_pass_serial`,
    ADD `payment_received`    BOOLEAN                   NOT NULL DEFAULT FALSE COMMENT 'оплата получена' AFTER `code_sent_at`,
    ADD `payment_received_at` DATETIME                  NULL     DEFAULT NULL COMMENT 'дата и время оплаты' AFTER `payment_received`;
