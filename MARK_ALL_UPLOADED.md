# Mark All Files as Uploaded Feature

## Overview

This feature allows you to mark all existing files in your OneDrive folders as already uploaded, preventing them from being posted to Telegram during future syncs. This is particularly useful when:

- Setting up the bot for the first time with existing OneDrive content
- Resetting the Redis cache and wanting to avoid re-posting old files
- Migrating from another system

## Implementation

### Files Created

1. **`api/mark-all-uploaded.ts`** - API endpoint for marking all files
2. **`scripts/mark-all-uploaded.ts`** - CLI script for local execution
3. Updated **`package.json`** - Added npm script command
4. Updated **`README.md`** - Added documentation
5. Updated **`public/index.html`** - Added UI button and function

### How It Works

The feature scans all folders configured in your OneDrive path and:

1. Lists all subfolders using the OneDrive API
2. For each folder, recursively finds all files (including subfolders)
3. Checks if each file is already marked as uploaded
4. Marks new files with a dummy message ID (0) to indicate they're already processed
5. Provides detailed statistics on the operation

### Usage Methods

#### 1. Web API (Production)

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/mark-all-uploaded" -Method POST | ConvertFrom-Json
```

#### 2. Web Interface

1. Open your bot's control panel in a browser
2. Click the "✅ Mark All as Uploaded" button
3. Confirm the action in the dialog
4. View the results and statistics

#### 3. CLI Script (Local Development)

```powershell
npm run mark-all-uploaded
```

### Response Format

```json
{
  "success": true,
  "message": "All files marked as uploaded",
  "stats": {
    "foldersScanned": 5,
    "filesFound": 1250,
    "filesAlreadyMarked": 200,
    "filesNewlyMarked": 1050,
    "errors": 0,
    "duration": 45230,
    "errorDetails": []
  }
}
```

### Statistics Explained

- **foldersScanned**: Number of OneDrive folders processed
- **filesFound**: Total number of files discovered
- **filesAlreadyMarked**: Files that were already marked (skipped)
- **filesNewlyMarked**: Files that were newly marked in this operation
- **errors**: Number of errors encountered
- **duration**: Total operation time in milliseconds
- **errorDetails**: Array of error messages (if any)

## Safety Features

1. **Confirmation Required**: Web interface requires user confirmation before execution
2. **Idempotent**: Running multiple times doesn't create duplicates
3. **Non-destructive**: Only adds markers, doesn't delete or modify existing data
4. **Error Handling**: Continues processing even if individual files fail
5. **Detailed Logging**: Provides comprehensive feedback on the operation

## Technical Details

### Storage

Files are marked using the same `markFileAsPosted()` function used during normal sync:
- Primary storage: Redis (`file:{fileId}`)
- Fallback storage: `bot_state` in Vercel KV or in-memory store
- Message ID set to `0` to distinguish from actual uploaded files

### Performance

- Uses bulk/batch processing for efficiency
- Leverages OneDrive's pagination for large file sets
- Provides real-time progress feedback in CLI mode
- Optimized for Vercel's serverless environment

## Use Cases

### Scenario 1: Initial Setup
You have 5000 existing files in OneDrive and want to set up the bot without re-posting everything.

**Solution**: Run `mark-all-uploaded` before your first sync.

### Scenario 2: Redis Reset
Your Redis cache was cleared and you don't want duplicate posts.

**Solution**: Run `mark-all-uploaded` to restore the upload markers.

### Scenario 3: Selective Posting
You want to manually select which files to post.

**Solution**: 
1. Run `mark-all-uploaded` to mark everything
2. Clear specific file markers for files you want to post
3. Run sync

## Warnings

⚠️ **Important Considerations**

- This action marks **ALL** files as uploaded - they will be skipped in future syncs
- Cannot be easily undone (would require clearing Redis and re-scanning)
- Make sure your OneDrive configuration is correct before running
- Large folders may take several minutes to process

## Testing

To test the feature locally:

```powershell
# 1. Set up environment variables
# 2. Run the script
npm run mark-all-uploaded

# 3. Check the output for statistics
# 4. Verify in Redis or via /api/status endpoint
```

## Error Handling

The feature includes robust error handling:

- **Individual file errors**: Don't stop the entire operation
- **Folder errors**: Logged but don't prevent processing other folders
- **API errors**: Properly caught and reported
- **Timeout protection**: Suitable for Vercel's execution time limits

## Future Enhancements

Potential improvements:

1. **Selective marking**: Mark only specific folders or file types
2. **Undo functionality**: Clear markers for specific files or folders
3. **Progress tracking**: Real-time progress for large operations
4. **Scheduled marking**: Automatically mark new files after a certain date
5. **Dry-run mode**: Preview what would be marked without actually marking

---

**Created**: October 15, 2025
**Last Updated**: October 15, 2025
