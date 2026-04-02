/**
 * JSX type declaration for Electron's <webview> tag.
 * Uses a permissive type to avoid ref conflicts with Electron.WebviewTag.
 */

declare namespace JSX {
	interface IntrinsicElements {
		webview: {
			ref?: React.Ref<unknown>;
			src?: string;
			style?: React.CSSProperties;
			className?: string;
			webpreferences?: string;
			partition?: string;
			allowpopups?: string;
			preload?: string;
			httpreferrer?: string;
			useragent?: string;
			disablewebsecurity?: string;
			nodeintegration?: string;
			nodeintegrationinsubframes?: string;
			children?: never;
		};
	}
}
