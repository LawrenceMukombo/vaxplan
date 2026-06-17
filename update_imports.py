import os
import glob

def update_imports():
    files = glob.glob('c:/vaxplan/VaxPlan/client/src/**/*.tsx', recursive=True) + \
            glob.glob('c:/vaxplan/VaxPlan/client/src/**/*.ts', recursive=True)
            
    replace1 = 'import { OSM_TILE_ATTRIBUTION } from "@/data/dataSources";'
    replace2 = 'import { OSM_TILE_ATTRIBUTION, ESRI_IMAGERY_ATTRIBUTION } from "@/data/dataSources";'
    new_import = 'import { OSM_TILE_ATTRIBUTION, ESRI_IMAGERY_ATTRIBUTION, CARTO_POSITRON_ATTRIBUTION, CARTO_VOYAGER_ATTRIBUTION } from "@/data/dataSources";'

    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as file:
                content = file.read()
            
            if replace1 in content or replace2 in content:
                content = content.replace(replace1, new_import)
                content = content.replace(replace2, new_import)
                
                with open(f, 'w', encoding='utf-8') as file:
                    file.write(content)
                print(f"Updated {f}")
        except Exception as e:
            pass

if __name__ == "__main__":
    update_imports()
