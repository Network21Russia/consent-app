'use strict';

function cacheLong(ctx, mimeType) {
    const expiresSeconds = 31536000;
    const e = new Date();
    e.setSeconds(e.getSeconds() + expiresSeconds);
    ctx.set({
        'content-type': mimeType,
        'last-modified': (new Date('2020-01-01 00:00:00')).toUTCString(),
        'expires': e.toUTCString(),
    });
    ctx.cacheControl = {
        maxAge: expiresSeconds
    };
}

module.exports = cacheLong;
