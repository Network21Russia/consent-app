"use strict";

const sqlmigrate = require('sqlmigrate');

const config = require('./config/config');
const logger = require('./app/logger');
const app = require('./app/app');

async function main() {

    logger.info('Starting CONSENT APP');

    logger.info('starting migrations');

    const m = sqlmigrate.create({
        migrationsDir: config.dbMigrationsDir,
        dbConfig: config.db,
    });

    await m.migrate();

    logger.info('migrations applied');

    logger.info('starting app...');

    app.start(logger);
}

main()
    .then()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    });

/*
todo:
вебхук на открытие письма
*/
