'use strict';

const fs = require('fs');
const csso = require('csso');
const path = require('path');
const dir = require('node-dir');
const mime = require('mime-types');
const parse = require("node-html-parser").default;

const cacheLong = require('../utils/cache-long');
const filepath = path.join(__dirname, '../../static/bootstrap.css');

let minifiedCss = null;

async function getCss() {
    if (minifiedCss) {
        return minifiedCss;
    }
    const regex = /<%[^%>]*%>/gmi;

    const filesContents = await new Promise((resolve, reject) => {
        const f = [];

        dir.readFiles(path.join(__dirname, '../views'),
            function (err, content, next) {
                if (err) reject(err);
                f.push(content.replace(regex, ''));

                next();
            },
            function (err) {
                if (err) reject(err);
                resolve(f);
            });
    });

    const tags = [];
    const classes = [];

    filesContents.forEach(f => {
        const root = parse(f);
        tags.push(
            [...new Set(Array.from(root.querySelectorAll('*')).map(el => el.tagName).filter(Boolean))]
        );
        classes.push(
            [...new Set((Array.from(root.querySelectorAll('*')).map(el => el.classNames)).flat().filter(Boolean))]
        );
    });

    const uniqTags = [...new Set(tags.flat())].sort();

    const uniqClasses = [...new Set(classes.flat())].map(c => c.replace('"', ''));
    uniqClasses.push('active', 'watermark'); // hardcode here!
    uniqClasses.sort()

    const options = {
        usage: {
            tags: uniqTags,
            classes: uniqClasses,
        },
        sourceMap: false,
        comments: false,
    }

    const body = fs.readFileSync(filepath);
    minifiedCss = csso.minify(body, options).css;

    return minifiedCss;
}


module.exports = async (ctx) => {
    cacheLong(ctx, mime.lookup(filepath));
    ctx.body = await getCss();
};
