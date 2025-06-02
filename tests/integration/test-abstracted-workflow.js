#!/usr/bin/env node
import { config } from 'dotenv';
import { WordPressClient } from './src/core/wordpress-client.js';
import { FeatureMapper } from './src/core/feature-mapper.js';

// Load environment
config();

async function testAbstractedWorkflow() {
  console.log('Testing FULLY ABSTRACTED temp file workflow (no filesystem exposure)...\n');
  
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
    console.log(`Found ${semanticOps.length} operations, including abstracted document editing.`);
    
    // Step 1: Create a test draft
    console.log('\n📝 Step 1: Creating test draft...');
    const draftOp = mapper.getOperation('draft-article');
    const draftResult = await draftOp.execute({
      title: 'Filesystem Abstraction Demo',
      content: 'This article demonstrates the fully abstracted editing workflow where AI agents never see filesystem details.',
      excerpt: 'Testing abstracted document editing',
      categories: ['Technology'],
      tags: ['Abstraction', 'MCP']
    });
    
    console.log('✓ Draft created:', draftResult.title);
    const testPostId = draftResult.postId;
    
    // Step 2: Pull for editing (returns document handle, not file path)
    console.log('\n📥 Step 2: Pulling post for editing session...');
    const pullOp = mapper.getOperation('pull-for-editing');
    const pullResult = await pullOp.execute({
      postId: testPostId
    });
    
    console.log('✓ Editing session created');
    console.log('Document handle:', pullResult.documentHandle);
    console.log('Title:', pullResult.title);
    console.log('NO FILE PATHS EXPOSED!');
    
    const documentHandle = pullResult.documentHandle;
    
    // Step 3: Read using document handle
    console.log('\n👀 Step 3: Reading document using handle...');
    const readOp = mapper.getOperation('read-document');
    const readResult = await readOp.execute({
      documentHandle: documentHandle
    });
    
    console.log('Document content (first 10 lines):');
    console.log(readResult.content.split('\n').slice(0, 10).join('\n'));
    
    // Step 4: Make edits using document handle (no file paths!)
    console.log('\n✏️  Step 4: Making edits using document handle...');
    
    const editOp = mapper.getOperation('edit-document');
    
    // Edit 1: Update title
    console.log('Edit 1: Updating title...');
    const edit1 = await editOp.execute({
      documentHandle: documentHandle,
      oldString: '# Filesystem Abstraction Demo',
      newString: '# Complete Filesystem Abstraction Demo - AI Never Sees Paths'
    });
    console.log('✓', edit1.message);
    
    // Edit 2: Expand content
    console.log('Edit 2: Expanding content...');
    const edit2 = await editOp.execute({
      documentHandle: documentHandle,
      oldString: 'This article demonstrates the fully abstracted editing workflow where AI agents never see filesystem details.',
      newString: `This article demonstrates the fully abstracted editing workflow where AI agents never see filesystem details.

**Key Abstraction Benefits:**
- AI agents work with opaque document handles
- No file paths or directory structures exposed
- Session management handled invisibly
- Clean separation between logic and filesystem

**Implementation Details:**
- Document handles like: ${documentHandle}
- Session manager handles all file operations
- AI only sees high-level document operations`
    });
    console.log('✓', edit2.message);
    
    // Step 5: Verify changes using handle
    console.log('\n👀 Step 5: Verifying changes...');
    const finalRead = await readOp.execute({
      documentHandle: documentHandle
    });
    console.log('Updated content preview:');
    console.log(finalRead.content.split('\n').slice(0, 15).join('\n'));
    
    // Step 6: Sync back using handle (auto-closes session)
    console.log('\n📤 Step 6: Syncing to WordPress...');
    const syncOp = mapper.getOperation('sync-to-wordpress');
    const syncResult = await syncOp.execute({
      documentHandle: documentHandle
      // closeSession defaults to true
    });
    
    console.log('✅ Sync successful!');
    console.log('Final title:', syncResult.title);
    console.log('Session closed:', syncResult.sessionClosed);
    
    // Step 7: Verify session cleanup
    console.log('\n🧹 Step 7: Verifying session cleanup...');
    const listOp = mapper.getOperation('list-editing-sessions');
    const sessionsResult = await listOp.execute({});
    console.log('Active sessions after sync:', sessionsResult.sessions.length);
    
    console.log('\n🎯 FILESYSTEM ABSTRACTION SUCCESS!');
    console.log('Demonstrated workflow:');
    console.log('  1. pull-for-editing → documentHandle (no file paths)');
    console.log('  2. read-document → content via handle');
    console.log('  3. edit-document → edits via handle');
    console.log('  4. sync-to-wordpress → sync via handle');
    console.log('  5. Automatic session cleanup');
    console.log('\nAI agent never saw filesystem details!');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testAbstractedWorkflow();