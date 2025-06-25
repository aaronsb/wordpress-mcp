/**
 * Read Block Feature
 * 
 * Read a specific block by ID
 */

export default {
  name: 'read-block',
  description: 'Read a specific block by ID',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      blockId: {
        type: 'string',
        description: 'ID of the block to read',
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

    // Read block
    const block = await sessionManager.readBlock(params.documentHandle, params.blockId);

    return {
      success: true,
      documentHandle: params.documentHandle,
      block: block,
      message: `Block ${params.blockId} retrieved`,
    };
  },
};