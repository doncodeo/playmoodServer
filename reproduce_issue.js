const storageService = require('./services/storageService');
// Mocking the config/r2 if needed, but let's see what happens with current environment
try {
    const key = 'test-key';
    const publicUrl = storageService.getR2PublicUrl(key);
    console.log('Public URL:', publicUrl);
} catch (e) {
    console.error('Error:', e.message);
}
