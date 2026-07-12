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
    if (file.includes('formatters.ts')) return; // Skip formatters itself

    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    let needsFormatDate = false;
    let needsFormatDateTime = false;
    let needsFormatCurrency = false;

    // LineChart specific:
    if (file.includes('LineChart.svelte')) {
      content = content.replace(/\{isCurrency \? '€' \+ maxVal\.toLocaleString\('it-IT'\) : maxVal\}/g, "{isCurrency ? formatCurrency(maxVal) : maxVal}");
      content = content.replace(/\{isCurrency \? '€' \+ data\[selectedIdx\]\.toLocaleString\('it-IT'\) : data\[selectedIdx\]\}/g, "{isCurrency ? formatCurrency(data[selectedIdx]) : data[selectedIdx]}");
      needsFormatCurrency = true;
    }

    // Replace dates:
    // Pattern 1: new Date(x).toLocaleDateString('it-IT') -> formatDate(x)
    const regexDate = /new Date\(([^)]+)\)\.toLocaleDateString\('it-IT'\)/g;
    if (regexDate.test(content)) {
      content = content.replace(regexDate, "formatDate($1)");
      needsFormatDate = true;
    }

    // Pattern 2: new Date(x).toLocaleString('it-IT') -> formatDateTime(x)
    // Wait, some places use it for dates, some for time. If it's toLocaleString('it-IT') without options, let's use formatDateTime.
    const regexDateTime = /new Date\(([^)]+)\)\.toLocaleString\('it-IT'\)/g;
    if (regexDateTime.test(content)) {
      content = content.replace(regexDateTime, "formatDateTime($1)");
      needsFormatDateTime = true;
    }

    // Pattern 3: value.toLocaleString('it-IT', { minimumFractionDigits: 2 }) -> formatCurrency(value)
    const regexCurrency1 = /\{([^}]+)\.toLocaleString\('it-IT',\s*\{\s*minimumFractionDigits:\s*2\s*\}\)\}/g;
    if (regexCurrency1.test(content)) {
      // In +page.svelte: € {item.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
      // We should replace the € sign too if we can, but regex might be tricky.
      // Let's just do a manual replace for the specific known cases if needed.
    }
    
    // Specifically for dashboard/+page.svelte: € {item.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
    if (content.includes("€ {item.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}")) {
      content = content.replace(/€ \{item\.valore\.toLocaleString\('it-IT', \{ minimumFractionDigits: 2 \}\)\}/g, "{formatCurrency(item.valore)}");
      needsFormatCurrency = true;
    }

    // Specific for todo/+page.svelte: €${(c.totalPrice || 0).toLocaleString('it-IT')}
    if (content.includes(".toLocaleString('it-IT')") && file.includes('todo')) {
      content = content.replace(/€\$\{\(c\.totalPrice \|\| 0\)\.toLocaleString\('it-IT'\)\}/g, "${formatCurrency(c.totalPrice || 0)}");
      content = content.replace(/€\$\{\(inst\.expectedAmount \|\| 0\)\.toLocaleString\('it-IT'\)\}/g, "${formatCurrency(inst.expectedAmount || 0)}");
      needsFormatCurrency = true;
    }

    if (content !== original) {
      // Inject imports if needed
      if (file.endsWith('.svelte') && !content.includes('$lib/utils/formatters')) {
        let imports = [];
        if (needsFormatDate) imports.push('formatDate');
        if (needsFormatDateTime) imports.push('formatDateTime');
        if (needsFormatCurrency) imports.push('formatCurrency');

        if (imports.length > 0) {
          const importStr = `  import { ${imports.join(', ')} } from '$lib/utils/formatters';\n`;
          // Find script tag
          content = content.replace(/<script[^>]*>/, match => match + "\n" + importStr);
        }
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
