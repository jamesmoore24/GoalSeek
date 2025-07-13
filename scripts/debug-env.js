#!/usr/bin/env node

console.log("🔍 GoalSeek Environment Debug");
console.log("=============================");
console.log("");

// Check environment variables
const envVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

console.log("📋 Environment Variables:");
Object.entries(envVars).forEach(([key, value]) => {
  const status = value ? "✅ Set" : "❌ Missing";
  const preview = value ? `${value.substring(0, 20)}...` : "Not set";
  console.log(`   ${key}: ${status} (${preview})`);
});

console.log("");

// Test Supabase connection if variables are set
if (envVars.NEXT_PUBLIC_SUPABASE_URL && envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log("🔗 Testing Supabase connection...");

  const { createClient } = require("@supabase/supabase-js");

  try {
    const supabase = createClient(
      envVars.NEXT_PUBLIC_SUPABASE_URL,
      envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Test a simple query
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("count")
      .limit(1);

    if (error) {
      console.log("❌ Supabase connection failed:");
      console.log("   Error:", error.message);
      console.log("   Code:", error.code);
      console.log("   Details:", error.details);
      console.log("");
      console.log("💡 Possible solutions:");
      console.log("   1. Check if your Supabase URL is correct");
      console.log("   2. Check if your anon key is correct");
      console.log("   3. Make sure you ran the database schema");
      console.log("   4. Check if RLS policies are configured correctly");
    } else {
      console.log("✅ Supabase connection successful!");
      console.log("   Database is accessible");
    }
  } catch (err) {
    console.log("❌ Failed to create Supabase client:");
    console.log("   Error:", err.message);
  }
} else {
  console.log(
    "⚠️  Cannot test Supabase connection - missing environment variables"
  );
}

console.log("");
console.log("📖 Next steps:");
console.log("   1. Make sure your .env file exists and has the correct values");
console.log("   2. Run the database schema in your Supabase SQL editor");
console.log("   3. Check the browser console for detailed error messages");
console.log("   4. Restart the development server after fixing issues");
