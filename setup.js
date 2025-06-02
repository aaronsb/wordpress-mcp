#!/usr/bin/env node

import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('🚀 WordPress MCP Server Setup\n');
console.log('This wizard will help you configure your WordPress MCP server.\n');

async function setup() {
  try {
    let skipEnvCreation = false;
    let wpUrl, wpUsername, wpAppPassword;

    // Check if .env already exists
    if (existsSync('.env')) {
      const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('\n✓ Keeping existing .env file.');
        skipEnvCreation = true;
        
            // Try to read existing .env for config examples
        try {
          const { readFileSync } = await import('fs');
          const envContent = readFileSync('.env', 'utf-8');
          const envVars = {};
          envContent.split('\n').forEach(line => {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) {
              envVars[match[1].trim()] = match[2].trim();
            }
          });
          
          // Check if required values exist
          const hasUrl = envVars.WORDPRESS_URL && envVars.WORDPRESS_URL !== '';
          const hasUsername = envVars.WORDPRESS_USERNAME && envVars.WORDPRESS_USERNAME !== '';
          const hasPassword = envVars.WORDPRESS_APP_PASSWORD && envVars.WORDPRESS_APP_PASSWORD !== '';
          
          if (!hasUrl || !hasUsername || !hasPassword) {
            console.log('\n⚠️  Warning: Your .env file appears to be missing required values.');
            console.log('   Consider running setup again and choosing to overwrite.\n');
            wpUrl = 'https://your-site.com';
            wpUsername = 'your-username';
            wpAppPassword = 'your-app-password';
            console.log('📋 Showing configuration examples with placeholder values.\n');
          } else {
            wpUrl = envVars.WORDPRESS_URL;
            wpUsername = envVars.WORDPRESS_USERNAME;
            wpAppPassword = envVars.WORDPRESS_APP_PASSWORD;
            console.log('\n📋 Using values from existing .env for configuration examples.\n');
          }
        } catch (e) {
          // If we can't read .env, use placeholder values
          wpUrl = 'https://your-site.com';
          wpUsername = 'your-username';
          wpAppPassword = 'your-app-password';
          console.log('\n📋 Showing configuration examples with placeholder values.\n');
        }
      }
    }

    // Only collect details if we're creating/updating .env
    if (!skipEnvCreation) {
      // Collect WordPress details
      console.log('\n📝 WordPress Configuration\n');
      
      wpUrl = await question('WordPress Site URL (e.g., https://example.com): ');
      if (!wpUrl.startsWith('http')) {
        console.error('\n❌ Error: URL must start with http:// or https://');
        process.exit(1);
      }

      wpUsername = await question('WordPress Username: ');
      
      console.log('\n💡 Tip: Use Application Passwords for better security.');
      console.log('   Generate one at: Users > Your Profile > Application Passwords\n');
      
      wpAppPassword = await question('WordPress Application Password: ');
    }

    // Ask about default personality
    console.log('\n🎭 Default Personality Selection\n');
    console.log('1. Contributor - Limited tools for content creation');
    console.log('2. Author - Full authoring capabilities (recommended)');
    console.log('3. Administrator - Complete site management\n');
    
    const personalityChoice = await question('Choose default personality (1-3) [2]: ') || '2';
    const personalities = {
      '1': 'contributor',
      '2': 'author',
      '3': 'administrator'
    };
    const defaultPersonality = personalities[personalityChoice] || 'author';

    // Create .env file only if not skipping
    if (!skipEnvCreation) {
      const envContent = `# WordPress site URL (without trailing slash)
WORDPRESS_URL=${wpUrl.replace(/\/$/, '')}

# WordPress authentication
WORDPRESS_USERNAME=${wpUsername}
WORDPRESS_APP_PASSWORD=${wpAppPassword}

# Optional: Default personality if not specified at launch
MCP_PERSONALITY=${defaultPersonality}
`;

      writeFileSync('.env', envContent);
      console.log('\n✅ Created .env file successfully!');
    }

    // Get absolute path for configurations
    const serverPath = resolve(__dirname, 'src/server.js');

    // Show Claude Desktop configuration
    console.log('\n📱 Claude Desktop Configuration\n');
    console.log('Add this to your Claude Desktop config file:');
    console.log('\nmacOS: ~/Library/Application Support/Claude/claude_desktop_config.json');
    console.log('Windows: %APPDATA%\\Claude\\claude_desktop_config.json\n');
    
    const claudeDesktopConfig = {
      mcpServers: {
        "wordpress-author": {
          command: "node",
          args: [
            serverPath,
            `--personality=${defaultPersonality}`
          ]
        }
      }
    };

    console.log('```json');
    console.log(JSON.stringify(claudeDesktopConfig, null, 2));
    console.log('```');
    console.log('\nNote: The server will read credentials from the .env file in:');
    console.log(`      ${__dirname}`);

    // Show Claude Code configuration
    console.log('\n💻 Claude Code Configuration\n');
    console.log('Option 1: Use the CLI command (recommended):\n');
    
    console.log('```bash');
    console.log(`claude mcp add wordpress-author \\`);
    console.log(`  node ${serverPath} \\`);
    console.log(`  --personality=${defaultPersonality}`);
    console.log('```');
    
    console.log('\nOption 2: Manually add to your project\'s .claude/settings.json:\n');
    
    const claudeCodeConfig = {
      mcpServers: {
        "wordpress-author": {
          command: "node",
          args: [
            serverPath,
            `--personality=${defaultPersonality}`
          ]
        }
      }
    };

    console.log('```json');
    console.log(JSON.stringify(claudeCodeConfig, null, 2));
    console.log('```');
    
    console.log('\nNote: The server will read credentials from the .env file in:');
    console.log(`      ${__dirname}`);

    // Final instructions
    console.log('\n🎉 Setup Complete!\n');
    console.log('Next steps:');
    console.log('1. Copy the configuration above to your Claude Desktop or Claude Code settings');
    console.log('2. Restart Claude to load the MCP server');
    console.log('3. Start using WordPress tools in your conversations!\n');
    console.log('Example prompts to try:');
    console.log('- "Create a draft blog post about web development"');
    console.log('- "Show me all my draft posts"');
    console.log('- "Publish the draft with ID 123"');
    
    if (defaultPersonality !== 'administrator') {
      console.log('\n💡 Tip: You can change the personality at any time by modifying');
      console.log('   the --personality parameter in your configuration.');
    }

  } catch (error) {
    console.error('\n❌ Setup error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled.');
  process.exit(0);
});

setup();