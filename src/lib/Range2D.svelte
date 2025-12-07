<script lang="ts" module>
	export type Range2DApi = {
		coordsToValue(clientX: number, clientY: number): { x: number; y: number };
		isDragging: boolean;
	};
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type DragEvent = MouseEvent | TouchEvent;

	let {
		x = $bindable(),
		y = $bindable(),
		api = $bindable(),
		'min-x': minX = 0,
		'max-x': maxX = 1,

		'min-y': minY = 0,
		'max-y': maxY = 1,
		Handle,
		...rest
	}: {
		'min-x'?: number;
		'max-x'?: number;
		'min-y'?: number;
		'max-y'?: number;
		x?: number;
		y?: number;
		Handle: Snippet<[typeof handleBindings]>;
		api?: Range2DApi;
	} & SvelteHTMLElements['div'] = $props();

	x = x ?? 0;
	y = y ?? 0;

	let posX = $state(0);
	let posY = $state(0);
	let isDragging = $state(false);

	let startX = 0;
	let startY = 0;
	let el: HTMLElement = $state()!;
	let handle: HTMLElement | undefined = $state();

	const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

	const mapRange = (
		value: number,
		inMin: number,
		inMax: number,
		outMin: number,
		outMax: number
	) => {
		if (inMax === inMin) return outMin;
		return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
	};

	type Metrics = {
		elementRect: DOMRect;
		handleRect: DOMRect;
		scale: number;
		maxPixelX: number;
		maxPixelY: number;
	};

	const getMetrics = (): Metrics | null => {
		if (!handle) return null;
		const elementRect = el.getBoundingClientRect();
		const handleRect = handle.getBoundingClientRect();
		const scale = elementRect.width / el.offsetWidth || 1;

		return {
			elementRect,
			handleRect,
			scale,
			maxPixelX: (elementRect.width - handleRect.width) / scale,
			maxPixelY: (elementRect.height - handleRect.height) / scale
		};
	};

	const getClientPoint = (e: DragEvent) => {
		if (e instanceof MouseEvent) {
			return { clientX: e.clientX, clientY: e.clientY };
		}
		const { clientX, clientY } = e.touches[0];
		return { clientX, clientY };
	};

	const endDrag = () => {
		isDragging = false;
	};

	const startDrag = (e: DragEvent) => {
		e.stopPropagation();
		isDragging = true;
		const { clientX, clientY } = getClientPoint(e);
		startX = clientX;
		startY = clientY;
	};

	const onDrag = (e: DragEvent) => {
		if (!isDragging) return;
		const metrics = getMetrics();
		if (!metrics) return;
		e.stopPropagation();

		const { clientX, clientY } = getClientPoint(e);
		const deltaX = (clientX - startX) / metrics.scale;
		const deltaY = (clientY - startY) / metrics.scale;

		const nextPixelX = clamp(posX + deltaX, 0, metrics.maxPixelX);
		const nextPixelY = clamp(posY + deltaY, 0, metrics.maxPixelY);

		x = mapRange(nextPixelX, 0, metrics.maxPixelX, minX, maxX);
		y = mapRange(nextPixelY, 0, metrics.maxPixelY, minY, maxY);

		startX = clamp(
			clientX,
			metrics.elementRect.x + metrics.handleRect.width / 2,
			metrics.elementRect.x + metrics.elementRect.width - metrics.handleRect.width / 2
		);
		startY = clamp(
			clientY,
			metrics.elementRect.y + metrics.handleRect.height / 2,
			metrics.elementRect.y + metrics.elementRect.height - metrics.handleRect.height / 2
		);
	};

	const stepY = () => (maxY - minY) / 100;
	const stepX = () => (maxX - minX) / 100;

	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'ArrowUp') {
			y = clamp(y! - stepY(), minY, maxY);
		} else if (e.key === 'ArrowDown') {
			y = clamp(y! + stepY(), minY, maxY);
		} else if (e.key === 'ArrowLeft') {
			x = clamp(x! - stepX(), minX, maxX);
		} else if (e.key === 'ArrowRight') {
			x = clamp(x! + stepX(), minX, maxX);
		}
	};

	$effect(() => {
		const metrics = getMetrics();
		if (!metrics) return;

		posX = mapRange(x!, minX, maxX, 0, metrics.maxPixelX);
		posY = mapRange(y!, minY, maxY, 0, metrics.maxPixelY);
	});

	const handleBindings = {
		[createAttachmentKey()]: (node: HTMLElement) => {
			handle = node;
			node.style.setProperty('position', 'absolute');
			node.style.setProperty('left', '0');
			node.style.setProperty('top', '0');

			$effect(() => {
				node.style.setProperty('transform', `translate(${posX}px, ${posY}px)`);
			});
			return () => {
				handle = undefined;
			};
		},
		onmousedown: startDrag,
		ontouchstart: startDrag,
		onkeydown: onKeydown
	};

	onMount(() => {
		window.addEventListener('mouseup', endDrag);
		window.addEventListener('touchend', endDrag);

		window.addEventListener('mousemove', onDrag);
		window.addEventListener('touchmove', onDrag);
		return () => {
			window.removeEventListener('mouseup', endDrag);
			window.removeEventListener('touchend', endDrag);
			window.removeEventListener('mousemove', onDrag);
			window.removeEventListener('touchmove', onDrag);
		};
	});

	const coordsToValue = (clientX: number, clientY: number) => {
		const metrics = getMetrics();
		if (!metrics) {
			return { x: 0, y: 0 };
		}

		return {
			x: clamp(
				mapRange(
					(clientX - metrics.elementRect.x - metrics.handleRect.width / 2) / metrics.scale,
					0,
					metrics.maxPixelX,
					minX,
					maxX
				),
				minX,
				maxX
			),
			y: clamp(
				mapRange(
					(clientY - metrics.elementRect.y - metrics.handleRect.height / 2) / metrics.scale,
					0,
					metrics.maxPixelY,
					minY,
					maxY
				),
				minY,
				maxY
			)
		};
	};

	const setvalueAndDrag = (e: DragEvent) => {
		const { clientX, clientY } = getClientPoint(e);
		({ x, y } = coordsToValue(clientX, clientY));
		startDrag(e);
	};
	api = {
		coordsToValue,
		get isDragging() {
			return isDragging;
		}
	};
</script>

<div
	bind:this={el}
	onmousedown={setvalueAndDrag}
	ontouchstart={setvalueAndDrag}
	style:position="relative"
	{...rest}
>
	{#if typeof window !== 'undefined'}
		{@render Handle(handleBindings)}
	{/if}
</div>
