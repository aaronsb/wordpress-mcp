#!/usr/bin/env node
import { config } from 'dotenv';
import { WordPressClient } from './src/core/wordpress-client.js';
import { FeatureMapper } from './src/core/feature-mapper.js';

// Load environment
config();

async function testFullWorkflow() {
  console.log('Testing complete temp file workflow (MCP tools only - no cheating!)...\n');
  
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
    
    // Step 1: Create a test draft
    console.log('\n📝 Step 1: Creating test draft...');
    const draftOp = mapper.getOperation('draft-article');
    const draftResult = await draftOp.execute({
      title: 'Full Workflow Test',
      content: 'This is the original content that needs major improvements. It\'s quite basic and could use more detail.',
      excerpt: 'Testing the complete workflow',
      categories: ['Technology'],
      tags: ['Testing']
    });
    
    console.log('✓ Draft created:', draftResult.title);
    const testPostId = draftResult.postId;
    
    // Step 2: Pull for editing
    console.log('\n📥 Step 2: Pulling post for editing...');
    const pullOp = mapper.getOperation('pull-for-editing');
    const pullResult = await pullOp.execute({
      postId: testPostId
    });
    
    console.log('✓ Post pulled to:', pullResult.fileName);
    const tempFilePath = pullResult.filePath;
    
    // Step 3: Read the temp file (using MCP tool)
    console.log('\n👀 Step 3: Reading temp file content...');
    const readOp = mapper.getOperation('read-document');
    const readResult = await readOp.execute({
      filePath: tempFilePath
    });
    
    console.log('File content:');
    console.log(readResult.content);
    
    // Step 4: Make multiple edits (using MCP edit tool)
    console.log('\n✏️  Step 4: Making multiple local edits...');
    
    const editOp = mapper.getOperation('edit-document');
    
    // Edit 1: Improve the title
    console.log('Edit 1: Updating title...');
    const edit1 = await editOp.execute({
      filePath: tempFilePath,
      oldString: '# Full Workflow Test',
      newString: '# Complete WordPress MCP Workflow Test - IMPROVED'
    });
    console.log('✓', edit1.message);
    
    // Edit 2: Expand the content (using the HTML-encoded version)
    console.log('Edit 2: Expanding content...');
    const edit2 = await editOp.execute({
      filePath: tempFilePath,
      oldString: 'This is the original content that needs major improvements. It&#8217;s quite basic and could use more detail.',
      newString: `This content has been dramatically improved through our temp file workflow!

Key improvements:
- Added structured sections
- Enhanced with technical details  
- Expanded explanations
- Better formatting

The workflow demonstrates:
1. Pull post to local temp file
2. Multiple local iterations using edit-document tool
3. Single sync back to WordPress

This approach is far more efficient than making multiple API calls during editing.`
    });
    console.log('✓', edit2.message);
    
    // Edit 3: Update categories and tags
    console.log('Edit 3: Updating metadata...');
    const edit3 = await editOp.execute({
      filePath: tempFilePath,
      oldString: '- Categories: ',
      newString: '- Categories: Technology, Workflow, Testing'
    });
    console.log('✓', edit3.message);
    
    const edit4 = await editOp.execute({
      filePath: tempFilePath,
      oldString: '- Tags: ',
      newString: '- Tags: Testing, MCP, WordPress, Efficiency, Workflow'
    });
    console.log('✓', edit4.message);
    
    // Step 5: Read the file again to see all changes
    console.log('\n👀 Step 5: Reading updated file...');
    const readResult2 = await readOp.execute({
      filePath: tempFilePath
    });
    
    console.log('Updated file content:');
    console.log(readResult2.content);
    
    // Step 6: Sync back to WordPress
    console.log('\n📤 Step 6: Syncing changes back to WordPress...');
    const syncOp = mapper.getOperation('sync-to-wordpress');
    const syncResult = await syncOp.execute({
      filePath: tempFilePath,
      cleanupFile: true
    });
    
    console.log('✓ Sync result:', syncResult.message);
    console.log('✓ Final title:', syncResult.title);
    
    console.log('\n🎯 COMPLETE WORKFLOW SUCCESS!');
    console.log('Demonstrated using ONLY MCP tools:');
    console.log('  1. draft-article → created test post');
    console.log('  2. pull-for-editing → fetched to temp file');
    console.log('  3. read-document → viewed content with line numbers');
    console.log('  4. edit-document → made 4 separate edits locally');
    console.log('  5. read-document → verified all changes');
    console.log('  6. sync-to-wordpress → pushed back in single API call');
    console.log('  7. Temp file automatically cleaned up');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testFullWorkflow();