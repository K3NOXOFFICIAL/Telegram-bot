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
    console.log(`📁 Found ${folders.length} folders\n`);
    
    if (folders.length === 0) {
      console.log('⚠️  No folders found to process');
      return;
    }

    // Process each folder
    for (const folder of folders) {
      stats.foldersScanned++;
      
      try {
        console.log(`📂 Processing folder: ${folder.name}`);
        
        // Get all files from the folder and subfolders (e.g., images/, videos/)
        const files = await onedrive.listFilesRecursive(folder.path);
        console.log(`  📄 Found ${files.length} files`);
        
        stats.filesFound += files.length;
        
        // Mark each file as posted
        for (const file of files) {
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
