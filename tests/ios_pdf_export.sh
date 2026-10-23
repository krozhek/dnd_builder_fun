#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEVELOPER_DIR=${DEVELOPER_DIR:-$(xcode-select -p)}
if [ ! -x "$DEVELOPER_DIR/usr/bin/simctl" ] && [ -x /Applications/Xcode.app/Contents/Developer/usr/bin/simctl ]; then
  DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
export DEVELOPER_DIR
DEVICE=${1:-$(xcrun simctl list devices booted | awk -F '[()]' '/Booted/{print $2; exit}')}
[ -n "$DEVICE" ] || { echo 'Boot an iOS Simulator first, or pass its UDID.' >&2; exit 1; }
BUNDLE=com.dndbuilder.iospdfcheck
WORK=$(mktemp -d)
APP="$WORK/PdfCheck.app"
OUTPUT=${IOS_PDF_OUTPUT:-/tmp/dnd-builder-ios-sheet.pdf}
cleanup() {
  xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
mkdir -p "$APP"
cp "$ROOT/dnd_builder.html" "$APP/dnd_builder.html"
cat > "$APP/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>PdfCheck</string>
<key>CFBundleIdentifier</key><string>$BUNDLE</string>
<key>CFBundleName</key><string>PdfCheck</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer><integer>2</integer></array>
<key>LSRequiresIPhoneOS</key><true/>
<key>UIApplicationSceneManifest</key><dict><key>UIApplicationSupportsMultipleScenes</key><false/></dict>
</dict></plist>
PLIST
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
ARCH=$(uname -m)
xcrun --sdk iphonesimulator swiftc -parse-as-library -sdk "$SDK" -target "$ARCH-apple-ios17.0-simulator" \
  -framework UIKit -framework WebKit -framework PDFKit \
  "$ROOT/tests/ios_pdf_export.swift" -o "$APP/PdfCheck"
codesign --force --sign - --timestamp=none "$APP"
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" "$BUNDLE" >/dev/null
CONTAINER=$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data)
for _ in $(seq 1 150); do
  [ ! -f "$CONTAINER/Documents/result.txt" ] || break
  sleep 0.2
done
[ -f "$CONTAINER/Documents/result.txt" ] || { echo 'iOS PDF generation timed out.' >&2; exit 1; }
cat "$CONTAINER/Documents/result.txt"
grep -q '^status=ok$' "$CONTAINER/Documents/result.txt" || exit 1
mkdir -p "$(dirname "$OUTPUT")"
cp "$CONTAINER/Documents/sheet.pdf" "$OUTPUT"
printf 'Valid iOS WebKit PDF saved to %s\n' "$OUTPUT"
