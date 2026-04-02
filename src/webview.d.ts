/**
 * JSX type declaration for Electron's <webview> tag.
 * Enables TypeScript support in React components.
 */

declare namespace JSX {
	interface IntrinsicElements {
		webview: React.DetailedHTMLProps<
			React.HTMLAttributes<Element> & {
				src?: string;
				webpreferences?: string;
				partition?: string;
				allowpopups?: string;
				preload?: string;
				httpreferrer?: string;
				useragent?: string;
				disablewebsecurity?: string;
				nodeintegration?: string;
				nodeintegrationinsubframes?: string;
			},
			Element
		>;
	}
}
