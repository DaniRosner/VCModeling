# Maccabee Ventures Fund II Scenario Model

Static browser app for modeling current and pro forma fund/company outcomes.

## Run Locally

```sh
npm start
```

Then open http://127.0.0.1:4174/.

## Test

```sh
npm test
```

## Deploy to Cloudflare Pages

Recommended private sharing setup:

1. Push this folder to GitHub.
2. In Cloudflare, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select the GitHub repository.
4. Use these build settings:
   - Framework preset: `None`
   - Build command: leave blank
   - Build output directory: `/`
5. Deploy. Cloudflare will create a shareable `*.pages.dev` link.
6. To make it private, go to **Zero Trust** -> **Access** -> **Applications** and add an Access policy for the Pages URL that allows only approved emails or your firm domain.

This app stores scenarios and setup inputs in each user's browser local storage. Users do not share scenarios with each other unless a backend/database is added later.
