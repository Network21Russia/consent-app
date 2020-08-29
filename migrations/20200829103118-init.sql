CREATE TABLE IF NOT EXISTS customers
(
    id         INT(11)          NOT NULL AUTO_INCREMENT COMMENT 'id покупателя',
    email      VARCHAR(320)     NOT NULL COMMENT 'e-mail',
    name       VARCHAR(20)      NOT NULL COMMENT 'имя',
    surname    VARCHAR(20)      NOT NULL COMMENT 'фамилия',
    patronimic VARCHAR(20)      NULL DEFAULT NULL COMMENT 'отчество',
    tickets    INT(11) UNSIGNED NOT NULL COMMENT 'количество билетов',
    hash       BINARY(16)       NOT NULL COMMENT 'хеш для url',
    PRIMARY KEY (id),
    UNIQUE hash_uniq_idx (hash(16))
) ENGINE = InnoDB
  CHARSET = utf8
  COLLATE utf8_general_ci COMMENT = 'Покупатели';

DROP TRIGGER IF EXISTS customers_insert;

CREATE TRIGGER customers_insert
    BEFORE INSERT
    ON customers
    FOR EACH ROW
BEGIN
    SET NEW.hash = UNHEX(MD5(AES_ENCRYPT(NEW.email, UNHEX(SHA2(NEW.email, 512)))));
END;

DROP TRIGGER IF EXISTS customers_update;

CREATE TRIGGER customers_update
    BEFORE UPDATE
    ON customers
    FOR EACH ROW
BEGIN
    SET NEW.hash = UNHEX(MD5(AES_ENCRYPT(NEW.email, UNHEX(SHA2(NEW.email, 512)))));
END;

CREATE TABLE IF NOT EXISTS emails
(
    id            INT(11)    NOT NULL AUTO_INCREMENT COMMENT 'внутренний id письма',
    external_id   BINARY(16) NOT NULL COMMENT 'внешний id письма',
    customer_id   INT(11)    NOT NULL COMMENT 'id покупателя',
    datetime      DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'дата и время отправки',
    is_open       BOOLEAN    NOT NULL DEFAULT 0 COMMENT 'письмо открыто получаетелем',
    open_datetime DATETIME   NULL     DEFAULT NULL COMMENT 'дата и время первого открытия',
    PRIMARY KEY (id),
    UNIQUE external_id_uniq_idx (external_id),
    INDEX customer_id_idx (customer_id),
    INDEX is_open_idx (is_open),
    KEY customer_id_FK (customer_id),
    CONSTRAINT customer_id_FK FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE = InnoDB
  CHARSET = utf8
  COLLATE utf8_general_ci COMMENT = 'Письма';

CREATE TABLE IF NOT EXISTS consents
(
    id                INT(11)          NOT NULL AUTO_INCREMENT COMMENT 'id согласия',
    customer_id       INT(11)          NOT NULL COMMENT 'id покупателя',
    datetime          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'дата и время подписания',
    signed_email      VARCHAR(320)     NOT NULL COMMENT 'e-mail при подписании',
    signed_name       VARCHAR(20)      NOT NULL COMMENT 'имя при подписании',
    signed_surname    VARCHAR(20)      NOT NULL COMMENT 'фамилия при подписании',
    signed_patronimic VARCHAR(20)      NULL     DEFAULT NULL COMMENT 'отчество при подписании',
    signed_tickets    INT(11) UNSIGNED NOT NULL COMMENT 'использовано билетов',
    PRIMARY KEY (id),
    INDEX customer_id_idx (customer_id),
    KEY customer_id_FK2 (customer_id),
    CONSTRAINT customer_id_FK2 FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE = InnoDB
  CHARSET = utf8
  COLLATE utf8_general_ci COMMENT = 'Согласия';
