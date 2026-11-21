---
description: "Package map for the Omega account family: browser sign-in, the stored account grant, and the request authentication that chooses between the account sign-in and the API key for every Omega API request."
kind: "package-group"
---

# account/ — Omega account

English | [中文](README.zh.md)

## Summary

The `account/` group signs the user in to Omega through the system browser and keeps the account grant in the local credential store that [`credentials/`](../credentials/README.md) owns. Host consumers never read the token: `ctx.omegaAuth` asks `ctx.omegaAccount` for the credential of one request destination and hands the Omega model routes and web providers its request headers, an invalidation for an HTTP 401, and a signal that aborts at sign-out. The same service releases the API key for consumers the key bills. Clients receive account state through the `account` Remote namespace without credentials.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

Two packages provide the account feature and Omega request authentication; their READMEs cover day-to-day use, and the subsystem reference owns the exhaustive contracts.

| Package | Role | ctx key |
|---|---|---|
| [`omega-account/`](omega-account/README.md) | Browser sign-in, the stored grant, Platform profile, balance, and notification reads, and Host-only request credentials for allowed destinations | `ctx.omegaAccount` |
| [`omega-auth/`](omega-auth/README.md) | Request authentication for every Omega API consumer: orders the API key and the account sign-in by billing, binds each to its deployment, and releases request headers | `ctx.omegaAuth` |

-----

<a id="related-documentation"></a>
## Related documentation

Start with the subsystem reference for the account contracts, then the credential store the grant lives in.

- [Account subsystem reference](../../docs/subsystems/account.md) — sign-in state, request credentials, the Platform session projection, and the generated Cordis surface.
- [Credentials subsystem reference](../../docs/subsystems/credentials.md) — the credential records the grant is stored in.
- [Capability seams](../../docs/capability-seams.md) — the Service Definition / Service Provider / Consumer split this family follows.
- [Generated configuration catalog](../../docs/config-catalog.md#omega-aidsh-omega-account) — every accepted field of the account service.

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
