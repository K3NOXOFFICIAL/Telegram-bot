# Quick Start: Mark All Files as Uploaded

## What is this?

A utility to mark all files in your OneDrive folders as "already uploaded" so they won't be posted to Telegram in future syncs.

## When to use?

✅ **First-time setup** - You have thousands of existing files in OneDrive  
✅ **After Redis reset** - Your upload history was lost  
✅ **Fresh start** - You want to start tracking from now, ignore old files  
❌ **Don't use if** - You want to post all your existing files to Telegram

## How to use?

### Method 1: Web Interface (Easiest)

1. Open your bot's control panel: `https://your-project.vercel.app`
2. Click the **"✅ Mark All as Uploaded"** button
3. Confirm the warning dialog
4. Wait for completion (may take a few minutes for large folders)
5. Check the statistics

### Method 2: API Call (For automation)

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/mark-all-uploaded" -Method POST | ConvertFrom-Json
```

### Method 3: Local Script (For testing/large operations)

```powershell
cd s:\Coding\Telegram-bot
npm run mark-all-uploaded
```

## What happens?

```
1. Scans all folders in your OneDrive path
2. Finds all files (including in subfolders)
3. Marks each file as "uploaded" in Redis
4. Shows statistics:
   - Total files found
   - Files newly marked
   - Files already marked
   - Any errors
```

## Example Output

```json
{
  "success": true,
  "stats": {
    "foldersScanned": 5,
    "filesFound": 1250,
    "filesAlreadyMarked": 200,
    "filesNewlyMarked": 1050,
    "errors": 0,
    "duration": 45230
  }
}
```

**Translation:**
- Found 5 folders
- Found 1250 total files
- 200 were already marked (skipped)
- 1050 newly marked
- No errors
- Took 45.23 seconds

## Important Notes

⚠️ **Warning**: This marks ALL files - they will NOT be posted in future syncs!

⚠️ **Cannot easily undo**: You'd need to clear Redis and start over

✅ **Safe to run multiple times**: Already-marked files are skipped

✅ **Won't delete anything**: Only adds markers to database

## Common Scenarios

### Scenario 1: New Bot Setup
```
Problem: Have 5000 vacation photos in OneDrive, only want to post new ones
Solution: Run mark-all-uploaded before first sync
Result: Only new photos (added after setup) will be posted
```

### Scenario 2: Redis Was Cleared
```
Problem: Redis cache cleared, bot wants to re-post everything
Solution: Run mark-all-uploaded immediately
Result: Prevents duplicate posts
```

### Scenario 3: Testing
```
Problem: Want to test bot without posting thousands of files
Solution: Run mark-all-uploaded in dev environment
Result: Can test sync logic without spam
```

## Verification

After running, verify it worked:

```powershell
# Check status
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/status" | ConvertFrom-Json

# Look for totalPostedFiles count
```

## Troubleshooting

### "Connection error"
- Check internet connection
- Verify OneDrive credentials in environment variables
- Test OneDrive access separately

### "No files found"
- Check `ONEDRIVE_FOLDER_PATH` is correct
- Verify folder has subfolders
- Check Azure permissions

### "Timeout"
- Use local script instead (`npm run mark-all-uploaded`)
- Local script has no timeout limits

### "Some files failed"
- Check `errorDetails` in response
- Individual failures don't stop the process
- Can re-run to retry failed files

## Need Help?

1. Check full documentation: [MARK_ALL_UPLOADED.md](./MARK_ALL_UPLOADED.md)
2. Review the changelog: [CHANGELOG_FIXES.md](./CHANGELOG_FIXES.md)
3. Check main README: [README.md](./README.md)

---

**Quick Reference Card**

| Task | Command |
|------|---------|
| Web Interface | Click "✅ Mark All as Uploaded" |
| API Call | `POST /api/mark-all-uploaded` |
| Local Script | `npm run mark-all-uploaded` |
| Check Status | `GET /api/status` |
| View Docs | `MARK_ALL_UPLOADED.md` |

**Remember:** This prevents future posts. Use wisely! 🎯
