# Upstash Redis Setup - Quick Reference

## What Changed?

Your Telegram bot now uses **Upstash Redis** as the primary storage provider instead of Vercel KV.

### Why Upstash?

| Feature | Vercel KV | Upstash Redis |
|---------|-----------|---------------|
| Free Commands/Day | 3,000 | **10,000** |
| Storage | 256 MB | 256 MB |
| API Type | REST | REST |
| Serverless | ✅ | ✅ |
| Cost | Free tier limited | More generous free tier |

**Result**: 3.3x more free commands per day!

## Quick Setup (5 minutes)

### 1. Create Upstash Account
```
1. Go to https://upstash.com
2. Sign up (free)
3. Click "Create Database"
4. Name: telegram-bot-storage
5. Region: Choose closest to your Vercel region
6. Click Create
```

### 2. Get Credentials
```
From Upstash dashboard → REST API section, copy:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
```

### 3. Add to Vercel
```powershell
vercel env add UPSTASH_REDIS_REST_URL
# Paste your URL

vercel env add UPSTASH_REDIS_REST_TOKEN
# Paste your token
```

### 4. Deploy
```powershell
npm run deploy
```

Done! ✅

## Local Development

Add to your `.env` file:

```env
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxx
```

## Migrate Existing Data (Optional)

If you have data in Vercel KV:

```powershell
# Keep both old and new credentials in .env, then:
npm run migrate-to-upstash
```

This will copy all your:
- Posted files markers
- Topic mappings
- Bot state
- Settings

## Verify It's Working

### Local:
```powershell
npm run dev
```

Look for in console:
```
✅ Upstash Redis verbunden (REST API)
```

### Production:
Check Vercel deployment logs for the same message.

## Storage Priority (Automatic)

The bot will try to connect in this order:

1. **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
2. Standard Redis (`REDIS_URL`)
3. Vercel KV (`KV_REST_API_URL` + `KV_REST_API_TOKEN`)
4. In-Memory (not persistent - fallback only)

## Files Changed

✅ `lib/store.ts` - Added Upstash priority
✅ `package.json` - Added `@upstash/redis` dependency  
✅ `.env.example` - Added Upstash credentials template  
✅ `README.md` - Updated documentation  
✅ `scripts/migrate-to-upstash.ts` - Migration script  
✅ `UPSTASH_MIGRATION.md` - Full migration guide

## Dependencies

Already added to `package.json`:
```json
"@upstash/redis": "^1.34.3"
```

Install with:
```powershell
npm install
```

## Troubleshooting

### "Nutze In-Memory Store"
❌ Problem: Upstash credentials not found

✅ Solution:
- Check `UPSTASH_REDIS_REST_URL` is set
- Check `UPSTASH_REDIS_REST_TOKEN` is set
- Verify credentials are correct
- Redeploy after adding env vars

### "WRONGPASS invalid username-password pair"
❌ Problem: Invalid token

✅ Solution:
- Double-check token in Upstash dashboard
- Regenerate token if needed
- Update environment variable

### Migration fails
❌ Problem: Can't access old Vercel KV

✅ Solution:
- Make sure old KV credentials are still in `.env`
- Check Vercel KV is not deleted
- Run migration locally, not on Vercel

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Create Upstash account and database
3. ✅ Add credentials to `.env` and Vercel
4. ✅ Test locally: `npm run dev`
5. ✅ (Optional) Migrate data: `npm run migrate-to-upstash`
6. ✅ Deploy: `npm run deploy`
7. ✅ Verify in production
8. ✅ Remove old Vercel KV (after confirming everything works)

## Support

- **Full Guide**: [UPSTASH_MIGRATION.md](./UPSTASH_MIGRATION.md)
- **Upstash Docs**: https://docs.upstash.com/redis
- **Upstash Support**: https://upstash.com/discord

---

**Status**: Ready to use  
**Date**: October 15, 2025  
**Effort**: ~5 minutes setup
