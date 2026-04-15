# Security Policy

Thanks for helping keep Coherence Studio and its users safe.

## Reporting a Vulnerability

**Preferred: GitHub's private vulnerability disclosure.** Go to
[**Security → Report a vulnerability**](https://github.com/getcoherence/studio/security/advisories/new)
and open a private advisory. This loops in only the maintainers — the
report stays non-public until a fix ships.

**Email fallback:** `security@getcoherence.io`. Use this if you can't use
GitHub PVD, or for reports that touch multiple Coherence products.

Please include:
- A clear description of the issue and its impact
- Steps to reproduce (or a proof-of-concept)
- The affected version(s) of Coherence Studio
- Your name/handle for credit (or tell us you'd prefer to stay anonymous)

**Please don't** open a public issue or PR for security problems — it
exposes users before we can ship a fix.

## Response Timeline

- **Acknowledgement within 48 hours** (usually faster).
- **Initial triage within 5 business days** — severity assessment +
  rough timeline for a fix.
- **Fix + release for Critical/High: target 7 days.** Medium/Low: rolled
  into the next scheduled release.
- You'll be kept in the loop throughout. If we can't reproduce or
  disagree on severity, we'll explain why.

## Supported Versions

Only the **latest stable release** ([releases page](https://github.com/getcoherence/studio/releases))
receives security updates. Beta-channel builds receive the same fixes
but may lag stable by a few days.

## Scope

### In scope

- The Coherence Studio desktop app (Electron main + renderer)
- The Windows/macOS/Linux installers and update manifests published to
  GitHub Releases
- The auto-updater (electron-updater) — signature verification, update
  pinning, downgrade protection
- IPC surface between main and renderer (`electron/ipc/`)
- The signing pipeline in `.github/workflows/build.yml` and
  `signing/sign.cjs`

### Out of scope

- **Development server vulnerabilities** (`npm run dev`) that don't
  affect the shipped installer. Vite + esbuild dev-server CVEs fall
  here. The production build is static HTML+JS — no dev server runs
  inside the installed app.
- **Third-party AI provider APIs** (OpenAI, Anthropic, MiniMax,
  ElevenLabs, etc.) — report those to the providers directly.
- **Theoretical issues without a practical exploit** (e.g. "using `any`
  types is unsafe"). We're happy to discuss but won't issue an advisory.
- **Bundled Electron/Chromium vulnerabilities** — tracked upstream;
  we ship Electron security updates on their cadence.
- **Social engineering** against maintainers or contributors.

## Known Accepted Risks

These are documented so you don't need to report them:

- **Vite path traversal in `.map` handling** (GHSA-jqfw-vq24-v9c3) and
  **esbuild dev-server CORS** (GHSA-67mh-4wv8-2f99). Both are dev-server
  only and don't affect shipped installers. Scheduled for resolution
  during a Vite 5→8 migration.

## Signature Verification

All installers are code-signed:

- **Windows**: Azure Trusted Signing, issued to "Brightyard, Inc",
  chained to Microsoft Identity Verification Root CA 2020. Verify with
  `signtool verify /pa "Coherence Studio Setup X.Y.Z.exe"`.
- **macOS**: Apple Developer ID Application + notarization (when
  enabled). Verify with `codesign -dv --verbose=4 "Coherence Studio.app"`
  and `spctl -a -vvv`.
- **Linux**: AppImages are unsigned (conventional for this format).
  Verify via the SHA-256 checksum published in `latest-linux.yml`.

If `signtool verify` / `codesign` reports an invalid signature on a
release downloaded from the GitHub Releases page, **don't install it**
and report immediately — that's evidence of either a supply-chain attack
or an infrastructure misconfiguration on our side.

## Credits

Security researchers who responsibly disclose valid issues will be
credited in the release notes (unless you prefer anonymity). We don't
currently run a paid bug bounty.
