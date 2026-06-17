const fs = require('fs');
const path = require('path');

const searchDir = path.join(__dirname, 'client', 'src');

const osmUrl = 'url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"';
const cartoPosUrl = 'url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"';

const esriUrl = 'url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"';
const cartoVoyUrl = 'url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"';

const osmAttr = 'attribution={OSM_TILE_ATTRIBUTION}';
const cartoPosAttr = 'attribution={CARTO_POSITRON_ATTRIBUTION}';

const esriAttr = 'attribution={ESRI_IMAGERY_ATTRIBUTION}';
const cartoVoyAttr = 'attribution={CARTO_VOYAGER_ATTRIBUTION}';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(searchDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content;

    const fileName = path.basename(file);

    // Common replacements
    newContent = newContent.split(osmUrl).join(cartoPosUrl);
    newContent = newContent.split(esriUrl).join(cartoVoyUrl);
    newContent = newContent.split(osmAttr).join(cartoPosAttr);
    newContent = newContent.split(esriAttr).join(cartoVoyAttr);

    if (fileName === 'dataSources.ts') {
        newContent = newContent.replace('export const OSM_TILE_ATTRIBUTION', 'export const CARTO_POSITRON_ATTRIBUTION');
        newContent = newContent.replace('export const ESRI_IMAGERY_ATTRIBUTION', 'export const CARTO_VOYAGER_ATTRIBUTION');
        newContent = newContent.replace(
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        );
        newContent = newContent.replace(
            'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics and the GIS community',
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        );
    }

    if (fileName === 'usePersistedBasemap.ts') {
        newContent = newContent.replace(/"osm" \| "satellite" \| "carto"/g, '"positron" | "voyager"');
        newContent = newContent.replace(/v === "osm" \|\| v === "satellite" \|\| v === "carto"/g, 'v === "positron" || v === "voyager"');
        newContent = newContent.replace('defaultValue: Basemap = "osm"', 'defaultValue: Basemap = "positron"');
        newContent = newContent.replace(/e.newValue === "osm" \|\| e.newValue === "satellite" \|\| e.newValue === "carto"/g, 'e.newValue === "positron" || e.newValue === "voyager"');
    }

    if (fileName === 'BasemapToggle.tsx') {
        newContent = newContent.replace(/basemap === "satellite"/g, 'basemap === "voyager"');
        newContent = newContent.replace(/onChange\("satellite"\)/g, 'onChange("voyager")');
        newContent = newContent.replace(/basemap === "osm"/g, 'basemap === "positron"');
        newContent = newContent.replace(/onChange\("osm"\)/g, 'onChange("positron")');
        newContent = newContent.replace(/OSM_TILE_ATTRIBUTION/g, 'CARTO_POSITRON_ATTRIBUTION');
        newContent = newContent.replace(/ESRI_IMAGERY_ATTRIBUTION/g, 'CARTO_VOYAGER_ATTRIBUTION');
        newContent = newContent.replace(/data-testid="basemap-osm"/g, 'data-testid="basemap-positron"');
        newContent = newContent.replace(/data-testid="basemap-satellite"/g, 'data-testid="basemap-voyager"');
        newContent = newContent.replace(/Satellite\n      <\/button>/g, 'Voyager\n      </button>');
        newContent = newContent.replace(/<Satellite className="h-3\.5 w-3\.5" \/>/g, '<Satellite className="h-3.5 w-3.5" />');
        newContent = newContent.replace(/Map\n      <\/button>/g, 'Map\n      </button>');
    }

    if (fileName === 'CatchmentMapPanel.tsx') {
        newContent = newContent.replace(/"osm" \| "satellite"/g, '"positron" | "voyager"');
        newContent = newContent.replace(/useState<"positron" \| "voyager">\("osm"\)/g, 'useState<"positron" | "voyager">("positron")');
        newContent = newContent.replace(/t === "osm" \? "satellite" : "osm"/g, 't === "positron" ? "voyager" : "positron"');
        newContent = newContent.replace(/tileLayer === "osm" \? "🛰 Satellite" : "🗺 OSM"/g, 'tileLayer === "positron" ? "🛰 Voyager" : "🗺 Positron"');
        
        const oldTiles = `osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap contributors" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© Esri World Imagery" }`;
        const newTiles = `positron: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap contributors © CARTO" },
  voyager: { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap contributors © CARTO" }`;
        newContent = newContent.replace(oldTiles, newTiles);
    }

    if (newContent !== content) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Updated ' + file);
    }
});
