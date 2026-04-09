cmake_minimum_required(VERSION 3.15)
project(coherence-studio-native-helpers LANGUAGES C CXX)

# ---------------------------------------------------------------------------
# Coherence Studio — Native Helpers
#
# This CMake project builds platform-specific screen-capture and window-
# management helpers that the Electron main process loads at runtime.
#
# Platform modules:
#   macOS   — ScreenCaptureKit-based capture (native/macos/)
#   Windows — Windows.Graphics.Capture (WGC) capture (native/windows/)
#
# Shared utilities live in native/common/.
# ---------------------------------------------------------------------------

# Common headers / utilities available to every platform target
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/common)

# ---- Platform detection & subdirectory routing ----------------------------

if(APPLE)
  message(STATUS "Configuring macOS native helpers (ScreenCaptureKit)")
  add_subdirectory(macos)

elseif(WIN32)
  message(STATUS "Configuring Windows native helpers (WGC)")
  add_subdirectory(windows)

else()
  message(STATUS "No native helpers required for this platform — skipping")
endif()
