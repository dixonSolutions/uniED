/// LibreOfficeKit integration — interactive tile-rendering editor.
///
/// Architecture overview
/// ─────────────────────
/// LOK is a C library (libmergedlo.so) that must be initialised exactly once
/// per process.  We use the `libreofficekit` Rust crate for initialisation
/// and document-load, then reach through its private `Document` value via an
/// unsafe pointer cast to access the extended function-pointer table that the
/// crate does not expose (paintTile, postMouseEvent, postKeyEvent, etc.).
///
/// All LOK calls are serialised through a `parking_lot::Mutex` because LOK
/// is single-threaded internally.  We spawn each command on a blocking thread
/// (tokio::task::spawn_blocking) so the async runtime is never blocked.
///
/// Document lifecycle
/// ──────────────────
/// `open_doc`     – loads the document, initialises for rendering, stores a
///                  raw pointer + size in the registry.  The logical Document
///                  value is forgotten (its Drop would call destroy twice).
/// `render_tile`  – paints a tile into an RGBA heap buffer, base64-encodes it.
/// `post_mouse`   – forwards a mouse event (type, x, y in twips, buttons, mod).
/// `post_key`     – forwards a keyboard event (type, char code, key code).
/// `close_doc`    – calls destroy and removes from the registry.
use libreofficekit::{DocUrl, Office};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::os::raw::{c_char, c_int, c_long, c_uchar, c_void};
use std::sync::OnceLock;

// ──────────────────────────────────────────────────────────────────────────────
// 1.  Full LOK document vtable (LibreOfficeKit.h – stable since LO 6.0)
//
//     Fields MUST appear in this exact order to match the ABI of libmergedlo.so.
//     Source: include/LibreOfficeKit/LibreOfficeKit.h in the LibreOffice repo.
// ──────────────────────────────────────────────────────────────────────────────

#[repr(C)]
struct LokDocClass {
    n_size:                   usize,
    destroy:                  Option<unsafe extern "C" fn(*mut LokDocRaw)>,
    save_as:                  Option<unsafe extern "C" fn(*mut LokDocRaw, *const c_char, *const c_char, *const c_char) -> c_int>,
    get_document_type:        Option<unsafe extern "C" fn(*mut LokDocRaw) -> c_int>,
    // LOK_USE_UNSTABLE_API block — always compiled into the shared library:
    get_parts:                Option<unsafe extern "C" fn(*mut LokDocRaw) -> c_int>,
    get_part_page_rectangles: Option<unsafe extern "C" fn(*mut LokDocRaw) -> *mut c_char>,
    get_part:                 Option<unsafe extern "C" fn(*mut LokDocRaw) -> c_int>,
    set_part:                 Option<unsafe extern "C" fn(*mut LokDocRaw, c_int)>,
    get_part_name:            Option<unsafe extern "C" fn(*mut LokDocRaw, c_int) -> *mut c_char>,
    set_part_mode:            Option<unsafe extern "C" fn(*mut LokDocRaw, c_int)>,
    paint_tile:               Option<unsafe extern "C" fn(*mut LokDocRaw, *mut c_uchar, c_int, c_int, c_int, c_int, c_int, c_int)>,
    get_tile_mode:            Option<unsafe extern "C" fn(*mut LokDocRaw) -> c_int>,
    get_document_size:        Option<unsafe extern "C" fn(*mut LokDocRaw, *mut c_long, *mut c_long)>,
    initialize_for_rendering: Option<unsafe extern "C" fn(*mut LokDocRaw, *const c_char)>,
    register_callback:        Option<unsafe extern "C" fn(*mut LokDocRaw, Option<unsafe extern "C" fn(c_int, *const c_char, *mut c_void)>, *mut c_void)>,
    post_key_event:           Option<unsafe extern "C" fn(*mut LokDocRaw, c_int, c_int, c_int)>,
    post_mouse_event:         Option<unsafe extern "C" fn(*mut LokDocRaw, c_int, c_int, c_int, c_int, c_int, c_int)>,
}

