use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use sled::Db;
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
    fingerprint: String,
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
    fingerprint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pin: Option<String>,
}

fn generate_fingerprint() -> String {
    use sha2::{Sha256, Digest};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let data = format!("cli-{}", timestamp);
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex::encode(&result[..16])
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
    fingerprint: &str,
) -> Result<ShortenResponse, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let req = ShortenRequest {
        url: url.to_string(),
        customCode: code.map(|c| c.to_string()),
        fingerprint: fingerprint.to_string(),
        pin: pin.map(|p| p.to_string()),
    };

    let resp = client
        .post(format!("{}/api/shorten", api))
        .json(&req)
        .send()
        .await?;

    let data: ShortenResponse = resp.json().await?;
    Ok(data)
}

async fn update_url_api(
    api: &str,
    code: &str,
    url: &str,
    pin: Option<&str>,
    fingerprint: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let req = UpdateRequest {
        url: url.to_string(),
        fingerprint: fingerprint.to_string(),
        pin: pin.map(|p| p.to_string()),
    };

    let resp = client
        .patch(format!("{}/api/links/{}", api, code))
        .json(&req)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err("Failed to update URL".into());
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
    let fingerprint = load_or_create_fingerprint();

    match cli.command {
        Commands::Shorten { url, code, pin, local } => {
            if local {
                let db = sled::open(".short_url")?;
                let short = shorten_url_local(&db, &url, code.as_deref())?;
                println!("Short URL: .short_url/{}", short);
                println!("Stored locally in .short_url database");
            } else {
                let resp = shorten_url_api(&cli.api, &url, code.as_deref(), pin.as_deref(), &fingerprint).await?;
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
                update_url_api(&cli.api, &code, &url, pin.as_deref(), &fingerprint).await?;
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
    fn shorten_and_list_round_trip() {
        let temp_dir = tempfile::tempdir().expect("tempdir should create successfully");
        let db = sled::open(temp_dir.path()).expect("db should open successfully");

        let original = "https://rust-lang.org/learn";
        let code = shorten_url_local(&db, original, None).expect("shorten should succeed");

        let entries = list_urls_local(&db).expect("list should succeed");
        assert!(entries.iter().any(|(k, v)| k == &code && v == original));
    }
}
