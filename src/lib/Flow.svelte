<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	type FlowPort = $$Generic<{ id: string }>;
	type FlowNode = $$Generic<{ ports: FlowPort[]; position: { x: number; y: number } }>;
	type FlowEdge = $$Generic<{ from: string; to: string }>;
	type PortEndpoint = [FlowNode, FlowPort];

	let {
		nodes = $bindable(),
		edges = $bindable(),
		Node,
		Edge,
		GhostEdge,
		onEdge
	}: {
		nodes: FlowNode[];
		edges: FlowEdge[];
		onEdge: (from: PortEndpoint, to: PortEndpoint) => FlowEdge | undefined;
		Node: Snippet<[node: FlowNode, bindings: ReturnType<typeof createNodeBindings>]>;
		Edge?: Snippet<[edge: FlowEdge, from: PortAnchor, to: PortAnchor]>;
		GhostEdge?: Snippet<[from: PortAnchor, to: DOMRect]>;
	} = $props();

	let el: HTMLElement;

	const drect = (x = 0, y = 0, w = 0, h = 0) => {
		return { x: x, y: y, width: w, height: h, bottom: 0, left: 0, right: 0, top: 0 } as DOMRect;
	};

	let viewportRect: DOMRect = drect();
	let scale = 1;
	let cursorStartX: number;
	let cursorStartY: number;
	let ghostBounds = $state(drect());

	let fromPath: PortEndpoint | null = $state(null);
	let toPath: PortEndpoint | null = $state(null);
	let selectedNodes: FlowNode[] = $state([]);

	type PortAnchor = {
		el: HTMLElement;
		rect: DOMRect;
		node: FlowNode;
	};

	const portRegistry: Record<string, PortAnchor> = $state({});

	const unscaleRect = (r: DOMRect) => {
		return {
			x: r.x / scale,
			y: r.y / scale,
			width: r.width / scale,
			height: r.height / scale
		} as DOMRect;
	};

	function makeStepArrow(a: DOMRect, b: DOMRect) {
		if (!a || !b)
			return {
				d: '',
				rect: drect()
			};

		const thickness = 10;

		// centers
		const ax = a.x + a.width / 2;
		const ay = a.y + a.height / 2;
		const bx = b.x + b.width / 2;
		const by = b.y + b.height / 2;

		// bounding box in GLOBAL coords
		let x1 = Math.min(ax, bx);
		let x2 = Math.max(ax, bx);
		let y1 = Math.min(ay, by);
		let y2 = Math.max(ay, by);

		// --- Apply minimum thickness ------------------------------------
		if (x2 - x1 < thickness) {
			const mid = (ax + bx) / 2;
			x1 = mid - thickness / 2;
			x2 = mid + thickness / 2;
		}

		if (y2 - y1 < thickness) {
			const mid = (ay + by) / 2;
			y1 = mid - thickness / 2;
			y2 = mid + thickness / 2;
		}

		// --- rect relative to elRect ------------------------------------
		const rect = {
			x: x1 - viewportRect.x,
			y: y1 - viewportRect.y,
			width: x2 - x1,
			height: y2 - y1
		};

		// --- convert A and B to LOCAL coords ----------------------------
		const A = { x: ax - x1, y: ay - y1 };
		const B = { x: bx - x1, y: by - y1 };

		let d;
		const midX = (A.x + B.x) / 2;
		const midY = (A.y + B.y) / 2;
		let mode = 'step';

		if (Math.abs(ax - bx) > Math.abs(ay - by)) {
			if (mode == 'step') {
				d = `M ${A.x} ${A.y}
		     L ${midX} ${A.y}
		     L ${midX} ${B.y}
		     L ${B.x} ${B.y}`;
			} else {
				const cx1 = midX;
				const cy1 = A.y;
				const cx2 = midX;
				const cy2 = B.y;
				d = `M ${A.x} ${A.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${B.x} ${B.y}`;
			}
		} else {
			if (mode == 'step') {
				d = `M ${A.x} ${A.y}
		     L ${A.x} ${midY}
		     L ${B.x} ${midY}
		     L ${B.x} ${B.y}`;
			} else {
				const cx1 = A.x;
				const cy1 = midY;
				const cx2 = B.x;
				const cy2 = midY;

				d = `M ${A.x} ${A.y}
		     C ${cx1} ${cy1}, ${cx2} ${cy2}, ${B.x} ${B.y}`;
			}
		}

		return { rect, d };
	}

	let animationFrame: ReturnType<typeof requestAnimationFrame>;
	const update = () => {
		const rect = el.getBoundingClientRect();
		scale = rect.width / el.offsetWidth || 1;
		viewportRect = unscaleRect(el.getBoundingClientRect());
		for (const [id, { el }] of Object.entries(portRegistry)) {
			portRegistry[id].rect = unscaleRect(el.getBoundingClientRect());
		}
		animationFrame = requestAnimationFrame(update);
	};

	const cancelGhost = () => {
		fromPath = null;
		toPath = null;
	};

	const mouseMove = (e: MouseEvent | TouchEvent) => {
		let pageY;
		let pageX;
		if (e instanceof MouseEvent) {
			pageX = e.pageX;
			pageY = e.pageY;
		} else {
			e.preventDefault();
			pageX = e.touches[0].pageX;
			pageY = e.touches[0].pageY;
		}
		let dx = (pageX - cursorStartY) / scale;
		let dy = (pageY - cursorStartX) / scale;
		if (fromPath) {
			moveGhost(dx, dy);
		} else if (selectedNodes.length) {
			moveNodes(dx, dy);
		}

		cursorStartY = pageX;
		cursorStartX = pageY;
	};

	const cancelNodeMove = () => {
		selectedNodes = [];
	};

	const moveNodes = (dx: number, dy: number) => {
		if (!selectedNodes.length) return;
		selectedNodes.forEach((n) => {
			n.position.x += dx;
			n.position.y += dy;
		});
	};

	const mouseUp = (e: MouseEvent | TouchEvent) => {
		cancelNodeMove();
		cancelGhost();
	};

	const moveGhost = (dx: number, dy: number) => {
		ghostBounds.x += dx;
		ghostBounds.y += dy;
	};

	onMount(() => {
		viewportRect = el.getBoundingClientRect();
		animationFrame = requestAnimationFrame(update);
		window.addEventListener('mouseup', mouseUp);
		window.addEventListener('mousemove', mouseMove);
		return () => {
			window.removeEventListener('mouseup', cancelGhost);
			cancelAnimationFrame(animationFrame);
		};
	});

	const useHandle = (node: FlowNode) => (handle: FlowPort) => ({
		onmousedown: (e: MouseEvent | TouchEvent) => {
			e.stopImmediatePropagation();
			fromPath = [node, handle];
			ghostBounds = unscaleRect(portRegistry[handle.id].el.getBoundingClientRect());
		},
		onmouseup: (e: MouseEvent | TouchEvent) => {
			if (!fromPath) return;
			const edge = onEdge(fromPath, [node, handle]);
			if (edge) {
				edges.push(edge);
			}
		},
		onmouseover: () => {
			toPath = [node, handle];
		},
		onmouseout: () => {
			toPath = null;
		},
		[createAttachmentKey()]: (el: HTMLElement) => {
			portRegistry[handle.id] = {
				el,
				rect: el.getBoundingClientRect(),
				node
			};
			return () => {
				delete portRegistry[handle.id];
			};
		}
	});

	const createNodeBindings = (n: FlowNode) => {
		function dragStart(e: MouseEvent | TouchEvent) {
			e.stopImmediatePropagation();
			selectedNodes = [n];
		}

		return {
			get isDragging() {
				return selectedNodes.includes(n);
			},
			get activePortEndpoint() {
				return fromPath;
			},
			get hoveredPortEndpoint() {
				return toPath;
			},
			portBindings: useHandle(n),
			dragBindings: {
				onmousedown: dragStart,
				get style() {
					return `transform: translate(${n.position.x}px, ${n.position.y}px);`;
				}
			}
		};
	};
