import { DEFAULT_LOCALE, type I18nNamespace, type Locale } from "./config";

type MessageMap = Record<string, unknown>;

const modules = import.meta.glob("./locales/**/*.json", { eager: true }) as Record<
	string,
	{ default: MessageMap }
>;

const messages: Record<string, Record<string, MessageMap>> = {};

for (const [path, mod] of Object.entries(modules)) {
	// path looks like "./locales/en/common.json"
	const parts = path.replace("./locales/", "").replace(".json", "").split("/");
	const locale = parts[0];
	const namespace = parts[1];
	if (!messages[locale]) messages[locale] = {};
	messages[locale][namespace] = mod.default;
}

function getMessageValue(obj: unknown, dotPath: string): string | undefined {
	const keys = dotPath.split(".");
	let current: unknown = obj;
	for (const key of keys) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === "string" ? current : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
	if (!vars) return str;
	return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? `{{${key}}}`));
}

export function getMessages(locale: Locale, namespace: I18nNamespace): MessageMap {
	return messages[locale]?.[namespace] ?? {};
}

export function getLocaleName(locale: Locale): string {
	return getMessageValue(messages[locale]?.common, "locale.name") ?? locale;
}

export function getLocaleShort(locale: Locale): string {
	return getMessageValue(messages[locale]?.common, "locale.short") ?? locale;
}

export function translate(
	locale: Locale,
	namespace: I18nNamespace,
	key: string,
	vars?: Record<string, string | number>,
): string {
	const value =
		getMessageValue(messages[locale]?.[namespace], key) ??
		getMessageValue(messages[DEFAULT_LOCALE]?.[namespace], key);

	if (value == null) return `${namespace}.${key}`;
	return interpolate(value, vars);
}
