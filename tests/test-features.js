#!/usr/bin/env node
import { config } from 'dotenv';
import { WordPressClient } from '../src/core/wordpress-client.js';
import { FeatureRegistry } from '../src/core/feature-registry.js';
import { PersonalityManager } from '../src/core/personality-manager.js';
import { ToolInjector } from '../src/core/tool-injector.js';

config();

// Test configuration
const TEST_PREFIX = 'MCP_TEST_';
let createdPostIds = [];

async function runTests() {
  console.log('🧪 WordPress MCP Server Test Suite\n');

  let passed = 0;
  let failed = 0;

  try {
    // Initialize components
    const wpClient = new WordPressClient({
      url: process.env.WORDPRESS_URL,
      username: process.env.WORDPRESS_USERNAME,
      applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
    });

    const personalityManager = new PersonalityManager();
    await personalityManager.loadPersonalities();

    const featureRegistry = new FeatureRegistry(wpClient);
    await featureRegistry.loadFeatures();

    const toolInjector = new ToolInjector(personalityManager.personalities, featureRegistry);

    // Test 1: Personality Loading
    console.log('Test 1: Personality Loading');
    try {
      const personalities = personalityManager.getAvailablePersonalities();
      if (
        personalities.includes('contributor') &&
        personalities.includes('author') &&
        personalities.includes('administrator')
      ) {
        console.log('✅ All personalities loaded correctly');
        passed++;
      } else {
        throw new Error('Missing expected personalities');
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed++;
    }

    // Test 2: Feature Registry
    console.log('\nTest 2: Feature Registry');
    try {
      const features = featureRegistry.getAllFeatures();
      if (features.length >= 9) {
        console.log(`✅ Loaded ${features.length} features`);
        passed++;
      } else {
        throw new Error(`Only loaded ${features.length} features, expected at least 9`);
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed++;
    }

    // Test 3: Tool Injection by Personality
    console.log('\nTest 3: Tool Injection by Personality');
    try {
      const contributorTools = toolInjector.getToolsForPersonality('contributor');
      const authorTools = toolInjector.getToolsForPersonality('author');
      const adminTools = toolInjector.getToolsForPersonality('administrator');

      if (contributorTools.length === 4 && authorTools.length === 7 && adminTools.length === 9) {
        console.log('✅ Tool counts correct for each personality');
        console.log(`   Contributor: ${contributorTools.length} tools`);
        console.log(`   Author: ${authorTools.length} tools`);
        console.log(`   Administrator: ${adminTools.length} tools`);
        passed++;
      } else {
        throw new Error('Incorrect tool counts');
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed++;
    }

    // Test 4: Draft Creation
    console.log('\nTest 4: Draft Creation');
    try {
      const draftFeature = featureRegistry.getFeature('draft-article');
      const result = await draftFeature.execute(
        {
          title: TEST_PREFIX + 'Draft Test',
          content: 'This is a test draft created by the MCP test suite.',
          excerpt: 'Test excerpt',
        },
        { wpClient }
      );

      if (result.success && result.postId) {
        createdPostIds.push(result.postId);
        console.log('✅ Draft created successfully');
        console.log(`   Post ID: ${result.postId}`);
        passed++;
      } else {
        throw new Error('Draft creation failed');
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed++;
    }

    // Test 5: Edit Draft
    console.log('\nTest 5: Edit Draft');
    try {
      if (createdPostIds.length > 0) {
        const editFeature = featureRegistry.getFeature('edit-draft');
        const result = await editFeature.execute(
          {
            postId: createdPostIds[0],
            title: TEST_PREFIX + 'Draft Test (Edited)',
            content: 'This draft has been edited by the test suite.',
          },
          { wpClient }
        );

        if (result.success) {
          console.log('✅ Draft edited successfully');
          passed++;
        } else {
          throw new Error('Draft edit failed');
        }
      } else {
        console.log('⏭️  Skipped (no draft to edit)');
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed++;
    }

    // Test 6: WordPress Connection
    console.log('\nTest 6: WordPress Connection');
    try {
      const user = await wpClient.getCurrentUser();
      if (user && user.id) {
        console.log('✅ WordPress connection working');
        console.log(`   Authenticated as: ${user.name}`);
        passed++;
      } else {
        throw new Error('Could not get current user');
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed++;
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test posts...');
    for (const postId of createdPostIds) {
      try {
        await wpClient.deletePost(postId, true);
        console.log(`   Deleted test post ${postId}`);
      } catch (error) {
        console.log(`   Failed to delete post ${postId}:`, error.message);
      }
    }

    // Summary
    console.log('\n📊 Test Summary');
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${passed + failed}`);

    if (failed === 0) {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test suite error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
