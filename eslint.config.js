// Règles de lint de Basket Legends (tranche 0) : recommandations JavaScript et TypeScript, règles des hooks React.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist', '**/node_modules', 'tools/migrations'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Hasard déterministe uniquement (CLAUDE.md) : Math.random est interdit dans le code du jeu.
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Utiliser creerHasard (@basket-legends/engine).' },
      ],
    },
  },
);
