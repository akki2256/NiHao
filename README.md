# NiHao (CALICON)

Internal Android app for projects, tasks, contributors, and expenses.  
Dark CALICON-branded UI. Data lives in **one Google Sheet**. Push via **Expo Push** (free).

## Demo mode (works immediately)

```bash
npm install
npx expo start
```

No Sheet URL needed. Seed logins:

| Name | Username | Password |
|------|----------|----------|
| Akhil | `akhil` | `Calicon@1234` |
| Chiranjeev | `chiranjeev` | `Calicon@1234` |
| Manav | `manav` | `Calicon@1234` |

Login also accepts email or phone + password. After first login, fingerprint unlock is available.

## Connect Google Sheets (production data)

The workbook is the one shared for NiHao. `setupWorkbook` adds any missing tabs and does not delete rows.

1. Open [the NiHao spreadsheet](https://docs.google.com/spreadsheets/d/12_06cUzeK2OQ6gw78-777AftCKdLAfCCxcMCYawcehg/edit). The script must be opened from this file, not from a standalone Apps Script project.
2. In that sheet: **Extensions → Apps Script**. Replace the sample file with `apps-script/Code.gs`.
3. Run **`setupWorkbook`** once and authorize it. This creates the tabs and, only when the contributors tab is empty, the three seed users.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (the script still requires a signed-in session for every read and write)
5. Copy the Web App URL into `.env` (do not paste it into chat):

```env
EXPO_PUBLIC_API_URL=https://script.google.com/macros/s/XXXX/exec
```

6. Restart Expo (`npx expo start -c`). Sign in, then change the shared seed password from the profile screen.

## Push notifications (when app is closed)

1. Create a free Expo account and run:

```bash
npx eas-cli login
npx eas init
```

2. Put the project id into `.env` as `EXPO_PUBLIC_PROJECT_ID` and into `app.json → extra.eas.projectId`.
3. Build a real APK (Expo Go has limited push). Tokens are saved on the `contributors` sheet; Apps Script sends to all users on every add/update.

## Build sideload APK (free tier)

Linked project: https://expo.dev/accounts/calicon-team/projects/NiHao

Latest preview APK (login fix):
https://expo.dev/accounts/calicon-team/projects/NiHao/builds/0bb59271-dcc8-445a-a7d6-c06431cf2db2

```powershell
$env:EAS_NO_VCS='1'
npx eas-cli@latest build -p android --profile preview
```

Open the build page → **Install** / download `.apk` → sideload on phones.

## App map

- **Home** — summary cards → open lists  
- **Projects / Tasks / Expenses / Contributors** — bottom tabs  
- Payments auto-update billing received + pending  
- Offline: last cached snapshot (view only)  
- Logout clears biometric session  

## Brand

Logo from [calicon.in](https://www.calicon.in) (`assets/calicon-logo.png`). App display name: **NiHao**.
