import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PersonalityManager } from '../src/core/personality-manager.js';
import { FeatureRegistry } from '../src/core/feature-registry.js';
import { ToolInjector } from '../src/core/tool-injector.js';

describe('ToolInjector', () => {
  let injector;
  let personalities;

  before(async () => {
    // Mock WordPress client
    const mockWpClient = {
      createPost: async () => ({ id: 1, title: { rendered: 'Test' } }),
      updatePost: async () => ({ id: 1, title: { rendered: 'Test' } }),
    };

    const personalityManager = new PersonalityManager();
    await personalityManager.loadPersonalities();
    personalities = personalityManager.personalities;

    const featureRegistry = new FeatureRegistry(mockWpClient);
    await featureRegistry.loadFeatures();

    injector = new ToolInjector(personalities, featureRegistry);
  });

  describe('getToolsForPersonality', () => {
    it('should return correct number of tools for contributor', () => {
      const tools = injector.getToolsForPersonality('contributor');
      assert.equal(tools.length, 4);

      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes('draft-article'));
      assert.ok(toolNames.includes('edit-draft'));
      assert.ok(!toolNames.includes('publish-workflow'));
    });

    it('should return correct number of tools for author', () => {
      const tools = injector.getToolsForPersonality('author');
      assert.equal(tools.length, 7);

      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes('create-article'));
      assert.ok(toolNames.includes('publish-workflow'));
    });

    it('should return correct number of tools for administrator', () => {
      const tools = injector.getToolsForPersonality('administrator');
      assert.equal(tools.length, 9);

      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes('bulk-content-operations'));
      assert.ok(toolNames.includes('manage-all-content'));
    });

    it('should return empty array for unknown personality', () => {
      const tools = injector.getToolsForPersonality('unknown');
      assert.equal(tools.length, 0);
    });
  });

  describe('prepareToolForMCP', () => {
    it('should convert feature to MCP tool format', () => {
      const mockFeature = {
        name: 'test-feature',
        description: 'Test feature',
        inputSchema: { type: 'object' },
        execute: async () => ({ success: true }),
      };

      const tool = injector.prepareToolForMCP(mockFeature);

      assert.equal(tool.name, 'test-feature');
      assert.equal(tool.description, 'Test feature');
      assert.deepEqual(tool.inputSchema, { type: 'object' });
      assert.equal(typeof tool.handler, 'function');
    });
  });

  describe('error handling', () => {
    it('should format WordPress permission errors correctly', () => {
      const error = new Error('Permission denied');
      error.code = 'rest_forbidden';
      error.status = 403;

      const result = injector.formatError(error);

      assert.ok(result.isError);
      assert.ok(result.content[0].text.includes('Permission denied'));
      assert.ok(result.content[0].text.includes('WordPress user account'));
    });
  });
});
