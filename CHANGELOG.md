# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-02

First tagged release. The app is a local-only journal: every entry, check-in and
memory stays on the device, and chat talks directly to the OpenAI-compatible
provider configured in Settings.

### Added

- Journal, intention and check-in surfaces with a shared chat engine and an
  AI companion that weaves clock, day digests, identity and recalled memory into
  each turn.
- On-device long-term memory: memory files staged on finish, keyword recall over
  manifest headers, atom store, identity profile, day digests, session digests
  and week/month/year rollups.
- Memory graph, Explore ledger and saved insights, backed by the same on-device
  stores.
- Local backup, export and restore of memory files, identity and digests.
- Settings for provider profiles, generation presets, colour themes and
  appearance, with tonal-band sections and light/dark support throughout.
- Expo config plugin that lets release Android builds reach a plain-HTTP chat
  provider.

### Changed

- Replaced the baked-in AI gateway with user-owned provider profiles: no vendor
  host, key or model id is compiled into the app.
- Android `versionCode` is owned by EAS (`appVersionSource: "remote"` plus
  `autoIncrement` on the production profile), so build numbers never need to be
  edited by hand.

### Removed

- Remote auth, cloud memory sync and the managed AI gateway. The app boots
  offline against a device-local account.

[Unreleased]: https://github.com/NoahOsmonth/BlackroseJournal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/NoahOsmonth/BlackroseJournal/releases/tag/v0.1.0
