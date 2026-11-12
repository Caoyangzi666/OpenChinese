# OpenChinese 自由

An offline Android EPUB reader for Chinese, with adaptive pinyin and personal flashcards.

**Version: 0.1.4-alpha.** This update adds configurable word-press duration (default 0.4 seconds) and dark mode for the app and books. It retains the preceding HSK improvements and paged reading. An earlier version was used on an Android phone and its flashcards worked. This update is checked on desktop and its APK signature is verified; its new gestures and rendering still need confirmation on a phone.

## Features

- Import EPUB files using Android's document picker and keep a private local library. Use **Delete** beside an imported book and confirm to remove its private copy and saved reading position. The original EPUB and saved flashcards remain available. The built-in reading sample cannot be deleted.
- Turn pages by swiping horizontally, tapping the left/right outer 24% of the reading area, or using the footer arrows. Chapter boundaries advance automatically. Choose a chapter, adjust text size and restore the reading position.
- Included CC-CEDICT dictionary: 198,654 indexed headwords. No manual dictionary installation.
- Included non-cumulative HSK1-6 and HSK7-9 files: 10,896 written forms.
- Longest-match segmentation is independent of the selected HSK level. Changing HSK updates ruby visibility in the current page without rebuilding or reopening the EPUB.
- HSK N keeps pinyin for N and above; earlier levels hide it. Genuine non-HSK words keep their available dictionary reading.
- Hold a word continuously for **0.4 seconds by default** to see pinyin, English definitions and context. A short tap never opens the dictionary; releasing early or moving more than 12 pixels cancels the hold. Save a flashcard with an optional personal note. Saving the same written word updates its card.
- Choose **Word press duration** in Settings or reader preferences: 0.3 / 0.4 / 0.5 / 0.7 / 1 second. New and upgraded installs default to 0.4 seconds until a preference is saved.
- Enable **Dark mode** in Settings or reader preferences. It applies immediately to the library, flashcards, dictionary, book text and Android system bars, and survives relaunch. Images retain their original colours.
- Browse and search saved flashcards. Review due cards using Reveal / Again / Good. Again schedules a one-minute retry; Good starts at one day and doubles subsequent successful intervals, capped at 365 days.
- Export and import JSON flashcard backups. Duplicate words are preserved rather than overwritten during import.
- Original 自由 monoline wordmark with an open-book / wings pictogram; editable SVG and PNG included.
- English interface and documentation. No account, analytics, subscription or network permission.

## Install and smoke-test

Requires Android 8.0 or later and an up-to-date Android System WebView. The APK is architecture-independent and contains no native application libraries.

1. If updating, export a flashcard backup first, then **install over the existing app without uninstalling**. The APK uses the same application ID and signing key, so Android should offer an update and retain the private library/cards. Transfer `OpenChinese-v0.1.4-alpha.apk` to the Android device and open it. Complete Android's installation flow yourself, including any install-source permission Android requests. No KOReader plugin is required.
2. Launch OpenChinese. Wait for the included offline dictionary to load. Open **Try the reading sample**.
3. Open the HSK control in the reader and select HSK3, then HSK4. `冬天` must lose its pinyin at HSK4; `共同` must keep it. At HSK5, `共同` must lose its pinyin. Words must not split or merge.
4. Hold `冬天` for the selected duration (0.4 seconds by default), add a note, and choose **Save flashcard**. Leave the reader and open **Flashcards**. The card must be present.
5. Close and reopen the app. The card and note must still be there. Start a review, reveal the answer and choose Good; the card should no longer be due today.
6. In Settings, export the flashcards to a JSON file. Keep this backup before uninstalling the app or clearing app storage. Importing the same backup should not duplicate the word.
7. Import an unencrypted EPUB. Swipe left/right and tap the outer edges to turn pages; a central short tap should do nothing. Hold a word for less than the selected duration and release: no dictionary should open. Hold it continuously for the selected duration: its dictionary should open. Check chapter boundaries, images and reading-position restore after reopening.
8. Check 北京, 想到, 一个, 不是 and 每个人 at HSK6: their pinyin should be hidden. Check a genuine non-HSK word still keeps its reading. Change HSK3 to HSK4: no additional annotations should appear and no words should split or merge.

