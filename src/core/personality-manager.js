import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class PersonalityManager {
  constructor() {
    this.personalities = {};
  }

  async loadPersonalities() {
    try {
      const configPath = join(__dirname, '../../config/personalities.json');
      const data = await readFile(configPath, 'utf-8');
      this.personalities = JSON.parse(data);
    } catch (error) {
      console.error('Failed to load personalities:', error);
      // Fallback to minimal contributor personality
      this.personalities = {
        contributor: {
          name: 'Contributor',
          description: 'Basic content creation',
          features: ['draft-article', 'edit-draft'],
          context: {
            can_publish: false,
            can_upload_media: false,
            default_post_status: 'draft',
          },
        },
      };
    }
  }

  getPersonality(name) {
    return this.personalities[name] || null;
  }

  getAvailablePersonalities() {
    return Object.keys(this.personalities);
  }

  // Validate that all features in a personality exist
  validatePersonality(personality, featureRegistry) {
    const missingFeatures = personality.features.filter(
      (feature) => !featureRegistry.hasFeature(feature)
    );

    if (missingFeatures.length > 0) {
      console.warn(`Personality ${personality.name} references missing features:`, missingFeatures);
    }

    return missingFeatures.length === 0;
  }

  // Get features available to a personality with context filtering
  getContextualFeatures(personality, context = {}) {
    return personality.features.filter((featureName) => {
      // Additional runtime filtering based on context
      // For example, even an author might not be able to publish
      // if their account has been restricted
      if (context.account_restricted && featureName.includes('publish')) {
        return false;
      }
      return true;
    });
  }
}
