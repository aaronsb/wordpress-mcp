/**
 * Validate Blocks Feature
 * 
 * Validate block structure without saving to WordPress
 */

export default {
  name: 'validate-blocks',
  description: 'Validate block structure without saving to WordPress',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      blocks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific block IDs to validate (optional, validates all if not provided)',
      },
    },
    required: ['documentHandle'],
  },

  async execute(params, context) {
    const { server } = context;

    // Get session manager
    const sessionManager = server.documentSessionManager;
    if (!sessionManager) {
      throw new Error('No active document sessions. Use pull-for-editing first.');
    }

    // Validate blocks
    const result = await sessionManager.validateBlocks(
      params.documentHandle,
      params.blocks
    );

    return {
      success: result.valid,
      documentHandle: params.documentHandle,
      valid: result.valid,
      errors: result.errors,
      blockErrors: result.blockErrors ? Array.from(result.blockErrors.entries()) : [],
      message: result.valid 
        ? 'All blocks are valid' 
        : `Found ${result.errors.length} validation errors`,
      suggestion: result.valid
        ? 'Blocks are ready to sync to WordPress'
        : 'Fix the validation errors before syncing',
    };
  },
};