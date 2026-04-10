#!/bin/bash
# Fetch ES|QL skill from elastic/agent-skills at a pinned version.
# Called via npm postinstall. Re-run manually to update.

set -euo pipefail

VERSION="v0.2.1"
REPO="elastic/agent-skills"
SKILL_PATH="skills/elasticsearch/elasticsearch-esql"
TARGET_DIR="$(dirname "$0")/../vendor/agent-skills/elasticsearch-esql"

# Skip if already fetched at the correct version
STAMP_FILE="$TARGET_DIR/.version"
if [ -f "$STAMP_FILE" ] && [ "$(cat "$STAMP_FILE")" = "$VERSION" ]; then
  exit 0
fi

echo "Fetching $REPO@$VERSION ($SKILL_PATH)..."

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

curl -sL "https://github.com/$REPO/archive/refs/tags/$VERSION.tar.gz" \
  | tar -xz --strip-components=4 -C "$TARGET_DIR" "agent-skills-${VERSION#v}/$SKILL_PATH"

echo "$VERSION" > "$STAMP_FILE"
echo "Synced to $TARGET_DIR"
