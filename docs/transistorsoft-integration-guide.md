# Transistorsoft guide for Fog Angels

Planning only. The user has selected a native app for both crew and patrons, alongside the existing Fog Angels PWA. No SDK has been installed, license purchased or native build created in this planning pass.

## Recommended approach

Use **Capacitor + Transistorsoft Background Geolocation**. Capacitor can package an existing web interface into iOS/Android apps; the SDK provides the native location engine. This fits our React/Vite frontend while allowing shared feature screens to remain available inside FogAngels.com. Source inspection of the host is still required. [Capacitor installation](https://capacitorjs.com/docs/getting-started), [SDK repository](https://github.com/transistorsoft/capacitor-background-geolocation).

Build one Fog Angels native app with crew and patron roles. Patrons install it for background friend sharing; crew use it to publish the truck position. The PWA can display authorized positions sent by native devices and continues supporting foreground browser sharing. A Home Screen PWA install is not the native application and cannot run this plugin.

| Responsibility | Implementation |
| --- | --- |
| Native location capture | Transistorsoft; explicit permission and active sharing session |
| Native location upload | SDK-native HTTP to our authenticated feature API |
| Who can see a location | Our server-side event, role, friendship and consent rules |
| Maps, friends and truck screens | Shared React components |
| Native push | APNs on iOS / FCM on Android through a native notification integration |
| PWA push | Existing plan's Web Push implementation |
| Photos and optional AI | Our gallery/storage/jobs and separately selected AI provider |

The SDK helps with location collection and offline delivery; it does not supply friend relationships, the public map service, event announcements, photo storage or face matching. Offline locations can upload later, but viewers cannot see a live position from a phone with no data connection.

## 1. Settle ownership and licensing before production

- Choose the Fog Angels app identifier and Apple/Google publishing-account owner before generating release keys. Prefer client-owned store accounts with delegated development access. Use one role-based app unless there is a business reason to split it.
- The current Starter listing is **US$399 for one application**, covering iOS and Android with unlimited users/devices and a perpetual license plus one year of updates. Verify checkout total, framework selection and renewal terms before buying. More separately branded apps can require additional application licenses. [Current pricing](https://docs.transistorsoft.com/purchase/?platform=capacitor), [license terms](https://docs.transistorsoft.com/license/).
- Current v9 requires release licensing on both platforms. Debug builds are usable without a paid license; a 30-day release trial is available. Existing v8 keys do not work unchanged with v9. [SDK repository and evaluation guidance](https://github.com/transistorsoft/capacitor-background-geolocation).
- Native build/release work, developer accounts, SDK licensing and ongoing app updates are cost items to reconcile with the TT$15,000 quotation. The user's native-app choice does not automatically authorize an additional invoice or license purchase. Carnival hosting/support and separately priced AI remain as agreed.

## 2. Start with a small native proof, after plan approval

Use the test site's shared UI code and isolated staging backend. The first build needs only login, a role-appropriate tracking toggle, sharing status and diagnostics. It must prove background tracking on physical iPhone and Android before the full four-feature build.

The setup sequence is:

1. Confirm compatible Node, Capacitor, Xcode, Android Studio and SDK versions from their current requirements; pin the tested combination.
2. Add Capacitor to the frontend/native package, initialize the app ID and create iOS/Android projects. Use the compiled frontend assets as `webDir`; a production native app should bundle its UI.
3. Install the Capacitor-specific SDK, then sync native projects. Do not install the React Native SDK into our React web app.

```sh
# Planned commands once a Capacitor project exists; not executed in this pass.
npm install @transistorsoft/capacitor-background-geolocation
npx cap sync
```

4. Configure iOS signing, required background capabilities and app-specific location/motion permission descriptions. Configure Android permissions, foreground-service behavior/notification and background-permission rationale. Follow the selected version's instructions rather than copying old native settings. [Transistorsoft setup](https://docs.transistorsoft.com/capacitor/setup/).
5. Add native platform detection. Keep browser geolocation as the web implementation and initialize the native SDK once per app process. Connect SDK callbacks to visible UI only; do not make them responsible for background upload correctness.
6. Build and install on test devices. Exercise one complete start → walk/drive → screen lock → reconnect → stop cycle with another device viewing the resulting map.

Use product language such as “Share your location with approved friends during this event, including while the app is in the background.” Crew permission copy should describe sharing the assigned truck location. Request only the permissions needed by the selected sharing mode, at the time the user enables it.

## 3. Add a dedicated native ingestion contract

The existing browser tracker endpoint is not an SDK endpoint. It expects browser-session authentication and a single payload with `lat`, `lng`, `accuracy` and `shareId`; it records server receipt time as `recorded_at`. Sending queued SDK locations directly to it would incorrectly make old points appear fresh.

Design a separate versioned location-ingestion route that:

- Authenticates native uploads with revocable, narrowly scoped device/session credentials. Bind the token to the actual account, event, device and permitted sharing session. Keep secure native credential storage separate from browser cookies. Do not weaken browser CSRF protections to accommodate native clients.
- Uses the SDK's native HTTP upload, local queue and retry handling. Configure bounded persistence, payload size and batches, and a native-compatible token refresh or safe expiry flow. A React timer or JavaScript `fetch` cannot be the sole background sender. Capacitor does not support the SDK's JavaScript headless callbacks. [SDK API](https://docs.transistorsoft.com/capacitor/BackgroundGeolocation/), [HTTP configuration](https://docs.transistorsoft.com/capacitor/HttpConfig/).
- Maps SDK coordinates, accuracy, capture timestamp and UUID to our schema. Preserve `captured_at` separately from `received_at`, validate clock skew/age and deduplicate using device plus location UUID. Freeze the event/sharing-session ID into each queued point at capture time; never attach an old point to a newly started session during replay.
- Stores only locations the active session authorizes. Ignore older points when selecting the current map fix. Define bounded batch and per-device throughput rules instead of applying the existing three-second browser throttle blindly to retries.
- Keeps truck and private friend access policies distinct. Receiving a patron location never authorizes exposing it on the public truck endpoint.
- Defines how the SDK clears terminally discarded queue items and stops a revoked session. Non-2xx responses are retried by the SDK; test a documented queue-clear/stop path so revoked data is not retried forever. Do not acknowledge persistence until a database commit succeeds, or until the API has intentionally discarded an invalid/expired point under its documented policy.

Retain an explicit source distinction in the data model and UI: browser phone, native phone and future hardware GPS. Define which assigned device is the active writer so two crew phones cannot compete unpredictably.

## 4. Make tracking consent and lifecycle explicit

- Start only after the user opts into a specific session. An invitation acceptance alone must not silently enable background collection.
- Use finite sharing duration and event expiry on the server and in the native client. Stop tracking locally, clear queued private points and revoke server sharing when the user stops or logs out. While offline, local collection stops immediately; server revocation takes effect on reconnection or the server's pre-existing expiry, with viewers subject to short freshness limits.
- Prove that native collection expires while JavaScript is suspended. Evaluate the SDK's native time limits/scheduling; if an additional native hook is necessary, include it explicitly. A React countdown and an expired server token alone do not stop collection on an offline phone.
- Make reboot/termination settings deliberate for each role. Do not copy `startOnBoot: true` into patron builds without a consent and expiry design. Test app dismissal, actual force-stop and device reboot separately. The SDK documents different iOS/Android restart behavior; it cannot justify a promise of uninterrupted tracking under every OS state. [Lifecycle configuration](https://docs.transistorsoft.com/capacitor/AppConfig/).
- Retain visible sharing controls and platform indicators. Measure battery use during a realistic Carnival-length rehearsal rather than assuming a fixed drain figure.

## 5. Adjust freshness for motion-aware tracking

Our current backend declares signal loss after 30 seconds without a new fix. Transistorsoft can reduce GPS activity while stationary, so leaving that rule unchanged can falsely suggest a parked truck has lost its signal.

Define separate fields for last location capture, last contact where available, reported motion state and session validity. Tune cadence/freshness against the measured native behavior. Display “Stationary — last reported …” or “No recent update” honestly. Do not hide age, fabricate a new timestamp or assume a stationary report proves the device is still connected. Any heartbeat design must be proven while the native UI is suspended on both platforms. [SDK motion behavior](https://github.com/transistorsoft/capacitor-background-geolocation).

## 6. Keep push transport appropriate to each client

Use one organizer announcement/outbox model, with native device tokens and web subscriptions handled separately. Capacitor's native push integration uses APNs registration on iOS and FCM on Android; Web Push permissions from FogAngels.com do not enroll a native install. Test token rotation, foreground/closed-app delivery, deep links and duplicate suppression for users with both clients. [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications).

## 7. Acceptance and distribution

Before building the complete app, record proof of native upload while moving with the screen locked, correct stationary status, reconnect/replay without false freshness, stop/logout/expiry, permission revocation, and rejection of another user's access. Record supported OS/device versions and battery measurements. Review release-mode behavior as well as debug behavior.

After all four features are complete, test the web and native clients against the same authorization rules. Distribute native betas through TestFlight and a Google Play testing track. Plan production store releases, signing, permission disclosures and review lead time; beta availability is not production approval. [Apple TestFlight](https://developer.apple.com/testflight/), [Capacitor App Store deployment](https://capacitorjs.com/docs/ios/deploying-to-app-store), [Google Play deployment](https://capacitorjs.com/docs/android/deploying-to-google-play).

The next implementation milestone is a minimal native tracking proof after discovery and plan approval. A final event-day release date depends on host access, physical-device results and the native distribution schedule.
