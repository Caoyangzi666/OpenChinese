# Contributing to OpenChinese

OpenChinese is an alpha Android reader. Please keep changes focused and explain how the result was tested.

## Reporting a bug

Include the app version, Android version, device, steps to reproduce, expected result and actual result. Screenshots or short recordings are helpful. Do not post an entire copyrighted book or private flashcard backup.

For HSK issues, include the exact word, Simplified/Traditional spelling, selected HSK level, expected classification and a short passage you can share. Provide a vocabulary source where possible. Estimated productive forms and legacy supplements should be distinguished from official syllabus entries.

For gesture issues, include the configured hold duration and whether the action was a tap, hold or swipe. For dark mode, include whether the problem appears in the library, dictionary or book page.

## Changing the code

- Keep segmentation independent of the selected HSK threshold.
- Raising HSK level must never introduce new ruby or change word boundaries.
- Preserve word lookup, flashcard data and review schedules across updates.
- Preserve reading position when changing display preferences.
- Keep imported EPUB resources inside private book directories.
- Keep all runtime reading and dictionary functions offline.
- Run tests appropriate to the change; instructions are in docs/DEVELOPMENT.md.

Contributions to application code are under GPL-3.0-only. Data changes must retain their respective CC BY-SA / CC BY notices. Do not add personal EPUBs, credentials, signing keys or machine-specific paths.
