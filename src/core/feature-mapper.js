/**
 * Feature Mapper
 * 
 * Maps WordPress Feature API features to semantic operations.
 * This is where we fix Automattic's mistake of exposing every CRUD operation
 * as a separate tool.
 */

import { DocumentSessionManager } from './document-session-manager.js';
import fs from 'node:fs';
import path from 'node:path';

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
    // Create the 5 unified semantic tools with action-based routing
    this.createContentManagementTool();
    this.createBlockEditorTool();
    this.createPublishingWorkflowTool();
    this.createMediaManagementTool();
    this.createSiteAdministrationTool();
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

  createContentManagementTool() {
    this.featureMap.set('content-management', {
      name: 'content-management',
      description: '[Content Management] Create, edit, and manage posts and pages. TROUBLESHOOTING: If sync action fails, check error message for specific recovery steps. Common fixes: delete problematic blocks and recreate them, use simple parameters instead of complex attributes.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['draft', 'publish', 'edit', 'pull', 'sync', 'trash', 'page', 'markdown-to-wp', 'bulk'],
            description: 'Content management action to perform'
          },
          // Common properties
          postId: { type: 'number', description: 'Post/page ID (for edit, pull, sync, trash)' },
          title: { type: 'string', description: 'Title' },
          content: { type: 'string', description: 'Content in clean HTML or Markdown. When editing blocks, use proper HTML tags like <h2>Title</h2>, <p>Text</p>, <ul><li>Item</li></ul>. AI-generated HTML works great with automatic validation!' },
          excerpt: { type: 'string', description: 'Brief summary' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          // Page-specific
          type: { type: 'string', enum: ['post', 'page'], description: 'Content type' },
          parent: { type: 'number', description: 'Parent page ID' },
          // Pull/sync specific
          documentHandle: { type: 'string', description: 'Document handle for sync' },
          closeSession: { type: 'boolean', description: 'Close session after sync' },
          // Publish options
          featuredImageUrl: { type: 'string', description: 'Featured image URL' },
          status: { type: 'string', enum: ['draft', 'publish', 'private'], description: 'Publish status' },
          // Markdown import specific
          filePath: { 
            oneOf: [
              { type: 'string', description: 'Single file/directory path' },
              { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Array of file/directory paths' }
            ], 
            description: 'Path(s) to markdown files or directories (for markdown-to-wp action)' 
          },
          recurse: { type: 'boolean', description: 'Recursively process subdirectories (only valid for directories with type="page")' },
          // Bulk operations specific
          operation: { type: 'string', enum: ['trash', 'delete', 'change_status'], description: 'Bulk operation type (for bulk action)' },
          contentIds: { type: 'array', items: { type: 'number' }, description: 'Array of content IDs to operate on (for bulk action)' },
          newStatus: { type: 'string', enum: ['draft', 'publish', 'private'], description: 'New status for change_status operation' }
        },
        required: ['action']
      },
      execute: async (params, context) => {
        return this.executeContentAction(params, context);
      }
    });
  }

  createBlockEditorTool() {
    this.featureMap.set('block-editor', {
      name: 'block-editor',
      description: '[Block Editor] Edit content using WordPress blocks. Write clean HTML - most AI-generated HTML passes validation easily. Content is stored as simple block comments: <!-- wp:paragraph --><p>Your content</p><!-- /wp:paragraph -->. TROUBLESHOOTING: If sync fails with "Cannot create property on string", use individual parameters (level: 2) instead of attributes objects. If validation fails, read the block first to inspect its current state.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'list', 'read', 'edit', 'insert', 'delete', 'reorder', 'validate',
              // Semantic content actions
              'add-section', 'add-subsection', 'add-paragraph', 'add-list', 'add-quote', 
              'add-code', 'add-separator', 'continue-writing'
            ],
            description: 'Block editing action to perform'
          },
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          blockId: { type: 'string', description: 'Block ID' },
          type: { type: 'string', description: 'Block type (for insert)' },
          content: { type: 'string', description: 'Block content as clean HTML. Example: For headings use <h2>My Title</h2>, for paragraphs use <p>My text</p>, for lists use <ul><li>Item</li></ul>. Most AI-written HTML works perfectly.' },
          position: { type: 'number', description: 'Position for insert/reorder' },
          newPosition: { type: 'number', description: 'New position for reorder' },
          attributes: { type: 'object', description: 'Block attributes (advanced use only - prefer individual parameters like level, ordered, align)' },
          level: { type: 'number', description: 'Heading level (1-6) for heading blocks' },
          ordered: { type: 'boolean', description: 'True for numbered lists, false for bullet lists' },
          align: { type: 'string', enum: ['left', 'center', 'right', 'wide', 'full'], description: 'Block alignment' },
          filter: { type: 'object', description: 'Filters for list action' },
          blocks: { type: 'array', description: 'Specific blocks to validate' },
          validateImmediately: { type: 'boolean', default: true }
        },
        required: ['action', 'documentHandle']
      },
      execute: async (params, context) => {
        return this.executeBlockAction(params, context);
      }
    });
  }

  createPublishingWorkflowTool() {
    this.featureMap.set('publishing-workflow', {
      name: 'publishing-workflow',
      description: '[Publishing Workflow] Review, approve, and publish content',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['find', 'submit', 'publish', 'feedback'],
            description: 'Workflow action to perform'
          },
          query: { type: 'string', description: 'Search terms' },
          intent: { type: 'string', enum: ['edit', 'review', 'publish', 'comment', 'any'] },
          status: { type: 'string', enum: ['publish', 'draft', 'private', 'pending', 'future', 'any'] },
          contentType: { type: 'string', enum: ['post', 'page', 'any'], description: 'Type of content to search (default: any)' },
          page: { type: 'number', description: 'Page number' },
          perPage: { type: 'number', description: 'Results per page' },
          postId: { type: 'number', description: 'Post ID' },
          note: { type: 'string', description: 'Editorial note' },
          publishAction: { type: 'string', enum: ['publish_now', 'schedule', 'private'] },
          schedule_date: { type: 'string', description: 'ISO 8601 date for scheduling' }
        },
        required: ['action']
      },
      execute: async (params, context) => {
        return this.executeWorkflowAction(params, context);
      }
    });
  }

  createMediaManagementTool() {
    this.featureMap.set('media-management', {
      name: 'media-management',
      description: '[Media Management] Upload and manage media files',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['upload', 'manage'],
            description: 'Media action to perform'
          },
          imageUrl: { type: 'string', description: 'URL of image to upload' },
          title: { type: 'string', description: 'Media title' },
          altText: { type: 'string', description: 'Alt text for accessibility' },
          search: { type: 'string', description: 'Search term for media' },
          mediaType: { type: 'string', enum: ['image', 'video', 'audio', 'document'] },
          perPage: { type: 'number', description: 'Number of items to return' }
        },
        required: ['action']
      },
      execute: async (params, context) => {
        return this.executeMediaAction(params, context);
      }
    });
  }

  createSiteAdministrationTool() {
    this.featureMap.set('site-administration', {
      name: 'site-administration',
      description: '[Site Administration] Manage categories, users, and settings',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['review', 'moderate', 'categories', 'tags', 'users'],
            description: 'Administration action to perform'
          },
          contentType: { type: 'string', enum: ['posts', 'comments'] },
          status: { type: 'string', enum: ['pending', 'draft', 'all', 'approved', 'spam', 'trash'] },
          perPage: { type: 'number', description: 'Number of items to return' },
          commentIds: { type: 'array', items: { type: 'number' } },
          moderateAction: { type: 'string', enum: ['approve', 'hold', 'spam', 'trash'] },
          reason: { type: 'string', description: 'Reason for action' },
          categoryAction: { type: 'string', enum: ['list', 'create', 'update', 'delete'] },
          categoryId: { type: 'number', description: 'Category ID' },
          name: { type: 'string', description: 'Category name' },
          description: { type: 'string', description: 'Category description' },
          parentId: { type: 'number', description: 'Parent category ID' },
          // Tag parameters
          tagAction: { type: 'string', enum: ['list', 'create', 'update', 'delete'] },
          tagId: { type: 'number', description: 'Tag ID' },
          // User parameters  
          userAction: { type: 'string', enum: ['list', 'get', 'current'] },
          userId: { type: 'number', description: 'User ID' }
        },
        required: ['action']
      },
      execute: async (params, context) => {
        return this.executeAdminAction(params, context);
      }
    });
  }

  // Action routing methods that delegate to existing implementation classes
  async executeContentAction(params, context) {
    switch (params.action) {
      case 'draft':
        return this.createDraftArticle(params);
      case 'publish':
        return this.publishArticle(params);
      case 'edit':
        return this.editDraft(params);
      case 'pull':
        return this.pullForEditing(params, context);
      case 'sync':
        return this.syncToWordPress(params, context);
      case 'page':
        return this.createPage(params);
      case 'trash':
        return this.trashContent(params);
      case 'markdown-to-wp':
        return this.markdownToWordPress(params);
      case 'bulk':
        return this.bulkContentOperations(params);
      default:
        throw new Error(`Unknown content action: ${params.action}`);
    }
  }

  async executeBlockAction(params, context) {
    const { server } = context;
    const sessionManager = server.documentSessionManager || server.enhancedDocumentSessionManager;
    
    if (!sessionManager) {
      throw new Error('No active document sessions. Use content-management with action "pull" first.');
    }

    switch (params.action) {
      // Original low-level actions
      case 'list':
        return sessionManager.listBlocks(params.documentHandle, params.filter || {});
      case 'read':
        return sessionManager.readBlock(params.documentHandle, params.blockId);
      case 'edit':
        return sessionManager.editBlock(params.documentHandle, params.blockId, params);
      case 'insert':
        // Check if this is a semantic type pattern
        if (params.type && params.type.startsWith('semantic-')) {
          const semanticType = params.type.replace('semantic-', '');
          return this.addSemanticBlock(sessionManager, params.documentHandle, semanticType, params.content);
        }
        return sessionManager.insertBlock(params.documentHandle, params);
      case 'delete':
        return sessionManager.deleteBlock(params.documentHandle, params.blockId);
      case 'reorder':
        return sessionManager.reorderBlocks(params.documentHandle, params.blockId, params.newPosition);
      case 'validate':
        return sessionManager.validateBlocks(params.documentHandle, params.blocks);
      
      // Semantic content actions
      case 'add-section':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'section', params.content);
      case 'add-subsection':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'subsection', params.content);
      case 'add-paragraph':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'paragraph', params.content);
      case 'add-list':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'list', params.content);
      case 'add-quote':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'quote', params.content);
      case 'add-code':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'code', params.content);
      case 'add-separator':
        return this.addSemanticBlock(sessionManager, params.documentHandle, 'separator', '');
      case 'continue-writing':
        return this.continueWriting(sessionManager, params.documentHandle, params.content);
      
      default:
        throw new Error(`Unknown block action: ${params.action}`);
    }
  }

  async executeWorkflowAction(params, context) {
    switch (params.action) {
      case 'find':
        return this.findPostsForWorkflow(params);
      case 'submit':
        return this.submitForReview(params);
      case 'publish':
        return this.publishWorkflow({
          postId: params.postId,
          action: params.publishAction,
          schedule_date: params.schedule_date
        });
      case 'feedback':
        return this.viewEditorialFeedback(params);
      default:
        throw new Error(`Unknown workflow action: ${params.action}`);
    }
  }

  async executeMediaAction(params, context) {
    switch (params.action) {
      case 'upload':
        return this.uploadImageFromUrl(params);
      case 'manage':
        return this.listMedia(params);
      default:
        throw new Error(`Unknown media action: ${params.action}`);
    }
  }

  async executeAdminAction(params, context) {
    switch (params.action) {
      case 'review':
        return this.reviewContent(params);
      case 'moderate':
        return this.moderateComments({
          commentIds: params.commentIds,
          action: params.moderateAction,
          reason: params.reason
        });
      case 'categories':
        return this.manageCategories({
          action: params.categoryAction,
          categoryId: params.categoryId,
          name: params.name,
          description: params.description,
          parentId: params.parentId
        });
      case 'tags':
        return this.manageTags({
          action: params.tagAction,
          tagId: params.tagId,
          name: params.name,
          description: params.description
        });
      case 'users':
        return this.manageUsers({
          action: params.userAction,
          userId: params.userId
        });
      default:
        throw new Error(`Unknown admin action: ${params.action}`);
    }
  }

  getSemanticOperations() {
    return Array.from(this.featureMap.values());
  }
  
  getGroupedSemanticOperations() {
    // Return the 5 unified semantic tools organized by groups
    const groups = {
      'content-management': {
        name: 'Content Management', 
        description: 'Create, edit, and manage posts and pages',
        operations: []
      },
      'block-editor': {
        name: 'Block Editor',
        description: 'Edit content using WordPress blocks', 
        operations: []
      },
      'publishing-workflow': {
        name: 'Publishing Workflow',
        description: 'Review, approve, and publish content',
        operations: []
      },
      'media-management': {
        name: 'Media Management',
        description: 'Upload and manage media files',
        operations: []
      },
      'site-administration': {
        name: 'Site Administration', 
        description: 'Manage categories, users, and settings',
        operations: []
      }
    };

    // Map the 5 unified tools to their respective groups
    const toolMapping = {
      'content-management': 'content-management',
      'block-editor': 'block-editor', 
      'publishing-workflow': 'publishing-workflow',
      'media-management': 'media-management',
      'site-administration': 'site-administration'
    };

    for (const [toolName, groupKey] of Object.entries(toolMapping)) {
      const tool = this.featureMap.get(toolName);
      if (tool) {
        groups[groupKey].operations.push({
          ...tool,
          group: groupKey,
          groupName: groups[groupKey].name
        });
      }
    }

    return groups;
  }

  async trashContent(params) {
    try {
      const { postId, contentType = 'post' } = params;
      
      // Use the existing trash-own-content feature logic
      const currentUser = await this.wpClient.request('/users/me');
      const currentUserId = currentUser.id;

      // Get the content to check ownership
      let content;
      if (contentType === 'post') {
        content = await this.wpClient.getPost(postId);
      } else {
        content = await this.wpClient.getPage(postId);
      }

      // Check if user owns the content (for non-administrators)
      if (content.author !== currentUserId) {
        return {
          success: false,
          error: 'Permission denied',
          message: `You can only trash your own ${contentType}s. This ${contentType} belongs to another author.`
        };
      }

      // User owns the content, proceed with trashing
      let result;
      if (contentType === 'post') {
        result = await this.wpClient.deletePost(postId, false); // false = don't force delete, just trash
      } else {
        result = await this.wpClient.deletePage(postId, false); // false = don't force delete, just trash
      }

      return {
        success: true,
        contentId: postId,
        contentType,
        title: result.title?.rendered || result.title?.raw || `${contentType} ${postId}`,
        message: `Successfully moved ${contentType} "${result.title?.rendered || result.title?.raw}" to trash`,
        hint: `To restore this ${contentType}, an editor or administrator can help, or you can restore it from the WordPress admin panel.`
      };

    } catch (error) {
      // Handle specific WordPress errors
      if (error.code === 'rest_post_invalid_id' || error.code === 'rest_page_invalid_id') {
        return {
          success: false,
          error: 'Not found',
          message: `${params.contentType || 'post'} with ID ${params.postId} not found`
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to trash content',
        message: `Could not move ${params.contentType || 'post'} to trash. ${error.data?.message || error.message || ''}`
      };
    }
  }

  async markdownToWordPress(params) {
    try {
      const { filePath, type = 'post', title, parent, recurse = false } = params;
      
      // Validate recurse option - only allowed with type="page" and directory input
      if (recurse && type !== 'page') {
        throw new Error('Recursive import is only allowed for pages (type="page")');
      }
      
      // Get list of markdown files to process
      const markdownFiles = this.resolveMarkdownFiles(filePath, recurse);
      
      if (markdownFiles.length === 0) {
        throw new Error('No markdown files found matching the specified path(s)');
      }

      const results = [];
      const errors = [];

      if (recurse && type === 'page') {
        // Recursive processing with parent-child hierarchy
        const pageHierarchy = await this.processMarkdownHierarchy(markdownFiles, parent);
        results.push(...pageHierarchy.results);
        errors.push(...pageHierarchy.errors);
      } else {
        // Normal processing - flat structure
        for (const fileInfo of markdownFiles) {
          try {
            // Handle both string paths and file info objects
            const filePath = typeof fileInfo === 'string' ? fileInfo : fileInfo.fullPath;
            const result = await this.processMarkdownFile(filePath, { type, title, parent });
            results.push(result);
          } catch (error) {
            errors.push({
              file: typeof fileInfo === 'string' ? fileInfo : fileInfo.fullPath,
              error: error.message
            });
          }
        }
      }

      // Return results summary
      if (results.length === 1 && errors.length === 0) {
        // Single file success - return simple result
        return results[0];
      }

      return {
        success: errors.length === 0,
        processed: results.length + errors.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors,
        message: `Processed ${markdownFiles.length} markdown files: ${results.length} successful, ${errors.length} failed`,
        hint: errors.length > 0 ? 'Check errors array for details on failed conversions' : 'All files converted successfully'
      };

    } catch (error) {
      throw new Error(`Failed to convert markdown to WordPress: ${error.message}`);
    }
  }

  resolveMarkdownFiles(filePath, recurse = false) {
    
    let pathsToProcess = Array.isArray(filePath) ? filePath : [filePath];
    const markdownFiles = [];

    for (let inputPath of pathsToProcess) {
      // Validate path against allowed patterns
      if (!this.isPathAllowed(inputPath)) {
        throw new Error(`Access denied: Path not in allowed locations: ${inputPath}`);
      }

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Path not found: ${inputPath}`);
      }

      const stat = fs.statSync(inputPath);
      
      if (stat.isFile()) {
        // Single file - check if it's markdown
        if (this.isMarkdownFile(inputPath)) {
          markdownFiles.push(inputPath);
        }
      } else if (stat.isDirectory()) {
        // Directory - find all markdown files
        if (recurse) {
          // Recursive processing - collect files with their directory structure
          this.collectMarkdownFilesRecursive(inputPath, inputPath, markdownFiles);
        } else {
          // Non-recursive - only files in this directory
          const files = fs.readdirSync(inputPath);
          for (const file of files) {
            const fullPath = path.join(inputPath, file);
            if (fs.statSync(fullPath).isFile() && this.isMarkdownFile(fullPath)) {
              markdownFiles.push(fullPath);
            }
          }
        }
      }
    }

    return markdownFiles;
  }

  isMarkdownFile(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    return ['md', 'markdown'].includes(ext);
  }

  collectMarkdownFilesRecursive(dirPath, rootPath, fileList) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively process subdirectories
        this.collectMarkdownFilesRecursive(fullPath, rootPath, fileList);
      } else if (stat.isFile() && this.isMarkdownFile(fullPath)) {
        // Add markdown file with relative path info
        fileList.push({
          fullPath,
          relativePath: path.relative(rootPath, fullPath),
          parentDir: path.relative(rootPath, dirPath)
        });
      }
    }
  }

  async processMarkdownHierarchy(fileList, rootParent) {
    const results = [];
    const errors = [];
    const directoryPages = new Map(); // Track created pages for each directory
    
    // Sort files by depth to ensure parent directories are processed first
    const sortedFiles = fileList.sort((a, b) => {
      const depthA = a.relativePath.split(path.sep).length;
      const depthB = b.relativePath.split(path.sep).length;
      return depthA - depthB;
    });

    for (const fileInfo of sortedFiles) {
      try {
        let parentId = rootParent;
        
        // If file is in a subdirectory, ensure parent pages exist
        if (fileInfo.parentDir) {
          const dirParts = fileInfo.parentDir.split(path.sep);
          let currentPath = '';
          
          for (const dirPart of dirParts) {
            currentPath = currentPath ? path.join(currentPath, dirPart) : dirPart;
            
            if (!directoryPages.has(currentPath)) {
              // Create a page for this directory
              const dirTitle = dirPart.charAt(0).toUpperCase() + dirPart.slice(1).replace(/-/g, ' ');
              const dirPage = await this.wpClient.createPage({
                title: { raw: dirTitle },
                content: { raw: `<p>Pages in ${dirTitle}</p>` },
                status: 'draft',
                parent: parentId || undefined
              });
              
              directoryPages.set(currentPath, dirPage.id);
              results.push({
                success: true,
                contentId: dirPage.id,
                contentType: 'page',
                title: dirPage.title.rendered,
                status: dirPage.status,
                editLink: dirPage.link.replace(this.wpClient.baseUrl, '') + '?preview=true',
                sourceFile: `${currentPath} (directory)`,
                message: `Created parent page for directory: ${dirPart}`
              });
            }
            
            parentId = directoryPages.get(currentPath);
          }
        }
        
        // Process the markdown file with appropriate parent
        const result = await this.processMarkdownFile(fileInfo.fullPath, { 
          type: 'page', 
          parent: parentId 
        });
        results.push(result);
        
      } catch (error) {
        errors.push({
          file: fileInfo.fullPath,
          error: error.message
        });
      }
    }
    
    return { results, errors };
  }

  async processMarkdownFile(filePath, options) {
    const { type = 'post', title, parent } = options;

    // Read markdown content
    const markdownContent = fs.readFileSync(filePath, 'utf8');
    
    // Extract title from markdown if not provided
    let extractedTitle = title;
    if (!extractedTitle) {
      const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
      extractedTitle = titleMatch ? titleMatch[1] : path.basename(filePath, path.extname(filePath));
    }

    // Convert markdown to HTML
    const htmlContent = this.markdownToHtml(markdownContent);

    // Create the content data
    const contentData = {
      title: { raw: extractedTitle },
      content: { raw: htmlContent },
      status: 'draft'
    };

    if (parent && type === 'page') {
      contentData.parent = parent;
    }

    // Create the content in WordPress
    let result;
    if (type === 'page') {
      result = await this.wpClient.createPage(contentData);
    } else {
      result = await this.wpClient.createPost(contentData);
    }

    return {
      success: true,
      contentId: result.id,
      contentType: type,
      title: result.title.rendered,
      status: result.status,
      editLink: result.link.replace(this.wpClient.baseUrl, '') + '?preview=true',
      sourceFile: filePath,
      message: `Converted "${path.basename(filePath)}" to WordPress ${type} draft`
    };
  }

  markdownToHtml(markdown) {
    // Basic markdown to HTML conversion
    // This should ideally use a proper markdown parser
    return markdown
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/^(.+)$/gm, '<p>$1</p>')
      .replace(/<\/p>\s*<p>/g, '</p>\n<p>')
      .replace(/<p><h([1-6])>/g, '<h$1>')
      .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
      .replace(/<p><ul>/g, '<ul>')
      .replace(/<\/ul><\/p>/g, '</ul>');
  }
  
  getOperation(name) {
    return this.featureMap.get(name);
  }

  // Implementation methods for semantic operations
  
  convertToBlockFormat(content) {
    // If content is already in block format, return as-is
    if (content.includes('<!-- wp:')) {
      return content;
    }
    
    // Split content into paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    
    // Convert each paragraph to a Gutenberg block
    const blocks = paragraphs.map(paragraph => {
      paragraph = paragraph.trim();
      
      // Check for headings (markdown style)
      const headingMatch = paragraph.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        return `<!-- wp:heading {"level":${level}} -->\n<h${level}>${text}</h${level}>\n<!-- /wp:heading -->`;
      }
      
      // Check for lists
      if (paragraph.match(/^[\*\-]\s+/m) || paragraph.match(/^\d+\.\s+/m)) {
        const isOrdered = paragraph.match(/^\d+\.\s+/m) !== null;
        const listItems = paragraph.split('\n').map(item => {
          return item.replace(/^[\*\-]\s+/, '').replace(/^\d+\.\s+/, '');
        }).filter(item => item.trim());
        
        const listTag = isOrdered ? 'ol' : 'ul';
        const listContent = listItems.map(item => `<li>${item}</li>`).join('\n');
        
        return `<!-- wp:list${isOrdered ? ' {"ordered":true}' : ''} -->\n<${listTag}>\n${listContent}\n</${listTag}>\n<!-- /wp:list -->`;
      }
      
      // Default to paragraph
      return `<!-- wp:paragraph -->\n<p>${paragraph}</p>\n<!-- /wp:paragraph -->`;
    });
    
    return blocks.join('\n\n');
  }
  
  async createDraftArticle(params) {
    try {
      // Convert plain content to Gutenberg block format
      const blockContent = this.convertToBlockFormat(params.content);
      
      // Prepare the base post data
      const postData = {
        title: { raw: params.title },
        content: { raw: blockContent },
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

      // Convert plain content to Gutenberg block format
      const blockContent = this.convertToBlockFormat(params.content);
      
      const postData = {
        title: { raw: params.title },
        content: { raw: blockContent },
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
      let imageBlob;
      let filename;

      // Check if this is a local file path
      if (params.imageUrl.startsWith('/') || params.imageUrl.startsWith('file://') || params.imageUrl.startsWith('$')) {
        // Handle local file upload
        const filePath = params.imageUrl.replace('file://', '');
        
        // Validate against allowed paths
        if (!this.isPathAllowed(filePath)) {
          throw new Error(`Access denied: Path not in allowed locations`);
        }

        
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const fileBuffer = fs.readFileSync(filePath);
        // Create a File-like object for Node.js environment
        imageBlob = new File([fileBuffer], path.basename(filePath), {
          type: this.getMimeType(filePath)
        });
        filename = path.basename(filePath);
      } else {
        // Handle URL upload
        const response = await fetch(params.imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        imageBlob = await response.blob();
        filename = params.imageUrl.split('/').pop() || 'uploaded-image.jpg';
      }
      
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

  expandEnvVars(str) {
    // Replace $VAR and ${VAR} patterns with environment variables
    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // Handle ${VAR:-default} syntax
      const [name, defaultValue] = varName.split(':-');
      return process.env[name] || defaultValue || '';
    }).replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }

  isPathAllowed(filePath) {
    const allowedPaths = process.env.ALLOWED_FILE_PATHS;
    if (!allowedPaths) {
      return false; // No local paths allowed if not configured
    }

    // Only expand env vars in the allowed patterns from config, NOT in the input path
    const allowedPatterns = allowedPaths.split(',').map(p => this.expandEnvVars(p.trim()));

    // Check if the file path starts with any allowed pattern
    return allowedPatterns.some(pattern => {
      return filePath.startsWith(pattern);
    });
  }

  async bulkContentOperations(params) {
    try {
      const { operation, contentIds, newStatus } = params;
      
      // Use the existing bulk-content-operations feature logic
      const results = [];
      const errors = [];
      
      for (const contentId of contentIds) {
        try {
          let result;
          let actualContentType;
          
          // First, try to determine the content type by attempting to fetch it
          let isPost = false;
          let isPage = false;
          
          try {
            await this.wpClient.getPost(contentId);
            isPost = true;
            actualContentType = 'post';
          } catch (e) {
            // Not a post, try page
            try {
              await this.wpClient.getPage(contentId);
              isPage = true;
              actualContentType = 'page';
            } catch (e2) {
              // Neither post nor page
              throw new Error(`Content ID ${contentId} not found as post or page`);
            }
          }
          
          switch (operation) {
            case 'trash':
              // Use DELETE method without force parameter to move to trash
              if (isPost) {
                result = await this.wpClient.deletePost(contentId, false);
              } else {
                result = await this.wpClient.deletePage(contentId, false);
              }
              break;
              
            case 'delete':
              if (isPost) {
                result = await this.wpClient.deletePost(contentId, true);
              } else {
                result = await this.wpClient.deletePage(contentId, true);
              }
              break;
              
            case 'change_status':
              if (!newStatus) {
                throw new Error('newStatus is required for change_status operation');
              }
              if (isPost) {
                result = await this.wpClient.updatePost(contentId, { status: newStatus });
              } else {
                result = await this.wpClient.updatePage(contentId, { status: newStatus });
              }
              break;
          }
          
          results.push({
            contentId,
            contentType: actualContentType,
            success: true,
            title: result.title?.rendered || result.title?.raw || `${actualContentType} ${contentId}`,
          });
        } catch (error) {
          errors.push({
            contentId,
            error: error.message,
          });
        }
      }
      
      return {
        success: errors.length === 0,
        operation,
        processed: results.length + errors.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors,
        message: `Bulk ${operation} completed: ${results.length} successful, ${errors.length} failed`
      };
      
    } catch (error) {
      throw new Error(`Failed to perform bulk operation: ${error.message}`);
    }
  }

  getMimeType(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'pdf': 'application/pdf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
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

  async pullForEditing(params, context) {
    try {
      const { documentSessionManager } = context;
      const wpClient = context.wpClient || this.wpClient;
      const contentType = params.type || 'post';
      
      // Fetch the content from WordPress based on type
      const content = contentType === 'page' 
        ? await wpClient.getPage(params.postId)
        : await wpClient.getPost(params.postId);
      
      // Create editing session with blocks using the enhanced session manager
      // Always prefer raw content (with block comments) over rendered content
      const rawContent = content.content.raw || content.content.rendered;
      console.log('Content format from WordPress:', {
        hasRaw: !!content.content.raw,
        hasRendered: !!content.content.rendered,
        rawLength: content.content.raw?.length || 0,
        renderedLength: content.content.rendered?.length || 0
      });
      
      const session = await documentSessionManager.createSession(
        params.postId, 
        rawContent,
        {
          title: content.title.rendered,
          status: content.status,
          contentType: contentType,
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

  async syncToWordPress(params, context) {
    try {
      const { wpClient, documentSessionManager } = context;
      
      // Check if this is a block session or legacy markdown session
      if (documentSessionManager.hasSession && documentSessionManager.hasSession(params.documentHandle)) {
        // New block format - get content and metadata directly
        const syncData = await documentSessionManager.getContentForSync(params.documentHandle);
        
        if (!syncData.hasChanges) {
          return {
            success: true,
            message: 'No changes to sync',
            contentId: syncData.contentId,
            contentType: syncData.contentType
          };
        }
        
        // Prepare update data for WordPress
        const updateData = {
          content: syncData.content, // Already in WordPress block HTML format
        };
        
        // Update the content in WordPress
        const isPage = syncData.contentType === 'page';
        const updatedContent = isPage 
          ? await wpClient.updatePage(syncData.contentId, updateData)
          : await wpClient.updatePost(syncData.contentId, updateData);
        
        // Close session if requested (default: true)
        if (params.closeSession !== false) {
          await documentSessionManager.closeSession(params.documentHandle);
        }
        
        const result = {
          success: true,
          [`${isPage ? 'page' : 'post'}Id`]: syncData.contentId,
          title: updatedContent.title.rendered,
          status: updatedContent.status,
          documentHandle: params.documentHandle,
          sessionClosed: params.closeSession !== false,
          message: `${isPage ? 'Page' : 'Post'} synced to WordPress successfully`,
          semanticContext: {
            contentType: syncData.contentType,
            hint: isPage 
              ? 'Page updated - remember pages are for static, timeless content'
              : 'Post updated - posts are for time-based content like news or articles'
          }
        };
        
        // Add validation info if fixes were applied
        if (syncData.validation && syncData.validation.fixesApplied) {
          result.validation = syncData.validation;
          result.message += `. ${syncData.validation.summary}`;
        }
        
        return result;
      }
      
      // Legacy markdown format fallback
      const content = await documentSessionManager.getDocumentContent(params.documentHandle);
      
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
        ? await wpClient.updatePage(postId, updateData)
        : await wpClient.updatePost(postId, updateData);

      // Close session if requested (default: true)
      if (params.closeSession !== false) {
        await documentSessionManager.closeSession(params.documentHandle);
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
      // Provide specific recovery guidance based on error type
      let errorMessage = `Failed to sync to WordPress: ${error.message}`;
      let recoveryHints = [];

      if (error.message.includes('Cannot create property') && error.message.includes('on string')) {
        recoveryHints.push('RECOVERY: Block attributes got stringified. Use individual parameters instead of attributes object.');
        recoveryHints.push('Example: Use "level": 2 instead of "attributes": {"level": 2}');
        recoveryHints.push('Try: Delete the problematic block and recreate it with simple parameters.');
      }

      if (error.message.includes('Block validation')) {
        recoveryHints.push('RECOVERY: Block validation failed. Check block content and attributes.');
        recoveryHints.push('Try: Use block-editor read action to inspect the block, then edit with valid content.');
      }

      if (error.message.includes('Missing required attribute')) {
        recoveryHints.push('RECOVERY: Required block attribute missing.');
        recoveryHints.push('Example: Heading blocks need "level": 2, list blocks need "ordered": false');
      }

      if (recoveryHints.length > 0) {
        errorMessage += '\n\n' + recoveryHints.join('\n');
      }

      throw new Error(errorMessage);
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
    const parts = content.split(`---\n${metadataMarker}`);
    
    if (parts.length !== 2) {
      // Try alternative divider format
      const altParts = content.split(`----\n${metadataMarker}`);
      if (altParts.length === 2) {
        parts[0] = altParts[0];
        parts[1] = altParts[1];
      } else {
        throw new Error('Invalid temp file format - missing metadata section. Expected "---" divider before metadata.');
      }
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
      
      // Determine content type to search
      const contentType = params.contentType || 'any'; // Default to 'any' to get both posts and pages
      
      let allContent = [];
      
      // Fetch posts and/or pages based on contentType parameter
      if (contentType === 'post' || contentType === 'any') {
        const posts = await this.wpClient.listPosts(searchParams);
        allContent.push(...posts.map(item => ({ ...item, type: 'post' })));
      }
      
      if (contentType === 'page' || contentType === 'any') {
        const pages = await this.wpClient.listPages(searchParams);
        allContent.push(...pages.map(item => ({ ...item, type: 'page' })));
      }
      
      // Sort all content by modified date (newest first)
      allContent.sort((a, b) => new Date(b.modified) - new Date(a.modified));
      
      // Apply pagination to combined results
      const startIndex = (page - 1) * perPage;
      const paginatedContent = allContent.slice(startIndex, startIndex + perPage);
      
      // Calculate total items and pages
      const totalItems = allContent.length;
      const totalPages = Math.ceil(totalItems / perPage);
      
      // Format results with workflow suggestions
      const formattedContent = paginatedContent.map(item => {
        const baseInfo = {
          id: item.id,
          type: item.type, // 'post' or 'page'
          title: item.title.rendered,
          status: item.status,
          date: item.date,
          modified: item.modified,
          excerpt: item.excerpt.rendered.replace(/<[^>]*>/g, '').trim(),
          author: item._embedded?.author?.[0]?.name || `User ${item.author}`,
          categories: item._embedded?.['wp:term']?.[0]?.map(cat => cat.name) || [],
          tags: item._embedded?.['wp:term']?.[1]?.map(tag => tag.name) || []
        };
        
        // Add suggested actions based on status and intent
        const suggestedActions = this.getSuggestedActions(item.status, params.intent);
        
        return {
          ...baseInfo,
          suggestedActions
        };
      });
      
      // Provide workflow guidance
      const workflowGuidance = this.getWorkflowGuidance(params.intent, formattedContent.length, totalItems);
      
      return {
        success: true,
        query: params.query || '',
        intent: params.intent || 'any',
        contentType: contentType,
        page,
        perPage,
        totalItems,
        totalPages,
        posts: formattedContent, // Keep 'posts' key for backward compatibility but it contains both posts and pages
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

  // Semantic Block Methods - Abstract WordPress complexity with intent-based actions

  async addSemanticBlock(sessionManager, documentHandle, semanticType, content) {
    try {
      // Get current document structure for context-aware positioning
      const blocks = await sessionManager.listBlocks(documentHandle);
      const position = blocks.total; // Append by default
      
      // Map semantic types to WordPress blocks with smart defaults
      const blockConfig = this.getSemanticBlockConfig(semanticType, blocks, content);
      
      const result = await sessionManager.insertBlock(documentHandle, {
        type: blockConfig.type,
        content: blockConfig.content,
        position: blockConfig.position || position,
        attributes: blockConfig.attributes,
        validateImmediately: true
      });

      if (result.success) {
        // Add semantic context and suggestions
        result.semanticType = semanticType;
        result.semanticContext = {
          hint: blockConfig.hint,
          suggestedNext: blockConfig.suggestedNext
        };
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to add ${semanticType}: ${error.message}`);
    }
  }

  getSemanticBlockConfig(semanticType, existingBlocks, content) {
    // Analyze document structure for smart defaults
    const hasHeadings = existingBlocks.blocks.some(b => b.type === 'core/heading');
    const lastBlock = existingBlocks.blocks[existingBlocks.total - 1];
    
    switch (semanticType) {
      case 'section':
        return {
          type: 'core/heading',
          content: content || 'New Section',
          attributes: { level: hasHeadings ? 2 : 1 }, // H1 for first, H2 for subsequent
          hint: 'Section heading added - use add-paragraph to start content',
          suggestedNext: ['add-paragraph', 'add-subsection', 'add-list']
        };
        
      case 'subsection':
        return {
          type: 'core/heading', 
          content: content || 'New Subsection',
          attributes: { level: hasHeadings ? 3 : 2 }, // Smart level based on context
          hint: 'Subsection heading added - add content to develop this section',
          suggestedNext: ['add-paragraph', 'add-list', 'add-quote']
        };
        
      case 'paragraph':
        return {
          type: 'core/paragraph',
          content: content || 'Your content here...',
          attributes: {},
          hint: 'Paragraph added - continue writing or add another content type',
          suggestedNext: ['continue-writing', 'add-list', 'add-quote', 'add-section']
        };
        
      case 'list':
        // Detect if content should be ordered or unordered
        const isNumbered = /^\d+\./.test(content);
        return {
          type: 'core/list',
          content: content || '• First item\n• Second item',
          attributes: { ordered: isNumbered },
          hint: 'List added - each line becomes a list item',
          suggestedNext: ['add-paragraph', 'add-section', 'add-quote']
        };
        
      case 'quote':
        return {
          type: 'core/quote',
          content: `<p>${content || 'Your quote here...'}</p>`,
          attributes: {},
          hint: 'Quote block added - great for highlighting key insights',
          suggestedNext: ['add-paragraph', 'add-section', 'continue-writing']
        };
        
      case 'code':
        return {
          type: 'core/code',
          content: content || '// Your code here',
          attributes: {},
          hint: 'Code block added - preserves formatting and spacing',
          suggestedNext: ['add-paragraph', 'add-section', 'continue-writing']
        };
        
      case 'separator':
        return {
          type: 'core/separator',
          content: '',
          attributes: {},
          hint: 'Visual separator added - helps organize content sections',
          suggestedNext: ['add-section', 'add-paragraph']
        };
        
      default:
        throw new Error(`Unknown semantic type: ${semanticType}`);
    }
  }

  async continueWriting(sessionManager, documentHandle, content) {
    try {
      // Get the last block to understand context
      const blocks = await sessionManager.listBlocks(documentHandle);
      const lastBlock = blocks.blocks[blocks.total - 1];
      
      if (!lastBlock) {
        // No blocks yet, start with a paragraph
        return this.addSemanticBlock(sessionManager, documentHandle, 'paragraph', content);
      }
      
      // Smart continuation based on last block type
      if (lastBlock.type === 'core/paragraph') {
        // Continue with another paragraph
        return this.addSemanticBlock(sessionManager, documentHandle, 'paragraph', content);
      } else if (lastBlock.type === 'core/heading') {
        // After heading, add content paragraph
        return this.addSemanticBlock(sessionManager, documentHandle, 'paragraph', content);
      } else if (lastBlock.type === 'core/list') {
        // Continue list or add paragraph after list
        const continueList = content && (content.includes('•') || content.includes('-') || /^\d+\./.test(content));
        if (continueList) {
          return this.addSemanticBlock(sessionManager, documentHandle, 'list', content);
        } else {
          return this.addSemanticBlock(sessionManager, documentHandle, 'paragraph', content);
        }
      } else {
        // Default to paragraph for other types
        return this.addSemanticBlock(sessionManager, documentHandle, 'paragraph', content);
      }
    } catch (error) {
      throw new Error(`Failed to continue writing: ${error.message}`);
    }
  }

}