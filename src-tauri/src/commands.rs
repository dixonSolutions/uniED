use crate::Watchers;
use notify::Watcher;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

fn validate_abs(p: &str) -> Result<PathBuf, String> {
    let path = Path::new(p);
    if !path.is_absolute() {
        return Err("Path must be absolute".into());
    }
    Ok(path.to_path_buf())
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("unied-config.json"))
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsTreeNode {
    pub name: String,
    pub path: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FsTreeNode>>,
}

fn read_dir_recursive(dir: &Path, max_depth: usize, depth: usize) -> Result<Vec<FsTreeNode>, String> {
    if depth > max_depth {
        return Ok(vec![]);
    }
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    let mut nodes = Vec::new();
    for ent in entries {
        let name = ent.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let meta = ent.metadata().map_err(|e| e.to_string())?;
        let full = ent.path();
        let full_str = full.to_string_lossy().to_string();
        if meta.is_dir() {
            let children = read_dir_recursive(&full, max_depth, depth + 1)?;
            nodes.push(FsTreeNode {
                name,
                path: full_str,
                kind: "directory".into(),
                children: Some(children),
            });
        } else if meta.is_file() {
            nodes.push(FsTreeNode {
                name,
                path: full_str,
                kind: "file".into(),
                children: None,
            });
        }
    }
    Ok(nodes)
}

#[tauri::command]
pub async fn fs_open_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Open workspace folder")
        .blocking_pick_folder();
    Ok(picked.map(|p| p.to_string()))
}

#[tauri::command]
pub fn fs_read_dir(root_path: String) -> Result<Vec<FsTreeNode>, String> {
    let root = validate_abs(&root_path)?;
    if !root.is_dir() {
        return Err("Path is not a directory".into());
    }
    read_dir_recursive(&root, 12, 0)
}

#[tauri::command]
pub fn fs_read_file(file_path: String) -> Result<String, String> {
    let p = validate_abs(&file_path)?;
    fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_write_file(file_path: String, content: String) -> Result<(), String> {
    let p = validate_abs(&file_path)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_create_file(file_path: String, content: Option<String>) -> Result<(), String> {
    let p = validate_abs(&file_path)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, content.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_create_folder(folder_path: String) -> Result<(), String> {
    let p = validate_abs(&folder_path)?;
    fs::create_dir_all(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    let o = validate_abs(&old_path)?;
    let n = validate_abs(&new_path)?;
    fs::rename(o, n).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_delete(target_path: String) -> Result<(), String> {
    let p = validate_abs(&target_path)?;
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn fs_watch(app: AppHandle, state: State<Watchers>, root_path: String) -> Result<(), String> {
    let _ = validate_abs(&root_path)?;
    if state.inner.lock().contains_key(&root_path) {
        return Ok(());
    }
    let app_handle = app.clone();
    let key = root_path.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(ev) = res {
            let ev_name = match ev.kind {
                notify::EventKind::Create(_) => "add",
                notify::EventKind::Modify(_) => "change",
                notify::EventKind::Remove(_) => "unlink",
                notify::EventKind::Any => "change",
                _ => "change",
            };
            for path in ev.paths {
                let payload = json!({
                    "path": path.to_string_lossy(),
                    "event": ev_name,
                });
                let _ = app_handle.emit("fs-changed", payload);
            }
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&root_path), notify::RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    state.inner.lock().insert(key, watcher);
    Ok(())
}

#[tauri::command]
pub fn fs_unwatch(state: State<Watchers>, root_path: String) -> Result<(), String> {
    let mut g = state.inner.lock();
    g.remove(&root_path);
    Ok(())
}

#[tauri::command]
pub fn config_get(app: AppHandle) -> Result<Value, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(json!({}));
    }
    let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_set(app: AppHandle, partial: Value) -> Result<Value, String> {
    let path = config_path(&app)?;
    let mut current: Value = if path.exists() {
        let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).unwrap_or(json!({}))
    } else {
        json!({})
    };
    if let (Some(co), Some(pa)) = (current.as_object_mut(), partial.as_object()) {
        for (k, v) in pa {
            co.insert(k.clone(), v.clone());
        }
    }
    fs::write(&path, serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(current)
}

#[tauri::command]
pub fn lok_open(file_path: String) -> Result<Value, String> {
    let _ = file_path;
    Err(
        "LibreOfficeKit is not yet available in the Tauri build. See docs/LOK_INTEGRATION.md."
            .into(),
    )
}

#[tauri::command]
pub fn lok_close(doc_id: i64) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn lok_render_tile(req: Value) -> Result<Value, String> {
    Err("LOK unavailable".into())
}

#[tauri::command]
pub fn lok_post_key(payload: Value) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn lok_post_mouse(payload: Value) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn lok_doc_size(doc_id: i64) -> Result<Value, String> {
    Err("LOK unavailable".into())
}

#[tauri::command]
pub fn lok_command(cmd: String, args: Option<Value>) -> Result<Value, String> {
    let _ = (cmd, args);
    Ok(json!({ "ok": false, "reason": "not_implemented" }))
}
