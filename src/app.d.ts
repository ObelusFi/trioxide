// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}


declare module '*.svx' {
	export { SvelteComponent as default } from 'svelte';
}

declare module '*.md' {
	export { SvelteComponent as default } from 'svelte';
}

export { };
