# Quick Start Guide

Get sho.rt running in 5 minutes.

## For Web Development

### Local Testing
```bash
cd web
npm install

# Copy and fill in Vercel KV credentials
cp .env.example .env.local
# Edit .env.local with your KV credentials

npm run dev
# Open http://localhost:3000
```

### Create a Test Link
1. Paste a URL
2. Click "Create Short Link"
3. See your short URL and QR code
4. Check "My Links" for history

### Update a Link
1. Click "✏️ Edit" on any link
2. Enter new destination
3. Click "Update Destination"
4. QR code remains valid!

## For Rust CLI

### Build
```bash
cargo build --release
```

### Local Usage
```bash
# Shorten a URL locally
./target/release/short_url shorten "https://example.com/article" --local

# See output:
# Short URL: .short_url/abc123
# Stored locally in .short_url database

# List all local links
./target/release/short_url list --local

# Update a link
./target/release/short_url update abc123 "https://new-url.com" --local
```

### Remote Usage (with hosted sho.rt)
```bash
# Create on server
./target/release/short_url shorten "https://example.com" --api https://sho.rt

# Update on server
./target/release/short_url update PROMO "https://new-dest.com" --api https://sho.rt
```

## Deploy to Vercel (5 minutes)

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import from GitHub
   - Select the `web` directory

3. **Add KV Database**
   - In Vercel dashboard, go to Storage
   - Create KV Database
   - Connect to your project
   - Environment variables auto-populate

4. **Deploy**
   - Click Deploy
   - Wait 2-3 minutes

5. **Your sho.rt is Live!**
   - Visit the Vercel-provided URL
   - (Optional) Add custom domain in Settings

## Common Tasks

### Get Your Fingerprint
The fingerprint is generated automatically when you first visit. It's stored in browser localStorage under the key `fp`.

### Test the API
```bash
# Create a link
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fingerprint": "test-fp-123",
    "customCode": "TEST"
  }'

# Redirect
curl -L http://localhost:3000/TEST

# List my links
curl -H "x-fingerprint: test-fp-123" \
  http://localhost:3000/api/my-links
```

### With PIN Protection
```bash
# Create with PIN
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fingerprint": "user-fp",
    "customCode": "SECURE",
    "pin": "1234"
  }'

# Update requires PIN
curl -X PATCH http://localhost:3000/api/links/SECURE \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://new-url.com",
    "fingerprint": "user-fp",
    "pin": "1234"
  }'
```

## Troubleshooting

**Fingerprint not persisting?**
- Check localStorage is enabled
- Clear browser data and reload

**Can't update a link?**
- Verify you're on the same browser
- Check if PIN is set and provide it
- Verify fingerprint matches

**KV connection error?**
- Verify credentials in .env.local
- Check Vercel dashboard for KV status
- Restart dev server

**Rust CLI won't compile?**
- Install latest Rust: `rustup update`
- Run `cargo clean && cargo build`

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Explore the [API endpoints](README.md#api-endpoints)
- Customize styling in [web/app/globals.css](web/app/globals.css)

## Need Help?

1. Check README.md FAQ section
2. Review GitHub issues
3. Open a new issue with error details
