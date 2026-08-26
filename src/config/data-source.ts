import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

config({ path: resolve(__dirname, '../../.env') });

const isProd =
  process.env.NODE_ENV === 'PROD' ||
  process.env.NODE_ENV === 'DEPLOY' ||
  process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/*.entity.{js,ts}'],
  migrations: [resolve(__dirname, '../../migrations/*.{js,ts}')],
  synchronize: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  logging: isProd ? ['error', 'warn'] : ['error', 'warn', 'migration'],
});
