// Signs the prebuild-generated Android release build with the keystore held in CI
// secrets, so every APK in a GitHub Release is installable over the previous one.
// Reads ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and
// ANDROID_KEY_PASSWORD from the environment; run it after `expo prebuild`.
const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const required = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`android-signing: missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

let source = fs.readFileSync(gradlePath, 'utf8');

// The Expo template signs release builds with the debug keystore; replace that with
// a release signing config that reads the keystore from the environment.
if (source.includes('signingConfigs.release')) {
  console.log('android-signing: release signing config already present, nothing to do');
  process.exit(0);
}

const signingConfigs = 'signingConfigs {';
const signingIndex = source.indexOf(signingConfigs);
if (signingIndex < 0) {
  console.error('android-signing: could not find signingConfigs in android/app/build.gradle');
  process.exit(1);
}
const releaseBlock = [
  signingConfigs,
  '        release {',
  '            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))',
  '            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")',
  '            keyAlias System.getenv("ANDROID_KEY_ALIAS")',
  '            keyPassword System.getenv("ANDROID_KEY_PASSWORD")',
  '        }',
].join('\n');
source = source.slice(0, signingIndex) + releaseBlock + source.slice(signingIndex + signingConfigs.length);

// The debug build type is declared first and the release build type second, so the
// last occurrence belongs to release.
const debugSigning = 'signingConfig signingConfigs.debug';
const lastIndex = source.lastIndexOf(debugSigning);
if (lastIndex < 0) {
  console.error('android-signing: could not find the release signingConfig line');
  process.exit(1);
}
source = source.slice(0, lastIndex) + 'signingConfig signingConfigs.release' + source.slice(lastIndex + debugSigning.length);

fs.writeFileSync(gradlePath, source);
console.log('android-signing: release build now signs with the CI keystore');
