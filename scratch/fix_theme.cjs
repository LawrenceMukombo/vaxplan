const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '..', 'client', 'src', 'pages');

const replacements = [
  // Backgrounds
  { regex: /bg-slate-900\/\d+/g, replacement: 'bg-background' },
  { regex: /bg-slate-900/g, replacement: 'bg-background' },
  { regex: /bg-slate-800\/\d+/g, replacement: 'bg-muted' },
  { regex: /bg-slate-800/g, replacement: 'bg-muted' },
  { regex: /bg-slate-100/g, replacement: 'bg-muted' },
  { regex: /bg-slate-50\b/g, replacement: 'bg-muted' },
  { regex: /bg-slate-700/g, replacement: 'bg-accent' },
  // Borders
  { regex: /border-slate-800\/\d+/g, replacement: 'border-border' },
  { regex: /border-slate-800/g, replacement: 'border-border' },
  { regex: /border-slate-700\/\d+/g, replacement: 'border-border' },
  { regex: /border-slate-700/g, replacement: 'border-border' },
  { regex: /border-slate-600/g, replacement: 'border-border' },
  { regex: /border-slate-500/g, replacement: 'border-border' },
  { regex: /border-slate-200/g, replacement: 'border-border' },
  { regex: /border-slate-300/g, replacement: 'border-border' },
  // Text
  { regex: /text-slate-200/g, replacement: 'text-foreground' },
  { regex: /text-slate-300/g, replacement: 'text-foreground' },
  { regex: /text-slate-400/g, replacement: 'text-muted-foreground' },
  { regex: /text-slate-500/g, replacement: 'text-muted-foreground' },
  { regex: /text-slate-600/g, replacement: 'text-muted-foreground' },
  { regex: /text-slate-700/g, replacement: 'text-foreground' },
  { regex: /text-slate-800/g, replacement: 'text-foreground' },
  { regex: /text-slate-900/g, replacement: 'text-foreground' },
  // Hover & other
  { regex: /hover:bg-slate-800\/\d+/g, replacement: 'hover:bg-muted' },
  { regex: /hover:bg-slate-800/g, replacement: 'hover:bg-muted' },
  { regex: /hover:bg-slate-700/g, replacement: 'hover:bg-accent' },
  { regex: /hover:border-slate-700/g, replacement: 'hover:border-border' },
  { regex: /hover:border-slate-600/g, replacement: 'hover:border-border' },
  { regex: /hover:border-slate-500/g, replacement: 'hover:border-border' },
  { regex: /placeholder:text-slate-500/g, replacement: 'placeholder:text-muted-foreground' },
  { regex: /placeholder:text-slate-600/g, replacement: 'placeholder:text-muted-foreground' },
  { regex: /placeholder:text-slate-400/g, replacement: 'placeholder:text-muted-foreground' },
  // Dark mode modifiers specifically for slate
  { regex: /dark:bg-slate-\d+(\/\d+)?/g, replacement: 'dark:bg-background' },
  { regex: /dark:text-slate-\d+/g, replacement: 'dark:text-foreground' },
  { regex: /dark:border-slate-\d+(\/\d+)?/g, replacement: 'dark:border-border' },
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(directoryPath);
let totalReplaced = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplaced++;
    console.log(`Updated ${file}`);
  }
});

console.log(`\nFinished! Updated ${totalReplaced} files.`);
