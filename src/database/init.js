import { getDatabase, closeDatabase, saveDatabase } from './connection.js';
import { createTables } from './schema.js';
import bcrypt from 'bcryptjs';

const initDatabase = async () => {
  console.log('🚀 Initializing database...');
  
  const db = await getDatabase();
  
  // Crear tablas
  createTables(db);
  
  // Seed data - usuarios de ejemplo
  const hashedPassword = bcrypt.hashSync('password123', 10);
  
  try {
    // Admin user
    db.run(`
      INSERT OR IGNORE INTO users (email, password, username, role)
      VALUES (?, ?, ?, ?)
    `, ['admin@hextech.com', hashedPassword, 'HextechAdmin', 'admin']);
    
    console.log('✅ Admin user created');
    
    // Client user
    db.run(`
      INSERT OR IGNORE INTO users (email, password, username, role)
      VALUES (?, ?, ?, ?)
    `, ['client@test.com', hashedPassword, 'testclient', 'client']);
    
    // Booster users
    const boosterEmails = [
      { email: 'apexvayne@hextech.com', username: 'ApexVayne' },
      { email: 's14rampage@hextech.com', username: 'S14Rampage' },
      { email: 'midgapgod@hextech.com', username: 'MidGapGod' }
    ];
    
    boosterEmails.forEach(({ email, username }) => {
      db.run(`
        INSERT OR IGNORE INTO users (email, password, username, role)
        VALUES (?, ?, ?, ?)
      `, [email, hashedPassword, username, 'booster']);
    });
    
    // Crear perfiles de boosters
    const boosters = db.exec('SELECT id, username FROM users WHERE role = ?', ['booster']);
    
    const boosterProfiles = [
      {
        display_name: 'ApexVayne',
        current_rank: 'Grandmaster',
        peak_rank: 'Challenger',
        main_roles: 'ADC, Mid',
        main_champions: 'Vayne, Jinx, Kai\'Sa, Ahri',
        languages: 'Español, English',
        server: 'LAS',
        win_rate: 92.5,
        total_orders: 156,
        completed_orders: 148,
        rating: 4.9,
        total_reviews: 142,
        duo_discount: 20,
        bio: 'Challenger ADC main con 5 años de experiencia en boosting. Especializado en carry desde botlane.'
      },
      {
        display_name: 'S14Rampage',
        current_rank: 'Grandmaster',
        peak_rank: 'Grandmaster',
        main_roles: 'Jungle, Top',
        main_champions: 'Lee Sin, Graves, Kha\'Zix, Aatrox',
        languages: 'Español, Português',
        server: 'LAS',
        win_rate: 88.3,
        total_orders: 203,
        completed_orders: 195,
        rating: 4.8,
        total_reviews: 187,
        duo_discount: 20,
        bio: 'Jungle main con enfoque en early game y control de objetivos. Más de 3000 partidas en high elo.'
      },
      {
        display_name: 'MidGapGod',
        current_rank: 'Master',
        peak_rank: 'Grandmaster',
        main_roles: 'Mid, Support',
        main_champions: 'Yasuo, Zed, Syndra, Thresh',
        languages: 'Español',
        server: 'LAS',
        win_rate: 85.7,
        total_orders: 89,
        completed_orders: 84,
        rating: 4.7,
        total_reviews: 76,
        duo_discount: 25,
        bio: 'Mid laner agresivo especializado en assassins. Perfecto para clientes que quieren aprender mientras suben.'
      }
    ];
    
    // Obtener IDs de boosters
    const boosterResults = db.exec('SELECT id, username FROM users WHERE role = ?', ['booster']);
    
    if (boosterResults.length > 0 && boosterResults[0].values) {
      boosterResults[0].values.forEach((row, idx) => {
        if (boosterProfiles[idx]) {
          const profile = boosterProfiles[idx];
          db.run(`
            INSERT OR IGNORE INTO booster_profiles (
              user_id, display_name, current_rank, peak_rank, main_roles, main_champions,
              languages, server, win_rate, total_orders, completed_orders, rating, total_reviews,
              duo_discount, bio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            row[0], // user_id
            profile.display_name,
            profile.current_rank,
            profile.peak_rank,
            profile.main_roles,
            profile.main_champions,
            profile.languages,
            profile.server,
            profile.win_rate,
            profile.total_orders,
            profile.completed_orders,
            profile.rating,
            profile.total_reviews,
            profile.duo_discount,
            profile.bio
          ]);
        }
      });
    }
    
    saveDatabase();
    
    console.log('✅ Seed data inserted successfully');
    console.log('\n📝 Test credentials:');
    console.log('   Admin: admin@hextech.com / password123');
    console.log('   Client: client@test.com / password123');
    console.log('   Booster: apexvayne@hextech.com / password123');
    
  } catch (error) {
    console.error('❌ Error inserting seed data:', error.message);
  }
  
  closeDatabase();
  console.log('✅ Database initialization complete!');
};

initDatabase();
