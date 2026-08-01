const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Bank Ledger System API',
    version: '1.0.0',
    description: `
Professional banking ledger backend built with Node.js, Express, PostgreSQL, and Sequelize.

## Architecture overview

This API uses a **double-entry ledger**. Account balances are never stored as mutable fields.
Every fund movement creates immutable ledger entries:

- **debit** on the source account
- **credit** on the destination account

Balance is always derived as:

\`balance = sum(credits) − sum(debits)\`

## Authentication

- JWTs are issued on **register** and **login** (\`expiresIn: 3d\`).
- Clients may send the token as:
  - \`Authorization: Bearer <token>\`, or
  - HTTP-only style cookie named \`token\`
- Use the green **Authorize** button in this UI and paste a Bearer token from login to call protected endpoints.

## Token blacklisting

On **logout**, the JWT is stored in PostgreSQL (\`blacklists\`) with an \`expires_at\` timestamp.
Auth middleware rejects non-expired blacklisted tokens. Expired rows are cleaned up opportunistically.

## Idempotency

Transfer endpoints require a unique \`idempotencyKey\`. Retries with the same key return the previous
outcome instead of moving money twice.

## ACID transactions (PostgreSQL)

User transfers and system funding run inside Sequelize/PostgreSQL transactions so transaction records
and ledger entries commit or roll back together (Atomicity, Consistency, Isolation, Durability).
    `.trim(),
    contact: {
      name: 'Bank Ledger System',
      url: 'https://github.com/soumadip9/Bank-Ledger-System',
    },
    license: {
      name: 'ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
    {
      url: 'https://bank-ledger-system-trq8.onrender.com',
      description: 'Render production',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Service health and readiness checks',
    },
    {
      name: 'Authentication',
      description: 'User registration, login, logout, JWT issuance, and token blacklisting',
    },
    {
      name: 'Accounts',
      description: 'Bank account lifecycle and ledger-derived balances',
    },
    {
      name: 'Transactions',
      description: 'Double-entry transfers, system funding, idempotency, and MongoDB transactions',
    },
  ],
  // Applied globally; public routes override with `security: []` in docs.
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token from `/api/auth/login` or `/api/auth/register`. Paste the raw token value (Swagger adds the `Bearer` prefix). Cookies named `token` are also accepted by the API.',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d123456',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'ada@example.com',
          },
          name: {
            type: 'string',
            example: 'Ada Lovelace',
          },
          systemUser: {
            type: 'boolean',
            description: 'Privileged funding user flag (immutable after create)',
            example: false,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      UserPublic: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d123456',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'ada@example.com',
          },
          name: {
            type: 'string',
            example: 'Ada Lovelace',
          },
        },
      },
      Account: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d654321',
          },
          user: {
            type: 'string',
            description: 'ObjectId of the owning User',
            example: '66f0c2a1b4e2a91c5d123456',
          },
          status: {
            type: 'string',
            enum: ['active', 'frozen', 'closed'],
            example: 'active',
          },
          currency: {
            type: 'string',
            example: 'INR',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5dabcdef',
          },
          fromAccount: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d654321',
          },
          toAccount: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d654322',
          },
          amount: {
            type: 'number',
            minimum: 0,
            example: 500,
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed'],
            example: 'completed',
          },
          idempotencyKey: {
            type: 'string',
            description: 'Client-supplied unique key that prevents duplicate transfers',
            example: 'tx-ada-to-bob-001',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Ledger: {
        type: 'object',
        description:
          'Immutable double-entry ledger line. Entries cannot be updated or deleted. Balance is computed from these rows.',
        properties: {
          _id: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5dledger1',
          },
          account: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d654321',
          },
          amount: {
            type: 'number',
            minimum: 0,
            example: 500,
          },
          transaction: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5dabcdef',
          },
          type: {
            type: 'string',
            enum: ['credit', 'debit'],
            example: 'debit',
          },
        },
      },
      Blacklist: {
        type: 'object',
        description:
          'Blacklisted JWT stored after logout. `expiresAt` matches the JWT exp claim; expired rows are purged on auth checks.',
        properties: {
          _id: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5dblack01',
          },
          token: {
            type: 'string',
            description: 'Full JWT string that is no longer accepted',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'TTL expiry matching the JWT `exp` claim',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Unauthorized',
          },
          status: {
            type: 'string',
            example: 'failed',
            description: 'Optional status field used by some error responses',
          },
        },
        required: ['message'],
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: {
            type: 'string',
            example: 'Ada Lovelace',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'ada@example.com',
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 6,
            example: 'secret123',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'ada@example.com',
          },
          password: {
            type: 'string',
            format: 'password',
            example: 'secret123',
          },
        },
      },
      CreateAccountRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'Primary Savings',
          },
          description: {
            type: 'string',
            example: 'Everyday banking account',
          },
        },
      },
      CreateTransferRequest: {
        type: 'object',
        required: ['fromAccount', 'toAccount', 'amount', 'idempotencyKey'],
        properties: {
          fromAccount: {
            type: 'string',
            description: 'Source account ObjectId',
            example: '66f0c2a1b4e2a91c5d654321',
          },
          toAccount: {
            type: 'string',
            description: 'Destination account ObjectId',
            example: '66f0c2a1b4e2a91c5d654322',
          },
          amount: {
            type: 'number',
            minimum: 0,
            example: 500,
          },
          idempotencyKey: {
            type: 'string',
            example: 'tx-ada-to-bob-001',
          },
        },
      },
      InitialFundRequest: {
        type: 'object',
        required: ['toAccount', 'amount', 'idempotencyKey'],
        properties: {
          toAccount: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d654321',
          },
          amount: {
            type: 'number',
            minimum: 0,
            example: 10000,
          },
          idempotencyKey: {
            type: 'string',
            example: 'fund-ada-001',
          },
        },
      },
      RegisterResponse: {
        type: 'object',
        properties: {
          user: {
            $ref: '#/components/schemas/UserPublic',
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          user: {
            $ref: '#/components/schemas/UserPublic',
          },
          token: {
            type: 'string',
            description: 'JWT to use with Bearer auth (also set as `token` cookie)',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
      LogoutResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Logged out successfully',
          },
        },
      },
      BalanceResponse: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            example: '66f0c2a1b4e2a91c5d654321',
          },
          balance: {
            type: 'number',
            description: 'Computed as sum(credits) − sum(debits) from Ledger entries',
            example: 1500,
          },
        },
      },
      TransferResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Transaction completed successfully',
          },
          transaction: {
            $ref: '#/components/schemas/Transaction',
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'ok',
          },
          message: {
            type: 'string',
            example: 'Bank Ledger System is running',
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request — validation failed or business rule violated',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: {
              missingFields: {
                value: { message: 'Missing required fields' },
              },
              insufficientBalance: {
                value: { message: 'Insufficient balance. Current balance: 0' },
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized — missing, invalid, expired, or blacklisted JWT',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { message: 'Unauthorized' },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden — authenticated but not allowed to access this resource',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { message: 'You are not authorized to view this account' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: {
              user: { value: { message: 'User not found' } },
              account: { value: { message: 'Account not found' } },
            },
          },
        },
      },
      UnprocessableEntity: {
        description: 'Unprocessable entity — semantic validation failure',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { message: 'Email already exists', status: 'failed' },
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              message: 'Transaction failed previously. Please try again later.',
            },
          },
        },
      },
    },
  },
};

const docsGlob = path
  .resolve(__dirname, '../docs/**/*.js')
  .replace(/\\/g, '/');

const options = {
  definition: swaggerDefinition,
  apis: [docsGlob],
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerUiOptions = {
  customSiteTitle: 'Bank Ledger System API Docs',
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 24px 0; }
    .swagger-ui .info .title { font-size: 2rem; }
    .swagger-ui .scheme-container { background: #fafafa; box-shadow: none; padding: 16px 0; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
  },
};

/**
 * Mounts Swagger UI and the raw OpenAPI JSON without embedding config in app.js.
 * @param {import('express').Express} app
 */
function setupSwagger(app) {
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(swaggerSpec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

module.exports = {
  swaggerSpec,
  setupSwagger,
};
