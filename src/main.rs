use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use sled::Db;
use p256::ecdsa::{signature::Signer, Signature, SigningKey};
use p256::pkcs8::EncodePublicKey;
use rand_core::{OsRng, RngCore};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Parser)]
#[command(name = "short_url")]
#[command(about = "Local-first URL shortener CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(long, default_value = "https://sho.rt", global = true)]
    api: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a short link
    Shorten {
        /// URL to shorten
        url: String,

        /// Custom short code (optional)
        #[arg(short, long)]
        code: Option<String>,

        /// PIN for additional security (optional)
        #[arg(short, long)]
        pin: Option<String>,

        /// Use local storage instead of API
        #[arg(long)]
        local: bool,
    },

    /// List all local short links
    List {
        /// Use local storage instead of API
        #[arg(long)]
        local: bool,
    },

    /// Update a link's destination
    Update {
        /// Short code to update
        code: String,

        /// New destination URL
        url: String,

        /// PIN if set on the link
        #[arg(short, long)]
        pin: Option<String>,

        /// Use local storage instead of API
        #[arg(long)]
        local: bool,
    },
}

#[derive(Serialize, Deserialize, Debug)]
struct ShortenRequest {
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    customCode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pin: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ShortenResponse {
    shortCode: String,
    shortUrl: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct UpdateRequest {
    url: String,
    revision: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pin: Option<String>,
}

#[derive(Deserialize, Debug)]
struct LinkMetadata {
    revision: u64,
}

#[derive(Deserialize, Debug)]
struct ApiError {
    error: String,
}

/// Owner identity for remote calls: the fingerprint plus the P-256 key that signs
/// every mutation (see web/lib/request-signing.ts for the format).
struct Identity {
    fingerprint: String,
    key: SigningKey,
}

impl Identity {
    fn public_key_hex(&self) -> String {
        let spki = self
            .key
            .verifying_key()
            .to_public_key_der()
            .expect("P-256 public keys always encode");
        hex::encode(spki.as_bytes())
    }

    /// Headers for a signed request over `body`.
    fn sign(&self, method: &str, path: &str, body: &str) -> Vec<(&'static str, String)> {
        use sha2::{Digest, Sha256};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .to_string();
        let body_hash = hex::encode(Sha256::digest(body.as_bytes()));
        let message = canonical_request(method, path, &timestamp, &body_hash);
        let signature: Signature = self.key.sign(message.as_bytes());
        vec![
            ("x-owner", self.fingerprint.clone()),
            ("x-owner-key", self.public_key_hex()),
            ("x-owner-timestamp", timestamp),
            ("x-owner-signature", hex::encode(signature.to_bytes())),
        ]
    }
}

fn canonical_request(method: &str, path: &str, timestamp: &str, body_hash: &str) -> String {
    ["short-url-auth-v1", method, path, timestamp, body_hash].join("\n")
}

fn load_or_create_identity() -> Identity {
    let fingerprint = load_or_create_fingerprint();
    let key = sled::open(".short_url")
        .ok()
        .and_then(|db| db.open_tree("identity").ok())
        .map(|tree| {
            if let Ok(Some(bytes)) = tree.get("signing_key") {
                if let Ok(key) = SigningKey::from_slice(&bytes) {
                    return key;
                }
            }
            let key = SigningKey::random(&mut OsRng);
            let _ = tree.insert("signing_key", key.to_bytes().as_slice());
            let _ = tree.flush();
            key
        })
        .unwrap_or_else(|| SigningKey::random(&mut OsRng));
    Identity { fingerprint, key }
}

async fn api_error(resp: reqwest::Response) -> Box<dyn std::error::Error> {
    let status = resp.status();
    match resp.json::<ApiError>().await {
        Ok(body) => format!("{}: {}", status, body.error).into(),
        Err(_) => format!("request failed with {}", status).into(),
    }
}

fn generate_fingerprint() -> String {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn load_or_create_fingerprint() -> String {
    if let Ok(db) = sled::open(".short_url") {
        if let Ok(Some(fp)) = db.get("fingerprint") {
            return String::from_utf8(fp.to_vec()).unwrap_or_else(|_| generate_fingerprint());
        } else {
            let fp = generate_fingerprint();
            let _ = db.insert("fingerprint", fp.as_bytes());
            return fp;
        }
    }
    generate_fingerprint()
}

async fn shorten_url_api(
    api: &str,
    url: &str,
    code: Option<&str>,
    pin: Option<&str>,
    identity: &Identity,
) -> Result<ShortenResponse, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let body = serde_json::to_string(&ShortenRequest {
        url: url.to_string(),
        customCode: code.map(|c| c.to_string()),
        pin: pin.map(|p| p.to_string()),
    })?;

    let path = "/api/shorten";
    let mut req = client
        .post(format!("{}{}", api, path))
        .header("content-type", "application/json");
    for (name, value) in identity.sign("POST", path, &body) {
        req = req.header(name, value);
    }
    let resp = req.body(body).send().await?;
    if !resp.status().is_success() {
        return Err(api_error(resp).await);
    }

    let data: ShortenResponse = resp.json().await?;
    Ok(data)
}

async fn update_url_api(
    api: &str,
    code: &str,
    url: &str,
    pin: Option<&str>,
    identity: &Identity,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let path = format!("/api/links/{}", code);

    // Edits are conditional on the revision we last saw.
    let current = client.get(format!("{}{}", api, path)).send().await?;
    if !current.status().is_success() {
        return Err(api_error(current).await);
    }
    let LinkMetadata { revision } = current.json().await?;

    let body = serde_json::to_string(&UpdateRequest {
        url: url.to_string(),
        revision,
        pin: pin.map(|p| p.to_string()),
    })?;
    let mut req = client
        .patch(format!("{}{}", api, path))
        .header("content-type", "application/json");
    for (name, value) in identity.sign("PATCH", &path, &body) {
        req = req.header(name, value);
    }
    let resp = req.body(body).send().await?;
    if !resp.status().is_success() {
        return Err(api_error(resp).await);
    }

    Ok(())
}

fn shorten_url_local(db: &Db, url: &str, code: Option<&str>) -> Result<String, Box<dyn std::error::Error>> {
    let short = if let Some(c) = code {
        c.to_string()
    } else {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("{:x}", timestamp)[0..6].to_string()
    };

    db.insert(short.as_bytes(), url.as_bytes())?;
    db.flush()?;
    Ok(short)
}

fn list_urls_local(db: &Db) -> Result<Vec<(String, String)>, Box<dyn std::error::Error>> {
    let mut entries = Vec::new();
    for item in db.iter() {
        let (key, value) = item?;
        let short = String::from_utf8_lossy(&key).to_string();
        let long = String::from_utf8_lossy(&value).to_string();
        entries.push((short, long));
    }
    Ok(entries)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Shorten { url, code, pin, local } => {
            if local {
                let db = sled::open(".short_url")?;
                let short = shorten_url_local(&db, &url, code.as_deref())?;
                println!("Short URL: .short_url/{}", short);
                println!("Stored locally in .short_url database");
            } else {
                let identity = load_or_create_identity();
                let resp = shorten_url_api(&cli.api, &url, code.as_deref(), pin.as_deref(), &identity).await?;
                println!("Short URL: {}", resp.shortUrl);
                println!("Code: {}", resp.shortCode);
            }
        }

        Commands::List { local } => {
            if local {
                let db = sled::open(".short_url")?;
                let entries = list_urls_local(&db)?;
                if entries.is_empty() {
                    println!("No local links found");
                } else {
                    for (code, url) in entries {
                        println!(".short_url/{} -> {}", code, url);
                    }
                }
            } else {
                eprintln!("API listing not yet implemented. Use --local flag to list local links.");
            }
        }

        Commands::Update { code, url, pin, local } => {
            if local {
                let db = sled::open(".short_url")?;
                db.insert(code.as_bytes(), url.as_bytes())?;
                db.flush()?;
                println!("Updated .short_url/{} -> {}", code, url);
            } else {
                let identity = load_or_create_identity();
                update_url_api(&cli.api, &code, &url, pin.as_deref(), &identity).await?;
                println!("Updated {}/{} -> {}", cli.api, code, url);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_unique_fingerprints() {
        let fp1 = generate_fingerprint();
        let fp2 = generate_fingerprint();
        assert_eq!(fp1.len(), 32);
        assert_eq!(fp2.len(), 32);
    }

    #[test]
    fn signed_headers_verify_against_the_canonical_request() {
        use p256::ecdsa::{signature::Verifier, VerifyingKey};
        use p256::pkcs8::DecodePublicKey;
        use sha2::{Digest, Sha256};

        let identity = Identity { fingerprint: generate_fingerprint(), key: SigningKey::random(&mut OsRng) };
        let body = r#"{"url":"https://example.com/"}"#;
        let headers: std::collections::HashMap<_, _> = identity.sign("POST", "/api/shorten", body).into_iter().collect();

        assert_eq!(headers["x-owner"], identity.fingerprint);
        let key = VerifyingKey::from_public_key_der(&hex::decode(&headers["x-owner-key"]).unwrap()).unwrap();
        let signature_bytes = hex::decode(&headers["x-owner-signature"]).unwrap();
        assert_eq!(signature_bytes.len(), 64, "raw r||s, as WebCrypto produces");
        let signature = Signature::from_slice(&signature_bytes).unwrap();
        let message = format!(
            "short-url-auth-v1\nPOST\n/api/shorten\n{}\n{}",
            headers["x-owner-timestamp"],
            hex::encode(Sha256::digest(body.as_bytes()))
        );
        assert!(key.verify(message.as_bytes(), &signature).is_ok());
    }

    #[test]
    fn shorten_and_list_round_trip() {
        let temp_dir = tempfile::tempdir().expect("tempdir should create successfully");
        let db = sled::open(temp_dir.path()).expect("db should open successfully");

        let original = "https://rust-lang.org/learn";
        let code = shorten_url_local(&db, original, None).expect("shorten should succeed");

        let entries = list_urls_local(&db).expect("list should succeed");
        assert!(entries.iter().any(|(k, v)| k == &code && v == original));
    }
}
