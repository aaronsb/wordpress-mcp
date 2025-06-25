/**
 * Feature Mapper
 * 
 * Maps WordPress Feature API features to semantic operations.
 * This is where we fix Automattic's mistake of exposing every CRUD operation
 * as a separate tool.
 */

import { DocumentSessionManager } from './document-session-manager.js';

export class FeatureMapper {
  constructor(wpClient) {
    this.wpClient = wpClient;
    this.featureMap = new Map();
    this.sessionManager = new DocumentSessionManager();
  }

  async initialize() {
    // Initialize semantic operations directly
    // We don't need to discover WordPress features - we define our own semantic layer
    this.mapSemanticOperations();
    
    console.error(`Initialized ${this.featureMap.size} semantic operations`);
  }

  mapSemanticOperations() {
    // Create all semantic operations
    this.createPostOperations();
    this.createBlockOperations();
    this.createMediaOperations();
    this.createUserOperations();
  }

  groupFeaturesByType(features) {
    const grouped = {};
    
    features.forEach(feature => {
      // Extract type from feature ID (e.g., "tool-posts" -> "posts")
      const match = feature.id.match(/^(tool|resource)-(.+?)(?:\/|$)/);
      if (match) {
        const type = match[2];
        if (!grouped[type]) {
          grouped[type] = {};
        }
        
        // Store by operation type
        const opType = feature.type === 'tool' ? 'create' : 'read';
        grouped[type][opType] = feature;
      }
    });
    
    return grouped;
  }

  createPostOperations() {
    // Draft Article - combines post creation with proper status
    this.featureMap.set('draft-article', {
        name: 'Draft Article',
        description: 'Create a draft article with categories and tags',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' },
            excerpt: { type: 'string', description: 'Brief summary' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          },
          required: ['title', 'content'],
        },
        execute: async (params) => {
          return this.createDraftArticle(params);
        }
      });

