#!/usr/bin/env bash
# STUDIO: stage the whisper-stt-server binaries from an artifact of THIS run
# (studio-build.yml's whisper job) into
# electron/native/bin/<tag>/, then hand over to upstream's
# scripts/stage-whisper-stt.sh, which leaves a binary that is already present
# alone and only runs its checks (the libgomp check on Linux).
#
# Usage: stage-whisper-from-artifact.sh <tag> <download dir>
#   tag: darwin-arm64 | darwin-x64 | linux-x64 | win32-x64

set -euo pipefail

TAG="${1:?usage: stage-whisper-from-artifact.sh <tag> <download dir>}"
SRC="${2:?usage: stage-whisper-from-artifact.sh <tag> <download dir>}"
ARTIFACT="whisper-stt-${TAG}"
DEST="electron/native/bin/${TAG}"

# On Windows runners $RUNNER_TEMP is "D:\a\_temp", and Git Bash's GNU tar
# reads "D:..." as host "D" (rsh-style host:path). Use the POSIX form.
if command -v cygpath > /dev/null 2>&1; then
	SRC="$(cygpath -u "${SRC}")"
fi

ARCHIVE="$(find "${SRC}" -name "${ARTIFACT}.tar.gz" -print -quit)"
[ -n "${ARCHIVE}" ] || { echo "FATAL: ${ARTIFACT}.tar.gz not found under ${SRC}" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
tar -xzf "${ARCHIVE}" -C "${TMP}"

mkdir -p "${DEST}"
# Plain cp, like upstream's stage script: it re-expands the artifact's symlink
# farm into regular files before electron-builder sees it.
cp -v "${TMP}/${ARTIFACT}"/* "${DEST}/"

BIN="$(find "${DEST}" -maxdepth 1 -name 'whisper-stt-server*' -print -quit)"
[ -n "${BIN}" ] || { echo "FATAL: no whisper-stt-server binary in ${DEST}" >&2; exit 1; }
case "${TAG}" in win32-*) ;; *) chmod +x "${BIN}" ;; esac

bash scripts/stage-whisper-stt.sh "${TAG}"
