# Release Signing Setup

One-time setup needed before the `.github/workflows/build.yml` tag-push
pipeline can cut signed multi-platform releases. Everything here is
manual work in third-party portals; once the GitHub secrets are set, CI
runs on its own.

## GitHub repository secrets

Go to **getcoherence/studio → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Purpose |
| --- | --- |
| `AZURE_TENANT_ID` | Entra tenant ID (Windows signing) |
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_CLIENT_SECRET` | Service principal secret *value* (not ID) |
| `MAC_CERT_P12` | Base64-encoded Developer ID Application `.p12` |
| `MAC_CERT_PASSWORD` | Password that unlocks the `.p12` |
| `APPLE_API_KEY` | Contents of the App Store Connect API `.p8` file |
| `APPLE_API_KEY_ID` | Key ID for that API key |
| `APPLE_API_ISSUER` | Issuer UUID for the API key |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no setup.

## Windows (Azure Trusted Signing)

Already configured locally; copy the values you pasted into
`.env.signing` into the GitHub secrets above (`AZURE_TENANT_ID`,
`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`).

The CI fetches `Microsoft.Trusted.Signing.Client` (v1.0.95) at build
time — no additional setup needed on the runner.

## macOS (Developer ID + App Store Connect API notarization)

### 1. Export the Developer ID Application certificate

On your Mac (or Keychain Access on any machine with the cert):

1. Open **Keychain Access → login keychain → My Certificates**
2. Find **"Developer ID Application: Brightyard, Inc (TEAM_ID)"**
3. Right-click → **Export…** → save as `brightyard-dev-id.p12`
4. Pick a strong password. You'll need this for `MAC_CERT_PASSWORD`.
5. Base64-encode it for GitHub:

   ```bash
   base64 -i brightyard-dev-id.p12 | pbcopy
   ```

6. Paste into `MAC_CERT_P12` secret (it'll be a long single-line string).
7. Paste the export password into `MAC_CERT_PASSWORD`.

### 2. Create an App Store Connect API key for notarization

Apple's newer notarization auth — no 2FA prompts, no app-specific
passwords to rotate.

1. Go to **[appstoreconnect.apple.com](https://appstoreconnect.apple.com/) → Users and Access → Integrations → App Store Connect API**
2. Click **Generate API Key** (or **+**)
3. Name: `Coherence Studio Notarization`
4. Access: **Developer** (minimum needed for notarization)
5. Download the `.p8` file **immediately** — Apple only lets you
   download it once.
6. Three values to copy into GitHub secrets:
   - `APPLE_API_KEY` → paste the full contents of the `.p8` file
     (including the `-----BEGIN PRIVATE KEY-----` lines)
   - `APPLE_API_KEY_ID` → the Key ID column in the table (e.g. `ABC123DEF4`)
   - `APPLE_API_ISSUER` → the Issuer ID shown at the top of the page
     (a UUID like `69a6de70-…`)

### 3. Hardened runtime + entitlements

Already configured in `electron-builder.json5` (`hardenedRuntime: true`,
`entitlements: "build/entitlements.mac.plist"`). The plist grants
microphone / camera / audio-input access + JIT for V8. If you add new
capabilities (e.g. Bluetooth, network server), edit
`build/entitlements.mac.plist` and declare them explicitly — notarization
fails if a binary uses a capability that isn't entitled.

## Linux

No signing. AppImages are conventionally distributed unsigned. Linux
users verify via the `blockmap` + `latest-linux.yml` checksum that
electron-updater already publishes.

## Cutting a release

```bash
# Bump package.json + create the tag + commit in one step
npm version minor    # or `patch` / `major` / `preminor --preid=beta`

# Push the commit and the tag together (tag-only push also works)
git push --follow-tags
```

The tag push triggers `.github/workflows/build.yml`:

- Windows, macOS, Linux build in parallel (~8-15 min each)
- Each runner signs its installer (Win → Azure, Mac → Apple)
- electron-builder publishes all artifacts + `latest*.yml` manifests to
  a draft GitHub Release named after the tag
- You manually edit the release notes on GitHub and publish when ready

Prerelease tags (e.g. `v1.2.0-beta.1`) publish to the **beta** channel
manifests (`beta.yml`, `beta-mac.yml`, `beta-linux.yml`). Users on the
default **Stable** channel won't see them until you cut a non-prerelease
tag; Beta-channel users (gated to Pro in the Release Channel submenu)
get them immediately via electron-updater's hourly poll.

## Testing without cutting a real release

Use **manual dispatch** from the Actions tab. The workflow runs all
three platforms but skips publishing — artifacts land in
`Actions → {run} → Artifacts` with a 14-day retention. Mac notarization
still runs against real Apple servers, so you'll know if the cert/key
setup works without creating a real GitHub Release.
