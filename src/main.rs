use sled::Db;
use std::collections::hash_map::DefaultHasher;
use std::env;
use std::hash::{Hash, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

fn generate_short_code(url: &str) -> String {
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    let hash = hasher.finish();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{:x}-{}", hash, timestamp)
}

fn shorten_url(db: &Db, url: &str) -> sled::Result<String> {
    let code = generate_short_code(url);
    db.insert(code.as_bytes(), url.as_bytes())?;
    db.flush()?;
    Ok(code)
}

fn list_urls(db: &Db) -> sled::Result<Vec<(String, String)>> {
    let mut entries = Vec::new();
    for item in db.iter() {
        let (key, value) = item?;
        let short = String::from_utf8_lossy(&key).to_string();
        let long = String::from_utf8_lossy(&value).to_string();
        entries.push((short, long));
    }
    Ok(entries)
}

fn print_usage() {
    println!("Usage: shorten <url> | list");
}

fn main() -> sled::Result<()> {
    let db: Db = sled::open("urls")?;
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        print_usage();
        return Ok(());
    }

    match args[1].as_str() {
        "shorten" => {
            if args.len() < 3 {
                println!("Please provide a URL to shorten.");
                print_usage();
                return Ok(());
            }
            let url = &args[2];
            let code = shorten_url(&db, url)?;
            println!("Short URL: https://sho.rt/{code}");
        }
        "list" => {
            let entries = list_urls(&db)?;
            if entries.is_empty() {
                println!("No shortened URLs found.");
            } else {
                for (code, url) in entries {
                    println!("https://sho.rt/{code} -> {url}");
                }
            }
        }
        _ => {
            print_usage();
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_code_with_hash_and_timestamp_separator() {
        let code = generate_short_code("https://example.com");
        assert!(code.contains('-'));
        let mut parts = code.split('-');
        let hash_part = parts.next().unwrap_or_default();
        let ts_part = parts.next().unwrap_or_default();
        assert!(!hash_part.is_empty());
        assert!(u64::from_str_radix(hash_part, 16).is_ok());
        assert!(ts_part.parse::<u64>().is_ok());
    }

    #[test]
    fn shorten_and_list_round_trip() {
        let temp_dir = tempfile::tempdir().expect("tempdir should create successfully");
        let db = sled::open(temp_dir.path()).expect("db should open successfully");

        let original = "https://rust-lang.org/learn";
        let code = shorten_url(&db, original).expect("shorten should succeed");

        let entries = list_urls(&db).expect("list should succeed");
        assert!(entries.iter().any(|(k, v)| k == &code && v == original));
    }
}
