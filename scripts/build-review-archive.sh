#!/usr/bin/env bash
#
# build-review-archive.sh — build an accurate review zip for external critique.
#
# What it does:
#   Archives the tracked contents of a git ref (default HEAD) via `git archive`,
#   so the zip always matches what's actually committed: no stale duplicates,
#   no missing .github/ or README.md, and (as of #117) the four locked contract
#   assets under references/ that ADR-0028/0029 cite as authority. Everything
#   else in references/ (market research, critiques) stays out — it was never
#   tracked, so `git archive` never sees it.
#
# What it does NOT do:
#   No hand-editing, no working-tree copy. If a file isn't committed, it isn't
#   in the zip — that's the point (issue #117: the old sentinel.zip was a stale
#   hand-zipped working tree).
#
# Usage:
#   scripts/build-review-archive.sh [ref] [output.zip]
#   scripts/build-review-archive.sh                    # HEAD -> ./kimbell-skills-review.zip
#   scripts/build-review-archive.sh main review.zip

set -euo pipefail

REF="${1:-HEAD}"
OUT="${2:-kimbell-skills-review.zip}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

rm -f "$OUT"
git archive --format=zip --prefix=kimbell-skills/ -o "$OUT" "$REF"

echo "Built $OUT from $REF ($(git rev-parse --short "$REF"))."
echo "Contents:"
unzip -l "$OUT" | tail -1
