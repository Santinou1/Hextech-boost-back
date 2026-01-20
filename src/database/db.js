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

export const initDB = async () => {
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
  
  db.run('PRAGMA foreign_keys = ON');
  return db;
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
};

export const saveDB = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
};

export const closeDB = () => {
  if (db) {
    saveDB();
    db.close();
    console.log('✅ Database connection closed');
  }
};

// Helper functions para simular better-sqlite3 API
export const query = (sql, params = []) => {
  const db = getDB();
  const results = db.exec(sql, params);
  
  if (results.length === 0) {
    return [];
  }
  
  const columns = results[0].columns;
  const values = results[0].values;
  
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
};

export const queryOne = (sql, params = []) => {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
};

export const run = (sql, params = []) => {
  const db = getDB();
  
  try {
    // Execute the statement
    db.run(sql, params);
    
    // For INSERT statements, get the last inserted ID
    let lastInsertRowid = null;
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      try {
        const result = db.exec('SELECT last_insert_rowid() as id');
        if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
          lastInsertRowid = Number(result[0].values[0][0]);
        }
      } catch (err) {
        console.error('Error getting last_insert_rowid:', err);
      }
    }
    
    saveDB();
    
    return {
      lastInsertRowid,
      changes: 1
    };
  } catch (error) {
    console.error('Error in run():', error);
    throw error;
  }
};
