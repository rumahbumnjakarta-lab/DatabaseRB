const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'tampilan.html');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/^const\s+(items|grid|chipRow|searchInput|emptyState|categories)\s*=/gm, 'var $1 =');
fs.writeFileSync(file, content);
