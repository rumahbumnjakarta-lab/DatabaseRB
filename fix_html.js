const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Change top-level `let ` to `var ` inside <script> tags
  content = content.replace(/(<script>[\s\S]*?)(\n\s*)let\s+(currentUser|gpsData|selfieBase64|map|myMarker|cameraStream|detailMap|avatarBase64)/g, '$1$2var $3');
  // Run it a few times to catch multiple 'let's in the same block if regex misses overlapping
  for(let i=0; i<5; i++){
    content = content.replace(/^(\s*)let\s+(currentUser|gpsData|selfieBase64|map|myMarker|cameraStream|detailMap|avatarBase64)/gm, '$1var $2');
  }
  
  // 2. Fix absen.html Leaflet map initialization
  if (file === 'absen.html') {
    if (!content.includes('try{map.remove()}')) {
      content = content.replace(/map = L\.map\('map'/g, `if(map) { try{map.remove()}catch(e){} }\n  map = L.map('map'`);
    }
    content = content.replace(/cameraStream = stream;/g, 'window.cameraStream = stream;');
    content = content.replace(/if \(cameraStream\)/g, 'if (window.cameraStream)');
  }
  
  // 3. Fix rekap-absen.html Leaflet map initialization
  if (file === 'rekap-absen.html') {
    if (!content.includes('try{detailMap.remove()}')) {
      content = content.replace(/detailMap = L\.map\('detailMap'/g, `if(detailMap) { try{detailMap.remove()}catch(e){} }\n      detailMap = L.map('detailMap'`);
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched', file);
});
