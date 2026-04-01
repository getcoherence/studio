<p align="center">
  <img src="public/lucid.png" alt="Lucid Studio Logo" width="64" />
</p>

# <p align="center">Lucid Studio</p>

<p align="center"><strong>AI-powered screen recording and editing. Free and open source.</strong></p>

<p align="center">
  <a href="https://getlucid.studio">Website</a> &middot;
  <a href="https://github.com/getcoherence/lucid/releases">Download</a> &middot;
  <a href="https://github.com/getcoherence/lucid/issues">Issues</a>
</p>

---

Lucid Studio is a free, open-source screen recorder with AI-powered editing. Record your screen, and let AI handle the polish — auto-captions, smart trimming, narration, and one-click professional output.

Built by the team behind [Coherence](https://getcoherence.io). Originally forked from [OpenScreen](https://github.com/siddharthvaddem/openscreen) by Siddharth Vaddem.

## Features

- Screen recording with native capture (ScreenCaptureKit on macOS, WGC on Windows)
- Auto-zoom on cursor activity
- AI-powered auto-captions (Whisper)
- Smart trimming (removes dead air and loading screens)
- One-click polish (zoom + captions + background + speed ramps)
- Auto-narration (AI-generated voiceover)
- Cursor effects (motion smoothing, click rings, custom styles)
- Background customization (wallpapers, gradients, solid colors)
- Annotations (text, arrows, images)
- Export to MP4 and GIF

## Installation

Download the latest installer from the [GitHub Releases](https://github.com/getcoherence/lucid/releases) page.

### macOS

If macOS blocks the app, run:
```bash
xattr -rd com.apple.quarantine /Applications/Lucid\ Studio.app
```

### Linux

```bash
chmod +x Lucid-Studio-Linux-*.AppImage
./Lucid-Studio-Linux-*.AppImage
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for your platform
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux

# Run tests
npm test
```

## License

[MIT](./LICENSE) — free for personal and commercial use.
