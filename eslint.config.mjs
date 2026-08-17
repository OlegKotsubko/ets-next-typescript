import nextConfig from 'eslint-config-next/core-web-vitals'

const houseRules = {
  'prefer-arrow-callback': [2, { allowNamedFunctions: true }],
  'no-multiple-empty-lines': ['error', { max: 1 }],
  'no-multi-spaces': 'error',
  'no-prototype-builtins': ['off'],
  camelcase: ['off'],
  'react/destructuring-assignment': ['off'],
  'react/no-array-index-key': ['off'],
  'no-underscore-dangle': ['off'],
  'react/button-has-type': ['off'],
  'import/no-unresolved': ['off'],
  'prefer-destructuring': ['off'],
  'import/extensions': ['off'],
  'import/no-extraneous-dependencies': ['off'],
  'react/jsx-uses-react': 'off',
  'react/jsx-props-no-spreading': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/no-danger': ['off'],
  'jsx-a11y/no-static-element-interactions': ['off'],
  'linebreak-style': ['off'],
  'react/jsx-filename-extension': ['off'],
  'import/prefer-default-export': ['off'],
  'no-unused-vars': ['warn'],
  'jsx-a11y/click-events-have-key-events': ['off'],
  'jsx-a11y/anchor-is-valid': ['off'],
  'jsx-a11y/label-has-associated-control': ['off'],
  'jsx-a11y/label-has-for': ['off'],
  'jsx-a11y/no-distracting-elements': ['off'],
  'max-len': ['error', { code: 140 }],
  'no-magic-numbers': ['off'],
  'react/jsx-one-expression-per-line': ['error'],
  'no-param-reassign': ['off'],
  semi: ['error', 'never'],
  'no-console': ['warn'],
  indent: ['error', 2, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral'] }],
  'template-curly-spacing': ['off'],
  'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'always' }],
  'no-implicit-globals': ['error'],
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
}

const config = [
  {
    ignores: ['.next/**', 'coverage/**', 'node_modules/**', '.superpowers/**', 'db/migrations/**', 'lib/overlays/*.generated.ts'],
  },
  ...nextConfig,
  {
    rules: houseRules,
  },
]

export default config
