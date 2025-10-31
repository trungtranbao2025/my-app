# Mobile Build (Android & iOS) with Capacitor

This repo is ready to package the existing React + Vite app for Android and iOS using Capacitor.

## Prerequisites
- Node.js LTS installed
- For Android:
  - Android Studio + SDK + platform tools
  - Java 17 (Bundled with Android Studio recommended)
- For iOS (on macOS only):
  - Xcode + Command Line Tools
  - Cocoapods (`sudo gem install cocoapods`)

## One-time setup
1. Install dependencies
   - `npm install`
2. Initialize Capacitor (creates `android/` and/or `ios/` folders)
   - `npm run cap:add:android` (Android)
   - `npm run cap:add:ios` (iOS, only on macOS)
3. iOS permission messages (after `cap add ios`)
   - Open `ios/App/App/Info.plist` and add:
     - `NSCameraUsageDescription` (OCR: choose image/photo)
     - `NSMicrophoneUsageDescription` (Voice input)

## Build and sync
- Production web build and sync native projects:
  - `npm run mobile:build` (equivalent to `vite build && cap sync`)

## CI Builds (không cần môi trường local)
Đã cấu hình sẵn GitHub Actions:
- Android: `.github/workflows/android-build.yml`
  - Khi chạy sẽ build `app-debug.apk` và thử build `app-release.aab` (unsigned). Artifact được đính kèm ở tab Actions.
- iOS: `.github/workflows/ios-build.yml`
  - Khi chạy sẽ build Debug cho simulator và thử archive Release (unsigned). Artifact (xcarchive) sẽ được đính kèm nếu thành công.

Kích hoạt:
- Tạo một tag `vX.Y.Z` và push, hoặc vào Actions → chọn workflow → Run workflow.

### Ký bản phát hành (Release signing)

Bạn có thể tải về bản phát hành đã ký sẵn bằng cách thêm Secrets trong repo:

Android (Release AAB/APK ký sẵn):
- `ANDROID_KEYSTORE_BASE64`: nội dung base64 của file keystore (.jks/.keystore)
- `ANDROID_KEYSTORE_PASSWORD`: mật khẩu keystore
- `ANDROID_KEY_ALIAS`: alias của key
- `ANDROID_KEY_ALIAS_PASSWORD`: mật khẩu của key

Nếu cung cấp, CI sẽ:
1) Tạo `android/app/release.keystore` từ base64
2) Chèn cấu hình signing vào `android/app/build.gradle`
3) Build `bundleRelease` và `assembleRelease` → upload `app-release.aab` và `app-release.apk`

iOS (IPA ký sẵn - ad-hoc/export):
- `IOS_CERT_P12_BASE64`: nội dung base64 của chứng chỉ ký (.p12)
- `IOS_CERT_PASSWORD`: mật khẩu p12
- `IOS_MOBILEPROVISION_BASE64`: nội dung base64 của provisioning profile (.mobileprovision)
- `IOS_TEAM_ID`: Team ID của Apple
- `IOS_BUNDLE_ID`: Bundle Identifier (ví dụ: com.ibst.qlda)

Nếu cung cấp, CI sẽ:
1) Import chứng chỉ ký
2) Cài đặt provisioning profile
3) Archive Release và export IPA (ad-hoc) → upload `*.ipa`

Ghi chú: Đối với phát hành App Store, bạn có thể đổi ExportOptions sang `app-store` và dùng profile/cert App Store; mình có thể cấu hình thêm nếu cần (Fastlane, upload TestFlight, v.v.).

## Open IDEs and build
- Android: `npm run cap:open:android` → Build/Run from Android Studio
- iOS (macOS): `npm run cap:open:ios` → Build/Run from Xcode

## Notes
- Vite base is already set to `./` in `vite.config.js`, which is required for Capacitor.
- Supabase Auth: Use `https` URLs for callbacks. If using deep links/custom schemes later, configure Associated Domains (iOS) and Intent Filters (Android).
- Microphone/Camera: Voice input uses Web Speech API; OCR uses file input/camera capture. These work inside Capacitor WebView with the permissions noted above.
- If you change web assets, re-run `npm run mobile:build` and rebuild from the IDE.
