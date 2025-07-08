const fs = require('fs');
function cleanupFiles(files) {
    if (!files) return;
    (Array.isArray(files) ? files : [files]).forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { cleanupFiles(req.files); }
    });
}
module.exports = { cleanupFiles };