<script lang="ts">
	import '$lib/index.css';
	import { ContextMenu } from '$lib/index.js';
	import './layout.css';
	let { children } = $props();
</script>

<svelte:head>
	<script>
		(() => {
			let theme = window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'trioxide_dark'
				: 'trioxide_light';
			document.documentElement.classList.add(theme);
		})();
	</script>
</svelte:head>

<ContextMenu />
{@render children()}
