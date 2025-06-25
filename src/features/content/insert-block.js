/**
 * Insert Block Feature
 * 
 * Insert a new block at specified position with validation
 */

export default {
  name: 'insert-block',
  description: 'Insert a new block at specified position',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      type: {
        type: 'string',
        description: 'Block type (e.g., core/paragraph)',
      },
      content: {
        type: 'string',
        description: 'Block content',
      },
      position: {
        type: 'number',
        description: 'Insert position (0-based)',
      },
      attributes: {
        type: 'object',
        description: 'Block attributes (optional)',
      },
      validateImmediately: {
        type: 'boolean',
        default: true,
        description: 'Validate block before inserting (recommended)',
      },
    },
    required: ['documentHandle', 'type', 'content', 'position'],
  },

  async execute(params, context) {
    const { server } = context;

    // Get session manager
    const sessionManager = server.documentSessionManager;
    if (!sessionManager) {
      throw new Error('No active document sessions. Use pull-for-editing first.');
    }

    // Insert block
    const result = await sessionManager.insertBlock(params.documentHandle, {
      type: params.type,
      content: params.content,
      position: params.position,
      attributes: params.attributes || {},
      validateImmediately: params.validateImmediately,
    });

    return result;
  },
};