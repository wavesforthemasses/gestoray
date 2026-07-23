const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      walk(path.join(dir, file), fileList);
    } else if (file.endsWith('.spec.ts')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const tests = [...walk('./src/routes'), ...walk('./tests')];
for (const file of tests) {
  console.log(`\n--- ${file} ---`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("test('") || trimmed.startsWith('test("') || trimmed.startsWith('test.describe(')) {
      console.log(trimmed);
    }
  }
}
