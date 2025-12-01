import { mdsvex, escapeSvelte } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import rehypeSlug from 'rehype-slug';
import rehypeSection from '@hbsnow/rehype-sectionize';

import { createHighlighter } from 'shiki';

const highlighter = await createHighlighter({
	themes: ['vitesse-light', 'vitesse-dark'],
	langs: ['javascript', 'typescript', 'svelte', 'css', 'html', 'json', 'shell']
});

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
	extensions: ['.svx', '.md'],
	highlight: {
		highlighter: async (code, lang = 'text') => {
			const html = escapeSvelte(
				highlighter.codeToHtml(code, {
					lang,
					themes: {
						light: 'vitesse-light',
						dark: 'vitesse-dark'
					}
				})
			);
			return `{@html \`${html}\` }`;
		}
	},
	rehypePlugins: [rehypeSlug, rehypeSection]
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [mdsvex(mdsvexOptions), vitePreprocess()],
	kit: {
		adapter: adapter({
			pages: 'docs'
		}),
		paths: {
			base: '/trioxide'
		}
	},
	extensions: ['.svelte', '.svx']
};

export default config;
