# Android Native Migration Workspace (No Expo Go)

This folder is a **clean, separate** React Native CLI migration target for building a standalone Android app (APK/AAB) without Expo Go or expo.dev runtime dependency.

## Important
The current repository snapshot does **not** include the existing frontend source files (`App`, `src`, `components`, navigation, Firebase client app code, auth screens, etc.), so exact logic/UI migration cannot be completed automatically yet.

Included here:
- migration playbook
- native Android/Firebase/signing setup guides
- dependency mapping template
- command checklist for deterministic migration

## What to do next
1. Place your existing Expo/React frontend source into `../main-frontend-source` (or update paths in the scripts).
2. Run the migration checklist in `MIGRATION_STEPS.md`.
3. Validate with the commands in `BUILD_AND_RELEASE.md`.
