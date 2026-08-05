# URL Shortener | sho.rt

A lightweight, account-free URL shortener built on **Next.js + PostgreSQL** with digital fingerprint recognition, editable destinations, QR codes, and an optional Rust CLI companion.

## Features

- ✨ **No Accounts Required** — Recognized via stable browser fingerprint
- 🔗 **Real Shareable Links** — Works for anyone, anywhere
- ✏️ **Editable Destinations** — Update target URLs without breaking QR codes
- 📲 **QR Codes** — First-class support with download functionality
- 📊 **Basic Analytics** — Click tracking and timestamp history
- 🔐 **Optional PIN Protection** — Extra security layer for sensitive links
- 🦀 **Rust CLI Companion** — Terminal-based link management (optional)
- 🌐 **Privacy-Friendly** — No email, passwords, or trackers

## How to Use

### Create a Short Link

1. Visit **https://0-2.ca** (or your deployed instance)
2. Paste your long URL into the input field
3. Click **"Create Short Link"**
4. Your short URL appears instantly (e.g., `https://0-2.ca/ABC123`)
5. Share it anywhere — no account needed!

**Behind the scenes:** Your browser generates a unique digital fingerprint that identifies you without any credentials. This fingerprint is stored securely in your browser (never shared with anyone unless you choose to set a PIN).

### Get a QR Code

Each short link automatically generates a scannable QR code:

1. After creating a link, a **QR code appears on screen**
2. Click **"Download QR Code"** to save it as an image
3. Share the QR code on posters, documents, or presentations
4. Anyone can scan it with their phone camera

**The QR code never expires** — even if you update the link destination, the QR code remains valid and points to the new URL.

### Edit or Update a Link

1. Open **"My Links"** section (visible once you've created links)
2. Find the link you want to edit
3. Click the **"✏️ Edit"** button
4. Enter the new destination URL
5. Click **"Update Destination"**
6. The link now redirects to the new URL

**No account login needed.** We recognize you using your browser fingerprint. As long as you're on the same browser and haven't cleared your data, you can edit your links.

### Understanding Your Digital Fingerprint Identity

Instead of passwords and email:

- **First Visit:** Your browser automatically creates a unique, stable fingerprint from:
  - Your browser type and version
  - Your device characteristics (screen size, language, etc.)
  - A cryptographic key stored securely in your browser

- **Your Identity:** This fingerprint becomes your account. It's stored in your browser's localStorage, so:
  - ✅ Only you can see/edit your links (on this browser)
  - ✅ No passwords to forget or compromise
  - ✅ No personal information needed
  - ✅ No tracking across websites

- **Your Links:** The "My Links" section shows only links you created on this browser. The server verifies your fingerprint on every request.

- **Optional PIN:** For extra security on important links, you can set a PIN. This adds a second layer of protection.

### Multi-Device & Privacy Notes

- **Same device, different browser?** → New fingerprint, new identity
- **Cleared browser data?** → New fingerprint, can't edit old links (but they still work for others)
- **Different device?** → New fingerprint, new identity
- **Solution:** Save your link codes if you need to manage them across devices

## Architecture

### Hosted (Primary)
- **Next.js 15+** with App Router
- **PostgreSQL** with Prisma ORM for data storage
- **Client-side fingerprinting** for ownership verification

### Local Optional
- **Rust CLI** for creating and managing links
- Can interact with hosted API or use local storage

## Setup

### Web Application

1. Clone and navigate to the web directory:
```bash
cd web
npm install
```

2. Set up PostgreSQL database:
   - Create a PostgreSQL database (local or hosted)
   - Get the database connection string

3. Create `.env.local`:
```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL to your PostgreSQL connection string
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

5. Development server:
```bash
npm run dev
```

Visit `http://localhost:3000`

6. Deploy to Vercel:
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

## Data Model (PostgreSQL)

```
Link Table:
- code (String, PRIMARY KEY) — Unique short code
- url (String) — Target destination URL
- clicks (Int) — Click counter
- created (Int) — Unix timestamp of creation
- updated (Int, nullable) — Unix timestamp of last update
- last (Int, nullable) — Unix timestamp of last click
- owner (String) — Fingerprint hash of creator
- pin (String, nullable) — Optional PIN hash for extra security

Indexes:
- owner — For querying links by fingerprint
- created — For sorting and filtering by date
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
- **storage.ts** — Prisma database operations

## Development

### Technologies
- **React 19** with TypeScript
- **Next.js 15** App Router
- **PostgreSQL** with Prisma ORM for persistence
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
│   └── storage.ts        # Prisma database operations
└── package.json

src/
└── main.rs              # Rust CLI
```

## Deployment

### Vercel
1. Push code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Set environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
4. Deploy

### Other Platforms
Deploy to any Node.js-compatible platform with PostgreSQL support:
- Railway, Render, Heroku, DigitalOcean App Platform, etc.
- Ensure `DATABASE_URL` environment variable is set

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