# ---------------------------------------------------------------------------
# Windows Native Helpers — WGC (Windows.Graphics.Capture) Module
#
# This directory will contain the C++/WinRT sources that use the
# Windows.Graphics.Capture API (Windows 10 1903+) to perform:
#
#   - Per-window and per-monitor capture via GraphicsCaptureItem
#   - Direct3D 11 frame pool management
#   - Cursor rendering toggle
#   - Border/yellow-outline suppression (Win 11+)
#
# The compiled DLL will be loaded by the Electron main process via
# Node.js native addons (node-addon-api / N-API).
#
# TODO: Add source files, configure C++/WinRT, and link against
#       WindowsApp.lib and d3d11.lib.
# ---------------------------------------------------------------------------
