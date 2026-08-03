const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error && error.code === 'PGRST116') return false; // Not found? 
  // Wait, if table doesn't exist, supabase usually returns a 404 or something similar.
  if (error && error.message.includes('relation') && error.message.includes('does not exist')) return false;
  if (error) {
    if (error.code === '42P01') return false; // Undefined table
    return false; 
  }
  return true;
}

async function checkColumn(tableName, columnName) {
  const { data, error } = await supabase.from(tableName).select(columnName).limit(1);
  if (error) return false;
  return true;
}

async function run() {
  const tables = ['bd_partnerships', 'content_plans', 'design_requests', 'events', 'permissions'];
  
  for (const table of tables) {
    const exists = await checkTable(table);
    console.log(`Table ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }
  
  const divisiExists = await checkColumn('users', 'divisi');
  console.log(`Column users.divisi: ${divisiExists ? 'EXISTS' : 'MISSING'}`);
}

run();
