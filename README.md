# Bank Ledger System

A Node.js / Express backend for a **double-entry banking ledger**. Money never lives as a mutable balance field. Instead, every movement of funds is recorded as immutable **debit** and **credit** ledger entries. Account balances are always computed by aggregating those entries.

This document walks through the project end to end: concepts, architecture, setup, data models, auth, APIs, and the full money-transfer flow.

---

## Table of contents

1. [What this system does](#1-what-this-system-does)
2. [Core design ideas](#2-core-design-ideas)
3. [Tech stack](#3-tech-stack)
4. [Project structure](#4-project-structure)
5. [Getting started](#5-getting-started)
6. [Environment variables](#6-environment-variables)
7. [Application bootstrap](#7-application-bootstrap)
8. [Data models](#8-data-models)
9. [Authentication & token blacklisting](#9-authentication--token-blacklisting)
10. [API reference](#10-api-reference)
11. [End-to-end money flow](#11-end-to-end-money-flow)
12. [Email notifications](#12-email-notifications)
13. [Security notes](#13-security-notes)
14. [Scripts](#14-scripts)

---

## 1. What this system does

Users can:

| Capability | Description |
|---|---|
| **Register / login / logout** | JWT-based auth with cookie + Bearer header support; logout blacklists the token |
| **Create accounts** | Authenticated users open bank accounts linked to their user |
| **Transfer money** | Move funds between accounts with idempotency and MongoDB transactions |
| **Seed funds (system)** | A privileged `systemUser` can credit initial funds into an account |
| **Check balance** | Balance is derived from the ledger, not stored as a mutable field |
| **Email alerts** | Registration welcome mail and transfer success mail via Gmail OAuth2 |

Typical lifecycle:

```text
Register → Login → Create Account → (System funds account) → Transfer → Check Balance → Logout
```

---

## 2. Core design ideas

### Double-entry ledger

Every completed transfer creates **two** ledger rows:

| Side | Account | Type | Meaning |
|---|---|---|---|
| Sender | `fromAccount` | `debit` | Money leaves this account |
| Receiver | `toAccount` | `credit` | Money enters this account |

Balance for an account:

```text
balance = sum(credits) − sum(debits)
```

Implemented on the Account model via MongoDB aggregation (`getBalance()`).

### Immutability

Ledger entries cannot be updated or deleted. Mongoose middleware on the Ledger model throws if modification/delete hooks are triggered. History is append-only.

### Idempotent transfers

Every transfer requires a unique `idempotencyKey`. Retries with the same key return the previous outcome (`pending` / `completed` / `failed`) instead of creating duplicate money movement.

### Atomic transfers

User-to-user transfers run inside a **MongoDB session transaction**:

1. Create pending transaction
2. Create debit + credit ledger entries
3. Mark transaction `completed`
4. Commit — or abort on failure

This keeps ledger + transaction state consistent.

### Stateless JWT + server-side blacklist

JWTs are issued on register/login (3-day expiry). On logout, the token is stored in a `Blacklist` collection until it expires. Auth middleware rejects blacklisted tokens so a logged-out JWT cannot be reused.

---

## 3. Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (CommonJS) |
| HTTP framework | Express 5 |
| Database | MongoDB via Mongoose 9 |
| Auth | `jsonwebtoken`, `bcryptjs`, `cookie-parser` |
| Email | Nodemailer (Gmail OAuth2) |
| Config | `dotenv` |

---

## 4. Project structure

```text
Bank-Ledger-System/
├── server.js                 # Entry point: load env, connect DB, listen on :3000
├── package.json
├── .gitignore
├── test.js                   # Standalone Mongo connectivity smoke test
└── src/
    ├── app.js                # Express app, middleware, route mounting
    ├── config/
    │   └── db.js             # MongoDB connection helper
    ├── middleware/
    │   └── auth.middleware.js
    ├── models/
    │   ├── user.model.js
    │   ├── account.model.js
    │   ├── transaction.model.js
    │   ├── ledger.model.js
    │   └── blacklist.model.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── account.controller.js
    │   └── transaction.controller.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── account.routes.js
    │   └── transaction.routes.js
    └── services/
        └── email.service.js
```

### Responsibility map

| Folder | Role |
|---|---|
| `config/` | Infrastructure (DB) |
| `models/` | Schemas, invariants, domain helpers (e.g. `getBalance`) |
| `controllers/` | Request validation + orchestration |
| `routes/` | HTTP path → controller wiring + auth guards |
| `middleware/` | Cross-cutting auth checks |
| `services/` | Side effects (email) |

Route prefixes (from `src/app.js`):

| Prefix | Router |
|---|---|
| `/api/auth` | Auth |
| `/api/account` | Accounts + balance |
| `/api/transactions` | Transfers + system funding |

---

## 5. Getting started

### Prerequisites

- Node.js 18+ recommended
- MongoDB Atlas URI (or local MongoDB)
- (Optional) Gmail OAuth2 credentials for email

### Install

```bash
git clone https://github.com/soumadip9/Bank-Ledger-System.git
cd Bank-Ledger-System
npm install
```

### Configure

Create a `.env` file in the project root (see [Environment variables](#6-environment-variables)).

### Run

```bash
# development (auto-reload via nodemon)
npm run dev

# production-style
npm start
```

Server listens on **port 3000**.

Health check of sorts: if Mongo connects, you will see `Connected to MongoDB` in the console. If email OAuth is configured correctly, you will also see `Email server is ready to send messages`.

---

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign/verify JWTs |
| `EMAIL_USER` | For email | Gmail address used as sender |
| `CLIENT_ID` | For email | Google OAuth client ID |
| `CLIENT_SECRET` | For email | Google OAuth client secret |
| `REFRESH_TOKEN` | For email | OAuth refresh token for Nodemailer |

Example `.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<db>
JWT_SECRET=your_strong_random_secret

EMAIL_USER=you@gmail.com
CLIENT_ID=xxxx.apps.googleusercontent.com
CLIENT_SECRET=xxxx
REFRESH_TOKEN=xxxx
```

> Never commit `.env`. It is already listed in `.gitignore`.

---

## 7. Application bootstrap

Startup sequence (`server.js`):

1. Load environment variables with `dotenv`
2. Import Express app (`src/app.js`)
3. Connect to MongoDB (`src/config/db.js`)
4. Listen on port `3000`

Express app setup (`src/app.js`):

1. `express.json()` — parse JSON bodies
2. `cookieParser()` — read auth cookie named `token`
3. Mount routers under `/api/*`

---

## 8. Data models

### User (`User`)

| Field | Type | Notes |
|---|---|---|
| `email` | String | Required, unique, basic email regex |
| `name` | String | Required |
| `password` | String | Required, min 6 chars; hashed with bcrypt on save; excluded from queries by default (`select: false`) |
| `systemUser` | Boolean | Default `false`, **immutable** — marks privileged funding user |
| `createdAt` / `updatedAt` | Date | Via `timestamps` |

Helpers:

- `pre('save')` hashes password when modified
- `comparePassword(candidate)` for login

### Account (`Account`)

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | Owner; indexed |
| `status` | enum | `active` \| `frozen` \| `closed` (default `active`) |
| `currency` | String | Default `INR` |
| timestamps | Date | Created/updated |

Indexes: `{ user: 1, status: 1 }`

Method:

- `getBalance()` — aggregates Ledger credits/debits for this account

### Transaction (`Transaction`)

Represents an attempted or completed money move between two accounts.

| Field | Type | Notes |
|---|---|---|
| `fromAccount` | ObjectId → Account | Source |
| `toAccount` | ObjectId → Account | Destination |
| `amount` | Number | `>= 0` |
| `status` | enum | `pending` \| `completed` \| `failed` |
| `idempotencyKey` | String | **Unique**, required |
| timestamps | Date | Created/updated |

### Ledger (`Ledger`)

Immutable double-entry line item.

| Field | Type | Notes |
|---|---|---|
| `account` | ObjectId → Account | Immutable |
| `amount` | Number | `>= 0`, immutable |
| `transaction` | ObjectId → Transaction | Immutable |
| `type` | enum | `credit` \| `debit`, immutable |

Update/delete hooks throw: *"Ledger entries cannot be modified or deleted"*.

### Blacklist (`Blacklist`)

Stores invalidated JWTs after logout.

| Field | Type | Notes |
|---|---|---|
| `token` | String | Unique, indexed |
| `expiresAt` | Date | TTL index `{ expires: 0 }` — MongoDB auto-deletes after JWT natural expiry |
| timestamps | Date | Created/updated |

---

## 9. Authentication & token blacklisting

### Token issuance

On **register** and **login**:

```text
jwt.sign({ userId }, JWT_SECRET, { expiresIn: "3d" })
```

- Token is set as HTTP cookie: `token`
- Login also returns `token` in the JSON body (useful for Bearer clients / Postman)

### How protected routes authenticate

`authMiddleware` / `authSystemUserMiddleware`:

1. Read token from `req.cookies.token` **or** `Authorization: Bearer <token>`
2. Reject if missing
3. Reject if token exists in `Blacklist`
4. Verify JWT signature + expiry
5. Load user from DB
6. System middleware additionally requires `user.systemUser === true`
7. Attach `req.user` and continue

### Logout flow

`POST /api/auth/logout`:

1. Extract token (cookie or Bearer)
2. Verify JWT
3. Insert into `Blacklist` with `expiresAt = JWT exp` (skip if already blacklisted)
4. Clear `token` cookie
5. Return success

After logout, the same JWT fails all protected routes until Mongo TTL removes the blacklist row (after expiry).

```text
┌─────────┐   login/register    ┌─────────┐
│ Client  │ ──────────────────► │  JWT    │ (cookie / Bearer)
└─────────┘                     └────┬────┘
                                     │
                     logout          │  protected request
                        │            ▼
                        ▼     ┌──────────────┐
                 ┌──────────┐ │ Auth MW      │
                 │Blacklist │ │ 1) blacklist?│──► 401
                 └──────────┘ │ 2) verify JWT│
                              │ 3) load user │
                              └──────────────┘
```

---

## 10. API reference

Base URL: `http://localhost:3000`

Unless noted, send JSON (`Content-Type: application/json`).

For protected routes, include either:

- Cookie: `token=<jwt>`
- Header: `Authorization: Bearer <jwt>`

---

### Auth — `/api/auth`

#### `POST /api/auth/register`

Create a user, set auth cookie, send welcome email.

**Body**

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "secret123"
}
```

**Responses**

| Status | When |
|---|---|
| `201` | User created; returns `{ user: { _id, email, name } }` and sets cookie |
| `422` | Email already exists |

---

#### `POST /api/auth/login`

**Body**

```json
{
  "email": "ada@example.com",
  "password": "secret123"
}
```

**Responses**

| Status | When |
|---|---|
| `200` | `{ user, token }` + cookie |
| `404` | User not found |
| `401` | Invalid password/email |

---

#### `POST /api/auth/logout`

Blacklists the current JWT and clears the cookie.

**Auth:** token required (cookie or Bearer)

**Responses**

| Status | When |
|---|---|
| `200` | `{ message: "Logged out successfully" }` |
| `401` | Missing/invalid token |

---

### Accounts — `/api/account`

#### `POST /api/account/`

Create an account for the authenticated user.

**Auth:** required (`authMiddleware`)

**Body** (as accepted by controller)

```json
{
  "name": "Savings",
  "description": "Primary savings account"
}
```

**Response:** `201` with created account document (linked to `req.user._id`).

---

#### `GET /api/account/balance/:accountId`

Return computed ledger balance for an account **owned by** the authenticated user.

**Auth:** required

**Response `200`**

```json
{
  "accountId": "<ObjectId>",
  "balance": 1500
}
```

**Response `403`** if the account is missing or belongs to another user.

---

### Transactions — `/api/transactions`

#### `POST /api/transactions/`

Transfer funds between two accounts (double-entry + Mongo transaction).

**Auth:** required

**Body**

```json
{
  "fromAccount": "<accountObjectId>",
  "toAccount": "<accountObjectId>",
  "amount": 500,
  "idempotencyKey": "unique-client-key-001"
}
```

**Behavior summary**

1. Validate required fields
2. Load both accounts (+ populate users)
3. If `idempotencyKey` already exists:
   - `failed` → `500` with retry message
   - `completed` → `200` with existing transaction
   - `pending` → `200` with pending transaction
4. Both accounts must be `active`
5. Sender balance must be `>= amount`
6. In a Mongo session: create debit + credit ledgers, mark transaction `completed`, commit
7. Email the sender on success

**Responses**

| Status | Meaning |
|---|---|
| `201` | New transfer completed |
| `200` | Idempotent replay of pending/completed |
| `400` | Missing fields / inactive account / insufficient balance |
| `404` | Account(s) not found |
| `500` | Failure / previously failed idempotency key |

---

#### `POST /api/transactions/system/initial-fund`

Credit an account from the **system user’s** account (seed / treasury funding).

**Auth:** required **and** `systemUser === true` (`authSystemUserMiddleware`)

**Body**

```json
{
  "toAccount": "<accountObjectId>",
  "amount": 10000,
  "idempotencyKey": "fund-ada-001"
}
```

**Notes**

- Source account is resolved as an account owned by the authenticated system user (`user: req.user._id`)
- Creates debit (system) + credit (target) ledger entries inside a session
- Returns `201` on success

You must seed a system user in Mongo with `systemUser: true` and give that user an account before using this endpoint (the field is immutable via normal updates after creation).

---

## 11. End-to-end money flow

### Happy path (manual / Postman)

1. **Register** two users: Alice and Bob  
   `POST /api/auth/register`
2. **Login** as Alice → save token  
   `POST /api/auth/login`
3. **Create** Alice’s account  
   `POST /api/account/`
4. Login as Bob → create Bob’s account
5. Login as **system user** → fund Alice  
   `POST /api/transactions/system/initial-fund`
6. Login as Alice → transfer to Bob  
   `POST /api/transactions/`
7. Check balances  
   `GET /api/account/balance/:accountId`
8. **Logout** Alice  
   `POST /api/auth/logout`  
   Reusing Alice’s old token on a protected route should now return `401`.

### What happens inside a transfer

```text
Client
  │  POST /api/transactions  { from, to, amount, idempotencyKey }
  ▼
authMiddleware ── blacklist? ── verify JWT ── load user
  ▼
createTransaction()
  ├─ load accounts, check active
  ├─ check idempotencyKey history
  ├─ getBalance(from) >= amount ?
  ├─ startSession() / startTransaction()
  │    ├─ Transaction { status: pending }
  │    ├─ Ledger debit  (from)
  │    ├─ Ledger credit (to)
  │    ├─ Transaction status → completed
  │    └─ commitTransaction()
  └─ sendTransactionEmail(sender)
```

### Balance example

After funding Alice with `1000` and transferring `300` to Bob:

| Account | Credits | Debits | Balance |
|---|---|---|---|
| Alice | 1000 | 300 | **700** |
| Bob | 300 | 0 | **300** |
| System | 0 | 1000 | **-1000** (treasury outflow) |

---

## 12. Email notifications

Implemented in `src/services/email.service.js` using Nodemailer + Gmail OAuth2.

| Function | Trigger |
|---|---|
| `sendRegistrationEmail` | After successful register |
| `sendTransactionEmail` | After successful user transfer |
| `transactionFailureEmail` | Available for failure notifications |

Emails are a best-effort side effect. Ensure OAuth credentials are valid; misconfiguration logs errors at startup (`transporter.verify`).

---

## 13. Security notes

- Passwords are hashed with **bcrypt** before save and never returned by default queries.
- JWTs expire in **3 days**; logout adds them to a TTL-backed blacklist.
- Ledger rows are **immutable** at the application/model layer.
- Transfers use **idempotency keys** to reduce double-spend from retries.
- Transfers that mutate money use **MongoDB multi-document transactions** (requires a replica set — Atlas provides this by default).
- `systemUser` is immutable on the schema; treat system credentials carefully.
- Keep `JWT_SECRET` and OAuth secrets out of source control.

---

## 14. Scripts

| Command | Description |
|---|---|
| `npm start` | Start server with Node |
| `npm run dev` | Start with `nodemon` for local development |
| `npm test` | Placeholder (not implemented yet) |

Optional connectivity check:

```bash
node test.js
```

---

## Example cURL snippets

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Alice\",\"email\":\"alice@example.com\",\"password\":\"secret123\"}" \
  -c cookies.txt

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alice@example.com\",\"password\":\"secret123\"}" \
  -c cookies.txt

# Create account
curl -X POST http://localhost:3000/api/account/ \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"name\":\"Alice Main\",\"description\":\"Primary\"}"

# Transfer
curl -X POST http://localhost:3000/api/transactions/ \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"fromAccount\":\"<FROM_ID>\",\"toAccount\":\"<TO_ID>\",\"amount\":100,\"idempotencyKey\":\"tx-001\"}"

# Balance
curl http://localhost:3000/api/account/balance/<ACCOUNT_ID> -b cookies.txt

# Logout (blacklists token)
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

---

## License

ISC

---

## Repository

https://github.com/soumadip9/Bank-Ledger-System
