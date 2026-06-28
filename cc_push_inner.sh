#!/bin/zsh
REPO="/Users/himanshusingh/Documents/championcircuit/championcircuit"

echo "=== Step 1: Untrack sensitive files if tracked ==="
git -C "$REPO" rm --cached backend/env 2>/dev/null && echo "Untracked backend/env" || echo "backend/env was not tracked"
git -C "$REPO" rm --cached backend/champion_circuit.db 2>/dev/null && echo "Untracked backend/champion_circuit.db" || echo "backend/champion_circuit.db was not tracked"
git -C "$REPO" rm --cached champion_circuit.db 2>/dev/null && echo "Untracked champion_circuit.db" || echo "champion_circuit.db was not tracked"

echo ""
echo "=== Step 2: Stage everything ==="
git -C "$REPO" add -A

echo ""
echo "=== Step 3: Status check ==="
git -C "$REPO" status --short | head -30
echo "..."

echo ""
echo "=== Step 4: Commit ==="
git -C "$REPO" commit -m "feat: full updated codebase - backend + frontend with all latest changes"

echo ""
echo "=== Step 5: Push to GitLab (force to replace remote) ==="
git -C "$REPO" push --force origin main

echo ""
echo "=== DONE ==="
