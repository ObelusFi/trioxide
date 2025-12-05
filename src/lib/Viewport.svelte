<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		children,
		'min-zoom': minZoom = 0.2,
		'max-zoom': maxZoom = 10,
		viewport = $bindable({
			x: 0,
			y: 0,
			zoom: 1
		}),
		pattern = 'none',
		'pan-with-mouse': panOnMouse = false,
		'pattern-color': patternColor = 'var(--trioxide_neutral-4)',
		'pattern-size': patternSize = (z) => (z > 1 ? 10 * viewport.zoom : 0),
		...restParams
	}: {
		children?: Snippet;
		'min-zoom'?: number;
		'max-zoom'?: number;
		viewport?: { x: number; y: number; zoom: number };
		'pan-with-mouse'?: boolean;
		'pattern-color'?: string;
		pattern?: 'none' | 'square' | 'circle';
		'pattern-size'?: (zoom: number) => number;
	} & HTMLAttributes<HTMLDivElement> = $props();

	let wrapper: HTMLDivElement;
	let isPanning = false;
	let startX = 0;
	let startY = 0;

	const clamp = (v: number, min: number, max: number) => {
		return Math.min(Math.max(v, min), max);
	};

	const getWheelDelta = (e: WheelEvent) => {
		if (e.deltaMode === 1) return e.deltaY * 16;
		if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
		return e.deltaY; // pixel
	};

	const onWheel = (e: WheelEvent) => {
		e.preventDefault();
		e.stopImmediatePropagation();

		const isZoomGesture = e.ctrlKey;

		if (isZoomGesture) {
			const rect = wrapper.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const worldX = (mouseX - viewport.x) / viewport.zoom;
			const worldY = (mouseY - viewport.y) / viewport.zoom;

			const zoomIntensity = 0.01;
			const delta = getWheelDelta(e);
			const factor = Math.exp(-delta * zoomIntensity);
			const newScale = clamp(viewport.zoom * factor, minZoom, maxZoom);

			viewport.x = mouseX - worldX * newScale;
			viewport.y = mouseY - worldY * newScale;
			viewport.zoom = newScale;
		} else {
			viewport.x -= e.deltaX;
			viewport.y -= e.deltaY;
		}
	};

	const onMouseDown = (e: MouseEvent) => {
		if (!panOnMouse) return;
		isPanning = true;
		startX = e.clientX - viewport.x;
		startY = e.clientY - viewport.y;
	};
	const onMouseMove = (e: MouseEvent) => {
		if (!isPanning) return;
		viewport.x = e.clientX - startX;
		viewport.y = e.clientY - startY;
	};
	const onMouseUp = () => (isPanning = false);

	onMount(() => {
		wrapper.addEventListener('wheel', onWheel, { passive: false, capture: false });
		return () => {
			wrapper.removeEventListener('wheel', onWheel);
		};
	});
</script>

<svelte:window onmouseup={onMouseUp} onmousemove={onMouseMove} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	role="application"
	style:background-image={pattern == 'circle'
		? 'radial-gradient(var(--pattern_color) 1px, transparent 0)'
		: pattern === 'square'
			? 'linear-gradient(to right, var(--pattern_color) 1px, transparent 1px),linear-gradient(to bottom, var(--pattern_color) 0.5px, transparent 0.5px);'
			: ''}
	style:background-size={pattern == 'none' ? '' : 'var(--bg) var(--bg)'}
	style:background-position={pattern == 'none' ? '' : 'var(--px) var(--py)'}
	style:--pattern_color={patternColor}
	{...restParams}
	bind:this={wrapper}
	onmousedown={onMouseDown}
	style:overflow="clip"
	style:--s={viewport.zoom}
	style:--px="{viewport.x}px"
	style:--py="{viewport.y}px"
	style:--bg="{patternSize(viewport.zoom)}px"
>
	<div
		style:transform="translate(var(--px), var(--py)) scale(var(--s))"
		style:transform-origin="top left"
	>
		{@render children?.()}
	</div>
</div>
