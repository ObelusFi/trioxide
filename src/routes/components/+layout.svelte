<script lang="ts">
	import '$lib/index.css';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import Logo from '../../components/Logo.svelte';
	import { resolve } from '$app/paths';

	let { children, data } = $props();
	let content: HTMLElement = $state(null!);
	let observer: IntersectionObserver;
	let links: {
		[k: string]: {
			title: string;
			link: string;
			active: boolean;
			rank: number;
		};
	} = $state({});

	let open = $state(false);

	const capitalize = (e: string) => {
		return e
			.split('-')
			.map((e) => `${e[0].toUpperCase()}${e.slice(1)}`)
			.join(' ');
	};

	const startTracking = () => {
		links = {};
		const observe = [...content.querySelectorAll('.heading')];
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const id = entry.target.getAttribute('aria-labelledby')!;
					links[id].active = entry.isIntersecting;
				});
			},
			{
				rootMargin: '-50% 0% -50% 0%'
			}
		);
		observe.forEach((e) => {
			const id = e.getAttribute('aria-labelledby')!;
			const rank = +e.getAttribute('data-heading-rank')! - 1;
			let el = e.querySelector(`#${id}`)!;
			links[id] = {
				title: el.textContent,
				link: el.id,
				active: false,
				rank
			};
			observer.observe(e);
		});
	};

	let [prev, next] = $derived.by(() => {
		const idx = data.routes.map((e) => `/components/${e}`).indexOf(page.route.id!);
		let res: [string | undefined, string | undefined] = [undefined, undefined];
		if (idx > 0) {
			res[0] = data.routes[idx - 1];
		}
		if (idx < data.routes.length + 1) {
			res[1] = data.routes[idx + 1];
		}
		return res;
	});

	$effect(() => {
		page.route.id;
		untrack(() => {
			setTimeout(startTracking, 0);
			return () => {
				observer.disconnect();
			};
		});
	});
</script>

{#snippet Links()}
	{#each data.routes as r}
		{@const current = resolve(page.route.id as any)}
		{@const href = resolve(`/components/${r}` as any)}
		{@const name = capitalize(r)}
		<a
			{href}
			class="capitalize hover:text-(--trioxide_highlight-11) {current == href
				? 'text-(--trioxide_highlight-11)'
				: 'text-(--trioxide_neutral-11)'}">{name}</a
		>
	{/each}
{/snippet}

<div class="flex flex-col">
	<nav
		class="sticky top-0 z-50 mb-2 flex items-center justify-between bg-(--trioxide_neutral-1) px-4 py-6 lg:px-12"
	>
		<button class=" text-3xl lg:hidden" aria-label="menu" onclick={() => (open = true)}>
			<i class="ri-menu-line"></i>
		</button>
		<a href={resolve('/')}><Logo></Logo></a>
	</nav>
	<div class="grid grid-cols-1 px-4 pb-12 lg:grid-cols-[200px_1fr_200px] lg:px-12 lg:pt-12">
		<aside class="sticky top-20 hidden flex-col self-start lg:flex">
			<span class="font-semibold">Compnents</span>
			<nav class=" mt-2 flex flex-col gap-1">
				{@render Links()}
			</nav>
		</aside>
		<div class="flex w-full min-w-0 flex-col">
			<article class=" m-auto prose w-full max-w-[760px] prose-trioxide" bind:this={content}>
				{@render children()}
			</article>
			<nav class=" m-auto flex w-full max-w-[760px] gap-4">
				{#if prev}
					<a
						href={resolve(`/components/${prev}` as any)}
						class="me-auto flex w-1/2 flex-col items-start gap-1 rounded-md border border-(--trioxide_neutral-6) p-4 hover:border-(--trioxide_highlight-11)"
					>
						<span class=" text-xs text-(--trioxide_neutral-9)">Previous page</span>
						<span class=" text-(--trioxide_highlight-11)">{capitalize(prev)}</span>
					</a>
				{/if}
				{#if next}
					<a
						href={resolve(`/components/${next}` as any)}
						class="ms-auto flex w-1/2 flex-col items-end gap-1 rounded-md border border-(--trioxide_neutral-6) p-4 hover:border-(--trioxide_highlight-11)"
					>
						<span class=" text-xs text-(--trioxide_neutral-9)">Next page</span>
						<span class=" text-(--trioxide_highlight-11)">{capitalize(next)}</span>
					</a>
				{/if}
			</nav>
		</div>
		<aside class="sticky top-20 hidden flex-col self-start text-sm lg:flex">
			<span class="mb-4 flex gap-1 text-(--trioxide_neutral-11)">
				<i class="ri-menu-2-line"></i>
				On this page
			</span>
			{#each Object.values(links) as { active, link, title, rank }}
				<a
					href="#{link}"
					class="ml-[calc(var(--rank)*var(--spacing)*2)] px-2 py-1 text-(--trioxide_neutral-11) hover:text-(--trioxide_neutral-12) {active
						? 'text-(--trioxide_neutral-12)'
						: ''}"
					class:text-(--trioxide_neutral-12)={active}
					style:--rank={rank}>{title}</a
				>
			{/each}
		</aside>
	</div>
</div>

<nav class="nav" class:open>
	<div
		class="flex h-full w-[calc(100%-20*var(--spacing))] flex-col gap-2 bg-(--trioxide_neutral-2) p-4"
	>
		<div class="mb-4 flex justify-between">
			<Logo></Logo>
			<button aria-label="close" onclick={() => (open = false)}>
				<i class="ri-close-large-line"></i>
			</button>
		</div>
		<div>Components</div>
		{@render Links()}
	</div>
</nav>

<style lang="postcss">
	@reference "../layout.css";
	.nav {
		@apply invisible fixed top-0 right-0 bottom-0 left-0 z-50 bg-black/0 transition-all duration-200 lg:hidden;
		div {
			@apply -translate-x-full transition-all duration-200;
		}
		&.open {
			@apply visible bg-black/60;
			div {
				@apply translate-x-0 transition-all duration-200;
			}
		}
	}
	:global(:target) {
		scroll-margin-top: 100px;
	}
</style>
