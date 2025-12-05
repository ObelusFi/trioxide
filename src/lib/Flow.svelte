<script lang="ts">
	import { onMount } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	type Handle = { id: string; type: 'input' | 'output' };
	type NodeProps = {
		handles: Handle[];
		pos: { x: number; y: number };
	};
	type EdgeProps = { from: string; to: string };
	let nodes: NodeProps[] = $state([
		{
			handles: [
				{ id: 'a', type: 'input' },
				{ id: 'b', type: 'output' }
			],
			pos: { x: 0, y: 0 }
		},
		{
			handles: [
				{ id: 'c', type: 'input' },
				{ id: 'd', type: 'output' }
			],
			pos: { x: 0, y: 0 }
		}
	]);
	let edges: EdgeProps[] = $state([]);
	let el: HTMLElement;

	const drect = (x = 0, y = 0, w = 0, h = 0) => {
		return { x: x, y: y, width: w, height: h, bottom: 0, left: 0, right: 0, top: 0 } as DOMRect;
	};

	let elRect: DOMRect = drect();
	let scale = 1;
	let ghost = $state(drect());
	let from: Handle | null = $state(null);
	let ghostStartY: number;
	let ghostStartX: number;

	const handles: Record<string, { el: HTMLElement; rect: DOMRect }> = $state({});

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
			x: x1 - elRect.x,
			y: y1 - elRect.y,
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
		elRect = unscaleRect(el.getBoundingClientRect());
		for (const [id, { el }] of Object.entries(handles)) {
			handles[id].rect = unscaleRect(el.getBoundingClientRect());
		}
		animationFrame = requestAnimationFrame(update);
	};

	const cancelGhost = () => {
		from = null;
	};

	const moveGhost = (e: MouseEvent | TouchEvent) => {
		if (!from) return;
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
		let dx = (pageX - ghostStartX) / scale;
		let dy = (pageY - ghostStartY) / scale;
		ghost.x += dx;
		ghost.y += dy;
		ghostStartX = pageX;
		ghostStartY = pageY;
	};

	onMount(() => {
		elRect = el.getBoundingClientRect();
		animationFrame = requestAnimationFrame(update);
		window.addEventListener('mouseup', cancelGhost);
		window.addEventListener('mousemove', moveGhost);
		return () => {
			window.removeEventListener('mouseup', cancelGhost);
			cancelAnimationFrame(animationFrame);
		};
	});

	const useHandle = (handle: Handle) => ({
		onmousedown: (e: MouseEvent | TouchEvent) => {
			e.stopImmediatePropagation();
			if (e instanceof MouseEvent) {
				ghostStartX = e.pageX;
				ghostStartY = e.pageY;
			} else {
				ghostStartX = e.touches[0].pageX;
				ghostStartY = e.touches[0].pageY;
			}
			from = handle;
			ghost = unscaleRect(handles[handle.id].el.getBoundingClientRect());
		},
		onmouseup: (e: MouseEvent | TouchEvent) => {
			if (from) {
				edges.push({
					from: from.id,
					to: handle.id
				});
			}
		},
		[createAttachmentKey()]: (el: HTMLElement) => {
			handles[handle.id] = {
				el,
				rect: el.getBoundingClientRect()
			};
			return () => {
				delete handles[handle.id];
			};
		}
	});

	const useNodeFactory = (n: NodeProps) => {
		let startY: number;
		let startX: number;
		let isDragging = $state(false);

		function dragStart(e: MouseEvent | TouchEvent) {
			e.stopImmediatePropagation();
			isDragging = true;
			if (e instanceof MouseEvent) {
				startX = e.pageX;
				startY = e.pageY;
			} else {
				startX = e.touches[0].pageX;
				startY = e.touches[0].pageY;
			}
		}

		function onMouseMove(e: MouseEvent | TouchEvent) {
			if (!isDragging) return;
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
			let dx = (pageX - startX) / scale;
			let dy = (pageY - startY) / scale;
			n.pos.x += dx;
			n.pos.y += dy;

			startX = pageX;
			startY = pageY;
		}

		function onMouseUp() {
			isDragging = false;
		}
		return {
			get isDragging() {
				return isDragging;
			},
			useHandle,
			useDrag: {
				onmousedown: dragStart,
				[createAttachmentKey()]: (_: HTMLElement) => {
					window.addEventListener('mousemove', onMouseMove);
					window.addEventListener('mouseup', onMouseUp);
					return () => {
						window.removeEventListener('mousemove', onMouseMove);
						window.removeEventListener('mouseup', onMouseUp);
					};
				},
				get style() {
					return `transform: translate(${n.pos.x}px, ${n.pos.y}px);`;
				}
			}
		};
	};
</script>

{#snippet Node(n: NodeProps, { useDrag, useHandle }: ReturnType<typeof useNodeFactory>)}
	<div class="absolute inline-flex border p-4 select-none" {...useDrag}>
		<div class="flex flex-col justify-center">
			{#each n.handles.filter((e) => e.type == 'input') as s}
				<div class="h-2 w-2 bg-red-500" {...useHandle(s)}></div>
			{/each}
		</div>
		<div class="p-2">Some content</div>
		<div class=" flex flex-col justify-center">
			{#each n.handles.filter((e) => e.type == 'output') as s}
				<div class="h-2 w-2 bg-amber-500" {...useHandle(s)}></div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet Edge(e: EdgeProps, a: (typeof handles)[''], b: (typeof handles)[''])}
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

{#snippet GhostEdge()}{/snippet}

<div class="relative h-90" bind:this={el}>
	{#each nodes as node}
		{@render Node(node, useNodeFactory(node))}
	{/each}

	{#each edges as e}
		{@const a = handles[e.from]}
		{@const b = handles[e.to]}
		{#if a && b}
			{@render Edge(e, a, b)}
		{/if}
	{/each}

	{#if from}
		{@const a = handles[from.id]}
		{@const b = { rect: ghost, el: null! }}
		{#if a && b}
			{@render Edge(null!, a, b)}
		{/if}
	{/if}
</div>
