#!/usr/bin/env node
import { config } from 'dotenv';
import { WordPressClient } from './src/core/wordpress-client.js';
import { FeatureMapper } from './src/core/feature-mapper.js';

// Load environment
config();

async function testSemanticOperations() {
  console.log('Testing semantic operations with Feature API backend...\n');
  
  try {
    // Initialize client
    const wpClient = new WordPressClient({
      url: process.env.WORDPRESS_URL,
      username: process.env.WORDPRESS_USERNAME,
      applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
    });
    
    // Initialize feature mapper
    console.log('1. Initializing Feature Mapper...');
    const mapper = new FeatureMapper(wpClient);
    await mapper.initialize();
    
    const semanticOps = mapper.getSemanticOperations();
    console.log(`\nAvailable semantic operations:`);
    semanticOps.forEach(op => {
      console.log(`  - ${op.name}: ${op.description}`);
    });
    
    // Test draft-article operation
    console.log('\n2. Testing draft-article semantic operation...');
    const draftOp = mapper.getOperation('draft-article');
    if (draftOp) {
      const result = await draftOp.execute({
        title: 'Semantic Operations Test',
        content: 'This article was created using our semantic operations layer over the WordPress Feature API.',
        excerpt: 'Testing our hybrid approach',
        categories: ['Technology'],
        tags: ['MCP', 'WordPress', 'AI']
      });
      
      console.log('Draft created:', result);
    }
    
    // Test media management
    console.log('\n3. Testing media management...');
    const mediaOp = mapper.getOperation('manage-media');
    if (mediaOp) {
      const mediaResult = await mediaOp.execute({
        perPage: 5
      });
      
      console.log('Media library:', mediaResult);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testSemanticOperations();