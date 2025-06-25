#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { z } from 'zod';
import { PersonalityManager } from './core/personality-manager.js';
import { FeatureRegistry } from './core/feature-registry.js';
import { FeatureMapper } from './core/feature-mapper.js';
import { WordPressClient } from './core/wordpress-client.js';
import { ToolInjector } from './core/tool-injector.js';
import { ToolContextProvider } from './core/tool-context-provider.js';

// Load environment variables from multiple locations
// 1. Local .env file in project root directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env') });

// 2. User's home directory ~/.wordpress-mcp/.env
const homeEnvPath = join(homedir(), '.wordpress-mcp', '.env');
if (existsSync(homeEnvPath)) {
  config({ path: homeEnvPath, override: false });
}

class WordPressAuthorMCP {
  constructor() {
    this.server = new McpServer({
      name: 'wordpress-author-mcp',
      version: '1.0.0',
    });

    this.setupErrorHandling();
    
    // Store server reference for context access
    this.personality = this.getPersonality();
  }

  async initialize() {
    // Load personality from command line or environment
    const personalityName = this.getPersonality();
    console.error(`Initializing WordPress Author MCP with '${personalityName}' personality`);

    // Initialize WordPress client
    this.wpClient = new WordPressClient({
      url: process.env.WORDPRESS_URL,
      username: process.env.WORDPRESS_USERNAME,
      password: process.env.WORDPRESS_PASSWORD,
      applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
    });

    // Load personality configuration
    this.personalityManager = new PersonalityManager();
    await this.personalityManager.loadPersonalities();

    // Initialize Feature API mapper for semantic operations
    this.featureMapper = new FeatureMapper(this.wpClient);
    await this.featureMapper.initialize();

    // Initialize feature registry (for backward compatibility)
    this.featureRegistry = new FeatureRegistry(this.wpClient);
    await this.featureRegistry.loadFeatures();

    // Initialize tool injector
    this.toolInjector = new ToolInjector(
      this.personalityManager.personalities,
      this.featureRegistry,
      this
    );

    // Initialize context provider
    this.contextProvider = new ToolContextProvider(this);

    // Get grouped semantic operations from FeatureMapper
    this.semanticGroups = this.featureMapper.getGroupedSemanticOperations();
    
    // Flatten tools for MCP registration but preserve grouping metadata
    this.tools = [];
    for (const [groupKey, group] of Object.entries(this.semanticGroups)) {
      for (const operation of group.operations) {
        this.tools.push(this.createToolFromOperation(operation));
      }
    }
    
    // Get personality-based tools (for features not covered by semantic ops)
    const personalityTools = this.toolInjector.getToolsForPersonality(personalityName);
    
    // Add personality tools that aren't already in semantic operations
    const additionalTools = personalityTools.filter(t => 
      !this.tools.some(st => st.name === t.name)
    );
    this.tools.push(...additionalTools);
    
    // Log grouped structure
    console.error(`Loaded semantic operations in ${Object.keys(this.semanticGroups).length} groups:`);
    for (const [groupKey, group] of Object.entries(this.semanticGroups)) {
      console.error(`  ${group.name}: ${group.operations.length} operations`);
    }
    console.error(`Total: ${this.tools.length} tools for ${personalityName} personality`);
  }

  createToolFromOperation(operation) {
    return {
      name: operation.name.toLowerCase().replace(/\s+/g, '-'),
      description: operation.description,
      inputSchema: operation.inputSchema,
      // Preserve grouping metadata
      group: operation.group,
      groupName: operation.groupName,
      handler: async (params) => {
        try {
          // Pass server context to operations
          const context = {
            wpClient: this.wpClient,
            server: this,
            // Include group context
            toolGroup: operation.group,
            semanticGroups: this.semanticGroups
          };
          const result = await operation.execute(params, context);
          
          // Ensure response includes semantic hints
          const enhancedResult = this.enhanceResponseWithSemantics(result, operation);
          return this.formatResponse(enhancedResult);
        } catch (error) {
          return this.formatError(error);
        }
      }
    };
  }

