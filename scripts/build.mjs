import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
for (const f of ['index.html', 'assets/styles.css', 'assets/app.js']) {
  fs.copyFileSync(path.join(root, f), path.join(dist, f));
}
fs.cpSync(path.join(root, 'assets/images'), path.join(dist, 'assets/images'), { recursive: true });
fs.cpSync(path.join(root, 'assets/print'), path.join(dist, 'assets/print'), { recursive: true });
fs.cpSync(path.join(root, 'assets/vendor'), path.join(dist, 'assets/vendor'), { recursive: true });
fs.cpSync(path.join(root, 'assets/models'), path.join(dist, 'assets/models'), { recursive: true });
fs.copyFileSync(path.join(root, 'assets/roller-viewer.js'), path.join(dist, 'assets/roller-viewer.js'));
fs.copyFileSync(path.join(root, 'assets/preview-offer.js'), path.join(dist, 'assets/preview-offer.js'));
fs.copyFileSync(path.join(root, 'assets/customizer-interactions.js'), path.join(dist, 'assets/customizer-interactions.js'));
fs.copyFileSync(path.join(root, 'assets/request-validation.js'), path.join(dist, 'assets/request-validation.js'));
fs.copyFileSync(path.join(root, 'assets/parts-viewer.js'), path.join(dist, 'assets/parts-viewer.js'));
console.log(`Built static site: ${dist}`);
