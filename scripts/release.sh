#!/usr/bin/env bash
#
# release.sh — cut a kimbell-skills release in one command.
#
# What it does:
#   1. Sets the "version" in .claude-plugin/plugin.json (the single source
#      of truth) to the version you pass.
#   2. Rewrites the "## [Unreleased]" section of CHANGELOG.md into a new
#      dated heading "## [X.Y.Z] - YYYY-MM-DD", then leaves a fresh, empty
#      "## [Unreleased]" section on top for the next PRs to append to.
#
# What it does NOT do:
#   No Changesets, no package.json, no npm publish, no git commit/tag/push. A
#   "release" here is just this version bump landing on the default branch; users
#   pick it up via a marketplace update. Review the diff and commit it yourself.
#
# Usage:
#   scripts/release.sh <new-version>
#   scripts/release.sh 0.2.0
#
# Run it from anywhere; paths are resolved relative to this script.

set -euo pipefail

NEW_VERSION="${1:-}"

if [[ -z "$NEW_VERSION" ]]; then
  echo "usage: $0 <new-version>   (e.g. $0 0.2.0)" >&2
  exit 1
fi

# Validate semver: MAJOR.MINOR.PATCH, each numeric.
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: '$NEW_VERSION' is not a valid MAJOR.MINOR.PATCH version" >&2
  exit 1
fi

# Resolve plugin root (the repo root) from this script's location: scripts/ -> repo root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"
CHANGELOG="$PLUGIN_DIR/CHANGELOG.md"
TODAY="$(date +%Y-%m-%d)"

for f in "$PLUGIN_JSON" "$CHANGELOG"; do
  [[ -f "$f" ]] || { echo "error: not found: $f" >&2; exit 1; }
done

if ! grep -q '^## \[Unreleased\]' "$CHANGELOG"; then
  echo "error: no '## [Unreleased]' section in $CHANGELOG" >&2
  exit 1
fi

# 1. Bump the version in plugin.json (single source of truth).
#    Match the first "version": "..." line and replace its value.
tmp_json="$(mktemp)"
sed -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")/\1${NEW_VERSION}\2/" \
  "$PLUGIN_JSON" > "$tmp_json"
mv "$tmp_json" "$PLUGIN_JSON"

# 2. Promote "## [Unreleased]" to the dated release heading, and insert a fresh,
#    empty Unreleased section above it.
tmp_cl="$(mktemp)"
awk -v ver="$NEW_VERSION" -v today="$TODAY" '
  /^## \[Unreleased\]/ && !done {
    print "## [Unreleased]"
    print ""
    print "## [" ver "] - " today
    done = 1
    next
  }
  { print }
' "$CHANGELOG" > "$tmp_cl"
mv "$tmp_cl" "$CHANGELOG"

echo "Released $NEW_VERSION:"
echo "  - $PLUGIN_JSON version -> $NEW_VERSION"
echo "  - $CHANGELOG: [Unreleased] -> [$NEW_VERSION] - $TODAY"
echo
echo "Review the diff, then commit. No tag/publish is performed."
