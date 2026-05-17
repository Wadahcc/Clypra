use crate::models::Project;
use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use unicode_segmentation::UnicodeSegmentation;

fn get_projects_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let projects_dir = app_data.join("projects");
    fs::create_dir_all(&projects_dir)
        .map_err(|e| format!("Failed to create projects dir: {}", e))?;
    
    Ok(projects_dir)
}

#[tauri::command]
pub fn save_project(app: tauri::AppHandle, project_data: String) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app)?;

    let project: Project = serde_json::from_str(&project_data)
        .map_err(|e| format!("Invalid project JSON: {}", e))?;

    let file_path = projects_dir.join(format!("{}.json", project.id));

    println!("[save_project] Saving project {} with {} tracks, {} clips, {} media_assets",
        project.id,
        project.tracks.len(),
        project.clips.len(),
        project.media_assets.len()
    );

    fs::write(&file_path, &project_data)
        .map_err(|e| format!("Failed to save project: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn load_project(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to load project: {}", e))
}

#[tauri::command]
pub fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let projects_dir = get_projects_dir(&app)?;
    
    let mut projects: Vec<(u64, String)> = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            if let Ok(path) = entry.path().canonicalize() {
                if path.extension().is_some_and(|ext| ext == "json") {
                    if let Ok(metadata) = fs::metadata(&path) {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if let Ok(modified) = metadata.modified() {
                                if let Ok(duration) = modified.elapsed() {
                                    let timestamp = std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_millis() as u64 - duration.as_millis() as u64;
                                    projects.push((timestamp, content));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    projects.sort_by_key(|b| std::cmp::Reverse(b.0));
    
    Ok(projects.into_iter().map(|(_, content)| content).collect())
}

const MAX_PROJECT_NAME_LENGTH: usize = 64;

#[tauri::command]
pub fn rename_project(app: tauri::AppHandle, project_id: String, new_name: String) -> Result<(), String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if trimmed.graphemes(true).count() > MAX_PROJECT_NAME_LENGTH {
        return Err(format!("Project name exceeds {} characters", MAX_PROJECT_NAME_LENGTH));
    }
    let projects_dir = get_projects_dir(&app)?;
    let file_path = projects_dir.join(format!("{}.json", project_id));

    if !file_path.exists() {
        return Err(format!("Project file not found: {}", project_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read project: {}", e))?;

    let mut project: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid project JSON: {}", e))?;

    project["name"] = serde_json::Value::String(trimmed.to_string());

    let updated = serde_json::to_string(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    fs::write(&file_path, updated)
        .map_err(|e| format!("Failed to save project: {}", e))?;

    Ok(())
}

const MAX_TEXT_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TEXT_EXTENSIONS: &[&str] = &["srt", "txt"];

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let file_path = std::path::Path::new(&path);

    // Validate file extension
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !ALLOWED_TEXT_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!("Unsupported file type: .{}. Only .srt and .txt files are allowed.", ext));
    }

    // Resolve symlinks and verify the file exists
    let canonical = file_path.canonicalize()
        .map_err(|_| format!("File not found or inaccessible: {}", path))?;

    // Check file size before reading
    let metadata = fs::metadata(&canonical)
        .map_err(|e| format!("Cannot read file metadata: {}", e))?;
    if metadata.len() > MAX_TEXT_FILE_SIZE {
        return Err(format!("File too large ({:.1} MB). Maximum allowed size is {} MB.",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_TEXT_FILE_SIZE / (1024 * 1024)));
    }
    if !metadata.is_file() {
        return Err("Path is not a regular file.".to_string());
    }

    // Try UTF-8 first, then fall back to Latin-1 (Windows-1252 compatible)
    match fs::read_to_string(&canonical) {
        Ok(content) => {
            let stripped = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
            Ok(stripped.to_string())
        }
        Err(_) => {
            let bytes = fs::read(&canonical)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            Ok(bytes.iter().map(|&b| b as char).collect())
        }
    }
}

#[tauri::command]
pub fn delete_project(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app)?;
    let file_path = projects_dir.join(format!("{}.json", project_id));
    
    if !file_path.exists() {
        return Err(format!("Project file not found: {}", project_id));
    }
    
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete project: {}", e))?;
    
    Ok(())
}
