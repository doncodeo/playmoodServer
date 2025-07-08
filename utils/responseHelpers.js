function setEtagAndCache(res, etag, maxAge = 900) {
    res.set({
        'Cache-Control': `private, max-age=${maxAge}`,
        'ETag': etag,
    });
}
module.exports = { setEtagAndCache };