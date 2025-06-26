/**
 * Document Session Manager
 * 
 * Provides filesystem abstraction for editing workflows.
 * AI agents only see opaque document handles, never file paths.
 */

import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import TurndownService from 'turndown';
import { marked } from 'marked';

export class DocumentSessionManager {
  constructor() {
    // Map of handles to session metadata
    this.sessions = new Map();
    this.documentsDir = join(homedir(), 'Documents');
    
    // Initialize content converters - "it's the thought that counts"
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    });
    
    // Don't escape markdown characters - we want clean, editable text
    this.turndownService.escape = function(string) {
      return string;
    };
    
    // Configure marked for clean HTML output
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }

  /**
   * Convert WordPress HTML to clean markdown for AI editing
   * "It's the thought that counts" - focus on content, not encoding
   * Resilient with fallbacks for malformed HTML
   */
  htmlToMarkdown(html) {
    try {
      // First, try clean conversion with turndown
      return this.turndownService.turndown(html || '');
    } catch (error) {
      console.warn('Turndown conversion failed, using fallback:', error.message);
      
      // Fallback: basic HTML entity cleanup and tag stripping
      try {
        return (html || '')
          // HTML entities to readable text
          .replace(/&#8220;/g, '"')
          .replace(/&#8221;/g, '"')
          .replace(/&#8216;/g, "'")
          .replace(/&#8217;/g, "'")
          .replace(/&#8212;/g, '—')
          .replace(/&#8211;/g, '–')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          // Strip HTML tags but preserve content
          .replace(/<[^>]*>/g, '')
          // Clean up whitespace
          .replace(/\s+/g, ' ')
          .trim();
      } catch (fallbackError) {
        console.warn('Fallback conversion also failed:', fallbackError.message);
        // Last resort: return original content
        return html || '';
      }
    }
  }

  /**
   * Convert AI-edited markdown back to WordPress HTML
   * Preserves formatting while handling encoding automatically
   * Resilient with fallbacks for malformed markdown
   */
  markdownToHtml(markdown) {
    try {
      // First, try clean conversion with marked
      return marked(markdown || '');
    } catch (error) {
      console.warn('Marked conversion failed, using fallback:', error.message);
      
      // Fallback: basic markdown to HTML conversion
      try {
        return (markdown || '')
          // Basic markdown patterns
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          // Headers
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          // Line breaks to paragraphs
          .replace(/\n\n/g, '</p><p>')
          .replace(/^/, '<p>')
          .replace(/$/, '</p>')
          // Clean up empty paragraphs
          .replace(/<p><\/p>/g, '');
      } catch (fallbackError) {
        console.warn('Fallback markdown conversion also failed:', fallbackError.message);
        // Last resort: return original content with basic paragraph wrapping
        return `<p>${(markdown || '').replace(/\n/g, '<br>')}</p>`;
      }
    }
  }

  /**
   * Create a new editing session for a WordPress post
   * Returns an opaque handle, never exposes file paths
   */
  async createSession(postId, content, metadata = {}) {
    // Generate opaque handle
    const handle = this.generateHandle();
    
    // Ensure documents directory exists
    if (!existsSync(this.documentsDir)) {
      await mkdir(this.documentsDir, { recursive: true });
    }

    // Create temp file (hidden from AI)
    const timestamp = Date.now();
    const fileName = `wp-post-${postId}-${timestamp}.md`;
    const filePath = join(this.documentsDir, fileName);
    
    // Write content to temp file
    await writeFile(filePath, content, 'utf8');

    // Store session metadata (hidden from AI)
    this.sessions.set(handle, {
      postId,
      filePath,
      fileName,
      created: new Date(),
      metadata
    });

    return {
      documentHandle: handle,
      postId,
      title: metadata.title,
      status: metadata.status,
      message: `Document ready for editing with handle: ${handle}`
    };
  }

  /**
   * Read document content by handle
   * No file paths exposed to AI
   */
  async readDocument(handle, offset = 1, limit = 50) {
    const session = this.getSession(handle);
    
    const content = await readFile(session.filePath, 'utf8');
    const lines = content.split('\n');
    
    // Apply offset and limit
    const startIndex = offset - 1;
    const endIndex = Math.min(lines.length, startIndex + limit);
    
    // Format with line numbers (cat -n style)
    const numberedLines = lines.slice(startIndex, endIndex)
      .map((line, i) => {
        const lineNum = startIndex + i + 1;
        return `${lineNum.toString().padStart(6)}\t${line}`;
      })
      .join('\n');
    
    return {
      success: true,
      documentHandle: handle,
      totalLines: lines.length,
      startLine: startIndex + 1,
      endLine: endIndex,
      content: numberedLines,
    };
  }

  /**
   * Edit document by handle using string replacement
   * No file paths exposed to AI
   */
  async editDocument(handle, oldString, newString, expectedReplacements = 1) {
    const session = this.getSession(handle);
    
    // Read current content
    const content = await readFile(session.filePath, 'utf8');
    
    // Count occurrences
    const occurrences = (content.match(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    if (occurrences === 0) {
      throw new Error(`String not found: "${oldString}"`);
    }
    
    if (expectedReplacements && occurrences !== expectedReplacements) {
      throw new Error(`Expected ${expectedReplacements} replacements, but found ${occurrences} occurrences`);
    }
    
    // Perform replacement
    const newContent = content.replace(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newString);
    
    // Write back
    await writeFile(session.filePath, newContent, 'utf8');
    
    // Get snippet for confirmation
    const lines = newContent.split('\n');
    const changeIndex = lines.findIndex(line => line.includes(newString));
    const startLine = Math.max(0, changeIndex - 2);
    const endLine = Math.min(lines.length, changeIndex + 3);
    const snippet = lines.slice(startLine, endLine)
      .map((line, i) => `${startLine + i + 1}: ${line}`)
      .join('\n');
    
    return {
      success: true,
      documentHandle: handle,
      replacements: occurrences,
      message: `Successfully replaced ${occurrences} occurrence(s)`,
      snippet: snippet,
    };
  }

  /**
   * Edit document by line number - more reliable than string matching
   * Replaces entire line at specified line number
   */
  async editDocumentLine(handle, lineNumber, newLine) {
    const session = this.getSession(handle);
    
    const content = await readFile(session.filePath, 'utf8');
    const lines = content.split('\n');
    
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Line number ${lineNumber} out of range (1-${lines.length})`);
    }
    
    const oldLine = lines[lineNumber - 1];
    lines[lineNumber - 1] = newLine;
    
    const newContent = lines.join('\n');
    await writeFile(session.filePath, newContent, 'utf8');
    
    return {
      success: true,
      documentHandle: handle,
      lineNumber: lineNumber,
      oldLine: oldLine,
      newLine: newLine,
      message: `Line ${lineNumber} replaced successfully`,
    };
  }

  /**
   * Insert content at specific line number
   * Content is inserted before the specified line
   */
  async insertAtLine(handle, lineNumber, content) {
    const session = this.getSession(handle);
    
    const fileContent = await readFile(session.filePath, 'utf8');
    const lines = fileContent.split('\n');
    
    if (lineNumber < 1 || lineNumber > lines.length + 1) {
      throw new Error(`Line number ${lineNumber} out of range (1-${lines.length + 1})`);
    }
    
    // Insert content before specified line
    lines.splice(lineNumber - 1, 0, content);
    
    const newContent = lines.join('\n');
    await writeFile(session.filePath, newContent, 'utf8');
    
    return {
      success: true,
      documentHandle: handle,
      insertedAt: lineNumber,
      content: content,
      message: `Content inserted at line ${lineNumber}`,
    };
  }

  /**
   * Replace multiple lines with new content
   */
  async replaceLines(handle, startLine, endLine, newContent) {
    const session = this.getSession(handle);
    
    const content = await readFile(session.filePath, 'utf8');
    const lines = content.split('\n');
    
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error(`Invalid line range ${startLine}-${endLine} (document has ${lines.length} lines)`);
    }
    
    // Extract old content for reference
    const oldContent = lines.slice(startLine - 1, endLine).join('\n');
    
    // Replace the lines
    const newLines = newContent.split('\n');
    lines.splice(startLine - 1, endLine - startLine + 1, ...newLines);
    
    const updatedContent = lines.join('\n');
    await writeFile(session.filePath, updatedContent, 'utf8');
    
    return {
      success: true,
      documentHandle: handle,
      startLine: startLine,
      endLine: endLine,
      linesReplaced: endLine - startLine + 1,
      newLineCount: newLines.length,
      message: `Replaced lines ${startLine}-${endLine} with ${newLines.length} new line(s)`,
    };
  }

  /**
   * Search and replace with line context
   * More flexible than exact string matching
   */
  async searchReplace(handle, searchTerm, replacement, options = {}) {
    const session = this.getSession(handle);
    
    const content = await readFile(session.filePath, 'utf8');
    const lines = content.split('\n');
    
    const { nearLine, maxReplacements = 1 } = options;
    let replacements = 0;
    const changes = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (replacements >= maxReplacements) break;
      
      // If nearLine specified, only search within 5 lines
      if (nearLine && Math.abs(i + 1 - nearLine) > 5) continue;
      
      if (lines[i].includes(searchTerm)) {
        const oldLine = lines[i];
        lines[i] = lines[i].replace(searchTerm, replacement);
        replacements++;
        changes.push({
          lineNumber: i + 1,
          oldLine: oldLine,
          newLine: lines[i]
        });
      }
    }
    
    if (replacements === 0) {
      throw new Error(`Term "${searchTerm}" not found${nearLine ? ` near line ${nearLine}` : ''}`);
    }
    
    const newContent = lines.join('\n');
    await writeFile(session.filePath, newContent, 'utf8');
    
    return {
      success: true,
      documentHandle: handle,
      searchTerm: searchTerm,
      replacement: replacement,
      replacements: replacements,
      changes: changes,
      message: `Replaced ${replacements} occurrence(s) of "${searchTerm}"`,
    };
  }

  /**
   * Get document content for syncing back to WordPress
   * Internal method - file path never exposed to AI
   */
  async getDocumentContent(handle) {
    const session = this.getSession(handle);
    const content = await readFile(session.filePath, 'utf8');
    return content;
  }

  /**
   * Clean up session and temp file
   * AI just calls this with handle, filesystem details hidden
   */
  async closeSession(handle) {
    const session = this.getSession(handle);
    
    try {
      await unlink(session.filePath);
    } catch (error) {
      // File might already be deleted, that's okay
    }
    
    this.sessions.delete(handle);
    
    return {
      success: true,
      documentHandle: handle,
      message: `Session ${handle} closed and cleaned up`
    };
  }

  /**
   * List active sessions (for debugging/management)
   * Only shows handles and metadata, no file paths
   */
  getActiveSessions() {
    return Array.from(this.sessions.entries()).map(([handle, session]) => ({
      documentHandle: handle,
      postId: session.postId,
      created: session.created,
      fileName: session.fileName, // Just filename, not full path
    }));
  }

  // Private methods

  generateHandle() {
    return `wp-session-${randomBytes(8).toString('hex')}`;
  }

  getSession(handle) {
    const session = this.sessions.get(handle);
    if (!session) {
      throw new Error(`Invalid document handle: ${handle}`);
    }
    return session;
  }
}