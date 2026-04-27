import fs from 'node:fs';

const mainPath = 'src/main.jsx';
let main = fs.readFileSync(mainPath, 'utf8');

if (main.includes('const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];') && !main.includes('const ActiveIcon = active.icon;')) {
  main = main.replace(
    'const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];\n  return <main',
    'const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];\n  const ActiveIcon = active.icon;\n  return <main'
  );
}

main = main.replaceAll('<active.icon />', '<ActiveIcon />');

fs.writeFileSync(mainPath, main);
