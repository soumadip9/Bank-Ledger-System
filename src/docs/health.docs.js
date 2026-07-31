/**
 * @openapi
 * /:
 *   get:
 *     tags: [Health]
 *     summary: Service health check
 *     description: |
 *       Returns a simple readiness payload confirming the Express process is running.
 *       This endpoint is public and does not require authentication.
 *     security: []
 *     responses:
 *       200:
 *         description: Service is running
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: ok
 *               message: Bank Ledger System is running
 */

module.exports = {};
