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
   * Get semantic tools with filtered actions for a specific personality
   */
  getToolsForPersonality(personalityName, semanticGroups) {
    const personality = this.personalityConfig[personalityName];
    if (!personality) {
      console.error(`Unknown personality: ${personalityName}`);
      return [];
    }

    // If using legacy features array, fall back to old behavior
    if (personality.features) {
      return this.getLegacyToolsForPersonality(personalityName);
    }

    // New semantic tools with filtered actions
    const tools = [];
    
    for (const [toolName, allowedActions] of Object.entries(personality.tools)) {
      // Skip tools with no allowed actions
      if (!allowedActions || allowedActions.length === 0) {
        continue;
      }

      // Get the base semantic tool
      const semanticGroup = semanticGroups[toolName];
      if (!semanticGroup || !semanticGroup.operations || semanticGroup.operations.length === 0) {
        console.warn(`Semantic tool '${toolName}' not found for personality '${personalityName}'`);
        continue;
      }

      // Get the first operation (there should only be one per semantic group now)
      const baseTool = semanticGroup.operations[0];
      
      // Filter the action enum in the schema to only allowed actions
      const filteredTool = this.filterToolActions(baseTool, allowedActions, personalityName);
      tools.push(this.prepareToolForMCP(filteredTool));
    }

    return tools;
  }

  /**
   * Filter allowed actions for a semantic tool based on personality
   */
  filterToolActions(baseTool, allowedActions, personalityName) {
    const filteredTool = { ...baseTool };
    
    // Clone the input schema
    filteredTool.inputSchema = JSON.parse(JSON.stringify(baseTool.inputSchema));
    
    // Filter the action enum to only allowed actions
    if (filteredTool.inputSchema.properties && filteredTool.inputSchema.properties.action) {
      const originalActions = filteredTool.inputSchema.properties.action.enum || [];
      const filteredActions = originalActions.filter(action => allowedActions.includes(action));
      
      filteredTool.inputSchema.properties.action.enum = filteredActions;
      
      // Update description to indicate role-based filtering
      filteredTool.description = `[${personalityName.toUpperCase()}] ${filteredTool.description}`;
    }

    return filteredTool;
  }

  /**
   * Legacy support for personalities using features array
   */
  getLegacyToolsForPersonality(personalityName) {
    const personality = this.personalityConfig[personalityName];
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
            wpClient: this.server.wpClient,
            server: this.server,
            documentSessionManager: this.server.documentSessionManager,
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
