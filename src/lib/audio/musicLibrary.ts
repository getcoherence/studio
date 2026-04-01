export interface MusicTrack {
	id: string;
	name: string;
	genre: string;
	duration: string;
	mood: string;
	// URL would point to a bundled audio file - for now just metadata
	available: boolean;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
	{ id: "none", name: "No Music", genre: "", duration: "", mood: "", available: true },
	{
		id: "lo-fi-chill",
		name: "Lo-fi Chill",
		genre: "Lo-fi",
		duration: "3:00",
		mood: "Relaxed",
		available: false,
	},
	{
		id: "upbeat-tech",
		name: "Upbeat Tech",
		genre: "Electronic",
		duration: "2:30",
		mood: "Energetic",
		available: false,
	},
	{
		id: "corporate-ambient",
		name: "Corporate Ambient",
		genre: "Ambient",
		duration: "3:15",
		mood: "Professional",
		available: false,
	},
	{
		id: "tutorial-soft",
		name: "Tutorial Soft",
		genre: "Acoustic",
		duration: "2:45",
		mood: "Calm",
		available: false,
	},
	{
		id: "demo-day",
		name: "Demo Day",
		genre: "Pop",
		duration: "2:00",
		mood: "Upbeat",
		available: false,
	},
];
