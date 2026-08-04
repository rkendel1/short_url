# Deployment Guide

## Quick Start (Vercel)

The easiest way to deploy sho.rt is on Vercel, which handles KV database provisioning.

### 1. Create Vercel Project
```bash
cd web
npm install -g vercel
vercel login
vercel
```

### 2. Set Up KV Database
In Vercel Dashboard:
1. Go to Storage → KV Database
2. Create a new database
3. Add to your project
4. Environment variables are auto-populated:
   - `KV_REST_API_URL` - The REST API endpoint for the KV database
   - `KV_REST_API_TOKEN` - Authentication token for the KV REST API
   - `REDIS_URL` - Direct Redis protocol connection string
   - `KV_URL` - Alternative KV database URL

### 3. Custom Domain
Settings → Domains → Add domain

Set your custom domain and update `BASE_URL` in environment:
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

### Node.js + Redis/KV Compatible Database

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

Ensure `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set.

### Environment Variables

**Required (for KV/Redis):**
```bash
# Primary KV REST API (used by @vercel/kv library)
KV_REST_API_URL=https://... # Auto-populated by Vercel
KV_REST_API_TOKEN=... # Auto-populated by Vercel
```

**Optional (auto-populated by Vercel when Redis is integrated):**
```bash
REDIS_URL=... # Direct Redis protocol URL
KV_URL=... # Alternative KV database URL
```

**Application Configuration:**
```bash
BASE_URL=https://sho.rt # Your custom domain
NODE_ENV=production
```

**Note:** When deploying on Vercel with KV database integration, Vercel automatically populates `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The `@vercel/kv` library uses these variables to connect to your Redis database.

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
docker run -e KV_REST_API_URL -e KV_REST_API_TOKEN -p 3000:3000 short-url
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

## Database Maintenance

### Viewing Data (Vercel KV)
Vercel CLI:
```bash
vercel kv ls  # List all keys
vercel kv get url:PROMO  # Get specific key
```

### Backup
KV data is automatically backed up by Vercel. For manual export:
```bash
# Via Vercel dashboard Export feature (if available)
# Or write a migration script
```

## Scaling

Vercel KV automatically scales. For very high traffic:
- Consider Redis Pro tier
- Implement caching headers for redirects
- Rate limit by fingerprint if needed

## Cost

- Vercel Edge Functions: Free tier included
- KV Database: Pricing based on read/write operations
- Custom domain: $12/month (Vercel)

## Troubleshooting

### 503 Errors
- Check KV database status in Vercel dashboard
- Verify environment variables are set
- Check Vercel logs: `vercel logs`

### Redirects Not Working
- Verify `url:{code}` exists in KV
- Check if code is case-sensitive
- Test via `/api/links/CODE` to debug

### QR Codes Not Generating
- Verify `qrcode` package installed
- Check browser console for errors
- Test in incognito mode

## Security Checklist

- [ ] Set strong KV token (rotate if exposed)
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set custom domain for branding
- [ ] Review environment variables (no secrets in code)
- [ ] Enable rate limiting if needed
- [ ] Test PIN protection on sensitive links
- [ ] Monitor logs for suspicious activity

## Support

For issues:
1. Check Vercel status page
2. Review error logs
3. Test endpoints manually: `curl https://sho.rt/api/links/test`
4. Open issue on GitHub
