/**
 * Workspace Manager
 * 
 * Manages local authoring workspace for WordPress posts
 * Similar to cups-mcp's document management but for WordPress content
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

export class WorkspaceManager {
  constructor() {
    this.workspaceDir = join(homedir(), '.wordpress-mcp', 'workspace');
    this.metadataFile = join(this.workspaceDir, '.metadata.json');
    this.metadata = new Map();
  }

  async initialize() {
    // Ensure workspace directory exists
    await fs.mkdir(this.workspaceDir, { recursive: true });
    
    // Load existing metadata
    await this.loadMetadata();
  }

  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf8');
      const parsed = JSON.parse(data);
      this.metadata = new Map(Object.entries(parsed));
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.metadata = new Map();
    }
  }

  async saveMetadata() {
    const data = Object.fromEntries(this.metadata);
    await fs.writeFile(this.metadataFile, JSON.stringify(data, null, 2));
  }

  getPostPath(postId) {
    return join(this.workspaceDir, `post-${postId}.md`);
  }

  async pullPost(post, wpClient) {
    const postPath = this.getPostPath(post.id);
    
    // Convert post to markdown format for editing
    const content = this.postToMarkdown(post);
    
    // Write to local file
    await fs.writeFile(postPath, content, 'utf8');
    
    // Store metadata for sync tracking
    this.metadata.set(postPath, {
      postId: post.id,
      lastSync: Date.now(),
      lastModified: Date.now(),
      wpHash: this.hashContent(post.content.raw || post.content.rendered),
      localHash: this.hashContent(content),
      status: post.status,
      title: post.title.rendered,
    });
    
    await this.saveMetadata();
    
    return {
      localPath: postPath,
      content: content,
      metadata: this.metadata.get(postPath),
    };
  }

  async editPostContent(postId, oldString, newString, expectedReplacements = 1) {
    const postPath = this.getPostPath(postId);
    
    // Check if post is in workspace
    if (!this.metadata.has(postPath)) {
      throw new Error(`Post ${postId} not found in workspace. Use pull-post first.`);
    }

    // Validate inputs
    if (oldString === newString) {
      throw new Error('old_string and new_string are the same');
    }

    try {
      // Read current content
      const content = await fs.readFile(postPath, 'utf8');
      
      // Count occurrences
      const occurrences = (content.match(new RegExp(this.escapeRegex(oldString), 'g')) || []).length;
      
      if (occurrences !== expectedReplacements) {
        throw new Error(`Expected ${expectedReplacements} replacement(s), found ${occurrences}`);
      }

      // Perform replacement
      const newContent = content.replace(new RegExp(this.escapeRegex(oldString), 'g'), newString);
      
      // Write back to file
      await fs.writeFile(postPath, newContent, 'utf8');
      
      // Update metadata
      const meta = this.metadata.get(postPath);
      meta.lastModified = Date.now();
      meta.localHash = this.hashContent(newContent);
      meta.hasChanges = true;
      
      await this.saveMetadata();
      
      return {
        success: true,
        replacements: expectedReplacements,
        postId: postId,
        localPath: postPath,
        snippet: this.getEditSnippet(newContent, newString),
      };
      
    } catch (error) {
      throw new Error(`Edit failed: ${error.message}`);
    }
  }

  async syncToWordPress(postId, wpClient) {
    const postPath = this.getPostPath(postId);
    const meta = this.metadata.get(postPath);
    
    if (!meta) {
      throw new Error(`Post ${postId} not found in workspace`);
    }

    // Read current local content
    const localContent = await fs.readFile(postPath, 'utf8');
    const parsedContent = this.markdownToPost(localContent);
    
    // Update the WordPress post
    const updateData = {
      title: { raw: parsedContent.title },
      content: { raw: parsedContent.content },
      excerpt: { raw: parsedContent.excerpt },
    };

    const updatedPost = await wpClient.updatePost(postId, updateData);
    
    // Update metadata
    meta.lastSync = Date.now();
    meta.wpHash = this.hashContent(updatedPost.content.raw);
    meta.hasChanges = false;
    
    await this.saveMetadata();
    
    return updatedPost;
  }

  async cleanup(postId) {
    const postPath = this.getPostPath(postId);
    
    try {
      await fs.unlink(postPath);
      this.metadata.delete(postPath);
      await this.saveMetadata();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Convert WordPress post to markdown for editing
  postToMarkdown(post) {
    let content = `# ${post.title.rendered || post.title.raw || 'Untitled'}\n\n`;
    
    if (post.excerpt && (post.excerpt.rendered || post.excerpt.raw)) {
      content += `**Excerpt:** ${post.excerpt.rendered || post.excerpt.raw}\n\n`;
    }
    
    content += `---\n\n`;
    content += post.content.rendered || post.content.raw || '';
    
    return content;
  }

  // Convert markdown back to WordPress post format
  markdownToPost(markdown) {
    const lines = markdown.split('\n');
    let title = 'Untitled';
    let excerpt = '';
    let content = '';
    let inContent = false;
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        title = line.substring(2).trim();
      } else if (line.startsWith('**Excerpt:**')) {
        excerpt = line.substring(12).trim();
      } else if (line === '---') {
        inContent = true;
        continue;
      } else if (inContent) {
        content += line + '\n';
      }
    }
    
    return {
      title: title.trim(),
      excerpt: excerpt.trim(), 
      content: content.trim(),
    };
  }

  hashContent(content) {
    return createHash('md5').update(content || '').digest('hex');
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getEditSnippet(content, searchTerm, contextLines = 2) {
    const lines = content.split('\n');
    const searchIndex = lines.findIndex(line => line.includes(searchTerm));
    
    if (searchIndex === -1) return 'Changes applied';
    
    const start = Math.max(0, searchIndex - contextLines);
    const end = Math.min(lines.length, searchIndex + contextLines + 1);
    
    return lines.slice(start, end).join('\n');
  }
}