import dotenv from 'dotenv';

dotenv.config();

export const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5434', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'document_base',
    ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
  },
  server: {
    port: parseInt(process.env.SERVER_PORT || '8082', 10),
    host: process.env.SERVER_HOST || '0.0.0.0',
  },
  auth: {
    serviceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8080',
    clientId: process.env.CLIENT_ID || 'document-base-clientid',
    clientSecret: process.env.CLIENT_SECRET || 'document-base-clientsecret',
  },
  upload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '52428800', 10), // 50MB
  },
  skipMigrations: process.env.SKIP_MIGRATIONS === 'true',
};
