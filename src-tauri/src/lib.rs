use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;
use tauri::Manager;

const MAX_PROJECT_BYTES: u64 = 50 * 1024 * 1024;
const MAX_AI_FILE_BYTES: usize = 2 * 1024 * 1024;
const MAX_AI_FILES: usize = 120;
const API_KEY_FILE: &str = "ai-keys.json";

fn api_key_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录: {error}"))?;
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建应用数据目录: {error}"))?;
    Ok(directory.join(API_KEY_FILE))
}

fn read_api_keys_from(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content =
        fs::read_to_string(path).map_err(|error| format!("无法读取 API Key 文件: {error}"))?;
    if content.trim().is_empty() {
        return Ok(HashMap::new());
    }
    match serde_json::from_str(&content) {
        Ok(keys) => Ok(keys),
        Err(error) => {
            eprintln!("忽略损坏的 API Key 文件 {}: {error}", path.display());
            Ok(HashMap::new())
        }
    }
}

fn write_api_keys_to(path: &Path, keys: &HashMap<String, String>) -> Result<(), String> {
    let content =
        serde_json::to_vec_pretty(keys).map_err(|error| format!("无法序列化 API Key: {error}"))?;
    fs::write(path, content).map_err(|error| format!("无法写入 API Key: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn read_api_keys(app: &tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    read_api_keys_from(&api_key_path(app)?)
}

fn write_api_keys(app: &tauri::AppHandle, keys: &HashMap<String, String>) -> Result<(), String> {
    write_api_keys_to(&api_key_path(app)?, keys)
}

fn stored_api_key(app: &tauri::AppHandle, profile: &str) -> Result<Option<String>, String> {
    let keys = read_api_keys(app)?;
    Ok(keys.get(profile).cloned().filter(|key| !key.is_empty()))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件: {error}"))?;
    if metadata.len() > MAX_PROJECT_BYTES {
        return Err("文件过大，无法打开".to_string());
    }
    fs::read_to_string(&path).map_err(|error| format!("无法读取文件: {error}"))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if content.len() as u64 > MAX_PROJECT_BYTES {
        return Err("内容过大，无法保存".to_string());
    }
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建目录: {error}"))?;
    }
    fs::write(&path, content).map_err(|error| format!("无法写入文件: {error}"))
}

#[tauri::command]
fn has_api_key(app: tauri::AppHandle, profile: String) -> Result<bool, String> {
    Ok(stored_api_key(&app, &profile)?.is_some())
}

#[tauri::command]
fn save_api_key(app: tauri::AppHandle, profile: String, key: String) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API Key 不能为空".to_string());
    }
    let mut keys = read_api_keys(&app)?;
    keys.insert(profile, trimmed.to_string());
    write_api_keys(&app, &keys)
}

#[tauri::command]
fn delete_api_key(app: tauri::AppHandle, profile: String) -> Result<(), String> {
    let mut keys = read_api_keys(&app)?;
    keys.remove(&profile);
    if keys.is_empty() {
        let path = api_key_path(&app)?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| format!("无法删除 API Key: {error}"))?;
        }
        return Ok(());
    }
    write_api_keys(&app, &keys)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatRequest {
    profile: String,
    base_url: String,
    model: String,
    messages: Vec<Value>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    tools: Option<Vec<Value>>,
    tool_choice: Option<Value>,
}

#[derive(Serialize)]
struct ChatResult {
    message: Value,
    usage: Value,
}

fn is_local_endpoint(base_url: &str) -> bool {
    base_url.contains("localhost") || base_url.contains("127.0.0.1") || base_url.contains("[::1]")
}

fn chat_completions_url(base_url: &str) -> Result<String, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("API Base URL 未配置".to_string());
    }
    if trimmed.ends_with("/chat/completions") {
        return Ok(trimmed.to_string());
    }
    Ok(format!("{trimmed}/chat/completions"))
}

fn truncate_body(body: &str) -> String {
    body.chars().take(1200).collect()
}

