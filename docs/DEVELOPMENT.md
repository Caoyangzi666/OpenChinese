# Development

## Standard Android build

Requirements: JDK 17, Android SDK Platform 35, Gradle 8.9 and Android Gradle Plugin 8.7.3 (declared in build.gradle). The Gradle wrapper is not included. Install Gradle 8.9 or configure Android Studio to use a local Gradle installation.

Create an ignored `local.properties` with your Android SDK location, or set `ANDROID_HOME`, then run:

```sh
gradle assembleDebug
```

The debug APK is written under `app/build/outputs/apk/debug/`. Android Studio's normal debug signing can be used. A debug/community key is different from the official alpha key, so it cannot update the official app in place.

## Windows build-tools alternative

`tools/build_apk.py` supports the official Windows Android command-line tools without Gradle. It requires Python 3, Pillow (`python -m pip install Pillow`), JDK 17 and an extracted toolchain organised as:

```text
TOOLCHAIN/
  jdk/JDK_DIRECTORY/bin/java.exe
  platform/PLATFORM_DIRECTORY/android.jar
  buildtools/BUILD_TOOLS_DIRECTORY/aapt2.exe
```

The build-tools directory must also contain zipalign.exe and lib/d8.jar and lib/apksigner.jar. Pass the toolchain location explicitly:

```sh
python tools/build_apk.py --toolchain PATH_TO_TOOLCHAIN
```

For a signed build, set these environment variables locally before running the tool:

```text
OPENCHINESE_KEYSTORE      absolute path to your private keystore
OPENCHINESE_KEY_ALIAS     signing alias
OPENCHINESE_STORE_PASS    keystore password
OPENCHINESE_KEY_PASS      optional; defaults to the store password
```

The tool reads passwords from the environment and does not generate a release key. Never commit the keystore, passwords or local configuration. The official alpha key is intentionally not distributed. Output APK and checksum files go to the ignored `dist/` directory.

## Engine tests

With Node.js 20 or later installed, run:

```sh
npm test
```

This checks all 10,896 HSK forms, monotonic annotation visibility, stable segmentation, Simplified/Traditional aliases, explicit supplements and productive-form classification. No npm packages are required for the engine test.

## Browser tests

Install Playwright locally, including Chromium, then run the isolated test server:

```sh
npm install --no-save playwright
npx playwright install chromium
python tools/test_browser.py
```

The runner starts a temporary localhost server on a free port and stops it after the tests. It checks page gestures, all five hold durations, new/upgrade defaults, dark/light colour restoration, flashcard persistence, deletion and HSK visibility. It does not exercise Android's real file picker or system bars.

An installed Chrome can optionally be selected with `OPENCHINESE_BROWSER_CHANNEL=chrome`. A non-default Node executable can be passed using `--node PATH`.

## Native importer and removal tests

With JDK 17 on PATH, compile the shared importer and its test into an ignored build directory:

```sh
mkdir build
javac -encoding UTF-8 -d build app/src/main/java/org/openchinese/reader/EpubArchive.java tests/EpubArchiveTest.java
java -cp build org.openchinese.reader.EpubArchiveTest PATH_TO_A_TEST_EPUB
```

Use a book you are allowed to test. The test works on temporary imported copies, checks safe extraction, staged removal/rollback and re-import, and preserves the original EPUB. No personal test books are included in this repository.

## Data and assets

The dictionary JSON, HSK JSON, separate TSV vocabulary files and original logo are included. Their conversion and attribution are documented in DATA-NOTICES.txt. The prior workspace-specific data-preparation and packaging helpers are not needed to compile this project and are not included in this publication snapshot.

VALIDATION.json records checks of the v0.1.4-alpha runtime/APK in the original build workspace. It is not a CI badge or proof that a later fork has passed tests. Any modified release needs its own verification.
