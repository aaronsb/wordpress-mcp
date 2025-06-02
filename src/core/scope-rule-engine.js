/**
 * Scope Rule Engine
 * 
 * Enforces runtime permissions based on WordPress capabilities,
 * personality context, and feature-specific rules.
 */

export class ScopeRuleEngine {
  constructor(wpClient) {
    this.wpClient = wpClient;
    this.ruleHandlers = new Map();
    this.initializeDefaultRules();
  }

  initializeDefaultRules() {
    // Content scope rules
    this.registerRule('own_content_only', async (context, params) => {
      if (!params.postId) return { allowed: true };
      
      try {
        const post = await this.wpClient.getPost(params.postId);
        const currentUser = await this.wpClient.getCurrentUser();
        
        if (post.author !== currentUser.id) {
          return {
            allowed: false,
            reason: 'You can only modify your own content'
          };
        }
        return { allowed: true };
      } catch (error) {
        return {
          allowed: false,
          reason: 'Unable to verify content ownership'
        };
      }
    });

    this.registerRule('published_only', async (context, params) => {
      if (!params.postId) return { allowed: true };
      
      try {
        const post = await this.wpClient.getPost(params.postId);
        if (post.status !== 'publish') {
          return {
            allowed: false,
            reason: 'This operation only works on published content'
          };
        }
        return { allowed: true };
      } catch (error) {
        return {
          allowed: false,
          reason: 'Unable to verify post status'
        };
      }
    });

    // Action scope rules
    this.registerRule('can_publish', async (context) => {
      if (!context.can_publish) {
        return {
          allowed: false,
          reason: 'Your role does not have publishing permissions'
        };
      }
      return { allowed: true };
    });

    this.registerRule('can_upload_media', async (context) => {
      if (!context.can_upload_media) {
        return {
          allowed: false,
          reason: 'Your role does not have media upload permissions'
        };
      }
      return { allowed: true };
    });

    this.registerRule('can_edit_others', async (context) => {
      if (!context.can_edit_others) {
        return {
          allowed: false,
          reason: 'Your role cannot edit content created by others'
        };
      }
      return { allowed: true };
    });

    // WordPress capability rules
    this.registerRule('capability:*', async (context, params, ruleName) => {
      const capability = ruleName.split(':')[1];
      
      try {
        const user = await this.wpClient.getCurrentUser();
        if (!user.capabilities || !user.capabilities[capability]) {
          return {
            allowed: false,
            reason: `You lack the required capability: ${capability}`
          };
        }
        return { allowed: true };
      } catch (error) {
        return {
          allowed: false,
          reason: 'Unable to verify user capabilities'
        };
      }
    });

    // Status-based rules
    this.registerRule('draft_only', async (context, params) => {
      if (params.status && params.status !== 'draft') {
        return {
          allowed: false,
          reason: 'You can only create draft posts'
        };
      }
      return { allowed: true };
    });
  }

  registerRule(name, handler) {
    this.ruleHandlers.set(name, handler);
  }

  async check(rules, context, params = {}) {
    if (!rules || rules.length === 0) {
      return { allowed: true };
    }

    // Check all rules - all must pass
    for (const rule of rules) {
      const result = await this.evaluateRule(rule, context, params);
      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true };
  }

  async evaluateRule(ruleName, context, params) {
    // Check for wildcard rules (e.g., capability:*)
    const wildcardHandler = this.findWildcardHandler(ruleName);
    if (wildcardHandler) {
      return wildcardHandler(context, params, ruleName);
    }

    // Check exact rule
    const handler = this.ruleHandlers.get(ruleName);
    if (!handler) {
      console.warn(`Unknown scope rule: ${ruleName}`);
      return { allowed: true }; // Fail open for unknown rules
    }

    return handler(context, params);
  }

  findWildcardHandler(ruleName) {
    for (const [pattern, handler] of this.ruleHandlers) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        if (regex.test(ruleName)) {
          return handler;
        }
      }
    }
    return null;
  }

  // Helper method to combine multiple rule sets
  combineRules(...ruleSets) {
    const combined = new Set();
    ruleSets.forEach(rules => {
      if (Array.isArray(rules)) {
        rules.forEach(rule => combined.add(rule));
      }
    });
    return Array.from(combined);
  }

  // Get human-readable description of rules
  describeRules(rules) {
    const descriptions = {
      'own_content_only': 'Can only modify your own content',
      'published_only': 'Can only work with published posts',
      'can_publish': 'Requires publishing permissions',
      'can_upload_media': 'Requires media upload permissions',
      'can_edit_others': 'Requires permission to edit others\' content',
      'draft_only': 'Can only create draft posts'
    };

    return rules.map(rule => descriptions[rule] || rule).join(', ');
  }
}