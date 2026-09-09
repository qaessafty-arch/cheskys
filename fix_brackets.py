
import os
path = 'C:/Users/surface pro/cheskys/src/components/OnlineMatchView.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix common missing closing characters
replacements = {
    "onClick={onClose": "onClick={onClose}",
    "pgn={session.pgn": "pgn={session.pgn}",
    "rematchState={": "rematchState={", # This one is a bit ambiguous, but let's see.
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
