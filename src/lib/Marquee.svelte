<script lang="ts">
	import { onMount } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	type Direction = 'left' | 'right';
	let {
		speed = 200,
		direction = 'right',
		children,
		...props
	}: { speed?: number; direction?: Direction } & SvelteHTMLElements['div'] = $props();
	let marqueeEl: HTMLElement;
	let stop = false;
	let dir = $state('rtl');
	onMount(() => {
		let state: [HTMLElement, number, number][] = [];
		dir = window.getComputedStyle(marqueeEl).direction;
		const init = () => {
			const pr = marqueeEl.getBoundingClientRect();
			const children = [...marqueeEl.children] as HTMLElement[];
			children.forEach((e) => e.style.removeProperty('translate'));
			setTimeout(() => {
				state = [];
				const rects = children.map((e) => e.getBoundingClientRect());
				let i = 0;
				const space = marqueeEl.scrollWidth - marqueeEl.getBoundingClientRect().width;
				let gap = rects[1]?.x - rects[0]?.x - rects[0]?.width || 0;
				for (const e of children) {
					const rect = rects[i];
					const baseMin = -Math.max(space + gap, rect.width) - (rect.x - pr.x);
					const baseMax = pr.width - (rect.x - pr.x);
					const wrapWidth = baseMax - baseMin;
					state.push([e, wrapWidth, baseMin]);
					i++;
				}
			});
		};

		let timeout: ReturnType<typeof setTimeout>;
		let lastT = 0;
		let animationFrame: number;
		let s = 0;
		const resizeObserver = new ResizeObserver(() => {
			stop = true;
			init();
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				stop = false;
				init();
			}, 60);
		});
		resizeObserver.observe(marqueeEl);

		const update = (now: number) => {
			if (!lastT) lastT = now;
			const dt = (now - lastT) / 1000;
			// need to check if this is too expensive
			// dir = window.getComputedStyle(marqueeEl).direction;
			lastT = now;
			s += stop ? 0 : speed * dt * (direction === 'right' ? 1 : -1);
			for (let [e, wrapWidth, min] of state) {
				const x = ((((s - min) % wrapWidth) + wrapWidth) % wrapWidth) + min;
				e.style.translate = `${x}px`;
			}
			animationFrame = requestAnimationFrame(update);
		};
		animationFrame = requestAnimationFrame(update);

		return () => {
			cancelAnimationFrame(animationFrame);
			clearTimeout(timeout);
			resizeObserver.disconnect();
		};
	});
</script>

<div
	style:overflow="hidden"
	style:flex-direction={dir == 'ltr' ? 'row' : 'row-reverse'}
	style:display="flex"
	{...props}
	bind:this={marqueeEl}
>
	{@render children?.()}
</div>
