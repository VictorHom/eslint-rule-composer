'use strict';

const eslint = require('eslint');
const assert = require('chai').assert;
const ruleComposer = require('../..');

const RuleTester = eslint.RuleTester;
const ruleTester = new RuleTester();
const coreRules = new eslint.Linter().getRules();

ruleTester.run(
  'filterReports',
  ruleComposer.filterReports(coreRules.get('no-undef'), descriptor => descriptor.node && descriptor.node.name !== 'foo'),
  {
    valid: [
      'foo;',
      'var bar; bar;',
    ],
    invalid: [
      {
        code: 'bar;',
        errors: [{ line: 1, column: 1 }],
      },
      {
        code: 'foo; bar;',
        errors: [{ line: 1, column: 6 }],
      },
      {
        code: 'bar; foo;',
        errors: [{ line: 1, column: 1 }],
      },
    ],
  }
);

ruleTester.run(
  'joinReports',
  ruleComposer.joinReports([
    context => ({ Program: node => context.report(node, 'foo') }),
    context => ({ 'Program:exit': node => context.report(node, 'bar') }),
    { create: context => ({ 'Program:exit': node => context.report(node, 'baz') }) },
  ]),
  {
    valid: [],
    invalid: [
      {
        code: 'a',
        errors: [
          { type: 'Program', message: 'foo' },
          { type: 'Program', message: 'bar' },
          { type: 'Program', message: 'baz' },
        ],
      },
    ],
  }
);

ruleTester.run(
  'mapReports',
  ruleComposer.mapReports(
    context => ({ Program: node => context.report({ node, message: 'foo' }) }),
    descriptor => Object.assign({}, descriptor, { message: descriptor.message.toUpperCase() })
  ),
  {
    valid: [],
    invalid: [
      {
        code: 'a',
        errors: [
          { type: 'Program', message: 'FOO' },
        ],
      },
    ],
  }
);

ruleTester.run(
  'checking the first token of the report',
  ruleComposer.filterReports(
    coreRules.get('no-unused-expressions'),
    (problem, metadata) => metadata.sourceCode.getFirstToken(problem.node).value !== 'expect'
  ),
  {
    valid: [
      'expect(foo).to.be.true;',
      'expect;',
    ],
    invalid: [
      {
        code: 'foo;',
        errors: 1,
      },
    ],
  }
);

ruleTester.run(
  'composing rules that use messageId',
  ruleComposer.filterReports(
    {
      meta: {
        messages: {
          foo: 'Foo error.',
          bar: 'Bar error.',
          baz: 'Baz error {{myData}}.',
        },
      },
      create(context) {
        return {
          Program(node) {
            context.report({ node, messageId: 'foo' });
            context.report({ node, messageId: 'bar' });
            context.report({ node, messageId: 'baz', data: { myData: 'BAZ', otherData: 'blah' } });
            context.report({ node, message: 'Not message id {{aa}}', data: { aa: 'foo' } });
          },
        };
      },
    },
    (problem) => {
      if (problem.messageId === 'baz') {
        assert.strictEqual(problem.message, 'Baz error BAZ.');
        assert.deepEqual(problem.data, { myData: 'BAZ' });
      } else if (problem.messageId === 'foo') {
        assert.strictEqual(problem.message, 'Foo error.');
        assert.deepEqual(problem.data, {});
      } else if (problem.messageId === 'bar') {
        assert.strictEqual(problem.message, 'Bar error.');
        assert.deepEqual(problem.data, {});
      } else if (problem.messageId === null) {
        assert.strictEqual(problem.message, 'Not message id foo');
        assert.strictEqual(problem.data, null);
      } else {
        assert.fail('Unexpected reported problem');
      }

      return problem.message === 'Foo error.' || problem.messageId === 'baz';
    }
  ),
  {
    valid: [],
    invalid: [
      {
        code: 'x',
        errors: [
          { type: 'Program', message: 'Foo error.' },
          { type: 'Program', message: 'Baz error BAZ.' },
        ],
      },
    ],
  }
);
