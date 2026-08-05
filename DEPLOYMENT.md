# Deployment Guide

## Architecture

The app uses a dual-database architecture for optimal UX and reliability:

1. **Backend Storage (Vercel KV/Upstash Redis)** - Persistent storage for redirects
   - Source of truth for all links
   - Handles redirect requests
   - Survives Vercel redeployments
   - Synced from browser cache

2. **Browser Cache (IndexedDB)** - Local cache for UX
   - Recognized by fingerprint
   - Shows user's links instantly
   - Changes synced to backend
   - Works offline

## Quick Start (Vercel)

### 1. Create Vercel Project
```bash
cd web
npm install -g vercel
vercel login
vercel
```

### 2. Add Vercel KV Integration
In Vercel Dashboard:
1. Go to Storage → KV
2. Create a new KV database
3. Add to your project
4. Environment variables are auto-populated:
   - `KV_REST_API_URL` - REST API endpoint
   - `KV_REST_API_TOKEN` - Authentication token

These are automatically available to your app.

### 3. Custom Domain
Settings → Domains → Add domain

Set your custom domain and update `BASE_URL` in environment variables:
```
BASE_URL=https://yourdomain.com
```

### 4. Deploy Updates
```bash
cd web
git push  # Vercel auto-deploys on push
# OR
vercel --prod
```

## Manual Deployment

### Node.js + Vercel KV

1. Build:
```bash
cd web
npm install
npm run build
```

2. Start:
```bash
npm start
```

### Environment Variables

**Required (Vercel KV/Redis Backend):**
These are auto-populated when you add KV to your Vercel project:
```bash
KV_REST_API_URL=https://...  # Vercel KV REST endpoint
KV_REST_API_TOKEN=...        # Vercel KV authentication token
```

**Application Configuration:**
```bash
BASE_URL=https://sho.rt # Your custom domain (optional)
NODE_ENV=production
```

**Note:** Vercel KV (powered by Upstash Redis) provides persistent, serverless Redis storage. Perfect for Vercel deployments. All data persists through redeployments, so links never break.

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY web .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t short-url .
docker run -p 3000:3000 short-url
```

## Monitoring

### Vercel Analytics
- [Vercel Dashboard](https://vercel.com) → Analytics
- View function invocations, edge cache hit rates

### Logs
```bash
vercel logs
```

### Error Tracking
Add to `next.config.js` for Sentry integration:
```js
const withSentry = require('@sentry/nextjs');
module.exports = withSentry({
  // next config
});
```

## Database

### Data Model (PGlite)

```sql
-- Links table
CREATE TABLE links (
  code VARCHAR(20) PRIMARY KEY,
  url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER,
  last INTEGER,
  owner VARCHAR(32) NOT NULL
);

-- User links association
CREATE TABLE user_links (
  fingerprint VARCHAR(32) NOT NULL,
  code VARCHAR(20) NOT NULL,
  PRIMARY KEY (fingerprint, code),
  FOREIGN KEY (code) REFERENCES links(code) ON DELETE CASCADE
);
```

**Key Structure:**
- `url:{shortCode}` → destination URL
- `clicks:{shortCode}` → click counter
- `created:{shortCode}` → Unix timestamp (creation)
- `updated:{shortCode}` → Unix timestamp (last destination change)
- `last:{shortCode}` → Unix timestamp (last click)
- `owner:{shortCode}` → fingerprint hash
- `user:{fingerprint}` → set of short codes belonging to this fingerprint

## Scaling

PGlite is suitable for small to medium traffic. For very high traffic:
- Migrate to PostgreSQL with connection pooling
- Implement caching headers for redirects
- Rate limit by fingerprint if needed

## Cost

- Vercel Edge Functions: Free tier included
- Database: No cost (PGlite is embedded)
- Custom domain: $12/month (Vercel)

## Troubleshooting

### 503 Errors
- Check application logs: `vercel logs`
- Ensure Node.js environment is configured correctly

### Redirects Not Working
- Verify `code` exists in database
- Check if code is case-sensitive
- Test via `/api/links/CODE` to debug

### QR Codes Not Generating
- Verify `qrcode` package installed
- Check browser console for errors
- Test in incognito mode

### Database Issues
- PGlite stores data in application memory
- Data persists within a single Vercel deployment
- For persistent data across deployments, migrate to external PostgreSQL

## Security Checklist

- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set custom domain for branding
- [ ] Review environment variables (no secrets in code)
- [ ] Enable rate limiting if needed
- [ ] Test PIN protection on sensitive links
- [ ] Monitor logs for suspicious activity

## Support

For issues:
1. Check Vercel status page
2. Review error logs: `vercel logs`
3. Test endpoints manually: `curl https://sho.rt/api/links/test`
4. Open issue on GitHub
