import fs from 'fs';
import webp from 'webp-converter';

webp.grant_permission();

async function test() {
    fs.writeFileSync('test_in.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    await webp.cwebp('test_in.png', 'test_out.webp', '-q 80');
    console.log('Exists:', fs.existsSync('test_out.webp'));
}
test();
