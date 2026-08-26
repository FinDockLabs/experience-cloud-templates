// Registers the toBeAccessible() matcher from @sa11y/jest, used by the
// *.a11y.test.js suites. Loaded via setupFilesAfterEnv in jest.config.js.
const { setup } = require('@sa11y/jest');

setup();
