# Coherence Studio on OpenScreen v3

This branch line is Coherence Studio re-platformed onto upstream OpenScreen
(getopenscreen/openscreen). The full plan, with its decisions D1–D8, is
`docs/V3-REPLATFORM-PLAN.md` on Studio's `main`.

- **Base:** upstream v2.4.0, `2b65ea937` ("chore(release): release v2.4.0 into main").
- **Status:** phase 0. The upstream app is unmodified, plus Studio's CI and signing.

## Rules

- Studio code lives only in Studio-owned paths (below). Upstream files are
  edited only at the patch points listed here, and each edit is marked `STUDIO:`.
- Sync to upstream release commits on main (`chore(release): release vX.Y.Z into main`),
  never to tags (they sit on `release/*` branches) or to the tip of main.
- On each sync: resolve conflicts at the patch points, diff upstream's
  `.github/workflows/build.yml` and port relevant build changes into
  `studio-build.yml`, and run the full Studio build.

## Studio-owned paths

| Path | What |
|---|---|
| `STUDIO.md` | This file. |
| `.github/workflows/studio-build.yml` | Signed builds for Windows x64 and arm64, macOS arm64 and x64, and Linux AppImage. |
| `.github/studio/` | CI helper scripts. |
| `electron-builder.studio.json5` | Packaging overlay on top of upstream's `electron-builder.json5` (`extends`). |
| `signing/` | Azure Trusted Signing hook and metadata. |

## Patch points in upstream files

| File | Change | Since |
|---|---|---|
| `.github/workflows/build-whisper-stt.yml` | Added a `workflow_call` trigger, so `studio-build.yml` can build the helper in-run. | phase 0 |

## Upstream workflows

All upstream workflows are kept as they are for now. On a `replatform/**`
push, only `build-whisper-stt.yml` runs, because of its all-branches path
filter. The publishing workflows (winget, Homebrew, AUR, MS Store, Discord,
Nix) only matter once this line lands on `main`, and phase 1 removes them.
