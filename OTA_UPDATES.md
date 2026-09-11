# OTA updates

This app uses `expo-updates` with EAS Update. Android and iOS use runtime version `1`, and updates are checked when the app starts. A downloaded update is applied on the next app launch.

## One-time EAS setup

Run these commands from the project root:

```sh
npx eas-cli@latest login
npx eas-cli@latest update:configure
```

`update:configure` creates or links the EAS project and writes its real project ID and update URL into `app.json`, `AndroidManifest.xml`, and `Expo.plist`.

Commit the generated configuration, then make new preview and production builds.
Existing App Store and Play Store installations do not contain `expo-updates`, so they cannot receive OTA updates until those new binaries are installed.

```sh
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest build --profile production --platform all
```

## Publish an update

Test on the preview channel first:

```sh
npm run update:preview -- --message "Describe the change"
```

After verification, publish the same source to production:

```sh
npm run update:production -- --message "Describe the change"
```

Close and reopen the installed app twice when testing: the first launch checks and downloads, and the next launch applies the update.

## What can be delivered OTA

Use OTA for JavaScript/TypeScript and bundled assets. Make a new store build when a change adds or upgrades a native dependency, changes native Android/iOS code or permissions, or requires a different native runtime. Increment `runtimeVersion` when the native runtime becomes incompatible, and ship matching new binaries before publishing updates for that runtime.
