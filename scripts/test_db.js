const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('events').select('*').limit(1);
  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("Data columns:", data.length > 0 ? Object.keys(data[0]) : "No data");
  }
}

test();
