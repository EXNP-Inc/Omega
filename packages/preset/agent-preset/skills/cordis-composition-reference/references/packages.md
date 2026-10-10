# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; query `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) for the mounted schema. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-acp` | yes | Automation-only Agent Client Protocol server for driving Omega agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-api-account-controller` | no | Expose safe account operations over authenticated Remote |
| `@omega-ai/dsh-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@omega-ai/dsh-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@omega-ai/dsh-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@omega-ai/dsh-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@omega-ai/dsh-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@omega-ai/dsh-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@omega-ai/dsh-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@omega-ai/dsh-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-attachment-local` | yes | Private content-addressed DSH_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@omega-ai/dsh-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@omega-ai/dsh-plugin-manager` | yes | Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-acp-app` | no | The dsh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over dsh-base |
| `@omega-ai/dsh-headless` | yes | The dsh one-shot bundle: a direct core Agent/Session runner over dsh-base with no Host, HTTP, or browser layer |
| `@omega-ai/dsh-sdk-app` | yes | The dsh SDK profile bundle: stdio JSON-RPC serving and process lifecycle over dsh-base |
| `@omega-ai/dsh-web-app` | yes | The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue plugin (frontend dist serving, web-surface prompt, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@omega-ai/dsh-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@omega-ai/dsh-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@omega-ai/dsh-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@omega-ai/dsh-client-modules` | no | Client module system, dual-face: node half composes the __DSH_BOOT__ entry graph (incremental dsh.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@omega-ai/dsh-client-product-analytics` | yes | Desktop product event collection and authenticated Host reporting |
| `@omega-ai/dsh-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@omega-ai/dsh-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@omega-ai/dsh-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@omega-ai/dsh-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@omega-ai/dsh-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@omega-ai/dsh-client-ui-brand-official` | no | Official Omega brand occupants for the Web client's sidebar slots |
| `@omega-ai/dsh-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@omega-ai/dsh-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@omega-ai/dsh-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@omega-ai/dsh-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@omega-ai/dsh-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@omega-ai/dsh-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@omega-ai/dsh-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@omega-ai/dsh-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@omega-ai/dsh-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@omega-ai/dsh-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@omega-ai/dsh-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@omega-ai/dsh-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@omega-ai/dsh-client-ui-open-in-app` | no | Web "Open In..." controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file |
| `@omega-ai/dsh-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@omega-ai/dsh-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@omega-ai/dsh-client-ui-plugin-manager` | yes | Plugin management for the dsh web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@omega-ai/dsh-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@omega-ai/dsh-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@omega-ai/dsh-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@omega-ai/dsh-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@omega-ai/dsh-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@omega-ai/dsh-client-ui-settings-account` | yes | Manage Omega login and open Platform billing pages |
| `@omega-ai/dsh-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the dsh web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@omega-ai/dsh-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@omega-ai/dsh-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@omega-ai/dsh-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@omega-ai/dsh-client-ui-settings-plugins` | no | Built-in plugins settings section for the dsh web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@omega-ai/dsh-client-ui-settings-session-log` | no | General settings control for Session-log upload with Omega API requests |
| `@omega-ai/dsh-client-ui-settings-shell` | no | Settings page of the shell executor on the dsh web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@omega-ai/dsh-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the dsh web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@omega-ai/dsh-client-ui-settings-web-search` | no | Settings page of the Omega web-search provider on the dsh web client's Plugins page: its API key, endpoint, and per-request search budget |
| `@omega-ai/dsh-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@omega-ai/dsh-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@omega-ai/dsh-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@omega-ai/dsh-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@omega-ai/dsh-client-ui-sidebar-files` | no | Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar |
| `@omega-ai/dsh-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@omega-ai/dsh-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@omega-ai/dsh-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@omega-ai/dsh-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@omega-ai/dsh-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row |
| `@omega-ai/dsh-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@omega-ai/dsh-client-ui-trajectory` | no | Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service) |
| `@omega-ai/dsh-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@omega-ai/dsh-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for dsh web |
| `@omega-ai/dsh-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@omega-ai/dsh-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the Omega |
| `@omega-ai/dsh-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@omega-ai/dsh-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@omega-ai/dsh-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@omega-ai/dsh-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@omega-ai/dsh-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@omega-ai/dsh-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the Omega |
| `@omega-ai/dsh-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@omega-ai/dsh-agent-loop` | yes | The concrete agent loop plugin for the Omega |
| `@omega-ai/dsh-agent-tool-presentation` | yes | Agent-plane presentation selector: composes one agent's tools as PTC mode, native, or both |
| `@omega-ai/dsh-session` | no | Event-sourced session store for the Omega |
| `@omega-ai/dsh-system-prompt` | yes | System prompt assembly registry for the Omega |
| `@omega-ai/dsh-tools` | yes | Tool registry and execution pipeline for the Omega |

## credentials

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@omega-ai/dsh-credentials-local` | yes | File-backed credentials provider ($DSH_HOME/.env under the live process environment) for the Omega |
| `@omega-ai/dsh-omega-account-platform` | yes | Authorize Omega accounts through browser PKCE |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-tool-present` | yes | Explicit workspace file delivery declarations for the Omega |
| `@omega-ai/dsh-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the Omega |

