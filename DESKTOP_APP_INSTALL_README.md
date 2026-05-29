# Desktop App Installation Guide

These apps are distributed through GitHub Releases. Download the file for your operating system, then follow the steps below.

## Windows

Use the `*-windows-setup.exe` file for your app.

1. Download the installer:
   - `moneymate-windows-setup.exe`
   - `daftarcha-windows-setup.exe`
2. Double-click the `.exe` file. You do not need to extract anything.
3. If Windows SmartScreen appears, choose **More info**, then **Run anyway**.
4. Choose the installation folder when the installer asks.
5. Finish the installer. A desktop shortcut and Start Menu shortcut should be created.
6. Open the app from the shortcut.

## macOS

Use the `*-mac.dmg` file for your app.

1. Download the disk image:
   - `moneymate-mac.dmg`
   - `daftarcha-mac.dmg`
2. Open the `.dmg` file.
3. Drag the app into the **Applications** folder.
4. Open the app from **Applications**.
5. If macOS blocks the app because it is from an unidentified developer, right-click the app, choose **Open**, then confirm **Open**.
6. If macOS says the app is **damaged** and should be moved to Trash, keep the app in **Applications**, open Terminal, and run one of these commands:

   ```bash
   xattr -dr com.apple.quarantine /Applications/MoneyMate.app
   xattr -dr com.apple.quarantine /Applications/Daftarcha.app
   ```

   Then open the app again from **Applications**.

## Passwords and Local Data

MoneyMate does not ship with a preset password. Create your own account and password when you first open it. You can change the password later in Settings.

Daftarcha stores its business data locally in the app/browser storage. If you use cloud sync, add your own sync endpoint and token in Settings.

## Security Notice

These builds are not code-signed yet. Windows and macOS may show security warnings on first install. macOS may also show a "damaged" warning after browser download because the app is quarantined and not notarized. This does not mean the app is broken; it means the operating system cannot verify the publisher identity yet.

The long-term fix is code signing:

- macOS: Apple Developer ID signing and notarization.
- Windows: trusted code-signing certificate or Microsoft Trusted Signing.
