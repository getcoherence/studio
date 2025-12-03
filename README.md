<p align="center">
	<img src="openscreen.png" alt="OpenScreen Logo" width="64" />
</p>


# <p align="center">OpenScreen</p>

<p align="center"><strong>OpenScreen is your free, open-source alternative to Screen Studio (sort of).</strong></p>


If you don't want to pay $29/month for Screen Studio but want a much simpler version that does what most people seem to need, making beautiful product demos and walkthroughs, here's a free-to-use app for you. OpenScreen does not offer all Screen Studio features, but covers the basics well!

Screen Studio is an awesome product and this is definitely not a 1:1 clone. OpenScreen is a much simpler take, just the basics for folks who want control and don't want to pay. If you need all the fancy features, your best bet is to support Screen Studio (they really do a great job, haha). But if you just want something free (no gotchas) and open, this project does the job!

OpenScreen is 100% free for personal and commercial use. Use it, modify it, distribute it. (Just be cool 😁 and give a shoutout if you feel like it !)



**⚠️ DISCLAIMER: This is very much in beta and might be buggy here and there (but hope you have a good experience!).**

</p>
<p align="center">
	<img src="preview.png" alt="OpenScreen App Preview" style="height: 320px; margin-right: 12px;" />
	<img src="preview2.png" alt="OpenScreen App Preview 2" style="height: 320px; margin-right: 12px;" />
	<img src="preview3.png" alt="OpenScreen App Preview 3" style="height: 320px; margin-right: 12px;" />
	<img src="preview4.png" alt="OpenScreen App Preview 4" style="height: 320px; margin-right: 12px;" />
	
</p>
</p>

## Core Features
- Record your whole screen or specific apps
- Add manual zooms (customizable depth levels)
- Customize the duration and position of zooms however you please
- Crop video recordings to hide parts
- Choose between wallpapers, solid colors, gradients or your own picture for your background
- Motion blur for smoother pan and zoom effects
- Add annotations (text, arrows, images)
- Trim sections of the clip
- Export in different aspect ratios and resolutions

## macOS Installation instructions

Download the latest installer for your platform from the [GitHub Releases](https://github.com/siddharthvaddem/openscreen/releases) page.

If you encounter issues with macOS Gatekeeper blocking the app (since it does not come with a developer certificate), you can bypass this by running the following command in your terminal after installation:

```bash
xattr -rd com.apple.quarantine /Applications/Openscreen.app
```

After running this command, proceed to **System Preferences > Security & Privacy** to grant the necessary permissions for "screen recording" and "accessibility". Once permissions are granted, you can launch the app.

## Built with
- Electron
- React
- TypeScript
- Vite
- PixiJS
- dnd-timeline

---


_I'm new to open source, idk what I'm doing lol. If something is wrong please raise an issue 🙏_

## License


This project is licensed under the [MIT License](./LICENSE). By using this software, you agree that the authors are not liable for any issues, damages, or claims arising from its use.
