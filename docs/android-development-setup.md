# Android Development Setup

This guide configures the Windows tools required to build and run the React Native tablet application.

## Project location

Run frontend commands from:

```powershell
cd C:\Projects\V2VL\app\frontend
```

## One-time Windows configuration

The Android build uses Java, the Android SDK, ADB, and the Android Emulator. These are machine-level development tools, so configure them as Windows user environment variables instead of adding them to an application `.env` file.

The verified installation paths are:

- Java: `C:\Program Files\Android\Android Studio\jbr`
- Android SDK: `C:\Users\roserbanoiu\AppData\Local\Android\Sdk`

To persist the configuration for future terminals, open PowerShell and run:

```powershell
$javaHome = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

[Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidSdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $androidSdk, 'User')

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = @(
    (Join-Path $javaHome 'bin')
    (Join-Path $androidSdk 'platform-tools')
    (Join-Path $androidSdk 'emulator')
    (Join-Path $androidSdk 'cmdline-tools\latest\bin')
)

foreach ($entry in $entries) {
    if ((Test-Path $entry) -and (($userPath -split ';') -notcontains $entry)) {
        $userPath = (($userPath.TrimEnd(';') + ';' + $entry).TrimStart(';'))
    }
}

[Environment]::SetEnvironmentVariable('Path', $userPath, 'User')
```

Close and reopen PowerShell or VS Code after changing user environment variables. Existing terminals do not automatically reload environment changes.

## Verify the installation

Run these commands in a new PowerShell terminal:

```powershell
java -version
adb version
emulator -list-avds
adb devices
```

The expected setup includes:

- Java responds with a version number.
- ADB responds with its version.
- `Pixel_Tablet` appears in the AVD list.
- A running emulator appears as `device` in the ADB device list, for example `emulator-5554 device`.

If no AVD appears, create one in **Android Studio > Device Manager**. Start the emulator before running the application.

## Run the application

Start Metro from the frontend directory:

```powershell
cd C:\Projects\V2VL\app\frontend
npm start
```

In a second terminal, with the emulator running, build and install the Android application:

```powershell
cd C:\Projects\V2VL\app\frontend
npm run android
```

## Metro port 8081

Metro normally uses port `8081`. If it is already running, keep the existing Metro process and run `npm run android` from another terminal. This avoids starting a second Metro server.

To identify the process listening on port `8081`:

```powershell
Get-NetTCPConnection -LocalPort 8081 -State Listen |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

If the process is a stale Metro instance, it can be stopped with:

```powershell
Stop-Process -Id <process_id> -Force
```

React Native can also use another port when necessary:

```powershell
npm start -- --port 8082
npm run android -- --port 8082
```

## Why this is not an application `.env`

A `.env` file is appropriate for application configuration such as API URLs or non-secret feature flags, when the application explicitly loads it. `JAVA_HOME`, Android SDK paths, and `PATH` must be available to Gradle and native Android tooling before the React Native application starts, so they belong in the Windows user environment instead.
