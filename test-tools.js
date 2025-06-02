#!/usr/bin/env node
import { spawn } from 'child_process';

// Simple test to check if MCP server exposes tools
const server = spawn('node', ['src/server.js', '--personality=author'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '1.0.0',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Send tools/list request after a delay
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
  
  // Give it time to respond then exit
  setTimeout(() => {
    console.log('STDOUT:', output);
    console.log('STDERR:', errorOutput);
    server.kill();
    process.exit(0);
  }, 1000);
}, 1000);