async fn perform_chat_completion(
    request: ChatRequest,
    api_key: Option<String>,
) -> Result<ChatResult, String> {
    if request.model.trim().is_empty() {
        return Err("模型名称未配置".to_string());
    }

    let url = chat_completions_url(&request.base_url)?;

    let mut body = json!({
        "model": request.model,
        "messages": request.messages,
        "stream": false
    });

    if let Some(temperature) = request.temperature {
        body["temperature"] = json!(temperature);
    }
    if let Some(max_tokens) = request.max_tokens {
        body["max_tokens"] = json!(max_tokens);
    }
    if let Some(tools) = request.tools
        && !tools.is_empty()
    {
        body["tools"] = json!(tools);
        body["tool_choice"] = request.tool_choice.unwrap_or_else(|| json!("auto"));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| format!("无法创建网络客户端: {error}"))?;

    let mut builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json");

    if let Some(key) = api_key {
        builder = builder.bearer_auth(key);
    }

    let response = builder
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("模型请求失败: {error}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("无法读取模型响应: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "模型请求失败 ({}): {}",
            status.as_u16(),
            truncate_body(&text)
        ));
    }

    let value: Value =
        serde_json::from_str(&text).map_err(|error| format!("模型响应不是有效 JSON: {error}"))?;
    let message = value
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .cloned()
        .or_else(|| value.get("message").cloned())
        .ok_or_else(|| format!("模型响应缺少 message: {}", truncate_body(&text)))?;

    Ok(ChatResult {
        message,
        usage: value.get("usage").cloned().unwrap_or(Value::Null),
    })
}

#[tauri::command]
async fn chat_completion(
    app: tauri::AppHandle,
    request: ChatRequest,
) -> Result<ChatResult, String> {
    let local = is_local_endpoint(&request.base_url);
    let api_key = if local {
        None
    } else {
        stored_api_key(&app, &request.profile)?
    };
    if api_key.is_none() && !local {
        return Err("尚未配置 API Key，请先在设置中填写".to_string());
    }
    perform_chat_completion(request, api_key).await
}

#[derive(Deserialize)]
struct ProjectFileInput {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileEntry {
    path: String,
    size: u64,
    is_dir: bool,
}

const MAX_LIST_FILES: usize = 2000;
const MAX_LIST_DEPTH: usize = 8;

fn is_ignored_project_entry(name: &str) -> bool {
    matches!(
        name,
        ".git" | ".DS_Store" | "node_modules" | "dist" | "build" | "target"
    ) || name.starts_with('.')
}

fn list_project_files_recursive(
    root: &Path,
    relative: &Path,
    depth: usize,
    entries: &mut Vec<ProjectFileEntry>,
) -> Result<(), String> {
    if entries.len() >= MAX_LIST_FILES || depth > MAX_LIST_DEPTH {
        return Ok(());
    }
    let directory = root.join(relative);
    let read_dir = fs::read_dir(&directory)
        .map_err(|error| format!("无法读取目录 {}: {error}", directory.to_string_lossy()))?;
    let mut children: Vec<_> = read_dir.filter_map(|entry| entry.ok()).collect();
    children.sort_by(|a, b| {
        let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_dir
            .cmp(&a_dir)
            .then_with(|| a.file_name().cmp(&b.file_name()))
    });
    for child in children {
        if entries.len() >= MAX_LIST_FILES {
            break;
        }
        let name = child.file_name();
        let name_text = name.to_string_lossy();
        if is_ignored_project_entry(&name_text) {
            continue;
        }
        let child_relative = relative.join(&name);
        let file_type = child
            .file_type()
            .map_err(|error| format!("无法读取文件信息: {error}"))?;
        if file_type.is_symlink() {
            continue;
        }
        let metadata = child
            .metadata()
            .map_err(|error| format!("无法读取文件信息: {error}"))?;
        let is_dir = file_type.is_dir();
        entries.push(ProjectFileEntry {
            path: child_relative.to_string_lossy().replace('\\', "/"),
            size: if is_dir { 0 } else { metadata.len() },
            is_dir,
        });
        if is_dir {
            list_project_files_recursive(root, &child_relative, depth + 1, entries)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn list_project_files(root: String) -> Result<Vec<ProjectFileEntry>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err("项目文件夹不存在或不是目录".to_string());
    }
    let mut entries = Vec::new();
    list_project_files_recursive(&root_path, Path::new(""), 0, &mut entries)?;
    Ok(entries)
}

#[tauri::command]
fn write_build_files(root: String, files: Vec<ProjectFileInput>) -> Result<String, String> {
    if files.is_empty() {
        return Err("没有可写入的文件".to_string());
    }
    if files.len() > MAX_AI_FILES {
        return Err(format!("文件数量过多（最多 {MAX_AI_FILES} 个）"));
    }
    let root_path = PathBuf::from(&root);
    if !root_path.exists() {
        fs::create_dir_all(&root_path).map_err(|error| format!("无法创建项目文件夹: {error}"))?;
    } else if !root_path.is_dir() {
        return Err("输出路径不是文件夹".to_string());
    }

    let mut total_bytes = 0usize;
    for file in &files {
        if file.content.len() > MAX_AI_FILE_BYTES {
            return Err(format!("文件过大: {}", file.path));
        }
        total_bytes += file.content.len();
        if total_bytes > MAX_PROJECT_BYTES as usize {
            return Err("生成内容总大小超出限制".to_string());
        }
        let relative = safe_relative_path(&file.path)?;
        let target = root_path.join(relative);
        if let Some(parent_dir) = target.parent() {
            fs::create_dir_all(parent_dir)
                .map_err(|error| format!("无法创建目录 {}: {error}", file.path))?;
        }
        fs::write(&target, &file.content)
            .map_err(|error| format!("无法写入文件 {}: {error}", file.path))?;
    }
    Ok(root_path.to_string_lossy().to_string())
}

fn safe_relative_path(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("生成的文件路径为空".to_string());
    }
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(format!("不允许绝对路径: {path}"));
    }
    let mut relative = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => relative.push(part),
            _ => return Err(format!("不允许的路径片段: {path}")),
        }
    }
    if relative.as_os_str().is_empty() {
        return Err("生成的文件路径为空".to_string());
    }
    Ok(relative)
}