  enhanceResponseWithSemantics(result, operation) {
    // If result already has semantic context, return as-is
    if (result.semanticContext || result.suggestedActions) {
      return result;
    }

    // Add default semantic hints based on operation group
    const enhanced = { ...result };
    
    // Add group-based suggestions
    if (operation.group === 'content' && result.success) {
      if (!enhanced.suggestedActions) {
        enhanced.suggestedActions = this.getDefaultSuggestionsForGroup('content', result);
      }
      if (!enhanced.semanticContext) {
        enhanced.semanticContext = {
          group: 'content',
          hint: 'Content operation completed successfully'
        };
      }
    } else if (operation.group === 'blocks' && result.success) {
      if (!enhanced.suggestedActions) {
        enhanced.suggestedActions = this.getDefaultSuggestionsForGroup('blocks', result);
      }
      if (!enhanced.semanticContext) {
        enhanced.semanticContext = {
          group: 'blocks',
          hint: 'Block operation completed - document session is active'
        };
      }
    }

    return enhanced;
  }

  getDefaultSuggestionsForGroup(group, result) {
    switch (group) {
      case 'content':
        if (result.postId || result.pageId) {
          return ['pull-for-editing', 'edit-draft', 'submit-for-review'];
        }
        return ['find-posts', 'draft-article'];
      
      case 'blocks':
        if (result.documentHandle) {
          return ['list-blocks', 'edit-block', 'insert-block', 'sync-to-wordpress'];
        }
        return ['pull-for-editing'];
      
      case 'workflow':
        return ['find-posts', 'view-editorial-feedback'];
      
      default:
        return [];
    }
  }

  formatResponse(result) {
    if (typeof result === 'string') {
      return {
        content: [{ type: 'text', text: result }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }

  formatError(error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }

  getPersonality() {
    // Check command line arguments
    const args = process.argv.slice(2);
    const personalityArg = args.find((arg) => arg.startsWith('--personality='));
    if (personalityArg) {
      return personalityArg.split('=')[1];
    }

    // Check environment variable
    if (process.env.MCP_PERSONALITY) {
      return process.env.MCP_PERSONALITY;
    }

    // Default to contributor (least privileged)
    return 'contributor';
  }

  async setupHandlers() {
    // Register a special tool to expose the semantic groups structure
    this.server.registerTool(
      'get-tool-groups',
      {
        description: 'Get the semantic grouping of available tools',
        inputSchema: {},
      },
      async () => {
        return this.formatResponse({
          success: true,
          groups: Object.entries(this.semanticGroups).map(([key, group]) => ({
            key,
            name: group.name,
            description: group.description,
            toolCount: group.operations.length,
            tools: group.operations.map(op => op.name)
          })),
          message: 'Tools are organized into semantic groups for better discoverability'
        });
      }
    );

    // Register each tool with the McpServer using the proper API
    for (const tool of this.tools) {
      // Generate contextual description
      const contextualDescription = await this.contextProvider.generateDescription(
        tool,
        tool.description
      );
      
      // Add group hint to description
      const groupedDescription = tool.group 
        ? `[${tool.groupName}] ${contextualDescription}`
        : contextualDescription;
      
      this.server.registerTool(
        tool.name,
        {
          description: groupedDescription,
          inputSchema: this.convertToZodSchema(tool.inputSchema),
        },
        async (params) => await tool.handler(params)
      );
    }
  }

  convertToZodSchema(inputSchema) {
    if (!inputSchema || !inputSchema.properties) {
      return {};
    }

    const zodSchema = {};
    for (const [key, value] of Object.entries(inputSchema.properties)) {
      let fieldSchema;
      
      if (value.type === 'string') {
        fieldSchema = value.enum ? z.enum(value.enum) : z.string();
      } else if (value.type === 'number') {
        fieldSchema = z.number();
      } else if (value.type === 'boolean') {
        fieldSchema = z.boolean();
      } else if (value.type === 'array') {
        fieldSchema = z.array(z.any());
      } else {
        fieldSchema = z.any();
      }

      // Add description if available
      if (value.description) {
        fieldSchema = fieldSchema.describe(value.description);
      }

      // Handle optional fields
      if (!inputSchema.required || !inputSchema.required.includes(key)) {
        fieldSchema = fieldSchema.optional();
      }
      
      zodSchema[key] = fieldSchema;
    }

    return zodSchema;
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('unhandledRejection', (error) => {
      console.error('[Unhandled Rejection]', error);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.initialize();
    
    // Setup handlers before connecting transport
    await this.setupHandlers();
    
    await this.server.connect(transport);
    console.error('WordPress Author MCP server running');
  }
}

// Start the server
const server = new WordPressAuthorMCP();
server.run().catch(console.error);