/// Mirrors `LibreOfficeKitDocument` — a single pointer to the vtable.
#[repr(C)]
struct LokDocRaw {
    p_class: *mut LokDocClass,
}

// ──────────────────────────────────────────────────────────────────────────────
// 2.  SendOffice — same trick as before, safe because Mutex serialises access.
// ──────────────────────────────────────────────────────────────────────────────

struct SendOffice(Office);
// SAFETY: all access is serialised by the surrounding Mutex.
unsafe impl Send for SendOffice {}
unsafe impl Sync for SendOffice {}

// ──────────────────────────────────────────────────────────────────────────────
// 3.  Per-document state stored in the registry.
// ──────────────────────────────────────────────────────────────────────────────

struct StoredDoc {
    /// Raw pointer to the LOK document vtable struct (kept alive manually).
    /// MUST only be accessed while holding the LokState mutex.
    raw:          *mut LokDocRaw,
    width_twips:  i64,
    height_twips: i64,
}

// SAFETY: we never let `raw` escape the Mutex guard.
unsafe impl Send for StoredDoc {}

// ──────────────────────────────────────────────────────────────────────────────
// 4.  Global singleton state
// ──────────────────────────────────────────────────────────────────────────────

struct LokState {
    office: SendOffice,
    docs:   HashMap<u32, StoredDoc>,
    next_id: u32,
}

static LOK_STATE: OnceLock<Mutex<LokState>> = OnceLock::new();

fn get_state() -> Result<&'static Mutex<LokState>, String> {
    if let Some(m) = LOK_STATE.get() {
        return Ok(m);
    }

    let install_path = Office::find_install_path().ok_or_else(|| {
        "LibreOffice installation not found. Install LibreOffice (e.g. `sudo apt install libreoffice`).".to_string()
    })?;
    let office = Office::new(install_path).map_err(|e| e.to_string())?;

    // Race-safe: if another thread won the race, the losing value is dropped.
    let _ = LOK_STATE.set(Mutex::new(LokState {
        office: SendOffice(office),
        docs:   HashMap::new(),
        next_id: 1,
    }));
    Ok(LOK_STATE.get().unwrap())
}

// ──────────────────────────────────────────────────────────────────────────────
// 5.  Public API  (all must be called from a blocking thread)
// ──────────────────────────────────────────────────────────────────────────────

pub struct OpenResult {
    pub doc_id:      u32,
    pub width_twips: i64,
    pub height_twips: i64,
}

/// Open a document and register it for tile rendering.
/// Returns the doc_id and the full document size in twips.
pub fn open_doc(file_path: &str) -> Result<OpenResult, String> {
    let state_mutex = get_state()?;
    let mut state = state_mutex.lock();

    let url = DocUrl::from_absolute_path(file_path)
        .map_err(|e| format!("Bad path: {e}"))?;

    let doc = state.office.0
        .document_load(&url)
        .map_err(|e| format!("Could not open document: {e}"))?;

    // Extract the raw pointer before the Document Drop runs.
    // `Document` is repr(Rust) with a single field (DocumentRaw { this: *mut … }),
    // so its address == the address of the inner pointer value.
    // SAFETY: we immediately forget `doc` to prevent the automatic destroy call.
    let raw: *mut LokDocRaw = unsafe { std::mem::transmute_copy(&doc) };
    std::mem::forget(doc);

    // Initialise the document for rendering (required before paintTile).
    let (width_twips, height_twips) = unsafe {
        let class = (*raw).p_class;
        if let Some(init) = (*class).initialize_for_rendering {
            init(raw, std::ptr::null());
        }
        let mut w: c_long = 0;
        let mut h: c_long = 0;
        if let Some(size_fn) = (*class).get_document_size {
            size_fn(raw, &mut w, &mut h);
        }
        (w as i64, h as i64)
    };

    let doc_id = state.next_id;
    state.next_id += 1;
    state.docs.insert(doc_id, StoredDoc { raw, width_twips, height_twips });

    Ok(OpenResult { doc_id, width_twips, height_twips })
}

