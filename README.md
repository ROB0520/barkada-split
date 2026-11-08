# BarkadaSplit

## Overview

BarkadaSplit is a group expense splitter that lives on one phone. You make a group of friends, record what the group spent, and the app splits each expense equally so everyone can see what they owe. There is no server and no login. All data stays on the device.

## Stack

| Tool | Version |
| ---- | ------- |
| Angular | 22 |
| Ionic | 9 |
| Capacitor | 8 |

Money is stored as plain peso numbers like 100.50. What you type is checked
at the edge and shown back formatted as pesos.

Splits are equal and exact to the centavo. Whole-peso totals stay in whole
pesos when they divide evenly — centavos only appear when the expense
itself has them. Any leftover centavos go to the members added first,
and the shares always add up exactly to the total.

## Install

1. Install Node and the Android tools.
2. Run `npm install` to get the app code ready.
3. Run `npx cap sync android` to copy the web build into the Android project.
4. Open the `android` folder in Android Studio and run the app on a phone or emulator.

## Dev commands

| Command | What it does |
| ------- | ------------ |
| `npm run lint` | Checks code style and types. Must stay clean. |
| `npm run test:unit` | Runs the unit tests. |
| `npm run build` | Builds the app for release. |
| `npm run test:e2e` | Runs the shell-path check that the tab bar shows. |

## Android setup

The app id is `com.barkadasplit.app`. After a build, run `npx cap sync android` so the native project picks up the latest web files, then build and run from Android Studio.

## Permissions

- **Camera** — Used only when you take a receipt photo. You can pick from the gallery instead.

Everything else works fully offline.

## Limitations

- Splits are equal only. There is no custom share and no category.
- There is no backup or export. Clearing app data removes everything for good.
- If the device is lost, the data is lost with it.

When an expense does not split evenly, leftover centavos go to the members added first.
