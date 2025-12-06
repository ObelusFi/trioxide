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
		'pan-with-mouse': panOnMouse = true,
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
	let pinchDistance = 0;

	const clamp = (v: number, min: number, max: number) => {
		return Math.min(Math.max(v, min), max);
	};

	const getWheelDelta = (e: WheelEvent) => {
		if (e.deltaMode === 1) return e.deltaY * 16;
		if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
		return e.deltaY; // pixel
	};

	const applyZoom = (newScale: number, originX: number, originY: number) => {
		const worldX = (originX - viewport.x) / viewport.zoom;
		const worldY = (originY - viewport.y) / viewport.zoom;

		viewport.x = originX - worldX * newScale;
		viewport.y = originY - worldY * newScale;
		viewport.zoom = newScale;
	};

	const startPan = (clientX: number, clientY: number) => {
		isPanning = true;
		startX = clientX - viewport.x;
		startY = clientY - viewport.y;
	};

	const movePan = (clientX: number, clientY: number) => {
		if (!isPanning) return;
		viewport.x = clientX - startX;
		viewport.y = clientY - startY;
	};

	const normalizedTouchDistance = (touches: TouchList) => {
		const dx = touches[1].clientX - touches[0].clientX;
		const dy = touches[1].clientY - touches[0].clientY;
		return Math.hypot(dx, dy) / Math.hypot(window.innerWidth, window.innerHeight);
	};

	const onWheel = (e: WheelEvent) => {
		e.preventDefault();
		e.stopImmediatePropagation();

		const isZoomGesture = e.ctrlKey;

		if (isZoomGesture) {
			const rect = wrapper.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const zoomIntensity = 0.01;
			const delta = getWheelDelta(e);
			const factor = Math.exp(-delta * zoomIntensity);

			const newScale = clamp(viewport.zoom * factor, minZoom, maxZoom);

			applyZoom(newScale, mouseX, mouseY);
		} else {
			viewport.x -= e.deltaX;
			viewport.y -= e.deltaY;
		}
	};

	const handlePinchZoom = (e: TouchEvent) => {
		if (e.touches.length !== 2) return;

		const rect = wrapper.getBoundingClientRect();
		const distance = normalizedTouchDistance(e.touches);
		const deltaDistance = distance - pinchDistance;
		const zoomFactor = 10;
		const newScale = clamp(viewport.zoom + deltaDistance * zoomFactor, minZoom, maxZoom);

		const mouseX = (e.touches[1].clientX + e.touches[0].clientX) / 2 - rect.left;
		const mouseY = (e.touches[1].clientY + e.touches[0].clientY) / 2 - rect.top;

		applyZoom(newScale, mouseX, mouseY);
		pinchDistance = distance;
	};

	const onMouseDown = (e: MouseEvent) => {
		if (!panOnMouse) return;
		startPan(e.clientX, e.clientY);
	};

	const onTouchStart = (e: TouchEvent) => {
		if (e.touches.length === 0) return;
		if (e.touches.length === 2) {
			pinchDistance = normalizedTouchDistance(e.touches);
		}
		startPan(e.touches[0].clientX, e.touches[0].clientY);
	};

	const onMouseMove = (e: MouseEvent) => movePan(e.clientX, e.clientY);

	const onTouchMove = (e: TouchEvent) => {
		e.preventDefault();
		if (e.touches.length === 2) {
			handlePinchZoom(e);
			return;
		}
		movePan(e.touches[0].clientX, e.touches[0].clientY);
	};

	const onMouseUp = () => (isPanning = false);

	onMount(() => {
		wrapper.addEventListener('wheel', onWheel, { passive: false });

		window.addEventListener('mouseup', onMouseUp);
		window.addEventListener('touchend', onMouseUp);

		wrapper.addEventListener('mousemove', onMouseMove);
		wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
		return () => {
			wrapper.removeEventListener('wheel', onWheel);

			window.removeEventListener('mouseup', onMouseUp);
			window.removeEventListener('touchend', onMouseUp);

			wrapper.removeEventListener('mousemove', onMouseMove);
			wrapper.removeEventListener('touchmove', onTouchMove);
		};
	});
</script>

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
	ontouchstart={onTouchStart}
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
