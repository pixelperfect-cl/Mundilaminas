#!/usr/bin/env node
/*
 * Genera un HTML autocontenido (mundial2026.html) inyectando styles.css,
 * data.js y app.js dentro de index.html. Así se puede abrir un solo archivo
 * directamente en el teléfono, sin servidor ni rutas relativas.
 *
 * Uso: node build-single.cjs
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

let html = read('index.html');
const css = read('styles.css');
const dataJs = read('data.js');
const appJs = read('app.js');

html = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="data.js"></script>', `<script>\n${dataJs}\n</script>`)
  .replace('<script src="app.js"></script>', `<script>\n${appJs}\n</script>`);

fs.writeFileSync(path.join(dir, 'mundial2026.html'), html);
console.log('OK -> mundial2026.html (' + html.length + ' bytes)');
