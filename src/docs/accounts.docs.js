/**
 * @openapi
 * /api/account/:
 *   post:
 *     tags: [Accounts]
 *     summary: Create a bank account
 *     description: |
 *       Creates a new account owned by the authenticated user.
 *
 *       Persisted account fields from the Account model:
 *       - `user` (from JWT)
 *       - `status` (default `active`)
 *       - `currency` (default `INR`)
 *
 *       Request body may include `name` / `description` as accepted by the controller.
 *
 *       **Auth:** Bearer JWT required. Blacklisted tokens are rejected.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAccountRequest'
 *           example:
 *             name: Primary Savings
 *             description: Everyday banking account
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *             example:
 *               _id: 66f0c2a1b4e2a91c5d654321
 *               user: 66f0c2a1b4e2a91c5d123456
 *               status: active
 *               currency: INR
 *               createdAt: 2026-08-01T00:00:00.000Z
 *               updatedAt: 2026-08-01T00:00:00.000Z
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/account/balance/{accountId}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get ledger-derived account balance
 *     description: |
 *       Returns the balance for an account **owned by** the authenticated user.
 *
 *       ## Balance calculation (double-entry ledger)
 *
 *       Balance is **not** a stored mutable field. It is computed by aggregating immutable
 *       `Ledger` entries for the account:
 *
 *       `balance = sum(credits) − sum(debits)`
 *
 *       This keeps the ledger append-only and auditable.
 *
 *       Returns `403` if the account does not exist or belongs to another user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the account
 *         example: 66f0c2a1b4e2a91c5d654321
 *     responses:
 *       200:
 *         description: Balance computed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BalanceResponse'
 *             example:
 *               accountId: 66f0c2a1b4e2a91c5d654321
 *               balance: 1500
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

module.exports = {};
