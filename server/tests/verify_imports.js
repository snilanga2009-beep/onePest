const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Find all identifiers from 'lucide-react'
  const lucideMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  const importedLucide = new Set();
  if (lucideMatch) {
    lucideMatch[1].split(',').forEach(s => {
      const clean = s.trim().split(/\s+as\s+/)[0].trim();
      if (clean) importedLucide.add(clean);
    });
  }

  // Find other imports
  // Check JSX tags like <Bell ... /> or icon: Bell
  const tagMatches = content.match(/<([A-Z][A-Za-z0-9_]*)/g) || [];
  const iconPropertyMatches = content.match(/icon:\s*([A-Z][A-Za-z0-9_]*)/g) || [];

  const usedSymbols = new Set();
  tagMatches.forEach(t => usedSymbols.add(t.substring(1)));
  iconPropertyMatches.forEach(t => usedSymbols.add(t.replace(/icon:\s*/, '').trim()));

  const missing = [];
  usedSymbols.forEach(sym => {
    // Check if sym is defined in file (imported or declared)
    const regex = new RegExp(`\\b${sym}\\b`);
    const importRegex = new RegExp(`import[\\s\\S]*?\\b${sym}\\b[\\s\\S]*?from`);
    const constRegex = new RegExp(`(const|let|var|function)\\s+${sym}\\b`);

    if (!importRegex.test(content) && !constRegex.test(content) && sym !== 'React') {
      missing.push(sym);
    }
  });

  if (missing.length > 0) {
    console.log(`[FILE] ${filePath}: Missing or undeclared:`, missing);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scanDir(full);
    } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      checkFile(full);
    }
  }
}

console.log('Scanning client/src for any missing symbols...');
scanDir(path.join(__dirname, '../../client/src'));
console.log('Scan completed!');
