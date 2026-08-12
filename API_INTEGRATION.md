# Short URL API integration

This document describes the API implemented by this repository. Set the service
origin in your application rather than hard-coding it:

```text
SHORT_URL_BASE_URL=https://0-2.ca
```

All JSON requests should include `Content-Type: application/json`. There is no
API key, bearer token, cookie, or login flow in the current API.

## Authentication and ownership

The API uses a caller-provided `fingerprint` string as the link owner ID. Use one
stable, high-entropy value for the integrating application, keep it private, and
reuse it for create, list, update, and delete operations.

For a server-to-server integration, generate it once and store it as a secret,
for example:

```sh
openssl rand -hex 32
```

```text
SHORT_URL_FINGERPRINT=<the generated value>
```

The value is transported differently by endpoint:

| Operation | Authentication format |
| --- | --- |
| Create | `fingerprint` in the JSON body |
| List owned links | `X-Fingerprint` request header |
| Update | `fingerprint` in the JSON body, plus `pin` if the link has one |
| Delete | `fingerprint` in the JSON body |
| Get metadata / follow short URL | Public; no authentication |

Important: this is an ownership token, not cryptographically verified
authentication. The server currently accepts the supplied value without a
signature or API-key check. Anyone who obtains it can manage links owned by it.
Use HTTPS, never expose a server integration's fingerprint to browser clients,
and do not log it. The optional PIN only adds a check when updating a link; it
does not protect listing or deletion.

## Create a short link

```http
POST /api/shorten HTTP/1.1
Host: 0-2.ca
Content-Type: application/json

{
  "url": "https://example.com/articles/123",
  "fingerprint": "YOUR_STABLE_SECRET_OWNER_ID",
  "customCode": "article123",
  "pin": "optional-update-pin"
}
```

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `url` | Yes | Absolute destination URL accepted by the JavaScript `URL` parser. Send an `http://` or `https://` URL for normal web redirects. |
| `fingerprint` | Yes | Stable owner ID described above. |
| `customCode` | No | Case-sensitive, 1–20 ASCII letters or digits (`[0-9A-Za-z]`). If omitted, the service generates a code. |
| `pin` | No | Additional secret required for later updates when set. |

Successful response (`200 OK`):

```json
{
  "shortCode": "article123",
  "shortUrl": "https://0-2.ca/article123",
  "qrUrl": "https://0-2.ca/api/qr?code=article123"
}
```

Example with cURL:

```sh
curl --fail-with-body \
  -X POST "$SHORT_URL_BASE_URL/api/shorten" \
  -H 'Content-Type: application/json' \
  --data "{\"url\":\"https://example.com/articles/123\",\"fingerprint\":\"$SHORT_URL_FINGERPRINT\"}"
```

Example with JavaScript/TypeScript:

```ts
type CreateShortLinkResponse = {
  shortCode: string;
  shortUrl: string;
  qrUrl: string;
};

export async function createShortLink(url: string): Promise<CreateShortLinkResponse> {
  const response = await fetch(`${process.env.SHORT_URL_BASE_URL}/api/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      fingerprint: process.env.SHORT_URL_FINGERPRINT,
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Shortener returned ${response.status}`);
  return body;
}
```

Store both `shortCode` and `shortUrl`. Use `shortUrl` when sending the short URL
to a client. Use `shortCode` with the management endpoints below.

## Get a short URL or its data

To send or display the short URL, use the `shortUrl` returned at creation. Opening
it records a click and returns a permanent `301` redirect:

```http
GET /article123
```

To retrieve its destination and aggregate metadata without following the
redirect:

```http
GET /api/links/article123
```

No authentication is required. A successful response is:

```json
{
  "code": "article123",
  "url": "https://example.com/articles/123",
  "clicks": 7,
  "created": 1786550400,
  "updated": 1786554000,
  "last": 1786557600
}
```

Timestamps are Unix seconds. `updated` and `last` are omitted until applicable.
A missing code returns `404` with `{ "error": "Link not found" }`.

## List links owned by the integration

```http
GET /api/my-links HTTP/1.1
X-Fingerprint: YOUR_STABLE_SECRET_OWNER_ID
```

```sh
curl --fail-with-body \
  "$SHORT_URL_BASE_URL/api/my-links" \
  -H "X-Fingerprint: $SHORT_URL_FINGERPRINT"
```

The response is `{ "links": [...] }`, where every item has the same fields as
the metadata response above. The endpoint may return an empty list on a storage
error or timeout, so do not treat an empty result as authoritative evidence that
no links exist.

## Update a destination

```http
PATCH /api/links/article123
Content-Type: application/json

{
  "url": "https://example.com/articles/456",
  "fingerprint": "YOUR_STABLE_SECRET_OWNER_ID",
  "pin": "optional-update-pin"
}
```

Success is `200` with `{ "success": true }`. An owner mismatch or a missing or
incorrect PIN returns `403` with
`{ "error": "Unauthorized or invalid PIN" }`.

## Delete a link

```http
DELETE /api/links/article123
Content-Type: application/json

{
  "fingerprint": "YOUR_STABLE_SECRET_OWNER_ID"
}
```

Success is `200` with `{ "success": true }`. A missing link returns `404`; an
owner mismatch returns `403`.

## Error handling and integration notes

- API errors are JSON objects with an `error` string. Check the HTTP status
  before consuming a success response.
- Create commonly returns `400` for missing fields, an invalid URL, an invalid
  custom code, a duplicate code, or the 10-second create timeout.
- A caller-selected code can race or collide with an existing code. Retry with a
  different code, or omit `customCode` and let the server choose one.
- There is no documented rate-limit response in the application code. Still use
  bounded retries with exponential backoff for transient `5xx` or network
  failures; do not blindly retry validation errors.
- The origin embedded in `shortUrl` and `qrUrl` is controlled by the deployed
  service's `BASE_URL`. Verify deployment configuration before production use.
- URL validation currently accepts schemes beyond HTTP(S). Integrations should
  restrict input to `http:` and `https:` unless another scheme is intentional.
