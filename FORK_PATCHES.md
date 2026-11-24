# Fork patch ledger — DeepSeek harness to Omega

This repository is a branded fork of the DeepSeek harness (upstream organization
`deepseek-harness`; fork point is the `0.2.2-rc.5` release, upstream commit
`2e39e70496`, merged as `191b24a3b3`). Everything below the rebrand commits is
upstream history; the rebrand commits and everything above them is fork-owned.

When merging or rebasing upstream, re-apply the fork patch set (section 2) and
run the regeneration and verification chains (sections 3–4). The gates are the
enforcement: a pull is not done until they are green apart from the known
debt (section 5).

## 1. Fork structure

| | |
|---|---|
| Upstream | `deepseek-harness` harness repository (the "DSH" product) |
| Fork | `EXNP-Inc/Omega`, remote `origin`, branch `master` |
| External engine | `@deepseek-ai/libreoffice-kit` and its five platform engines (`-wasm`, `-darwin-arm64`, `-darwin-x64`, `-win32-arm64`, `-win32-x64`) are published upstream packages — never renamed (2.1) |
| Rebrand commits | one `rebrand(harness)` commit above each upstream merge, found with `git log --oneline --grep='rebrand(harness)'` |

Rebrand history: the first merge (fork point `0.2.1-alpha.1`, PR #5648) landed
the original three rebrand commits (bulk scope rename, pi-ai bundle pointers,
user-visible DSH naming); the 0.2.2-rc.5 merge (`191b24a3b3`) re-applied that
patch set plus the new rc.5-specific items below as one `rebrand(harness)`
commit (single parent `191b24a3b3`):

- Package scope `@deepseek-ai/*` to `@omega-ai/*` across every pulled file,
  including the rc.5-new packages; user-visible naming to Omega; all WAN
  defaults to the local gateway `127.0.0.1:8090`.
- **Client branding** (2.5): the Ω logo/wordmark and the running-indicator
  ω APNG ship through the rc.5 hashed client-asset pipeline; the fork's old
  `FishLogo` and running-whale APNG are deleted, and the fork's base64
  inlining plugin is not carried (the rc.5 pipeline supersedes it).
- **llm-omega test re-derivation** (2.4): the rc.5 test lanes of `llm-omega`,
  `llm-omega-account`, and `llm-omega-api-key` are re-derived from the
  upstream 2-model bundled catalog to the fork's empty-catalog, 8090-endpoint
  binding (16 test files, 804 tests green).
- **pi-ai external surface** (2.1): the installed `@earendil-works/pi-ai`
  builtin provider is rebranded to `omega` (id, `Omega` name,
  `https://api.omega.ai`, `OMEGA_OPENAI_API_KEY`, `omega-flash` / `omega-v4-pro`)
  by the rebrand patch, so the harness's `llm-pi-ai` sources, tests, and the
  Web worker `pi-ai.ts` stub all use `omega`; only the `@deepseek-ai` scope
  and the internal deepseek file/export names are rescoped, never the
  `thinkingFormat: "deepseek"` token (see 2.1).
- The `0.2.1-alpha.1`-era items (2.2–2.4) re-apply unchanged.

## 2. Fork patch set (re-apply on every upstream pull)

### 2.1 Package scope

- Workspace and vendor packages publish as `@omega-ai/*`; the full upstream-to
  fork name mapping is the table in [docs/rescope.md](docs/rescope.md).
- **Exception:** keep the external engine names exactly
  `@deepseek-ai/libreoffice-kit[-engine]`. Renaming them breaks install
  (`.pnpm` resolution). Guarded sites: `apps/desktop-host/src/office-engine.ts`
  (join args + JIT regexes), `apps/desktop/scripts/macos-runtime.ts` (JIT
  regex), `apps/desktop/tests/windows-asar-unpack.spec.ts` and
  `apps/desktop/tests/macos-runtime.spec.ts` (fixture paths),
  `scripts/libreoffice-packages.mjs`, `scripts/verify-default-product-isolation.ts`
  (`EXTERNAL_ENGINE_PREFIX` rule), and the kit row in
  `THIRD_PARTY_NOTICES.md` (regenerate the file, do not hand-edit).
- **Exception:** the installed `@earendil-works/pi-ai` package's builtin
  provider is rebranded from `deepseek` to `omega` by the patch in
  `patches/@earendil-works__pi-ai@1.3.0.patch` (re-apply with `pnpm install`):
  provider id `omega`, display name `Omega`, base URL `https://api.omega.ai`,
  credential environment variable `OMEGA_OPENAI_API_KEY` (the `envMap` key is
  `omega`; the upstream `DEEPSEEK_API_KEY` / `api.deepseek.com` are gone from
  the builtin), and models `omega-flash` ("Omega V4.1 Flash") and `omega-v4-pro`
  ("Omega V4 Pro"). Internal file names and exports keep the `deepseek` token
  (`deepseek.js`, `data/deepseek.json`, `DEEPSEEK_MODELS`, `deepseek.models.js`)
  and the `compat.thinkingFormat: "deepseek"` wire token (a protocol constant
  the harness maps in `getCompat`); the `KnownProvider` type-level union keeps
  the upstream `deepseek` literal. Third-party vendor catalogs in the package
  (OpenRouter, LobeChat, opencode, and others) still list real DeepSeek models
  — never rename them. The `llm-pi-ai` sources, specs, and the Web worker
  `pi-ai.ts` stub use `omega` throughout (the stub is vocabulary-free).
- **Exception:** the web fetch provider id is `omega-fetch-api` (upstream
  `deepseek-fetch-api`); its search sibling is already `omega-search-api`.
  Guarded across the shipped `cordis.patch.yml`, the `snapshots/session/omega-fetch`
  scenario, the `ui-settings-web-search` and `web-omega-api` sources and READMEs,
  and the `tool-web` `deepseek-fetch` test route (now `omega-fetch`).

### 2.2 User-visible naming: `DSH` to `Omega`

Rename (user-visible surfaces only):

- Client locale dictionaries (`packages/client/**/locales.ts`,
  `guide-locales.ts`) — en and zh together.
- CLI user-facing text (`apps/cli`), desktop copy
  (`apps/desktop/src/locale.ts`).
- `docs/` prose and package READMEs. `website/` is a generated projection —
  it rebuilds from `docs/` via `pnpm run website:build`; only its own test
  sources are edited by hand.
- **Model-facing product strings:** the JSDoc that feeds the generated
  catalogs (tool descriptions), the sandbox-policy runtime-context lines
  (`packages/sandbox/sandbox-policy/src/index.ts`), plugin-manager and
  profile-compatibility diagnostics, subagent SDK runner strings.

Never rename:

- `DSH_*` environment variables (`DSH_HOME`, `DSH_SNAPSHOT`,
  `DSH_SYSTEM_PROMPT`, `DSH_TELEMETRY_*`, `DSH_GITHUB_*`, ...).
- The `dsh` binary, `dsh.profile.bundles`, and the `dsh-` package stem:
  `@omega-ai/dsh-*` keeps the stem.
- Wire and boot identifiers: `__DSH_BOOT__`, `__DSH_HOST_PATHS__`,
  `DshEnvironmentKey`, remote error-code strings.
- Dev-facing JSDoc and comments — except the JSDoc that is the source of a
  model-facing generated catalog (that text is model-visible).
- Recorded scenario data under `snapshots/**` (user prompts, model replies).
  Only product-generated lines (for example the runtime-context policy line)
  carry the rename, and only in the current-generation
  `session.v4.jsonl` files.
- The bonus-notice golden string `DSH 体验赠金` — external platform mock data.
- `BRAND_GUIDELINES.zh.md` company line — owner decision, leave untouched.

### 2.3 Ports and endpoints

| Fact | Value | Site |
|---|---|---|
| Web dashboard port | `4080` (upstream `3080`) | `packages/boot/cmdline/src/index.ts` (`port ?? 4080`) |
| Local gateway (every WAN default) | `http://127.0.0.1:8090` (`/anthropic`, `/anthropic/v1`, `/v1/logs`) | `packages/llm/llm-omega/src/config.ts`, `packages/web/web-search-omega/src/provider.ts`, `packages/host/product-telemetry-otel/src/index.ts`, `packages/bundle/base/cordis.patch.yml` |
| pi-ai provider `alice` | `http://192.168.10.210:8001/v1`, `openai-responses`, key env `ALICE_API_KEY`, model `qwen3.8-27b` (text+image), reasoning `xhigh` | `packages/bundle/base/cordis.patch.yml` |
| pi-ai provider `mac` | `http://192.168.10.210:8002/v1`, key env `MAC_API_KEY`, model `qwen3.8-27b-lite` (text), reasoning `xhigh` | `packages/bundle/base/cordis.patch.yml` |
| Agent default model | `mac/qwen3.8-27b-lite` at `xhigh` | bundled pi-ai defaults |
| Model listing endpoint | `GET /models` at the origin of `baseURL` (gateway default: `http://127.0.0.1:8090/models`); both the official and the account route are listing-only | `packages/llm/llm-omega/src/listing.ts` (`modelListingURL`) |
| Upstream default models | none — the omega catalog ships empty; every WAN endpoint defaults to the local gateway; explicit user config always wins | — |

`192.168.10.210` is a shipped default that assumes LAN routing to the model
host. If the host address changes, `packages/bundle/base/cordis.patch.yml` is
the only site that changes.

### 2.4 Provider and account surface

- Provider id is `omega-official` (upstream `deepseek-*`); the account
  platform package is `@omega-ai/dsh-omega-account-platform`.
- Test fixtures use `omega-official` / `omega-v4-flash` as model-visible mock
  values; keep them aligned when upstream changes the mock shape.
- **The omega catalog ships empty** (`packages/llm/llm-omega/src/models.ts`,
  `DEFAULT_MODELS = []`). `isBuiltInCatalog([])` is `true`; the official
  route serves its models from the gateway listing (`GET /models` at the
  origin of `baseURL`, i.e. `http://127.0.0.1:8090/models`), and the account
  route is listing-only. A listed row without `client_requirements` is
  offered only if its id is in the (empty) build catalog, so it is refused
  `unsupported`; a row whose `min_version` the client satisfies is offered
  (or refused `upgrade-required` above the client version) and, when absent
  from the build catalog, layered over a bare `{ id }` stub carrying only
  the declared listing facts. Keep upstream default models out of the
  shipped catalog on every pull.
- **llm-omega test re-derivation (rc.5):** the rc.5 test lanes of
  `llm-omega`, `llm-omega-account`, and `llm-omega-api-key` (16 files, 804
  tests) were re-derived from the upstream 2-model bundled catalog to this
  empty-catalog / 8090-endpoint binding: bundled-catalog tests expect `[]`;
  vision and image tests inject
  `models: [{ id, inputModalities: ['text','image'] }]` because the catalog
  ships empty; unlisted models assert the fallback shape (`name` = id,
  `contextWindow` 1 000 000, `defaultMaxTokens` 256 000, text-only, no
  protocol modes); listed rows offered in tests carry
  `client_requirements['omega-harness'].min_version`; and listing endpoints
  are the origin plus `/models`. The only `llm-omega` source change in this
  re-derivation is the request-id header rename in
  `packages/llm/llm-omega/src/transport.ts` (`x-omega-request-id`). Other
  packages that consume the catalog or the gateway (for example `llm-pi-ai`,
  `web-search-omega`, and the translator's omega providers) are re-derived on
  a separate lane; until then they stay red as recorded in section 5.

## 3. Regeneration chain (run after re-applying the renames)

```sh
pnpm run gen-cordis-api            # -> packages/extensions/tool-cordis/src/api-catalog.ts
pnpm run gen-cordis-catalog        # -> docs generated regions + docs/cordis-api/inherited.md
pnpm run gen-cordis-inspect-catalog # -> packages/extensions/cordis-client-runner/src/client/api-catalog.ts
pnpm run gen-third-party-notices   # -> THIRD_PARTY_NOTICES.md
pnpm run typecheck
pnpm run build
pnpm run website:build
pnpm run doc-sync                  # 42 gates; verify-persistence-changes expected red (section 5)
```

Never hand-edit: the generated `api-catalog.ts` files, the
`<!-- BEGIN/END GENERATED -->` regions in `docs/`, or the ```` ```ts type-equiv ````
fences in `docs/subsystems/*`. Edit the JSDoc source and regenerate; when a
generated region drifts from its source, revert the region to the source
wording.

## 4. Verification chain (definition of done)

| Lane | Command | Expected on a clean fork |
|---|---|---|
| Unit | `pnpm run test` | green apart from section 5 |
| GUI | `pnpm run test:gui` — `vitest run packages/client packages/host` (there is no `vitest.gui.config.ts`) | green apart from section 5 |
| Web e2e | `CI=true PNPM_HOME=$PWD/.pnpm-home DSH_SNAPSHOT=replay ./node_modules/.bin/vitest run --config vitest.web.config.ts` | 171 passed / 1 skipped (key self-skip) |
| Snapshot | `pnpm run test:snapshot` | green apart from `ptc-script-imports` (section 5, environmental) |
| Docs | `pnpm run doc-sync` | 41/42 (persistence baseline debt) |
| Website | `pnpm run website:build` | green (doubles as the dead-link check) |

Mechanical rename checks after a pull:

- `grep -rn '@deepseek-ai' packages apps scripts vendor --include='*.ts' --include='*.json' --include='*.mjs'`
  returns only the 2.1 exception sites.
- Audit remaining `DSH` occurrences in changed files against the 2.2
  never-rename list.

Fixture and golden maintenance when upstream changes model-visible output:

- Web session fixtures: run the web lane with `DSH_SNAPSHOT=refresh` (keyless;
  model responses replay from the recordings), then diff-review every hunk —
  only the intended output changes may move. Scenarios that launch with
  `compareReplaySession: 'read-only'` (for example
  `apps/web/tests/changed-files-turn.e2e.ts`) do not write their fixture on
  refresh: apply the same deterministic wording to their current-generation
  `session.v4.jsonl` by hand and diff-review it.
- Session and SDK fixtures: when upstream or rebrand changes model-visible
  output (tool descriptions, system prompts, model or provider defaults), run
  the keyless refresh `DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_SNAPSHOT=refresh
  pnpm run test:snapshot` (it replays the committed scripts and rewrites the
  current expected outputs; it never loads `.env`), then diff-review every
  hunk — only the intended output changes may move. Revert refresh noise:
  stream-chunk timestamps, `durationMs`, and omitted-byte counts in
  `writer.expected.jsonl` files, and any fixture whose red is environmental
  (section 5) rather than rebrand output. Historical `session.v2.jsonl` /
  `session.v3.jsonl` generations are immutable replay inputs — never reword
  them.
- ARIA goldens: `vitest run -u` on the affected spec, then diff-review every
  hunk before committing.
- `scripts/lint-rule-fingerprint.spec.ts`: if upstream changes a custom-rule
  message in `.oxlintrc.json`, recompute the three sha256 pins with a tsx
  script mirroring the spec's `severity`/`normalizedRules`/`mergedRules`.
- `scripts/verify-package-dependencies.spec.ts`: the expected array is in
  `localeCompare` order; re-sort after renames.
- Run a complete `pnpm run build` before the web lane after any single-package
  bundle: `built-boot.expected.e2e.ts` validates the client artifacts against
  `.dsh-build/client-build-environment.json`.

## 5. Known red debt (do not chase during an upstream pull)

The 0.2.2-rc.5 pull (`191b24a3b3`) surfaced the rows below. The `llm-pi-ai`
lane is resolved: the pi-ai rebrand (2.1) now supplies the `omega` model
catalog, so its specs pass without touching the harness's own empty `omega`
catalog. The remaining re-derivation lanes (`web-search-omega`, translator)
are the same empty-catalog/8090 class as the completed `llm-omega` lane (2.4)
and are the next work, not debt to ignore; the rest are host/environmental
or re-record-once goldens.

| Failure | Lane | Cause | Action |
|---|---|---|---|
| ~~`llm-pi-ai` (adapter, catalog, discovery, native-auth, request-headers)~~ | unit | **Resolved:** the pi-ai rebrand (2.1) supplies the `omega` model catalog, so the lane is green (179 tests) without touching the harness's own empty `omega` catalog | — |
| `web-search-omega` `omega.spec` x7 | unit | account-route tests expect `https://api.omega.com/...`; fork source resolves the gateway `http://127.0.0.1:8090/anthropic/v1` | re-derive the account-route expectations to the 8090 gateway (next lane) |
| `translator` `omega.spec` / `audit.spec` ~14 | unit | omega-official / omega-account native Flash providers unresolved under the empty catalog | re-derive to the catalog binding (next lane) |
| `ui-sidebar` sidebar-snapshot x3, `ui-primitives` icons (BrandWordmark), `ui-brand-official` browser-plugin, `ui-chat` turn-usage-panel, `ui-plugin-manager` components, `desktop-publication-preflight` | gui/unit | fork rebrand changed the rendered Ω mark/wordmark and product text; recorded goldens still hold the upstream values | re-record the goldens after the rebrand (`vitest run -u` + diff-review), then green |
| `desktop` windows-sign / windows-asar-unpack / macos-runtime; `office-kit` anchors / engine-package / kit-lookup | unit | Windows `.cmd` CRLF assertions and the `@deepseek-ai/libreoffice-kit-{wasm,engine}` fixtures are not present on this Linux host | environmental — green on the platform/CI host that installs the engines |
| `ptc-runtime-node` imports / imports-process / scoped-repl / vm-script | unit | rc.5 uses Node-24-only `import.source` and node-addons resolution; this host runs Node 22 | environmental — green on the Node ≥ 24 CI host |
| `task-manager-page` x2 | gui/unit | asserts the device zone differs from `America/New_York`; fails on any US-Eastern host (this host is `America/Toronto`) | pin the device zone in the test — owner call |
| `gen-dependency-catalog`, `lint-rule-fingerprint`, `persistence-developer`, `release/families`, `release/verify-packed-install` | unit | npm-resolution sha256 pins and the release package catalog track the live npm registry / rc.5 package list | environmental — regenerate/re-pin on a full host, or owner decision |
| `ui-settings-account` contact-url, `text-search` fuzzy `flash`, `website` table-filter `LLM-DEEPSEEK` | unit | rc.5 re-derivation residue (not in the 3 `llm-omega` packages) | re-derive with the next lane |
| `verify-persistence-changes` | doc-sync | deepseek to omega event renames against the frozen v4 persistence baseline | owner decision |
| 13 replay failures (3 sdk, 10 headless) | `test:snapshot` | fixtures record `SANDBOX_UNAVAILABLE` denials; the working host sandbox runs the commands instead | re-record from a host where the sandbox backend is unavailable, or owner decision. **Not observed at the re-apply (`d885a4cb38`) — its 25 snapshot failures were all rebrand gaps with zero `SANDBOX_UNAVAILABLE` signatures — nor at the follow-up re-derivation, which left the lane green apart from `ptc-script-imports`** |
| `ptc-script-imports` | `test:snapshot` | fixture records successful ESM `import()` results; rc.5's `vm-script` execution mode supports evaluation-phase imports only, so the replay emits `CODE_RUN_FAILED` on a Node-22 host | environmental with the unit-lane `ptc-runtime-node` vm-script row — re-record on a Node ≥ 24 host, or owner decision |
| `ui-trajectory` `client-bundle` | gui/unit | fails at the fork tip before any pull (rebrand-era) | owner attention |
| `agent-preset` `skills.spec` x2 | unit | untracked local `graphify` skill install (46856 bytes > 8192 pruner threshold) | owner's install |
| `workspace-files/changes`, `skill-office/checkers` | unit, full run only | load-dependent timeouts; both green focused | re-run focused when they fail |

Anything else red after the pull is a regression to fix or report, not debt.

## 6. Tooling traps (host and repo)

- **pnpm duality:** the repo pins `packageManager` to pnpm 11.7.0; the host
  brew pnpm is 10.34.5 and answers for bare `pnpm` spawned outside the repo
  (for example the plugin-manager spec's real-pnpm subprocess in a temp dir).
  Run lanes through `pnpm run test` / `pnpm exec` so the repo shim is on
  PATH.
- **perl `@` interpolation:** `perl -pi -e 's/@omega-ai/.../'` silently no-ops
  (perl reads `@omega` as an array). Edit through the editor or escape `\@`.
- **BSD grep BRE** has no `\|` alternation — verify with `grep -E` or
  ripgrep.
- **`vitest run -u <file>`** with a file filter can execute the full unit
  suite; scope the command explicitly.
- `execa` in this repo: named import `import { execa } from 'execa'`.
- `scrubbedParentEnv` source: `packages/subprocess/subprocess/src/index.ts`.

## 7. Upstream pull checklist

1. `git remote add upstream <upstream URL>` (when absent), `git fetch
   upstream`.
2. Merge (or rebase) `upstream/master` into `master`. On conflicts, upstream
   owns new behavior and the fork owns the renames; keep both.
3. Re-apply 2.1 (scope), 2.2 (user-visible naming), 2.3–2.4 (ports,
   endpoints, defaults) to every pulled file: new packages take the
   `@omega-ai` scope, new user-visible strings take the `Omega` naming, new
   WAN endpoints default to the local gateway, and new upstream default
   models stay out of the shipped catalog. Keep the omega catalog empty
   (`DEFAULT_MODELS = []`): re-derive the catalog-consuming test lanes
   (`llm-omega`, `llm-omega-account`, `llm-omega-api-key`, and any new
   catalog or gateway consumer) to the empty-catalog / 8090-endpoint binding
   (2.4) rather than re-populating the catalog, and re-point any pulled
   test that pins an `api.omega.com` / `api.deepseek.com` endpoint at the
   local gateway.
4. Run the section 3 regeneration chain, then the section 4 verification
   chain. When a pull (or the re-apply) changes model-visible output in the
   recorded lanes, first re-derive the session/SDK fixtures with the keyless
   refresh described in section 4, then run the snapshot replay.
5. Triage the remaining red against the section 5 table.
6. Commit the re-applied patch set as one `rebrand(harness): ...` commit
   naming what was re-applied; `git diff --cached --check` must stay clean
   (pre-commit gate).
