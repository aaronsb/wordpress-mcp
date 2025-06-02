#!/usr/bin/env node
import { config } from 'dotenv';
import { WordPressClient } from './src/core/wordpress-client.js';
import { FeatureMapper } from './src/core/feature-mapper.js';

// Load environment
config();

async function testFeatureAPI() {
  console.log('Testing WordPress Feature API integration...\n');
  
  try {
    // Initialize client
    const wpClient = new WordPressClient({
      url: process.env.WORDPRESS_URL,
      username: process.env.WORDPRESS_USERNAME,
      applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
    });
    
    // Discover features
    console.log('1. Discovering WordPress features...');
    const features = await wpClient.discoverFeatures();
    console.log(`Found ${features.length} features:`);
    features.forEach(f => {
      console.log(`  - ${f.id}: ${f.name} (${f.type})`);
    });
    
    // Test feature mapper
    console.log('\n2. Testing Feature Mapper...');
    const mapper = new FeatureMapper(wpClient);
    await mapper.initialize();
    
    const semanticOps = mapper.getSemanticOperations();
    console.log(`\nMapped to ${semanticOps.length} semantic operations:`);
    semanticOps.forEach(op => {
      console.log(`  - ${op.name}: ${op.description}`);
    });
    
    // Test creating a draft
    console.log('\n3. Testing draft creation via Feature API...');
    const testPost = await wpClient.executeFeature('tool-posts', {
      title: { raw: 'Test Post via Feature API' },
      content: { raw: 'This post was created using the WordPress Feature API directly.' },
      status: 'draft',
    });
    
    console.log(`\nCreated post ${testPost.id}: ${testPost.title.rendered}`);
    console.log(`Status: ${testPost.status}`);
    console.log(`Link: ${testPost.link}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Details:', error.data);
    }
  }
}

testFeatureAPI();