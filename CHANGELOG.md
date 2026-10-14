# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project setup: WXT, React, strict TypeScript, ESLint with architecture boundaries, Prettier, Vitest, Playwright, and GitHub Actions CI.
- Side panel that is enabled only on Overleaf project pages.
- Pixel mascot (a blocky builder in a hard hat) as the toolbar icon. Its face follows the tab: asleep and greyed off Overleaf, a wake-up blink on an Overleaf project, happy while the side panel is open. In the panel its eyes follow the pointer, it blinks, and it hops when clicked (no hop with reduced motion).
- Versioned, validated message protocol between extension contexts.
- ADR-0001 to ADR-0004: build tooling, Overleaf editor access, no content generation, on-device-only AI.
