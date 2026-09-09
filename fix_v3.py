
import os
import re

path = 'C:/Users/surface pro/cheskys/src/components/OnlineMatchView.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix JSX Prop values that are missing closing braces
# Example: onClick={handleCopyMatchId -> onClick={handleCopyMatchId}
# We target props that start with { and don't have a closing } before the next prop or end of tag.
# This regex finds a prop={something and looks ahead for the next prop or closing tag.
def fix_jsx_props(text):
    # Fix specifically: prop={name -> prop={name}
    # Look for prop={ identifier followed by space/newline/comma
    text = re.sub(r'(\w+)=\{([a-zA-Z0-9_]+)\s*(\n|,|})', r'\1={\2}\3', text)
    # Fix: prop={ {obj... -> prop={{obj...}}
    # This is harder, so we'll target specific ones like result={{
    return text

# 2. Fix useEffect/useCallback missing closing brace before dependencies
# useEffect(() => { ... , [deps]) -> useEffect(() => { ... }, [deps])
def fix_hooks(text):
    # Find useEffect(() => { ... , [
    text = re.sub(r'(useEffect|useCallback)\(\(\)\s*=>\s*\{([^}]*?)\s*,\s*\[', r'\1(() => { \2 }, [', text)
    # Fix those that start with useEffect(() => { but don't have the ()
    text = re.sub(r'(useEffect|useCallback)\(\s*\(.*?\)\s*=>\s*\{([^}]*?)\s*,\s*\[', r'\1((args) => { \2 }, [', text)
    return text

# 3. Fix function bodies that end abruptly
# Look for "const name = () => { ... \n const nextName"
def fix_function_bodies(text):
    # This is risky, but let's try to find cases where a function body is missing a closing brace.
    # We look for "const x = ... => { ... " followed by another "const y = "
    # This is very hard with regex.
    return text

content = fix_jsx_props(content)
content = fix_hooks(content)

# Specific fixes for known issues in this file
replacements = {
    "onClick={onClose}}": "onClick={onClose}",
    "onClick={onClose": "onClick={onClose}",
    "pgn={session.pgn": "pgn={session.pgn}",
    "rematchState={": "rematchState={",
}
for old, new in replacements.items():
    content = content.replace(old, new)

# Fix the rematchState block
content = re.sub(r"rematchState=\{([^}]*?)(?=\s*onRematch)", r"rematchState={ \1 }", content)

# Fix the end of the file
content = content.strip()
if not content.endswith('};'):
    content += '\n};'

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
