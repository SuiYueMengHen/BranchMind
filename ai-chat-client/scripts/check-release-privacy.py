#!/usr/bin/env python3
"""Scan tracked release files without printing matching secrets."""
import re
import subprocess
import sys
from pathlib import Path

root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
patterns = {
    'API credential': re.compile(rb'\bsk-[A-Za-z0-9]{20,}'),
    'GitHub token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
    'AWS key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'private key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'credential in URL': re.compile(rb'https?://[^\s/<>:]+:[^\s/<>@]+@'),
    'developer machine path': re.compile(rb'/Users/[A-Za-z0-9._-]+/|/home/[A-Za-z0-9._-]+/'),
}
blocked_parts = {'.branchmind', '.playwright-mcp', 'node_modules', '.next', '.vercel', '.git'}
findings = []
for name in filter(None, paths):
    path = Path(name)
    if (blocked_parts.intersection(path.parts) or
        (path.name.startswith('.env') and path.name != '.env.example') or
        path.suffix.lower() in {'.log', '.pem', '.key', '.p12', '.pfx'} or
        path.name in {'study.json', 'live-validation.json'}):
        findings.append((name, 'private/generated file'))
        continue
    data = (root / path).read_bytes()
    for label, pattern in patterns.items():
        if pattern.search(data):
            findings.append((name, label))
for name, label in findings:
    print(f'BLOCKED: {name} ({label})')
if findings:
    sys.exit(1)
print(f'PASS: {len(list(filter(None, paths)))} tracked files checked; no detected release privacy violations.')