</script>

{#snippet DefaultEdge(_: FlowEdge, a: PortAnchor, b: PortAnchor)}
	{@const { rect, d } = makeStepArrow(a.rect, b.rect)}
	<svg
		class="pointer-events-none absolute overflow-visible"
		style="
			width: {rect.width}px;
			height: {rect.height}px;
			transform:translate({rect.x}px, {rect.y}px);
		"
	>
		<path {d} stroke="red" fill="none" stroke-width="2" />
	</svg>
{/snippet}

{#snippet DefaultGhostEdge(sourceBounds: PortAnchor, cursorBounds: DOMRect)}
	<!-- 
		The default implementation doesn't need any of this but a custom one might
	-->
	{@render DefaultEdge(null!, sourceBounds, { rect: cursorBounds, el: null!, node: null! })}
{/snippet}

<div class="relative h-90" bind:this={el}>
	{#each nodes as node}
		{@render Node(node, createNodeBindings(node))}
	{/each}

	{#each edges as e}
		{@const a = portRegistry[e.from]}
		{@const b = portRegistry[e.to]}
		{#if a && b}
			{@render (Edge || DefaultEdge)(e, a, b)}
		{/if}
	{/each}

	{#if fromPath && portRegistry[fromPath[1].id]}
		{@render (GhostEdge || DefaultGhostEdge)(portRegistry[fromPath[1].id], ghostBounds)}
	{/if}
</div>
