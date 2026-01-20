import { initDB, run, saveDB, closeDB } from './db.js';
import bcrypt from 'bcryptjs';

const initDatabase = async () => {
  console.log('🚀 Initializing database...');
  
  await initDB();
  
  // Create tables
  console.log('Creating tables...');
  
  run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('client', 'booster', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS booster_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      current_rank TEXT NOT NULL,
      peak_rank TEXT NOT NULL,
      main_roles TEXT NOT NULL,
      main_champions TEXT,
      languages TEXT NOT NULL,
      server TEXT NOT NULL,
      win_rate REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      completed_orders INTEGER DEFAULT 0,
      rating REAL DEFAULT 5.0,
      total_reviews INTEGER DEFAULT 0,
      price_per_division REAL NOT NULL,
      price_per_win REAL NOT NULL,
      duo_discount REAL DEFAULT 20,
      available BOOLEAN DEFAULT 1,
      bio TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      booster_id INTEGER,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
      boost_type TEXT NOT NULL CHECK(boost_type IN ('solo', 'duo')),
      current_rank TEXT NOT NULL,
      current_division TEXT NOT NULL,
      desired_rank TEXT NOT NULL,
      desired_division TEXT,
      wins_requested INTEGER,
      selected_champion TEXT,
      extras TEXT,
      total_price REAL NOT NULL,
      current_lp INTEGER DEFAULT 0,
      progress_percentage REAL DEFAULT 0,
      estimated_completion_days INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      champion TEXT NOT NULL,
      champion_img TEXT,
      result TEXT NOT NULL CHECK(result IN ('victory', 'defeat')),
      kills INTEGER NOT NULL,
      deaths INTEGER NOT NULL,
      assists INTEGER NOT NULL,
      kda_ratio REAL,
      gold TEXT,
      cs INTEGER,
      cs_per_min REAL,
      duration TEXT NOT NULL,
      level INTEGER,
      lp_change INTEGER NOT NULL,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      booster_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Tables created successfully');

  // Seed data
  console.log('Inserting seed data...');
  const hashedPassword = bcrypt.hashSync('password123', 10);

  try {
    // Admin user
    run(`INSERT OR IGNORE INTO users (email, password, username, role) VALUES (?, ?, ?, ?)`,
      ['admin@hextech.com', hashedPassword, 'admin', 'admin']);
    
    // Client user
    run(`INSERT OR IGNORE INTO users (email, password, username, role) VALUES (?, ?, ?, ?)`,
      ['client@test.com', hashedPassword, 'testclient', 'client']);
    
    // Booster users
    run(`INSERT OR IGNORE INTO users (email, password, username, role) VALUES (?, ?, ?, ?)`,
      ['apexvayne@hextech.com', hashedPassword, 'ApexVayne', 'booster']);
    run(`INSERT OR IGNORE INTO users (email, password, username, role) VALUES (?, ?, ?, ?)`,
      ['s14rampage@hextech.com', hashedPassword, 'S14Rampage', 'booster']);
    run(`INSERT OR IGNORE INTO users (email, password, username, role) VALUES (?, ?, ?, ?)`,
      ['midgapgod@hextech.com', hashedPassword, 'MidGapGod', 'booster']);
    
    // Booster profiles
    const profiles = [
      [4, 'ApexVayne', 'Grandmaster', 'Challenger', 'ADC, Mid', 'Vayne, Jinx, Kai\'Sa, Ahri', 'Español, English', 'LAS', 92.5, 156, 148, 4.9, 142, 25, 15, 20, 'Challenger ADC main con 5 años de experiencia en boosting.'],
      [5, 'S14Rampage', 'Grandmaster', 'Grandmaster', 'Jungle, Top', 'Lee Sin, Graves, Kha\'Zix, Aatrox', 'Español, Português', 'LAS', 88.3, 203, 195, 4.8, 187, 22, 14, 20, 'Jungle main con enfoque en early game y control de objetivos.'],
      [6, 'MidGapGod', 'Master', 'Grandmaster', 'Mid, Support', 'Yasuo, Zed, Syndra, Thresh', 'Español', 'LAS', 85.7, 89, 84, 4.7, 76, 20, 12, 25, 'Mid laner agresivo especializado en assassins.']
    ];

    profiles.forEach(p => {
      run(`
        INSERT OR IGNORE INTO booster_profiles (
          user_id, display_name, current_rank, peak_rank, main_roles, main_champions,
          languages, server, win_rate, total_orders, completed_orders, rating, total_reviews,
          price_per_division, price_per_win, duo_discount, bio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, p);
    });

    console.log('✅ Seed data inserted successfully');
    console.log('\n📝 Test credentials:');
    console.log('   Admin: admin@hextech.com / password123');
    console.log('   Client: client@test.com / password123');
    console.log('   Booster: apexvayne@hextech.com / password123');
    
  } catch (error) {
    console.error('❌ Error inserting seed data:', error.message);
  }
  
  closeDB();
  console.log('✅ Database initialization complete!');
};

initDatabase();
