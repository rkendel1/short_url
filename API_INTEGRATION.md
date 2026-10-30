# Short URL API integration

This document describes the API implemented by this repository. Set the service
origin in your application rather than hard-coding it:

```text
SHORT_URL_BASE_URL=https://0-2.ca
```

All JSON requests should include `Content-Type: application/json`. Every
response carries `Cache-Control: no-store`.

## Authentication and ownership

A link is owned by an **owner identifier** (16–128 characters of
`[A-Za-z0-9_-]`) and every mutation — create, update and delete — must be
**signed** by the P-256 key bound to that owner.

1. Generate an owner identifier and an ECDSA P-256 key pair once, and keep the
   private key secret.
2. Sign each mutation as described below. The first signed request for an
   owner binds its public key to that owner. From then on, only requests signed
   by that key are accepted for the owner; any other key gets `403`.

| Operation | Authentication |
| --- | --- |
| Create | Signed request |
| Update | Signed request, plus `pin` if the link has one |
| Delete | Signed request, plus `pin` if the link has one |
| List owned links | `X-Fingerprint: <owner identifier>` header (read-only) |
| Get metadata / follow short URL | Public |

### Signing a request

Send these headers:

| Header | Value |
| --- | --- |
| `X-Owner` | Owner identifier |
| `X-Owner-Key` | Public key, DER-encoded SubjectPublicKeyInfo, hex |
| `X-Owner-Timestamp` | Current time in Unix **milliseconds**; must be within 5 minutes of the server clock |
| `X-Owner-Signature` | ECDSA P-256 / SHA-256 signature, raw `r‖s` (64 bytes), hex |

The signed message is these five lines joined by `\n`:

```text
short-url-auth-v1
<HTTP method, upper case>
<request path, e.g. /api/links/article123>
<X-Owner-Timestamp value>
<hex SHA-256 of the exact request body bytes>
```

Node.js example:

```ts
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';

// One-time setup:
//   const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
//   privateKey.export({ format: 'pem', type: 'pkcs8' })  -> SHORT_URL_PRIVATE_KEY
//   randomBytes(16).toString('hex')                      -> SHORT_URL_OWNER
const privateKey = createPrivateKey(process.env.SHORT_URL_PRIVATE_KEY!);
const publicKeyHex = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('hex');

export async function signedFetch(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: object) {
  const raw = JSON.stringify(body);
  const timestamp = String(Date.now());
  const bodyHash = createHash('sha256').update(raw).digest('hex');
  const message = ['short-url-auth-v1', method, path, timestamp, bodyHash].join('\n');
  const signature = sign('sha256', Buffer.from(message), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return fetch(`${process.env.SHORT_URL_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Owner': process.env.SHORT_URL_OWNER!,
      'X-Owner-Key': publicKeyHex,
      'X-Owner-Timestamp': timestamp,
      'X-Owner-Signature': signature.toString('hex'),
    },
    body: raw,
  });
}
```

Browsers sign with WebCrypto (`crypto.subtle.sign({ name: 'ECDSA', hash:
'SHA-256' }, ...)` produces the raw `r‖s` format directly); see
`web/lib/signed-fetch.ts`. The CLI signs with the `p256` crate; see `src/main.rs`.

**Migrating an existing integration:** if you used a `fingerprint` value before
signed requests, use that same value as `X-Owner` and sign with a new key. The
first signed request binds the key to your existing links. Until you do, anyone
who knows your old fingerprint could bind their key first, so migrate promptly
and keep the fingerprint secret until then.

Unsigned requests, including the old `fingerprint`-in-body form, return `401`.

## Create a short link

```http
POST /api/shorten
(signed headers)

{
  "url": "https://example.com/articles/123",
  "customCode": "article123",
  "pin": "optional-pin"
}
```

| Field | Required | Description |
| --- | --- | --- |
| `url` | Yes | Absolute `http://` or `https://` URL with a host, no embedded `user:password@`, at most 2048 characters. |
| `customCode` | No | Case-sensitive, 1–20 ASCII letters or digits (`[0-9A-Za-z]`). If omitted, the server generates one such as `otter0427`. |
| `pin` | No | 4–128 characters. When set, it is required for every later update and delete. Stored only as a scrypt hash. |

Successful response (`200 OK`):

```json
{
  "shortCode": "article123",
  "shortUrl": "https://0-2.ca/article123",
  "qrUrl": "https://0-2.ca/api/qr?code=article123",
  "revision": 1
}
```

A code that is already taken — including one that was deleted — returns `409`.
Codes are never reused.

## Follow a short URL or read its data

Opening the short URL records a click and returns a temporary, uncacheable
redirect, so a changed destination takes effect on the next request:

```http
GET /article123

HTTP/1.1 307 Temporary Redirect
Location: https://example.com/articles/123
Cache-Control: no-store
```

A deleted code returns `410 Gone`; an unknown code returns `404`.

To read a link without following it:

```http
GET /api/links/article123
```

```json
{
  "code": "article123",
  "url": "https://example.com/articles/123",
  "clicks": 7,
  "created": 1786550400,
  "updated": 1786554000,
  "last": 1786557600,
  "revision": 3
}
```

Timestamps are Unix seconds. `updated` and `last` are omitted until applicable.
`revision` increases by one on every change and is required to make the next one.

## List links owned by the integration

```http
GET /api/my-links
X-Fingerprint: YOUR_OWNER_IDENTIFIER
```

Returns `{ "links": [...] }` with the metadata fields above plus `protected`
(whether the link has a PIN). Deleted links are not listed.

## Update a destination

```http
PATCH /api/links/article123
(signed headers)

{
  "url": "https://example.com/articles/456",
  "revision": 3,
  "pin": "optional-pin"
}
```

`revision` is the revision you last read. The update applies only if the link
is still at that revision; success is `200` with
`{ "success": true, "revision": 4 }`.

## Delete a link

```http
DELETE /api/links/article123
(signed headers)

{
  "revision": 4,
  "pin": "optional-pin"
}
```

Deletion keeps the code as a tombstone: it returns `410` from then on and can
never be created again. Success is `200` with `{ "success": true, "revision": 5 }`.

## Errors

API errors are JSON objects with an `error` string.

| Status | Meaning |
| --- | --- |
| `400` | Invalid input (destination, custom code, PIN length, revision type, body not a JSON object) |
| `401` | Missing or invalid signature, or a timestamp outside the 5-minute window |
| `403` | Signed by a different key than the owner's; not the link's owner; PIN missing or wrong; stored destination is not http(s) (redirect only) |
| `404` | Unknown code |
| `409` | Code already taken (create), or the link has moved past the `revision` you sent; the response includes `currentRevision`. Re-read and retry. |
| `410` | The link was deleted |
| `428` | `revision` missing on update or delete |
| `429` | Rate limited; wait `Retry-After` seconds. After 5 wrong PINs a link refuses PIN attempts for 15 minutes. |
| `5xx` | Transient; retry with bounded exponential backoff |

Rate limits per client IP: create 20/min, update and delete 60/min, reads
120/min, QR 60/min.

## QR codes

```http
GET /api/qr?code=article123&size=256
```

`size` is an integer from 64 to 1024 (default 256). Returns `{ "qrImage": "data:image/png;base64,..." }`.

## inline-demo storage

[inline-demo](https://github.com/rkendel1/inline-demo) keeps no database of its
own: its demos, live slots, managed short link and uploaded media are stored
here, scoped to the owner that signs the request. Every route below is signed
exactly like a link mutation (including `GET`, which signs an empty body) and
only ever sees the signing owner's rows. Limit: 600 requests/min per client IP.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/inline-demo/demos` | | `{ demos }`, newest first |
| `POST` | `/api/inline-demo/demos` | `{ title, kind: "video"\|"embed", src, poster?, caption? }` | `201 { demo }` |
| `GET` | `/api/inline-demo/demos/{id}` | | `{ demo }` |
| `PATCH` | `/api/inline-demo/demos/{id}` | any of the create fields (`""` clears `poster`/`caption`) | `{ demo }` |
| `DELETE` | `/api/inline-demo/demos/{id}` | | `{ success: true }`; slots pointing at it are removed |
| `POST` | `/api/inline-demo/demos/{id}/bump` | `{ field: "clicks"\|"plays" }` | `{ success: true }` |
| `GET` | `/api/inline-demo/slots` | | `{ slots: { name: demoId } }` |
| `GET` | `/api/inline-demo/slots/{name}` | | `{ demo }` the slot points at |
| `PUT` | `/api/inline-demo/slots/{name}` | `{ demoId }` | `{ success: true }` |
| `GET` | `/api/inline-demo/short-link` | | `{ code?, shortUrl? }` |
| `PUT` | `/api/inline-demo/short-link` | `{ code, shortUrl }` | `{ success: true }` |
| `POST` | `/api/inline-demo/assets` | raw file bytes; `Content-Type`, `X-Filename` headers | `201 { name }` |
| `GET` | `/api/inline-demo/assets/{name}` | — (public, unsigned; supports `Range`) | the file |

For an upload the signature's body hash is the SHA-256 of the raw bytes.
Unknown or other owners' ids return `404`.

Data from an inline-demo local-dev store can be imported on deploy; see
`DEPLOYMENT.md`.
