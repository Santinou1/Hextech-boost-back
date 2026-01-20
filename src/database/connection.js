import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../database.sqlite');

let db = null;
let SQL = null;

export const getDatabase = async () => {
  if (!db) {
    if (!SQL) {
      SQL = await initSqlJs();
    }
    
    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
      console.log(`✅ Loaded existing SQLite database from: ${dbPath}`);
    } else {
      db = new SQL.Database();
      console.log(`✅ Created new SQLite database at: ${dbPath}`);
    }
    
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
};

export const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
};

export const closeDatabase = () => {
  if (db) {
    saveDatabase();
    db.close();
    console.log('✅ Database connection closed');
  }
};
