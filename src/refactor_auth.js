const fs = require('fs');
const path = require('path');

const directory = '/home/vincenzo/Code/gestoray/src/routes';

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
    if (!file.endsWith('.svelte')) return;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We want to find: if ($activeRole && $activeRole !== 'superadmin' && ...)
    // And replace with: if ($activeRole && !hasAccess($activeRole, ['superadmin', ...]))
    
    // First, let's extract the condition.
    const regex = /if\s*\(\$activeRole\s*&&\s*([^{]+)\)\s*\{/g;
    
    content = content.replace(regex, (match, condition) => {
      // condition looks like: $activeRole !== 'superadmin' && $activeRole !== 'amministrazione'
      if (condition.includes('!==')) {
        const roles = condition.split('&&').map(part => {
          const match = part.match(/!==\s*'([^']+)'/);
          return match ? `'${match[1]}'` : null;
        }).filter(Boolean);
        
        if (roles.length > 0) {
          return `if ($activeRole && !hasAccess($activeRole, [${roles.join(', ')}])) {`;
        }
      }
      return match;
    });

    if (content !== original) {
      // Add import { hasAccess } from '$lib/utils/authCheck'; if not present
      if (!content.includes('hasAccess')) {
        content = content.replace(/<script[^>]*>/, match => match + "\n  import { hasAccess } from '$lib/utils/authCheck';");
      }
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated Auth: ${file}`);
    }
  });
}

walk(directory, function(err, results) {
  if (err) throw err;
  processFiles(results);
});