## document

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-office-to-pdf` | yes | Shared Office-to-PDF conversion with bounded queues and caching |

## experimental

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-experimental-agent-team` | yes | Implicit-root Agent Teams roster, durable peer mailbox, and shared task DAG |
| `@omega-ai/dsh-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@omega-ai/dsh-experimental-auto-review` | no | Per-tool LLM authorization review for the Omega Auto permission preset |
| `@omega-ai/dsh-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@omega-ai/dsh-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@omega-ai/dsh-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@omega-ai/dsh-experimental-claude-code-mods` | yes | Experimental bridge: load Claude Code mods (hooks modules) and run their hook chains on Omega extension points |
| `@omega-ai/dsh-experimental-client-ui-agent-team` | no | Web Agent Teams roster, task board, and teammate navigation |
| `@omega-ai/dsh-experimental-client-ui-claude-code-mods` | no | Web band above the prompt for Claude Code mods: draws each session's mod tree and sends button presses back to the bridge |
| `@omega-ai/dsh-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@omega-ai/dsh-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@omega-ai/dsh-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@omega-ai/dsh-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@omega-ai/dsh-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the Omega PTC execution seam |
| `@omega-ai/dsh-experimental-session-inspector` | no | Experimental virtualized Session log and live Chat group/node inspectors |
| `@omega-ai/dsh-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@omega-ai/dsh-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@omega-ai/dsh-experimental-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |

## extensions

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@omega-ai/dsh-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@omega-ai/dsh-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@omega-ai/dsh-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@omega-ai/dsh-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-fs-local` | yes | Local-filesystem implementation of the Omega filesystem seam (ctx.fs) |
| `@omega-ai/dsh-fs-observation-policy` | no | File-context policy plugin for the Omega — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@omega-ai/dsh-fs-sandbox` | yes | Sandbox-enforcing implementation of the Omega filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@omega-ai/dsh-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the Omega filesystem seam (ctx.fs) |
| `@omega-ai/dsh-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@omega-ai/dsh-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@omega-ai/dsh-goal` | yes | Event-sourced same-session goal state and lifecycle service for the Omega |
| `@omega-ai/dsh-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@omega-ai/dsh-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@omega-ai/dsh-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## hooks

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the Omega interception seams |
| `@omega-ai/dsh-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the Omega interception seams |

## host

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the Omega web GUI host |
| `@omega-ai/dsh-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@omega-ai/dsh-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the Omega web GUI host |
| `@omega-ai/dsh-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@omega-ai/dsh-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@omega-ai/dsh-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@omega-ai/dsh-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@omega-ai/dsh-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts |

## interaction

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-commands` | no | Plugin-owned human command registry for Omega UIs |
| `@omega-ai/dsh-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the Omega: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@omega-ai/dsh-tool-ask-user` | yes | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@omega-ai/dsh-user-approval` | yes | User-approval seam (ctx.approval) for the Omega: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@omega-ai/dsh-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-jobs-local` | yes | Process-local implementation of the Omega background job registry seam |
| `@omega-ai/dsh-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-llm` | no | Provider-neutral LLM service interface for the Omega |
| `@omega-ai/dsh-llm-omega-account` | yes | Omega account provider authentication and discovery |
| `@omega-ai/dsh-llm-omega-api-key` | yes | Omega api-key provider authentication and discovery |
| `@omega-ai/dsh-llm-pi-ai` | yes | pi-ai-backed Omega adapter for the Omega LLM seam (design-verification twin of dsh-llm-omega) |
| `@omega-ai/dsh-llm-retry` | yes | Provider-routed LLM request retry policy for the Omega |
| `@omega-ai/dsh-omega-llm-api-extensions` | no | Additive request-field registry for the official Omega LLM API adapter |
| `@omega-ai/dsh-plugin-package-inventory-omega` | yes | Active Loader-backed plugin package inventory for official Omega LLM API requests |
| `@omega-ai/dsh-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the Omega |

