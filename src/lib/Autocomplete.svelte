<script lang="ts" module>
	export interface SuggestionProvider {
		suggest(input: string): string | Promise<string>;
	}

	export class DefaultSuggestionProvider implements SuggestionProvider {
		private candidates: string[];
		private segmenter: Intl.Segmenter;

		constructor(
			candidates: string[] = [],
			segmenter = new Intl.Segmenter('und', { granularity: 'word' })
		) {
			this.candidates = candidates;
			this.segmenter = segmenter;
		}

		public setCandidates(list: string[]): void {
			this.candidates = list || [];
		}

		private extractFragment(text: string): string {
			let lastWord;
			for (const s of this.segmenter.segment(text)) {
				lastWord = s;
			}
			if (lastWord?.isWordLike) return lastWord.segment;
			return '';
		}

		private matchSuffixPrefix(frag: string, cand: string): number {
			const max = Math.min(frag.length, cand.length);
			for (let n = max; n > 0; n--) {
				if (cand.slice(0, n).startsWith(frag)) {
					return n;
				}
			}
			return 0;
		}

		private normalize(str: string) {
			return str.toLocaleLowerCase();
		}

		public suggest(input: string): string {
			let best = '';
			let ipt = this.normalize(input);
			const frag = this.extractFragment(ipt);
			for (const c of this.candidates) {
				const ghost = this.matchSuffixPrefix(frag, this.normalize(c));
				if (ghost > best.length) {
					best = c.slice(ghost);
				}
			}
			return best;
		}
	}
</script>

<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	let {
		type = 'textarea',
		value = $bindable(),
		acceptOn: accept,
		provider,
		ghostProps,
		...rest
	}: {
		type?: 'input' | 'textarea';
		value: string;
		provider: SuggestionProvider;
		acceptOn?: (e: KeyboardEvent) => boolean;
		ghostProps?: SvelteHTMLElements['div'];
	} & (SvelteHTMLElements['input'] & SvelteHTMLElements['textarea']) = $props();

	let el: HTMLElement = $state(null!);
	let completion = $state('');
	let ghostEl: HTMLElement = $state(null!);

	const daccept = (e: KeyboardEvent) => {
		let dir = window.getComputedStyle(el).direction;
		return e.key == (dir == 'ltr' ? 'ArrowRight' : 'ArrowLeft');
	};

	const handlekey = (e: KeyboardEvent) => {
		if (!(accept || daccept)(e)) return;
		value += completion;
	};

	const onscroll = () => {
		console.log('scrolling');
		ghostEl.scrollLeft = el.scrollLeft;
		ghostEl.scrollTop = el.scrollTop;
	};

	$effect(() => {
		const rep = provider.suggest(value);
		if (typeof rep == 'string') {
			completion = rep;
		} else {
			rep.then((e) => {
				completion = e;
			});
		}
	});
</script>

<div class={rest.class?.toString()}>
	<label>
		<div bind:this={ghostEl} {...ghostProps}>
			{value}{completion + ' '}
		</div>
		{#if type == 'input'}
			<input
				{...rest}
				class=""
				type="text"
				bind:this={el}
				bind:value
				onkeydown={handlekey}
				{onscroll}
			/>
		{:else}
			<textarea
				{...{}}
				{...{}}
				{...rest}
				class=""
				bind:this={el}
				bind:value
				onkeydown={handlekey}
				{onscroll}
			></textarea>
		{/if}
	</label>
</div>

<style lang="postcss">
	label {
		position: relative;
		display: inline-block;
		width: 100%;
		height: 100%;
		div {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			display: block;
			overflow: hidden;
			user-select: none;
			white-space: pre-wrap;
			overflow-wrap: break-word;
		}
		input,
		textarea {
			all: unset;
			display: block;
			z-index: 1;
			position: relative;
			cursor: text;
			width: 100%;
			background-color: transparent;
		}
	}
</style>
