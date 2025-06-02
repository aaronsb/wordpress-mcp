#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { PersonalityManager } from './core/personality-manager.js';
import { FeatureRegistry } from './core/feature-registry.js';
import { WordPressClient } from './core/wordpress-client.js';
import { ToolInjector } from './core/tool-injector.js';

// Load environment variables
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

class WordPressAuthorMCP {
  constructor() {
    this.server = new Server(
      {
        name: 'wordpress-author-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupErrorHandling();
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

    // Initialize feature registry
    this.featureRegistry = new FeatureRegistry(this.wpClient);
    await this.featureRegistry.loadFeatures();

    // Initialize tool injector
    this.toolInjector = new ToolInjector(
      this.personalityManager.personalities,
      this.featureRegistry
    );

    // Inject tools for the selected personality
    this.tools = this.toolInjector.getToolsForPersonality(personalityName);
    console.error(`Loaded ${this.tools.length} tools for ${personalityName} personality`);

    // Setup server handlers
    this.setupHandlers();
  }

  getPersonality() {
    // Check command line arguments
    const args = process.argv.slice(2);
    const personalityArg = args.find(arg => arg.startsWith('--personality='));
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

  setupHandlers() {
    // Handle all tool operations
    this.server.setRequestHandler(async (request) => {
      switch (request.method) {
        case 'tools/list':
          return {
            tools: this.tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          };

        case 'tools/call':
          const { name, arguments: args } = request.params;
          const tool = this.tools.find(t => t.name === name);
          
          if (!tool) {
            return {
              content: [{
                type: 'text',
                text: `Tool '${name}' is not available for this personality`
              }],
              isError: true
            };
          }

          return await tool.handler(args || {});

        default:
          throw new Error(`Unknown method: ${request.method}`);
      }
    });
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
    await this.server.connect(transport);
    console.error('WordPress Author MCP server running');
  }
}

// Start the server
const server = new WordPressAuthorMCP();
server.run().catch(console.error);