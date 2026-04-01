# ---------------------------------------------------------------------------
# macOS Native Helpers — ScreenCaptureKit Capture Module
#
# This directory will contain the Objective-C / Swift sources that use
# Apple's ScreenCaptureKit framework (macOS 12.3+) to perform:
#
#   - Per-window and per-display capture
#   - Capture stream configuration (frame rate, pixel format, crop rect)
#   - Thumbnail / preview generation
#   - Audio capture from specific applications
#
# The compiled dylib will be loaded by the Electron main process via
# Node.js native addons (node-addon-api / N-API).
#
# TODO: Add source files and link against ScreenCaptureKit.framework,
#       CoreMedia.framework, and CoreVideo.framework.
# ---------------------------------------------------------------------------
