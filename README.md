# URL Shortener | sho.rt

A lightweight, account-free URL shortener built on **Next.js + Vercel KV** with digital fingerprint recognition, editable destinations, QR codes, and an optional Rust + sled CLI companion.

## Features

- ✨ **No Accounts Required** — Recognized via stable browser fingerprint
- 🔗 **Real Shareable Links** — Works for anyone, anywhere
- ✏️ **Editable Destinations** — Update target URLs without breaking QR codes
- 📲 **QR Codes** — First-class support with download functionality
- 📊 **Basic Analytics** — Click tracking and timestamp history
- 🔐 **Optional PIN Protection** — Extra security layer for sensitive links
- 🦀 **Rust CLI Companion** — Local cache and terminal workflows (optional)
- 🌐 **Privacy-Friendly** — No email, passwords, or trackers

## Architecture

### Hosted (Primary)
- **Next.js 15+** with App Router
- **Vercel KV** for all data storage
- **Edge-compatible** redirects for low latency
- **Client-side fingerprinting** for ownership verification

### Local Optional
- **Rust CLI** using sled database
- Local cache/history for offline use
- Can sync with hosted API

## Setup

### Web Application

1. Clone and navigate to the web directory:
```bash
cd web
npm install
```

2. Set up Vercel KV:
   - Create a [Vercel project](https://vercel.com)
   - Add KV database from the Vercel console
   - Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN` to `.env.local`

3. Create `.env.local`:
```bash
cp .env.example .env.local
```

4. Development server:
```bash
npm run dev
```

Visit `http://localhost:3000`

5. Deploy to Vercel:
```bash
vercel
```

### Rust CLI (Optional)

```bash
cargo build --release
./target/release/short_url --help
```

#### Local Storage
```bash
# Create a local link
./target/release/short_url shorten "https://example.com" --local

# List local links
./target/release/short_url list --local

# Update local link
./target/release/short_url update ABC123 "https://newurl.com" --local
```

#### Remote API
```bash
# Create a link on sho.rt
./target/release/short_url shorten "https://example.com" --api https://sho.rt

# Update via API
./target/release/short_url update ABC123 "https://newurl.com" --api https://sho.rt
```

## API Endpoints

### POST `/api/shorten`
Create a new short link.

**Request:**
```json
{
  "url": "https://example.com/very/long/url",
  "customCode": "PROMO",
  "fingerprint": "user_fingerprint_hash",
  "pin": "1234"
}
```

**Response:**
```json
{
  "shortCode": "PROMO",
  "shortUrl": "https://sho.rt/PROMO",
  "qrUrl": "https://sho.rt/api/qr?code=PROMO"
}
```

### GET `/[code]`
Redirect to the destination URL (increments click counter).

**Response:** 301 Redirect to destination

### PATCH `/api/links/[code]`
Update the destination URL.

**Request:**
```json
{
  "url": "https://new-destination.com",
  "fingerprint": "user_fingerprint_hash",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/links/[code]`
Get link metadata (clicks, creation date, etc.).

**Response:**
```json
{
  "code": "PROMO",
  "url": "https://destination.com",
  "clicks": 42,
  "created": 1722787200,
  "updated": 1722787300,
  "last": 1722787400
}
```

### GET `/api/my-links`
List all links created by the current user (via fingerprint).

**Headers:**
```
x-fingerprint: user_fingerprint_hash
```

**Response:**
```json
{
  "links": [
    {
      "code": "PROMO",
      "url": "https://destination.com",
      "clicks": 42,
      "created": 1722787200,
      "updated": 1722787300,
      "last": 1722787400
    }
  ]
}
```

### GET `/api/qr?code=PROMO`
Get QR code as data URI.

**Response:**
```json
{
  "qrImage": "data:image/png;base64,..."
}
```

## Data Model (Vercel KV)

```
url:{shortCode}       → destination URL
clicks:{shortCode}    → click counter (integer)
created:{shortCode}   → Unix timestamp
updated:{shortCode}   → last update timestamp
last:{shortCode}      → last click timestamp
owner:{shortCode}     → fingerprint hash
pin:{shortCode}       → optional PIN hash
user:{fingerprint}    → set of codes owned by fingerprint
```

## Security & Privacy

### Cryptographic Identity System

The application uses a **cryptographically secure, account-free identity system** that provides strong security without requiring login:

#### How It Works

1. **256-bit Seed Generation** — On first visit, a cryptographically secure 256-bit random seed is generated using `crypto.getRandomValues()`

2. **ECDSA Key Pair** — A P-256 ECDSA key pair is generated using WebCrypto:
   - Private key stored securely in IndexedDB (not extractable)
   - Public key stored in localStorage for verification

3. **Device Fingerprinting** — Browser/device characteristics are collected:
   - User agent, language, timezone
   - Screen dimensions, color depth, pixel ratio
   - Canvas rendering fingerprint
   - WebGL renderer information
   - Hardware concurrency, device memory, touch points

4. **Identity Derivation** — `Identity = SHA256(seed + deviceFingerprint + publicKey)`
   - Combines randomness, device binding, and cryptographic identity
   - Produces a stable 32-character hex identifier

5. **Challenge-Response Signing** — For sensitive operations, challenges can be signed with the private key and verified using the public key

#### Security Properties

| Property | Description |
|----------|-------------|
| **Uniqueness** | 256-bit random seed + ECDSA key ensures cryptographic uniqueness |
| **Stability** | Same identity persists across sessions on the same browser |
| **Device Binding** | Fingerprint components tie identity to specific device |
| **Verifiability** | ECDSA signatures provide cryptographic proof of identity |
| **Privacy** | No personal data collected; no cross-device tracking |
| **No Server Secrets** | All cryptographic operations happen client-side |

#### What This Means

✅ **Secure without login** — Your identity is cryptographically unique and cannot be guessed or brute-forced

✅ **No account needed** — No email, password, or personal information required

✅ **Device-bound** — Your links are tied to your browser/device combination

✅ **Tamper-evident** — Any attempt to forge an identity would require the private key

⚠️ **Device-specific** — Clearing browser data or using a different device creates a new identity

### PIN Protection
- Optional additional layer for sensitive links
- Required to update link destination if set
- Provides extra security even if device is compromised
- Recommended for important/shared links

### Best Practices

1. **Set a PIN** on important links for added security
2. **Don't clear browser data** if you want to keep access to your links
3. **Use the same browser** to manage your links
4. **Export/backup** link codes if you need them across devices

### Ownership Verification
- All `create`, `update`, `delete`, and `list` operations require matching identity
- Server validates identity on every request
- No cross-user access possible
- Identity is cryptographically bound to the creating device

## Frontend Architecture

### Components
- **ShortenForm** — Input, submission, result display
- **QRCodeDisplay** — QR rendering with download
- **MyLinks** — User's link history and management
- **EditLinkModal** — Edit destination UI

### Client Utilities
- **fingerprint.ts** — Browser fingerprint generation and storage
- **base62.ts** — Short code generation and validation
- **kv.ts** — Vercel KV operations wrapper

## Development

### Technologies
- **React 19** with TypeScript
- **Next.js 15** App Router
- **Vercel KV** for persistence
- **qrcode** for QR generation
- **SHA-256** for fingerprinting

### Project Structure
```
web/
├── app/
│   ├── page.tsx          # Home page
│   ├── [code]/           # Redirect handler
│   ├── api/
│   │   ├── shorten/      # Create link
│   │   ├── links/        # Get/update link
│   │   ├── my-links/     # List user's links
│   │   └── qr/           # QR generation
│   ├── globals.css       # Styles
│   └── layout.tsx        # Root layout
├── components/
│   ├── ShortenForm.tsx
│   ├── QRCodeDisplay.tsx
│   ├── MyLinks.tsx
│   └── EditLinkModal.tsx
├── lib/
│   ├── fingerprint.ts    # Client fingerprinting
│   ├── base62.ts         # Code generation
│   └── kv.ts             # KV operations
└── package.json

src/
└── main.rs              # Rust CLI
```

## Deployment

### Vercel
1. Push code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Set environment variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`)
4. Deploy

### Custom Domain
Set `BASE_URL` environment variable to your custom domain (e.g., `https://s.example.com`)

## Future Enhancements

- [ ] Bulk import/export
- [ ] Link expiration
- [ ] Advanced analytics dashboard
- [ ] Branded short domains
- [ ] API key management
- [ ] Rate limiting per fingerprint
- [ ] Link deletion
- [ ] Custom QR styling

## License

MIT