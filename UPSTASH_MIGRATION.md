# Migration Guide: Switching to Upstash Redis

## Overview

This guide helps you migrate from Vercel KV to Upstash Redis, which offers a more generous free tier (10,000 commands/day vs 3,000 commands/day).

## Step 1: Create Upstash Account

1. Go to [upstash.com](https://upstash.com)
2. Sign up for a free account
3. Click "Create Database"
4. Choose:
   - **Name**: telegram-bot-storage (or any name you prefer)
   - **Type**: Regional
   - **Region**: Choose closest to your Vercel deployment (e.g., eu-west-1 for Europe)
   - **TLS**: Enabled (recommended)

## Step 2: Get Credentials

After creating the database:

1. Go to your database dashboard
2. Scroll to **REST API** section
3. Copy these values:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Step 3: Update Local Environment

Update your `.env` file:

```env
# Add Upstash credentials
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Optional: Keep old Vercel KV as fallback during migration
# KV_REST_API_URL=your_old_kv_url
# KV_REST_API_TOKEN=your_old_kv_token
```

## Step 4: Install Dependencies

The `@upstash/redis` package is already in your `package.json`. Just install it:

```powershell
npm install
```

## Step 5: Update Vercel Environment Variables

### Option A: Via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add new variables:
   - `UPSTASH_REDIS_REST_URL` = your URL
   - `UPSTASH_REDIS_REST_TOKEN` = your token
5. Apply to: **Production**, **Preview**, and **Development**
6. Click **Save**

### Option B: Via Vercel CLI

```powershell
vercel env add UPSTASH_REDIS_REST_URL
# Paste your URL when prompted

vercel env add UPSTASH_REDIS_REST_TOKEN
# Paste your token when prompted
```

## Step 6: Test Locally

Test the connection locally:

```powershell
npm run dev
```

Check the console output. You should see:
```
✅ Upstash Redis verbunden (REST API)
```

Test the status endpoint:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | Select-Object -ExpandProperty Content
```

## Step 7: Deploy to Vercel

```powershell
npm run deploy
```

Or if using Git integration, just push to your repository:
```powershell
git add .
git commit -m "Switch to Upstash Redis"
git push
```

## Step 8: Verify Production

After deployment, check your production endpoint:

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/status" | ConvertFrom-Json
```

Look in the Vercel deployment logs for:
```
✅ Upstash Redis verbunden (REST API)
```

## Step 9: Migrate Existing Data (Optional)

If you have existing data in Vercel KV that you want to migrate, run the migration script:

```powershell
# Make sure both old and new credentials are in .env
npm run tsx scripts/migrate-to-upstash.ts
```

See [scripts/migrate-to-upstash.ts](../scripts/migrate-to-upstash.ts) for details.

## Step 10: Clean Up (After Successful Migration)

Once everything is working with Upstash:

1. Remove old Vercel KV environment variables from Vercel dashboard
2. Optionally delete Vercel KV database to avoid charges
3. Remove old `KV_*` variables from `.env`

## Troubleshooting

### Connection Error

**Problem**: `❌ Upstash Redis-Verbindung fehlgeschlagen`

**Solutions**:
- Verify URL and token are correct
- Check if URL starts with `https://`
- Make sure there are no extra spaces in the values
- Test connection from Upstash dashboard

### "WRONGPASS invalid username-password pair"

**Problem**: Authentication failed

**Solution**:
- Double-check `UPSTASH_REDIS_REST_TOKEN`
- Regenerate token in Upstash dashboard if needed

### Fallback to In-Memory Store

**Problem**: Seeing `⚠️ Nutze In-Memory Store`

**Solutions**:
- Check that environment variables are set correctly
- Verify `@upstash/redis` is installed: `npm list @upstash/redis`
- Check Vercel deployment logs for errors

### Migration Script Fails

**Problem**: Migration script errors

**Solutions**:
- Make sure both old KV and new Upstash credentials are in `.env`
- Check network connection
- Run with verbose logging to see which keys fail

## Benefits of Upstash

✅ **10,000 commands/day free** (vs 3,000 for Vercel KV)  
✅ **Global replication** available  
✅ **REST API** - no connection pooling needed  
✅ **Serverless-optimized** - perfect for Vercel  
✅ **Easy to scale** - upgrade when needed  
✅ **99.99% uptime SLA** on paid plans

## Pricing Comparison

| Provider | Free Tier | Commands/Day | Storage |
|----------|-----------|--------------|---------|
| Vercel KV | Yes | 3,000 | 256 MB |
| **Upstash** | **Yes** | **10,000** | **256 MB** |
| Upstash Pro | $10/mo | 100,000 | 1 GB |

## Support

- Upstash Documentation: https://docs.upstash.com/redis
- Upstash Discord: https://upstash.com/discord
- GitHub Issues: https://github.com/upstash/upstash-redis

---

**Created**: October 15, 2025  
**Last Updated**: October 15, 2025
