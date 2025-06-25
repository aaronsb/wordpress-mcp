/**
 * Reorder Blocks Feature
 * 
 * Change block order in the document
 */

export default {
  name: 'reorder-blocks',
  description: 'Change block order',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      blockId: {
        type: 'string',
        description: 'ID of the block to move',
      },
      newPosition: {
        type: 'number',
        description: 'New position (0-based)',
      },
    },
    required: ['documentHandle', 'blockId', 'newPosition'],
  },

  async execute(params, context) {
    const { server } = context;

    // Get session manager
    const sessionManager = server.documentSessionManager;
    if (!sessionManager) {
      throw new Error('No active document sessions. Use pull-for-editing first.');
    }

    // Reorder blocks
    const result = await sessionManager.reorderBlocks(
      params.documentHandle,
      params.blockId,
      params.newPosition
    );

    return {
      success: true,
      documentHandle: params.documentHandle,
      ...result,
    };
  },
};