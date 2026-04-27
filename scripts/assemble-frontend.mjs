import fs from 'node:fs';
import path from 'node:path';

const files = [
  { target: 'src/main.jsx', prefix: 'main.jsx' },
  { target: 'src/styles.css', prefix: 'styles.css' }
];

for (const file of files) {
  let index = 1;
  let body = '';
  while (true) {
    const chunkPath = path.join('scripts', 'chunks', `${file.prefix}.part${index}.txt`);
    if (!fs.existsSync(chunkPath)) break;
    body += fs.readFileSync(chunkPath, 'utf8');
    index += 1;
  }
  if (!body) throw new Error(`No chunks found for ${file.target}`);
  fs.mkdirSync(path.dirname(file.target), { recursive: true });
  fs.writeFileSync(file.target, body);
}
