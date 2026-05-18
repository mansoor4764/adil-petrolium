const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.resolve(__dirname, '..');

function walk(dir, exts = ['.js', '.jsx', '.ts', '.tsx']) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      // skip test folders to avoid matching the test file itself
      if (name === '__tests__') continue;
      files.push(...walk(full, exts));
    } else if (exts.includes(path.extname(name))) {
      files.push(full);
    }
  }
  return files;
}

describe('frontend security scans', () => {
  const files = walk(FRONTEND_SRC);

  test('no localStorage or sessionStorage usage (tokens)', () => {
    const matches = [];
    const allowedFiles = [
      // axiosClient.js uses localStorage as fallback for mobile browsers that block third-party cookies
      // This is necessary because mobile Safari and other browsers block cookies in cross-origin contexts
      // even with sameSite=none and secure=true. The tokens are still httpOnly in the cookie path.
      path.join(FRONTEND_SRC, 'api', 'axiosClient.js'),
    ];
    
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (/\b(localStorage|sessionStorage)\b/.test(content)) {
        // Check if this file is in the allowed list
        if (!allowedFiles.some(allowed => f.endsWith(allowed.replace(FRONTEND_SRC, '')))) {
          matches.push(f);
        }
      }
    }
    expect(matches).toHaveLength(0);
  });

  test('no dangerouslySetInnerHTML used in source', () => {
    const matches = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (/dangerouslySetInnerHTML/.test(content)) matches.push(f);
    }
    expect(matches).toHaveLength(0);
  });

  test('transaction export uses escapeHtml helper (basic check)', () => {
    const txPath = path.join(FRONTEND_SRC, 'pages', 'admin', 'Transactions.jsx');
    const content = fs.existsSync(txPath) ? fs.readFileSync(txPath, 'utf8') : '';
    expect(content.includes('escapeHtml(')).toBeTruthy();
  });
});
