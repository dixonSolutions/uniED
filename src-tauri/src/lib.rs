mod commands;

use commands::*;
use parking_lot::Mutex;
use std::collections::HashMap;
pub struct Watchers {
    pub inner: Mutex<HashMap<String, notify::RecommendedWatcher>>,
}

impl Default for Watchers {
    fn default() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Watchers::default())
        .invoke_handler(tauri::generate_handler![
            fs_open_folder,
            fs_read_dir,
            fs_read_file,
            fs_write_file,
            fs_create_file,
            fs_create_folder,
            fs_rename,
            fs_delete,
            fs_watch,
            fs_unwatch,
            config_get,
            config_set,
            lok_open,
            lok_close,
            lok_render_tile,
            lok_post_key,
            lok_post_mouse,
            lok_doc_size,
            lok_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running uniED");
}
