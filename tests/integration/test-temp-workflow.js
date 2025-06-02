#!/usr/bin/env node
import { config } from 'dotenv';
import { WordPressClient } from './src/core/wordpress-client.js';
import { FeatureMapper } from './src/core/feature-mapper.js';

// Load environment
config();

async function testTempFileWorkflow() {
  console.log('Testing temp file workflow (MCP tools only)...\n');
  
  try {
    // Initialize client and mapper
    const wpClient = new WordPressClient({
      url: process.env.WORDPRESS_URL,
      username: process.env.WORDPRESS_USERNAME,
      applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
    });
    
    const mapper = new FeatureMapper(wpClient);
    await mapper.initialize();
    
    console.log('🔧 Available semantic operations:');
    const semanticOps = mapper.getSemanticOperations();
    semanticOps.forEach(op => {
      console.log(`  - ${op.name}: ${op.description}`);
    });
    
    // Step 1: Create a test draft (to have something to pull)
    console.log('\n📝 Step 1: Creating test draft...');
    const draftOp = mapper.getOperation('draft-article');
    const draftResult = await draftOp.execute({
      title: 'Temp File Workflow Test',
      content: 'This is the original content that we will edit using the temp file workflow.',
      excerpt: 'Testing temp file editing',
      categories: ['Technology'],
      tags: ['Testing', 'Workflow']
    });
    
    console.log('Draft created:', draftResult);
    const testPostId = draftResult.postId;
    
    // Step 2: Pull for editing (using MCP tool only)
    console.log('\n📥 Step 2: Pulling post for editing...');
    const pullOp = mapper.getOperation('pull-for-editing');
    const pullResult = await pullOp.execute({
      postId: testPostId
    });
    
    console.log('Post pulled for editing:', pullResult);
    
    // Step 3: Simulate local editing 
    // In real usage, Claude would use file editing tools here
    // For testing, we'll simulate what the file would look like after editing
    console.log('\n✏️  Step 3: Simulating local file edits...');
    console.log('(In real usage, Claude would use Edit tool on:', pullResult.filePath);
    console.log('Pretending we made multiple local edits to improve the content...)');
    
    // Simulate edited content - this is what would be in the temp file after editing
    const simulatedEditedContent = `# Temp File Workflow Test - UPDATED

This is the DRAMATICALLY IMPROVED content after multiple local iterations! 

We've added:
- Much better introduction
- Clearer structure 
- More engaging tone
- Additional examples

The temp file workflow allows us to iterate locally without hitting the WordPress API repeatedly.

This is exactly the efficiency gain we wanted!

---
**Post Metadata:**
- Post ID: ${testPostId}
- Status: draft
- Categories: Technology, Testing
- Tags: Testing, Workflow, Efficiency
- Excerpt: Successfully tested temp file editing workflow`;

    // Write the simulated content to the temp file
    // (This simulates what Claude's Edit tool would have done)
    const fs = await import('fs/promises');
    await fs.writeFile(pullResult.filePath, simulatedEditedContent, 'utf8');
    console.log('✓ Simulated local edits complete');
    
    // Step 4: Sync back to WordPress (using MCP tool only)
    console.log('\n📤 Step 4: Syncing changes back to WordPress...');
    const syncOp = mapper.getOperation('sync-to-wordpress');
    const syncResult = await syncOp.execute({
      filePath: pullResult.filePath,
      cleanupFile: true  // Clean up temp file after sync
    });
    
    console.log('Sync result:', syncResult);
    
    console.log('\n✅ Temp file workflow test complete!');
    console.log('Successfully demonstrated:');
    console.log('  1. pull-for-editing → temp file created');
    console.log('  2. Local iterations (simulated)');
    console.log('  3. sync-to-wordpress → changes pushed back');
    console.log('  4. Temp file cleaned up');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testTempFileWorkflow();