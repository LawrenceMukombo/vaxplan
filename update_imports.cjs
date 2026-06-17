const fs = require('fs');
const glob = require('glob');
const path = require('path');

const replace1 = 'import { OSM_TILE_ATTRIBUTION } from "@/data/dataSources";';
const replace2 = 'import { OSM_TILE_ATTRIBUTION, ESRI_IMAGERY_ATTRIBUTION } from "@/data/dataSources";';
const replace3 = 'import {\n  OSM_TILE_ATTRIBUTION,\n  ESRI_IMAGERY_ATTRIBUTION\n} from "@/data/dataSources";';
const newImport = 'import { OSM_TILE_ATTRIBUTION, ESRI_IMAGERY_ATTRIBUTION, CARTO_POSITRON_ATTRIBUTION, CARTO_VOYAGER_ATTRIBUTION } from "@/data/dataSources";';

glob('client/src/**/*.ts*', { cwd: 'c:/vaxplan/VaxPlan' }, (err, files) => {
  if (err) throw err;
  for (const file of files) {
    const fullPath = path.join('c:/vaxplan/VaxPlan', file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;
    
    if (content.includes(replace1)) {
      content = content.replace(replace1, newImport);
      changed = true;
    }
    if (content.includes(replace2)) {
      content = content.replace(replace2, newImport);
      changed = true;
    }
    if (content.includes(replace3)) {
      content = content.replace(replace3, newImport);
      changed = true;
    }
    
    // Fallback regex if formatting differs
    if (!changed && content.includes('dataSources') && !content.includes('CARTO_POSITRON_ATTRIBUTION') && content.includes('OSM_TILE_ATTRIBUTION')) {
       content = content.replace(/import\s*{[^}]*OSM_TILE_ATTRIBUTION[^}]*}\s*from\s*['"]@\/data\/dataSources['"];?/s, newImport);
       changed = true;
    }

    if (changed) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Updated ' + file);
    }
  }
});
