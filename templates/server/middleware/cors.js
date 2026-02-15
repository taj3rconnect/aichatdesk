/**
 * @file cors.js — CORS policy configuration
 * @description Configures Cross-Origin Resource Sharing using the AICHATDESK_CORS_ORIGIN
 *   environment variable. Origins are specified as a comma-separated list
 *   (e.g., "http://localhost:3000,https://app.example.com"). Defaults to http://localhost:3000
 *   if not set. Supports wildcard '*' to allow all origins.
 *   Requests with no origin (mobile apps, server-to-server, Postman) are always allowed.
 *   Credentials (cookies, auth headers) are enabled. Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.
 * @requires cors
 */
const cors = require('cors');

/** @type {string[]} Parsed list of allowed origins from env or default */
const allowedOrigins = process.env.AICHATDESK_CORS_ORIGIN
  ? process.env.AICHATDESK_CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = cors(corsOptions);
