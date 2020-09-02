'use strict';

const fs = require('fs');
const path = require('path');
const mime = require('mime-types')
const UglifyJS = require("uglify-js");

const cacheLong = require('../utils/cache-long');
const filepath = path.join(__dirname, '../../static/scripts.js');
const content = fs.readFileSync(filepath);
const options = { ie8: true }
const result = UglifyJS.minify(content.toString(), options);

module.exports = async (ctx, next) => {
    cacheLong(ctx, mime.lookup(filepath));
    ctx.body = result.code;
};
