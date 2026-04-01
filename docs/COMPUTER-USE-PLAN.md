# Computer Use — AI-Powered Demo Recording

## Vision

"Give Lucid a URL and it records a professional demo video for you."

The AI opens a browser, navigates the site/app, interacts naturally (clicks, types, scrolls), and records the entire session. The recording loads into the editor with auto-captions, zoom suggestions, and polish — ready to export.

## User Flow

1. User clicks **"AI Demo"** in Lucid Studio
2. Dialog: "What do you want to demo?" + URL input
   - "Record a product walkthrough of getcoherence.io"
   - "Show the signup flow on myapp.com"
   - "Demo the dashboard features"
3. Lucid opens a browser window (visible to user)
4. AI drives the browser — narrating its plan as it goes
5. Screen recording captures everything
6. When done, recording loads in editor with:
   - Auto-captions of AI narration
   - Suggested zoom regions on click areas
   - Smart trim suggestions for loading screens
7. User can edit and export

## Architecture

### Browser Automation Layer

**Playwright** bundled with Electron. Launches a real Chromium browser that the user can see.

```
electron/automation/browserDriver.ts
├── launchBrowser(options) → Browser
├── navigateTo(url)
├── click(selector | coordinates)
├── type(selector, text)
├── scroll(direction, amount)
├── screenshot() → Buffer
├── waitForNavigation()
├── waitForSelector(selector)
├── getPageInfo() → { title, url, text, links, buttons, inputs }
└── close()
```

### AI Agent Loop

The AI receives page context and decides actions. Classic agent loop:

```
electron/automation/demoAgent.ts

1. Get page info (title, visible elements, screenshot)
2. Send to LLM: "You're creating a demo. Here's the current page. What's the next action?"
3. LLM returns: { action: "click", target: "Sign Up button", narration: "Let's start by signing up" }
4. Execute action via browserDriver
5. Wait for page to settle
6. Repeat until LLM says "done"
```

The LLM response format:
```json
{
  "action": "click" | "type" | "scroll" | "navigate" | "wait" | "done",
  "target": "CSS selector or description",
  "value": "text to type (for type action)",
  "narration": "What to say in the voiceover for this step",
  "reasoning": "Why this action moves the demo forward"
}
```

### Recording Integration

While the AI drives the browser, Lucid records:

1. **Start recording** (existing screen recorder) targeting the browser window
2. **Capture narration text** — each action's narration is timestamped
3. **Capture click positions** — for auto-zoom suggestions
4. **Stop recording** when AI says "done"
5. **Auto-generate captions** from the narration text (no Whisper needed — we have the text)
6. **Auto-suggest zooms** on click locations
7. **Load into editor**

### File Structure

```
electron/automation/
├── browserDriver.ts     — Playwright wrapper
├── demoAgent.ts          — AI agent loop
├── demoRecorder.ts       — Orchestrates browser + recording + narration
└── types.ts              — DemoConfig, DemoAction, DemoResult

src/components/demo-recorder/
├── DemoRecorderDialog.tsx — UI for starting a demo recording
└── DemoProgress.tsx       — Live progress view (shows browser + AI status)
```

### Demo Recorder Dialog

```
┌─────────────────────────────────────────┐
│  🤖 AI Demo Recorder                    │
│                                          │
│  URL: [https://getcoherence.io    ]     │
│                                          │
│  What should the demo show?              │
│  ┌──────────────────────────────────┐   │
│  │ Walk through the main features,  │   │
│  │ show the dashboard, and end on   │   │
│  │ the pricing page.                │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ☐ Record with narration voiceover      │
│  ☐ Auto-zoom on clicks                  │
│  ☐ Auto-trim loading screens            │
│                                          │
│  [Cancel]              [🎬 Start Demo]  │
└─────────────────────────────────────────┘
```

### Live Progress View

While the AI is recording, the user sees:

```
┌─────────────────────────────────────────┐
│  Recording AI Demo...          ● 00:23  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │   [Live browser view]           │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  🤖 "Clicking the Features tab to       │
│      show the product capabilities"     │
│                                          │
│  Steps: 5/~12  |  Page: Features        │
│                                          │
│  [Stop Early]                            │
└─────────────────────────────────────────┘
```

## AI System Prompt

```
You are an AI demo recorder. You control a web browser to create
professional product demo videos.

For each step, you receive:
- Current page URL and title
- Visible text content (summarized)
- List of interactive elements (buttons, links, inputs)
- A screenshot of the current page

Your goal: {user's prompt}

Respond with ONE action at a time:
{
  "action": "click|type|scroll|navigate|wait|done",
  "target": "element description or selector",
  "value": "text for type action",
  "narration": "Professional voiceover text for this moment",
  "waitMs": 1000
}

Guidelines:
- Move slowly and deliberately (users need to see what's happening)
- Add 1-2 second pauses between actions
- Write narration as if presenting to an audience
- Focus on the demo goal — don't click every link
- 8-15 actions is ideal for a good demo
- End with "done" when the demo goal is achieved
```

## Implementation Phases

### Phase 1: Playwright Integration (M)
- Bundle Playwright with Electron
- `browserDriver.ts` with basic actions (navigate, click, type, scroll, screenshot)
- `getPageInfo()` that extracts visible elements for the AI
- Test: launch browser, navigate to a URL, take screenshot

### Phase 2: AI Agent Loop (M)
- `demoAgent.ts` with the LLM loop
- Send page context + screenshot to AI provider
- Parse action response
- Execute actions with timing delays
- Collect narration text + timestamps
- Works with any configured provider

### Phase 3: Recording Integration (M)
- `demoRecorder.ts` orchestrates everything
- Start screen recording targeting the Playwright browser window
- Timestamp each action for caption/zoom generation
- Stop recording when AI says "done"
- Generate captions from narration text
- Generate zoom suggestions from click coordinates
- Load recording into editor

### Phase 4: UI (S)
- `DemoRecorderDialog.tsx` — URL input, prompt, options
- `DemoProgress.tsx` — live view of the browser + AI status
- Integration into welcome screen and toolbar

### Phase 5: Polish (S)
- Smooth cursor movement (animate between click targets)
- Auto-trim loading/navigation delays
- Auto-apply Magic Polish after recording
- TTS narration from the AI-generated text

## Dependencies

- `playwright-core` — browser automation (no browser download needed — uses system Chrome or bundled Chromium)
- Existing: AI service, screen recorder, editor, captions, zoom suggestions

## Pro Feature

This is a **Pro-only** feature:
- Requires AI provider (API key)
- Uses significant compute (LLM calls per action)
- High-value differentiator

## Competitive Landscape

Nobody does this:
- **Loom** — manual recording only
- **Screen Studio** — manual recording only
- **Synthesia** — AI avatars but no browser automation
- **Guidde** — closest competitor, but limited automation

"AI Demo Recorder" would be Lucid Studio's signature feature.
