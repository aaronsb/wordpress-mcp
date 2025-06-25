/**
 * Tool Injector
 *
 * Injects tools into the MCP server based on personality mappings.
 * The injection is purely based on the JSON configuration - no complex logic.
 */

export class ToolInjector {
  constructor(personalityConfig, featureRegistry, server) {
    this.personalityConfig = personalityConfig;
    this.featureRegistry = featureRegistry;
    this.server = server;
  }

  /**
   * Get tools for a specific personality based on the mapping
   */
  getToolsForPersonality(personalityName) {
    const personality = this.personalityConfig[personalityName];
    if (!personality) {
      console.error(`Unknown personality: ${personalityName}`);
      return [];
    }

    // Simply map feature names to actual tool definitions
    const tools = [];
    for (const featureName of personality.features) {
      const feature = this.featureRegistry.getFeature(featureName);
      if (feature) {
        tools.push(this.prepareToolForMCP(feature));
      } else {
        console.warn(`Feature '${featureName}' not found for personality '${personalityName}'`);
      }
    }

    return tools;
  }

  /**
   * Convert a feature into MCP tool format
   */
  prepareToolForMCP(feature) {
    return {
      name: feature.name,
      description: feature.description || `Execute ${feature.name}`,
      inputSchema: feature.inputSchema || {
        type: 'object',
        properties: {},
        additionalProperties: true,
      },
      handler: async (params) => {
        try {
          const result = await feature.execute(params, {
            wpClient: this.featureRegistry.wpClient,
            server: this.server,
          });

          // Handle WordPress permission errors gracefully
          return this.formatResponse(result);
        } catch (error) {
          return this.formatError(error);
        }
      },
    };
  }

  /**
   * Format successful response
   */
  formatResponse(result) {
    if (typeof result === 'string') {
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Format error response with helpful context
   */
  formatError(error) {
    // Check for WordPress permission errors
    if (error.code === 'rest_forbidden' || error.status === 403) {
      return {
        content: [
          {
            type: 'text',
            text: `Permission denied: ${error.message}\n\nYour WordPress user account doesn't have permission for this action.`,
          },
        ],
        isError: true,
      };
    }

    // Check for authentication errors
    if (error.code === 'rest_not_logged_in' || error.status === 401) {
      return {
        content: [
          {
            type: 'text',
            text: 'Authentication required. Please check your WordPress credentials.',
          },
        ],
        isError: true,
      };
    }

    // Generic error
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message || 'An unexpected error occurred'}`,
        },
      ],
      isError: true,
    };
  }
}
