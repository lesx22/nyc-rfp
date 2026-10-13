---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the pinned rules in [GUIDELINES.md](GUIDELINES.md) (copied from vercel-labs/web-interface-guidelines `command.md`, reviewed and pinned 2026-10-13 instead of fetched live, so the rules can't change without review)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in GUIDELINES.md
4. Output findings in the terse `file:line` format

To refresh the pin: re-download `command.md` from https://github.com/vercel-labs/web-interface-guidelines, review the diff, and replace GUIDELINES.md.

## Usage

When a user provides a file or pattern argument:
1. Read GUIDELINES.md
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
