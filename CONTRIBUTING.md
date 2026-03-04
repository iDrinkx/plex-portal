# Contributing

## Before you start

Please open an issue before starting large changes so scope and direction can be aligned first.

Small fixes such as typo corrections, documentation updates, and targeted bug fixes can usually be submitted directly.

## Pull requests

When opening a pull request:

- keep the change focused
- explain the problem being solved
- describe the approach taken
- include screenshots for UI changes when relevant
- update documentation when behavior or setup changes

## Commits

This repository uses conventional commit style for release automation.

Examples:

- `feat: add calendar filtering`
- `fix: handle missing plex avatar`
- `docs: update unraid setup`
- `chore: clean docker workflow`

## Quality expectations

Before submitting a pull request, make sure:

- the change is tested as far as practical
- existing behavior is not unintentionally broken
- secrets, tokens, and private URLs are not committed
- new configuration is documented in [README.md](./README.md) or another relevant doc

## Security

Do not open a public issue for a security vulnerability.

Report security problems privately using the guidance in [SECURITY.md](./SECURITY.md).
