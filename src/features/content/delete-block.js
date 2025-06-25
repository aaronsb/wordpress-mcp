/**
 * Delete Block Feature
 * 
 * Delete a block from the document
 */

export default {
  name: 'delete-block',
  description: 'Delete a block',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      blockId: {
        type: 'string',
        description: 'ID of the block to delete',
      },
    },
    required: ['documentHandle', 'blockId'],
  },

  async execute(params, context) {
    const { server } = context;

    // Get session manager
    const sessionManager = server.documentSessionManager;
    if (!sessionManager) {
      throw new Error('No active document sessions. Use pull-for-editing first.');
    }

    // Delete block
    const result = await sessionManager.deleteBlock(
      params.documentHandle, 
      params.blockId
    );

    return {
      success: true,
      documentHandle: params.documentHandle,
      ...result,
    };
  },
};