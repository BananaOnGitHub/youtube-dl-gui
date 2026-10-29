//! Shared managed-download integrity and rollback primitives. These never receive
//! system executable paths: only app-owned staging and managed directories.
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::AsyncWriteExt;

type InstallError = Box<dyn std::error::Error + Send + Sync>;

pub async fn download_verified(
  client: &reqwest::Client,
  url: &str,
  expected: &str,
  destination: &Path,
  progress: impl Fn(u64, u64),
) -> Result<(), InstallError> {
  let temporary = destination.with_extension("download");
  let result = async {
    let mut response = client.get(url).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or(0);
    let mut received = 0;
    let mut file = tokio::fs::File::create(&temporary).await?;
    let mut hash = Sha256::new();
    while let Some(chunk) = response.chunk().await? {
      received += chunk.len() as u64;
      hash.update(&chunk);
      file.write_all(&chunk).await?;
      progress(received, total);
    }
    if hex::encode(hash.finalize()) != expected.to_ascii_lowercase() {
      return Err("sha256 mismatch".into());
    }
    file.flush().await?;
    drop(file); // Close before rename on Windows.
    tokio::fs::rename(&temporary, destination).await?;
    Ok(())
  }
  .await;
  if result.is_err() {
    let _ = tokio::fs::remove_file(&temporary).await;
  }
  result
}

/// Publish complete top-level bundle entries using same-filesystem renames.
/// Retain old entries until every new entry is in place; roll back on failure.
/// Multi-file bundles have a short publication window, serialized by the manager.
pub async fn publish(staging: &Path, bin: &Path) -> Result<(), InstallError> {
  let staging = staging.to_path_buf();
  let bin = bin.to_path_buf();
  tokio::task::spawn_blocking(move || {
    let backup = bin.join(format!(".backup-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&backup)?;
    let mut published = Vec::new();
    let mut saved = Vec::new();
    let result = (|| -> Result<(), InstallError> {
      for entry in std::fs::read_dir(&staging)? {
        let entry = entry?;
        let name = entry.file_name();
        let target = bin.join(&name);
        if target.exists() {
          std::fs::rename(&target, backup.join(&name))?;
          saved.push(name.clone());
        }
        std::fs::rename(entry.path(), &target)?;
        published.push(name);
      }
      Ok(())
    })();
    if result.is_err() {
      for name in &published {
        let target = bin.join(name);
        if target.is_dir() {
          std::fs::remove_dir_all(target)?;
        } else {
          std::fs::remove_file(target)?;
        }
      }
      for name in &saved {
        std::fs::rename(backup.join(name), bin.join(name))?;
      }
    }
    let _ = std::fs::remove_dir_all(&backup);
    if result.is_ok() {
      let _ = std::fs::remove_dir_all(&staging);
    }
    result
  })
  .await?
}
