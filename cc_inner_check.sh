#!/bin/zsh
REPO="/Users/himanshusingh/Documents/championcircuit/championcircuit"

echo "=== REMOTES ==="
git -C "$REPO" remote -v

echo ""
echo "=== GIT LOG (last 5) ==="
git -C "$REPO" log --oneline -5

echo ""
echo "=== STATUS ==="
git -C "$REPO" status --short

echo ""
echo "=== TRACKED TOP-LEVEL DIRS ==="
git -C "$REPO" ls-files | awk -F'/' '{print $1}' | sort -u

echo ""
echo "=== CHECK FOR SENSITIVE TRACKED FILES ==="
git -C "$REPO" ls-files | grep -E '\.env|\.env2|client_secret|\.pem|\.key' || echo "NONE FOUND (safe)"
