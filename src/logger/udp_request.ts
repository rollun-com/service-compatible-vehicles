import udp, { Socket } from 'dgram';

export default class UDPClient {
	private _client: Socket;

	constructor(private host: string, private port: number) {
		this._client = udp.createSocket('udp4');
	}

	private static _encodeData(data: any): Buffer {
		const encodedDataString = typeof data === 'string'
			? data
			: JSON.stringify(data);
		return Buffer.from(encodedDataString);
	}

	send(data: any, cb = () => {}) {
		if (cb) {
			this._client.send(
				UDPClient._encodeData(data),
				this.port,
				this.host,
				cb
			)
		} else {
			return new Promise((resolve, reject) => {
				this._client.send(
					UDPClient._encodeData(data),
					this.port,
					this.host,
					error => error ? reject(error) : resolve()
				)
			});
		}
	};
}
