/**
 * Edit Block Feature
 * 
 * Edit block content and/or attributes with immediate validation
 */

export default {
  name: 'edit-block',
  description: 'Edit block content and/or attributes',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      blockId: {
        type: 'string',
        description: 'ID of the block to edit',
      },
      content: {
        type: 'string',
        description: 'New content (optional)',
      },
      attributes: {
        type: 'object',
        description: 'Block attributes to update (optional)',
      },
      validateImmediately: {
        type: 'boolean',
        default: true,
        description: 'Validate block after edit (recommended)',
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

    // Validate we have something to update
    if (!params.content && !params.attributes) {
      throw new Error('Must provide either content or attributes to update');
    }

    // Edit block
    const result = await sessionManager.editBlock(
      params.documentHandle, 
      params.blockId,
      {
        content: params.content,
        attributes: params.attributes,
        validateImmediately: params.validateImmediately,
      }
    );

    return result;
  },
};