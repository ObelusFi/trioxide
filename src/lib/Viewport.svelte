<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let {
		children,
		'min-zoom': minZoom = 0.2,
		'max-zoom': maxZoom = 20,
		viewport = $bindable({
			x: 0,
			y: 0,
			zoom: 1
		}),
		pattern = 'none',
		'pan-with-mouse': panOnMouse = true,
		'pattern-color': patternColor = '#fff',
		'min-cell-size': minGridSize = 3,
		'grid-size': gridSize = 5,
		...restParams
	}: {
		children?: Snippet;
		'min-zoom'?: number;
		'max-zoom'?: number;
		viewport?: { x: number; y: number; zoom: number };
		'pan-with-mouse'?: boolean;
		'pattern-color'?: string;
		pattern?: 'dots' | 'grid' | 'cross' | 'none';
		'min-cell-size'?: number;
		'grid-size'?: number;
	} & SvelteHTMLElements['div'] = $props();

	let wrapper: HTMLDivElement;
	let isPanning = false;
	let startX = 0;
	let startY = 0;
	let pinchDistance = 0;
	let ctx: CanvasRenderingContext2D = $state()!;
	let canvas: HTMLCanvasElement;
	let canvasRect = $state();
	let pColor = '';
	let timeout: ReturnType<typeof requestAnimationFrame>;

	function watchColor() {
		const v = getComputedStyle(document.documentElement).getPropertyValue(patternColor);
		if (v !== pColor) {
			pColor = v;
		}

		timeout = requestAnimationFrame(watchColor);
	}

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

		const isZoomGesture = e.ctrlKey || e.metaKey;

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
		if (e.button !== 0) return;
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

	function update({ x, y, zoom }: { x: number; y: number; zoom: number }) {
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;

		canvas.width = w * dpr;
		canvas.height = h * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const p = Math.log(maxZoom / zoom) / Math.log(gridSize);
		const i0 = Math.floor(p);
		const i1 = i0 + 1;

		const a1 = Math.min(Math.max(p - i0, 0), 1);
		const a0 = 1 - a1;
		const size0 = minGridSize * gridSize ** i0 * zoom;
		const size1 = minGridSize * gridSize ** i1 * zoom;

		drawPattern(size0, a0, pColor, x, y, w, h);
		drawPattern(size1, a1, pColor, x, y, w, h);
	}

	function drawDots(
		size: number,
		alpha: number,
		color: string,
		x: number,
		y: number,
		w: number,
		h: number
	) {
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;

		const ox = ((x % size) + size) % size;
		const oy = ((y % size) + size) % size;

		for (let yy = oy; yy < h; yy += size) {
			for (let xx = ox; xx < w; xx += size) {
				ctx.beginPath();
				ctx.arc(xx, yy, 1, 0, 2 * Math.PI);
				ctx.fill();
				// ctx.fillRect(xx, yy, 2, 2);
			}
		}

		ctx.restore();
	}

	function drawGridLines(
		size: number,
		alpha: number,
		color: string,
		x: number,
		y: number,
		w: number,
		h: number
	) {
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;

		const ox = ((x % size) + size) % size;
		const oy = ((y % size) + size) % size;

		ctx.beginPath();

		for (let xx = ox; xx < w; xx += size) {
			ctx.moveTo(xx, 0);
			ctx.lineTo(xx, h);
		}

		for (let yy = oy; yy < h; yy += size) {
			ctx.moveTo(0, yy);
			ctx.lineTo(w, yy);
		}

		ctx.stroke();
		ctx.restore();
	}

	function drawCrosses(
		size: number,
		alpha: number,
		color: string,
		x: number,
		y: number,
		w: number,
		h: number
	) {
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;

		const arm = minGridSize;

		const ox = ((x % size) + size) % size;
		const oy = ((y % size) + size) % size;

		ctx.beginPath();

		for (let yy = oy; yy < h; yy += size) {
			for (let xx = ox; xx < w; xx += size) {
				ctx.moveTo(xx - arm, yy);
				ctx.lineTo(xx + arm, yy);
				ctx.moveTo(xx, yy - arm);
				ctx.lineTo(xx, yy + arm);
			}
		}

		ctx.stroke();
		ctx.restore();
	}

	function drawPattern(
		size: number,
		alpha: number,
		color: string,
		x: number,
		y: number,
		w: number,
		h: number
	) {
		if (alpha <= 0 || size <= 0) return;

		switch (pattern) {
			case 'dots':
				drawDots(size, alpha, color, x, y, w, h);
				break;
			case 'grid':
				drawGridLines(size, alpha, color, x, y, w, h);
				break;
			case 'cross':
				drawCrosses(size, alpha, color, x, y, w, h);
				break;
		}
	}

	$effect(() => {
		canvasRect;
		if (!ctx) return;
		update(viewport);
	});

	$effect(() => {
		if (patternColor && patternColor.startsWith('var')) {
			patternColor = patternColor.replace('var(', '').replace(')', '');
			watchColor();
		} else {
			cancelAnimationFrame(timeout);
		}
		return () => {
			cancelAnimationFrame(timeout);
		};
	});
	let force: HTMLElement;
	onMount(() => {
		wrapper.addEventListener('wheel', onWheel, { passive: false });

		window.addEventListener('mouseup', onMouseUp);
		window.addEventListener('touchend', onMouseUp);

		wrapper.addEventListener('mousemove', onMouseMove);
		wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
		ctx = canvas.getContext('2d')!;
		return () => {
			wrapper.removeEventListener('wheel', onWheel);

			window.removeEventListener('mouseup', onMouseUp);
			window.removeEventListener('touchend', onMouseUp);

			wrapper.removeEventListener('mousemove', onMouseMove);
			wrapper.removeEventListener('touchmove', onTouchMove);
		};
	});
</script>

<!-- This is a safary fix,to render sharp text -->
<div style:isolation="isolate">
	<div
		role="application"
		style:--pattern_color={patternColor}
		bind:this={wrapper}
		onmousedown={onMouseDown}
		ontouchstart={onTouchStart}
		style:overflow="hidden"
		style:position="relative"
		style:--s={viewport.zoom}
		{...restParams}
	>
		<div
			style:--px="{viewport.x}px"
			style:--py="{viewport.y}px"
			style:transform-origin="top left"
			bind:this={force}
			style:z-index="1"
			style:transform="translateX({viewport.x}px) translateY({viewport.y}px) scale({viewport.zoom})"
		>
			{@render children?.()}
		</div>
		<canvas
			style:position="absolute"
			style:left="0"
			style:top="0"
			style:width="100%"
			style:height="100%"
			style:pointer-events="none"
			bind:this={canvas}
			bind:contentRect={canvasRect}
			style="z-index: -1;"
		></canvas>
	</div>
</div>
