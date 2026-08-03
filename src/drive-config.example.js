// Copy this file to src/drive-config.js (already gitignored) and fill in the
// two values below from your Google Cloud Console project. See README.md for
// the full setup checklist (OAuth consent screen, Web application OAuth
// Client ID, Picker API key). Neither value is a secret in the traditional
// sense (both are visible in the browser at runtime either way), but keeping
// drive-config.js out of git avoids baking a specific project's identifiers
// into the repo's history.
window.DRIVE_CONFIG = {
  clientId: "", // OAuth 2.0 Client ID, type "Web application"
  apiKey: "" // API key restricted to the Google Picker API + your app's origins
};
