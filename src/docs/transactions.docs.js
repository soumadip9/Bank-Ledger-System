/**
 * @openapi
 * /api/transactions/:
 *   post:
 *     tags: [Transactions]
 *     summary: Transfer funds between accounts
 *     description: |
 *       Moves money from `fromAccount` to `toAccount` using a **double-entry ledger**
 *       inside a **MongoDB multi-document transaction**.
 *
 *       ## Double-entry behavior
 *       On success the API creates:
 *       - one immutable `Ledger` **debit** on the source account
 *       - one immutable `Ledger` **credit** on the destination account
 *       - a `Transaction` record marked `completed`
 *
 *       ## Idempotency
 *       `idempotencyKey` must be unique. Replaying the same key returns the previous result:
 *       - `completed` → `200` with existing transaction
 *       - `pending` → `200` still pending
 *       - `failed` → `500` asking the client to retry later
 *
 *       ## Guards
 *       - Both accounts must exist and be `active`
 *       - Source ledger balance must be `>= amount`
 *       - Missing required fields → `400`
 *
 *       A transfer success email is sent to the sender when email is configured.
 *
 *       **Auth:** Bearer JWT required. Blacklisted tokens are rejected.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTransferRequest'
 *           example:
 *             fromAccount: 66f0c2a1b4e2a91c5d654321
 *             toAccount: 66f0c2a1b4e2a91c5d654322
 *             amount: 500
 *             idempotencyKey: tx-ada-to-bob-001
 *     responses:
 *       201:
 *         description: Transfer completed and committed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransferResponse'
 *             example:
 *               message: Transaction completed successfully
 *               transaction:
 *                 _id: 66f0c2a1b4e2a91c5dabcdef
 *                 fromAccount: 66f0c2a1b4e2a91c5d654321
 *                 toAccount: 66f0c2a1b4e2a91c5d654322
 *                 amount: 500
 *                 status: completed
 *                 idempotencyKey: tx-ada-to-bob-001
 *       200:
 *         description: Idempotent replay of a pending or completed transfer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransferResponse'
 *             examples:
 *               completed:
 *                 value:
 *                   message: Transaction already completed
 *                   transaction:
 *                     _id: 66f0c2a1b4e2a91c5dabcdef
 *                     status: completed
 *                     idempotencyKey: tx-ada-to-bob-001
 *                     amount: 500
 *               pending:
 *                 value:
 *                   message: Transaction is still pending
 *                   transaction:
 *                     _id: 66f0c2a1b4e2a91c5dabcdef
 *                     status: pending
 *                     idempotencyKey: tx-ada-to-bob-001
 *                     amount: 500
 *       400:
 *         description: Missing fields, inactive account, or insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing:
 *                 value:
 *                   message: Missing required fields
 *               inactive:
 *                 value:
 *                   message: One or both accounts are not active
 *               insufficient:
 *                 value:
 *                   message: 'Insufficient balance. Current balance: 0'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: One or both accounts not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: One or both accounts not found
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       500:
 *         description: Transaction aborted or previous failed idempotency key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               previousFailed:
 *                 value:
 *                   message: Transaction failed previously. Please try again later.
 *               aborted:
 *                 value:
 *                   message: Write conflict during transaction
 */

/**
 * @openapi
 * /api/transactions/system/initial-fund:
 *   post:
 *     tags: [Transactions]
 *     summary: System initial funding (privileged)
 *     description: |
 *       Credits a target account from the **system user's** account.
 *
 *       ## Authorization
 *       Requires a JWT for a user with `systemUser: true` (`authSystemUserMiddleware`).
 *       Normal users receive `401 Unauthorized`.
 *
 *       ## Double-entry + MongoDB transaction
 *       Inside a MongoDB session the API:
 *       1. Resolves the system user's funding account
 *       2. Creates a pending `Transaction`
 *       3. Writes ledger **debit** (system) + **credit** (target)
 *       4. Marks the transaction `completed` and commits
 *
 *       Provide a unique `idempotencyKey` for safe retries.
 *
 *       Seed a system user in MongoDB (`systemUser: true`) and create an account for that user before calling this endpoint.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InitialFundRequest'
 *           example:
 *             toAccount: 66f0c2a1b4e2a91c5d654321
 *             amount: 10000
 *             idempotencyKey: fund-ada-001
 *     responses:
 *       201:
 *         description: Initial funding completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransferResponse'
 *             example:
 *               message: Initial fund transaction completed successfully
 *               transaction:
 *                 _id: 66f0c2a1b4e2a91c5dfund001
 *                 fromAccount: 66f0c2a1b4e2a91c5dsystem1
 *                 toAccount: 66f0c2a1b4e2a91c5d654321
 *                 amount: 10000
 *                 status: completed
 *                 idempotencyKey: fund-ada-001
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Missing required fields
 *       401:
 *         description: Missing/invalid JWT or caller is not a system user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Unauthorized
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Target account or system funding account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               target:
 *                 value:
 *                   message: Account not found
 *               system:
 *                 value:
 *                   message: System user account not found
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

module.exports = {};
