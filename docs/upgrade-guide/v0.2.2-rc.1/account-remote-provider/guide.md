---
kind: upgrade-guide
description: "Move account plugin composition and Remote imports to the concrete omega-account service."
---

# Account service and Remote imports

English | [中文](guide.zh.md)

## Change

`@omega-ai/dsh-omega-account` is a concrete `OmegaAccount` service owning browser login, stored credentials, and the `account` Remote namespace. The abstract account class, `@omega-ai/dsh-omega-account-platform`, and `@omega-ai/dsh-api-account-controller` are removed. Existing `ctx.omegaAccount` and `ctx.remote.account` operations retain their names and arguments. Host-only credential methods are not Remote operations. The `/types` entry remains available without loading the service implementation.

Stored credentials keep the `omega-account-platform/default` and `omega-account-platform/device` keys; this package change does not require signing in again.

## Migration

1. Replace `@omega-ai/dsh-omega-account-platform` with `@omega-ai/dsh-omega-account` in custom plugin rows and dependencies. Keep the existing `omega-account` row id and configuration. Remove any `account-controller` row and its package dependency.
2. Import `OmegaAccount` instead of `PlatformAccount`. The class is concrete; custom subclasses of the former abstract account definition must be updated. Existing imports of shared types from `@omega-ai/dsh-omega-account/types` remain valid.
3. Replace old provider or controller `/remote` and `/typert` imports with `@omega-ai/dsh-omega-account/remote` and `@omega-ai/dsh-omega-account/typert`.
4. Import Platform header and cookie helpers from `@omega-ai/dsh-omega-account/client-metadata`. Read the configuration schema from `OmegaAccount.Config`. Stop calling `installAccountTaskCancellation` directly: mounting the service installs it. `isRunningAccountTask` is internal.
5. Rebuild custom compositions and verify login, notification queries, sign-out, and cancellation of account state subscriptions. Confirm that Remote exports omit `resolveToken`, `rejectToken`, `getPlatformSession`, and `getDeviceIdentity`.
