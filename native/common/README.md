# native/common

Shared native code used by both the macOS and Windows platform modules.

Planned contents:

- **Frame conversion utilities** -- pixel format conversion (BGRA to NV12, etc.) shared across platforms.
- **N-API binding helpers** -- common macros and helpers for exposing native functions to Node.js via N-API / node-addon-api.
- **Shared type definitions** -- C/C++ header files defining structures (frame metadata, capture options) that both platform modules consume.

This directory is added to the include path by the root `native/CMakeLists.txt`, so any header placed here can be included directly by platform-specific sources.
