// Verificación de identidad: cifrado de las fotos, formato del RUT y preparación de las imágenes (sin servidor ni R2).
const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');
const { ok } = require('./fixtures.cjs');

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);

(async () => {
  try {
    const mod = await load('core/identityVerification.js');
    const sharp = (await import('sharp')).default;
    const key = crypto.randomBytes(32);

    const plain = Buffer.from('carnet de prueba');
    const packed = mod.encryptBuffer(plain, key);
    ok('lo cifrado no contiene el original y se descifra igual', !packed.includes(plain) && mod.decryptBuffer(packed, key).equals(plain));
    ok('el mismo contenido cifrado dos veces da bytes distintos', !mod.encryptBuffer(plain, key).equals(packed));
    const tampered = Buffer.from(packed);
    tampered[tampered.length - 1] ^= 1;
    let rejected = false;
    try { mod.decryptBuffer(tampered, key); } catch { rejected = true; }
    ok('un archivo alterado no se descifra', rejected);
    rejected = false;
    try { mod.decryptBuffer(packed, crypto.randomBytes(32)); } catch { rejected = true; }
    ok('con otra clave no se descifra', rejected);

    ok('el RUT se normaliza sin puntos y con guion', mod.normalizeRut('12.345.678-5') === '12345678-5' && mod.normalizeRut('1234567k') === '1234567-K' && mod.normalizeRut('') === '');

    const photo = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#cccccc' } }).png().toBuffer();
    const prepared = await mod.prepareDocument(photo);
    const meta = await sharp(prepared).metadata();
    ok('una foto válida se guarda como JPG y sin metadatos', meta.format === 'jpeg' && !meta.exif);
    const tiny = await sharp({ create: { width: 200, height: 120, channels: 3, background: '#cccccc' } }).png().toBuffer();
    let tooSmall = '';
    try { await mod.prepareDocument(tiny); } catch (error) { tooSmall = error.message; }
    ok('una foto muy pequeña se rechaza con un mensaje claro', /muy pequeña/.test(tooSmall), tooSmall);
    let notImage = '';
    try { await mod.prepareDocument(Buffer.from('esto no es una imagen')); } catch (error) { notImage = error.message; }
    ok('un archivo que no es imagen se rechaza', /No se pudo leer/.test(notImage), notImage);
  } catch (error) {
    ok('la verificación de identidad no lanzó errores inesperados', false, error.stack);
  }
})();
