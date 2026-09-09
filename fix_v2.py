
import os
import re

path = 'C:/Users/surface pro/cheskys/src/components/OnlineMatchView.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix common missing closing brackets in JSX props
# Example: onClick={handleCopyMatchId -> onClick={handleCopyMatchId}
# We look for prop={functionName (no closing brace before comma or newline)
content = re.sub(r'onClick=\{([a-zA-Z0-9_]+)\s*(\n|,|})', r'onClick={\1}\2', content)
content = re.sub(r'onClose=\{([a-zA-Z0-9_]+)\s*(\n|,|})', r'onClose={\1}\2', content)
content = re.sub(r'onRematch=\{([a-zA-Z0-9_]+)\s*(\n|,|})', r'onRematch={\1}\2', content)
content = re.sub(r'onAcceptRematch=\{([a-zA-Z0-9_]+)\s*(\n|,|})', r'onAcceptRematch={\1}\2', content)
content = re.sub(r'onAnalyze=\{([a-zA-Z0-9_]+)\s*(\n|,|})', r'onAnalyze={\1}\2', content)
content = re.sub(r'onNewGame=\{([^{}]*)\s*(\n|,|})', r'onNewGame={{\1}}\2', content) # Special case for arrow functions

# 2. Fix socket.emit calls missing closing brace for the object
# Example: socket.emit('...', { ... ); -> socket.emit('...', { ... });
content = re.sub(r"socket\.emit\('[^']*',\s*\{([^}]*)\s*\);", r"socket.emit('\1', { \2 });", content) # Not quite.
# Better: look for socket.emit('...', { ... ) and close the object.
content = re.sub(r"(socket\.emit\('[^']*',\s*\{)([^}]*?)(?=\s*,\s*|\s*\);)", r"\1\2}", content)

# 3. Fix useEffect and useCallback missing closing brace before the dependency array
# Example: useEffect(() => { ... , [deps]) -> useEffect(() => { ... }, [deps])
content = re.sub(r"useEffect\(\(\)\s*=>\s*\{([^}]*?)\s*,\s*\[", r"useEffect(() => { \1 }, [", content)
content = re.sub(r"useCallback\(\(\)\s*=>\s*\{([^}]*?)\s*,\s*\[", r"useCallback(() => { \1 }, [", content)

# 4. Fix function bodies that end abruptly before a comma or closing paren
# Example: const onConnect = () => { ... ; -> const onConnect = () => { ... };
content = re.sub(r"const\s+(\w+)\s*=\s*\(.*?\)\s*=>\s*\{([^}]*?)\s*(?=\n\s*const|\n\s*socket|\n\s*return)", r"\1 = (args) => { \2 };", content) # Too risky.

# 5. Fix specific known broken lines from the Read output
replacements = {
    "onClick={onClose}}": "onClick={onClose}",
    "onClick={onClose": "onClick={onClose}",
    "pgn={session.pgn": "pgn={session.pgn}",
    "rematchState={": "rematchState={", # We'll handle this one differently
}
for old, new in replacements.items():
    content = content.replace(old, new)

# Fix the rematchState block specifically
# It looks like: rematchState={ session.rematchOfferFrom ? ... : 'none'
# We need to close the brace.
content = re.sub(r"rematchState=\{([^}]*?)(?=\s*onRematch)", r"rematchState={ \1 }", content)

# Fix the end of the file
content = content.strip()
if not content.endswith('};'):
    content += '\n};'

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
