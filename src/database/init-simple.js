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
      duo_extra_cost REAL DEFAULT 20,
      available BOOLEAN DEFAULT 1,
      bio TEXT,
      avatar_url TEXT,
      specialties TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS booster_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booster_id INTEGER NOT NULL,
      from_rank TEXT NOT NULL,
      from_division TEXT NOT NULL,
      to_rank TEXT NOT NULL,
      to_division TEXT NOT NULL,
      price REAL NOT NULL,
      estimated_hours INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(booster_id, from_rank, from_division, to_rank, to_division)
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS booster_bulk_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booster_id INTEGER NOT NULL UNIQUE,
      league_base_prices TEXT NOT NULL,
      transition_costs TEXT NOT NULL,
      division_overrides TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE
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
      current_division TEXT,
      current_lp INTEGER DEFAULT 0,
      desired_rank TEXT NOT NULL,
      desired_division TEXT,
      desired_lp INTEGER DEFAULT 0,
      wins_requested INTEGER,
      selected_champion TEXT,
      extras TEXT,
      total_price REAL NOT NULL,
      progress_percentage REAL DEFAULT 0,
      estimated_completion_days INTEGER,
      discord_username TEXT,
      summoner_name TEXT,
      server TEXT DEFAULT 'LAS',
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'completed', 'failed')),
      payment_method TEXT CHECK(payment_method IN ('transferencia', 'mercadopago')),
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
      [4, 'ApexVayne', 'Grandmaster', 'Challenger', 'ADC, Mid', 'Vayne, Jinx, Kai\'Sa, Ahri', 'Español, English', 'LAS', 92.5, 156, 148, 4.9, 142, 20, 'Challenger ADC main con 5 años de experiencia en boosting.'],
      [5, 'S14Rampage', 'Grandmaster', 'Grandmaster', 'Jungle, Top', 'Lee Sin, Graves, Kha\'Zix, Aatrox', 'Español, Português', 'LAS', 88.3, 203, 195, 4.8, 187, 20, 'Jungle main con enfoque en early game y control de objetivos.'],
      [6, 'MidGapGod', 'Master', 'Grandmaster', 'Mid, Support', 'Yasuo, Zed, Syndra, Thresh', 'Español', 'LAS', 85.7, 89, 84, 4.7, 76, 25, 'Mid laner agresivo especializado en assassins.']
    ];

    profiles.forEach(p => {
      run(`
        INSERT OR IGNORE INTO booster_profiles (
          user_id, display_name, current_rank, peak_rank, main_roles, main_champions,
          languages, server, win_rate, total_orders, completed_orders, rating, total_reviews,
          duo_extra_cost, bio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, p);
    });

    // Booster bulk pricing - sample pricing configuration (incluyendo Master+)
    // Primero eliminar configuraciones existentes para estos boosters
    run(`DELETE FROM booster_bulk_pricing WHERE booster_id IN (4, 5, 6)`);
    
    const bulkPricing = [
      [
        4, // ApexVayne
        '{"Iron":15,"Bronze":18,"Silver":22,"Gold":28,"Platinum":35,"Emerald":45,"Diamond":60,"Master":80,"Grandmaster":100,"Challenger":120}',
        '{"Iron->Bronze":2,"Bronze->Silver":3,"Silver->Gold":4,"Gold->Platinum":5,"Platinum->Emerald":8,"Emerald->Diamond":12,"Diamond->Master":20}'
      ],
      [
        5, // S14Rampage
        '{"Iron":14,"Bronze":17,"Silver":20,"Gold":26,"Platinum":33,"Emerald":42,"Diamond":55,"Master":75,"Grandmaster":95,"Challenger":115}',
        '{"Iron->Bronze":2,"Bronze->Silver":3,"Silver->Gold":4,"Gold->Platinum":5,"Platinum->Emerald":7,"Emerald->Diamond":11,"Diamond->Master":18}'
      ],
      [
        6, // MidGapGod
        '{"Iron":13,"Bronze":16,"Silver":19,"Gold":24,"Platinum":30,"Emerald":38,"Diamond":50,"Master":70,"Grandmaster":90,"Challenger":110}',
        '{"Iron->Bronze":2,"Bronze->Silver":2,"Silver->Gold":3,"Gold->Platinum":4,"Platinum->Emerald":6,"Emerald->Diamond":10,"Diamond->Master":16}'
      ]
    ];

    bulkPricing.forEach(bp => {
      run(`
        INSERT INTO booster_bulk_pricing (
          booster_id, league_base_prices, transition_costs
        ) VALUES (?, ?, ?)
      `, bp);
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
