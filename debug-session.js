#!/usr/bin/env node
/**
 * Debug session to explore WordPress Gutenberg block format
 * 
 * This script demonstrates how WordPress stores Gutenberg blocks in the database
 * and shows the format of block comments.
 */

// Example of how WordPress stores Gutenberg blocks in the database
const gutenbergBlockExamples = {
  // 1. Simple paragraph block
  paragraph: `<!-- wp:paragraph -->
<p>This is a simple paragraph in Gutenberg.</p>
<!-- /wp:paragraph -->`,

  // 2. Heading block with attributes
  heading: `<!-- wp:heading {"level":2} -->
<h2>This is a Heading</h2>
<!-- /wp:heading -->`,

  // 3. List block
  list: `<!-- wp:list -->
<ul>
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
<!-- /wp:list -->`,

  // 4. Image block with more attributes
  image: `<!-- wp:image {"id":123,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large">
  <img src="https://example.com/image.jpg" alt="Alt text" class="wp-image-123"/>
  <figcaption>Image caption</figcaption>
</figure>
<!-- /wp:image -->`,

  // 5. Quote block
  quote: `<!-- wp:quote -->
<blockquote class="wp-block-quote">
  <p>This is a quote.</p>
  <cite>Author Name</cite>
</blockquote>
<!-- /wp:quote -->`,

  // 6. Code block
  code: `<!-- wp:code -->
<pre class="wp-block-code"><code>console.log('Hello, World!');</code></pre>
<!-- /wp:code -->`,

  // 7. Separator block
  separator: `<!-- wp:separator -->
<hr class="wp-block-separator"/>
<!-- /wp:separator -->`,

  // 8. Nested blocks (columns example)
  columns: `<!-- wp:columns -->
<div class="wp-block-columns">
  <!-- wp:column {"width":"66.66%"} -->
  <div class="wp-block-column" style="flex-basis:66.66%">
    <!-- wp:paragraph -->
    <p>Left column content (2/3 width)</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->
  
  <!-- wp:column {"width":"33.33%"} -->
  <div class="wp-block-column" style="flex-basis:33.33%">
    <!-- wp:paragraph -->
    <p>Right column content (1/3 width)</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->
</div>
<!-- /wp:columns -->`,

  // 9. Group block (can contain multiple blocks)
  group: `<!-- wp:group {"backgroundColor":"light-gray","align":"wide"} -->
<div class="wp-block-group alignwide has-light-gray-background-color has-background">
  <!-- wp:heading -->
  <h2>Grouped Content</h2>
  <!-- /wp:heading -->
  
  <!-- wp:paragraph -->
  <p>This paragraph is inside a group block.</p>
  <!-- /wp:paragraph -->
</div>
<!-- /wp:group -->`
};

// Complete post example with multiple blocks
const completePostExample = `<!-- wp:heading {"level":1} -->
<h1>Welcome to My Blog Post</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>This is the introduction paragraph. It sets up the content that follows.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>Main Section</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Here's some content in the main section. Let me show you a list:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul>
  <li>First point</li>
  <li>Second point</li>
  <li>Third point</li>
</ul>
<!-- /wp:list -->

<!-- wp:quote -->
<blockquote class="wp-block-quote">
  <p>This is an important quote to emphasize a point.</p>
  <cite>Famous Person</cite>
</blockquote>
<!-- /wp:quote -->

<!-- wp:separator -->
<hr class="wp-block-separator"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2>Code Example</h2>
<!-- /wp:heading -->

<!-- wp:code -->
<pre class="wp-block-code"><code>function greet(name) {
  return \`Hello, \${name}!\`;
}</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>That's all for this example!</p>
<!-- /wp:paragraph -->`;

// Key patterns and structure
console.log('=== WordPress Gutenberg Block Format ===\n');

console.log('1. Basic Block Structure:');
console.log('   <!-- wp:block-name {"attributes":"in-json"} -->');
console.log('   <html>Content goes here</html>');
console.log('   <!-- /wp:block-name -->\n');

