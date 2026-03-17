type PendingConsumer = {
	resolve: (frame: VideoFrame | null) => void;
	reject: (error: Error) => void;
};

export class AsyncVideoFrameQueue {
	private frames: VideoFrame[] = [];
	private consumers: PendingConsumer[] = [];
	private error: Error | null = null;
	private closed = false;

	get length() {
		return this.frames.length;
	}

	enqueue(frame: VideoFrame) {
		if (this.closed) {
			frame.close();
			return;
		}

		const consumer = this.consumers.shift();
		if (consumer) {
			consumer.resolve(frame);
			return;
		}

		this.frames.push(frame);
	}

	fail(error: Error) {
		this.error = error;
		this.closed = true;
		const consumers = this.consumers.splice(0);
		for (const consumer of consumers) {
			consumer.reject(error);
		}
		for (const frame of this.frames) {
			frame.close();
		}
		this.frames = [];
	}

	close() {
		this.closed = true;
		const consumers = this.consumers.splice(0);
		for (const consumer of consumers) {
			consumer.resolve(null);
		}
	}

	async dequeue(): Promise<VideoFrame | null> {
		if (this.error) {
			throw this.error;
		}

		if (this.frames.length > 0) {
			return this.frames.shift() ?? null;
		}

		if (this.closed) {
			return null;
		}

		return await new Promise<VideoFrame | null>((resolve, reject) => {
			this.consumers.push({ resolve, reject });
		});
	}

	destroy() {
		this.close();
		for (const frame of this.frames) {
			frame.close();
		}
		this.frames = [];
	}
}
