/**
 * API Endpoint: Mark All Files as Uploaded
 * Marks all files in the OneDrive folders as already uploaded to prevent re-posting
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OneDriveClient } from '../lib/onedrive';
import { markFileAsPosted, isFilePosted } from '../lib/store';
import { loadConfig } from '../lib/config';

interface MarkAllStats {
  foldersScanned: number;
  filesFound: number;
  filesAlreadyMarked: number;
  filesNewlyMarked: number;
  errors: number;
  duration: number;
  errorDetails?: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Nur POST erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Use POST to mark all files as uploaded'
    });
  }

  const startTime = Date.now();
  const stats: MarkAllStats = {
    foldersScanned: 0,
    filesFound: 0,
    filesAlreadyMarked: 0,
    filesNewlyMarked: 0,
    errors: 0,
    duration: 0,
    errorDetails: [],
  };

  try {
    console.log('📋 Starting mark-all-uploaded operation...');
    
    // Load configuration
    const config = loadConfig();
    
    // Initialize OneDrive client
    const onedrive = new OneDriveClient(config);
    
    // Get all subfolders from the configured OneDrive path and also include files in the root folder
    const folders = await onedrive.listSubfolders(config.onedriveFolderPath);
    console.log(`📁 Found ${folders.length} child folders`);

    // Also collect files sitting directly in the configured folder (root files)
    const rootFiles = await onedrive.listFilesInFolder(config.onedriveFolderPath);
    if (rootFiles.length > 0) console.log(`📄 Found ${rootFiles.length} files in root folder`);

    // If no folders and no root files, nothing to do
    if (folders.length === 0 && rootFiles.length === 0) {
      stats.duration = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        message: 'No folders or files found to process',
        stats,
      });
    }

    // First process root files as a pseudo-folder named after the configured path
    if (rootFiles.length > 0) {
      stats.foldersScanned++;
      try {
        const folderName = config.onedriveFolderPath || 'root';
        const mediaFiles = rootFiles.filter(f => onedrive.isMediaFile(f));
        stats.filesFound += mediaFiles.length;

        for (const file of mediaFiles) {
          try {
            const alreadyPosted = await isFilePosted(file.id);
            if (alreadyPosted) {
              stats.filesAlreadyMarked++;
            } else {
              await markFileAsPosted(file.id, file.name, folderName, 0);
              stats.filesNewlyMarked++;
            }
          } catch (error: any) {
            stats.errors++;
            const errorMsg = `Failed to mark ${file.name}: ${error?.message || error}`;
            console.error(`  ❌ ${errorMsg}`);
            stats.errorDetails?.push(errorMsg);
          }
        }
      } catch (error: any) {
        stats.errors++;
        const errorMsg = `Failed to process root files: ${error?.message || error}`;
        console.error(`❌ ${errorMsg}`);
        stats.errorDetails?.push(errorMsg);
      }
    }

    // Process each child folder
    for (const folder of folders) {
      stats.foldersScanned++;
      
      try {
        console.log(`\n📂 Processing folder: ${folder.name}`);
        
  // Get all files from the folder and subfolders (e.g., images/, videos/)
  const files = await onedrive.listFilesRecursive(folder.path);
  // Filter to media files only
  const mediaFiles = files.filter(f => onedrive.isMediaFile(f));
  console.log(`  📄 Found ${mediaFiles.length} media files in ${folder.name}`);
        
  stats.filesFound += mediaFiles.length;
        
  // Mark each file as posted
  for (const file of mediaFiles) {
          try {
            // Check if already marked
            const alreadyPosted = await isFilePosted(file.id);
            
            if (alreadyPosted) {
              stats.filesAlreadyMarked++;
              console.log(`  ⏭️  Already marked: ${file.name}`);
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
            const errorMsg = `Failed to mark ${file.name}: ${error?.message || error}`;
            console.error(`  ❌ ${errorMsg}`);
            stats.errorDetails?.push(errorMsg);
          }
        }
      } catch (error: any) {
        stats.errors++;
        const errorMsg = `Failed to process folder ${folder.name}: ${error?.message || error}`;
        console.error(`❌ ${errorMsg}`);
        stats.errorDetails?.push(errorMsg);
      }
    }
    
    stats.duration = Date.now() - startTime;
    
    console.log('\n✅ Mark-all-uploaded completed');
    console.log(`📊 Stats:
  - Folders scanned: ${stats.foldersScanned}
  - Files found: ${stats.filesFound}
  - Already marked: ${stats.filesAlreadyMarked}
  - Newly marked: ${stats.filesNewlyMarked}
  - Errors: ${stats.errors}
  - Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    
    return res.status(200).json({
      success: true,
      message: 'All files marked as uploaded',
      stats,
    });
    
  } catch (error: any) {
    stats.duration = Date.now() - startTime;
    console.error('❌ Mark-all-uploaded failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error?.message || 'Unknown error occurred',
      stats,
    });
  }
}
