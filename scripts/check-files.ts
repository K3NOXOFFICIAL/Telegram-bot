/**
 * Test-Skript zum Überprüfen eines spezifischen Ordners
 */

import * as dotenv from 'dotenv';
import { OneDriveClient } from '../lib/onedrive';
import { loadConfig } from '../lib/config';
import { OneDriveItem } from '../lib/types';

dotenv.config();

async function main() {
  console.log('🔍 Überprüfe Ordner auf Dateien...\n');
  
  const config = loadConfig();
  const onedrive = new OneDriveClient(config);
  
  const basePath = config.onedriveFolderPath;
  console.log(`📁 Basis-Pfad: ${basePath}`);
  
  // Liste Unterordner
  const folders = await onedrive.listSubfolders(basePath);
  console.log(`\n✅ ${folders.length} Ordner gefunden\n`);
  
  // Prüfe die ersten 3 Ordner auf Dateien
  for (let i = 0; i < Math.min(3, folders.length); i++) {
    const folder = folders[i];
    console.log(`\n📂 Ordner: ${folder.name}`);
    console.log(`   Pfad: ${folder.path}`);
    
    try {
      const files = await onedrive.listFilesInFolder(folder.path);
      console.log(`   📄 ${files.length} Dateien insgesamt`);
      
      // Zähle Mediendateien
      const mediaFiles = files.filter((file: OneDriveItem) => onedrive.isMediaFile(file));
      console.log(`   🖼️  ${mediaFiles.length} Mediendateien (Bilder/Videos)`);
      
      if (mediaFiles.length > 0) {
        console.log(`   Beispiele:`);
        mediaFiles.slice(0, 3).forEach((file: OneDriveItem) => {
          console.log(`     - ${file.name} (${file.file?.mimeType})`);
        });
      }
    } catch (error: any) {
      console.log(`   ❌ Fehler: ${error.message}`);
    }
  }
}

main().catch(console.error);
