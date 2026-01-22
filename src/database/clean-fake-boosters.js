import { initDB, getDB, run, query, saveDB, closeDB } from './db.js';

const cleanFakeBoosters = async () => {
  console.log('🧹 Cleaning fake/hardcoded boosters...');
  
  try {
    await initDB();
    
    // IDs de los boosters hardcodeados
    const fakeBoosterIds = [4, 5]; // S14Rampage y MidGapGod
    
    console.log('\n📋 Current boosters:');
    const allBoosters = query('SELECT user_id, display_name FROM booster_profiles');
    allBoosters.forEach(b => console.log(`   - ID ${b.user_id}: ${b.display_name}`));
    
    // Eliminar perfiles de booster
    for (const id of fakeBoosterIds) {
      run('DELETE FROM booster_profiles WHERE user_id = ?', [id]);
      console.log(`✅ Deleted booster profile for user_id ${id}`);
    }
    
    // Eliminar usuarios
    for (const id of fakeBoosterIds) {
      run('DELETE FROM users WHERE id = ?', [id]);
      console.log(`✅ Deleted user ${id}`);
    }
    
    saveDB();
    
    console.log('\n📋 Remaining boosters:');
    const remainingBoosters = query('SELECT user_id, display_name FROM booster_profiles');
    if (remainingBoosters.length === 0) {
      console.log('   (none - all fake boosters removed)');
    } else {
      remainingBoosters.forEach(b => console.log(`   - ID ${b.user_id}: ${b.display_name}`));
    }
    
    closeDB();
    console.log('\n✅ Cleanup complete!\n');
    
  } catch (error) {
    console.error('❌ Error cleaning boosters:', error);
    process.exit(1);
  }
};

cleanFakeBoosters();
