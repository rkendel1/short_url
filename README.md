sho.rt

Short links you can manage without an account.

Create a short link, share it anywhere, and update its destination later — without an email address, password, or traditional account.

sho.rt keeps link ownership in your browser using a browser-local cryptographic identity. Your private key stays on your device, while the server stores only the information needed to verify that you control your links.

No signup. No email. No password.

Why sho.rt?

Most URL shorteners make you create an account before you can manage a link. sho.rt removes that step.

Create a link in seconds, return from the same browser, and edit its destination whenever you need to.

* Account-free — no registration or login
* Editable links — update destinations without changing the short URL
* Persistent QR codes — print or share once, then update the destination later
* Browser-local ownership — your cryptographic identity remains in your browser
* Privacy-conscious — no advertising profiles or cross-site tracking
* Simple analytics — see aggregate link activity without building visitor profiles
* Optional PIN protection — add an extra secret for sensitive link changes
* Rust CLI — create and manage links from the terminal

Create a link in seconds

1. Visit 0-2.ca
2. Paste a destination URL
3. Select Create Short Link
4. Copy the short URL or download the QR code
5. Return later from the same browser to manage the link

Your link. Your browser. No account.

sho.rt creates a browser-local cryptographic identity the first time you use the service.

The browser generates:

* A cryptographically secure random seed
* A P-256 ECDSA key pair
* A non-extractable private key stored locally in browser storage

The private key does not leave your browser. When ownership needs to be verified, the browser can sign a challenge and the server verifies the signature using the associated public key.

This provides account-free link ownership without requiring an email address or password.

Important device notes

Your link identity is local to the browser where it was created.

* A different browser creates a different identity
* A different device creates a different identity
* Clearing browser storage may remove access to existing links
* Keep a record of important short codes and use a PIN for additional protection where appropriate

Built for links that may need to change

A short URL and QR code can stay the same while the destination changes.

That makes sho.rt useful for:

* Printed flyers and posters
* Restaurant menus
* Business cards
* Event signage
* Product packaging
* Marketing campaigns
* Temporary landing pages
* Documentation and shared resources

Print the QR code once. Update the destination whenever you need to.

Privacy

sho.rt is designed to minimize identity collection.

* No email address required
* No password required
* No advertising profile
* No cross-site tracking
* No third-party analytics required for core functionality

Link analytics are limited to operational information such as aggregate click counts and link activity timestamps. sho.rt is not designed to identify or profile people who open links.

Technology

* Next.js
* PostgreSQL
* Prisma
* Web Crypto API
* P-256 ECDSA browser identities
* QR code generation
* Optional Rust CLI

License

MIT
