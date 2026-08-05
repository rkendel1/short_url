

---

sho.rt — Privacy‑First, Account‑Free URL Shortener

A lightweight, secure, and frictionless URL shortener built on Next.js + PostgreSQL, powered by a cryptographically stable browser identity instead of accounts. Create, edit, and manage links instantly — no email, no passwords, no tracking.

---

Why sho.rt Exists

Most URL shorteners require accounts, track users, or lock link management behind login walls. sho.rt takes a different approach:

Bring link management to your browser — without sending your identity to anyone.

• No accounts
• No personal data
• No tracking
• No friction


Your browser becomes your identity, securely and privately.

---

✨ Features

• Account‑Free Identity — Managed entirely through a stable cryptographic browser fingerprint

• Editable Destinations — Update link targets anytime without breaking QR codes

• Real Shareable Links — Works for anyone, anywhere

• Built‑In QR Codes — Auto‑generated, downloadable, and always up‑to‑date

• Basic Analytics — Click counts and timestamp history

• Optional PIN Protection — Add a second layer of security for sensitive links

• Rust CLI Companion — Create and manage links from your terminal

• Privacy‑Friendly — No emails, passwords, or trackers


---

🚀 Try It in 10 Seconds

1. Visit https://0-2.ca
2. Paste a long URL
3. Click Create Short Link
4. Get a short URL + QR code instantly
5. Edit it anytime — no login required


---

🔍 How It Works (Short Version)

sho.rt uses a cryptographically stable identity generated directly in your browser:

• A 256‑bit random seed
• A P‑256 ECDSA key pair (private key stored non‑extractably in IndexedDB)
• Device/browser fingerprint characteristics
• Combined into a single SHA‑256 identity hash


This identity is verified on every request, allowing secure link ownership without accounts.

For the full technical spec:
Identity System Details

---

📸 Screenshots

shorteners require accounts, track users, or lock link management behind login walls. sho.rt takes a different approach:

Bring link management to your browser — without sending your identity to anyone.

• No accounts
• No personal data
• No tracking
• No friction


Your browser becomes your identity, securely and privately.

---

✨ Features

• Account‑Free Identity — Managed entirely through a stable cryptographic browser fingerprint
• Editable Destinations — Update link targets anytime without breaking QR codes
• Real Shareable Links — Works for anyone, anywhere
• Built‑In QR Codes — Auto‑generated, downloadable, and always up‑to‑date
• Basic Analytics — Click counts and timestamp history
• Optional PIN Protection — Add a second layer of security for sensitive links
• Rust CLI Companion — Create and manage links from your terminal
• Privacy‑Friendly — No emails, passwords, or trackers


---

🚀 Try It in 10 Seconds

1. Visit https://0-2.ca
2. Paste a long URL
3. Click Create Short Link
4. Get a short URL + QR code instantly
5. Edit it anytime — no login required


---

🔍 How It Works (Short Version)

sho.rt uses a cryptographically stable identity generated directly in your browser:

• A 256‑bit random seed
• A P‑256 ECDSA key pair (private key stored non‑extractably in IndexedDB)
• Device/browser fingerprint characteristics
• Combined into a single SHA‑256 identity hash


This identity is verified on every request, allowing secure link ownership without accounts.

For the full technical spec:
Identity System Details

---

📸 Screenshots

---

🧩 Architecture Overview

sho.rt consists of a simple, modern, and scalable architecture:

• Next.js 15+ (App Router)
• PostgreSQL + Prisma
• Client‑side fingerprint identity
• Optional Rust CLI
• QR generation via qrcode


---

🛠️ Web Application Setup

git clone https://github.com/rkendel1/short_url
cd web
npm install
cp .env.example .env.local
# Set DATABASE_URL in .env.local
npm run prisma:migrate
npm run dev


Visit: http://localhost:3000

Deploy to Vercel

vercel


Set environment variables:

• DATABASE_URL
• BASE_URL (optional custom domain)


---

🦀 Rust CLI (Optional)

Build:

cargo build --release
./target/release/short_url --help


Local Storage Mode

./target/release/short_url shorten "https://example.com" --local
./target/release/short_url list --local
./target/release/short_url update ABC123 "https://newurl.com" --local


Remote API Mode

./target/release/short_url shorten "https://example.com" --api https://sho.rt
./target/release/short_url update ABC123 "https://newurl.com" --api https://sho.rt


---

📡 API Endpoints

POST `/api/shorten` — Create a short link

{
  "url": "https://example.com/very/long/url",
  "customCode": "PROMO",
  "fingerprint": "user_fingerprint_hash",
  "pin": "1234"
}


GET `/[code]` — Redirect

301 redirect to destination.

PATCH `/api/links/[code]` — Update destination

{
  "url": "https://new-destination.com",
  "fingerprint": "user_fingerprint_hash",
  "pin": "1234"
}


GET `/api/links/[code]` — Metadata

{
  "code": "PROMO",
  "url": "https://destination.com",
  "clicks": 42,
  "created": 1722787200,
  "updated": 1722787300,
  "last": 1722787400
}


GET `/api/my-links` — List user’s links

Header:

x-fingerprint: user_fingerprint_hash


GET `/api/qr?code=PROMO` — QR code

{
  "qrImage": "data:image/png;base64,..."
}


---

🗄️ Data Model (PostgreSQL)

Link Table:
- code (String, PRIMARY KEY)
- url (String)
- clicks (Int)
- created (Int)
- updated (Int, nullable)
- last (Int, nullable)
- owner (String) — fingerprint hash
- pin (String, nullable)


Indexes:

• owner
• created


---

🔐 Security & Privacy

sho.rt uses a cryptographically secure, account‑free identity system:

• 256‑bit seed
• P‑256 ECDSA key pair
• Device/browser fingerprint
• SHA‑256 identity derivation
• Optional challenge‑response signing


Security Properties

Property	Description	
Uniqueness	Random seed + key pair ensures uniqueness	
Stability	Identity persists across sessions	
Device Binding	Fingerprint ties identity to device	
Verifiability	ECDSA signatures prove identity	
Privacy	No personal data, no cross‑site tracking	
No Server Secrets	All crypto happens client‑side	


PIN Protection

• Optional
• Required for sensitive updates
• Adds second factor
• Recommended for shared links


---

📱 Multi‑Device Notes

• Same device, different browser → new identity
• Clearing browser data → new identity
• Different device → new identity
• Save link codes if you need cross‑device management


---

🧱 Frontend Architecture

• ShortenForm — Create links
• QRCodeDisplay — Render + download QR
• MyLinks — Link history
• EditLinkModal — Update destinations


Utilities:

• fingerprint.ts
• base62.ts
• storage.ts


---

📈 Future Enhancements

• Bulk import/export
• Link expiration
• Advanced analytics dashboard
• Branded short domains
• API key management
• Rate limiting per fingerprint
• Link deletion
• Custom QR styling


---

📄 License

MIT
