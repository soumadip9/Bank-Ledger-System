/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: |
 *       Creates a user account, hashes the password with bcrypt, and issues a JWT
 *       (`expiresIn: 3d`, payload `{ userId }`).
 *
 *       The JWT is set as a `token` cookie. A welcome email is sent via Nodemailer when email OAuth is configured.
 *
 *       **Note:** `systemUser` defaults to `false` and is immutable via the public API.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             name: Ada Lovelace
 *             email: ada@example.com
 *             password: secret123
 *     responses:
 *       201:
 *         description: User registered successfully. JWT cookie is set.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *             example:
 *               user:
 *                 _id: 66f0c2a1b4e2a91c5d123456
 *                 email: ada@example.com
 *                 name: Ada Lovelace
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login and obtain a JWT
 *     description: |
 *       Validates email/password, then issues a JWT (`expiresIn: 3d`).
 *
 *       Response includes:
 *       - JSON body `token` (use with Swagger **Authorize** / Bearer header)
 *       - Cookie `token` (accepted by auth middleware as an alternative)
 *
 *       Paste the returned token into the **Authorize** button to call protected routes.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: ada@example.com
 *             password: secret123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               user:
 *                 _id: 66f0c2a1b4e2a91c5d123456
 *                 email: ada@example.com
 *                 name: Ada Lovelace
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYwYzJhMWI0ZTJhOTFjNWQxMjM0NTYiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDI1OTIwMH0.signature
 *       401:
 *         description: Invalid password or email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Invalid password or email
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: User not found
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout and blacklist the JWT
 *     description: |
 *       Invalidates the current session token using **token blacklisting**:
 *
 *       1. Reads JWT from `Authorization: Bearer <token>` or cookie `token`
 *       2. Verifies the JWT signature and expiry
 *       3. Stores the token in the `Blacklist` collection with `expiresAt` = JWT `exp`
 *       4. Clears the `token` cookie
 *
 *       Expired blacklist rows are purged opportunistically on auth checks.
 *       Subsequent requests with the same JWT receive `401 Unauthorized`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token blacklisted and cookie cleared
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogoutResponse'
 *             example:
 *               message: Logged out successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

module.exports = {};
