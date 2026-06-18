const fs = require('fs');

const results = require('../test-results/results.json');

let md = `# Playwright Automation Test Report

Generated Automatically

---

`;

results.suites.forEach((suite) => {

  suite.specs.forEach((spec) => {

    spec.tests.forEach((test) => {

      md += `## ${spec.title}

- Status: ${test.status}
- Duration: ${test.results[0]?.duration || 0} ms

`;

    });

  });

});

fs.writeFileSync(
  '../docs/frontend/test/executed_report.md',
  md
);

console.log('Markdown report generated successfully');