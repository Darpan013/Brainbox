use std::sync::Mutex;
use scraper::{Html, Selector};
use tauri::{Manager, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

// ─── Sidecar State ────────────────────────────────────────────────────────────
struct OllamaProcess(Mutex<Option<CommandChild>>);

// ─── Web Search Command ─────────────────────────────────────────────────────

/// Perform a DuckDuckGo search and return up to 3 result snippets.
/// Runs on a blocking thread; returns an empty Vec on any failure so the
/// frontend can fall back to a plain Ollama chat gracefully.
#[tauri::command]
fn web_search(query: String) -> Vec<String> {
    let url = format!(
        "https://html.duckduckgo.com/html/?q={}",
        urlencoding::encode(&query)
    );

    let result: Result<Vec<String>, Box<dyn std::error::Error>> = (|| {
        let client = reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0")
            .timeout(std::time::Duration::from_secs(8))
            .build()?;

        let html = client.get(&url).send()?.text()?;
        let document = Html::parse_document(&html);

        // DuckDuckGo HTML uses .result__snippet for the description blurbs
        let snippet_sel = Selector::parse(".result__snippet").unwrap();
        let snippets: Vec<String> = document
            .select(&snippet_sel)
            .take(3)
            .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(snippets)
    })();

    match result {
        Ok(snippets) => {
            eprintln!("[BrainBox] Web search for {:?} returned {} snippet(s).", query, snippets.len());
            snippets
        }
        Err(e) => {
            eprintln!("[BrainBox] Web search failed: {e}");
            vec![]
        }
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn ollama_running(state: State<'_, OllamaProcess>) -> bool {
    state.0.lock().map(|g| g.is_some()).unwrap_or(false)
}

#[tauri::command]
fn clear_app_data(app: tauri::AppHandle) -> Result<(), String> {
    let models_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {e}"))?
        .join("models");

    if models_dir.exists() {
        std::fs::remove_dir_all(&models_dir)
            .map_err(|e| format!("Failed to delete models directory: {e}"))?;
        eprintln!("[BrainBox] Models directory wiped: {}", models_dir.display());
    }
    Ok(())
}


// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(OllamaProcess(Mutex::new(None)))
        .setup(|app| {
            let models_dir = app.path().app_data_dir().unwrap().join("models");
            std::fs::create_dir_all(&models_dir).ok();
            let models_path = models_dir.to_str().unwrap().to_string();
            eprintln!("[BrainBox] OLLAMA_MODELS sandbox: {models_path}");

            let handle = app.handle().clone();

            // Spawn the Ollama sidecar — Ollama handles GPU/CPU auto-detection.
            // On Windows we prepend the bundled lib/ollama directory to PATH so
            // the CUDA / Vulkan DLLs packed as resources are found at start-up.
            tauri::async_runtime::spawn(async move {
                let shell = handle.shell();

                // Base command with the two always-required env vars
                #[allow(unused_mut)]
                let mut sidecar = shell
                    .sidecar("ollama")
                    .expect("Failed to create sidecar handle")
                    .args(["serve"])
                    .env("OLLAMA_ORIGINS", "*")          // allow Tauri WebView
                    .env("OLLAMA_MODELS", &models_path); // sandboxed storage

                // ── Windows: make bundled DLLs discoverable via PATH ──────────
                #[cfg(target_os = "windows")]
                {
                    // Tauri copies "resources" into the same dir as the exe.
                    // resource_dir() points there at runtime.
                    let lib_dir = handle
                        .path()
                        .resource_dir()
                        .map(|p| p.join("lib").join("ollama"))
                        .ok();

                    if let Some(ref lib_path) = lib_dir {
                        eprintln!("[BrainBox] Windows DLL dir: {}", lib_path.display());
                    }

                    let existing_path = std::env::var("PATH").unwrap_or_default();
                    let effective_path = if let Some(lib_path) = lib_dir {
                        format!("{};{existing_path}", lib_path.display())
                    } else {
                        existing_path
                    };
                    sidecar = sidecar.env("PATH", &effective_path);
                }

                match sidecar.spawn() {
                    Ok((_rx, child)) => {
                        let state = handle.state::<OllamaProcess>();
                        *state.0.lock().unwrap() = Some(child);
                        eprintln!("[BrainBox] Ollama sidecar ignited! 🔥");
                    }
                    Err(e) => eprintln!("[BrainBox] Ignition failure: {e}"),
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ollama_running, clear_app_data, web_search])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
