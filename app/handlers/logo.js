'use strict';

const fs = require('fs');
const path = require('path');
const mime = require('mime-types')

const cacheLong = require('../utils/cache-long');
const filepath = path.join(__dirname, '../../static/logo.png');
const body = fs.readFileSync(filepath);

module.exports = async (ctx, next) => {
    cacheLong(ctx, mime.lookup(filepath));
    ctx.body = body;
};
