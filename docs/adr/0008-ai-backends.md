# ADR-0008: Choice of AI backend, including a local model server

- **Status:** Accepted (amends ADR-0004)
- **Date:** 2026-10-16

## Context

ADR-0004 made Gemini Nano, through Chrome's Prompt API, the only model. In practice that leaves most users without AI:

- Chrome only offers the model with 22 GB free disk and either a GPU with more than 4 GB VRAM or 16 GB RAM with 4+ cores. Typical student laptops (8 GB RAM) get `unavailable`. So does the primary development machine.
- The model is small, and it only exists in Chrome.

Small open models served on the user's own machine run on much less hardware. A 3–8B model quantised to 4 bits needs about 3–6 GB of RAM, so it runs on an 8 GB laptop and answers better than Nano. Ollama, LM Studio and llama.cpp's `llama-server` all speak the OpenAI chat-completions API (`POST /v1/chat/completions`, `GET /v1/models`). They also accept a JSON Schema through `response_format`, the counterpart of the Prompt API's `responseConstraint`.

Some users have no capable machine but would accept a hosted model under their own key. OpenRouter serves many models behind the same API. It also lets a request exclude providers that store prompts (`provider.data_collection: "deny"`).

Verified on 2026-10-16:

- Ollama's default allowed origins (`envconfig/config.go`) are localhost, 127.0.0.1, 0.0.0.0, `app://`, `file://`, `tauri://` and `vscode-webview(-file)://`. `chrome-extension://` is not in the list, so Ollama answers an extension with 403 unless `OLLAMA_ORIGINS` includes it.
- Chrome's Local Network Access post (developer.chrome.com/blog/local-network-access) does not mention extension pages. An extension page that holds a host permission for the target is not subject to CORS.

## Decision

1. **Backends.** Settings offers four. The choice lives in `chrome.storage.local` under `ai:backend`, per browser and never per document.

   | Backend                                    | Default | Paper text leaves the computer? |
   | ------------------------------------------ | ------- | ------------------------------- |
   | Chrome built-in (Gemini Nano)              | yes     | no                              |
   | Local server: Ollama, LM Studio, llama.cpp |         | no                              |
   | OpenRouter, with the user's own key        |         | only if the user allows it      |
   | Off                                        |         | no                              |

2. **One adapter for every server.** `openAiCompatible()` (`src/adapters/llm/openai-compatible.ts`) implements `LlmPort` over the chat-completions API, using the same prompts, schemas and post-filter as `geminiNano()`. ADR-0003 holds whatever the model: every answer passes `filterExplanation`/`parseTopicAnswer`, and `LlmPort` still has no path to a `TextEdit`. It is the only file allowed to call `fetch`, and ESLint keeps it that way.

3. **Only these addresses.** `src/core/llm/backend.ts` accepts `http(s)://localhost` and `http(s)://127.0.0.1` on any port, plus `https://openrouter.ai`. The extension-page CSP's `connect-src` lists exactly these, so a mistake in the code still cannot reach anything else. Other hosted APIs and servers elsewhere on the LAN are out of scope until someone needs them; adding one means changing both lists and this ADR.

4. **No network capability until the user asks.** The hosts are `optional_host_permissions`. Lemma requests the one it needs from the Connect click, as the first call in the click handler so the user gesture still counts. A fresh install makes no requests, and the e2e no-network test still applies to it.

5. **Remote models don't see the paper by default.** With OpenRouter, Ask Lemma questions are sent, since they contain no document text (ADR-0007). "Explain for my text", role suggestions and compile-log explanations carry the user's text or log lines, and the adapter refuses them (`blocked`) unless the user ticks "Send snippets of my paper to OpenRouter". Requests to OpenRouter also carry `provider: { data_collection: "deny", require_parameters: true }`.

6. **Visible.** The status bar names the backend ("AI: Ollama", "AI: OpenRouter"), so a remote model is never mistaken for an on-device one.

7. **Failures name their cause.** Unreachable server, Ollama's 403 (with the `OLLAMA_ORIGINS` fix), a refused key, a denied permission and a missing model each get their own message in Settings.

## Alternatives considered

- **Companion app over native messaging:** keeps network permissions at zero, but needs signed installers for three operating systems, per-browser host manifests and model management. Too much for a volunteer project; it can come later behind the same `LlmPort`.
- **A model inside the extension (WebLLM, transformers.js):** a 1–2 GB download into the browser, competing with Overleaf for GPU and memory. ADR-0004 already rejected it.
- **Any URL the user types:** simple, but the CSP would have to allow all of `https:`, and a typo could send paper text somewhere unintended.
- **Strip the `Origin` header with `declarativeNetRequest` so Ollama works unconfigured:** another permission, and it quietly defeats a protection the user's server chose to have.

## Consequences

- The README's promise becomes "your paper never leaves your computer unless you choose a remote model and allow it", and the store description has to say the same.
- The API key sits unencrypted in `chrome.storage.local`, like any bring-your-own-key extension. Settings says so.
- Ollama users must set `OLLAMA_ORIGINS` once. The README and the 403 message both give the exact command.
- Models vary. Answer quality depends on the user's choice, so the README suggests defaults, and the post-filter is the safety net whatever runs.
