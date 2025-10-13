/**
 * Test-Script: Überprüft alle Ordner auf Mediendateien
 */

import { config as loadEnv } from 'dotenv';
import { loadConfig } from '../lib/config';
import { OneDriveClient } from '../lib/onedrive';

loadEnv();

async function checkMedia() {
  console.log('🔍 Überprüfe SharePoint-Ordner auf Mediendateien...\n');

  try {
    const config = loadConfig();
    const onedrive = new OneDriveClient(config);

    console.log(`📁 Hauptordner: ${config.onedriveFolderPath}\n`);

    // Hole alle Unterordner
    const folders = await onedrive.listSubfolders(config.onedriveFolderPath);
    console.log(`✅ ${folders.length} Unterordner gefunden:\n`);

    // Durchsuche jeden Ordner
    for (const folder of folders) {
      console.log(`\n📂 ${folder.name}`);
      console.log(`   Pfad: ${folder.path}`);

      try {
        // Hole alle Dateien rekursiv (inkl. Unterordner wie images/, videos/)
        const files = await onedrive.listFilesRecursive(folder.path);
        console.log(`   📄 ${files.length} Dateien insgesamt (inkl. Unterordner)`);

        if (files.length === 0) {
          console.log(`   ⚠️  Ordner ist leer (auch in Unterordnern)`);
          continue;
        }

        // Gruppiere nach Dateityp
        const fileTypes: { [key: string]: number } = {};
        const mediaFiles = [];

        for (const file of files) {
          const mimeType = file.file?.mimeType || 'unknown';
          fileTypes[mimeType] = (fileTypes[mimeType] || 0) + 1;

          if (onedrive.isMediaFile(file)) {
            mediaFiles.push(file);
          }
        }

        // Zeige Statistiken
        console.log(`   🎬 ${mediaFiles.length} Mediendateien (Bilder/Videos)`);
        
        if (mediaFiles.length > 0) {
          console.log(`\n   📋 Mediendateien:`);
          for (const file of mediaFiles.slice(0, 5)) {
            const type = file.file?.mimeType?.startsWith('video/') ? '🎥' : '🖼️';
            const size = file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'unknown';
            console.log(`      ${type} ${file.name} (${size})`);
          }
          if (mediaFiles.length > 5) {
            console.log(`      ... und ${mediaFiles.length - 5} weitere`);
          }
        }

        // Zeige alle Dateitypen
        console.log(`\n   📊 Dateitypen:`);
        for (const [type, count] of Object.entries(fileTypes)) {
          console.log(`      ${type}: ${count}`);
        }

      } catch (error: any) {
        console.error(`   ❌ Fehler beim Lesen: ${error.message}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n✨ Überprüfung abgeschlossen');

  } catch (error) {
    console.error('❌ Fehler:', error);
    process.exit(1);
  }
}

checkMedia();