## lsp

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the Omega — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@omega-ai/dsh-lsp-stdio` | yes | Generic stdio language-server provider for the Omega LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@omega-ai/dsh-tool-lsp` | yes | Model-facing lsp tool over the Omega LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@omega-ai/dsh-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## plan

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@omega-ai/dsh-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@omega-ai/dsh-persona` | yes | Composition-authored deployment persona section for the Omega |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-ptc-runtime-node` | yes | Sandboxed Node process implementation of the Omega PTC execution capability |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-sandbox-local` | yes | Local process-sandbox backends for the Omega sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@omega-ai/dsh-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-schedule` | yes | Host-wide durable reminders with shared management and original-Session delivery |
| `@omega-ai/dsh-tool-schedule` | no | Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, schedule_delete) over the Host ctx.schedule service |

## sdk

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process Omega SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@omega-ai/dsh-session-log-omega` | yes | Incremental lossless session-log request extension for the official Omega LLM API |
| `@omega-ai/dsh-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the Omega |
| `@omega-ai/dsh-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@omega-ai/dsh-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@omega-ai/dsh-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the Omega |
| `@omega-ai/dsh-session-telemetry-otel` | yes | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests |
| `@omega-ai/dsh-session-title` | yes | Log-backed session title service and provider registry for the Omega |
| `@omega-ai/dsh-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for Omega session titles |
| `@omega-ai/dsh-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for Omega session titles |
| `@omega-ai/dsh-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the Omega |

## session-query

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-session-log-export` | yes | Web Session-log export command and shared download dialog |
| `@omega-ai/dsh-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |
| `@omega-ai/dsh-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |

## settings

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-settings` | no | Abstract user-settings seam (ctx.settings) for the Omega |

## shell

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-bash-local` | yes | Local-subprocess implementation of the Omega bash executor seam |
| `@omega-ai/dsh-bash-sandbox` | yes | Sandbox-consuming implementation of the Omega bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@omega-ai/dsh-pwsh-local` | yes | Local PowerShell implementation of the Omega bash executor seam |
| `@omega-ai/dsh-pwsh-sandbox` | yes | Sandbox-consuming implementation of the Omega PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@omega-ai/dsh-shell-env` | yes | Tool-independent managed DSH_* shell environment registry |
| `@omega-ai/dsh-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@omega-ai/dsh-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@omega-ai/dsh-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@omega-ai/dsh-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-skill` | yes | Agent skill provider registry for the Omega |
| `@omega-ai/dsh-skill-badge` | no | Bundled dsh badge skill provider for Omega |
| `@omega-ai/dsh-skill-filesystem` | yes | Local filesystem skill provider for the Omega |
| `@omega-ai/dsh-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and structural checks |
| `@omega-ai/dsh-tool-skill` | yes | Model-facing skill loading tool for the Omega |
| `@omega-ai/dsh-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-spill-local` | yes | Local-filesystem implementation of the Omega spill storage seam (private session-scoped files) |
| `@omega-ai/dsh-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@omega-ai/dsh-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@omega-ai/dsh-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@omega-ai/dsh-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the Omega |
| `@omega-ai/dsh-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the Omega |
| `@omega-ai/dsh-storage-json` | yes | JSON file KV storage backend for the Omega storage hub |
| `@omega-ai/dsh-storage-sqlite` | yes | SQLite storage backend (kv facet) for the Omega storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@omega-ai/dsh-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@omega-ai/dsh-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@omega-ai/dsh-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@omega-ai/dsh-subagent-dsh-sdk` | yes | Out-of-process SDK subagent backend: drives a child Omega runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@omega-ai/dsh-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@omega-ai/dsh-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@omega-ai/dsh-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@omega-ai/dsh-tool-subagent-control` | no | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-subprocess-local` | no | Local-subprocess implementation of the Omega subprocess seam |

## telemetry

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-otel` | no | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels |

## terminal

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-terminal` | no | Persistent PTY session seam for the Omega — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@omega-ai/dsh-terminal-bash` | yes | Persistent shell PTY backend over the Omega subprocess terminal primitive |
| `@omega-ai/dsh-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |

## test-support

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-tool-todo` | yes | Model-facing todo_write tool over the Omega event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the Omega web capability seam (ctx.web) |
| `@omega-ai/dsh-web` | yes | Abstract web access capability seam (ctx.web) for the Omega — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@omega-ai/dsh-web-fetch-http` | yes | Anonymous public HTTP(S) fetch provider for the Omega web capability seam (ctx.web) |
| `@omega-ai/dsh-web-search-exa` | yes | Exa-backed search provider for the Omega web capability seam (ctx.web) |
| `@omega-ai/dsh-web-search-omega` | yes | Omega-backed search provider (native web_search via the Anthropic-compatible API) for the Omega web capability seam (ctx.web) |
| `@omega-ai/dsh-web-search-perplexity` | yes | Perplexity-backed search provider for the Omega web capability seam (ctx.web) |

## webhook

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed Omega Sessions |
| `@omega-ai/dsh-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the Omega webhook runtime |

## workflow

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@omega-ai/dsh-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@omega-ai/dsh-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@omega-ai/dsh-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the Omega |
