<script lang="ts">
	import Flow from '$lib/Flow.svelte';
	import Viewport from '$lib/Viewport.svelte';

	type Node = (typeof nodes)[0];
	type Port = Node['ports'][0];
	type Edge = { from: string; to: string };

	let nodes = $state([
		{
			ports: [
				{ id: 'a', type: 'input' },
				{ id: 'b', type: 'output' }
			],
			position: { x: 0, y: 0 }
		},
		{
			ports: [
				{ id: 'c', type: 'input' },
				{ id: 'd', type: 'output' }
			],
			position: { x: 0, y: 0 }
		}
	]);

	let edges: Edge[] = $state([]);
	const onEdge = (
		[nodeFrom, { id: from, type: typeFrom }]: [Node, Port],
		[nodeTo, { id: to, type: typeTo }]: [Node, Port]
	): Edge | undefined => {
		// Don't connect to yourself
		if (nodeFrom == nodeTo) return undefined;
		// Don't connect input -> input
		if (typeFrom == typeTo) return undefined;
		// Only one connection per node
		const exists = edges.some(
			(e) => (e.from == from && e.to === to) || (e.from == to && e.to === from)
		);
		if (exists) return undefined;

		// You get the idea whatever connecting logic can be applied
		// maybe provide loop detection/ one connection helpers
		return {
			from,
			to
		};
	};
</script>

<Viewport>
	<Flow bind:nodes bind:edges {onEdge}>
		{#snippet Node(n, { dragBindings, portBindings, hoveredPortEndpoint: toPath })}
			<div class="absolute inline-flex border p-4 select-none" {...dragBindings}>
				<div class="flex flex-col justify-center">
					{#each n.ports.filter((e) => e.type == 'input') as s}
						<div class="h-2 w-2 bg-red-500" {...portBindings(s)}></div>
					{/each}
				</div>
				<div class="p-2">Some content</div>
				<div class=" flex flex-col justify-center">
					{#each n.ports.filter((e) => e.type == 'output') as s}
						<div
							class="h-2 w-2 {toPath?.[1] == s ? 'bg-green-500' : 'bg-amber-500'}"
							{...portBindings(s)}
						></div>
					{/each}
				</div>
			</div>
		{/snippet}
	</Flow>
</Viewport>