fn validate_folder_name(folder: &str) -> Result<(), String> {
    if folder.trim().is_empty() {
        return Err("项目文件夹名称不能为空".to_string());
    }
    let candidate = Path::new(folder);
    if candidate.is_absolute() {
        return Err("项目文件夹名称不能是绝对路径".to_string());
    }
    let mut components = candidate.components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(()),
        _ => Err("项目文件夹名称不能包含路径分隔符".to_string()),
    }
}

#[tauri::command]
fn project_folder_available(parent: String, folder: String) -> Result<bool, String> {
    validate_folder_name(&folder)?;
    let root = Path::new(&parent).join(&folder);
    if !root.exists() {
        return Ok(true);
    }
    let mut entries =
        fs::read_dir(&root).map_err(|error| format!("无法读取目标文件夹: {error}"))?;
    Ok(entries.next().is_none())
}

#[tauri::command]
fn write_project_files(
    parent: String,
    folder: String,
    files: Vec<ProjectFileInput>,
) -> Result<String, String> {
    validate_folder_name(&folder)?;
    if files.is_empty() {
        return Err("没有可写入的文件".to_string());
    }
    if files.len() > MAX_AI_FILES {
        return Err(format!("文件数量过多（最多 {MAX_AI_FILES} 个）"));
    }

    let root = Path::new(&parent).join(&folder);
    if root.exists() {
        let non_empty = fs::read_dir(&root)
            .map_err(|error| format!("无法读取目标文件夹: {error}"))?
            .next()
            .is_some();
        if non_empty {
            return Err(format!(
                "目标文件夹已存在且不为空：{}",
                root.to_string_lossy()
            ));
        }
    }
    fs::create_dir_all(&root).map_err(|error| format!("无法创建项目文件夹: {error}"))?;

    let mut total_bytes = 0usize;
    for file in &files {
        if file.content.len() > MAX_AI_FILE_BYTES {
            return Err(format!("文件过大: {}", file.path));
        }
        total_bytes += file.content.len();
        if total_bytes > MAX_PROJECT_BYTES as usize {
            return Err("生成内容总大小超出限制".to_string());
        }

        let relative = safe_relative_path(&file.path)?;
        let target = root.join(relative);
        if let Some(parent_dir) = target.parent() {
            fs::create_dir_all(parent_dir)
                .map_err(|error| format!("无法创建目录 {}: {error}", file.path))?;
        }
        fs::write(&target, &file.content)
            .map_err(|error| format!("无法写入文件 {}: {error}", file.path))?;
    }

    Ok(root.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            has_api_key,
            save_api_key,
            delete_api_key,
            chat_completion,
            project_folder_available,
            write_project_files,
            list_project_files,
            write_build_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn rejects_unsafe_relative_paths() {
        assert!(safe_relative_path("src/main.js").is_ok());
        assert!(safe_relative_path("../secret").is_err());
        assert!(safe_relative_path("/etc/passwd").is_err());
        assert!(safe_relative_path("src/../../secret").is_err());
    }

    #[test]
    fn validates_project_folder_names() {
        assert!(validate_folder_name("my-site").is_ok());
        assert!(validate_folder_name("我的站点").is_ok());
        assert!(validate_folder_name("../outside").is_err());
        assert!(validate_folder_name("a/b").is_err());
        assert!(validate_folder_name("").is_err());
    }

    #[test]
    fn writes_generated_project_files() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let parent = std::env::temp_dir().join(format!("spark-pages-test-{stamp}"));
        fs::create_dir_all(&parent).unwrap();

        let root = write_project_files(
            parent.to_string_lossy().to_string(),
            "demo".to_string(),
            vec![
                ProjectFileInput {
                    path: "package.json".to_string(),
                    content: "{}".to_string(),
                },
                ProjectFileInput {
                    path: "src/main.js".to_string(),
                    content: "console.log('ok')".to_string(),
                },
            ],
        )
        .unwrap();

        assert!(Path::new(&root).join("package.json").exists());
        assert!(Path::new(&root).join("src/main.js").exists());

        let second = write_project_files(
            parent.to_string_lossy().to_string(),
            "demo".to_string(),
            vec![ProjectFileInput {
                path: "index.html".to_string(),
                content: "x".to_string(),
            }],
        );
        assert!(second.is_err());

        fs::remove_dir_all(parent).unwrap();
    }

    #[test]
    fn calls_local_openai_compatible_endpoint() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0u8; 8192];
            let _ = stream.read(&mut buffer);
            let body = r#"{"choices":[{"message":{"role":"assistant","content":"hello"}}]}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let result = tauri::async_runtime::block_on(perform_chat_completion(
            ChatRequest {
                profile: "test".to_string(),
                base_url: format!("http://127.0.0.1:{port}/v1"),
                model: "mock".to_string(),
                messages: vec![json!({"role": "user", "content": "hi"})],
                temperature: Some(0.0),
                max_tokens: Some(16),
                tools: None,
                tool_choice: None,
            },
            None,
        ))
        .unwrap();

        assert_eq!(result.message["content"], "hello");
        handle.join().unwrap();
    }

    #[test]
    fn normalizes_chat_completion_urls() {
        assert_eq!(
            chat_completions_url("https://api.example.com/v1").unwrap(),
            "https://api.example.com/v1/chat/completions"
        );
        assert_eq!(
            chat_completions_url("https://api.example.com/v1/chat/completions").unwrap(),
            "https://api.example.com/v1/chat/completions"
        );
    }
    #[test]
    fn forwards_tools_and_parses_tool_calls() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::sync::mpsc;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (sender, receiver) = mpsc::channel();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = vec![0u8; 16384];
            let read = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..read]).to_string();
            sender.send(request).unwrap();
            let body = r#"{"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_page","arguments":"{}"}}]}}]}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let result = tauri::async_runtime::block_on(perform_chat_completion(
            ChatRequest {
                profile: "test".to_string(),
                base_url: format!("http://127.0.0.1:{port}/v1"),
                model: "mock".to_string(),
                messages: vec![json!({"role": "user", "content": "hi"})],
                temperature: Some(0.0),
                max_tokens: Some(64),
                tools: Some(vec![json!({
                    "type": "function",
                    "function": {
                        "name": "get_page",
                        "description": "read page",
                        "parameters": {"type": "object", "properties": {}}
                    }
                })]),
                tool_choice: None,
            },
            None,
        ))
        .unwrap();

        let request = receiver.recv().unwrap();
        assert!(request.contains("\"tools\""));
        assert!(request.contains("\"get_page\""));
        assert_eq!(
            result.message["tool_calls"][0]["function"]["name"],
            "get_page"
        );
        handle.join().unwrap();
    }
    #[test]
    fn lists_and_writes_build_files() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("spark-pages-files-{stamp}"));
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("index.html"), "<html></html>").unwrap();
        fs::write(root.join("src/main.js"), "console.log(1)").unwrap();
        fs::write(root.join("node_modules/pkg/index.js"), "x").unwrap();

        let listed = list_project_files(root.to_string_lossy().to_string()).unwrap();
        let paths: Vec<&str> = listed.iter().map(|entry| entry.path.as_str()).collect();
        assert!(paths.contains(&"index.html"));
        assert!(paths.contains(&"src"));
        assert!(paths.contains(&"src/main.js"));
        assert!(!paths.iter().any(|path| path.contains("node_modules")));
        let serialized = serde_json::to_value(&listed[0]).unwrap();
        assert!(serialized.get("isDir").is_some());

        write_build_files(
            root.to_string_lossy().to_string(),
            vec![
                ProjectFileInput {
                    path: "index.html".to_string(),
                    content: "<html>updated</html>".to_string(),
                },
                ProjectFileInput {
                    path: "src/app.css".to_string(),
                    content: "body{}".to_string(),
                },
            ],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(root.join("index.html")).unwrap(),
            "<html>updated</html>"
        );
        assert!(root.join("src/app.css").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stores_api_keys_in_app_data_with_private_permissions() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("spark-pages-keys-{stamp}"));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("ai-keys.json");
        let mut keys = HashMap::new();
        keys.insert("default".to_string(), "sk-test".to_string());
        write_api_keys_to(&path, &keys).unwrap();

        let read = read_api_keys_from(&path).unwrap();
        assert_eq!(read.get("default").map(String::as_str), Some("sk-test"));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }

        fs::write(&path, "not-json").unwrap();
        assert!(read_api_keys_from(&path).unwrap().is_empty());

        fs::remove_dir_all(directory).unwrap();
    }
}