/// Render a rectangular tile of the document to a base64-encoded RGBA image.
///
/// * `canvas_w` / `canvas_h`  — pixel size of the rendered tile
/// * `tile_x`   / `tile_y`    — top-left corner of the tile in twips
/// * `tile_w`   / `tile_h`    — size of the document region to render, in twips
pub fn render_tile(
    doc_id:   u32,
    canvas_w: i32,
    canvas_h: i32,
    tile_x:   i32,
    tile_y:   i32,
    tile_w:   i32,
    tile_h:   i32,
) -> Result<String, String> {
    let state_mutex = get_state()?;
    let state = state_mutex.lock();

    let doc = state.docs.get(&doc_id)
        .ok_or_else(|| format!("Unknown doc_id: {doc_id}"))?;

    // LOK paints in BGRA format; we convert to RGBA in-place before sending.
    let buf_len = (canvas_w * canvas_h * 4) as usize;
    let mut buf: Vec<u8> = vec![0u8; buf_len];

    unsafe {
        let class = (*doc.raw).p_class;
        let paint = (*class).paint_tile
            .ok_or_else(|| "paintTile not available in this build of LibreOffice".to_string())?;
        paint(doc.raw, buf.as_mut_ptr(), canvas_w, canvas_h, tile_x, tile_y, tile_w, tile_h);
    }

    // BGRA → RGBA channel swap
    for pixel in buf.chunks_exact_mut(4) {
        pixel.swap(0, 2); // B ↔ R
    }

    Ok(base64_encode(&buf))
}

/// Post a mouse event to the document.
///
/// `event_type`: 0 = button down, 1 = button up, 2 = move
/// `buttons`:    0 = none, 1 = left, 2 = middle, 4 = right
/// `modifier`:   bitmask of shift/ctrl/alt (LOK_KEYMOD_*)
pub fn post_mouse(
    doc_id:     u32,
    event_type: i32,
    x:          i32,
    y:          i32,
    count:      i32,
    buttons:    i32,
    modifier:   i32,
) -> Result<(), String> {
    let state_mutex = get_state()?;
    let state = state_mutex.lock();

    let doc = state.docs.get(&doc_id)
        .ok_or_else(|| format!("Unknown doc_id: {doc_id}"))?;

    unsafe {
        let class = (*doc.raw).p_class;
        if let Some(f) = (*class).post_mouse_event {
            f(doc.raw, event_type, x, y, count, buttons, modifier);
        }
    }
    Ok(())
}

/// Post a keyboard event to the document.
///
/// `event_type`: 0 = key press, 1 = key release
/// `char_code`:  Unicode character (0 for non-printable)
/// `key_code`:   LOK key code (0 for printable characters)
pub fn post_key(
    doc_id:     u32,
    event_type: i32,
    char_code:  i32,
    key_code:   i32,
) -> Result<(), String> {
    let state_mutex = get_state()?;
    let state = state_mutex.lock();

    let doc = state.docs.get(&doc_id)
        .ok_or_else(|| format!("Unknown doc_id: {doc_id}"))?;

    unsafe {
        let class = (*doc.raw).p_class;
        if let Some(f) = (*class).post_key_event {
            f(doc.raw, event_type, char_code, key_code);
        }
    }
    Ok(())
}

/// Close and destroy a document.
pub fn close_doc(doc_id: u32) -> Result<(), String> {
    let state_mutex = get_state()?;
    let mut state = state_mutex.lock();

    if let Some(doc) = state.docs.remove(&doc_id) {
        unsafe {
            let class = (*doc.raw).p_class;
            if let Some(f) = (*class).destroy {
                f(doc.raw);
            }
        }
    }
    Ok(())
}

// ──────────────────────────────────────────────────────────────────────────────
// 6.  Helpers
// ──────────────────────────────────────────────────────────────────────────────

/// Minimal base64 encoder — avoids pulling in an extra crate.
pub fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 0x3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 { CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[b2 & 0x3f] as char } else { '=' });
    }
    out
}
