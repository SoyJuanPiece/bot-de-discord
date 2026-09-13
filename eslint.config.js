module.exports = {
    env: {
        node: true,
        es2022: true,
        discord: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:prettier/recommended',
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    rules: {
        'no-unused-vars': 'warn',
        'no-console': 'off',
        'prefer-const': 'error',
        'no-var': 'error',
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'comma-dangle': ['error', 'always-multiline'],
        'indent': ['error', 4],
        'max-len': ['warn', { code: 120 }],
    },
    ignorePatterns: ['node_modules/', 'database/', 'logs/'],
};
