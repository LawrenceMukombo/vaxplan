import os

search_dir = r"c:\vaxplan\VaxPlan\client\src"

osm_url = 'url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"'
carto_pos_url = 'url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"'

esri_url = 'url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"'
carto_voy_url = 'url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"'

osm_attr = 'attribution={OSM_TILE_ATTRIBUTION}'
carto_pos_attr = 'attribution={CARTO_POSITRON_ATTRIBUTION}'

esri_attr = 'attribution={ESRI_IMAGERY_ATTRIBUTION}'
carto_voy_attr = 'attribution={CARTO_VOYAGER_ATTRIBUTION}'

for root, _, files in os.walk(search_dir):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            new_content = content
            
            # Simple replacements for urls and attributions
            new_content = new_content.replace(osm_url, carto_pos_url)
            new_content = new_content.replace(esri_url, carto_voy_url)
            new_content = new_content.replace(osm_attr, carto_pos_attr)
            new_content = new_content.replace(esri_attr, carto_voy_attr)
            
            # Additional fixes
            if f == 'dataSources.ts':
                new_content = new_content.replace('export const OSM_TILE_ATTRIBUTION', 'export const CARTO_POSITRON_ATTRIBUTION')
                new_content = new_content.replace('export const ESRI_IMAGERY_ATTRIBUTION', 'export const CARTO_VOYAGER_ATTRIBUTION')
                
                new_content = new_content.replace(
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                )
                new_content = new_content.replace(
                    'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics and the GIS community',
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                )
                
            if f == 'usePersistedBasemap.ts':
                new_content = new_content.replace('"osm" | "satellite" | "carto"', '"positron" | "voyager"')
                new_content = new_content.replace('v === "osm" || v === "satellite" || v === "carto"', 'v === "positron" || v === "voyager"')
                new_content = new_content.replace('defaultValue: Basemap = "osm"', 'defaultValue: Basemap = "positron"')
                new_content = new_content.replace('e.newValue === "osm" || e.newValue === "satellite" || e.newValue === "carto"', 'e.newValue === "positron" || e.newValue === "voyager"')
                
            if f == 'BasemapToggle.tsx':
                new_content = new_content.replace('basemap === "satellite"', 'basemap === "voyager"')
                new_content = new_content.replace('onChange("satellite")', 'onChange("voyager")')
                new_content = new_content.replace('basemap === "osm"', 'basemap === "positron"')
                new_content = new_content.replace('onChange("osm")', 'onChange("positron")')
                new_content = new_content.replace('OSM_TILE_ATTRIBUTION', 'CARTO_POSITRON_ATTRIBUTION')
                new_content = new_content.replace('ESRI_IMAGERY_ATTRIBUTION', 'CARTO_VOYAGER_ATTRIBUTION')
                new_content = new_content.replace('data-testid="basemap-osm"', 'data-testid="basemap-positron"')
                new_content = new_content.replace('data-testid="basemap-satellite"', 'data-testid="basemap-voyager"')
                new_content = new_content.replace('Satellite\n      </button>', 'Voyager\n      </button>')

            if f == 'CatchmentMapPanel.tsx':
                new_content = new_content.replace('"osm" | "satellite"', '"positron" | "voyager"')
                new_content = new_content.replace('useState<"osm" | "satellite">("osm")', 'useState<"positron" | "voyager">("positron")')
                new_content = new_content.replace('t === "osm" ? "satellite" : "osm"', 't === "positron" ? "voyager" : "positron"')
                new_content = new_content.replace('tileLayer === "osm" ? "🛰 Satellite" : "🗺 OSM"', 'tileLayer === "positron" ? "🛰 Voyager" : "🗺 Positron"')
                # Handle TILES object replacement
                new_content = new_content.replace(
                    'osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap contributors" },\n  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© Esri World Imagery" }',
                    'positron: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap contributors © CARTO" },\n  voyager: { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap contributors © CARTO" }'
                )

            if new_content != content:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print(f"Updated {f}")
