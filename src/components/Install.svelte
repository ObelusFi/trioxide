<script lang="ts">
	let pkg = $state('npm');
	const setPkg = (npkg: string) => () => {
		pkg = npkg;
	};
	const pkgs = ['npm', 'pnpm', 'yarn', 'bun'];
	let copying = $state(false);
	const copyContents = async (e: MouseEvent) => {
		const cmd = (e.currentTarget as HTMLElement).innerText;
		copying = true;
		await navigator.clipboard.writeText(cmd);
		setTimeout(() => {
			copying = false;
		}, 500);
	};
</script>

<div class="flex flex-col items-center gap-2">
	<div class=" flex gap-4">
		{#each pkgs as p}
			<button class="pkg" class:selected={pkg == p} onclick={setPkg(p)}>{p}</button>
		{/each}
	</div>

	<button
		class="flex items-center justify-center gap-2 rounded-sm bg-(--trioxide_neutral-3) px-4 py-2 hover:bg-(--trioxide_neutral-4)"
		onclick={copyContents}
	>
		<code>
			{#if pkg == 'npm'}
				<span>npm</span> i @obelusfi/trioxide
			{:else if pkg == 'pnpm'}
				<span>pnpm</span> add @obelusfi/trioxide
			{:else if pkg == 'yarn'}
				<span>yarn</span> add @obelusfi/trioxide
			{:else if pkg == 'bun'}
				<span>bun</span> add @obelusfi/trioxide
			{/if}
		</code>
		<i
			class={copying
				? 'ri-check-line text-(--trioxide_highlight-11)'
				: 'ri-clipboard-fill text-(--trioxide_neutral-11)'}
		></i>
	</button>
</div>

<style lang="postcss">
	@reference "../routes/layout.css";
	.pkg {
		@apply text-(--trioxide_neutral-10);
		&.selected,
		&:hover {
			@apply text-(--trioxide_neutral-12);
		}
	}
	code {
		span {
			@apply text-(--trioxide_highlight-10);
		}
	}
</style>
