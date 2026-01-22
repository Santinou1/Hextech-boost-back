import { initDB, getDB, saveDB, closeDB } from './db.js';
import { createTables } from './schema.js';
import bcrypt from 'bcryptjs';

const recreateDatabase = async () => {
  console.log('🚀 Recreating database with all tables...');
  
  try {
    // Initialize database
    await initDB();
    const db = getDB();
    
    // Create all tables
    createTables(db);
    
    // Save database
    saveDB();
    
    console.log('✅ Database recreated successfully with all tables!');
    console.log('\n📋 Tables created:');
    console.log('   - users');
    console.log('   - booster_profiles');
    console.log('   - booster_pricing');
    console.log('   - booster_bulk_pricing ✨ (NEW)');
    console.log('   - orders');
    console.log('   - matches');
    console.log('   - reviews');
    
    // Seed admin user if needed
    const hashedPassword = bcrypt.hashSync('password123', 10);
    
    try {
      db.run(`
        INSERT OR IGNORE INTO users (email, password, username, role)
        VALUES (?, ?, ?, ?)
      `, ['admin@hextech.com', hashedPassword, 'HextechAdmin', 'admin']);
      
      saveDB();
      console.log('\n✅ Admin user created: admin@hextech.com / password123');
    } catch (error) {
      console.log('\n⚠️  Admin user might already exist');
    }
    
    closeDB();
    console.log('\n✅ Database initialization complete!');
    console.log('🔄 Please restart your server.\n');
    
  } catch (error) {
    console.error('❌ Error recreating database:', error);
    process.exit(1);
  }
};

recreateDatabase();
