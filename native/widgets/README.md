# Native widget integration

These widgets consume only `GET /api/v1/product?view=widget`. No account token, OpenAI login, private quota or user task data is placed in a widget.

## iOS
`ios/ResetWatchWidget.swift` is a real WidgetKit extension source, including small/medium home widgets and the rectangular lock-screen family (iOS 17+).
Create a Widget Extension target inside the signed host app. Add this Swift file and the Info.plist entries; set `ResetWatchAPIOrigin` to the trusted HTTPS deployment origin.
Do not add the widget `@main` declaration to the main app target. Enable the extension in the app build and verify small/medium/lock-screen sizes, light/dark and accessibility.
CI typechecks against a real iOS simulator SDK. This does not produce an IPA or prove host-app integration.
The `.after(15 minutes)` refresh policy is a request to the OS, never a guaranteed exact time. Data timestamps stay visible.

## Android
`android/` is a Gradle Android library with a real AppWidgetProvider and RemoteViews layout, minSdk26/compileSdk35.
Build with JDK17/Gradle8.9: `gradle -p native/widgets/android assembleDebug lintDebug`.
Integrate the resulting AAR into the Android host (or import the module), then override `resetwatch_api_origin` in the host resources.
The library has no launcher activity and is NOT an APK. Receiver ownership, permissions and supported launcher sizes must be checked in a real host app.
HTTP runs off the broadcast/main thread with bounded reads and timeouts; no redirect or credential forwarding. Widget refresh is requested at 30-minute intervals, not real-time alerts.

## HarmonyOS
Copy `harmony/entry/src/main/ets/` and resources into the actual DevEco/uni-app generated Harmony host module.
Merge `harmony/module.merge.json` into its existing `module.json5`; do not overwrite the host's abilities, permissions or unrelated metadata.
Set the compile-time `API_ORIGIN` in ResetWatchFormAbility to the operator-approved deployment origin.
The form returns an unknown placeholder first, then queries the public API and updates via FormKit. The refresh action invokes the local form lifecycle, not a broadcast notification.
The card handles 2*2 and 2*4 layouts. Validate API version, ArkTS typing, resources, clipping, dark mode, accessibility, foldables and lifecycle in DevEco and devices before release.
No HAP, signed host or DevEco compile is claimed by generic source/JSON checks.

## Fail-closed readiness
Empty API origin is deliberate: widgets report unconfigured rather than display fake events.
Official completion timestamp never becomes personal receipt time. A moving app clock does not prove freshness.
No widget is allowed to request personal login or trigger the server's dispatch endpoint.