    // Publish Article - creates and publishes in one go
    this.featureMap.set('publish-article', {
        name: 'Publish Article',
        description: 'Create and publish an article immediately with all metadata',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' },
            excerpt: { type: 'string', description: 'Brief summary' },
            featuredImageUrl: { type: 'string', description: 'URL of featured image to upload' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          },
          required: ['title', 'content'],
        },
        execute: async (params) => {
          return this.publishArticle(params);
        }
      });

    // Edit Draft - semantic editing of existing drafts
    this.featureMap.set('edit-draft', {
      name: 'Edit Draft',
      description: 'Edit an existing draft post with content and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'ID of the draft to edit' },
          title: { type: 'string', description: 'New title (optional)' },
          content: { type: 'string', description: 'New content (optional)' },
          excerpt: { type: 'string', description: 'New excerpt (optional)' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
        },
        required: ['postId'],
      },
      execute: async (params) => {
        return this.editDraft(params);
      }
    });

    // Pull for Editing - fetch post or page into editing session (filesystem abstracted)
    this.featureMap.set('pull-for-editing', {
      name: 'Pull for Editing',
      description: 'Fetch a WordPress post or page into an editing session',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'ID of the post or page to pull for editing' },
          type: { 
            type: 'string', 
            enum: ['post', 'page'], 
            default: 'post',
            description: 'Type of content to pull (post or page)' 
          },
        },
        required: ['postId'],
      },
      execute: async (params) => {
        return this.pullForEditing(params);
      }
    });

    // Sync to WordPress - push editing session changes back to WordPress
    this.featureMap.set('sync-to-wordpress', {
      name: 'Sync to WordPress',
      description: 'Push editing session changes back to WordPress',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          closeSession: { type: 'boolean', description: 'Close editing session after sync', default: true },
        },
        required: ['documentHandle'],
      },
      execute: async (params) => {
        return this.syncToWordPress(params);
      }
    });

    // Edit Document - edit document by handle using string replacement
    this.featureMap.set('edit-document', {
      name: 'Edit Document',
      description: 'Edit a document by replacing exact string matches',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          oldString: { type: 'string', description: 'Exact string to find and replace' },
          newString: { type: 'string', description: 'String to replace with' },
          expectedReplacements: { type: 'number', description: 'Expected number of replacements', default: 1 },
        },
        required: ['documentHandle', 'oldString', 'newString'],
      },
      execute: async (params) => {
        return this.sessionManager.editDocument(
          params.documentHandle, 
          params.oldString, 
          params.newString, 
          params.expectedReplacements
        );
      }
    });

    // Read Document - read document contents with line numbers
    this.featureMap.set('read-document', {
      name: 'Read Document',
      description: 'Read a document with line numbers for editing',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          offset: { type: 'number', description: 'Starting line number', default: 1 },
          limit: { type: 'number', description: 'Number of lines to read', default: 50 },
        },
        required: ['documentHandle'],
      },
      execute: async (params) => {
        return this.sessionManager.readDocument(
          params.documentHandle, 
          params.offset, 
          params.limit
        );
      }
    });

    // Edit Document Line - line-based editing for better reliability
    this.featureMap.set('edit-document-line', {
      name: 'Edit Document Line',
      description: 'Replace an entire line in the document by line number',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          lineNumber: { type: 'number', description: 'Line number to replace (1-based)' },
          newLine: { type: 'string', description: 'New content for the line' },
        },
        required: ['documentHandle', 'lineNumber', 'newLine'],
      },
      execute: async (params) => {
        return this.sessionManager.editDocumentLine(
          params.documentHandle,
          params.lineNumber,
          params.newLine
        );
      }
    });

    // Insert at Line - add content at specific position
    this.featureMap.set('insert-at-line', {
      name: 'Insert at Line',
      description: 'Insert content before a specific line number',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          lineNumber: { type: 'number', description: 'Line number to insert before (1-based)' },
          content: { type: 'string', description: 'Content to insert' },
        },
        required: ['documentHandle', 'lineNumber', 'content'],
      },
      execute: async (params) => {
        return this.sessionManager.insertAtLine(
          params.documentHandle,
          params.lineNumber,
          params.content
        );
      }
    });

    // Replace Lines - replace a range of lines
    this.featureMap.set('replace-lines', {
      name: 'Replace Lines',
      description: 'Replace a range of lines with new content',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          startLine: { type: 'number', description: 'First line to replace (1-based)' },
          endLine: { type: 'number', description: 'Last line to replace (inclusive)' },
          newContent: { type: 'string', description: 'New content to replace the lines with' },
        },
        required: ['documentHandle', 'startLine', 'endLine', 'newContent'],
      },
      execute: async (params) => {
        return this.sessionManager.replaceLines(
          params.documentHandle,
          params.startLine,
          params.endLine,
          params.newContent
        );
      }
    });

    // Search Replace - flexible search and replace with context
    this.featureMap.set('search-replace', {
      name: 'Search Replace',
      description: 'Search and replace text with optional line context',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          searchTerm: { type: 'string', description: 'Text to search for' },
          replacement: { type: 'string', description: 'Text to replace with' },
          nearLine: { type: 'number', description: 'Optional: only search within 5 lines of this line number' },
          maxReplacements: { type: 'number', description: 'Maximum replacements to make', default: 1 },
        },
        required: ['documentHandle', 'searchTerm', 'replacement'],
      },
      execute: async (params) => {
        return this.sessionManager.searchReplace(
          params.documentHandle,
          params.searchTerm,
          params.replacement,
          {
            nearLine: params.nearLine,
            maxReplacements: params.maxReplacements
          }
        );
      }
    });

    // List Active Sessions - show active editing sessions (for management)
    this.featureMap.set('list-editing-sessions', {
      name: 'List Editing Sessions',
      description: 'List active editing sessions for management and cleanup',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async (params) => {
        const sessions = this.sessionManager.getActiveSessions();
        return {
          success: true,
          sessions: sessions,
          message: `Found ${sessions.length} active editing session(s)`,
        };
      }
    });

    // Close Editing Session - manually close an editing session
    this.featureMap.set('close-editing-session', {
      name: 'Close Editing Session',
      description: 'Close an editing session and clean up resources',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle to close' },
        },
        required: ['documentHandle'],
      },
      execute: async (params) => {
        return this.sessionManager.closeSession(params.documentHandle);
      }
    });

    // Find Posts for Workflow - semantic search that guides to next action
    this.featureMap.set('find-posts', {
      name: 'Find Posts',
      description: 'Search for posts to work with - results include suggested next actions based on your role',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search terms to find in titles or content' },
          intent: { 
            type: 'string', 
            enum: ['edit', 'review', 'publish', 'comment', 'any'],
            description: 'What you plan to do with the results (helps filter appropriately)'
          },
          status: { 
            type: 'string', 
            enum: ['publish', 'draft', 'private', 'pending', 'future', 'any'],
            description: 'Filter by post status (default: based on intent)'
          },
          page: { type: 'number', description: 'Page number for results (default: 1)' },
          perPage: { type: 'number', description: 'Number of results per page (default: 10, max: 20)' }
        }
      },
      execute: async (params) => {
        return this.findPostsForWorkflow(params);
      }
    });

    // View Editorial Feedback - for all content creators
    this.featureMap.set('view-editorial-feedback', {
      name: 'View Editorial Feedback',
      description: 'View editorial comments and feedback on your posts',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'Post ID to get feedback for (optional, shows all if not specified)' },
          status: { 
            type: 'string', 
            enum: ['all', 'approved', 'pending', 'spam', 'trash'],
            description: 'Filter comments by status',
            default: 'all'
          }
        }
      },
      execute: async (params) => {
        return this.viewEditorialFeedback(params);
      }
    });

    // Submit for Review - semantic workflow for contributors
    this.featureMap.set('submit-for-review', {
      name: 'Submit for Review',
      description: 'Submit a draft post for editorial review. Use this instead of changing post status manually - it handles the complete review workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'ID of the draft post to submit' },
          note: { type: 'string', description: 'Note to editors (optional)' }
        },
        required: ['postId']
      },
      execute: async (params) => {
        return this.submitForReview(params);
      }
    });

    // Publish Workflow - semantic publishing for authors/editors
    this.featureMap.set('publish-workflow', {
      name: 'Publish Workflow',
      description: 'Publish a post immediately or schedule for future',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'ID of the post to publish' },
          action: { 
            type: 'string', 
            enum: ['publish_now', 'schedule', 'private'],
            description: 'Publishing action'
          },
          schedule_date: { type: 'string', description: 'ISO 8601 date for scheduling (required if action is "schedule")' }
        },
        required: ['postId', 'action']
      },
      execute: async (params) => {
        return this.publishWorkflow(params);
      }
    });
  }
  
  createBlockOperations() {
    // Block operations for editing within sessions
    this.featureMap.set('list-blocks', {
      name: 'List Blocks',
      description: 'List all blocks in the current document session',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          filter: { type: 'object', description: 'Optional filters' }
        },
        required: ['documentHandle']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        if (!sessionManager) {
          throw new Error('No active document sessions. Use pull-for-editing first.');
        }
        return await sessionManager.listBlocks(params.documentHandle, params.filter || {});
      }
    });

    this.featureMap.set('edit-block', {
      name: 'Edit Block',
      description: 'Edit block content and/or attributes',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle' },
          blockId: { type: 'string', description: 'Block ID' },
          content: { type: 'string', description: 'New content' },
          attributes: { type: 'object', description: 'Block attributes' },
          validateImmediately: { type: 'boolean', default: true }
        },
        required: ['documentHandle', 'blockId']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        return await sessionManager.editBlock(params.documentHandle, params.blockId, params);
      }
    });

    this.featureMap.set('insert-block', {
      name: 'Insert Block',
      description: 'Insert a new block at specified position',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle' },
          type: { type: 'string', description: 'Block type' },
          content: { type: 'string', description: 'Block content' },
          position: { type: 'number', description: 'Insert position' },
          attributes: { type: 'object', description: 'Block attributes' },
          validateImmediately: { type: 'boolean', default: true }
        },
        required: ['documentHandle', 'type', 'content', 'position']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        return await sessionManager.insertBlock(params.documentHandle, params);
      }
    });

    this.featureMap.set('delete-block', {
      name: 'Delete Block',
      description: 'Delete a block',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle' },
          blockId: { type: 'string', description: 'Block ID to delete' }
        },
        required: ['documentHandle', 'blockId']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        return await sessionManager.deleteBlock(params.documentHandle, params.blockId);
      }
    });

    this.featureMap.set('read-block', {
      name: 'Read Block',
      description: 'Read a specific block by ID',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle' },
          blockId: { type: 'string', description: 'Block ID' }
        },
        required: ['documentHandle', 'blockId']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        return await sessionManager.readBlock(params.documentHandle, params.blockId);
      }
    });

    this.featureMap.set('reorder-blocks', {
      name: 'Reorder Blocks',
      description: 'Change block order',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle' },
          blockId: { type: 'string', description: 'Block to move' },
          newPosition: { type: 'number', description: 'New position' }
        },
        required: ['documentHandle', 'blockId', 'newPosition']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        return await sessionManager.reorderBlocks(params.documentHandle, params.blockId, params.newPosition);
      }
    });

    this.featureMap.set('validate-blocks', {
      name: 'Validate Blocks',
      description: 'Validate block structure without saving',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle' },
          blocks: { type: 'array', description: 'Specific blocks to validate' }
        },
        required: ['documentHandle']
      },
      execute: async (params, context) => {
        const { server } = context;
        const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
        return await sessionManager.validateBlocks(params.documentHandle, params.blocks);
      }
    });
  }
  
  createMediaOperations() {
    // Upload Media with Article Context - for authors
    this.featureMap.set('upload-featured-image', {
      name: 'Upload Featured Image',
      description: 'Upload an image from URL to use as featured image',
      inputSchema: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string', description: 'URL of image to upload' },
          title: { type: 'string', description: 'Title for the image' },
          altText: { type: 'string', description: 'Alt text for accessibility' },
        },
        required: ['imageUrl'],
      },
      execute: async (params) => {
        return this.uploadImageFromUrl(params);
      }
    });

    // Manage Media Library - for authors
    this.featureMap.set('manage-media', {
      name: 'Manage Media',
      description: 'List and search media items in library',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search term for media' },
          mediaType: { type: 'string', enum: ['image', 'video', 'audio', 'document'], description: 'Filter by media type' },
          perPage: { type: 'number', description: 'Number of items to return', default: 10 },
        },
        required: [],
      },
      execute: async (params) => {
        return this.listMedia(params);
      }
    });
  }
  
  createUserOperations() {
    // Editorial Review Workflow - for editors
    this.featureMap.set('review-content', {
      name: 'Review Content',
      description: 'Review and manage pending posts and comments',
      inputSchema: {
        type: 'object',
        properties: {
          contentType: { type: 'string', enum: ['posts', 'comments'], description: 'Type of content to review' },
          status: { type: 'string', enum: ['pending', 'draft'], description: 'Status filter' },
          perPage: { type: 'number', description: 'Number of items to return', default: 10 },
        },
        required: ['contentType'],
      },
      execute: async (params) => {
        return this.reviewContent(params);
      }
    });

    // Moderate Comments - for editors
    this.featureMap.set('moderate-comments', {
      name: 'Moderate Comments',
      description: 'Approve, reject, or manage comments in bulk',
      inputSchema: {
        type: 'object',
        properties: {
          commentIds: { type: 'array', items: { type: 'number' }, description: 'IDs of comments to moderate' },
          action: { type: 'string', enum: ['approve', 'hold', 'spam', 'trash'], description: 'Moderation action' },
          reason: { type: 'string', description: 'Optional reason for action' },
        },
        required: ['commentIds', 'action'],
      },
      execute: async (params) => {
        return this.moderateComments(params);
      }
    });

    // Manage Categories - for editors
    this.featureMap.set('manage-categories', {
      name: 'Manage Categories',
      description: 'Create, update, and organize content categories',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create', 'update', 'delete'], description: 'Category action' },
          categoryId: { type: 'number', description: 'Category ID (for update/delete)' },
          name: { type: 'string', description: 'Category name' },
          description: { type: 'string', description: 'Category description' },
          parentId: { type: 'number', description: 'Parent category ID' },
        },
        required: ['action'],
      },
      execute: async (params) => {
        return this.manageCategories(params);
      }
    });
  }
  
  getSemanticOperations() {
    return Array.from(this.featureMap.values());
  }
  
  getGroupedSemanticOperations() {
    // Return operations organized by semantic groups
    const groups = {
      content: {
        name: 'Content Management',
        description: 'Create, edit, and manage posts and pages',
        operations: []
      },
      blocks: {
        name: 'Block Editor',
        description: 'Edit content using WordPress blocks',
        operations: []
      },
      workflow: {
        name: 'Publishing Workflow',
        description: 'Review, approve, and publish content',
        operations: []
      },
      media: {
        name: 'Media Management',
        description: 'Upload and manage media files',
        operations: []
      },
      admin: {
        name: 'Site Administration',
        description: 'Manage categories, users, and settings',
        operations: []
      }
    };

    // Categorize operations by their semantic purpose
    const operationGroups = {
      content: ['draft-article', 'publish-article', 'edit-draft', 'draft-page', 
                'create-page', 'pull-for-editing', 'sync-to-wordpress', 
                'trash-own-content', 'publish-markdown-as-page'],
      blocks: ['list-blocks', 'read-block', 'edit-block', 'insert-block', 
               'delete-block', 'reorder-blocks', 'validate-blocks'],
      workflow: ['find-posts', 'submit-for-review', 'publish-workflow', 
                 'view-editorial-feedback'],
      media: ['upload-featured-image', 'manage-media'],
      admin: ['review-content', 'moderate-comments', 'manage-categories']
    };

    // Document editing operations (legacy, to be removed)
    const documentOps = ['edit-document', 'read-document', 'edit-document-line', 
                        'insert-at-line', 'replace-lines', 'search-replace',
                        'list-editing-sessions', 'close-editing-session'];

    // Populate groups with operations
    for (const [groupKey, opNames] of Object.entries(operationGroups)) {
      for (const opName of opNames) {
        const operation = this.featureMap.get(opName);
        if (operation) {
          groups[groupKey].operations.push({
            ...operation,
            // Add group context to each operation
            group: groupKey,
            groupName: groups[groupKey].name
          });
        }
      }
    }

    // Add document operations to blocks group (they work within block sessions)
    for (const opName of documentOps) {
      const operation = this.featureMap.get(opName);
      if (operation) {
        groups.blocks.operations.push({
          ...operation,
          group: 'blocks',
          groupName: groups.blocks.name,
          subgroup: 'document',
          deprecated: true,
          deprecationNote: 'Use block operations instead'
        });
      }
    }

    return groups;
  }
  
  getOperation(name) {
    return this.featureMap.get(name);
  }

  // Implementation methods for semantic operations
  
  async createDraftArticle(params) {
    try {
      // Prepare the base post data
      const postData = {
        title: { raw: params.title },
        content: { raw: params.content },
        status: 'draft',
        excerpt: params.excerpt ? { raw: params.excerpt } : undefined,
      };

      // Handle categories if provided
      if (params.categories && params.categories.length > 0) {
        postData.categories = await this.resolveCategories(params.categories);
      }

      // Handle tags if provided
      if (params.tags && params.tags.length > 0) {
        postData.tags = await this.resolveTags(params.tags);
      }

      // Create post using Feature API if available, otherwise use REST API
      let post;
      try {
        post = await this.wpClient.executeFeature('tool-posts', postData);
      } catch (error) {
        // Fallback to direct REST API
        post = await this.wpClient.createPost(postData);
      }

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        editLink: post.link.replace(this.wpClient.baseUrl, '') + '?preview=true',
        message: `Draft created successfully: "${params.title}"`,
        semanticContext: {
          contentType: 'post',
          hint: 'Draft created - use edit-draft to modify or submit-for-review when ready'
        },
        suggestedActions: ['edit-draft', 'pull-for-editing', 'submit-for-review'],
        workflowGuidance: '📝 Your draft is saved. Next steps:\n- Use pull-for-editing to edit with blocks\n- Use submit-for-review when ready for publication'
      };
    } catch (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }
  }

  async publishArticle(params) {
    try {
      let featuredMediaId = 0;
      
      // Upload featured image if provided
      if (params.featuredImageUrl) {
        try {
          const imageResponse = await fetch(params.featuredImageUrl);
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const filename = params.featuredImageUrl.split('/').pop() || 'featured-image.jpg';
            const media = await this.wpClient.uploadMedia(imageBlob, filename);
            featuredMediaId = media.id;
          }
        } catch (error) {
          console.warn('Failed to upload featured image:', error.message);
        }
      }

      const postData = {
        title: { raw: params.title },
        content: { raw: params.content },
        status: 'publish',
        excerpt: params.excerpt ? { raw: params.excerpt } : undefined,
        featured_media: featuredMediaId,
      };

      // Handle categories and tags
      if (params.categories && params.categories.length > 0) {
        postData.categories = await this.resolveCategories(params.categories);
      }
      if (params.tags && params.tags.length > 0) {
        postData.tags = await this.resolveTags(params.tags);
      }

      // Create and publish post
      let post;
      try {
        post = await this.wpClient.executeFeature('tool-posts', postData);
      } catch (error) {
        post = await this.wpClient.createPost(postData);
      }

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        link: post.link,
        message: `Article published successfully: "${params.title}"`,
      };
    } catch (error) {
      throw new Error(`Failed to publish article: ${error.message}`);
    }
  }

  async editDraft(params) {
    try {
      const updateData = {};
      
      if (params.title) updateData.title = { raw: params.title };
      if (params.content) updateData.content = { raw: params.content };
      if (params.excerpt) updateData.excerpt = { raw: params.excerpt };

      // Handle categories and tags
      if (params.categories && params.categories.length > 0) {
        updateData.categories = await this.resolveCategories(params.categories);
      }
      if (params.tags && params.tags.length > 0) {
        updateData.tags = await this.resolveTags(params.tags);
      }

      const post = await this.wpClient.updatePost(params.postId, updateData);

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        editLink: post.link.replace(this.wpClient.baseUrl, '') + '?preview=true',
        message: `Draft updated successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to edit draft: ${error.message}`);
    }
  }

  async resolveCategories(categoryNames) {
    const categoryIds = [];
    const existingCategories = await this.wpClient.getCategories();

    for (const name of categoryNames) {
      if (typeof name === 'number') {
        categoryIds.push(name);
        continue;
      }

      const existing = existingCategories.find(
        cat => cat.name.toLowerCase() === name.toLowerCase()
      );

      if (existing) {
        categoryIds.push(existing.id);
      } else {
        // Try to create new category (requires permission)
        try {
          const newCat = await this.wpClient.createCategory({ name });
          categoryIds.push(newCat.id);
        } catch (error) {
          console.warn(`Cannot create category "${name}": ${error.message}`);
        }
      }
    }

    return categoryIds;
  }

  async resolveTags(tagNames) {
    const tagIds = [];

    for (const name of tagNames) {
      try {
        // Try to create tag (will return existing if it exists)
        const tag = await this.wpClient.createTag({ name });
        tagIds.push(tag.id);
      } catch (error) {
        // If creation fails, try to find existing
        const existingTags = await this.wpClient.getTags();
        const existing = existingTags.find(
          tag => tag.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          tagIds.push(existing.id);
        }
      }
    }

    return tagIds;
  }

  async uploadImageFromUrl(params) {
    try {
      const response = await fetch(params.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const imageBlob = await response.blob();
      const filename = params.imageUrl.split('/').pop() || 'uploaded-image.jpg';
      
      const media = await this.wpClient.uploadMedia(imageBlob, filename);
      
      // Update alt text and title if provided
      if (params.title || params.altText) {
        const updateData = {};
        if (params.title) updateData.title = { raw: params.title };
        if (params.altText) updateData.alt_text = params.altText;
        
        await this.wpClient.request(`/media/${media.id}`, {
          method: 'POST',
          body: JSON.stringify(updateData),
        });
      }

      return {
        success: true,
        mediaId: media.id,
        url: media.source_url,
        title: media.title.rendered,
        message: `Image uploaded successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async listMedia(params) {
    try {
      const queryParams = {
        per_page: params.perPage || 10,
      };
      
      if (params.search) {
        queryParams.search = params.search;
      }
      
      if (params.mediaType) {
        queryParams.media_type = params.mediaType;
      }

      const media = await this.wpClient.request('/media?' + new URLSearchParams(queryParams));

      return {
        success: true,
        count: media.length,
        media: media.map(item => ({
          id: item.id,
          title: item.title.rendered,
          url: item.source_url,
          type: item.media_type,
          mimeType: item.mime_type,
          uploadDate: item.date,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to list media: ${error.message}`);
    }
  }

  async reviewContent(params) {
    try {
      if (params.contentType === 'posts') {
        const queryParams = {
          status: params.status || 'pending',
          per_page: params.perPage || 10,
        };

        const posts = await this.wpClient.request('/posts?' + new URLSearchParams(queryParams));

        return {
          success: true,
          contentType: 'posts',
          count: posts.length,
          items: posts.map(post => ({
            id: post.id,
            title: post.title.rendered,
            author: post.author,
            status: post.status,
            date: post.date,
            excerpt: post.excerpt.rendered,
            link: post.link,
          })),
        };
      } else if (params.contentType === 'comments') {
        const queryParams = {
          status: params.status || 'hold',
          per_page: params.perPage || 10,
        };

        const comments = await this.wpClient.getComments(queryParams);

        return {
          success: true,
          contentType: 'comments',
          count: comments.length,
          items: comments.map(comment => ({
            id: comment.id,
            post: comment.post,
            author: comment.author_name,
            content: comment.content.rendered,
            status: comment.status,
            date: comment.date,
          })),
        };
      }
    } catch (error) {
      throw new Error(`Failed to review content: ${error.message}`);
    }
  }

  async moderateComments(params) {
    try {
      const results = [];
      
      for (const commentId of params.commentIds) {
        try {
          await this.wpClient.moderateComment(commentId, params.action);
          results.push({ id: commentId, success: true, action: params.action });
        } catch (error) {
          results.push({ id: commentId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: true,
        action: params.action,
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results: results,
        message: `${successCount} comments ${params.action}ed successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to moderate comments: ${error.message}`);
    }
  }

  async manageCategories(params) {
    try {
      switch (params.action) {
        case 'list':
          const categories = await this.wpClient.getCategories();
          return {
            success: true,
            action: 'list',
            count: categories.length,
            categories: categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              description: cat.description,
              count: cat.count,
              parent: cat.parent,
            })),
          };

        case 'create':
          const newCategory = await this.wpClient.createCategory({
            name: params.name,
            description: params.description || '',
            parent: params.parentId || 0,
          });
          return {
            success: true,
            action: 'create',
            categoryId: newCategory.id,
            name: newCategory.name,
            message: `Category "${params.name}" created successfully`,
          };

        case 'update':
          const updateData = {};
          if (params.name) updateData.name = params.name;
          if (params.description) updateData.description = params.description;
          if (params.parentId) updateData.parent = params.parentId;

          const updatedCategory = await this.wpClient.request(`/categories/${params.categoryId}`, {
            method: 'POST',
            body: JSON.stringify(updateData),
          });

          return {
            success: true,
            action: 'update',
            categoryId: updatedCategory.id,
            name: updatedCategory.name,
            message: `Category updated successfully`,
          };

        case 'delete':
          await this.wpClient.request(`/categories/${params.categoryId}`, {
            method: 'DELETE',
          });
          
          return {
            success: true,
            action: 'delete',
            categoryId: params.categoryId,
            message: `Category deleted successfully`,
          };

        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      throw new Error(`Failed to manage categories: ${error.message}`);
    }
  }

  // Temp file workflow methods

  async pullForEditing(params) {
    try {
      const contentType = params.type || 'post';
      
      // Fetch the content from WordPress based on type
      const content = contentType === 'page' 
        ? await this.wpClient.getPage(params.postId)
        : await this.wpClient.getPost(params.postId);
      
      // Format content with metadata header
      const formattedContent = contentType === 'page'
        ? this.formatPageForEditing(content)
        : this.formatPostForEditing(content);
      
      // Create editing session (filesystem abstracted)
      const session = await this.sessionManager.createSession(
        params.postId, 
        formattedContent, 
        {
          title: content.title.rendered,
          status: content.status,
          type: contentType,
          // Page-specific metadata
          ...(contentType === 'page' && {
            parent: content.parent,
            menu_order: content.menu_order,
            template: content.template
          })
        }
      );

      // Add semantic context to the response
      return {
        ...session,
        semanticContext: {
          contentType: contentType,
          hint: contentType === 'page' 
            ? 'This is a PAGE - use it for permanent, timeless content that forms your site structure'
            : 'This is a POST - use it for time-based content like news, articles, or blog entries'
        }
      };
    } catch (error) {
      throw new Error(`Failed to pull ${params.type || 'post'} for editing: ${error.message}`);
    }
  }

  async syncToWordPress(params) {
    try {
      // Get document content using session manager (filesystem abstracted)
      const content = await this.sessionManager.getDocumentContent(params.documentHandle);
      
      // Check if it's a page or post
      const isPage = content.includes('**Page Metadata:**');
      
      // Parse the content to extract metadata and content
      const { postId, metadata, postContent } = this.parseEditedFile(content);

      // Prepare update data
      const updateData = {
        content: { raw: postContent },
      };

      // Add metadata if present
      if (metadata.title) updateData.title = { raw: metadata.title };
      
      if (isPage) {
        // Page-specific metadata
        if (metadata.parent !== undefined) updateData.parent = metadata.parent;
        if (metadata.menu_order !== undefined) updateData.menu_order = metadata.menu_order;
        if (metadata.template) updateData.template = metadata.template;
      } else {
        // Post-specific metadata
        if (metadata.excerpt) updateData.excerpt = { raw: metadata.excerpt };
        if (metadata.categories) updateData.categories = await this.resolveCategories(metadata.categories);
        if (metadata.tags) updateData.tags = await this.resolveTags(metadata.tags);
      }

      // Update the content
      const updatedContent = isPage 
        ? await this.wpClient.updatePage(postId, updateData)
        : await this.wpClient.updatePost(postId, updateData);

      // Close session if requested (default: true)
      if (params.closeSession !== false) {
        await this.sessionManager.closeSession(params.documentHandle);
      }

      return {
        success: true,
        [`${isPage ? 'page' : 'post'}Id`]: postId,
        title: updatedContent.title.rendered,
        status: updatedContent.status,
        documentHandle: params.documentHandle,
        sessionClosed: params.closeSession !== false,
        message: `${isPage ? 'Page' : 'Post'} synced to WordPress successfully`,
        semanticContext: {
          contentType: isPage ? 'page' : 'post',
          hint: isPage 
            ? 'Page updated - remember pages are for static, timeless content'
            : 'Post updated - posts are for time-based content like news or articles'
        }
      };
    } catch (error) {
      throw new Error(`Failed to sync to WordPress: ${error.message}`);
    }
  }

  formatPostForEditing(post) {
    // Extract categories and tags
    const categories = post._embedded?.['wp:term']?.[0]?.map(cat => cat.name) || [];
    const tags = post._embedded?.['wp:term']?.[1]?.map(tag => tag.name) || [];

    // Convert WordPress HTML to clean markdown for AI editing
    // "It's the thought that counts" - focus on content, not encoding
    const cleanTitle = this.sessionManager.htmlToMarkdown(post.title.rendered);
    const cleanContent = this.sessionManager.htmlToMarkdown(post.content.rendered);
    const cleanExcerpt = this.sessionManager.htmlToMarkdown(post.excerpt.rendered);

    return `# ${cleanTitle}

${cleanContent}

---
**Post Metadata:**
- Post ID: ${post.id}
- Status: ${post.status}
- Categories: ${categories.join(', ')}
- Tags: ${tags.join(', ')}
- Excerpt: ${cleanExcerpt}`;
  }

  formatPageForEditing(page) {
    // Convert WordPress HTML to clean markdown for AI editing
    const cleanTitle = this.sessionManager.htmlToMarkdown(page.title.rendered);
    const cleanContent = this.sessionManager.htmlToMarkdown(page.content.rendered);

    return `# ${cleanTitle}

${cleanContent}

----
**Page Metadata:**
- Page ID: ${page.id}
- Status: ${page.status}
- Parent Page: ${page.parent || 'None'}
- Menu Order: ${page.menu_order}
- Template: ${page.template || 'default'}
- Type: Static Page (not a blog post)`;
  }

  parseEditedFile(content) {
    // Check if it's a post or page by looking for metadata section
    const isPage = content.includes('**Page Metadata:**');
    const metadataMarker = isPage ? '**Page Metadata:**' : '**Post Metadata:**';
    
    // Split content at the metadata divider
    const parts = content.split(`----\n${metadataMarker}`);
    
    if (parts.length !== 2) {
      throw new Error('Invalid temp file format - missing metadata section');
    }

    const postContent = parts[0].trim();
    const metadataSection = parts[1];

    // Extract ID from metadata (works for both posts and pages)
    const idPattern = isPage ? /- Page ID: (\d+)/ : /- Post ID: (\d+)/;
    const idMatch = metadataSection.match(idPattern);
    if (!idMatch) {
      throw new Error(`Could not find ${isPage ? 'Page' : 'Post'} ID in temp file`);
    }
    const postId = parseInt(idMatch[1]);

    // Extract title (first line should be # Title)
    const titleMatch = postContent.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1] : null;

    // Remove title from content if present
    const actualContent = titleMatch ? 
      postContent.replace(/^# .+$\n\n?/m, '') : 
      postContent;

    // Convert markdown back to HTML for WordPress
    // "It's the thought that counts" - preserve meaning, handle encoding
    const htmlContent = this.sessionManager.markdownToHtml(actualContent);

    // Parse optional metadata
    const metadata = {};
    if (title) {
      // Title should be plain text, not HTML
      metadata.title = title;
    }

    const categoriesMatch = metadataSection.match(/- Categories: (.+)/);
    if (categoriesMatch && categoriesMatch[1].trim() !== '') {
      metadata.categories = categoriesMatch[1].split(', ').map(cat => cat.trim());
    }

    const tagsMatch = metadataSection.match(/- Tags: (.+)/);
    if (tagsMatch && tagsMatch[1].trim() !== '') {
      metadata.tags = tagsMatch[1].split(', ').map(tag => tag.trim());
    }

    // Page-specific metadata
    if (isPage) {
      const parentMatch = metadataSection.match(/- Parent Page: (\d+|None)/);
      if (parentMatch && parentMatch[1] !== 'None') {
        metadata.parent = parseInt(parentMatch[1]);
      }
      
      const menuOrderMatch = metadataSection.match(/- Menu Order: (\d+)/);
      if (menuOrderMatch) {
        metadata.menu_order = parseInt(menuOrderMatch[1]);
      }
      
      const templateMatch = metadataSection.match(/- Template: (.+)/);
      if (templateMatch && templateMatch[1] !== 'default') {
        metadata.template = templateMatch[1];
      }
    }

    const excerptMatch = metadataSection.match(/- Excerpt: (.+)/);
    if (excerptMatch && excerptMatch[1].trim() !== '') {
      // Excerpt should be plain text, not HTML
      metadata.excerpt = excerptMatch[1];
    }

    return {
      postId,
      metadata,
      postContent: htmlContent, // Now returns HTML, not raw markdown
    };
  }

  async getCurrentUserContext() {
    try {
      // Get current user info
      const user = await this.wpClient.request('/users/me');
      
      return {
        id: user.id,
        name: user.name,
        canEditOthers: user.capabilities?.edit_others_posts || false,
        canPublish: user.capabilities?.publish_posts || false,
        canModerate: user.capabilities?.moderate_comments || false
      };
    } catch (error) {
      // Fallback to basic permissions
      return {
        id: 0,
        name: 'Unknown',
        canEditOthers: false,
        canPublish: false,
        canModerate: false
      };
    }
  }

  async findPostsForWorkflow(params) {
    try {
      // Determine intent-based defaults
      let defaultStatus = params.status || 'any';
      if (!params.status && params.intent) {
        switch (params.intent) {
          case 'edit':
            defaultStatus = 'draft';
            break;
          case 'review':
            defaultStatus = 'pending';
            break;
          case 'publish':
            defaultStatus = 'draft,pending';
            break;
          case 'comment':
            defaultStatus = 'publish';
            break;
        }
      }
      
      // Validate pagination (smaller for workflow context)
      const perPage = Math.min(Math.max(1, params.perPage || 10), 20);
      const page = Math.max(1, params.page || 1);
      
      // Build search params
      const searchParams = {
        page,
        per_page: perPage,
        _embed: true // Include embedded data
      };
      
      // Add search query if provided
      if (params.query) {
        searchParams.search = params.query;
        searchParams.orderby = 'relevance';
      } else {
        searchParams.orderby = 'modified';
        searchParams.order = 'desc';
      }
      
      // Add status filter
      if (defaultStatus !== 'any') {
        searchParams.status = defaultStatus;
      }
      // For 'any', don't add status filter - WordPress will return based on user permissions
      
      // Make the API request (listPosts returns array directly)
      const posts = await this.wpClient.listPosts(searchParams);
      
      // Since listPosts doesn't return headers, we'll estimate pagination
      // This is a limitation we'll need to address later
      const totalItems = posts.length;
      const totalPages = Math.ceil(totalItems / perPage);
      
      // Format results with workflow suggestions
      const formattedPosts = posts.map(post => {
        const baseInfo = {
          id: post.id,
          title: post.title.rendered,
          status: post.status,
          date: post.date,
          modified: post.modified,
          excerpt: post.excerpt.rendered.replace(/<[^>]*>/g, '').trim(),
          author: post._embedded?.author?.[0]?.name || `User ${post.author}`,
          categories: post._embedded?.['wp:term']?.[0]?.map(cat => cat.name) || [],
          tags: post._embedded?.['wp:term']?.[1]?.map(tag => tag.name) || []
        };
        
        // Add suggested actions based on status and intent
        const suggestedActions = this.getSuggestedActions(post.status, params.intent);
        
        return {
          ...baseInfo,
          suggestedActions
        };
      });
      
      // Provide workflow guidance
      const workflowGuidance = this.getWorkflowGuidance(params.intent, formattedPosts.length, totalItems);
      
      return {
        success: true,
        query: params.query || '',
        intent: params.intent || 'any',
        page,
        perPage,
        totalItems,
        totalPages,
        posts: formattedPosts,
        workflowGuidance
      };
      
    } catch (error) {
      if (error.response?.data?.message) {
        throw new Error(`Search failed: ${error.response.data.message}`);
      }
      throw new Error(`Failed to find posts: ${error.message}`);
    }
  }
  
  getSuggestedActions(status, intent) {
    const actions = [];
    
    // Status-based suggestions with role awareness
    switch (status) {
      case 'draft':
        actions.push('pull-for-editing', 'submit-for-review', 'publish-workflow');
        break;
      case 'pending':
        actions.push('review-content', 'publish-workflow', 'pull-for-editing');
        break;
      case 'publish':
        actions.push('pull-for-editing', 'view-editorial-feedback');
        break;
      case 'private':
        actions.push('pull-for-editing', 'publish-workflow');
        break;
      case 'future':
        actions.push('pull-for-editing', 'publish-workflow');
        break;
    }
    
    // Intent-based filtering
    if (intent === 'edit') {
      return actions.filter(a => a.includes('edit') || a === 'pull-for-editing').slice(0, 2);
    } else if (intent === 'review') {
      return actions.filter(a => a.includes('review') || a === 'publish-workflow').slice(0, 2);
    } else if (intent === 'publish') {
      return actions.filter(a => a === 'publish-workflow' || a === 'submit-for-review').slice(0, 2);
    } else if (intent === 'comment') {
      return ['view-editorial-feedback'];
    }
    
    return actions.slice(0, 3); // Limit to top 3 suggestions
  }
  
  getWorkflowGuidance(intent, resultCount, totalCount) {
    if (resultCount === 0) {
      const noResultsHelp = {
        edit: "No drafts found. Try searching without filters or create a new draft with 'draft-article'.",
        review: "No pending posts found. Posts must be submitted for review first.",
        publish: "No posts ready to publish. Check drafts or pending posts.",
        comment: "No published posts found. Try searching all statuses.",
        any: "No posts found. Try different search terms or adjust your filters."
      };
      return noResultsHelp[intent] || noResultsHelp.any;
    }
    
    const guidance = {
      edit: "📝 Use 'pull-for-editing' with a post ID to start editing. After editing, use 'sync-to-wordpress' to save changes.",
      review: "🔍 Found posts awaiting review. Use 'publish-workflow' to approve and publish, or 'pull-for-editing' to make changes.",
      publish: "🚀 Ready to publish! Use 'publish-workflow' with the post ID. You can publish immediately or schedule for later.",
      comment: "💬 Use 'view-editorial-feedback' to see comments and feedback on these published posts.",
      any: "Select a post and use the suggested action. Each post shows relevant next steps based on its status."
    };
    
    let message = guidance[intent] || guidance.any;
    
    if (totalCount > resultCount) {
      message += `\n📊 Showing ${resultCount} of ${totalCount} total results. Use page parameter for more.`;
    }
    
    return message;
  }

  async viewEditorialFeedback(params) {
    try {
      // Build query to get comments on user's posts or specific post
      const query = {
        per_page: 50,
        orderby: 'date',
        order: 'desc'
      };
      
      // Filter by post if specified
      if (params.postId) {
        query.post = params.postId;
      } else {
        // Get current user's posts first to filter comments
        const currentUser = await this.getCurrentUserContext();
        const userPosts = await this.wpClient.listPosts({ 
          author: currentUser.id,
          per_page: 100,
          status: 'any'
        });
        
        if (userPosts.length === 0) {
          return {
            success: true,
            comments: [],
            message: 'No posts found for current user'
          };
        }
        
        // Get comments on user's posts
        const postIds = userPosts.map(p => p.id);
        query.post = postIds.join(',');
      }
      
      // Add status filter
      if (params.status && params.status !== 'all') {
        query.status = params.status;
      }
      
      // Get comments - build URL with query params
      const queryString = new URLSearchParams(query).toString();
      const comments = await this.wpClient.request(`/comments?${queryString}`);
      
      // Format comments with context
      const formattedComments = (comments || []).map(comment => ({
        id: comment.id,
        postId: comment.post,
        postTitle: comment._embedded?.up?.[0]?.title?.rendered || 'Unknown Post',
        author: comment.author_name,
        date: comment.date,
        status: comment.status,
        content: comment.content.rendered.replace(/<[^>]*>/g, '').trim(),
        isEditorial: comment.author > 0, // Registered users are likely editorial
        link: comment.link
      }));
      
      // Group by post for better context
      const groupedByPost = {};
      formattedComments.forEach(comment => {
        if (!groupedByPost[comment.postId]) {
          groupedByPost[comment.postId] = {
            postTitle: comment.postTitle,
            comments: []
          };
        }
        groupedByPost[comment.postId].comments.push(comment);
      });
      
      return {
        success: true,
        totalComments: formattedComments.length,
        posts: Object.keys(groupedByPost).length,
        feedback: groupedByPost,
        message: formattedComments.length > 0 
          ? `Found ${formattedComments.length} comments on ${Object.keys(groupedByPost).length} posts`
          : 'No editorial feedback found'
      };
      
    } catch (error) {
      throw new Error(`Failed to get editorial feedback: ${error.message}`);
    }
  }

  async submitForReview(params) {
    try {
      // Get the post first to verify it's a draft
      const post = await this.wpClient.getPost(params.postId);
      
      if (post.status !== 'draft') {
        throw new Error(`Post ${params.postId} is not a draft (status: ${post.status})`);
      }
      
      // Update post status to pending
      const updatedPost = await this.wpClient.updatePost(params.postId, {
        status: 'pending'
      });
      
      // Add editorial note if provided
      if (params.note) {
        try {
          await this.wpClient.request('/comments', {
            method: 'POST',
            body: JSON.stringify({
              post: params.postId,
              content: `**Editorial Note:** ${params.note}`,
              status: 'hold' // Hold for moderation
            })
          });
        } catch (error) {
          console.warn('Could not add editorial note:', error.message);
        }
      }
      
      return {
        success: true,
        postId: params.postId,
        title: updatedPost.title.rendered,
        status: updatedPost.status,
        message: `Post submitted for review: "${updatedPost.title.rendered}"`,
        note: params.note ? 'Editorial note added' : undefined
      };
      
    } catch (error) {
      throw new Error(`Failed to submit for review: ${error.message}`);
    }
  }

  async publishWorkflow(params) {
    try {
      // Get the post to verify current status
      const post = await this.wpClient.getPost(params.postId);
      
      // Prepare update data based on action
      const updateData = {};
      
      switch (params.action) {
        case 'publish_now':
          updateData.status = 'publish';
          break;
          
        case 'schedule':
          if (!params.schedule_date) {
            throw new Error('Schedule date is required for scheduled publishing');
          }
          // Validate date is in the future
          const scheduleDate = new Date(params.schedule_date);
          if (scheduleDate <= new Date()) {
            throw new Error('Schedule date must be in the future');
          }
          updateData.status = 'future';
          updateData.date = params.schedule_date;
          break;
          
        case 'private':
          updateData.status = 'private';
          break;
          
        default:
          throw new Error(`Unknown publishing action: ${params.action}`);
      }
      
      // Update the post
      const updatedPost = await this.wpClient.updatePost(params.postId, updateData);
      
      // Build response message
      let message = '';
      switch (params.action) {
        case 'publish_now':
          message = `Published: "${updatedPost.title.rendered}"`;
          break;
        case 'schedule':
          message = `Scheduled for ${new Date(params.schedule_date).toLocaleString()}: "${updatedPost.title.rendered}"`;
          break;
        case 'private':
          message = `Published privately: "${updatedPost.title.rendered}"`;
          break;
      }
      
      return {
        success: true,
        postId: params.postId,
        title: updatedPost.title.rendered,
        status: updatedPost.status,
        link: updatedPost.link,
        publishDate: updatedPost.date,
        message
      };
      
    } catch (error) {
      throw new Error(`Failed to publish: ${error.message}`);
    }
  }

}