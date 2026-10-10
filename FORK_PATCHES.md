# Fork patch ledger — DeepSeek harness to Omega

This repository is a branded fork of the DeepSeek harness (upstream organization
`deepseek-harness`; fork point is the `0.2.1-alpha.1` release, PR #5648).
Everything below the three rebrand commits is upstream history; the rebrand
commits and everything above them is fork-owned.

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
| Rebrand commits | three commits above the fork point, found with `git log --oneline --grep='rebrand(harness)'` and `git log --oneline --grep='config(bundle): point shipped'` |

Rebrand commits, in order:

1. `rebrand(harness): rename DeepSeek surfaces to Omega and ship local-only
   defaults` — bulk rename: package scope `@deepseek-ai/*` to `@omega-ai/*`
   (328 packages including the vendor rescope), product surfaces to Omega
   (provider id `omega-official`, `llm-omega`, client logos/wordmark, i18n),
   all WAN defaults to the local gateway `127.0.0.1:8090`, bundled pi-ai
   profiles `alice`/`mac` registered, web dashboard port `3080` to `4080`.
2. `config(bundle): point shipped alice/mac pi-ai defaults at the LAN model
   host` — alice/mac `baseURL` at `192.168.10.210:8001|8002/v1`.
3. `rebrand(harness): user-visible DSH naming to Omega across UI, CLI, docs,
   and fixtures` — user-visible product naming `DSH` to `Omega` (locale en/zh,
   CLI text, docs, model-facing tool descriptions and the sandbox-policy
   runtime context), over-rename corrections (external libreoffice-kit names,
   verifier rules, fingerprint pins), and every fixture/golden pinning renamed
   output.

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
| Upstream default models | none — the omega catalog ships empty; every WAN endpoint defaults to the local gateway; explicit user config always wins | — |

`192.168.10.210` is a shipped default that assumes LAN routing to the model
host. If the host address changes, `packages/bundle/base/cordis.patch.yml` is
the only site that changes.

### 2.4 Provider and account surface

- Provider id is `omega-official` (upstream `deepseek-*`); the account
  platform package is `@omega-ai/dsh-omega-account-platform`.
- Test fixtures use `omega-official` / `omega-v4-flash` as model-visible mock
  values; keep them aligned when upstream changes the mock shape.

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
| Snapshot | `pnpm run test:snapshot` | green apart from the 13 sandbox-denial debt |
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
- Historical `session.v2.jsonl` / `session.v3.jsonl` generations are immutable
  replay inputs — never reword them.
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

| Failure | Lane | Cause | Action |
|---|---|---|---|
| `verify-persistence-changes` | doc-sync | deepseek to omega event renames against the frozen v4 persistence baseline | owner decision |
| 13 replay failures (3 sdk, 10 headless) | `test:snapshot` | fixtures record `SANDBOX_UNAVAILABLE` denials; the working host sandbox runs the commands instead | re-record from a host where the sandbox backend is unavailable, or owner decision |
| `task-manager-page` x2 | gui/unit | asserts the device zone differs from `America/New_York`; fails on any US-Eastern host (this host is `America/Toronto`) | pin the device zone in the test — owner call |
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
   models stay out of the shipped catalog.
4. Run the section 3 regeneration chain, then the section 4 verification
   chain.
5. Triage the remaining red against the section 5 table.
6. Commit the re-applied patch set as one `rebrand(harness): ...` commit
   naming what was re-applied; `git diff --cached --check` must stay clean
   (pre-commit gate).
