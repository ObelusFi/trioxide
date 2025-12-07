<script lang="ts" module>
	export type Range2DApi = {
		coordsToValue(clientX: number, clientY: number): { x: number; y: number };
	};
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import type { SvelteHTMLElements } from 'svelte/elements';

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
	let move = $state(false);

	let startX = 0;
	let startY = 0;
	let el: HTMLElement = $state()!;
	let handle: HTMLElement | undefined = $state();

	const onmouseup = () => {
		move = false;
	};

	const startDrag = (e: MouseEvent | TouchEvent) => {
		e.stopPropagation();
		move = true;
		[startX, startY] = getPos(e);
	};

	const getPos = (e: MouseEvent | TouchEvent) => {
		let clientX;
		let clientY;
		if (e instanceof MouseEvent) {
			clientX = e.clientX;
			clientY = e.clientY;
		} else {
			clientX = e.touches[0].clientX;
			clientY = e.touches[0].clientY;
		}
		return [clientX, clientY];
	};

	const clamp = (v: number, min: number, max: number) => {
		return Math.min(Math.max(v, min), max);
	};

	const map = (value: number, x1: number, y1: number, x2: number, y2: number) =>
		((value - x1) * (y2 - x2)) / (y1 - x1) + x2;

	const onDrag = (e: MouseEvent | TouchEvent) => {
		if (!move || !handle) return;
		e.stopPropagation();
		let elRect = el.getBoundingClientRect();
		let hRect = handle.getBoundingClientRect();
		let scale = elRect.width / el.offsetWidth || 1;

		const [clientX, clientY] = getPos(e);

		x = posX + (clientX - startX) / scale;
		y = posY + (clientY - startY) / scale;

		x = clamp(x, 0, (elRect.width - hRect.width) / scale);
		y = clamp(y, 0, (elRect.height - hRect.height) / scale);

		x = map(x, 0, (elRect.width - hRect.width) / scale, minX, maxX);
		y = map(y, 0, (elRect.height - hRect.height) / scale, minY, maxY);

		startX = clamp(clientX, elRect.x + hRect.width / 2, elRect.x + elRect.width - hRect.width / 2);
		startY = clamp(
			clientY,
			elRect.y + hRect.height / 2,
			elRect.y + elRect.height - hRect.height / 2
		);
	};

	const keyboarEvent = (e: KeyboardEvent) => {
		if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
			let dy = map('ArrowDown' == e.key ? 1 : -1, 0, 100, minY, maxY);
			y! += dy;
		} else if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
			let dx = map('ArrowRight' == e.key ? 1 : -1, 0, 100, minX, maxX);
			x! += dx;
		}
	};

	$effect(() => {
		if (!handle) return;
		let elRect = el.getBoundingClientRect();
		let hRect = handle.getBoundingClientRect();
		let scale = elRect.width / el.offsetWidth || 1;

		posX = map(x!, minX, maxX, 0, (elRect.width - hRect.width) / scale);
		posY = map(y!, minY, maxY, 0, (elRect.height - hRect.height) / scale);
	});

	const handleBindings = {
		[createAttachmentKey()]: (n: HTMLElement) => {
			handle = n;
			n.style.setProperty('position', 'absolute');
			n.style.setProperty('left', '0');
			n.style.setProperty('top', '0');

			$effect(() => {
				n.style.setProperty('transform', `translate(${posX}px, ${posY}px)`);
			});
			return () => {
				handle = undefined;
			};
		},
		onmousedown: startDrag,
		ontouchstart: startDrag,
		onkeydown: keyboarEvent
	};

	onMount(() => {
		window.addEventListener('mouseup', onmouseup);
		window.addEventListener('touchend', onmouseup);

		window.addEventListener('mousemove', onDrag);
		window.addEventListener('touchmove', onDrag);
		return () => {
			window.removeEventListener('mouseup', onmouseup);
			window.removeEventListener('mousemove', onDrag);
			window.removeEventListener('touchmove', onDrag);
		};
	});

	const coordsToValue = (clientX: number, clientY: number) => {
		if (!handle)
			return {
				x: 0,
				y: 0
			};
		let hRect = handle.getBoundingClientRect();
		let elRect = el.getBoundingClientRect();
		let scale = elRect.width / el.offsetWidth || 1;

		return {
			x: map(
				(clientX - elRect.x - hRect.width / 2) / scale,
				0,
				(elRect.width - hRect.width) / scale,
				minX,
				maxX
			),
			y: map(
				(clientY - elRect.y - hRect.height / 2) / scale,
				0,
				(elRect.height - hRect.height) / scale,
				minY,
				maxY
			)
		};
	};

	api = {
		coordsToValue
	};
</script>

<div bind:this={el} {...rest} style:position="relative">
	{@render Handle(handleBindings)}
</div>
