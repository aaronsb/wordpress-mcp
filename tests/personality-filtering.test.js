/**
 * Personality-Based Tool Filtering Tests
 * 
 * Tests the 5-tool architecture with role-based action filtering
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'src', 'server.js');

// Helper function to run server with personality and capture output
async function testServerWithPersonality(personality, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath, `--personality=${personality}`], {
      env: { 
        ...process.env,
        WORDPRESS_URL: 'test',
        WORDPRESS_USERNAME: 'test', 
        WORDPRESS_PASSWORD: 'test'
      },
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    server.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Kill server after timeout
    const timeoutId = setTimeout(() => {
      server.kill('SIGTERM');
      resolve({ stdout, stderr, killed: true });
    }, timeout);

    server.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, code, killed: false });
    });

    server.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

// Helper function to test MCP protocol response
async function testMcpProtocol(personality, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath, `--personality=${personality}`], {
      env: { 
        ...process.env,
        WORDPRESS_URL: 'test',
        WORDPRESS_USERNAME: 'test', 
        WORDPRESS_PASSWORD: 'test'
      },
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    server.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Send ping after a short delay
    setTimeout(() => {
      server.stdin.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
      server.stdin.end();
    }, 1000);

    const timeoutId = setTimeout(() => {
      server.kill('SIGTERM');
      resolve({ stdout, stderr, timeout: true });
    }, timeout);

    server.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, code });
    });

    server.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

describe('MCP Server Personality Filtering', () => {

  test('should respond to basic MCP ping protocol', async () => {
    const result = await testMcpProtocol('author');
    
    // Should contain a valid JSON-RPC response
    assert(result.stdout.includes('"jsonrpc":"2.0"'), 'Should respond with JSON-RPC 2.0');
    assert(result.stdout.includes('"id":1'), 'Should echo the request ID');
    assert(result.stdout.includes('"result"'), 'Should contain result field');
  });

  test('contributor personality should have limited tools and actions', async () => {
    const result = await testServerWithPersonality('contributor');
    
    // Should load successfully
    assert(result.stderr.includes('Loaded 3 tools for contributor personality'), 
      'Should load exactly 3 tools for contributor');
    
    // Content Management should have limited actions (no publish, no trash)
    assert(result.stderr.includes('Content Management: [draft, edit, pull, sync]'), 
      'Content Management should only have draft, edit, pull, sync actions');
    
    // Should have Block Editor with all actions
    assert(result.stderr.includes('Block Editor: [list, read, edit, insert, delete, reorder, validate]'), 
      'Block Editor should have all standard actions');
    
    // Should have Publishing Workflow with limited actions (no publish)
    assert(result.stderr.includes('Publishing Workflow: [find, submit, feedback]'), 
      'Publishing Workflow should not include publish action');
    
    // Should NOT have Media Management or Site Administration
    assert(!result.stderr.includes('Media Management:'), 
      'Should not have Media Management tool');
    assert(!result.stderr.includes('Site Administration:'), 
      'Should not have Site Administration tool');
  });

  test('author personality should have content and media tools', async () => {
    const result = await testServerWithPersonality('author');
    
    // Should load successfully  
    assert(result.stderr.includes('Loaded 4 tools for author personality'), 
      'Should load exactly 4 tools for author');
    
    // Content Management should include publish and trash
    assert(result.stderr.includes('Content Management: [draft, publish, edit, pull, sync, trash, page]'), 
      'Content Management should include publish, trash, and page actions');
    
    // Should have Media Management
    assert(result.stderr.includes('Media Management: [upload, manage]'), 
      'Should have Media Management with upload and manage actions');
    
    // Publishing Workflow should include publish action
    assert(result.stderr.includes('Publishing Workflow: [find, submit, publish, feedback]'), 
      'Publishing Workflow should include publish action');
    
    // Should NOT have Site Administration
    assert(!result.stderr.includes('Site Administration:'), 
      'Should not have Site Administration tool');
  });

  test('administrator personality should have all tools including site administration', async () => {
    const result = await testServerWithPersonality('administrator');
    
    // Should load successfully
    assert(result.stderr.includes('Loaded 5 tools for administrator personality'), 
      'Should load exactly 5 tools for administrator');
    
    // Should have all Content Management actions
    assert(result.stderr.includes('Content Management: [draft, publish, edit, pull, sync, trash, page]'), 
      'Content Management should have all actions');
    
    // Should have Block Editor
    assert(result.stderr.includes('Block Editor: [list, read, edit, insert, delete, reorder, validate]'), 
      'Block Editor should have all actions');
    
    // Should have Publishing Workflow
    assert(result.stderr.includes('Publishing Workflow: [find, submit, publish, feedback]'), 
      'Publishing Workflow should have all actions');
    
    // Should have Media Management
    assert(result.stderr.includes('Media Management: [upload, manage]'), 
      'Should have Media Management');
    
    // Should have Site Administration (the key differentiator)
    assert(result.stderr.includes('Site Administration: [review, moderate, categories]'), 
      'Should have Site Administration with admin actions');
  });

  test('server should start without hanging for all personalities', async () => {
    const personalities = ['contributor', 'author', 'editor', 'administrator'];
    
    for (const personality of personalities) {
      const result = await testServerWithPersonality(personality, 5000);
      
      // Should not timeout/hang
      assert(!result.killed, `Server should not hang for ${personality} personality`);
      
      // Should show successful initialization
      assert(result.stderr.includes(`Initializing WordPress Author MCP with '${personality}' personality`), 
        `Should initialize ${personality} personality`);
      
      assert(result.stderr.includes('WordPress Author MCP server running'), 
        `Server should start successfully for ${personality}`);
      
      // Should initialize semantic operations
      assert(result.stderr.includes('Initialized 5 semantic operations'), 
        'Should initialize 5 semantic operations');
    }
  });

  test('invalid personality should default to contributor', async () => {
    const result = await testServerWithPersonality('invalid-role');
    
    // Should default to contributor (3 tools)
    assert(result.stderr.includes('Loaded 3 tools'), 
      'Should default to contributor personality with 3 tools');
  });

  test('no personality specified should default to contributor', async () => {
    const server = spawn('node', [serverPath], {
      env: { 
        ...process.env,
        WORDPRESS_URL: 'test',
        WORDPRESS_USERNAME: 'test', 
        WORDPRESS_PASSWORD: 'test'
      },
      stdio: 'pipe'
    });

    let stderr = '';
    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Kill after timeout
    setTimeout(() => server.kill('SIGTERM'), 3000);

    await new Promise(resolve => server.on('close', resolve));

    // Should default to contributor
    assert(stderr.includes("Initializing WordPress Author MCP with 'contributor' personality"), 
      'Should default to contributor personality');
  });

});