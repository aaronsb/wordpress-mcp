# WordPress MCP Tests

This directory contains all test files for the WordPress MCP server.

## Test Structure

### `/tests/unit/`
Unit tests for individual components (currently using existing test files).

### `/tests/integration/`
Integration tests that verify complete workflows:
- `test-abstracted-workflow.js` - Tests filesystem abstraction and document handles
- `test-full-workflow.js` - Tests complete editing workflow with line-based tools
- `test-temp-workflow.js` - Tests temp file creation and syncing
- `test-feature-api.js` - Tests WordPress Feature API integration
- `test-semantic-ops.js` - Tests semantic operation mapping
- `test-tools.js` - Tests MCP tool registration

### Running Tests

```bash
# Run all tests
npm test

# Run specific integration test
node tests/integration/test-full-workflow.js

# Run unit tests
npm run test:unit
```

## Test Requirements

Tests require:
1. Valid WordPress credentials in `.env`
2. WordPress Feature API plugin installed
3. Appropriate user permissions for testing operations