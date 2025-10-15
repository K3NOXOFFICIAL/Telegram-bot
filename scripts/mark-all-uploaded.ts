/**
 * Script: Mark All Files as Uploaded
 * CLI tool to mark all files in OneDrive folders as already uploaded
 * Usage: ts-node scripts/mark-all-uploaded.ts
 */

import { OneDriveClient } from '../lib/onedrive';
import { markFileAsPosted, isFilePosted } from '../lib/store';
import { loadConfig } from '../lib/config';

interface Stats {
  foldersScanned: number;
  filesFound: number;
  filesAlreadyMarked: number;
  filesNewlyMarked: number;
  errors: number;
}

async function markAllAsUploaded() {
  const stats: Stats = {
    foldersScanned: 0,
    filesFound: 0,
    filesAlreadyMarked: 0,
    filesNewlyMarked: 0,
    errors: 0,
  };

  try {
    console.log('📋 Starting mark-all-uploaded operation...\n');
    
    // Load configuration
    const config = loadConfig();
    
    // Initialize OneDrive client
    const onedrive = new OneDriveClient(config);
    
    // Get all subfolders from the configured OneDrive path
    const folders = await onedrive.listSubfolders(config.onedriveFolderPath);
    console.log(`📁 Found ${folders.length} child folders\n`);

    // Also collect files sitting directly in the configured folder (root files)
    const rootFiles = await onedrive.listFilesInFolder(config.onedriveFolderPath);
    if (rootFiles.length > 0) console.log(`📄 Found ${rootFiles.length} files in root folder\n`);

    // If no folders and no root files, nothing to do
    if (folders.length === 0 && rootFiles.length === 0) {
      console.log('⚠️  No folders or files found to process');
      return;
    }

    // First process root files as a pseudo-folder
    if (rootFiles.length > 0) {
      stats.foldersScanned++;
      const folderName = config.onedriveFolderPath || 'root';
      const mediaFiles = rootFiles.filter(f => onedrive.isMediaFile(f));
      console.log(`📂 Processing root (${folderName}) - ${mediaFiles.length} media files`);

      stats.filesFound += mediaFiles.length;
      for (const file of mediaFiles) {
        try {
          const alreadyPosted = await isFilePosted(file.id);
          if (alreadyPosted) {
            stats.filesAlreadyMarked++;
          } else {
            await markFileAsPosted(file.id, file.name, folderName, 0);
            stats.filesNewlyMarked++;
            console.log(`  ✅ Marked: ${file.name}`);
          }
        } catch (error: any) {
          stats.errors++;
          console.error(`  ❌ Failed to mark ${file.name}: ${error?.message || error}`);
        }
      }
      console.log('');
    }

    // Process each child folder
    for (const folder of folders) {
      stats.foldersScanned++;
      
      try {
        console.log(`📂 Processing folder: ${folder.name}`);
        
  // Get all files from the folder and subfolders (e.g., images/, videos/)
  const files = await onedrive.listFilesRecursive(folder.path);
  const mediaFiles = files.filter(f => onedrive.isMediaFile(f));
  console.log(`  📄 Found ${mediaFiles.length} media files`);
        
  stats.filesFound += mediaFiles.length;
        
  // Mark each file as posted
  for (const file of mediaFiles) {
          try {
            // Check if already marked
            const alreadyPosted = await isFilePosted(file.id);
            
            if (alreadyPosted) {
              stats.filesAlreadyMarked++;
              // Don't log every already-marked file to reduce noise
            } else {
              // Mark as posted with dummy message ID
              await markFileAsPosted(
                file.id,
                file.name,
                folder.name,
                0 // Dummy message ID for bulk marking
              );
              stats.filesNewlyMarked++;
              console.log(`  ✅ Marked: ${file.name}`);
            }
          } catch (error: any) {
            stats.errors++;
            console.error(`  ❌ Failed to mark ${file.name}: ${error?.message || error}`);
          }
        }
        
        console.log(`  ⏭️  Already marked: ${stats.filesAlreadyMarked - (stats.foldersScanned > 1 ? stats.filesAlreadyMarked : 0)} files`);
        console.log('');
      } catch (error: any) {
        stats.errors++;
        console.error(`❌ Failed to process folder ${folder.name}: ${error?.message || error}\n`);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Mark-all-uploaded completed\n');
    console.log('📊 Final Statistics:');
    console.log(`  - Folders scanned: ${stats.foldersScanned}`);
    console.log(`  - Files found: ${stats.filesFound}`);
    console.log(`  - Already marked: ${stats.filesAlreadyMarked}`);
    console.log(`  - Newly marked: ${stats.filesNewlyMarked}`);
    console.log(`  - Errors: ${stats.errors}`);
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error?.message || error);
    process.exit(1);
  }
}

// Run the script
markAllAsUploaded()
  .then(() => {
    console.log('\n✅ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
