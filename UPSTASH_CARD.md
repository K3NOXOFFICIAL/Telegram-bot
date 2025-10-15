# ⚡ Upstash Setup - 2 Minute Card

## 🎯 Goal
Switch from Vercel KV (3K commands/day) to Upstash Redis (10K commands/day)

## 📋 Steps

### 1️⃣ Create Account (1 min)
```
→ https://upstash.com
→ Sign up (free)
→ "Create Database"
→ Regional, closest region
```

### 2️⃣ Get Credentials (30 sec)
```
Dashboard → REST API section
Copy:
  • UPSTASH_REDIS_REST_URL
  • UPSTASH_REDIS_REST_TOKEN
```

### 3️⃣ Add to .env (30 sec)
```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxx
```

### 4️⃣ Add to Vercel (1 min)
```powershell
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### 5️⃣ Test (30 sec)
```powershell
npm run dev
```
Look for: `✅ Upstash Redis verbunden`

### 6️⃣ Deploy (1 min)
```powershell
npm run deploy
```

## ✅ Done!

**Total Time**: ~5 minutes  
**Benefit**: 3.3x more free storage  
**Risk**: None (auto-fallback)

## 📖 Full Docs
- Quick: `UPSTASH_QUICKSTART.md`
- Complete: `UPSTASH_MIGRATION.md`
- Summary: `UPSTASH_COMPLETE.md`

---

**PowerShell Commands Only** | **No Git Required** | **Already Configured**
