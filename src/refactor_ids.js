const fs = require('fs');
const path = require('path');

const directory = '/home/vincenzo/Code/gestoray/src';

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          results.push(file);
          next();
        }
      });
    })();
  });
}

function processFiles(files) {
  files.forEach(file => {
    if (!file.endsWith('.svelte') && !file.endsWith('.ts')) return;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern: 'prefix_' + Math.random().toString(36).substring(2, 11)
    // Sometimes it's without 'prefix_' but in this project it's mostly prefix + '_' + Math...
    const regex = /'([a-zA-Z0-9]+)_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2,\s*11\)/g;
    
    if (regex.test(content)) {
      content = content.replace(regex, "generateId('$1')");
    }

    // Pattern without prefix (if any)
    const regexNoPrefix = /Math\.random\(\)\.toString\(36\)\.substring\(2,\s*11\)/g;
    if (regexNoPrefix.test(content)) {
      content = content.replace(regexNoPrefix, "generateId()");
    }

    if (content !== original) {
      if (file.endsWith('.svelte') && !content.includes('generateId')) {
        const importStr = `  import { generateId } from '$lib/utils/helpers';\n`;
        content = content.replace(/<script[^>]*>/, match => match + "\n" + importStr);
      }
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  });
}

walk(directory, function(err, results) {
  if (err) throw err;
  processFiles(results);
});
