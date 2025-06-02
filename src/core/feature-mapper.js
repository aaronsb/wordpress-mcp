/**
 * Feature Mapper
 * 
 * Maps WordPress Feature API features to semantic operations.
 * This is where we fix Automattic's mistake of exposing every CRUD operation
 * as a separate tool.
 */

export class FeatureMapper {
  constructor(wpClient) {
    this.wpClient = wpClient;
    this.featureMap = new Map();
  }

  async initialize() {
    // Discover available WordPress features
    const wpFeatures = await this.wpClient.discoverFeatures();
    
    // Group them into semantic operations
    this.mapSemanticOperations(wpFeatures);
    
    console.error(`Mapped ${wpFeatures.length} WordPress features into ${this.featureMap.size} semantic operations`);
  }

  mapSemanticOperations(wpFeatures) {
    // Create a map of feature types for easy lookup
    const featuresByType = this.groupFeaturesByType(wpFeatures);
    
    // Map semantic operations based on available features
    if (featuresByType.posts) {
      this.createPostOperations(featuresByType.posts);
    }
    
    if (featuresByType.media) {
      this.createMediaOperations(featuresByType.media);
    }
    
    if (featuresByType.users) {
      this.createUserOperations(featuresByType.users);
    }
  }

  groupFeaturesByType(features) {
    const grouped = {};
    
    features.forEach(feature => {
      // Extract type from feature ID (e.g., "tool-posts" -> "posts")
      const match = feature.id.match(/^(tool|resource)-(.+?)(?:\/|$)/);
      if (match) {
        const type = match[2];
        if (!grouped[type]) {
          grouped[type] = {};
        }
        
        // Store by operation type
        const opType = feature.type === 'tool' ? 'create' : 'read';
        grouped[type][opType] = feature;
      }
    });
    
    return grouped;
  }

  createPostOperations(postFeatures) {
    // Draft Article - combines post creation with proper status
    if (postFeatures.create) {
      this.featureMap.set('draft-article', {
        name: 'Draft Article',
        description: 'Create a draft article with categories and tags',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' },
            excerpt: { type: 'string', description: 'Brief summary' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          },
          required: ['title', 'content'],
        },
        execute: async (params) => {
          // This would orchestrate multiple features:
          // 1. Create/find categories
          // 2. Create/find tags  
          // 3. Create post with all metadata
          const postData = {
            title: { raw: params.title },
            content: { raw: params.content },
            status: 'draft',
            excerpt: params.excerpt ? { raw: params.excerpt } : undefined,
          };
          
          return this.wpClient.executeFeature('tool-posts', postData);
        }
      });
    }
    
    // Publish Article - creates and publishes in one go
    if (postFeatures.create) {
      this.featureMap.set('publish-article', {
        name: 'Publish Article',
        description: 'Create and publish an article immediately',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' },
            excerpt: { type: 'string', description: 'Brief summary' },
            featuredImageUrl: { type: 'string', description: 'URL of featured image' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          },
          required: ['title', 'content'],
        },
        execute: async (params) => {
          // This would:
          // 1. Upload featured image if provided
          // 2. Create/find categories and tags
          // 3. Create and publish post with all metadata
          const postData = {
            title: { raw: params.title },
            content: { raw: params.content },
            status: 'publish',
            excerpt: params.excerpt ? { raw: params.excerpt } : undefined,
          };
          
          return this.wpClient.executeFeature('tool-posts', postData);
        }
      });
    }
  }
  
  createMediaOperations(mediaFeatures) {
    // Media operations would be embedded in post operations
    // Not exposed as separate tools unless specifically needed
  }
  
  createUserOperations(userFeatures) {
    // User management could be a single "manage-authors" operation
    // that handles the full workflow
  }
  
  getSemanticOperations() {
    return Array.from(this.featureMap.values());
  }
  
  getOperation(name) {
    return this.featureMap.get(name);
  }
}