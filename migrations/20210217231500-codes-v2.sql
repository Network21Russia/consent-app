CREATE TABLE `codes`
(
    `code` CHAR(14) NOT NULL COMMENT 'код доступа',
    PRIMARY KEY (`code`)
) ENGINE = InnoDB
  CHARSET = utf8
  COLLATE utf8_general_ci COMMENT = 'Таблица для загрузки кодов';

DROP TABLE codes_tmp;
