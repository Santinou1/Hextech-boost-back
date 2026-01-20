export const createTables = (db) => {
  // Users table - para clientes, boosters y admins
  db.run(`
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

  // Booster Profiles - perfil completo del booster
  db.run(`
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
      duo_discount REAL DEFAULT 20,
      available BOOLEAN DEFAULT 1,
      bio TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Booster Pricing - cotizaciones por rango
  db.run(`
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

  // Booster Bulk Pricing - configuración bulk de precios
  db.run(`
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

  // Orders - órdenes de boost
  db.run(`
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

  // Matches - partidas jugadas en cada orden
  db.run(`
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

  // Reviews - reseñas de clientes a boosters
  db.run(`
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

  // Indexes para mejorar performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_booster_profiles_user_id ON booster_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_booster_profiles_available ON booster_profiles(available);
    CREATE INDEX IF NOT EXISTS idx_booster_pricing_booster_id ON booster_pricing(booster_id);
    CREATE INDEX IF NOT EXISTS idx_booster_bulk_pricing_booster_id ON booster_bulk_pricing(booster_id);
    CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_orders_booster_id ON orders(booster_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_matches_order_id ON matches(order_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_booster_id ON reviews(booster_id);
  `);

  console.log('✅ Database tables created successfully');
};