console.log('2. Block Comments Format:');
console.log('   - Opening: <!-- wp:block-name {...} -->');
console.log('   - Closing: <!-- /wp:block-name -->');
console.log('   - Attributes are JSON objects in the opening comment\n');

console.log('3. Common Core Blocks:');
console.log('   - wp:paragraph');
console.log('   - wp:heading');
console.log('   - wp:list');
console.log('   - wp:image');
console.log('   - wp:quote');
console.log('   - wp:code');
console.log('   - wp:separator');
console.log('   - wp:columns / wp:column');
console.log('   - wp:group\n');

console.log('4. How blocks are stored in database:');
console.log('   - In wp_posts table, post_content column');
console.log('   - Stored as HTML with block comments');
console.log('   - Block comments contain block type and attributes');
console.log('   - Content between comments is regular HTML\n');

console.log('5. Example - Simple Paragraph:');
console.log(gutenbergBlockExamples.paragraph);
console.log('\n');

console.log('6. Example - Heading with Attributes:');
console.log(gutenbergBlockExamples.heading);
console.log('\n');

console.log('7. Example - Nested Blocks (Columns):');
console.log(gutenbergBlockExamples.columns);
console.log('\n');

console.log('8. Complete Post Example:');
console.log('=' . repeat(50));
console.log(completePostExample);
console.log('=' . repeat(50));
console.log('\n');

console.log('=== Key Insights for Implementation ===\n');
console.log('1. Blocks are delimited by HTML comments');
console.log('2. Block type follows "wp:" namespace (e.g., wp:paragraph)');
console.log('3. Attributes are stored as JSON in the opening comment');
console.log('4. Content between comments is regular HTML');
console.log('5. Blocks can be nested (like columns containing paragraphs)');
console.log('6. When creating content programmatically:');
console.log('   - Can use block format for Gutenberg editor');
console.log('   - Can use plain HTML for classic editor');
console.log('   - WordPress REST API accepts both formats in content.raw');

// Function to create a block programmatically
function createBlock(type, content, attributes = {}) {
  const attrString = Object.keys(attributes).length > 0 
    ? ' ' + JSON.stringify(attributes)
    : '';
  
  return `<!-- wp:${type}${attrString} -->
${content}
<!-- /wp:${type} -->`;
}

console.log('\n=== Helper Function Example ===');
console.log('Creating a heading block programmatically:');
const headingBlock = createBlock('heading', '<h2>My Dynamic Heading</h2>', { level: 2 });
console.log(headingBlock);

console.log('\nCreating a paragraph block:');
const paragraphBlock = createBlock('paragraph', '<p>This is dynamic content.</p>');
console.log(paragraphBlock);

console.log('\n=== Integration with Current Code ===\n');
console.log('In the document-session-manager.js, when converting:');
console.log('1. HTML to Markdown: Strip block comments, keep content');
console.log('2. Markdown to HTML: Can optionally wrap in block comments');
console.log('3. For now, plain HTML works fine (WordPress auto-converts)');
console.log('4. Future enhancement: Add block creation helpers\n');

// Show how this relates to the existing code
console.log('=== Current Implementation Notes ===\n');
console.log('The existing code in document-session-manager.js:');
console.log('- Uses Turndown to convert HTML → Markdown (strips block comments)');
console.log('- Uses Marked to convert Markdown → HTML');
console.log('- WordPress accepts plain HTML and converts to blocks if needed');
console.log('- Block format is preserved when pulling/pushing if already present\n');

console.log('To create block-aware content, you could:');
console.log('1. Extend markdownToHtml() to wrap content in block comments');
console.log('2. Add semantic block actions (already started in feature-mapper.js)');
console.log('3. Create block templates for common patterns');
console.log('4. Let AI understand block structure for advanced editing\n');

console.log('✅ Script complete - see above for WordPress block format details');