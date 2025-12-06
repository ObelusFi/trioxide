<script lang="ts">
	/**
	 * TODO:
	 *  - figure out a better api for custom arrows
	 *  - edge selection
	 *  - touch events
	 *
	 *
	 */
	import { onMount, type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import { SvelteSet } from 'svelte/reactivity';

	type FlowPort = $$Generic<{ id: string }>;
	type FlowNode = $$Generic<{ ports: FlowPort[]; position: { x: number; y: number } }>;
	type FlowEdge = $$Generic<{ from: string; to: string }>;
	type PortEndpoint = [FlowNode, FlowPort];
	type PortAnchor = {
		el: HTMLElement;
		rect: DOMRect;
		node: FlowNode;
		port: FlowPort;
	};

	type EdgeType = 'step' | 'smooth' | 'line';

	let {
		nodes = $bindable(),
		edges = $bindable(),
		Node,
		Edge,
		GhostEdge,
		onEdge,
		'edge-type': mode = 'smooth'
	}: {
		nodes: FlowNode[];
		edges: FlowEdge[];
		'edge-type'?: EdgeType;
		onEdge: (from: PortEndpoint, to: PortEndpoint) => FlowEdge | undefined;
		Node: Snippet<[node: FlowNode, bindings: ReturnType<typeof createNodeBindings>]>;
		Edge?: Snippet<[edge: FlowEdge, from: PortAnchor, to: PortAnchor]>;
		GhostEdge?: Snippet<[from: PortAnchor, to: DOMRect]>;
	} = $props();

	const drect = (x = 0, y = 0, w = 0, h = 0) =>
		({ x, y, width: w, height: h, bottom: 0, left: 0, right: 0, top: 0 } as DOMRect);

	let viewportRect: DOMRect = drect();
	let scale = 1;
	let cursorStartX: number = 0;
	let cursorStartY: number = 0;
	let ghostBounds = $state(drect());
	let el: HTMLElement;
	let draggingNodes = false;
	let clearSelection = true;

	let fromPath: PortEndpoint | null = $state(null);
	let toPath: PortEndpoint | null = $state(null);
	let selectedNodes: Set<FlowNode> = new SvelteSet();
	let selecting = $state(false);
	let animationFrame: ReturnType<typeof requestAnimationFrame>;

	const portRegistry: Record<string, PortAnchor> = $state({});
	const nodeRegistry: Map<FlowNode, HTMLElement> = new Map();

	const selectionStartPoint = $state({ x: 0, y: 0 });
	const selectionEndPoint = $state({ x: 0, y: 0 });
	const selection = $derived.by(() => {
		const x1 = Math.min(selectionStartPoint.x, selectionEndPoint.x);
		const y1 = Math.min(selectionStartPoint.y, selectionEndPoint.y);
		const x2 = Math.max(selectionStartPoint.x, selectionEndPoint.x);
		const y2 = Math.max(selectionStartPoint.y, selectionEndPoint.y);
		return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
	});

	const unscaleRect = (r: DOMRect) =>
		({
			x: r.x / scale,
			y: r.y / scale,
			width: r.width / scale,
			height: r.height / scale
		} as DOMRect);

	const toViewportCoords = (clientX: number, clientY: number) => ({
		x: clientX / scale - viewportRect.x,
		y: clientY / scale - viewportRect.y
	});

	const getClientPoint = (
		event: MouseEvent | TouchEvent,
		{ preferChangedTouches = false } = {}
	) => {
		if (event instanceof TouchEvent) {
			const touch = preferChangedTouches
				? event.changedTouches[0] || event.touches[0]
				: event.touches[0] || event.changedTouches[0];

			if (touch) {
				return { x: touch.clientX, y: touch.clientY };
			}
		}
		return {
			x: (event as MouseEvent).clientX ?? cursorStartX,
			y: (event as MouseEvent).clientY ?? cursorStartY
		};
	};

	const setCursorFromEvent = (event: MouseEvent | TouchEvent, preferChangedTouches = false) => {
		const { x, y } = getClientPoint(event, { preferChangedTouches });
		cursorStartX = x;
		cursorStartY = y;
	};

	const makeStepArrow = (a: DOMRect, b: DOMRect) => {
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

		let x1 = Math.min(ax, bx);
		let x2 = Math.max(ax, bx);
		let y1 = Math.min(ay, by);
		let y2 = Math.max(ay, by);

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

		const rect = {
			x: x1 - viewportRect.x,
			y: y1 - viewportRect.y,
			width: x2 - x1,
			height: y2 - y1
		};

		const A = { x: ax - x1, y: ay - y1 };
		const B = { x: bx - x1, y: by - y1 };
		const midX = (A.x + B.x) / 2;
		const midY = (A.y + B.y) / 2;
		const horizontal = Math.abs(ax - bx) > Math.abs(ay - by);

		if (mode === 'step') {
			return {
				rect,
				d: horizontal
					? `M ${A.x} ${A.y} L ${midX} ${A.y} L ${midX} ${B.y} L ${B.x} ${B.y}`
					: `M ${A.x} ${A.y} L ${A.x} ${midY} L ${B.x} ${midY} L ${B.x} ${B.y}`
			};
		}

		const d = horizontal
			? `M ${A.x} ${A.y} C ${midX} ${A.y}, ${midX} ${B.y}, ${B.x} ${B.y}`
			: `M ${A.x} ${A.y} C ${A.x} ${midY}, ${B.x} ${midY}, ${B.x} ${B.y}`;

		return { rect, d };
	};

	const updateRects = () => {
		const rect = el.getBoundingClientRect();
		scale = rect.width / el.offsetWidth || 1;
		viewportRect = unscaleRect(rect);
		for (const [id, { el }] of Object.entries(portRegistry)) {
			portRegistry[id].rect = unscaleRect(el.getBoundingClientRect());
		}
		animationFrame = requestAnimationFrame(updateRects);
	};

	const applySelection = () => {
		const bounds = selection;
		nodeRegistry.forEach((dom, node) => {
			const rect = unscaleRect(dom.getBoundingClientRect());
			rect.x -= viewportRect.x;
			rect.y -= viewportRect.y;
			const intersects = !(
				rect.x + rect.width <= bounds.x ||
				rect.x >= bounds.x + bounds.width ||
				rect.y + rect.height <= bounds.y ||
				rect.y >= bounds.y + bounds.height
			);
			if (intersects) {
				selectedNodes.add(node);
			}
		});
	};

	const resetInteractionState = () => {
		selecting = false;
		fromPath = null;
		toPath = null;
		draggingNodes = false;
	};

	const mouseDown = (e: MouseEvent | TouchEvent) => {
		setCursorFromEvent(e);

		if (e.shiftKey) {
			const { x, y } = toViewportCoords(cursorStartX, cursorStartY);
			selectionStartPoint.x = x;
			selectionStartPoint.y = y;
			selectionEndPoint.x = x;
			selectionEndPoint.y = y;
			selecting = true;
		} else {
			selectedNodes.clear();
		}
	};

	const mouseMove = (e: MouseEvent | TouchEvent) => {
		const { x: clientX, y: clientY } = getClientPoint(e);
		const dx = (clientX - cursorStartX) / scale;
		const dy = (clientY - cursorStartY) / scale;
		let prevent = false;
		if (fromPath) {
			ghostBounds.x += dx;
			ghostBounds.y += dy;
			prevent = true;
		} else if (draggingNodes) {
			prevent = true;
			selectedNodes.forEach((n) => {
				n.position.x += dx;
				n.position.y += dy;
			});
		} else if (selecting) {
			prevent = true;
			selectionEndPoint.x += dx;
			selectionEndPoint.y += dy;
		}

		if (prevent) {
			e.preventDefault();
			e.stopImmediatePropagation();
		}

		cursorStartX = clientX;
		cursorStartY = clientY;
	};

	const mouseUp = () => {
		if (selecting) {
			applySelection();
			clearSelection = false;
		} else {
			clearSelection = true;
		}
		resetInteractionState();
	};

	const createNodeBindings = (node: FlowNode) => {
		const startNodeDrag = (e: MouseEvent | TouchEvent) => {
			e.stopImmediatePropagation();
			setCursorFromEvent(e);
			if (clearSelection && !e.shiftKey) {
				selectedNodes.clear();
			}
			selectedNodes.add(node);
			draggingNodes = true;
		};

		return {
			get isDragging() {
				return selectedNodes.has(node);
			},
			get activePortEndpoint() {
				return fromPath;
			},
			get hoveredPortEndpoint() {
				return toPath;
			},
			portBindings: createPortBindings(node),
			dragBindings: {
				onmousedown: startNodeDrag,
				ontouchstart: startNodeDrag,
				get style() {
					return `transform: translate(${node.position.x}px, ${node.position.y}px);`;
				}
			},
			nodeBindings: {
				[createAttachmentKey()]: (dom: HTMLElement) => {
					nodeRegistry.set(node, dom);
					return () => {
						nodeRegistry.delete(node);
					};
				}
			}
		};
	};

	const createPortBindings = (node: FlowNode) => (handle: FlowPort) => {
		const portStart = (e: MouseEvent | TouchEvent) => {
			setCursorFromEvent(e);
			e.stopImmediatePropagation();
			const anchor = portRegistry[handle.id];
			if (!anchor) return;
			fromPath = [node, handle];
			ghostBounds = unscaleRect(anchor.el.getBoundingClientRect());
		};
		const portEnd = (e: MouseEvent | TouchEvent) => {
			if (!fromPath) return;
			let target: PortEndpoint | undefined;
			if (e instanceof TouchEvent) {
				const { x, y } = getClientPoint(e, { preferChangedTouches: true });
				const el = document.elementFromPoint(x, y);
				let endpoint: PortAnchor | undefined;
				for (const p in portRegistry) {
					if (portRegistry[p].el === el) {
						endpoint = portRegistry[p];
						break;
					}
				}
				if (!endpoint) return;
				target = [endpoint.node, endpoint.port];
			} else {
				target = [node, handle];
			}

			const edge = target && onEdge(fromPath, target);
			if (edge) {
				edges.push(edge);
			}
		};

		const portOver = () => {
			toPath = [node, handle];
		};
		const portOut = () => {
			toPath = null;
		};
		return {
			onmousedown: portStart,
			ontouchstart: portStart,
			onmouseup: portEnd,
			ontouchend: portEnd,
			onmouseover: portOver,
			onmouseout: portOut,
			[createAttachmentKey()]: (el: HTMLElement) => {
				portRegistry[handle.id] = {
					el,
					rect: el.getBoundingClientRect(),
					node,
					port: handle
				};
				return () => {
					delete portRegistry[handle.id];
				};
			}
		};
	};

	onMount(() => {
		viewportRect = el.getBoundingClientRect();
		animationFrame = requestAnimationFrame(updateRects);

		window.addEventListener('mousedown', mouseDown);
		window.addEventListener('touchstart', mouseDown);

		window.addEventListener('mouseup', mouseUp);
		window.addEventListener('touchend', mouseUp);

		window.addEventListener('mousemove', mouseMove, { capture: true });
		window.addEventListener('touchmove', mouseMove, { passive: false });
		return () => {
			window.removeEventListener('mousedown', mouseDown);
			window.removeEventListener('touchstart', mouseDown);

			window.removeEventListener('mouseup', mouseUp);
			window.removeEventListener('touchend', mouseUp);

			window.removeEventListener('mousemove', mouseMove);
			window.removeEventListener('touchmove', mouseMove);

			cancelAnimationFrame(animationFrame);
		};
	});
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
	{@render DefaultEdge(null!, sourceBounds, {
		rect: cursorBounds,
		el: null!,
		node: null!,
		port: null!
	})}
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

	{#if selecting}
		<div
			class="absolute bg-blue-500/35"
			style:transform="translate({selection.x}px, {selection.y}px)"
			style:width="{selection.width}px"
			style:height="{selection.height}px"
		></div>
	{/if}
</div>
