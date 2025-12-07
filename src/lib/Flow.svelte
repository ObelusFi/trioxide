<script lang="ts" module>
	export type FlowApi<
		FlowNode extends { ports: FlowPort[]; position: { x: number; y: number } },
		FlowEdge extends { from: string; to: string },
		FlowPort extends { id: string }
	> = {
		readonly selectedNodes: Set<FlowNode>;
		readonly selectedEdges: Set<FlowEdge>;
		readonly activePort?: [FlowNode, FlowPort];
		readonly selecting: boolean;
		insertNodeAt(n: FlowNode, clientX: number, clientY: number): FlowNode;
		removeNode(n: FlowNode): boolean;
		removeEdge(e: FlowEdge): boolean;
	};
</script>

<script lang="ts">
	import { onMount, tick, untrack, type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import type { SvelteHTMLElements } from 'svelte/elements';
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

	type EdgeBindingContext = {
		get isSelected(): boolean;
		edgeHandlers: {
			onmousedown: (event: MouseEvent) => void;
			ontouchstart: (event: TouchEvent) => void;
		};
	};

	type EdgeType = 'step' | 'smooth';

	let {
		nodes = $bindable(),
		edges = $bindable(),
		api = $bindable(),
		readonly = false,
		Node,
		Edge,
		GhostEdge,
		'validate-edge': validateEdge,
		'box-selection-props': boxSelectionProps,
		'default-edge-path-props': defaultEdgePathProps,
		'edge-type': mode = 'smooth',
		...rest
	}: {
		nodes: FlowNode[];
		edges: FlowEdge[];
		'validate-edge': (from: PortEndpoint, to: PortEndpoint) => FlowEdge | undefined;
		Node: Snippet<[bindings: ReturnType<typeof createNodeBindings>]>;
		'edge-type'?: EdgeType;
		'default-edge-path-props'?: (e: FlowEdge, isSelected: boolean) => SvelteHTMLElements['path'];
		readonly?: boolean;
		Edge?: Snippet<
			[edge: FlowEdge, from: PortAnchor, to: PortAnchor, bindings: EdgeBindingContext]
		>;
		GhostEdge?: Snippet<[from: PortAnchor, to: DOMRect]>;
		'box-selection-props'?: SvelteHTMLElements['div'];
		api?: FlowApi<FlowNode, FlowEdge, FlowPort>;
	} & SvelteHTMLElements['div'] = $props();

	const drect = (x = 0, y = 0, w = 0, h = 0) =>
		({ x, y, width: w, height: h, bottom: 0, left: 0, right: 0, top: 0 }) as DOMRect;

	let viewportRect: DOMRect = drect();
	let scale = 1;
	let cursorStartX: number = 0;
	let cursorStartY: number = 0;
	let ghostBounds = $state(drect());
	let el: HTMLElement;
	let draggingNodes = false;
	let clearSelection = true;

	let fromPath: PortEndpoint | undefined = $state(undefined);
	let selectedNodes: Set<FlowNode> = new SvelteSet();
	let selectedEdges: Set<FlowEdge> = new SvelteSet();
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

	const unscaleRect = (r: DOMRect) => {
		r.x /= scale;
		r.y /= scale;
		r.width /= scale;
		r.height /= scale;
		return r;
	};

	const toViewportCoords = (clientX: number, clientY: number) => ({
		x: clientX / scale - viewportRect.x,
		y: clientY / scale - viewportRect.y
	});

	const getClientPoint = (
		event: MouseEvent | TouchEvent,
		{ preferChangedTouches = false } = {}
	) => {
		if (event instanceof MouseEvent) {
			return {
				x: (event as MouseEvent).clientX ?? cursorStartX,
				y: (event as MouseEvent).clientY ?? cursorStartY
			};
		}
		const touch = preferChangedTouches
			? event.changedTouches[0] || event.touches[0]
			: event.touches[0] || event.changedTouches[0];

		return { x: touch.clientX, y: touch.clientY };
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
		for (const id in portRegistry) {
			portRegistry[id].rect = unscaleRect(portRegistry[id].el.getBoundingClientRect());
		}
		animationFrame = requestAnimationFrame(updateRects);
	};

	const applySelection = () => {
		selectedEdges.clear();
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

	const clearSelections = () => {
		selectedNodes.clear();
		selectedEdges.clear();
		clearSelection = true;
	};

	const resetInteractionState = () => {
		selecting = false;
		fromPath = undefined;
		draggingNodes = false;
	};

	const mouseDown = (e: MouseEvent | TouchEvent) => {
		if (readonly) return;
		setCursorFromEvent(e);

		if (e.shiftKey) {
			const { x, y } = toViewportCoords(cursorStartX, cursorStartY);
			selectionStartPoint.x = x;
			selectionStartPoint.y = y;
			selectionEndPoint.x = x;
			selectionEndPoint.y = y;
			selecting = true;
		} else {
			clearSelections();
		}
	};

	const mouseMove = (e: MouseEvent | TouchEvent) => {
		if (readonly) return;
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
		if (readonly) return;
		if (selecting) {
			applySelection();
			clearSelection = false;
		} else {
			clearSelection = true;
		}
		resetInteractionState();
	};

	const selectEdge = (edge: FlowEdge, event: MouseEvent | TouchEvent) => {
		if (readonly) return;
		event.stopImmediatePropagation();
		if (!event.shiftKey) {
			clearSelections();
		}
		selectedEdges.add(edge);
	};

	const createEdgeBindings = (edge: FlowEdge): EdgeBindingContext => ({
		get isSelected() {
			return selectedEdges.has(edge);
		},
		edgeHandlers: {
			onmousedown: (event: MouseEvent) => selectEdge(edge, event),
			ontouchstart: (event: TouchEvent) => selectEdge(edge, event),
			[createAttachmentKey()]: () => {
				return () => selectedEdges.delete(edge);
			}
		}
	});

	const createNodeBindings = (node: FlowNode) => {
		const startNodeDrag = (e: MouseEvent | TouchEvent) => {
			if (readonly) return;
			e.stopImmediatePropagation();
			setCursorFromEvent(e);
			if (!e.shiftKey) {
				selectedEdges.clear();
			}
			if (clearSelection && !e.shiftKey) {
				selectedNodes.clear();
			}
			selectedNodes.add(node);
			draggingNodes = true;
		};

		return {
			node,
			portBindings: createPortBindings(node),
			dragBindings: {
				onmousedown: startNodeDrag,
				ontouchstart: startNodeDrag
			},
			nodeBindings: {
				[createAttachmentKey()]: (dom: HTMLElement) => {
					nodeRegistry.set(node, dom);
					dom.style.setProperty('position', 'absolute');
					dom.style.setProperty('left', '0');
					dom.style.setProperty('top', '0');
					$effect(() => {
						dom.style.setProperty(
							'transform',
							`translate(${node.position.x}px, ${node.position.y}px)`
						);
					});
					return () => {
						nodeRegistry.delete(node);
						selectedNodes.delete(node);
					};
				}
			}
		};
	};

	const createPortBindings = (node: FlowNode) => (handle: FlowPort) => {
		const portStart = (e: MouseEvent | TouchEvent) => {
			if (readonly) return;
			setCursorFromEvent(e);
			e.stopImmediatePropagation();
			const anchor = portRegistry[handle.id];
			if (!anchor) return;
			fromPath = [node, handle];
			ghostBounds = unscaleRect(anchor.el.getBoundingClientRect());
		};
		const portEnd = (e: MouseEvent | TouchEvent) => {
			if (readonly) return;
			if (!fromPath) return;
			let target: PortEndpoint | undefined;
			if (e instanceof MouseEvent) {
				target = [node, handle];
			} else {
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
			}

			const edge = target && validateEdge(fromPath, target);
			if (edge) {
				edges.push(edge);
			}
		};

		return {
			onmousedown: portStart,
			ontouchstart: portStart,
			onmouseup: portEnd,
			ontouchend: portEnd,
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

	/// bind the api
	api = {
		insertNodeAt(n: FlowNode, clientX: number, clientY: number) {
			const { x, y } = toViewportCoords(clientX, clientY);
			n.position.x = x;
			n.position.y = y;
			nodes.push(n);
			return n;
		},
		removeNode(n: FlowNode) {
			const e = new Set(
				n.ports
					.map((p) => edges.find((e) => e.from == p.id || e.to == p.id))
					.filter(Boolean) as FlowEdge[]
			);
			for (let i = edges.length - 1; i >= 0; i--) {
				if (e.has(edges[i])) {
					edges.splice(i, 1);
				}
			}
			return nodes.splice(nodes.indexOf(n), 1).length == 1;
		},
		removeEdge(e: FlowEdge) {
			return edges.splice(edges.indexOf(e), 1).length == 1;
		},
		get activePort() {
			return fromPath;
		},
		get selectedEdges() {
			return selectedEdges;
		},
		get selectedNodes() {
			return selectedNodes;
		},
		get selecting() {
			return selecting;
		}
	} satisfies FlowApi<FlowNode, FlowEdge, FlowPort>;

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

{#snippet DefaultEdge(edge: FlowEdge, a: PortAnchor, b: PortAnchor, bindings: EdgeBindingContext)}
	{@const { rect, d } = makeStepArrow(a.rect, b.rect)}
	{@const edgeHandlers = bindings?.edgeHandlers || {}}
	<svg
		style:position="absolute"
		style:overflow="visible"
		style:left="0"
		style:top="0"
		style:pointer-events="none"
		style:width="{rect.width}px"
		style:height="{rect.height}px"
		style:transform="translate({rect.x}px, {rect.y}px)"
	>
		<path
			{d}
			fill="none"
			stroke-width="1"
			style:pointer-events="none"
			{...defaultEdgePathProps?.(edge, bindings?.isSelected)}
		/>
		<path
			{d}
			stroke="transparent"
			fill="none"
			stroke-width="10"
			style:pointer-events={bindings ? 'stroke' : 'none'}
			{...edgeHandlers}
		/>
	</svg>
{/snippet}

{#snippet DefaultGhostEdge(sourceBounds: PortAnchor, cursorBounds: DOMRect)}
	<!-- 
		The default implementation doesn't need any of this but a custom one might
	-->
	{@render DefaultEdge(
		null!,
		sourceBounds,
		{
			rect: cursorBounds,
			el: null!,
			node: null!,
			port: null!
		},
		null!
	)}
{/snippet}

<div bind:this={el} {...rest} style:position="relative">
	<!-- Wait for the api to be ready -->
	{#await tick() then _}
		{#each nodes as node}
			{@render Node(createNodeBindings(node))}
		{/each}

		{#each edges as e}
			{@const a = portRegistry[e.from]}
			{@const b = portRegistry[e.to]}
			{@const edgeBindings = createEdgeBindings(e)}
			{#if a && b}
				{@render (Edge || DefaultEdge)(e, a, b, edgeBindings)}
			{/if}
		{/each}

		{#if fromPath && portRegistry[fromPath[1].id]}
			{@render (GhostEdge || DefaultGhostEdge)(portRegistry[fromPath[1].id], ghostBounds)}
		{/if}

		{#if selecting}
			<div
				style:position="absolute"
				style:transform="translate({selection.x}px, {selection.y}px)"
				style:width="{selection.width}px"
				style:height="{selection.height}px"
				{...boxSelectionProps}
			></div>
		{/if}
	{/await}
</div>
