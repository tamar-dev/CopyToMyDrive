# Setup
1. Enable Developer mode at chrome://extensions and load this folder unpacked. Record the extension ID.
2. In Google Cloud Console create a project, enable Drive API, configure OAuth consent (External/testing; add your test account), and create a Chrome Extension OAuth client using the extension ID.
3. Replace the placeholder client ID in manifest.json and reload the extension.
4. Sign in to the intended Chrome profile. Open a shared Drive link and click the extension, or use the right-click menu on a shared link. Click Copy to my Drive and authorize.

## Limitations
This POC uses the restricted full drive scope, not drive.file, to support arbitrary links. Public distribution requires applicable OAuth verification and Chrome Web Store review. Evaluate a narrower Picker-based approach before release. No live OAuth or browser integration test has been performed. The Chrome profile determines the account, not necessarily the active account in a Gmail tab. Copies are saved to root. Folders and shortcuts are excluded. Run npm test for mocked unit tests.

## Cloud copy service
The extension sends the selected link and the user's Google OAuth access token to `https://tunistslilxckcjxnlrm.supabase.co/functions/v1/drive-copy`. The service must validate requests, enforce source permissions, avoid logging tokens, and return `{id,name}` on success or `{error}` on failure. Live integration testing is required.
