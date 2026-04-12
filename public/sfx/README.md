# SFX Library

This directory holds royalty-free sound effects used by the Sound Designer
agent. Each clip is referenced by the `sfx` name in a scene plan's `sfxCues`
array, and the compiler emits `<Audio src="/sfx/{name}.mp3" />`.

## Required clips

| Filename            | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `whoosh.mp3`        | Fast air swoosh — transitions, entrances              |
| `pop.mp3`           | Short percussive pop — reveals, bullet points         |
| `thud.mp3`          | Heavy impact — emphasis, climax beats                 |
| `click.mp3`         | UI click — selection, decision moments                |
| `ding.mp3`          | Light bell — success, completion, checkmarks         |
| `sweep.mp3`         | Ascending sweep — build-ups, reveals                  |
| `impact.mp3`        | Deep boom — dramatic moments, stats                   |
| `riser.mp3`         | Tension riser — anticipation, suspense                |
| `tick.mp3`          | Clock tick — countdowns, time-sensitive               |
| `reverse-cymbal.mp3`| Reversed cymbal swell — pre-reveal                    |

## Recommended sources

- [Freesound](https://freesound.org) — CC0 and attribution clips
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/) — royalty-free
- [Mixkit](https://mixkit.co/free-sound-effects/) — free commercial use

Clip specs: MP3, 44.1 kHz, mono or stereo, 0.3-2.0 seconds. Normalize to ~-6 dBFS
so they sit under narration without overpowering.

## What happens if a clip is missing

The Sound Designer agent is flag-gated (`PRODUCTION_TEAM_AGENTS.soundDesigner`
= false by default). With the flag off, no SFX cues are generated, so missing
files don't cause errors.

When the flag is on and a file is missing, Remotion's `<Audio>` element will
fail to load and skip playback silently — the visual scene still renders fine.