Data is saved in the app's private storage. Uninstalling or clearing storage removes the local library and flashcards. Flashcard backups include the word, reading, meaning, note, context, source-book label and review schedule; they do not back up the EPUB files.

In Settings, verify **0.4 s (default)** is selected initially. Change the duration, reopen the app and verify it is retained. Try **Dark mode** both in Settings and while reading: the interface and book page must change immediately, with legible pinyin and no change to word boundaries or reading position.

To test deletion, import a book, save a flashcard and return to the library. Choose **Delete**, then **Cancel**: the book must remain. Choose **Delete** again and confirm: the book must disappear, including after restarting, while the flashcard stays. The original EPUB can be imported again.

## Current limits

This is a horizontally paged reader for ordinary reflowable EPUBs, not a full Readium-based reader. The first version does not support DRM, EPUBs containing encrypted or obfuscated fonts, fixed-layout fidelity, vertical Chinese layout, audio, advanced footnotes or a cloud account. The chapter list follows the EPUB spine; titles are updated as chapters are opened. Original EPUB files are not modified.

Segmentation uses deterministic longest dictionary matching. It is not a contextual language model, so ambiguous compounds and polyphonic characters can still receive an unsuitable boundary or first dictionary reading. HSK membership first uses whole tokens and their Simplified/Traditional aliases. 北京 has an explicitly sourced legacy HSK1 supplement. Missing productive forms (selected aspect/result suffixes, simple negation/degree prefixes and quantity forms) receive the highest level of their known parts and are labelled **ESTIMATED HSK**, with the parts shown in the dictionary. These estimates are not official whole-word vocabulary entries. Arbitrary compounds, names and unknown words are not classified by splitting all their characters. An official whole-word entry always takes precedence over an estimate. Coverage is still limited by the supplied syllabus and deterministic rules.

## Project

`app/src/main/java/` contains Android integration and the shared, desktop-testable EPUB importer. `app/src/main/assets/web/` contains the reader interface and Chinese engine. `app/src/main/assets/data/` includes the full dictionary and separate HSK files. `branding/` contains the logo; `preview/` contains desktop screenshots.

Open this directory in Android Studio to build with the included Gradle project (AGP 8.7.3, Gradle 8.9, JDK 17, Android API 35). Alternatively `tools/build_apk.py --toolchain PATH` builds using a JDK and the official Android platform/build-tools extracted in `jdk/`, `platform/`, and `buildtools/` under PATH. Pillow is needed only to resize the launcher icon. The project's signing key is deliberately outside the source ZIP; keep the local alpha keystore for compatible updates.

The included dictionary assets are ready to use. `tools/prepare_data.py` records the conversion used in this workspace; regenerating it requires the preceding StarDict dictionary and HSK data at its documented workspace-relative paths. It is not needed to compile the supplied source.

## Checks performed

- Twelve engine regression groups, including all 10,896 HSK forms, monotonic pinyin, stable boundaries and Simplified/Traditional matching.
- Paged-reading checks: side taps, horizontal swipes, vertical rejection, configurable hold timing, early release, movement cancellation, HSK repagination and position restoration.
- Book deletion checks: confirmation cancellation, native failure, persisted removal, cards retained, reading position cleared, staged rollback, original EPUB and other books preserved, resource cleanup and re-import.
- Browser UI checks: instant HSK change on the same document, flashcard save/reload, review scheduling, backup escaping and EPUB script sanitisation.
- Android-bridge integration simulated in Chromium under the app's content policy: import callback, two chapters, flashcard export, library and position persistence.
- The exact Java EPUB importer tested on the targeted test EPUB and the user's novel (57 spine entries); ZIP path traversal and encrypted EPUB rejection tested.
- Java compilation, DEX generation, APK ZIP integrity, alignment, manifest and v2/v3 signing verification.
- **Not performed for v0.1.4:** device/emulator launch and touch verification on an Android runtime. Desktop checks do not replace this confirmation.

See `DATA-NOTICES.txt` for dictionary and vocabulary sources, licenses and transformations.
