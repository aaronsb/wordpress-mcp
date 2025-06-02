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
import { WordPressClient } from './core/wordpress-client.js';
import { ToolInjector } from './core/tool-injector.js';

// Load environment variables from multiple locations
// 1. Local .env file in server directory
config();

// 2. User's home directory ~/.wordpress-mcp/.env
const homeEnvPath = join(homedir(), '.wordpress-mcp', '.env');
if (existsSync(homeEnvPath)) {
  config({ path: homeEnvPath, override: false });
}

const __dirname = dirname(fileURLToPath(import.meta.url));

class WordPressAuthorMCP {
  constructor() {
    this.server = new McpServer({
      name: 'wordpress-author-mcp',
      version: '1.0.0',
    });

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

  setupHandlers() {
    // Register each tool with the McpServer using the proper API
    this.tools.forEach((tool) => {
      this.server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: this.convertToZodSchema(tool.inputSchema),
        },
        async (params) => await tool.handler(params)
      );
    });
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
    this.setupHandlers();
    
    await this.server.connect(transport);
    console.error('WordPress Author MCP server running');
  }
}

// Start the server
const server = new WordPressAuthorMCP();
server.run().catch(console.error);
