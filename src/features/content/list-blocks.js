/**
 * List Blocks Feature
 * 
 * List all blocks in the current document session
 */

export default {
  name: 'list-blocks',
  description: 'List all blocks in the current document session',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      filter: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Filter by block type',
          },
          hasContent: {
            type: 'boolean',
            description: 'Only show blocks with content',
          },
        },
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

    // List blocks
    const result = await sessionManager.listBlocks(params.documentHandle, params.filter || {});

    // Analyze blocks to provide intelligent suggestions
    const blockTypes = {};
    const emptyBlocks = [];
    
    if (result.blocks) {
      result.blocks.forEach(block => {
        blockTypes[block.type] = (blockTypes[block.type] || 0) + 1;
        if (!block.content || block.content.trim() === '') {
          emptyBlocks.push(block.id);
        }
      });
    }

    const suggestedActions = [];
    if (emptyBlocks.length > 0) {
      suggestedActions.push('edit-block', 'delete-block');
    }
    if (result.total > 0) {
      suggestedActions.push('read-block', 'edit-block', 'validate-blocks');
    }
    suggestedActions.push('insert-block', 'sync-to-wordpress');

    return {
      success: true,
      documentHandle: params.documentHandle,
      ...result,
      message: result.filtered < result.total 
        ? `Showing ${result.filtered} of ${result.total} blocks`
        : `Found ${result.total} blocks`,
      semanticContext: {
        group: 'blocks',
        totalBlocks: result.total,
        blockTypes: blockTypes,
        emptyBlocks: emptyBlocks.length,
        hint: emptyBlocks.length > 0 
          ? `${emptyBlocks.length} empty blocks found - consider editing or removing them`
          : 'All blocks have content'
      },
      suggestedActions: suggestedActions,
      workflowGuidance: result.total === 0
        ? '📄 Document is empty. Use insert-block to add content.'
        : `📊 Document structure: ${Object.entries(blockTypes).map(([type, count]) => `${count} ${type}`).join(', ')}`
    };
  },
};