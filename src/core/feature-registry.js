import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class FeatureRegistry {
  constructor(wpClient) {
    this.features = new Map();
    this.wpClient = wpClient;
    this.categories = new Map();
  }

  async loadFeatures() {
    const featureDir = join(__dirname, '../features');
    
    try {
      // Load features from each category
      const categories = await readdir(featureDir);
      
      for (const category of categories) {
        const categoryPath = join(featureDir, category);
        const files = await readdir(categoryPath);
        
        for (const file of files) {
          if (file.endsWith('.js')) {
            await this.loadFeature(category, join(categoryPath, file));
          }
        }
      }
      
      console.error(`Loaded ${this.features.size} features across ${categories.length} categories`);
    } catch (error) {
      console.error('Error loading features:', error);
      // Load built-in features as fallback
      this.loadBuiltInFeatures();
    }
  }

  async loadFeature(category, filePath) {
    try {
      const module = await import(filePath);
      const feature = module.default || module;
      
      // Validate feature structure
      if (!feature.name || !feature.execute) {
        console.error(`Invalid feature in ${filePath}: missing name or execute`);
        return;
      }

      // Enhance feature with registry context
      feature.wpClient = this.wpClient;
      feature.category = category;

      this.features.set(feature.name, feature);
      
      // Track categories
      if (!this.categories.has(category)) {
        this.categories.set(category, []);
      }
      this.categories.get(category).push(feature.name);
      
    } catch (error) {
      console.error(`Failed to load feature ${filePath}:`, error);
    }
  }

  loadBuiltInFeatures() {
    // Fallback built-in features if file loading fails
    const builtInFeatures = [
      {
        name: 'draft-article',
        description: 'Create a draft article',
        category: 'content',
        eligibility: {
          personalities: ['contributor', 'author', 'administrator']
        },
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' }
          },
          required: ['title', 'content']
        },
        scopeRules: [],
        async execute(params, context) {
          const post = await this.wpClient.createPost({
            title: params.title,
            content: params.content,
            status: 'draft'
          });
          return {
            success: true,
            postId: post.id,
            message: `Draft created: "${params.title}"`
          };
        }
      },
      {
        name: 'create-article',
        description: 'Create and optionally publish an article',
        category: 'content',
        eligibility: {
          personalities: ['author', 'administrator']
        },
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            publish: { type: 'boolean', default: false }
          },
          required: ['title', 'content']
        },
        scopeRules: ['can_publish'],
        async execute(params, context) {
          const status = params.publish && context.can_publish ? 'publish' : 'draft';
          const post = await this.wpClient.createPost({
            title: params.title,
            content: params.content,
            status
          });
          return {
            success: true,
            postId: post.id,
            status,
            message: `Article ${status === 'publish' ? 'published' : 'drafted'}: "${params.title}"`
          };
        }
      }
    ];

    builtInFeatures.forEach(feature => {
      feature.wpClient = this.wpClient;
      this.features.set(feature.name, feature);
    });
  }

  getFeature(name) {
    return this.features.get(name);
  }

  hasFeature(name) {
    return this.features.has(name);
  }

  getFeaturesByCategory(category) {
    return this.categories.get(category) || [];
  }

  getAllFeatures() {
    return Array.from(this.features.values());
  }

  // Check if a feature is eligible for a given context
  isFeatureEligible(featureName, context) {
    const feature = this.getFeature(featureName);
    if (!feature) return false;

    // Check personality eligibility
    if (feature.eligibility?.personalities) {
      const personality = context.personality?.toLowerCase();
      if (!feature.eligibility.personalities.includes(personality)) {
        return false;
      }
    }

    // Check capability requirements
    if (feature.eligibility?.capabilities) {
      for (const capability of feature.eligibility.capabilities) {
        if (!context.capabilities?.[capability]) {
          return false;
        }
      }
    }

    // Check custom eligibility function
    if (feature.isEligible && typeof feature.isEligible === 'function') {
      return feature.isEligible(context);
    }

    return true;
  }

  // Get feature metadata for MCP tool listing
  getFeatureMetadata(featureName) {
    const feature = this.getFeature(featureName);
    if (!feature) return null;

    return {
      name: feature.name,
      description: feature.description || 'No description provided',
      inputSchema: feature.inputSchema || {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    };
  }
}